const path = require('path');
const api = require('../api');
const config = require('../config');
const contentDisposition = require('content-disposition');
const inquirer = require('inquirer');

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
    vorpal.command('update <fedora_path> [local_file_path]')
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
    args.fedora_path = args.fedora_path+'';
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
      path: args.fedora_path
    });

    var parts = body.split('\n\n');
    var headers = parts[0]
                    .replace(/@prefix/g, 'PREFIX')
                    .replace(/ \./g, '');
    var content = parts[1].split('\n');

    var fieldInfo = await inquirer.prompt([{
      type: 'text',
      name: 'predicate',
      message: 'Predicate (defined ns allowed): '
    },
    {
      type: 'text',
      name: 'object',
      message: 'Object (turtle): '
    }]);

    var deletes = [];
    content.forEach(line => {
      if( line.indexOf(fieldInfo.predicate) > -1 ) {
        deletes.push(line.replace(' ;', ' .'));
      }
    });
    if( deletes.length === 0 ) deletes = '';
    else deletes = '  <> '+deletes.join('\n  <> ');

    var {response, body} = await api.patch({
      path : args.fedora_path,
      headers : {
        'Content-Type' : api.RDF_FORMATS.TURTLE
      },
      fileIsContent : true,
      partial : true,
      file : `${headers}

DELETE {   
  ${deletes}
}
INSERT {   
  <> ${fieldInfo.predicate} ${fieldInfo.object} .
}

WHERE { }
`
    });

    if( response.statusCode === 200 || response.statusCode === 204 ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
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