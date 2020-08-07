const fs = require('fs');
const get = require('lodash/get');
const path = require('path');

const boundariesGeojson = JSON.parse(fs.readFileSync(path.join(__dirname, './Borough Boundaries.geojson')));

function getBoundingBox(data) {
  let bounds = {},
    coordinates,
    point,
    latitude,
    longitude;

  // Loop through each "feature"
  for (let i = 0; i < data.features.length; i++) {
    coordinates = data.features[i].geometry.coordinates;

    if (coordinates.length === 1) {
      // It's only a single Polygon
      // For each individual coordinate in this feature's coordinates...
      for (var j = 0; j < coordinates[0].length; j++) {
        longitude = coordinates[0][j][0];
        latitude = coordinates[0][j][1];

        // Update the bounds recursively by comparing the current xMin/xMax and yMin/yMax with the current coordinate
        bounds.xMin = bounds.xMin < longitude ? bounds.xMin : longitude;
        bounds.xMax = bounds.xMax > longitude ? bounds.xMax : longitude;
        bounds.yMin = bounds.yMin < latitude ? bounds.yMin : latitude;
        bounds.yMax = bounds.yMax > latitude ? bounds.yMax : latitude;
      }
    } else {
      // It's a MultiPolygon
      // Loop through each coordinate set
      for (var j = 0; j < coordinates.length; j++) {
        // For each individual coordinate in this coordinate set...
        for (let k = 0; k < coordinates[j][0].length; k++) {
          longitude = coordinates[j][0][k][0];
          latitude = coordinates[j][0][k][1];

          // Update the bounds recursively by comparing the current xMin/xMax and yMin/yMax with the current coordinate
          bounds.xMin = bounds.xMin < longitude ? bounds.xMin : longitude;
          bounds.xMax = bounds.xMax > longitude ? bounds.xMax : longitude;
          bounds.yMin = bounds.yMin < latitude ? bounds.yMin : latitude;
          bounds.yMax = bounds.yMax > latitude ? bounds.yMax : latitude;
        }
      }
    }
  }

  // Returns an object that contains the bounds of this GeoJSON data.
  // The keys describe a box formed by the northwest (xMin, yMin) and southeast (xMax, yMax) coordinates.
  return bounds;
}

const bbox = getBoundingBox({ features: boundariesGeojson.features.filter(feature => feature.properties.boro_name === 'Manhattan') });

console.log(bbox);