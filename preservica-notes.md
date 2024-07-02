# rescraping with preservica notes

Collection url:
https://nycrecords.access.preservica.com/?pg=2&name=SO_6619dce3-4174-450e-bcbb-ae5ef78060de
note the page number in the url

If page contains "This item does not have any descendants." you have reached the end of the collection

To get all item links
document.querySelectorAll('#search-results .result-item .archive_name a')

Item id can be parsed from the url
This is a proservica-specific id, not the photo identifier
https://nycrecords.access.preservica.com/uncategorized/IO_d35924a7-27e8-4734-9306-79a2764efa74/

Then a download link can be formed:
https://nycrecords.access.preservica.com/download/file/IO_fefbb23d-ee7a-4d3f-97c0-4ee677d45993

We don't need to redo the metadata

# Image processing

For image processing, we should adjust image levels

GPT-4 had this suggested code to normalize the image levels based on sampling the center

```javascript
const sharp = require("sharp");
const fs = require("fs");

// Load an image
const inputImagePath = "input.jpg";
const outputImagePath = "output.jpg";

// Define the size and position of the central ROI
const roiSize = 100; // Size of the square region
const roiPosition = { left: 50, top: 50 }; // Position of the top-left corner of the ROI

sharp(inputImagePath)
  .metadata()
  .then((metadata) => {
    const { width, height } = metadata;

    // Calculate the ROI based on the center of the image
    const roi = {
      left: Math.floor((width - roiSize) / 2),
      top: Math.floor((height - roiSize) / 2),
      width: roiSize,
      height: roiSize,
    };

    // Extract the ROI
    return sharp(inputImagePath)
      .extract(roi)
      .raw()
      .toBuffer();
  })
  .then((data) => {
    // Calculate the black and white points from the ROI using percentiles
    const pixelValues = Array.from(data);
    pixelValues.sort((a, b) => a - b);

    const percentile = (values, p) => {
      const index = (p / 100) * (values.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      return values[lower] + (values[upper] - values[lower]) * (index - lower);
    };

    const minValue = percentile(pixelValues, 1); // 1st percentile
    const maxValue = percentile(pixelValues, 99); // 99th percentile

    // Calculate scale and offset for the linear transformation
    const scale = 255 / (maxValue - minValue);
    const offset = -minValue * scale;

    // Adjust the levels of the entire image
    sharp(inputImagePath)
      .linear(scale, offset)
      .toFile(outputImagePath, (err, info) => {
        if (err) {
          console.error(err);
        } else {
          console.log("Image processed successfully:", info);
        }
      });
  })
  .catch((err) => {
    console.error(err);
  });
```

Copying 80s photos over to new 720

aws s3 cp s3://fourties-photos/jpg/ s3://fourties-photos/720-jpg/ --recursive
 --exclude "*" --include "dof_*" --skip-existing

 aws s3 sync s3://fourties-photos/jpg/ s3://fourties-photos/720-jpg/ --dryrun
 --exclude "*" --include "dof_*" --exact-timestamps