const config = require('../config');
const yargs = require('yargs');
const vorpal = require('vorpal')();
const interactiveConfig = require('./config');
const interactiveLocation = require('./location');
const interactiveContainer = require('./container');
const interactiveAcl = require('./acl');
const interactiveSchema = require('./schema');
const logger = require('./logger');

process.on('unhandledRejection', e => console.error(e));

// using yargs to parse global arguments
var argv = yargs
            .option('config', {
              alias: 'c'
            });

for( var key in config.cliOptions ) {
  argv.option(key, {alias: config.cliOptions[key].alias});
}
argv = argv.argv;

// TODO: switch to yargs for initial processing
argv.shell = false;
if( argv._.indexOf('shell') > -1 ) {
  argv.shell = true;
}

logger.init(vorpal);

interactiveLocation.init(vorpal, interactiveContainer);
interactiveContainer.init(vorpal, interactiveLocation);
interactiveAcl.init(vorpal, interactiveLocation);
interactiveSchema.init(vorpal);
interactiveConfig
  .init(vorpal, argv)
  .then(() => {
    // if the shell command was given, enter the interactive shell
    if( argv.shell ) {
      vorpal
        .delimiter('fedora$')
        .show();
    
    // otherwise just execute the command as given
    } else {
      process.argv.splice(0,2);
      vorpal.execSync(process.argv.join(' '));
    }
  });