const AWS = require('aws-sdk');
const axios = require('axios');
const backoff = require('../backoff');

const backoffGet = backoff((...args) => axios.get(...args));


const s3 = new AWS.S3({
  region: 'us-east-1',
  params: {
    Bucket: 'fourties-photos'
  }
});

module.exports = async function imageExists(key) {
  await s3.headObject({
    Key: `originals/${key}`,
  }).promise()
    .then(() => true, (err) => {
      if (err.code === 'NotFound') {
        return true;
      }
      throw err;
    });
};