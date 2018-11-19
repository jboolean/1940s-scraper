const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');

const FIRST_IMAGE_ID = 'NYCMA~5~5~179113~480926';

const DEBUG = true;

const METADATA_ORDER = [
  'identifier',
   'date',
   'borough',
   'block',
   'lot',
   'bldgNum',
   'streetName',
   'address',
   'yearBuilt',
   'lotFrontage', 
   'lotDepth'];

const download = function (uri, filename) {
  return new Promise((resolve, reject) => {
    request.head(uri, function (err, res, body) {
      request(uri).pipe(fs.createWriteStream(filename)).on('close', resolve);
    });
  })
};

const makePageUrl = (imageId, offset) => 
  `http://nycma.lunaimaging.com/luna/servlet/detail/${imageId}?qvq=sort%3Aborough%2Cblock%2Clot%2Czip_code%3Blc%3ANYCMA~5~5&mi=${offset}&trs=84751`;

(async () => {
  const browser = await puppeteer.launch({headless: !DEBUG, devtools: DEBUG});
  const page = await browser.newPage();
  let nextUrl = makePageUrl(FIRST_IMAGE_ID, 0);
  while (nextUrl) {
    await page.goto(nextUrl);
    const fullSizeImageUrl = await page.evaluate(() => {
      return window.imageInfo.largestUrlAvailable;
    });
    const metadata = await page.evaluate((METADATA_ORDER) => {
      const metadata = {};
      // Not sure why it's a string here but an array in the console
      const fieldValues = JSON.parse(window.imageInfo.fieldValues);
      for (let i = 0; i < METADATA_ORDER.length && i < fieldValues.length; i++) {
        metadata[METADATA_ORDER[i]] = fieldValues[i].value;
      }
      return metadata;
    }, METADATA_ORDER);
  
    console.log(metadata);
  
    await download(fullSizeImageUrl, `images/${metadata.identifier}.jpg`);
  
    await page.waitFor(() => !!window.quickView && !window.quickView.mWaitingForImages);
    const {nextPageId, nextOffset} = await page.evaluate((currentUrl) => {
      const infos = window.quickView.mImageInfos;
      // Find the next image after this one.
      const thisImageIndex = infos.findIndex((info) => currentUrl.includes(info.id));
      if (thisImageIndex < 0) {
        throw new Error('The current image is not in thumbnails.');
      }
      if (thisImageIndex + 1 >= infos.length) {
        debugger;
        // Last image
        return null;
      }
      const nextOffset = window.quickView.mCurrentImageOffset + 1;
      return { nextPageId: infos[thisImageIndex + 1].id, nextOffset };
    }, page.url());
  
    nextUrl = nextPageId == null ? null : makePageUrl(nextPageId, nextOffset);
  }

  await browser.close();
})();