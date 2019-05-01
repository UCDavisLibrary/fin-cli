const api = require('@ucd-lib/fin-node-api');

const path = require('path');
const location = require('../lib/location');
const debug = require('../lib/debug');

class FileIOCli {

  init(vorpal) {
    debug.wrapOpts(vorpal
      .command('io import <collection-id> <root-fs-path> ')
      .option('-n --nested-fc-path <path>', 'Partial update starting at provided nested path')
      .option('-i --ignore-steps <POST|DELETE>', 'Comma separate. POST: Don\'t POST container files, just re-PUT metadata (.ttl), '+
      'DELETE: Don\'t DELETE container files, skips check to remove fc containers that do not exist on disk')
      .description('Import a collection from Fin filesystem representation')
      .action(args => this.import(args)))

    vorpal
      .command('io export <collection-id> [fs-path]')
      .option('-n --clean', 'Completely remove directory if it exists before starting export')
      .option('-i --ignore-binary', 'Ignore binary files, metadata only export')
      .description('Export collection to Fin filesystem representation')
      .action(args => this.export(args));
  }

  async import(args) {
    let rootPath = location.makeAbsolutePath(args['root-fs-path'] || '.');
    let nestedPath = args.options['nested-fc-path'] || '';

    let ignorePost = false;
    let ignoreRemoval = false;

    (args.options['ignore-steps'] || '')
      .split(',')  
      .forEach(step => {
        if( step.toLowerCase().trim() === 'delete' ) ignoreRemoval = true;
        if( step.toLowerCase().trim() === 'post' ) ignorePost = true;
      });

    await api.io.import.run({
      collectionName: args['collection-id'], 
      fsPath : rootPath, 
      fcPath : nestedPath,
      ignorePost,
      ignoreRemoval
    });
  }

  async export(args) {
    let dir = location.makeAbsolutePath(args['fs-path'] || '.');

    let cleanDir = args.options['clean'] || false;
    let ignoreBinary = args.options['ignore-binary'] || false;

    await api.io.export.run({
      collectionName: args['collection-id'], 
      fsRoot: dir,
      cleanDir, ignoreBinary
    });
  }

}

module.exports = new FileIOCli();