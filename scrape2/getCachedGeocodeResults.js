/**
 * Get geocode results for the same tax lot from another collection to avoid re-geocoding.
 */
async function getCachedGeocodeResults(pool, data, collection) {
  const result = await pool.query({
    text: `SELECT gr.method, gr.lng_lat FROM photos p 
      LEFT JOIN geocode_results gr on gr.photo = p.identifier
      WHERE p.borough = $1 AND p.block = $2 AND p.lot = $3 AND p.block IS NOT NULL and p.lot IS NOT NULL AND p.collection != $4`,
    values: [data.borough, data.block, data.lot, collection]
  });

  const byMethod = {};

  result.rows.forEach(({ method, lng_lat: lngLat }) => {
    if (byMethod[method]) {return;}
    byMethod[method] = lngLat ? [lngLat.x, lngLat.y] : null;
  });

  return byMethod;
}

module.exports = getCachedGeocodeResults;