const { Pool } = require('pg');

const getData = require('./getData');
const downloadImage = require('./downloadImage');
const geocode = require('./geocode');
const insertMetadata = require('./insertMetadata');
const insertGeocodeResult = require('./insertGeocodeResult');
const imageExists = require('./imageExists');
const eachLimit = require('async/eachLimit');

const LIMIT = 20;

const COLLECTIONS = {
  Manhattan: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/556wi0',
  Brooklyn: 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/jsb4jg'
};

(async () => {
  const borough = process.argv[2];

  const pool = new Pool({
    user: 'postgres',
    // host: 'fourtiesnyc.cluster-cioc65o5flzv.us-east-1.rds.amazonaws.com',
    host: 'localhost',
    database: 'postgres',
    password: '***REMOVED***',
    // port: 5432,
    port: 5433
  });

  console.log('starting', borough);
  await eachLimit(getData(COLLECTIONS[borough]), LIMIT, async (record) => {
    const { identifier, imageUrl } = record;
    // console.log(record.address);

    // const [[count]] = await pool.query({ text: `
    //   select count(*) as count from photos
    //   inner join geocode_results on photos.identifier = geocode_results.photo
    //   where photos.identifier = $1
    //   and geocode_results.lng_lat is not null;`,
    // values: [identifier],
    // rowMode: 'array' });
    // console.log('Non-null geocode results:', count);

    // await insertMetadata(pool, record);

    // await downloadImage(imageUrl, identifier);

    const geocodeResults = await geocode(record);
    console.log(geocodeResults);
    // for (const [method, location] of Object.entries(geocodeResults)) {
    //   await insertGeocodeResult(pool, identifier, { method, location });
    // }
  });
  pool.end();
})();
