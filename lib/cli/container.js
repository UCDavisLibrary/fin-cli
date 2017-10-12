const path = require('path');
const api = require('../api');
const config = require('../config');
const contentDisposition = require('content-disposition');
const inquirer = require('inquirer');
const fs = require('fs');
const turtleParser = require('../turtle');
const Logger = require('./logger');
const editor = require('./editor');
const pathutils = require('../pathutils');

class InteractiveContainer {
  constructor() {
    this.cwd = '/';

    this.TYPES = {
      DATA_FILE : 'DATA_FILE',
      CONTAINER : 'CONTAINER'
    }
  }

  init(vorpal, location) {
    this.vorpal = vorpal;
    this.location = location;
    var self = this;

    vorpal.command('info').action(this.info.bind(this));

    vorpal.command('update [fedora_path]')
          .option('-b, --binary  binary>', 'Binary file for location')
          .option('-f, --filename <filename>', 'Alternative filename for binary, if binary file provided.')
          .option('-r, --rdf <rdf>', 'Turtle RDF file to describe container.  Will be applied to binary file container if binary provided')
          .description('Update given location with provided file.  If no rdf and/or binary file is proved interactive mode is used to create rdf container.')
          .action(this.update.bind(this));
    
    vorpal.command('create [fedora_path]')
          .option('-b, --binary <binary>', 'Binary file for location')
          .option('-f, --filename <filename>', 'Alternative filename for binary, if binary file provided.')
          .option('-r, --rdf <rdf>', 'Turtle RDF file to describe container.  Will be applied to binary file container if binary provided')
          .description('Create location with provided file.  If no rdf and/or binary file is proved interactive mode is used')
          .action(this.create.bind(this));
    
    vorpal.command('delete [fedora_path]')
          .description('Remove provided path')
          .action(this.remove.bind(this));
    
    vorpal.command('transaction start').action(this.startTransaction.bind(this));
    vorpal.command('transaction commit').action(this.commitTransaction.bind(this));
    vorpal.command('transaction rollback').action(this.rollbackTransaction.bind(this));

    vorpal.command('version list [dir]').action(this.getVersions.bind(this));
    vorpal.command('version get [dir]')
          .option('-n, --version-name <name>', 'Version name')
          .action(this.getVersion.bind(this));
    vorpal.command('version create [dir]')
          .option('-n, --version-name <name>', 'Version name')
          .action(this.createVersion.bind(this));
    vorpal.command('version revert [dir]')
          .option('-n, --version-name <name>', 'Version name')
          .action(this.revertToVersion.bind(this));
    vorpal.command('version delete [dir]')
          .option('-n, --version-name <name>', 'Version name')
          .action(this.deleteVersion.bind(this));

    vorpal.command('script <file>')
          .description('Script multiple commands with a transaction')
          .action(this.script.bind(this));
  }

  /**
   * Helper for is this a data file or a container from HEAD cmd
   */
  async locationInfo(path) {
    var {response, body} = await api.head({path});

    var link = response.headers['link'];
    if( link ) link = this._parseLinkHeader(link);
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
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path ? args.fedora_path+'' : '.');
    
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

    var newbody = await editor(body);

    if( body === newbody ) {
      return Logger.log('Cancelled, no edits made');
    } else {
      Logger.log(`${newbody}\n`);
    }

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Save (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var sparql = await this._turtleToSparqlUpdate(newbody, body);

    var {response, body} = await api.patch({
      path : args.fedora_path,
      headers : {
        'Content-Type' : api.RDF_FORMATS.SPARQL_UPDATE
      },
      fileIsContent : true,
      partial : true,
      file : sparql
    });

    if( api.isSuccess(response) ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  async create(args) {
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path || '.');
    
    if( args.options.binary || args.options.rdf ) {
      return await this.createFromFiles(args);
    } else {
      return await this.createInteractive(args);
    }
  }

  async createInteractive(args) {
    var body = [];
    var prefixes = config.globalPrefix;
    for( var key in prefixes ) {
      body.push(`@prefix ${key}: <${prefixes[key]}> .`);
    }
    body.push('');
    body.push(`<> dc:title "A new container" ;`)
    body.push('  dc:description "No description provided" .');

    Logger.log(`\nCreating at path: ${args.fedora_path}\n`);

    var newbody = await editor(body.join('\n'));

    if( body === newbody ) {
      return Logger.log('Cancelled, no edits made');
    } else {
      Logger.log(`${newbody}\n`);
    }

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Save (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await api.update({
      headers : {
        'Content-Type' : api.RDF_FORMATS.TURTLE
      },
      path : args.fedora_path,
      fileIsContent : true,
      file : newbody
    });

    if( api.isSuccess(response) ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  async createFromFiles(args) {
    if( args.options.binary ) {
      args.options.binary = pathutils.makeAbsolutePath(args.options.binary);
      if( !fs.existsSync(args.options.binary) ) {
        return Logger.error(`Binary file does not exist: ${args.options.binary}`);
      }
    }
    if( args.options.rdf ) {
      args.options.rdf = pathutils.makeAbsolutePath(args.options.rdf);
      if( !fs.existsSync(args.options.rdf) ) {
        return Logger.error(`RDF file does not exist: ${args.options.rdf}`);
      }
    }

    var {response, body} = await api.update({
      path : args.fedora_path,
      file : args.options.binary
    });

    if( !api.isSuccess(response) ) {
      return Logger.error(body, response);
    }

    if( args.options.binary && args.options.rdf) {
      var turtle = fs.readFileSync(args.options.rdf, 'utf-8');

      // inject or global headers
      var headers = [];
      for( var key in config.globalPrefix ) {
        headers.push(`@prefix ${key}: <${config.globalPrefix[key]}> .`);
      }
      turtle = headers.join('\n')+'\n'+turtle;

      var sparql = await this._turtleToSparqlUpdate(turtle);

      var {response, body} = await api.patch({
        path : path.join(args.fedora_path, 'fcr:metadata'),
        headers : {
          'Content-Type' : api.RDF_FORMATS.SPARQL_UPDATE
        },
        fileIsContent : true,
        partial : true,
        file : sparql
      });

      if( api.isSuccess(response) ) console.log('Created: '+args.fedora_path);
      else console.log(body);
    } else {
      console.log('Created: '+args.fedora_path);
    }
  }

  async remove(args) {
    args.fedora_path = args.fedora_path ? args.fedora_path+'' : '.';
    if( !args.fedora_path.match(/^\//) ) {
      args.fedora_path = path.resolve(this.location.cwd, args.fedora_path);
    }

    var info = await this.locationInfo(args.fedora_path);
    var infopath = args.fedora_path;
    if( info.type === this.TYPES.DATA_FILE ) {
      infopath = path.join(args.fedora_path, '/fcr:metadata');
    }

    // grab the current ns
    var {response, body} = await api.get({
      path: infopath
    });

    console.log(`\nRemove: ${args.fedora_path}\n\n${body}\n`);

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Delete (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await api.remove({
      path : args.fedora_path,
      permanent : true
    });

    if( api.isSuccess(response) ) console.log('Deleted: '+args.fedora_path);
    else console.log(body);
  }

  _genericTripleToSparqlUpdate(triple) {
    if( triple.object.match(/^http/i) ) {
      return `<> <${triple.predicate}> <${triple.object}> .`;
    }
    return `<> <${triple.predicate}> ${triple.object.replace(/\^\^.*/, '')} .`;
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

  async script(args) {
    if( this.vorpal.interactive ) {
      return Logger.log('Cannot run script for interactive mode :(');
    }

    args.file = pathutils.makeAbsolutePath(args.file);
    if( !fs.existsSync(args.file) ) {
      return Logger.error(`Script file does not exist: ${args.file}`);
    }

    var cmds = fs.readFileSync(args.file, 'utf-8').split('\n');
    
    await this.startTransaction();
    for( var i = 0; i < cmds.length; i++ ) {
      if( !cmds[i].trim() ) continue;
      try {
        await this.vorpal.exec(cmds[i]);
      } catch (e) {
        Logger.error(e);
      }
    }

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Commit Changes (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      await this.rollbackTransaction();
    } else {
      await this.commitTransaction();
    }
  }

  async startTransaction() {
    await api.startTransaction();
    Logger.log('Transation started: '+api.transaction);
  }

  async commitTransaction() {
    var transaction = api.transaction;
    if( !transaction ) return Logger.error('There is no transaction started');

    var {response, body} = await api.commitTransaction();
    Logger.log('Transation Committed: '+transaction);
    Logger.log(body);
  }

  async rollbackTransaction() {
    var transaction = api.transaction;
    if( !transaction ) return Logger.error('There is no transaction started');

    var {response, body} = await api.rollbackTransaction();
    Logger.log('Transation Rolled Back: '+transaction);
    Logger.log(body);
  }

  async getVersions(args) {
    args.dir = pathutils.makeAbsoluteFcPath(args.dir || '.');
    var {response, body} = await api.getVersions({path: args.dir});
    Logger.log(body);
  }

  async getVersion(args) {
    if( !args.options['version-name'] ) return Logger.error('Version name required');
    args.dir = pathutils.makeAbsoluteFcPath(args.dir || '.');
    var {response, body} = await api.getVersion({path: args.dir, versionName: args.options['version-name']});
    Logger.log(body);
  }

  async createVersion(args) {
    if( !args.options['version-name'] ) return Logger.error('Version name required');
    args.dir = pathutils.makeAbsoluteFcPath(args.dir || '.');
    var {response, body} = await api.createVersion({path: args.dir, versionName: args.options['version-name']});
    Logger.log(body);
  }

  async revertToVersion(args) {
    if( !args.options['version-name'] ) return Logger.error('Version name required');
    args.dir = pathutils.makeAbsoluteFcPath(args.dir || '.');
    var {response, body} = await api.revertToVersion({path: args.dir, versionName: args.options['version-name']});
    Logger.log(body);
  }

  async deleteVersion(args) {
    if( !args.options['version-name'] ) return Logger.error('Version name required');
    args.dir = pathutils.makeAbsoluteFcPath(args.dir || '.');
    var {response, body} = await api.deleteVersion({path: args.dir, versionName: args.options['version-name']});
    Logger.log(body);
  }

  async _turtleToSparqlUpdate(newturtle, oldturtle) {
    var add = await turtleParser(newturtle);
    var del;
    if( oldturtle ) {
      del = await turtleParser(oldturtle);
    }

    var headers = [];
    for( var key in add.prefixes ) {
      headers.push(`PREFIX ${key}: <${add.prefixes[key]}>`);
    }
    for( var key in config.globalPrefix ) {
      if( add.prefixes[key] ) continue;
      headers.push(`PREFIX ${key}: <${config.globalPrefix[key]}>`);
    }
    headers = headers.join('\n');

    var deletes = '';
    if( del ) {
      for( var i = del.triples.length-1; i >= 0; i-- ) {
        if( del.triples[i].predicate === 'http://www.w3.org/ns/ldp#contains' ) {
          del.triples.splice(i, 1);
        }
      }
      deletes = del.triples.map(this._genericTripleToSparqlUpdate).join('\n');
    }

    for( var i = add.triples.length-1; i >= 0; i-- ) {
      if( add.triples[i].predicate === 'http://www.w3.org/ns/ldp#contains' ) {
        add.triples.splice(i, 1);
      }
    }
    var inserts = add.triples.map(this._genericTripleToSparqlUpdate).join('\n');

    return `${headers}
    
    DELETE {   
      ${deletes}
    }
    INSERT {   
      ${inserts}
    }
    
    WHERE { }
    `;
  }

  _parseLinkHeader(link) {
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