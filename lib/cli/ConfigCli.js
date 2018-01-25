const config = require('../lib/config');
const location = require('../lib/location');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const auth = require('../lib/auth');
const cas = require('../lib/cas');
const {URL} = require('url');
const jwt = require('jsonwebtoken');
const fs = require('fs');

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

    vorpal.command('jwt encode <secret> <issuer> <username>')
      .option('-a --admin', 'set the admin flag for the token')
      .option('-s --save', 'save the token to config')
      .option('-t --ttl <ttl>', 'set time to live (seconds).  Defaults to 1 day')
      .description('Create and optionally save a jwt token.  secret can point to a text file')
      .action((args) => this.jwtEncode(args));

    vorpal.command('jwt decode <token>')
      .description('Decode a display a jwt token, returns JSON payload')
      .action((args) => this.jwtDecode(args));

      vorpal.command('jwt verify <secret> <issuer> <token>')
      .description('Verify token is a valid jwt token for fin server')
      .action((args) => this.jwtVerify(args));

    if( config.cwd ) {
      location.setCwd(config.cwd);
    }

    if( !config.host ) {
      Logger.log('FIN host not set.');
      if( !argv.shell ) return;

      var args = await inquirer.prompt([{
        type: 'text',
        name: 'host',
        message: 'FIN Host: '
      },
      {
        type: 'text',
        name: 'path',
        message: 'FIN Base Path [ex: /rest]: '
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
================ Current CLI Config =================

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

  async jwtEncode(args) {
    let payload = {username: args.username};
    if( args.options.admin ) payload.admin = true;

    let token = jwt.sign(
      payload, 
      this._getSecret(args), 
      {
        issuer: args.issuer || '',
        expiresIn: args.options.ttl || (60 * 60 * 24)
      }
    );

    if( args.options.save ) {
      config.jwt = token;
      config.username = args.username;
    }

    Logger.log(token);
  }

  async jwtVerify(args) {
    Logger.log();

    let issuer = args.issuer;
    let secret = this._getSecret(args);

    try {
      let token = jwt.verify(args.token, secret);
      if( token.iss !== issuer ) {
        Logger.log('Invalid JWT Token:', `Invalid issuer: ${token.iss}/${issuer}`);
      } else {
        Logger.log('Valid.');
      }

    } catch(e) {
      Logger.log('Invalid JWT Token:', e.message);
    }

    Logger.log();
  }

  async jwtDecode(args) {
    Logger.log(JSON.stringify(
      jwt.decode(args.token)
    , '  ', '  '));
  }

  _getSecret(args) {
    let secret = args.secret || args.options.secret;
    try {
      if( fs.existsSync(secret) ) {
        secret = fs.readFileSync(secret, 'utf-8');
      }
    } catch(e) {}
    return secret;
  }

}

module.exports = new ConfigCli();