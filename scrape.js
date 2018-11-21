const fs = require('fs');
const request = require('request');
const axios = require('axios');
const csvWriter = require('csv-write-stream');
const async = require('async');
const AWS = require('aws-sdk');
const credentials = require('./credentials');

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
const LAST_COLLECTION_LOG_FILE = 'lastCollection';


const s3 = new AWS.S3({
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  accessKeyId: credentials.keyId,
  secretAccessKey: credentials.secret,
  params: {
    Bucket: '40snyc'
  }
});


const download = function (uri, key) {
  return new Promise((resolve, reject) => {
    request({ url: uri, encoding: null }, function (err, res, body) {
      if (err) {
        reject(err);
        return;
      }
      resolve(s3.upload({
        Body: body,
        Key: key,
        ContentType: res.headers['content-type'],
        ContentLength: res.headers['content-length']
      })
        .promise());
    });
  });
};

const exists = (key) => {
  return new Promise((resolve, reject) => {
    s3.headObject({
      Key: key
    }, (err, data) => {
      if (err) {
        if (err.code === 'NotFound') {
          resolve(false);
        } else {
          console.log(err);
          reject(err);
        }
      } else {
        resolve(true);
      }
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
      const key = metadata.Identifier;
      if (!(await exists(key))) {
        writer.write(metadata);
        await download(fullSizeImageUrl, key);
      } else {
        console.log('Skipping', key);
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
