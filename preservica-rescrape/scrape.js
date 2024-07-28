// This script is for rescraping only photos from Preservica. We don't need metadata again.

const getData = require("./getData");
const downloadImage = require("../scrape2/downloadImageWithBrowser");
const ScrapeBrowser = require("../browser");
const { RateLimiter } = require("limiter");

const limiter = new RateLimiter({ tokensPerInterval: 12, interval: "minute" });

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

  // If a borough is specified, only scrape that borough. Otherwise, scrape all.
  const collections =
    borough in COLLECTION_NAMES
      ? [COLLECTION_NAMES[borough]]
      : Object.values(COLLECTION_NAMES);

  const browser = new ScrapeBrowser();
  await browser.launch();

  for (const collectionName of collections) {
    console.log("starting", borough);
    for await (const record of getData(browser, collectionName)) {
      const { imageUrl } = record;
      await limiter.removeTokens(1);
      console.log(`Downloading image from ${imageUrl}`);
      await downloadImage(browser, imageUrl, keyFn);
    }
  }

  console.log("Scrape complete.");
})();
