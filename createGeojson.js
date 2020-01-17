const { Pool } = require('pg');
const QueryStream = require('pg-query-stream');
const JSONStream = require('JSONStream');
const { Transform } = require('stream');
const gp = require("geojson-precision");

const QUERY = `
  select distinct on (photos.identifier) photos.identifier, photos.address, geocode_results.lng_lat, geocode_results.method
    from photos 
    inner join geocode_results
      on photos.identifier = geocode_results.photo
    join (values ('geosearch', 1), ('gmaps', 2), ('gmapsPlacesAutocomplete', 3), ('mapbox', 999)) as method_order(method, rank)
      on geocode_results.method = method_order.method
    where geocode_results.lng_lat is not null and geocode_results.method != 'mapbox'
    order by photos.identifier, method_order.rank asc;`;

const OPEN = `
{
  "type": "FeatureCollection",
  "features":\n`;

const CLOSE = `
}`;

const pool = new Pool({
  user: 'julianboilen',
  host: 'localhost',
  database: 'fourtiesnyc'
});

const rowToFeature = (row) => (
  {
    'type': 'Feature',
    'geometry': {
      'type': 'Point',
      'coordinates': [
        row.lng_lat.x,
        row.lng_lat.y
      ]
    },
    'properties': {
      // 'type': 'fourtiesPhoto',
      'photoIdentifier': row.identifier,
      // 'address': row.address,
      // 'geocodeMethod': row.method
    }
  }
);

const rowToFeatureTransform = new Transform({
  objectMode: true,

  transform(chunk, encoding, callback) {
    callback(null, rowToFeature(chunk));
  }
});

const reducePrecisionTransform = new Transform({
  objectMode: true,

  transform(chunk, encoding, callback) {
    callback(null, gp(chunk, 5));
  }
});

var appendTransform = new Transform({
  objectMode: true,
    transform(chunk, encoding, callback) {
        callback(null, chunk);
    },
    flush(callback) {
        this.push(CLOSE);
        callback();
    }
});

const run = async () => {
  const client = await pool.connect();

  const query = new QueryStream(QUERY);
  const stream = client.query(query);

  process.stdout.write(OPEN);

  stream.on('end', () => {
    client.end();
  });
  stream
    .pipe(rowToFeatureTransform)
    .pipe(reducePrecisionTransform)
    .pipe(JSONStream.stringify())
    .pipe(appendTransform)
    .pipe(process.stdout);
};
run().catch(e => {
  console.error(e);
});