const ModelBase = require('./ModelBase');
const pathutils = require('../pathutils');
const store = require('../stores/LocationStore');
const config = require('../models/ConfigModel');
const api = require('@ucd-lib/fin-node-api');

class LocationModel extends ModelBase {

  constructor() {
    super();
    this.store = store;
    this.registerIOC('LocationModel');
  }

  cwd() {
    return this.store.getCwd();
  }

  async ls(args = {}) {
    var lspath = pathutils.makeAbsoluteFcPath(args.fedora_path || '.');
    var fileinfo = await this.models.ContainerModel.locationInfo(lspath);

    // if this is a file, quit out
    if( fileinfo.type === this.models.ContainerModel.TYPES.DATA_FILE ) {
      return {
        error : true,
        message : `location ${lspath} is a binary file`
      };
    }

    var {response, body} = await api.get({
      path : lspath,
      headers : {
        Accept : api.RDF_FORMATS.JSON_LD
      }
    });

    if( !api.isSuccess(response) ) {
      return {
        error : true,
        message : 'Invalid directory: '+lspath,
        response
      }
    }

    var body;
    try {
      body = JSON.parse(body)[0];
    } catch(e) {
      return {
        error : true,
        message : 'Invalid body response from server',
        response
      }
    }

    if( body['http://www.w3.org/ns/ldp#contains'] ) {
      var re = new RegExp(config.host+config.basePath+lspath+'/?');
      var contains = body['http://www.w3.org/ns/ldp#contains']
                          .map(item => {
                            return item['@id'].replace(re, '');
                          })

      return contains;
    } else {
      return [];
    }
  }

  async cd(args) {
    var original = this.store.getCwd();
    var newdir = pathutils.makeAbsoluteFcPath(args.fedora_path+'');

    var {response, body} = await api.head({path : newdir});

    if( !api.isSuccess(response) ) {
      return {
        error : true,
        message : `Invalid directory: ${newdir}`,
        response
      }
    }

    this.store.setCwd(newdir);
    // Not sure this is the best method for this
    config.cwd=newdir;

    return {
      success : true,
      response, body
    }
  }

}

module.exports = new LocationModel();
