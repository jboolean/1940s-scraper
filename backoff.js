const backoff = (delegate) => (...args) => {

  const runWithBackoff = (tries = 0) => {
    return delegate(...args)
      .catch((e) => new Promise((resolve, reject) => {
        console.log(`Backing off (attempt ${tries + 1})...`, e);
        setTimeout(() => {
          resolve(runWithBackoff(tries + 1));
        }, 1000 * Math.pow(2, tries));
      })

      );
  };

  // const runWithBackoff = async (tries = 0) => {
  //   try {
  //     return await delegate(...args);
  //   } catch (e) {
  //     console.log(`Backing off (attempt ${tries + 1})...`);
  //     setTimeout(() => {
  //       runWithBackoff(tries + 1);
  //     }, 1000 * Math.pow(2, tries));
  //   }
  // };
  return runWithBackoff();
};

module.exports = backoff;