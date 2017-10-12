const api = require('../api');
const config = require('./ConfigModel');
const request = require('request');

class AuthModel {

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
      method : 'POST',
      uri : (options.host ? options.host : config.host) + '/auth/local',
      form : {
        username: options.username, 
        password: options.password
      }
    }

    var {response, body} = await this._request(req);
    var body = JSON.parse(body);

    if( body.error ) {
      return false;
    } else {
      config.username = options.username;
      config.password = options.password;
      config.jwt = body.jwt;
      return true;
    }
  }

}

module.exports = new AuthModel();