/**
 * Wrapper for API requests, will try to login once if auth fails.
 */
const requestCallback = require('request');
const config = require('./config');
const auth = require('./auth');
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
  if( (response.statusCode === 403 || response.statusCode === 500) && config.username && config.password) {
    var success = await auth.login({username: config.username, password: config.password});
    
    // need to recreate the file read stream
    if( options.body ) {
      options.body = fs.createReadStream(options.body.path);
    }

    if( success ) return await _request(options);
  }

  return {response, body};
}

module.exports = request;