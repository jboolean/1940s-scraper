const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");
const backoff = require("../backoff");

const LAST_PAGE_LOG_FILE = path.join(__dirname, "./lastCollection");

const COLLECTION_BASE_URL = "https://nycrecords.access.preservica.com/";
const DOWNLOAD_PATH = "download/file/";

const myAxios = axios.create({
  // These pages are VERY slow
  timeout: 300_000,
});

const backoffAxios = backoff((...args) => myAxios(...args));

async function* getData(browser, collectionName) {
  const backoffGetHtml = backoff((...args) => browser.goToAndGetHtml(...args));

  const lastPageLogFile = LAST_PAGE_LOG_FILE + "-" + collectionName;
  let nextPageNum = fs.existsSync(lastPageLogFile)
    ? parseInt(fs.readFileSync(lastPageLogFile, { encoding: "utf8" }), 10)
    : 1;

  let reachedEnd = false;

  while (!reachedEnd) {
    const urlParams = new URLSearchParams({
      pg: nextPageNum,
      name: collectionName,
    });
    const pageUrl = COLLECTION_BASE_URL + "?" + urlParams.toString();

    console.log("Loading page", pageUrl);

    const html = await backoffGetHtml(pageUrl);
    const $ = cheerio.load(html);

    const itemIds = $("#search-results .result-item .archive_name a")
      .map((_i, element) => {
        return $(element).attr("href");
      })
      .get()
      .map((url) => {
        const urlParts = url.split("/");
        return urlParts[urlParts.length - 2];
      });

    // We don't get the key here, because it would require another load, and we already get it when downloading the image
    // so this will be handled as part of the downloadImage fn
    for (const itemId of itemIds) {
      const imageUrl = COLLECTION_BASE_URL + DOWNLOAD_PATH + itemId;

      yield {
        imageUrl,
      };
    }

    fs.writeFileSync(lastPageLogFile, nextPageNum.toString(), {
      encoding: "utf8",
    });

    if (!itemIds.length) {
      reachedEnd = true;
    }

    nextPageNum++;
  }
}

module.exports = getData;
