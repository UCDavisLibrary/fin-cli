const api = require('@ucd-lib/fin-node-api');
const inquirer = require('inquirer');
const Logger = require('../lib/logger');
const fs = require('fs-extra');
const path = require('path');
const acl = require('./AclCli');
const debug = require('../lib/debug');

class CollectionCli {

  init(vorpal) {
    debug.wrapOpts(vorpal
      .command('application create <name>')
      .description('Create a application.  Metadata should be a path to a file or '+
                  'string content, either way metadata should be in turtle format.')
      .action(args => this.create(args)));

    debug.wrapOpts(vorpal
      .command('application add-featured <name> <path>')
      .option('-t --type <label>', 'image or collection')
      .option('-i --image <path>', 'local filesystem path to image')
      .option('-l --label <name>', 'short label for featured resource')
      .option('-d --description <description>', 'description for featured resource')
      .description('Create a collection.  Metadata should be a path to a file or '+
                  'string content, either way metadata should be in turtle format.')
      .action(args => this.addFeatured(args)));
  }

  async create(args) {
    let response = await api.application.create({id: args.name});

    if( response.error ) {
      return Logger.error(response.error.message);
    }

    Logger.log(`New collection created at: ${response.data.path}`);
    debug.handle('collection create', response, args);
  }

  async addFeatured(args) {
    if( !args.options.type ) {
      return Logger.error('A resource type of image or collection is required');
    }

    // if no image given, we are just adding a link to a path
    if( !args.options.image ) {
      if( args.options.label || args.options.description ) {
        return Logger.error('label and description options are only permitted with a custom image');
      }

      let response = await api.jsonld.patch({
        path : this._getApplicationPath(args.name),
        insert : {
          [this.getFeaturedType(args)] : [{
            '@id' : api.getConfig().host+api.getConfig().fcBasePath+args.path
          }]
        }
      });

      Logger.log(response.last.statusCode, response.last.body);
      return;
    }

    let fileInfo = path.parse(args.options.image);
    let slug = fileInfo.base.replace(/ /g, '-');
    let response = await api.postEnsureSlug({
      path : this._getApplicationPath(args.name),
      slug,
      file : args.options.image
    });

    if( response.error ) Logger.log('POST file', response.error.message);
    else Logger.log('POST file', response.last.statusCode, response.last.body);

    let metadata = {
      '@type' : api.application.TYPES.FEATURED_CONTAINER,
      'http://schema.org/associatedMedia' : {'@id' : api.getConfig().host+api.getConfig().fcBasePath+args.path}
    }
    if( args.options.label ) {
      metadata['http://schema.org/label'] = args.options.label;
    };
    if( args.options.description ) {
      metadata['http://schema.org/description'] = args.options.description
    };

    response = await api.jsonld.patch({
      path : this._getApplicationPath(args.name)+'/'+slug+'/fcr:metadata',
      insert : metadata
    });

    if( response.error ) Logger.log('POST file', response.error.message);
    else Logger.log('PATCH file metdata', response.last.statusCode, response.last.body);

    response = await api.jsonld.patch({
      path : this._getApplicationPath(args.name),
      insert : {
        [this.getFeaturedType(args)] : [{
          '@id' : api.getConfig().host+api.getConfig().fcBasePath+this._getApplicationPath(args.name)+'/'+slug
        }]
      }
    });

    if( response.error ) Logger.log('POST file', response.error.message);
    else Logger.log('PATCH application metdata', response.last.statusCode, response.last.body);
  }

  getFeaturedType(args) {
    if( args.options.type.toLowerCase() === 'collection' ) {
      return api.application.TYPES.FEATURED_COLLECTION
    } else if( args.options.type.toLowerCase() === 'image' ) {
      return api.application.TYPES.FEATURED_IMAGE
    }
    return null;
  }

  _getApplicationPath(id) {
    return '/' + api.application.ROOT_SLUG + '/' + id;
  }
  
}

module.exports = new CollectionCli();