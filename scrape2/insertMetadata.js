module.exports = async function insertMetadata(pool, cleanData, collection) {

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
    isOuttake,
    width,
    height,
    placeholderSimilarity,
    postalCode,
    owner,
  } = cleanData;

  // console.log(cleanData);

  await pool.query(`INSERT into photos(
        identifier, date, borough, block, lot, bldg_number_start, bldg_number_end, 
        side_of_street, street_name, address, condition, is_outtake, width, height, collection, placeholder_similarity, postal_code, owner)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT(identifier)
        DO UPDATE SET
        is_outtake = $12,
        width = $13,
        height = $14,
        collection = $15`,
  [identifier, date, borough, block, lot, buildingNumberStart, buildingNumberEnd,
    sideOfStreet, streetName, address, condition, isOuttake, width, height, collection, placeholderSimilarity, postalCode, owner]);
};

