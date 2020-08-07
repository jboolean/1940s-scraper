const fs = require('fs');
const get = require('lodash/get');
const path = require('path');

const GeoJsonGeometriesLookup = require('geojson-geometries-lookup');

const boundariesGeojson = JSON.parse(fs.readFileSync(path.join(__dirname, './Borough Boundaries.geojson')));

const nycLookup = new GeoJsonGeometriesLookup(boundariesGeojson);

function getBorough(coordinates) {
  const pointGeojson = { type: 'Point', coordinates };

  const result = nycLookup.getContainers(pointGeojson);

  return get(result, 'features[0].properties.boro_name');
}

module.exports = getBorough;
