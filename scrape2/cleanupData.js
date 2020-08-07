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
    '1940 Building Number': fullBldgNum,
    '1940 Street Name': streetName,
    Address: address,
    Condition: condition } = _.mapValues(raw, (v) => v || null);


  if (block >= 32767 || (block && isNaN(block))) {
    console.warn('Block appears incorrect, clearing.', block);
    block = undefined;
  }

  if (lot >= 32767 || (lot && isNaN(lot))) {
    console.warn('Lot appears incorrect, clearing.', lot);
    lot = undefined;
  }

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

  return {
    identifier,
    date,
    borough,
    block,
    lot,
    fullBldgNum,
    streetName,
    address,
    condition,
    isOuttake,
    sideOfStreet,
    buildingNumberStart,
    buildingNumberEnd
  };
};