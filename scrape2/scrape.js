const { Pool } = require('pg');
const { performance, PerformanceObserver } = require('perf_hooks');


const getData = require('./getData');
const downloadImage = require('./downloadImage');
const geocode = require('./geocode');
const insertMetadata = require('./insertMetadata');
const insertGeocodeResult = require('./insertGeocodeResult');
const imageExists = require('./imageExists');
const eachLimit = require('async/eachLimit');
const getCachedGeocodeResults = require('./getCachedGeocodeResults');
const calculatePlaceholderSimilarity = require('./calculatePlaceholderSimilarity');

const obs = new PerformanceObserver((items) => {

  items.getEntries().forEach((item) => {
    // console.log(item.name, +' ' + item.duration);
  });
});
obs.observe({ entryTypes: ['measure'] });

const LIMIT = 25;

// Enable if re-running to avoid re-downloading images
const CHECK_IMAGE_EXISTS = false;

(async () => {
  const collection = process.argv[2];
  const collectionUrl = process.argv[3];

  if (!collection || !collectionUrl) {
    console.log(`
    Usage: node scrape.js collection first_page_url
    Example: node scrape.js 1980 http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/raw254
    `);
    return;
  }

  const pool = new Pool();

  console.log('starting', collection, collectionUrl);
  await eachLimit(getData(collectionUrl), LIMIT, async (record) => {
    const { identifier, imageUrl, width } = record;


    performance.mark('beginCheckBigger');
    // For the 80s photos there are somtimes multiple records with the same identifier at different resolutions
    // See if there is already a larger image with this identifier.
    // If not, new image with overwrite old.
    const hasBiggerImageRes = await pool.query({
      text: 'SELECT count(*) as count FROM PHOTOS WHERE identifier = $1 AND width > $2',
      values: [identifier, width],
    });
    const hasBiggerImage = hasBiggerImageRes.rows[0].count > 0;
    if (hasBiggerImage) {
      console.log(`There is already a larger image for ${identifier}. Skipping.`);
      return;
    }
    performance.mark('endCheckBigger');
    performance.measure('checkBigger', 'beginCheckBigger', 'endCheckBigger');

    if (!CHECK_IMAGE_EXISTS || !(await imageExists(identifier))) {
      performance.mark('beginDownloadImage');
      const image = await downloadImage(imageUrl, identifier);
      if (!image) {
        console.error('Image not downloaded. Bailing.', identifier);
        return;
      }
      performance.mark('endDownloadImage');
      performance.measure('downloadImage', 'beginDownloadImage', 'endDownloadImage');

      // Placeholder similarity doesn't seem that accurate and is slow
      /*
      performance.mark('beginCalculateSimilarity');
      // Attach placeholder similarity to record for persisting.
      const placeholderSimilarity = await calculatePlaceholderSimilarity(image);
      record.placeholderSimilarity = placeholderSimilarity;
      performance.mark('endCalculateSimilarity');
      performance.measure('calculateSimilarity', 'beginCalculateSimilarity', 'endCalculateSimilarity');
      */
    }

    // console.log(record);
    console.log(record.address);

    performance.mark('beginInsertMeta');
    await insertMetadata(pool, record, collection);
    performance.mark('endInsertMeta');
    performance.measure('insertMeta', 'beginInsertMeta', 'endInsertMeta');

    performance.mark('beginGeocode');
    const cachedGeocodeResults = await getCachedGeocodeResults(pool, record, collection);
    const hasCachedGeocodeResults = Object.values(cachedGeocodeResults).some(Boolean);
    const geocodeResults = hasCachedGeocodeResults ? cachedGeocodeResults : await geocode(record);
    performance.mark('endGeocode');
    performance.measure('geocode', 'beginGeocode', 'endGeocode');

    // console.log('Geocode', hasCachedGeocodeResults, geocodeResults);
    for (const [method, location] of Object.entries(geocodeResults)) {
      await insertGeocodeResult(pool, identifier, { method, location });
    }

    // console.log(performance.getEntriesByType('measure'));
  });
  await pool.query('REFRESH MATERIALIZED VIEW effective_geocodes_view WITH DATA');
  pool.end();
})();
