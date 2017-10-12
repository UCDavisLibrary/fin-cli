const logger = require('./logger');
const api = require('../api');
const path = require('path');
const fs = require('fs');
const Logger = require('./logger');
const {URL} = require('url');
const config = require('../models/ConfigModel');
const inquirer = require('inquirer');
const editor = require('./editor');
const model = require('../models/AclModel');
const LocationStore = require('../stores/LocationStore');

class AclCli {

  init(vorpal) {
    vorpal
      .command('acl tree')
      .description('Display the entire ACL tree')
      .action(this.displayTree.bind(this));

    vorpal
      .command('acl [dir]')
      .description('Display access to a specific directory')
      .action(this.display.bind(this));
    
    vorpal.command('acl edit [fedora_path] [local_file_path]')
      .description('Edit acl for location with provided file.  If no local file is proved interactive mode is used')
      .action(this.edit.bind(this));
  
  }

  async displayTree() {
    var tree = await this.aclTree();
    logger.log(JSON.stringify(tree, '', '  '));
  }

  async display(args) {
    var aclInfo = await model.acl(args);

    var display = [];
    for( var key in aclInfo ) {
      var access = [];
      if( aclInfo[key].read ) access.push('read');
      if( aclInfo[key].write ) access.push('write');

      display.push(`${key}: ${access.join(', ')}`);
    }

    logger.log(display.join('\n'));
  }

  async edit(args) {
    args.fedora_path = args.path ? args.path+'' : '.';
    if( !args.fedora_path.match(/^\//) ) {
      args.fedora_path = path.resolve(LocationStore.getCwd(), args.fedora_path);
    }
    
    var tree = await this.aclTree();

    var displaypath = args.fedora_path.split('/');
    var aclPath = '';
    for( var i = 0; i < displaypath.length; i++ ) {
      var part = displaypath[i] || '/';
      if( !tree[part] ) break;
      
      var leafacl = tree[part];
      if( i === displaypath.length - 1 && leafacl._def ) {
        aclPath = leafacl._def
      }

      tree = leafacl;
    }

    if( args.local_file_path ) {
      return console.log('Creating with provided file');
    }

    var aclBody, creating = true;
    if( aclPath ) {
      var {response, body} = await api.get({
        path: aclPath,
        headers : {
          Prefer : 'return=representation; omit=\"http://fedora.info/definitions/v4/repository#ServerManaged\"'
        }
      });

      Logger.log(`\nUpdating for path: ${args.fedora_path}\n`);
      aclBody = body;
      creating = false;

    } else {
      aclBody = fs.readFileSync(path.join(__dirname, 'acl_template.ttl'), 'utf-8');
      aclBody = aclBody.replace(/{{fcpath}}/, path.join(config.basePath, args.fedora_path));
      Logger.log(`\nCreating for path: ${args.fedora_path}\n`);
    }
    
    var newbody = await editor(aclBody);

    if( aclBody === newbody ) {
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

    if( !creating ) {
      var {response, body} = await api.remove({
        path : aclPath,
        permanent : true
      });
    } else {
      aclPath = path.join('/acl', args.fedora_path);

      // remove any stub that may be laying around
      var {response, body} = await api.head({path: aclPath});
      if( response.statusCode === 200 ) {
        var {response, body} = await api.remove({
          path : aclPath,
          permanent : true
        });
      }
    }

    Logger.log(`Writing new acl rules to: ${aclPath}`);
    var {response, body} = await api.update({
      headers : {
        'Content-Type' : api.RDF_FORMATS.TURTLE
      },
      path : aclPath,
      fileIsContent : true,
      file : newbody
    });

    if( api.isSuccess(response) ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  async aclTree(args = {}) {
   return await model.walk('/acl', {});
  }

  
}



module.exports = new AclCli();