const fs = require('fs');
const request = require('request');
const axios = require('axios');
const csvWriter = require('csv-write-stream');
const async = require('async');
const PARALLELISM = 10;

const FIRST_PAGE_URL = 'http://nycma.lunaimaging.com/luna/servlet/iiif/collection/s/556wi0';
const METADATA_FILE = 'metadata.csv';
const METADATA_HEADERS = ['Identifier',
  'Date',
  'Borough',
  'Block',
  'Lot', '1940 Building Number',
  '1940 Street Name',
  'Address',
  'Condition',
  'Year Built',
  'Year Altered'];
const IMAGES_DIR = 'images';
const LAST_COLLECTION_LOG_FILE = 'lastCollection';

const download = function (uri, filename) {
  return new Promise((resolve, reject) => {
    request.head(uri, function (err, res, body) {
      request(uri).pipe(fs.createWriteStream(filename)).on('close', resolve);
    });
  });
};

(async () => {
  const csvOptions = fs.existsSync(METADATA_FILE) ?
    { sendHeaders: false } : { headers: METADATA_HEADERS };

  const writer = csvWriter(csvOptions);
  writer.pipe(fs.createWriteStream(METADATA_FILE, { flags: 'a' }));

  // Pick up where left off if possible
  let nextPageUrl = fs.existsSync(LAST_COLLECTION_LOG_FILE) ?
    fs.readFileSync(LAST_COLLECTION_LOG_FILE, { encoding: 'utf8' }) : FIRST_PAGE_URL;

  while (nextPageUrl) {
    console.log('Loading page', nextPageUrl);

    const collectionResp = await axios.get(nextPageUrl);
    const collection = collectionResp.data;
    if (collection.total) {
      console.log(Math.round((collection.startIndex / collection.total) * 100) + '% complete');
    }
    const q = async.queue(async (manifestSummary) => {
      const manifestResp = await axios.get(manifestSummary['@id']);
      const manifest = manifestResp.data;
      const canvas = manifest.sequences[0].canvases[0];
      const metadata = {};
      canvas.metadata
        .forEach(metadatum => {
          const key = metadatum.label;
          const value = metadatum.value.replace(/<\/?[^>]+>/g, '');
          metadata[key] = value;
        });
      const thumbnailUrl = canvas.thumbnail['@id'];
      const fullSizeImageUrl = thumbnailUrl.replace('Size0', 'Size4');
      const filename = `${IMAGES_DIR}/${metadata.Identifier}.jpg`;
      if (!fs.existsSync(filename)) {
        console.log(metadata);
        writer.write(metadata);
        await download(fullSizeImageUrl, filename);
      } else {
        console.log('Skipping', metadata.Identifier);
      }
    }, PARALLELISM);
    const end = () => {
      return new Promise((resolve, reject) => {
        q.drain = () => {
          console.log('Drained');
          resolve();
        };
      });
    };
    q.push(collection.manifests);
    await end();

    nextPageUrl = collection.total ? collection.next : null;
    if (nextPageUrl) {
      fs.writeFileSync(LAST_COLLECTION_LOG_FILE, nextPageUrl);
    }
  }
  writer.end();
})();
