const ModelBase = require('./ModelBase');
const pathutils = require('../pathutils');
const config = require('../models/ConfigModel');
const api = require('../api');

class AclModel extends ModelBase {

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

module.exports = new AclModel();