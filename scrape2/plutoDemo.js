const loadPluto = require('./loadPluto');

loadPluto()
  .then((locByBbl) => process.stdout.write(JSON.stringify([...locByBbl])));