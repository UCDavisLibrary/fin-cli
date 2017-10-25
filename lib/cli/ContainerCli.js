const path = require('path');
const api = require('fin-node-api');
const config = require('../models/ConfigModel');
const contentDisposition = require('content-disposition');
const inquirer = require('inquirer');
const fs = require('fs');
const Logger = require('../logger');
const editor = require('../editor');
const pathutils = require('../pathutils');
const model = require('../models/ContainerModel');

class ContainerCli {

  init(vorpal) {
    this.vorpal = vorpal;
    var self = this;

    vorpal.command('info [fedora_path]').action(this.info.bind(this));

    vorpal.command('update [fedora_path]')
          .option('-b, --binary  binary>', 'Binary file for location')
          .option('-f, --filename <filename>', 'Alternative filename for binary, if binary file provided.')
          .option('-r, --rdf <rdf>', 'Turtle RDF file to describe container.  Will be applied to binary file container if binary provided')
          .description('Update given location with provided file.  If no rdf and/or binary file is proved interactive mode is used to create rdf container.')
          .action(this.update.bind(this));
    
    vorpal.command('create <fedora_path>]')
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

  async update(args) {
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path ? args.fedora_path+'' : '.');
    
    if( args.file ) {
      return console.log('Updating with provided file');
    }

    var info = await model.locationInfo(args.fedora_path);
    if( info.type === model.TYPES.DATA_FILE ) {
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

    var {response, body} = await model.update(args, newbody, body);
    
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

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Save (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await model.createFromRdf(args, newbody);

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

    var {response, body} = await api.put({
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

      var sparql = await model._turtleToSparqlUpdate(turtle);

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
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path || '.');

    var info = await model.locationInfo(args.fedora_path);
    var infopath = args.fedora_path;
    if( info.type === mode.TYPES.DATA_FILE ) {
      infopath = pathutils.makeAbsoluteFcPath(args.fedora_path, '/fcr:metadata');
    }

    // grab the current ns
    var {response, body} = await model.get({fedora_path: infopath});

    console.log(`\nRemove: ${args.fedora_path}\n\n${body}\n`);

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Delete (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await model.remove(args);

    if( api.isSuccess(response) ) console.log('Deleted: '+args.fedora_path);
    else console.log(body);
  }

  /**
   * Print location information
   */
  async info(args) {
    var {info, body, response} = await model.info(args);

    if( info.type === model.TYPES.DATA_FILE ) {
      console.log('========== Binary File ==========\n');
      for( var key in info.file.parameters ) {
        console.log(`${key}: ${info.file.parameters[key]}`)
      }
    }

    if( response.headers && response.headers.link ) {
      let services = response.headers.link
                             .split(',')
                             .map(item => {
                                let arr = item.split(';').map(part => part.trim());
                                arr[0] = arr[0].match(/<(.*)>/)[1];
                                arr[1] = arr[1].match(/rel="(.*)"/)[1];
                                return arr;
                             })
                             .reduce((values, item) => {
                              if( item[1] === 'service' ) values.push(item[0]);
                              return values;
                             },[]);
      if( services.length > 0 ) {
        console.log('\n========== Services ==========\n');
        console.log(services.join('\n')+'\n');
      }
    }
      
    if( info.type === model.TYPES.DATA_FILE ) {
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
        console.log('\n'+cmds[i]);
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
    var {response, body} = await model.startTransaction();

    if( api.isSuccess(response) ) Logger.log('Transation started: '+api.getConfig().transactionToken);
    else Logger.log('Failed to start transation:\n'+body, response);
  }

  async commitTransaction() {
    var transaction = api.getConfig().transactionToken;
    if( !transaction ) return Logger.error('There is no transaction started');

    var {response, body} = await model.commitTransaction();

    if( api.isSuccess(response) ) {
      Logger.log('Transation Committed: '+transaction);
    } else {
      Logger.error('Failed to commit transation:\n'+body, response)
    }
  }

  async rollbackTransaction() {
    var transaction = api.transaction;
    if( !transaction ) return Logger.error('There is no transaction started');

    var {response, body} = await model.rollbackTransaction();
    if( api.isSuccess(response) ) {
      Logger.log('Transation Rolled Back: '+transaction);
    } else {
      Logger.error('Failed to commit transation:\n'+body, response)
    }
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

}



module.exports = new ContainerCli();