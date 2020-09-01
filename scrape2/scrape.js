const { Pool } = require('pg');

const getData = require('./getData');
const downloadImage = require('./downloadImage');
const geocode = require('./geocode');
const insertMetadata = require('./insertMetadata');
const insertGeocodeResult = require('./insertGeocodeResult');
const imageExists = require('./imageExists');
const eachLimit = require('async/eachLimit');

const LIMIT = 25;
const USE_PROXY = true;

const COLLECTIONS = {
  Manhattan: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/556wi0',
  Brooklyn: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/jsb4jg',
  Bronx: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/an4xbo',
  Queens: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/93ix4w',
  'Staten Island': 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/ue533x'
};

(async () => {
  const borough = process.argv[2];

  const pool = new Pool({
    user: 'postgres',
    host: USE_PROXY ? 'localhost' : 'fourtiesnyc.cluster-cioc65o5flzv.us-east-1.rds.amazonaws.com',
    database: 'postgres',
    password: '***REMOVED***',
    port: USE_PROXY ? 5433 : 5432
  });

  console.log('starting', borough);
  await eachLimit(getData(COLLECTIONS[borough]), LIMIT, async (record) => {
    const { identifier, imageUrl } = record;
    // console.log(record.address);

    await insertMetadata(pool, record);

    // if (!(await imageExists(identifier))) {
    //   console.log('Downloading missing image', identifier);
    await downloadImage(imageUrl, identifier);
    // }

    const geocodeResults = await geocode(record);
    // console.log(geocodeResults);
    for (const [method, location] of Object.entries(geocodeResults)) {
      await insertGeocodeResult(pool, identifier, { method, location });
    }
  });
  await pool.query('REFRESH MATERIALIZED VIEW effective_geocodes_view WITH DATA');
  pool.end();
})();
