const api = require('@ucd-lib/fin-node-api');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const fs = require('fs-extra');
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
      .command('collection member add <collection-id> <file> [id]')
      .description('Add a member to a collection.  File should be a file path.')
      .option('-m --metadata', 'Path to metadata file.  If not given [file].ttl will be checked and used if it exists')
      .action(args => this.addMember(args));

    vorpal
      .command('collection member delete <collection-id> <id>')
      .description('Delete a member of a collection.')
      .action(args => this.deleteMember(args));

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
    let id = args.id;
    
    let content = '';
    if( args.metadata ) {
      if( fs.existsSync(args.metadata) ) {
        content = await fs.readFile(args.metadata, 'utf-8');
      } else {
        content = args.metadata;
      }
    }

    let response = await api.collection.create({
      id, content
    });

    Logger.log(`New collection created at: ${response.path}`);
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

    Logger.log(`Collection ${args.id} deleted`);
  }

  async addMember(args) {
    let response = await api.collection.addMember({
      id : args.id,
      collectionId : args['collection-id'],
      file : args.file,
      metadataFile : args.options.metadata 
    });

    Logger.log(response.statusCode, response.body);
  }

  async deleteMember(args) {
    let {response} = await api.collection.deleteMember({
      id : args.id,
      collectionId : args['collection-id']
    });

    Logger.log(response.statusCode, response.body);
  }

  async addUserAccess(args) {
    args.path = this._getCollectionPath(args['collection-id']);
    await acl.add(args);
  }

  async addGroup(args) {
    // first create group
    args.path = this._getCollectionPath(args['collection-id'])+'/groups';
    await acl.addGroup(args);

    // now add group to acl
    args.agent = args.name;
    args.options.group = true;
    args.path = this._getCollectionPath(args['collection-id']);
    await acl.add(args);
  }

  async removeGroup(args) {
    let groupPath = this._getCollectionPath(args['collection-id'])+'/groups/'+args.name;
    await api.delete({
      path : groupPath,
      permanent : true
    })

    args.agent = args.name;
    await this.removeAgentAccess(args);
  }

  async removeAgentAccess(args) {
    let aclPaths = await api.acl.get({path: this._getCollectionPath(args['collection-id'])});
    let removePaths = [];

    for( var i = 0; i < aclPaths.length; i++ ) {
      let aclPath = aclPaths[i];
      let response = await api.acl.allACLAuthorizations({path: aclPath});

      for( var path in response ) {
        for( var authPath in response[path].authorizations ) {
          if( response[path].authorizations[authPath][args.agent] ) {
            removePaths.push(authPath);
          }
        }
      }
    }

    for( var i = 0; i < removePaths.length; i++ ) {
      await api.delete({
        path : removePaths[i],
        permanent : true
      });
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