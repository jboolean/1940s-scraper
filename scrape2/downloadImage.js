const AWS = require("aws-sdk");
const axios = require("axios");
const backoff = require("../backoff");

const backoffGet = backoff((...args) =>
  axios.get(...args).catch((err) => {
    if (err.response.status === 404) {
      return null;
    }
    throw err;
  })
);

const s3 = new AWS.S3({
  region: "us-east-1",
  params: {
    Bucket: "fourties-photos",
  },
});

module.exports = async function downloadImage(uri, key) {
  const resp = await backoffGet(uri, { responseType: "arraybuffer" });
  if (resp === null) {
    console.warn("404 for image", uri, key);
    return;
  }

  // allow key to be a function that takes the response and returns the key
  if (typeof key === "function") {
    key = key(resp);
  }

  let contentType = resp.headers["content-type"];

  if (!contentType.startsWith("image")) {
    contentType = "image/jpeg";
  }

  await s3
    .upload({
      Body: resp.data,
      Key: `originals/${key}`,
      ContentType: resp.headers["content-type"],
      ContentLength: resp.headers["content-length"],
    })
    .promise();
};
