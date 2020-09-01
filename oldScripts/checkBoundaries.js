const { Pool } = require('pg');
const Cursor = require('pg-cursor');
const { promisify } = require('util');
const getBorough = require('../getBorough');

const pool = new Pool({
  user: 'postgres',
  // host: 'fourtiesnyc.cluster-cioc65o5flzv.us-east-1.rds.amazonaws.com',
  host: 'localhost',
  database: 'postgres',
  password: '***REMOVED***',
  // port: 5432,
  port: 5433
});

(async () => {
  /*
      Find where it has never geocoded successfuly and never geocoded at all with this method
      Mapbox doesn't count as a success because it sucks.
      */
  const client = await pool.connect();

  const cursor = client.query(
    new Cursor('select method, lng_lat, photo, p.borough from geocode_results join photos p on p.identifier = geocode_results.photo')
  );
  const promisifiedCursorRead = promisify(cursor.read.bind(cursor));

  const ROW_COUNT = 10;
  let done = false;
  while (!done) {
    const results = await promisifiedCursorRead(ROW_COUNT);

    done = results.length === 0;
    const promises = results
      .map(async (result) => {
        const { lng_lat: lngLat, photo, method, borough } = result;
        if (!lngLat) {return;}
        const pointBorough = getBorough([lngLat.x, lngLat.y]);
        if (pointBorough !== borough) {
          console.log('Borough mismatch', borough, pointBorough, result);
          await pool.query('delete from geocode_results where photo = $1 and method = $2', [photo, method]);
        }
      });
    await Promise.all(promises);
  }

  cursor.close(() => {
    client.end();
  });
})();