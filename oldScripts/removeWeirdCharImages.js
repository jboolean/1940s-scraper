const AWS = require('aws-sdk');
const last = require('lodash/last');
const backoff = require('../backoff');

const WEIRD_CHAR = '�';

const s3 = new AWS.S3({
  region: 'us-east-1',
  params: {
    Bucket: 'fourties-photos'
  }
});


const getPage = backoff((nextToken) => {
  return s3.listObjects({
    // MaxKeys: 1000,
    // ContinuationToken: nextToken
    Prefix: 'originals/',
    Marker: nextToken
  }).promise();
});

const process = backoff(async (object) => {
  if (!object.Key.endsWith(WEIRD_CHAR)) {
    return;
  }
  const oldKey = object.Key;
  console.log('Renaming', oldKey);
  const newKey = oldKey.replace(WEIRD_CHAR, '');
  await s3.copyObject({
    Bucket: 'fourties-photos',
    CopySource: encodeURIComponent('/fourties-photos/' + oldKey),
    Key: newKey
  }).promise();
  await s3.deleteObject({
    Key: oldKey
  }).promise();
  console.log('Renamed', newKey);
});

(async () => {

  let nextToken;
  let pageNum = 1;
  while (true) {
    const pageResult = await getPage(nextToken);
    console.log(`Page ${pageNum++}`);
    const contents = pageResult.Contents;
    await Promise.all(contents.map(process));
    if (!pageResult.IsTruncated) {
      console.log('Done');
      break;
    }
    nextToken = last(contents).Key;
  }

})();