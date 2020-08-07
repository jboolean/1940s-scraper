module.exports = async function insertGeocodeResult(pool, identifier, geocodeResult) {
  const {
    location,
    method
  } = geocodeResult;

  const pointString = location ? `(${location[0]}, ${location[1]})` : null;
  return pool.query(`insert into geocode_results (method, photo, lng_lat) 
  values ($1, $2, $3) 
  on conflict (photo, method) 
  do update set lng_lat = $3;`,
  [method, identifier, pointString]);
};

