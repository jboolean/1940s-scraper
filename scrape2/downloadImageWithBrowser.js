const AWS = require("aws-sdk");
const backoff = require("../backoff");

const s3 = new AWS.S3({
  region: "us-east-1",
  params: {
    Bucket: "fourties-photos",
  },
});

module.exports = async function downloadImage(browser, uri, key) {
  try {
    const downloadWithBackoff = backoff((...args) =>
      browser.goToDownloadUrl(...args)
    );
    const resp = await downloadWithBackoff(uri);

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
  } catch (err) {
    // Retry
    console.error(err);

    // Sleep for 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("Retrying downloadImage");

    await downloadImage(browser, uri, key);
  }
};
