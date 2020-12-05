/* eslint-disable no-loop-func */
const axios = require('axios');
const fs = require('fs');
const cleanupData = require('./cleanupData');
const backoff = require('../backoff');
const path = require('path');

const myAxios = axios.create({
  timeout: 2000
});


const backoffGet = backoff((...args) => myAxios.get(...args));
const backoffHead = backoff((...args) => myAxios.head(...args));


const LAST_COLLECTION_LOG_FILE = path.join(__dirname, './lastCollection');

async function getFullSizeImageUrl(thumbnailUrl) {
  for (let size = 4; size >= 0; size--) {
    const fullSizeImageUrl = thumbnailUrl.replace('Size0', 'Size' + size);
    const resp = await backoffHead(fullSizeImageUrl, {
      validateStatus: (status) => status < 500
    });
    if (resp.status !== 404) {
      return fullSizeImageUrl;
    }
  }
  throw new Error('Image not found');
}

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
          const value = metadatum.value.replace(/<\/?[^>]+>|�|\.jpg|\.tif/g, '');
          metadata[key] = value;
        });
      const thumbnailUrl = canvas.thumbnail['@id'];
      const fullSizeImageUrl = await getFullSizeImageUrl(thumbnailUrl);
      const cleanData = cleanupData(metadata);
      if (!cleanData) {
        // Cannot be cleaned. Skip.
        console.warn('Skipping record', metadata);
        continue;
      }
      cleanData.imageUrl = fullSizeImageUrl;
      cleanData.width = canvas.width;
      cleanData.height = canvas.height;
      yield cleanData;
    }
    if (nextPageUrl) {
      fs.writeFileSync(LAST_COLLECTION_LOG_FILE, nextPageUrl);
    }
    nextPageUrl = collection.total ? collection.next : null;
  }
}

module.exports = scrapeData;