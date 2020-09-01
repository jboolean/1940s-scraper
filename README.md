# 1940s NYC Scraping

Scripts related to scraping data for 1940s.nyc.

## Tools

### Scrape
`scrape2/scrape.js` is a script to scrape metadata, download photos, and geocode. Data is saved in a database, photos in s3. Aims to be idempotent.

### Create geojson
`createGeojson.js` creates points from geocoded photos in database that can be uploaded to a map.

## NYPL to MapWarper
`importNyplToWarper` imports a map from the NYPL collection into mapwarper.net, where it can be warped by hand. The NYPL has a version of MapWarper, but ordinary users do not have permission to create maps. It's hardcoded to the one map I imported.