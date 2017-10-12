const config = require('../config');
const inquirer = require('inquirer');
const Logger = require('./logger');
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

    vorpal.command('jwt <token>')
          .description('manually set jwt token (for debug)')
          .action(this.setJwt);

    vorpal.command('logout')
          .description('Logout current user')
          .action(this.logout);
          
    vorpal.command('config').action(this.display);
    
    vorpal.command('config prefix').action(this.showPrefix);
    vorpal.command('config prefix add <prefix> <url>').action(this.addPrefix.bind(this));
    vorpal.command('config prefix remove <prefix>').action(this.removePrefix.bind(this));

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

  async logout() {
    config.username = '';
    config.password = '';
    config.jwt = '';
  }

  async setJwt(args) {
    config.username = '';
    config.password = '';
    config.jwt = args.token;
  }

  handleCmdConfigArg(args) {
    if( args.config ) config.load(args.config);
  }

  display(args, callback) {
console.log(`
- Current Config -
Host/Base Path: ${config.host}${config.basePath}
User: ${config.username ? config.username : 'Not logged in'}
Config File: ${config.optionsPath}
`);
    if( callback ) callback();
  }

  async showPrefix() {
    var display = [];
    for( var key in config.globalPrefix ) {
      display.push(`${key}: ${config.globalPrefix[key]}`);
    }
    Logger.log(display.join('\n'));
  }

  async addPrefix(args) {
    var current = config.globalPrefix;
    current[args.prefix] = args.url;
    config.globalPrefix = Object.assign({}, current);
    this.showPrefix();
  }

  async removePrefix(args) {
    var current = config.globalPrefix;
    if( current[args.prefix] ) {
      delete current[args.prefix];
    } else {
      return Logger.log(`No prefix defined by: ${args.prefix}`);
    }
    config.globalPrefix = Object.assign({}, current);
    this.showPrefix();
  }

}

module.exports = new InteractiveConfig();