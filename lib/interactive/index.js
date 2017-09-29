const config = require('../config');
const vorpal = require('vorpal')();
const interactiveConfig = require('./config');
const interactiveLocation = require('./location');
const interactiveContainer = require('./container');

process.on('unhandledRejection', e => console.error(e));

interactiveLocation.init(vorpal, interactiveContainer);
interactiveContainer.init(vorpal, interactiveLocation);
interactiveConfig
  .init(vorpal)
  .then(() => {
    vorpal
      .delimiter('fedora$')
      .show();
  });