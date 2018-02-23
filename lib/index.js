const config = require('./lib/config');
const yargs = require('yargs');
const vorpal = require('vorpal')();
const logger = require('./lib/logger');

// important, otherwise vorpal fubars complex headers
vorpal.isCommandArgKeyPairNormalized = false;

const cliComponents = {
  http : require('./cli/HttpCli'),
  config : require('./cli/ConfigCli'),
  location : require('./cli/LocationCli'),
  interactive : require('./cli/InteractiveCli'),
  acl : require('./cli/AclCli'),
  service : require('./cli/ServiceCli'),
  collection : require('./cli/CollectionCli'),
  logger : logger
}

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
argv.script = false;
if( argv._.indexOf('shell') > -1 ) {
  argv.shell = true;
} else if( argv._.indexOf('script') > -1 ) {
  var index = argv._.indexOf('script');
  if( argv._.length <= index ) {
    console.log('Script file required');
    process.exit();
  }

  argv.script = argv._[index+1];
}

var configPromise;
for( var key in cliComponents ) {
  var promise = cliComponents[key].init(vorpal, argv);
  if( key !== 'config' ) continue;
  configPromise = promise;
}

// need to possibly wait for user prompts for DAMS location
configPromise.then(async () => {

  // if the shell command was given, enter the interactive shell
  if( argv.shell || argv.interactive ) {
    require('./lib/logo');

    vorpal.interactive = true;
    vorpal
      .delimiter('fin$')
      .show();

  } else {
    process.argv.splice(0,2);

    // grrrr have to reconstruct input
    let lastIsOpt = false;
    
    let argv = process.argv.map(arg => {
      if( lastIsOpt ) {
        lastIsOpt = false;
        return `'${arg}'`;
      }

      if( arg.match(/^-/) ) {
        var match = arg.match(/(-[A-Za-z-]*)=(.*)/);
        if( match ) {
          arg = arg.split('=');
          let first = arg.shift();
          return `${first}="${arg.join("=")}"`;
        }
        lastIsOpt = true;
      } else {
        lastIsOpt = false;
      }

      return arg;
    }).join(' ');

    vorpal.execSync(argv);
  }
});