const api = require('@ucd-lib/fin-node-api');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const fs = require('fs-extra');

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
      .command('collection add-member <collection-id> <file> [id]')
      .description('Add a member to a collection.  File should be a file path.')
      .option('-m --metadata', 'Path to metadata file.  If not given [file].ttl will be checked and used if it exists')
      .action(args => this.addMember(args));

    vorpal
      .command('collection delete-member <collection-id> <id>')
      .description('Delete a member of a collection.')
      .action(args => this.deleteMember(args));
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
}

module.exports = new CollectionCli();