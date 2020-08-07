const _ = require('lodash');

module.exports = async function insertMetadata(pool, cleanData) {

  const {
    identifier,
    date,
    borough,
    block,
    lot,
    buildingNumberStart,
    buildingNumberEnd,
    sideOfStreet,
    streetName,
    address,
    condition,
    isOuttake
  } = cleanData;

  // console.log(cleanData);

  await pool.query(`INSERT into photos(
        identifier, date, borough, block, lot, bldg_number_start, bldg_number_end, 
        side_of_street, street_name, address, condition, is_outtake)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT DO NOTHING`,
  [identifier, date, borough, block, lot, buildingNumberStart, buildingNumberEnd,
    sideOfStreet, streetName, address, condition, isOuttake]);
};

