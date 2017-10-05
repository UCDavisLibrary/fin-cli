const config = require('../config');
const inquirer = require('inquirer');
var auth;

class InteractiveConfig {

  setAuth(a) {
    auth = a;
  }

  log(msg) {
    this.vorpal.activeCommand.log(msg);
  }

  async init(vorpal, argv) {
    this.vorpal = vorpal;

    // if a local config file was passed, use that
    if( argv.config ) {
      config.load(argv.config);
    }

    // just a placeholder for help
    vorpal.command('shell')
      .description('Start interactive shell')
      .action((args, callback) => {
        // if this is called in shell mode, just echo no op
        this.log('no op');
        callback();
      });

    vorpal.command('login <username>')
          .description('Login as a user')
          .action(this.login);
          
    vorpal.command('config').action(this.display);

    if( !config.host ) {
      console.log('Fedora host not set.');
      if( !argv.shell ) return;

      var args = await inquirer.prompt([{
        type: 'text',
        name: 'host',
        message: 'Fedora Host: '
      },
      {
        type: 'text',
        name: 'path',
        message: 'Fedora Base Path [ex: /rest]: '
      }])

      config.host = args.host;
      config.basePath = args.path.replace(/\/$/, '');

      if( argv.shell ) this.display();
    } else {
      if( argv.shell ) this.display();
    }
  }

  /**
   * Login User
   */
  async login(params, cb) {
    return this.prompt([{
        type: 'password',
        name: 'password',
        message: 'password: '
    }]).then(async args => {
      var resp = await auth.login({
        username : params.username,
        password : args.password
      });

      if( resp ) console.log(`Logged in as ${params.username}`);
      else console.log('Invalid username or password');
    });
  }

  handleCmdConfigArg(args) {
    if( args.config ) config.load(args.config);
  }

  display(args, callback) {
console.log(`
Welcome to the UCD DAMS - Fedora CLI

- Current Config -
Host/Base Path: ${config.host}${config.basePath}
User: ${config.username ? config.username : 'Not logged in'}
Config File: ${config.optionsPath}
`);
    if( callback ) callback();
  }

}

module.exports = new InteractiveConfig();