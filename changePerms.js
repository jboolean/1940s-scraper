const AWS = require('aws-sdk');
const credentials = require('./credentials');
const last = require('lodash/last');

const s3 = new AWS.S3({
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  accessKeyId: credentials.keyId,
  secretAccessKey: credentials.secret,
  params: {
    Bucket: '40snyc'
  }
});


const backoff = async(fun, tries = 1) => {
  try {
    return await fun();
  } catch (e) {
    console.log('Backing off...');
    setTimeout(() => {
      backoff(fun, tries + 1);
    }, 1000 * tries);
  }
};


const getPage = (nextToken) => backoff(() => {
  return new Promise((resolve, reject) => {
    s3.listObjects({
      // MaxKeys: 1000,
      // ContinuationToken: nextToken
      Marker: nextToken
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
});

const process = (object) => backoff(() => {
  return new Promise((resolve, reject) => {
    console.log(object.Key);
    s3.putObjectAcl({
      ACL: 'public-read',
      Key: object.Key
    }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
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