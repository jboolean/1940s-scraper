
const sharp = require('sharp');
const pixelmatch = require('pixelmatch');
const path = require('path');
const PNG = require('pngjs').PNG;
const fs = require('fs').promises;
const memoize = require('lodash/memoize');
const { performance, PerformanceObserver } = require('perf_hooks');

const CARD_START_X = 76;
const CARD_START_Y = 40;
const BANNER_START_Y = 353;

const CROP = { left: CARD_START_X, top: CARD_START_Y, height: BANNER_START_Y - CARD_START_Y, width: 640 - (CARD_START_X * 2) };

/**
 * Return promise to list of raw image buffers of each placeholder card.
 */
const getReferenceImages = memoize(async function getReferenceImages() {
  console.log('Loading reference placeholder images');
  const files = await fs.readdir(path.resolve(__dirname, './placeholder-cards'));
  return Promise.all(files.map((file) =>
    sharp(path.resolve(__dirname, './placeholder-cards', file))
      .extract(CROP)
      .ensureAlpha()
      .raw()
      .toBuffer())
  );
});

/**
 * Calculate the percentage similarity to a placeholder card for an image
 * Returns the value of the most similar card.
 */
async function calculatePlaceholderSimiliarity(image) {
  const referenceImages = await getReferenceImages();
  const { width, height } = CROP;

  const similarities = await Promise.all(referenceImages.map(async (referenceBuf) => {
    performance.mark('startImageMeta');
    const metadata = await sharp(image)
      .metadata();
    performance.mark('endImageMeta');
    performance.measure('calculateSimilarity-imageMeta', 'startImageMeta', 'endImageMeta');

    // Optimization - check if this is a video frame.
    if (metadata.width !== 640 || metadata.height !== 480) {
      return 0;
    }

    performance.mark('startCrop');
    const imageBuf = await sharp(image)
      .extract(CROP)
      .ensureAlpha()
      .raw()
      .toBuffer();
    performance.mark('endCrop');
    performance.measure('calculateSimilarity-crop', 'startCrop', 'endCrop');

    performance.mark('startMatch');
    const pxDiff = pixelmatch(imageBuf, referenceBuf, null, width, height, {});
    performance.mark('endMatch');
    performance.measure('calculateSimilarity-match', 'startMatch', 'endMatch');
    const pctSimilar = 1 - ((pxDiff) / (width * height));
    return pctSimilar;
  }));

  return Math.max(...similarities);
}

module.exports = calculatePlaceholderSimiliarity;