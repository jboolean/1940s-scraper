const { Pool } = require('pg');
const Cursor = require('pg-cursor');
const { promisify } = require('util');
const axios = require('axios');
const get = require('lodash/get');
const backoff = require('./backoff');
const uuid = require('uuid/v4');

const getSimplifiedAddress = (photo) => {
  const {
    bldg_number_start: buildingNumberStart,
    street_name: streetName,
    borough
  } = photo;
  if (!buildingNumberStart || !streetName) {
    return null;
  }


  const simplifiedAddress = (buildingNumberStart.replace('1/2', 11) || '') + ' ' + streetName;
  return simplifiedAddress;
};

const geocoders = {
  geosearch: (photo) => {
    const {
      borough
    } = photo;

    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      return Promise.resolve(null);
    }

    return axios.get('https://geosearch.planninglabs.nyc/v1/search/structured', {
      params: {
        address: simplifiedAddress,
        borough: borough
      }
    })
      .then((resp) => resp, (err) => {
        // Uhh, this api returns 400 status for successful calls. WTF idk.
        if (err.response.status === 400) {
          return err.response;
        }
        throw err;
      })
      .then((resp) => resp.data.features.length ?
        resp.data.features[0].geometry.coordinates :
        null);
  },
  mapbox: backoff((photo) => {
    const {
      borough
    } = photo;

    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      console.log('No address');
      return Promise.resolve(null);
    }

    return axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${simplifiedAddress}, ${borough}`)}.json`, {
      params: {
        // eslint-disable-next-line camelcase
        access_token: '***REMOVED***',
        country: 'US',
        bbox: '-74.2590879797556,40.477399,-73.7008392055224,40.917576401307',
        types: 'address'
      }
    })
      .then((resp) => resp.data.features.length ?
        resp.data.features[0].center : null);
  }),
  gmaps: (photo) => {
    const { borough } = photo;
    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      console.log('No address');
      return Promise.resolve(null);
    }

    return axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: simplifiedAddress,
        components: `administrative_area:NY|locality:${borough}`,
        key: '***REMOVED***'
      }
    })
      .then((resp) => {
        // console.log(resp.data);
        const results = resp.data.results
          .filter((result) => result.types.includes('street_address'));

        if (!resp.data.results.length) {
          return null;
        }
        const location = get(results, '[0].geometry.location');
        if (!location) {
          return null;
        }
        const { lat, lng } = location;
        return [lng, lat];
      });
  },
  gmapsPlacesAutocomplete: async (photo) => {
    const { borough } = photo;
    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      console.log('No address');
      return Promise.resolve(null);
    }

    const sessiontoken = uuid();

    const placesAutocompleteResp = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
      params: {
        input: `${simplifiedAddress}, ${borough}`,
        location: '40.7127753,-74.0059728',
        radius: 30354,
        types: 'geocode',
        strictbounds: true,
        key: '***REMOVED***',
        sessiontoken
      }
    });

    const prediction = get(placesAutocompleteResp, 'data.predictions[0]');

    if (!prediction) {
      return null;
    }

    const detailsResp = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        placeid: prediction.place_id,
        key: '***REMOVED***',
        sessiontoken
      }
    });

    const location = get(detailsResp, 'data.result.geometry.location');
    if (!location) {
      return null;
    }
    const { lat, lng } = location;
    return [lng, lat];
  },
};

const run = async () => {
  const pool = new Pool({
    user: 'julianboilen',
    host: 'localhost',
    database: 'fourtiesnyc'
  });
  const client = await pool.connect();

  const method = process.argv[2];

  if (!(method in geocoders)) {
    throw new Error(`Not a valid method: ${method}`);
  }

  /*
  Find where it has never geocoded successfuly and never geocoded at all with this method
  Mapbox doesn't count as a success because it sucks.
  */
  const cursor = client.query(
    new Cursor(`select * from photos 
      left join (select * from geocode_results where method = $1) geocode_results_with_method 
      on photos.identifier = geocode_results_with_method.photo 
      left join (select * from geocode_results where lng_lat is not null and method != 'mapbox') geocode_results_successful
      on photos.identifier = geocode_results_successful.photo 
      where geocode_results_with_method.photo is null and geocode_results_successful.photo is null`, [method])
  );
  const promisifiedCursorRead = promisify(cursor.read.bind(cursor));

  const ROW_COUNT = 10;
  let done = false;
  while (!done) {
    const results = await promisifiedCursorRead(ROW_COUNT);

    done = results.length === 0;
    const promises = results
      .map(async (result) => {
        const lngLatGeocodeResult = await geocoders[method](result);
        const pointString = lngLatGeocodeResult ? `(${lngLatGeocodeResult[0]}, ${lngLatGeocodeResult[1]})` : null;
        console.log(result.identifier, result.address, lngLatGeocodeResult);
        return pool.query('insert into geocode_results (method, photo, lng_lat) values ($1, $2, $3)',
          [method, result.identifier, pointString]);
      });
    await Promise.all(promises);
  }

  cursor.close(() => {
    client.end();
  });
};

run().catch(e => {
  console.error(e);
});