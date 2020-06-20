/* eslint-disable camelcase */
const axios = require('axios');
const fs = require('fs');

const LOG_FILE = __dirname + '/import.log';
const ERROR_LOG_FILE = './import.error.log';

const SEARCH_URL = 'https://digitalcollections.nypl.org/collections/4742/items_search.json?root=b2977770-2171-0132-7677-58d385a7b928&page=1';

const SESSION_COOKIE = '***REMOVED***';

const COLLECTION_DESCRIPTION = 'Land Book of the Borough of Manhattan, City of New York. Desk and Library ed. 1930';

const DATE = '1930';

const PUBLISHER = 'G.W. Bromley & Co.';

const mapwarper = axios.create({
  baseURL: 'https://mapwarper.net/api/v1/',
  headers: {
    Cookie: `_rails4_mapwarper_session=${SESSION_COOKIE}; path=/; domain=.mapwarper.net;`
  }
});

const logContents = fs.readFileSync(LOG_FILE, 'utf8').split('\n');

const PROCESSED_NYPL_IDS = [];
const PROCESSED_WARPER_IDS = [];
logContents.forEach(line => {
  const [nyplId, warperId] = line.split(' ');
  PROCESSED_NYPL_IDS.push(nyplId);
  PROCESSED_WARPER_IDS.push(warperId);
});

const MANHATTAN = ['40.7660045', '-73.9797366'];

const log = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const errorLog = fs.createWriteStream(ERROR_LOG_FILE, { flags: 'a' });

switch (process.argv[2]) {
case 'viewlog':
  console.log(PROCESSED_NYPL_IDS);
  console.log(PROCESSED_WARPER_IDS);
  break;
case 'upload':

  (async () => {
    const searchResp = await axios.get(SEARCH_URL);
    const results = searchResp.data.results;

    for (const result of results) {
      const { item } = result;
      const { id, image_id: imageId, title, high_res_link: imageUrl } = item;

      if (PROCESSED_NYPL_IDS.includes(id)) {
        continue;
      }

      try {
        const map = {
          title,
          description: `From ${COLLECTION_DESCRIPTION}`,
          source_uri: `https://digitalcollections.nypl.org/items/${id}`,
          unique_id: imageId,
          date_depicted: DATE,
          issue_year: DATE,
          publisher: PUBLISHER,
          map_type: title.includes('Title Page') || title.includes('Outline and Index') ?
            'index' :
            'is_map',
          metadata_lat: MANHATTAN[0],
          metadata_lon: MANHATTAN[1],
          upload_url: imageUrl,
        };
        const resp = await mapwarper.post('/maps', {
          data: {
            type: 'maps',
            attributes: map
          }
        });

        console.log('Uploaded map', id, resp.data.data.id);
        log.write(`${id} ${resp.data.data.id}\n`);

      } catch (e) {
        errorLog.write(id + '\n');
        console.warn('Error uploading', id, e);
      }
    }
  })();

  break;

case 'setlatlng':
  // Update lat, lon of default center (otherwise it defaults to africa)
  (async () => {
    for (const mapId of PROCESSED_WARPER_IDS) {
      await mapwarper.patch(`/maps/${mapId}`, {
        data: {
          type: 'maps',
          attributes: {
            metadata_lat: MANHATTAN[0],
            metadata_lon: MANHATTAN[1],
          }
        }
      });
      console.log('Updated map', mapId);
    }
  })();
  break;

case 'createlayer':
  (async () => {
    try {
      const resp = await mapwarper.post('/layers', {
        data: {
          type: 'layers',
          map_ids: PROCESSED_WARPER_IDS.map(Number),
          attributes: {
            name: COLLECTION_DESCRIPTION
          }
        },
      });
      console.log(resp.data);
    } catch (e) {
      console.error(e);
    }
  })();
  break;


}




