const api = require('@ucd-lib/fin-node-api');
const fcrPathUtils = require('@ucd-lib/fin-node-api/lib/utils/path');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const fs = require('fs-extra');
const path = require('path');
const acl = require('./AclCli');

class CollectionCli {

  init(vorpal) {
    vorpal
      .command('collection create <id> [metadata]')
      .description('Create a collection.  Metadata should be a path to a file or '+
                  'string content, either way metadata should be in turtle format.')
      .action(args => this.create(args));

    vorpal
      .command('collection delete <id>')
      .option('-f --force', 'no confirm delete prompt')
      .description('Delete a collection.')
      .action(args => this.delete(args));

    vorpal
      .command('collection relation add-properties <collection-id> <src-property> <dst-path> <dst-property> [src-path]')
      .description('Add a relation (via two properties) between two containers.  Both src and dst properties should be full uri\'s.')
      .action(args => this.createRelationProperties(args));

    vorpal
      .command('collection relation add-container <collection-id> <id>')
      .option('-m --membership-resource <membership-resource>', 'Path to container relative to collection root.  Only required '+
              'if membershipResource is not parent container.')
      .option('-T --type <type>', 'shortcut relation type, either [part|media]')
      .option('-h --has-member-relation <has-member-relation>', 'property id for hasMemberRelation. Use if --type not provided')
      .option('-i --is-member-of-relation <is-member-of-relation>', 'property id for isMemberOfRelation. Use if --type not provided')
      .option('-M --metadata <metadata>', 'Local filesystem path to .ttl file to add as metadata for container')
      .description('Add a relation (direct container) to collection.')
      .action(args => this.createRelationContainer(args));

    vorpal
      .command('collection resource add <collection-id> <file> [id]')
      .description('Add a resource to a collection.  File should be a file path.')
      .option('-m --metadata <path>', 'Path to metadata file.  If not given <file>.ttl will be checked and used if it exists')
      .option('-t --type <type>', 'schema.org types to resource.  No prefix needed, ie value should be like MediaObject')
      .action(args => this.addResource(args));

    vorpal
      .command('collection resource delete <collection-id> <id>')
      .description('Delete a collection container')
      .action(args => this.deleteResource(args));

    vorpal
      .command('collection acl user add <collection-id> <agent> <mode>')
      .description('Give user access to collection. Modes can be: r, w or rw.  For public access use \'PUBLIC\'.')
      .action(args => this.addUserAccess(args));

    vorpal
      .command('collection acl user remove <collection-id> <agent>')
      .description('Remove all user access to collection.')
      .action(args => this.removeAgentAccess(args));

    vorpal
      .command('collection acl group add <collection-id> <name> <mode>')
      .option('-a --agent <agent>', 'Agents to add to group')
      .description('Add a group to a collection and give group access.  '+
                  'Optionally add agents to group. Modes can be: r, w or rw')
      .action(args => this.addGroup(args));
    
    vorpal
      .command('collection acl group modify <collection-id> <name>')
      .option('-a --add-agent <agent>', 'Agent to add to group')
      .option('-r --remove-agent <agent>', 'Agent to remove from group')
      .description('Modify a groups agents.')
      .action(args => this.modifyGroup(args));

    vorpal
      .command('collection acl group remove <collection-id> <name>')
      .description('Remove group and all group access to collection.')
      .action(args => this.removeGroup(args));
    
    vorpal
      .command('collection acl show <collection-id>')
      .description('Show all agent access to collection.')
      .action(args => this.showAccess(args));
  }

  async create(args) {
    let options = {
      id : args.id
    }
    
    let content = '';
    if( args.metadata ) {
      if( fs.existsSync(args.metadata) ) {
        options.file = args.metadata;
      } else {
        options.content = args.metadata;
      }
    }

    let response = await api.collection.create(options);
    if( response.error ) {
      return Logger.log(response.error.message);
    }

    Logger.log(`New collection created at: ${response.data.path}`);
  }

  async delete(args) {
    let id = args.id;

    if( !args.options.force ) {
      let resp = await inquirer.prompt([{
          type: 'test',
          name: 'answer',
          message: `Are you sure you want to permanently delete collection ${args.id} [Y/n]:`
      }]);

      if( resp.answer !== 'Y' ) return;
    }

    let response = await api.collection.delete({
      id : args.id
    });
    if( response.error ) {
      return Logger.log(response.error.message);
    }

    Logger.log(`Collection ${args.id} deleted`);
  }

  async createRelationContainer(args) {
    let response = await api.collection.createRelationContainer({
      id: args.id,
      collectionId : args['collection-id'],
      membershipResource : args.options['membership-resource'],
      fsPath : args.options.metadata,
      type : args.options.type,
      hasMemberRelations : args.options['has-member-relation'],
      isMemberOfRelation : args.options['is-member-of-relation']
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }
    Logger.log(`Direct container ${args.id} added to collection ${args['collection-id']}`);
  }

  async createRelationProperties(args) {
    let response = await api.collection.createRelationProperties({
      collectionId : args['collection-id'],
      dstPath : args['dst-path'],
      srcPath : args['src-path'],
      dstProperty : args['dst-property'],
      srcProperty : args['src-property']
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }
    Logger.log(`Properties relation created for collection ${args['collection-id']}`);
  }
 
  async addResource(args) {
    let idParts = (args.id || 'binary').split('/');
    let id = idParts.pop();
    let parentPath = idParts.join('/');

    let fileInfo = path.parse(args.file);

    let response = await api.collection.addResource({
      id, parentPath,
      collectionId : args['collection-id'],
      fsPath : fileInfo.dir || '.',
      data : fileInfo.base,
      metadata : args.options.metadata 
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }

    if( args.options.type ) {
      if( !Array.isArray(args.options.type) ) {
        args.options.type = [args.options.type];
      }

      let insert = {
        '@type' : args.options.type.map(type => {
          return type.match(/^http:/) ? type : 'http://schema.org/'+type
        })
      }

      let newPath = response.data;
      response.appendResponse(await api.head({
        path : response.data
      }));
      if( !api.isRdfContainer(response.last) ) {
        newPath = newPath + '/fcr:metadata'
      }

      response.appendResponse(await api.jsonld.patch({
        path : newPath,
        insert
      }));
    }

    Logger.log(`Item ${args.id} added to collection ${args['collection-id']}`);
  }

  async deleteResource(args) {
    let response = await api.collection.deleteResource({
      id : args.id,
      collectionId : args['collection-id']
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }
    Logger.logHttpStack(response);
  }

  async addUserAccess(args) {
    args.path = this._getCollectionPath(args['collection-id']);
    await acl.add(args);
  }

  async addGroup(args) {
    // first create group
    args.path = this._getCollectionPath(args['collection-id'])+'/groups';

    // check if path exists
    var response = await api.head({path: args.path+'/'+args.name});
    if( response.checkStatus(200) ) {
      return Logger.log(`Group '${args.name}' already exists`);
    }

    if( !response.checkStatus(404) ) {
      return Logger.logHttpStack(response);
    } 

    await acl.addGroup(args);

    // now add group to acl
    args.agent = args.path+'/'+args.name;
    args.options.group = true;
    args.path = this._getCollectionPath(args['collection-id']);
    await acl.add(args)
  }

  async removeGroup(args) {
    let groupPath = this._getCollectionPath(args['collection-id'])+'/groups/'+args.name;
    let response = await api.delete({
      path : groupPath,
      permanent : true
    });
    
    args.agent = groupPath;
    response.appendResponse(await this.removeAgentAccess(args));
    if( response.error ) {
      return Logger.log(response.error.message);
    }
    Logger.logHttpStack(response);
  }

  async removeAgentAccess(args) {
    let response = await api.acl.get({path: this._getCollectionPath(args['collection-id'])});
    if( response.error ) {
      return Logger.log(response.error.message);
    }

    let aclPaths = response.data;
    let removePaths = [];

    if( args.agent === 'PUBLIC' || args.agent === 'PUBLIC_AGENT' ) {
      args.agent = api.acl.PUBLIC_AGENT;
    } else if( args.agent.match(/^\//) ) {
      args.agent = api.getBaseUrl({}) + args.agent;
    }

    for( var i = 0; i < aclPaths.length; i++ ) {
      let aclPath = aclPaths[i];
      response.appendResponse(await api.acl.allACLAuthorizations({path: aclPath}));

      for( var path in response.data ) {
        for( var authPath in response.data[path].authorizations ) {
          if( response.data[path].authorizations[authPath][args.agent] ) {
            removePaths.push(authPath);
          }
        }
      }
    }

    for( var i = 0; i < removePaths.length; i++ ) {
      response.appendResponse(await api.delete({
        path : removePaths[i],
        permanent : true
      }));

      if( response.checkStatus(204) ) {
        Logger.log('Removed: '+removePaths[i]);
      } else {
        Logger.log('Failed to Remove: '+removePaths[i], response.last.statusCode, response.last.body);
      }
    }
  }

  async modifyGroup(args) {
    args.path = this._getCollectionPath(args['collection-id']) + '/groups/' + args.name;
    await acl.modifyGroup(args);
  }

  async showAccess(args) {
    args.path = this._getCollectionPath(args['collection-id']);
    args.options.verbose = true;
    await acl.show(args);
  }

  _getCollectionPath(id) {
    return '/' + api.collection.COLLECTION_ROOT_PATH + '/' + id;
  }

}

module.exports = new CollectionCli();