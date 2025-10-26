const { Pool } = require('pg');
const Cursor = require('pg-cursor');
const QueryStream = require('pg-query-stream');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const getData = require('./getData');
const downloadImage = require('./downloadImage');
const geocode = require('./geocode');
const insertMetadata = require('./insertMetadata');
const insertGeocodeResult = require('./insertGeocodeResult');
const imageExists = require('./imageExists');
const eachLimit = require('async/eachLimit');

const LIMIT = 25;

const PARAMETER_PREFIX = 'fourtiesnyc-production-db';

function prettyPrintGeocodeResults(geocodeResults) {
  const results = Object.entries(geocodeResults)
    .filter(([, coords]) => coords && coords.length === 2)
    .map(([provider, [lng, lat]]) => `${provider}:${lat},${lng}`);
  return results.length ? 'Geocoded: ' + results.join(' ') : 'Could not geocode';
}

async function getSsmParameter(name) {
  const client = new SSMClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: true,
  });
  const response = await client.send(command);
  return response.Parameter.Value.trim();
}

async function getDatabaseCredentials() {
  const [username, password, host, database, port] = await Promise.all([
    getSsmParameter(`${PARAMETER_PREFIX}-username`),
    getSsmParameter(`${PARAMETER_PREFIX}-password`),
    getSsmParameter(`${PARAMETER_PREFIX}-host`),
    getSsmParameter(`${PARAMETER_PREFIX}-database`),
    getSsmParameter(`${PARAMETER_PREFIX}-port`),
  ]);

  return { user: username, password, host, database, port };
}


const query = `
  SELECT *
  FROM photos
  WHERE identifier LIKE '%_w5'
    AND identifier IN (
      SELECT photo
      FROM geocode_results
      WHERE photo LIKE '%_w5'
        AND method = 'pluto'
        AND lng_lat IS NOT NULL
    )
`;



(async () => {
  let pool,
    client;

  try {
    const credentials = await getDatabaseCredentials();

    pool = new Pool({
      ...credentials,
      connectionTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      console.error('Pool error:', err);
    });

    client = await pool.connect();

    await client.query('BEGIN');

    const qs = new QueryStream(query, [], { batchSize: LIMIT });
    const cursor = client.query(qs);

    for await (const rawRecord of cursor) {
      const record = {
        identifier: rawRecord.identifier,
        date: rawRecord.date,
        borough: rawRecord.borough,
        block: rawRecord.block,
        lot: rawRecord.lot,
        fullBldgNum: rawRecord.full_bldg_num,
        streetName: rawRecord.street_name,
        address: rawRecord.address,
        condition: rawRecord.condition,
        isOuttake: rawRecord.is_outtake,
        sideOfStreet: rawRecord.side_of_street,
        buildingNumberStart: rawRecord.bldg_number_start,
        buildingNumberEnd: rawRecord.bldg_number_end
      };
      console.log(`${record.identifier}: ${record.address}, ${record.borough}`);

      const geocodeResults = await geocode(record);
      console.log(prettyPrintGeocodeResults(geocodeResults));
      console.log('\n');

      for (const [method, location] of Object.entries(geocodeResults)) {
        await insertGeocodeResult(pool, record.identifier, { method, location });
      }
    }

    await client.query('COMMIT');

    await pool.query(
      'REFRESH MATERIALIZED VIEW effective_geocodes_view WITH DATA'
    );

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  }
})();
