// This script is for rescraping only photos from Preservica. We don't need metadata again.

const getData = require("./getData");
const downloadImage = require("../scrape2/downloadImage");
const eachLimit = require("async/eachLimit");

const LIMIT = 10;

// These are the proservica names
const COLLECTION_NAMES = {
  Manhattan: "SO_e6e79554-4227-414f-afc2-5f008fb9c96b",
  Brooklyn: "SO_6619dce3-4174-450e-bcbb-ae5ef78060de",
  Bronx: "SO_ad9565b5-e87e-4b78-96d1-ebb2035d0d9a",
  Queens: "SO_c7d09c9c-66cb-4d9d-9f80-01a5401e58c9",
  "Staten Island": "SO_f592b9c3-c7e5-4932-baf4-3780d8420d58",
};

const keyFn = (resp) => {
  const contentDisposition = resp.headers["content-disposition"];
  const filename = contentDisposition.match(/filename="(.+)"/)[1];
  const key = filename.replace(/<\/?[^>]+>|�|\.jpg|\.tif/g, "");
  return key;
};

(async () => {
  const borough = process.argv[2];

  console.log("starting", borough);
  await eachLimit(getData(COLLECTION_NAMES[borough]), LIMIT, async (record) => {
    const { imageUrl } = record;
    console.log(`Downloading image from ${imageUrl}`);
    await downloadImage(imageUrl, keyFn);
  });
})();
