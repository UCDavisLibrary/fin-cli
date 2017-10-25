const config = require('../models/ConfigModel');
const inquirer = require('inquirer');
const Logger = require('./logger');
const auth = require('../models/AuthModel');
const AuthCli = require('./AuthCli');

class ConfigCli {

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

    vorpal.command('login')
          .description('Login using UCD CAS Authentication')
          .option('--local, -l <username>', 'Login using local UCD DAMS authentication')
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
  async login(params) {
    if( !params.options.local ) {
      await AuthCli.casLogin();
      
      await auth.getRefreshToken(config.jwt, {username: config.username});

      console.log(`Logged in as ${config.username}`);
      return;
    }
    
    return this.prompt([{
        type: 'password',
        name: 'password',
        message: 'password: '
    }]).then(async args => {
      var resp = await auth.loginPassword({
        username : params.username,
        password : args.password
      });

      await auth.getRefreshToken(config.jwt, {username: params.username});

      if( resp ) console.log(`Logged in as ${params.username}`);
      else console.log('Invalid username or password');
    });
  }

  async logout() {
    config.logout();
  }

  async setJwt(args) {
    config.setJwt(args.token);
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
    config.addPrefix(args);
    this.showPrefix();
  }

  async removePrefix(args) {
    if( !model.removePrefix(args) ) {
      return Logger.log(`No prefix defined by: ${args.prefix}`);
    }
    this.showPrefix();
  }

}

module.exports = new ConfigCli();