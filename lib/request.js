/**
 * Wrapper for API requests, will try to login once if auth fails.
 */
const requestCallback = require('request');
const config = require('./models/ConfigModel');
// const auth = require('./models/AuthModel');
let auth = null;
const fs = require('fs');

function _request(options) {
  if( !options.headers ) options.headers = {};
  if( config.jwt ) {
    options.headers['Authorization'] = `Bearer ${config.jwt}`;
  }

  return new Promise((resolve, reject) => {
    requestCallback(options,  (error, response, body) => {
      if( error ) return reject(error);
      resolve({response, body});
    });
  });
}

async function request(options) {
  let {response, body} = await _request(options);

  // try one login if there is a username password
  if( (response.statusCode === 403 ) && config.username && (config.password || config.refreshToken) ) {
    let success = false;
    if( config.refreshToken ) {
      success = await auth.loginRefreshToken({username: config.username, refreshToken: config.refreshToken});
    } else {
      success = await auth.loginPassword({username: config.username, password: config.password});
    }
    
    // need to recreate the file read stream
    if( options.body && typeof options.body !== 'string' ) {
      options.body = fs.createReadStream(options.body.path);
    }

    if( success ) return await _request(options);
  }

  return {response, body};
}

module.exports = request;
module.exports.init = function(AuthModel) {
  auth = AuthModel;
}