const backoff = (delegate) => (...args) => {
  const runWithBackoff = async (tries = 0) => {
    try {
      return await delegate(...args);
    } catch (e) {
      console.log(`Backing off (attemt ${tries + 1})...`);
      setTimeout(() => {
        runWithBackoff(tries + 1);
      }, 1000 * Math.pow(2, tries));
    }
  };
  return runWithBackoff();
};

module.exports = backoff;