var fs = require('fs');
var path = require('path');

class Options {

  constructor() {
    // file location to reflect options too
    this._reflect = 'HOME';
    this._autoSlug = false;
    this.HOME_DIR = 'HOME';
    this.SAVE_VALUES = [
      '_basePath', '_host', '_jwt',
      '_username', '_password', '_autoSlug'
    ]

    this.load();
  }

  set(values) {
    for( var key in values ) {
      this[`_${key}`] = values[key];
    }
    this.save();
  }

  set reflect(value) {
    this._reflect = value;
    this.load();
  }
  get reflect() {
    return this._reflect;
  }

  set host(value) {
    this._host = value;
    this.save();
  }
  get host() {
    return this._host;
  }

  set basePath(value) {
    this._basePath = value;
    this.save();
  }
  get basePath() {
    return this._basePath;
  }

  set autoSlug(value) {
    this._autoSlug = value;
    this.save();
  }
  get autoSlug() {
    return this._autoSlug;
  }

  set jwt(value) {
    this._jwt = value;
    this.save();
  }
  get jwt() {
    return this._jwt;
  }

  set username(value) {
    this._username = value;
    this.save();
  }
  get username() {
    return this._username;
  }

  set password(value) {
    this._password = value;
    this.save();
  }
  get password() {
    return this._password;
  }

  load() {
    if( !fs.existsSync(this.getConfigFileLocation()) ) return;

    var values = JSON.parse(fs.readFileSync(this.getConfigFileLocation(), 'utf-8'));
    for( var key in values ) {
      this[key] = values[key];
    }
  }

  save() {
    if( !this.reflect ) return;

    var obj = {};
    this.SAVE_VALUES.forEach(key => {
      if( this[key] ) obj[key] = this[key];
    });

    fs.writeFileSync(this.getConfigFileLocation(), JSON.stringify(obj));
  }

  getConfigFileLocation() {
    return this.reflect === 'HOME' ? path.join(getUserHome(), '.fccli') : this.reflect;
  }

}

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

module.exports = new Options();