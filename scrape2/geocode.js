const axios = require('axios');
const get = require('lodash/get');
const uuid = require('uuid/v4');
const backoff = require('../backoff');
const getBorough = require('../getBorough');
const padStart = require('lodash/padStart');
const isEmpty = require('lodash/isEmpty');
const memoize = require('lodash/memoize');
const loadPluto = memoize(require('./loadPluto'));

const backoffGet = backoff((...args) => axios.get(...args));

const BORO_CODES = {
  'Manhattan': 1,
  'Bronx': 2,
  'Brooklyn': 3,
  'Queens': 4,
  'Staten Island': 5
};


const getSimplifiedAddress = (photo) => {
  const {
    buildingNumberStart,
    streetName,
    borough
  } = photo;
  if (!buildingNumberStart || !streetName) {
    return null;
  }

  const simplifiedAddress = (buildingNumberStart.replace('1/2', '') || '') + ' ' + streetName;
  return simplifiedAddress;
};

// Mapbox sucks too much to include
const GEOCODER_ORDER = ['pluto', 'geosearch', 'gmaps', 'gmapsPlacesAutocomplete'];

const geocoders = {
  geosearch: (photo) => {
    const {
      borough
    } = photo;

    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      return Promise.resolve(null);
    }

    return backoffGet('https://geosearch.planninglabs.nyc/v2/search', {
      params: {
        text: simplifiedAddress,
      }
    })
      .then((resp) => resp, (err) => {
        // Uhh, this api returns 400 status for successful calls. WTF idk.
        console.log(err);
        if (err.response.status === 400) {
          return err.response;
        }
        throw err;
      })
      .then((resp) =>
        resp.data.features.filter(feature => get(feature, 'geometry.coordinates') &&
          getBorough(feature.geometry.coordinates) === borough))
      .then(features => get(features, '[0].geometry.coordinates') || null);
  },
  mapbox: backoff((photo) => {
    const {
      borough
    } = photo;

    const simplifiedAddress = getSimplifiedAddress(photo);
    if (!simplifiedAddress) {
      // console.log('No address');
      return Promise.resolve(null);
    }

    return backoffGet(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${simplifiedAddress}, ${borough}`)}.json`, {
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
      // console.log('No address');
      return Promise.resolve(null);
    }

    return backoffGet('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: simplifiedAddress,
        components: `administrative_area:NY|locality:${borough}`,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    })
      .then((resp) => {
        const results = resp.data.results
          .filter((result) => result.types.includes('street_address'))
          .filter(result => {
            const location = get(result, 'geometry.location');
            if (!location) {return false;}
            const pointBorough = getBorough([location.lng, location.lat]);
            if (pointBorough !== borough) {
              console.log('Borough mismatch gmaps', pointBorough, borough);
              return false;
            }
            return true;
          });

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
      // console.log('No address');
      return Promise.resolve(null);
    }

    const sessiontoken = uuid();

    const placesAutocompleteResp = await backoffGet('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
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

    const detailsResp = await backoffGet('https://maps.googleapis.com/maps/api/place/details/json', {
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
    const point = [lng, lat];
    const pointBorough = getBorough(point);
    if (pointBorough !== borough) {
      console.log('Borough mismatch gmapsPlacesAutocomplete', pointBorough, borough);
      return null;
    }
    return point;
  },
  pluto: async (photo) => {
    const { identifier, borough, block, lot } = photo;

    if (identifier.endsWith('_w5')) {
      // These are images in Queens with "Q=" on the placard.
      // I'm not sure what's up with these, but their locations don't correspond to the BBLs on the sign.
      return null;
    }

    if (isEmpty(borough) || !(borough in BORO_CODES) || isEmpty(block) || isEmpty(lot)) {
      console.warn('Cannot form bbl', borough, block, lot);
    }
    const bbl = Number(`${BORO_CODES[borough]}${padStart(block, 5, '0')}${padStart(lot, 4, '0')}`);
    const locByBbl = await loadPluto();
    return locByBbl.get(bbl);
  }
};

module.exports = async function geocode(data) {
  const results = {};
  for (const method of GEOCODER_ORDER) {
    const location = await geocoders[method](data);
    results[method] = location;
    if (location) {
      return results;
    }
  }
  return results;
};