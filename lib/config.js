const fs = require('fs');
const path = require('path');

const DOT_FILE = '.fccli';

class Options {

  constructor() {
    this.data = {
      autoSlug : false
    };

    this.cliOptions = {
      host : {
        alias : 'h',
        value : ''
      },
      basePath : {
        alias : 'b',
        value : ''
      },
      username : {
        alias : 'u',
        value : ''
      },
      password : {
        alias : 'p',
        value : ''
      }
    }

    this.basePrefix = {
      dc : 'http://purl.org/dc/elements/1.1/',
      foaf : 'http://xmlns.com/foaf/0.1/'
    };

    this.load();
  }

  initCli(argv) {
    for( var key in this.cliOptions ) {
      if( argv[key] ) this.cliOptions[key].value = argv[key];
    }
  }

  set(values) {
    this.data = value;
    this.save();
  }

  set host(value) {
    this.data.host = value;
    this.save();
  }
  get host() {
    return this.cliOptions.host.value || this.data.host;
  }

  set globalPrefix(value) {
    this.data.globalPrefix = value;
    this.save();
  }
  get globalPrefix() {
    return this.data.globalPrefix || Object.assign({}, this.basePrefix);
  }

  set basePath(value) {
    this.data.basePath = value;
    this.save();
  }
  get basePath() {
    return this.cliOptions.basePath.value || this.data.basePath;
  }

  set autoSlug(value) {
    this.data.autoSlug = value;
    this.save();
  }
  get autoSlug() {
    return this.data.autoSlug;
  }

  set jwt(value) {
    this.data.jwt = value;
    this.save();
  }
  get jwt() {
    return this.data.jwt;
  }

  set username(value) {
    this.data.username = value;
    this.save();
  }
  get username() {
    return this.cliOptions.username.value || this.data.username;
  }

  set password(value) {
    this.data.password = value;
    this.save();
  }
  get password() {
    return this.cliOptions.password.value || this.data.password;
  }

  load(optionsPath) {
    if( optionsPath ) {
      this.optionsPath = optionsPath;
    } else if( fs.existsSync(path.join(process.cwd(), DOT_FILE)) ) {
      this.optionsPath = optionsPath;
    } else {
      this.optionsPath = path.join(getUserHome(), DOT_FILE);
      if( !fs.existsSync(this.optionsPath) ) {
        fs.writeFileSync(this.optionsPath, '{}');
      }
    }

    if( !fs.existsSync(this.optionsPath) ) {
      throw new Error('Invalid config file location: ', this.optionsPath);
    }

    this.data = JSON.parse(fs.readFileSync(this.optionsPath, 'utf-8'));
  }

  save() {
    fs.writeFileSync(this.optionsPath, JSON.stringify(this.data, '  ', '  '));
  }
}

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

module.exports = new Options();