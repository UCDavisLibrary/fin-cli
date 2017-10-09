const logger = require('./logger');
const api = require('../api');
const path = require('path');
const fs = require('fs');
const Logger = require('./logger');
const {URL} = require('url');
const config = require('../config');
const inquirer = require('inquirer');

class InteractiveAcl {

  init(vorpal, location, container) {
    this.location = location;
    this.container = container;
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
    var aclInfo = await this.acl(args);

    var display = [];
    for( var key in aclInfo ) {
      var access = [];
      if( aclInfo[key].read ) access.push('read');
      if( aclInfo[key].write ) access.push('write');

      display.push(`${key}: ${access.join(', ')}`);
    }

    logger.log(display.join('\n'));
  }
  
  async acl(args) {
    var tree = await this.aclTree();
    var displaypath = (args.dir || this.location.cwd).split('/');


    var access = {};

    for( var i = 0; i < displaypath.length; i++ ) {
      var part = displaypath[i] || '/';
      if( !tree[part] ) break;

      var leafacl = tree[part];

      if( leafacl._modes && leafacl._agents ) {
        leafacl._agents.forEach((agent) => {
          if( !access[agent] ) access[agent] = {};
          access[agent].read = (leafacl._modes.indexOf('Read') > -1 ),
          access[agent].write = (leafacl._modes.indexOf('Write') > -1 )
        });  
      }

      tree = leafacl;
    }

    return access;
  }

  async edit(args) {
    args.fedora_path = args.path ? args.path+'' : '.';
    if( !args.fedora_path.match(/^\//) ) {
      args.fedora_path = path.resolve(this.location.cwd, args.fedora_path);
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
    
    var newbody = await this.container._editor(aclBody);

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

    if( response.statusCode === 200 || response.statusCode === 204 ) console.log('Updated: '+args.fedora_path);
    else console.log(body);
  }

  async aclTree(args = {}) {
   return await this.walk('/acl', {});
  }

  async walk(rootdir, tree) {

    var {response, body} = await api.get({
      path : rootdir,
      headers : {
        Accept : api.RDF_FORMATS.JSON_LD
      }
    });

    body = JSON.parse(body)[0];
    if( body['http://www.w3.org/ns/auth/acl#accessTo'] ) {
      var modes = body['http://www.w3.org/ns/auth/acl#mode'];
      var agents = body['http://www.w3.org/ns/auth/acl#agent'];
      var acldirs = body['http://www.w3.org/ns/auth/acl#accessTo'];
      
      acldirs.forEach((dir) => {
        var path = getPath(dir['@id']).split('/');
        var obj = ensurePath(tree, path.splice(0));
        obj._def = rootdir;
        obj._agents = agents.map(agent => agent['@value'] || agent['@id']);
        obj._modes = modes.map(mode => mode['@id'].replace(/.*#/, ''));
      });
    }

    var dirs = await this.location.ls({dir: rootdir, data: true});
    for( var i = 0; i < dirs.length; i++ ) {
      await this.walk(path.join(rootdir, dirs[i]), tree);
    }

    return tree;
  }
}

function ensurePath(tree, path) {
  if( path.length === 0 ) return tree;

  var item = path[0] || '/';
  if( !tree[item] ) tree[item] = {};
  path.splice(0, 1);

  return ensurePath(tree[item], path);
}

function getPath(fullurl) {
  var re = new RegExp('^'+config.host+config.basePath);
  return fullurl.replace(re, '');
}

module.exports = new InteractiveAcl();