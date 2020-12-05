const { Pool } = require('pg');
const QueryStream = require('pg-query-stream');
const JSONStream = require('JSONStream');
const { Transform } = require('stream');
const gp = require('geojson-precision');

const QUERY = 'select identifier, lng_lat from effective_geocodes_view';

const OPEN = `
{
  "type": "FeatureCollection",
  "features":\n`;

const CLOSE = `
}`;

const pool = new Pool();

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

const appendTransform = new Transform({
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