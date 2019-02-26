const api = require('@ucd-lib/fin-node-api');

const path = require('path');
const location = require('../lib/location');
const debug = require('../lib/debug');

class FileIOCli {

  init(vorpal) {
    debug.wrapOpts(vorpal
      .command('io import <collection-id> <root-fs-path> ')
      .option('-n --nested-fc-path [path]', 'Partial update starting at provided nested path')
      .description('Import a collection from Fin filesystem representation')
      .action(args => this.import(args)));

    vorpal
      .command('io export <collection-id> [fs-path]')
      .description('Export collection to Fin filesystem representation')
      .action(args => this.export(args));
  }

  async import(args) {
    let rootPath = location.makeAbsolutePath(args['root-fs-path'] || '.');
    let nestedPath = args.options['nested-fc-path'] || '';

    await api.io.import.run(args['collection-id'], rootPath, nestedPath);
  }

  async export(args) {
    let dir = location.makeAbsolutePath(args['fs-path'] || '.');
    await api.io.export.run(args['collection-id'], dir);
  }

}

module.exports = new FileIOCli();