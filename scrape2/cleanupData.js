const _ = require('lodash');

// Oops. It looks like the department of records had an Excel formatting accident.
// Sometimes the building number is coded like '25-Jan', what this means is that the building number should be '1-25'.
const oopsMonths = {
  'Jan': '1',
  'Feb': '2',
  'Mar': '3',
  'Apr': '4',
  'May': '5',
  'Jun': '6',
  'Jul': '7',
  'Aug': '8',
  'Sep': '9',
  'Oct': '10',
  'Nov': '11',
  'Dec': '12'
};

const BOROUGH_80S_PATTERN = /\(([\w\s]+)\)/;

/**
 * Rename fields, cleanup mistakes, add some calculated fields.
 */
module.exports = function cleanupData(raw) {
  let {
    Identifier: identifier,
    Date: date,
    Borough: borough,
    Block: block,
    Lot: lot,
    '1940 Building Number': fourtiesBldgNum,
    'Building Number': eightiesBldgNum,
    '1940 Street Name': fourtiesStreetName,
    'Street Name': eightiesStreetName,
    Address: address,
    'Zip Code': postalCode,
    Condition: condition,
    Description: description,
    'Owner (In 1990)': owner,
  } = _.mapValues(raw, (v) => v || null);

  const fullBldgNum = fourtiesBldgNum || eightiesBldgNum;
  const streetName = fourtiesStreetName || eightiesStreetName;


  // eighties does not have address, make one
  if (!address) {
    address = _.compact([fullBldgNum, streetName]).join(' ');
  }


  if (block >= 32767 || (block && isNaN(block))) {
    console.warn('Block appears incorrect, clearing.', block);
    block = undefined;
  }

  if (lot >= 32767 || (lot && isNaN(lot))) {
    console.warn('Lot appears incorrect, clearing.', lot);
    lot = undefined;
  }

  const isOuttake = date === 'Outtake' || description === 'Outtake';
  if (date === 'Outtake') {
    date = null;
  }

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


  // In the 80s photos the borough is like "1 (Manhattan)"
  // Convert this to be just the borough name like the 40s photos.
  if (borough.match(BOROUGH_80S_PATTERN)) {
    borough = borough.match(BOROUGH_80S_PATTERN)[1];
  }

  return {
    identifier,
    date,
    borough,
    block,
    lot,
    fullBldgNum,
    streetName,
    address,
    postalCode,
    condition,
    isOuttake,
    sideOfStreet,
    buildingNumberStart,
    buildingNumberEnd,
    owner,
  };
};