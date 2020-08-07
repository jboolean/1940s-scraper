const parse = require('csv-parse');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');

const parser = parse({
  columns: true,
  cast: (value, { column }) => {
    if (column === 'bbl' && value) {
      return Number(value);
    }
    return value;
  }
});



module.exports = () => new Promise((resolve, reject) => {
  const locByBbl = new Map();
  const collect = new Writable({
    objectMode: true,
    write(data, encoding, callback) {
      const { bbl, latitude, longitude } = data;
      if (bbl && latitude && longitude) {
        locByBbl.set(bbl, [longitude, latitude]);
      }
      callback();
    }
  });

  console.log('Loading PLUTO data…');
  const startT = process.hrtime();

  fs.createReadStream(path.join(__dirname, './pluto_20v4.csv')).pipe(parser).pipe(collect)
    .on('finish', () => {
      const endT = process.hrtime(startT);
      console.info('Loaded %s tax lots. %ds %dms', locByBbl.size, endT[0], endT[1] / 1000000);
      resolve(locByBbl);
    }).on('error', (err) => {
      console.log(err);
      reject(err);
    });

});