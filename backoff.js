const backoff = (delegate) => (...args) => {

  const runWithBackoff = (tries = 0) => {
    return delegate(...args)
      .catch((e) => new Promise((resolve, reject) => {
        console.log(`Backing off (attempt ${tries + 1})...`, e);
        setTimeout(() => {
          resolve(runWithBackoff(tries + 1));
        }, Math.min(1000 * Math.pow(2, tries), 10 * 60 * 1_000));
      })

      );
  };
  return runWithBackoff();
};

module.exports = backoff;
