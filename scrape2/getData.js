/* eslint-disable no-loop-func */
const axios = require('axios');
const fs = require('fs');
const cleanupData = require('./cleanupData');
const backoff = require('../backoff');
const path = require('path');

const myAxios = axios.create({
  timeout: 1000
});


const backoffGet = backoff((...args) => myAxios.get(...args));

const LAST_COLLECTION_LOG_FILE = path.join(__dirname, './lastCollection');

async function* scrapeData(firstPageUrl) {
  let nextPageUrl = fs.existsSync(LAST_COLLECTION_LOG_FILE) ?
    fs.readFileSync(LAST_COLLECTION_LOG_FILE, { encoding: 'utf8' }) : firstPageUrl;


  while (nextPageUrl) {
    console.log('Loading page', nextPageUrl);

    const collectionResp = await backoffGet(nextPageUrl);
    if (!collectionResp.headers['content-type'].includes('application/json')) {
      console.warn('Response is not JSON, may indicate no more pages');
      return;
    }
    const collection = collectionResp.data;
    if (collection.total) {
      console.log(Math.round((collection.startIndex / collection.total) * 100) + '% complete');
    }

    const manifestResps = await Promise.all(collection.manifests.map(manifestSummary => backoffGet(manifestSummary['@id'])));

    for (const manifestResp of manifestResps) {
      const manifest = manifestResp.data;
      const canvas = manifest.sequences[0].canvases[0];
      const metadata = {};
      canvas.metadata
        .forEach(metadatum => {
          const key = metadatum.label;
          const value = metadatum.value.replace(/<\/?[^>]+>|�|\.jpg/g, '');
          metadata[key] = value;
        });
      const thumbnailUrl = canvas.thumbnail['@id'];
      const fullSizeImageUrl = thumbnailUrl.replace('Size0', 'Size4');
      const cleanData = cleanupData(metadata);
      if (!cleanData) {
        // Cannot be cleaned. Skip.
        console.warn('Skipping record', metadata);
        continue;
      }
      cleanData.imageUrl = fullSizeImageUrl;
      yield cleanData;
    }
    if (nextPageUrl) {
      fs.writeFileSync(LAST_COLLECTION_LOG_FILE, nextPageUrl);
    }
    nextPageUrl = collection.total ? collection.next : null;
  }
}

module.exports = scrapeData;