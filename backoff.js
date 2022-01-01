const backoff = (delegate) => (...args) => {

  const runWithBackoff = (tries = 0) => {
    return delegate(...args)
      .catch((e) => new Promise((resolve, reject) => {
        console.log(`Backing off (attempt ${tries + 1})...`);
        setTimeout(() => {
          resolve(runWithBackoff(tries + 1));
        }, (1000 * Math.pow(2, tries)) + Math.floor(2000 * Math.random()));
      })

      );
  };
  return runWithBackoff();
};

module.exports = backoff;