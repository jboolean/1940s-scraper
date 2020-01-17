const { Pool } = require('pg');
const parse = require('csv-parse');
const fs = require('fs');
const axios = require('axios');
const { Writable } = require('stream');
const _ = require('lodash');

// Oops. It looks like the department of records had an Excel formatting accident.
// Sometimes the building number is coded like '25-Jan', what this means is that the building number should be '1-25'.
const oopsMonths = {
  'Jan': 1,
  'Feb': 2,
  'Mar': 3,
  'Apr': 4,
  'May': 5,
  'Jun': 6,
  'Jul': 7,
  'Aug': 8,
  'Sep': 9,
  'Oct': 10,
  'Nov': 11,
  'Dec': 12
};

( async function () {
  const pool = new Pool({
    user: 'julianboilen',
    host: 'localhost',
    database: 'fourtiesnyc'
  });

  const parser = parse({
    columns: true,
    // eslint-disable-next-line camelcase
    relax_column_count: true
  });

  const toPostgres = new Writable({
    objectMode: true,
    write(data, encoding, callback) {
      data = _.mapValues(data, (v, k) => v || null);
      const {
        Identifier: identifier,
        Date: date,
        Borough: borough,
        Block: block,
        Lot: lot,
        '1940 Building Number': fullBldgNum,
        '1940 Street Name': streetName,
        Address: address,
        Condition: condition,
        Description: description
      } = data;
      const isOuttake = date === 'Outtake';

      let buildingNumberStart;
      let buildingNumberEnd;
      if (fullBldgNum) {
        if (fullBldgNum.includes('-')) {
          [buildingNumberStart, buildingNumberEnd] = fullBldgNum.split('-', 2);
        } else {
          buildingNumberStart = buildingNumberEnd = fullBldgNum;
        }
      }

      // Fix the Department of Records apparent Excel accident.
      if (buildingNumberEnd in oopsMonths) {
        const correctBuildingNumber = oopsMonths[buildingNumberEnd];
        buildingNumberEnd = buildingNumberStart;
        buildingNumberStart = correctBuildingNumber;
      }


      let sideOfStreet;
      if (buildingNumberStart) {
        sideOfStreet = (+buildingNumberStart.match(/^\d+/)) % 2 === 0;
      }

      pool.query(`INSERT into photos(
        identifier, date, borough, block, lot, bldg_number_start, bldg_number_end, 
        side_of_street, street_name, address, condition, is_outtake)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING`,
      [identifier, date, borough, block, lot, buildingNumberStart, buildingNumberEnd,
        sideOfStreet, streetName, address, condition, isOuttake], (pgErr) => {
        if (pgErr) {
          callback({
            data,
            error: pgErr
          });
        } else {
          callback();
        }
      });
    }
  });

  fs.createReadStream('metadata.csv').pipe(parser).pipe(toPostgres)
    .on('finish', () => {
      pool.end();
    })
    .on('error', (err) => {
      console.log(err);
    });

}());

