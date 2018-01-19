const config = require('../lib/config');
const location = require('../lib/location');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const auth = require('../lib/auth');
const cas = require('../lib/cas');
const {URL} = require('url');

class ConfigCli {

  async init(vorpal, argv) {
    this.vorpal = vorpal;

    // if a local config file was passed, use that
    if( argv.config ) {
      config.load(argv.config);
    }

    vorpal.command('login')
          .description('Login using UCD CAS Authentication')
          .option('--local, -l <username>', 'Login using local UCD DAMS authentication')
          .option('--headless, -h', 'Login without local browser, copy and paste token')
          .action(this.login.bind(this));

    vorpal.command('logout')
          .description('Logout current user')
          .action(this.logout);
          
    vorpal.command('config').action(this.display);
    
    vorpal.command('config set <attribute> <value>').action(this.setAttribute.bind(this));

    vorpal.command('config prefix').action(this.showPrefix);
    vorpal.command('config prefix add <prefix> <url>').action(this.addPrefix.bind(this));
    vorpal.command('config prefix remove <prefix>').action(this.removePrefix.bind(this));

    if( config.cwd ) {
      location.setCwd(config.cwd);
    }

    if( !config.host ) {
      Logger.log('Fedora host not set.');
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
    if( params.options.headless ) {
      let authUrl = new URL(config.host+'/auth/cas');
      authUrl.searchParams.set('cliRedirectUrl', `${config.host}/auth/login-shell`);
      authUrl = authUrl.href;
      Logger.log();
      Logger.log('Visit this URL on any device to log in, then paste token below.');
      Logger.log(authUrl);
      Logger.log();

      let args = await inquirer.prompt([{
        type: 'text',
        name: 'token',
        message: 'Token: '
      }]);

      config.jwt = args.token;
      let payload = Buffer.from(config.jwt.split('.')[1], 'base64');
      config.username = JSON.parse(payload).username;

      this.display();
      
      return;
    }

    if( !params.options.local ) {
      await cas.login();
      
      await auth.getRefreshToken(config.jwt, {username: config.username});

      Logger.log(`Logged in as ${config.username}`);
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

      if( resp ) Logger.log(`Logged in as ${params.username}`);
      else Logger.log('Invalid username or password');
    });
  }

  async logout() {
    config.logout();
  }

  async setAttribute(args) {
    config[args.attribute] = args.value;
  }

  display(args, callback) {
    Logger.log(`
- Current Config -
Host/Base Path: ${config.host}${config.basePath}
User: ${config.username ? config.username : 'Not logged in'}
Config File: ${config.optionsPath}
CWD: ${config.cwd}
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
    if( !config.removePrefix(args) ) {
      return Logger.log(`No prefix defined by: ${args.prefix}`);
    }
    this.showPrefix();
  }

}

module.exports = new ConfigCli();