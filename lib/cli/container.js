const path = require('path');
const api = require('../api');
const config = require('../config');
const contentDisposition = require('content-disposition');
const inquirer = require('inquirer');
const spawn = require('child_process').spawn;
const fs = require('fs');
const os = require('os');
const turtleParser = require('../turtle');
const Logger = require('./logger');

class InteractiveContainer {
  constructor() {
    this.cwd = '/';

    this.TYPES = {
      DATA_FILE : 'DATA_FILE',
      CONTAINER : 'CONTAINER'
    }
  }

  init(vorpal, location) {
    this.location = location;
    var self = this;

    vorpal.command('info').action(this.info.bind(this));

    vorpal.command('update [fedora_path] [local_file_path]')
          .description('Update give location with provided file.  If no file is proved interactive mode is used')
          .action(this.update.bind(this));
  }

  /**
   * Helper for is this a data file or a container from HEAD cmd
   */
  async locationInfo(path) {
    var {response, body} = await api.head({path});

    var link = response.headers['link'];
    if( link ) link = this.parseLinkHeader(link);
    else link = {};

    if( response.headers['content-disposition'] ) {
      return {
        status : response.statusCode,
        type : this.TYPES.DATA_FILE,
        file : contentDisposition.parse(response.headers['content-disposition']),
        link : link
      }
    }

    return {
      status : response.statusCode,
      type : this.TYPES.CONTAINER,
      link : link
    }
  }

  async update(args) {
    args.fedora_path = args.fedora_path ? args.fedora_path+'' : '.';
    if( !args.fedora_path.match(/^\//) ) {
      args.fedora_path = path.resolve(this.location.cwd, args.fedora_path);
    }
    
    if( args.file ) {
      return console.log('Updating with provided file');
    }

    var info = await this.locationInfo(args.fedora_path);
    if( info.type === this.TYPES.DATA_FILE ) {
      args.fedora_path = path.join(args.fedora_path, '/fcr:metadata');
    }

    // grab the current ns
    var {response, body} = await api.get({
      path: args.fedora_path,
      headers : {
        Prefer : 'return=representation; omit=\"http://fedora.info/definitions/v4/repository#ServerManaged\"'
      }
    });

    var del = await turtleParser(body);

    var newbody = await this._editor(body);

    if( body === newbody ) {
      return Logger.log('Cancelled, no edits made');
    }

    var add = await turtleParser(newbody);

    var headers = [];
    for( var key in add.prefixes ) {
      headers.push(`PREFIX ${key}: <${add.prefixes[key]}>`)
    }
    headers = headers.join('\n');

    var deletes = del.triples.map(this._genericTripleToSparqlUpdate).join('\n');
    var inserts = add.triples.map(this._genericTripleToSparqlUpdate).join('\n');

    var sparql = `${headers}
    
    DELETE {   
      ${deletes}
    }
    INSERT {   
      ${inserts}
    }
    
    WHERE { }
    `;

    var {response, body} = await api.patch({
      path : args.fedora_path,
      headers : {
        'Content-Type' : api.RDF_FORMATS.SPARQL_UPDATE
      },
      fileIsContent : true,
      partial : true,
      file : sparql
    });

    if( response.statusCode === 200 || response.statusCode === 204 ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  _genericTripleToSparqlUpdate(triple) {
    if( triple.object.match(/^http/i) ) {
      return `<> <${triple.predicate}> <${triple.object}> .`;
    }
    return `<> <${triple.predicate}> ${triple.object.replace(/\^\^.*/, '')} .`;
  }

  _editor(body) {
    return new Promise(async (resolve, reject) => {
      var file = await this._prepTmpFile(body);

      var vscode = spawn('code', ['-n', '-w', file]);      
      vscode.on('close', () => {
        var newbody = fs.readFileSync(file, 'utf-8');
        fs.unlinkSync(file);
        resolve(newbody);
      });
    });
  }

  _prepTmpFile(body) {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcrepo-'));
    var file = path.join(dir, 'edit.ttl');
    fs.writeFileSync(file, body);
    return file;
  }

  /**
   * Print location information
   */
  async info() {
    var info = await this.locationInfo(this.location.cwd);

    var infoPath = this.location.cwd;
    if( info.type === this.TYPES.DATA_FILE ) {
      infoPath = info.link.describedby[0].replace(config.host+config.basePath, '');
    }

    var {response, body} = await api.get({
      path : infoPath,
      headers : {
        Accept : api.RDF_FORMATS.TURTLE
      }
    });

    if( info.type === this.TYPES.DATA_FILE ) {
      console.log('========== Binary File ==========\n');
      for( var key in info.file.parameters ) {
        console.log(`${key}: ${info.file.parameters[key]}`)
      }
      console.log('\n========== Described By ==========\n');
    } else {
      console.log('========== Container ==========\n');
    }

    console.log(body);
  }

  parseLinkHeader(link) {
    var info = link.split(',')
                    .map(item => {
                      var parts = item.split(';');
                      var value = parts[0].replace(/(<|>)/g, '');
                      var is = parts[1].split('=')[1].replace(/"/g, '');
                      return {is: is, value: value.trim()};
                    });

    var result = {};
    info.forEach(item => {
      if( result[item.is] ) result[item.is].push(item.value);
      else result[item.is] = [item.value];
    });

    return result;
  }
}



module.exports = new InteractiveContainer();