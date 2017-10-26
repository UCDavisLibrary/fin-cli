const Logger = require('../logger');
const api = require('fin-node-api');
const fs = require('fs');
const pathutils = require('../pathutils');
const prefixutils = require('../prefixutils');
const inquirer = require('inquirer');
const config = require('../models/ConfigModel');

/**
 * @class HttpCli
 * @description Handle http commands
 */
class HttpCli {

  async init(vorpal, argv) {
    this.vorpal = vorpal;

    // get
    this._stdOptionWrapper(
      vorpal.command('http get [path]')
      .description('Retrieve the content of the resource')
      .action(this.get.bind(this))
    );

    // post
    this._stdOptionWrapper(
      vorpal.command('http post [path]')
      .description('Create new resources within a LDP container')
      .option('-p --prefix <prefix>', 'Additional header prefix')
      .option('-@ --data-binary <binary>', 'Specify a data file to add.  Can be to stdin')
      .option('-t --data-string <data>', 'Specify a string to be used as turtle formatted triples, use defined prefixes')
      .action(this.post.bind(this))
    );
  }

  /**
   * @method
   * @private
   * 
   * @description wrap standard options for all http methods
   */
  _stdOptionWrapper(command) {
    command.option('-H, --header <header>', 'Add additional Headers to the request')
           .option('-P, --print <print>', 'Specify what components to print to user. Value should '+
                    'be any combination of hbHB where: H=request headers, B=request body,'+
                    'h=response headers and b=response body');
  }

  /**
   * @method
   * @private
   * @description parse given HTTP headers from command line and set to HTTP options
   * 
   * @param {Object} options HTTP request options 
   * @param {Object} args command line options
   */
  _appendHeaders(options, args) {
    if( !args.header ) return;
    if( Array.isArray(args.header) ) {
      args.header.forEach(header => this._appendHeader(options, header));
    } else {
      this._appendHeader(options, args.header);
    }
  }

  _parseDisplayOptions(args) {
    let printOptions = {
      H : false,
      B : false,
      h : false,
      b : false
    }

    if( args.options.print ) {
      for( var key in printOptions ) {
        if( args.options.print.indexOf(key) > -1 ) {
          printOptions[key] = true;
        }
      }
    }

    return printOptions;
  }

  /**
   * @method
   * @private
   * @description parse given HTTP header from command line and set to HTTP options
   * 
   * @param {Object} options HTTP request options 
   * @param {String} header HTTP header
   */
  _appendHeader(options, header) {
    try {
      let parts = header.split(':').map(part => part.trim());
      options.headers[parts[0]] = parts[1];
    } catch(e) {
      throw new Error(`Invalid HTTP header: ${header}`);
    }
  }

  /**
   * @method
   * @private
   * 
   * @description print results of HTTP method
   * 
   * @param {Object} args command args
   * @param {Object} response HTTP response object
   */
  _display(args, response) {
    let printOptions = this._parseDisplayOptions(args);
    let request = response.request;

    if( print.H ) {
      Logger.log(`${request.method} ${request.href}`);
      this._displayHeaders(request.headers);
      Logger.log('');
    }

    if( print.B && request.body ) {
      Logger.log(request.body);
      Logger.log();
    }

    if( print.h ) {
      Logger.log(`HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}`);
      this._displayHeaders(response.headers);
      Logger.log('');
    }

    if( print.b && response.body ) {
      Logger.log(response.body);
      Logger.log();
    }
  }

  _displayHeaders(headers) {
    if( !headers ) return;
    for( var key in headers ) {
      Logger.log(`${key}: ${headers[key]}`);
    }
  }

  /**
   * @method get
   * @description Handle 'http get' command
   * 
   * @param {Object} args Command line arguments 
   */
  async get(args) {
    let options = {
      path : pathutils.makeAbsoluteFcPath(args.path || '.'),
      headers : {}
    }

    // parse headers
    if( args.options.header ) {
      this._appendHeaders(options, args.options);
    }

    let {response, body} = await api.get(options);
    this._display(args, response);
  }

  /**
   * @method post
   * @description Handle 'http post' command
   * 
   * @param {Object} args Command line arguments 
   */
  async post(args) {
    let options = {
      path : pathutils.makeAbsoluteFcPath(args.path || '.'),
      headers : {}
    }

    // parse headers
    if( args.options.header ) {
      this._appendHeaders(options, args.options);
    }

    if( args.options['data-binary'] ) {
      // prompt user for input
      if( args.options['data-binary'].toLowerCase() === 'stdin' ) {
        var input = inquirer.prompt([{
          type: 'text',
          name: 'postdata'
        }]);
        options.content = input.postdata;

      } else if( args.options['data-binary'].toLowerCase() === '/dev/stdin' ) {
        options.content = fs.readFileSync('/dev/stdin', 'utf-8');

      // set file from file system
      } else {
        options.file = pathutils.makeAbsolutePath(args.options['data-binary']);
        if( !fs.existsSync(options.file) ) {
          return Logger.error(`Invalid file: ${options.file}`);
        }
      }

    } else if( args.options['data-string'] ) {
      let prefixes = prefixutils(args);
      options.content = prefixes+'\n'+args.options['data-string'];
      options.headers['Content-Type'] = api.RDF_FORMATS.TURTLE;
    }

    let {response, body} = await api.post(options);
    this._display(args, response);
  }
}

module.exports = new HttpCli();