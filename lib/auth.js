const api = require('./api');
const config = require('./config');
const request = require('request');

class Authenticate {

  _request(options) {
    return new Promise((resolve, reject) => {
      request(options,  (error, response, body) => {
        if( error ) return reject(error);
        resolve({response, body});
      });
    });
  }

  async login(options) {
    var req = {
      uri : (options.host ? options.host : config.host) + '/auth/local',
      qs : {
        username: options.username, 
        password: options.password
      }
    }

    var {response, body} = await this._request(req);
    var body = JSON.parse(body);

    if( body.error ) {
      console.error(options.username, body.message);
      return false;
    } else {
      config.username = options.username;
      config.password = options.password;
      config.jwt = body.jwt;
      return true;
    }
  }

}

var auth = new Authenticate();
require('./cli/config').setAuth(auth);

module.exports = auth;