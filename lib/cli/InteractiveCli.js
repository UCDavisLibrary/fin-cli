const path = require('path');
const api = require('@ucd-lib/fin-node-api');
const config = require('../models/ConfigModel');
const contentDisposition = require('content-disposition');
const inquirer = require('inquirer');
const fs = require('fs');
const Logger = require('../logger');
const editor = require('../editor');
const pathutils = require('../pathutils');
const model = require('../models/InteractiveModel');
const locationInfo = require('../locationinfo');

class ContainerCli {

  init(vorpal) {
    this.vorpal = vorpal;
    var self = this;

    // just a placeholder for help
    vorpal.command('shell')
      .description('Start interactive shell')
      .action((args, callback) => {
        // if this is called in shell mode, just echo no op
        this.log('no op');
        callback();
      });

    vorpal.command('interactive update [fedora_path]')
          .description('Update container at location in your text editor')
          .option('-e --editor <editor>', 'Editor command to use, default to \'vscode\'')
          .action(this.update.bind(this));
    
    vorpal.command('interactive create <fedora_path>]')
          .description('Create container at location in your text editor')
          .option('-e --editor <editor>', 'Editor command to use, default to \'vscode\'')
          .action(this.create.bind(this));
  }

  async update(args) {
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path ? args.fedora_path+'' : '.');
    
    if( args.file ) {
      return console.log('Updating with provided file');
    }

    var info = await locationInfo.parse(args.fedora_path);
    if( info.type === locationInfo.TYPES.DATA_FILE ) {
      args.fedora_path = path.join(args.fedora_path, '/fcr:metadata');
    }

    // grab the current ns
    var {response, body} = await api.get({
      path: args.fedora_path,
      headers : {
        Prefer : 'return=representation; omit=\"http://fedora.info/definitions/v4/repository#ServerManaged\"'
      }
    });

    let options = {}
    if( args.options.editor ) {
      options.editor = args.options.editor;
    }

    var result = await editor(body, options);

    if( body === result.body ) {
      return Logger.log('Cancelled, no edits made');
    } else {
      Logger.log(`${result.body}\n`);
    }

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Save (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await model.update(args, result.body, body);
    
    if( api.isSuccess(response) ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  async create(args) {
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path || '.');

    var body = [];
    var prefixes = config.globalPrefix;
    for( var key in prefixes ) {
      body.push(`@prefix ${key}: <${prefixes[key]}> .`);
    }
    body.push('');
    body.push(`<> dc:title "A new container" ;`)
    body.push('  dc:description "No description provided" .');

    Logger.log(`\nCreating at path: ${args.fedora_path}\n`);

    let options = {}
    if( args.options.editor ) {
      options.editor = args.options.editor;
    }
    var result = await editor(body.join('\n'), options);

    var accept = await inquirer.prompt([{
      type: 'text',
      name: 'approve',
      message: 'Save (Y/n): '
    }]);

    if( accept.approve != 'Y' ) {
      return Logger.log('Cancelled, no edits made');
    }

    var {response, body} = await model.createFromRdf(args, result.body);

    if( api.isSuccess(response) ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }
}



module.exports = new ContainerCli();