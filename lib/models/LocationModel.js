const ModelBase = require('./ModelBase');
const pathutils = require('../pathutils');
const store = require('../stores/LocationStore');
const config = require('../models/ConfigModel');
const api = require('../api');

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

  isa({ response, type }) {
    let link=response.headers['link'];
    if (! link ) {
      return false;
    }
    let links=link.split(/,\s*/).filter(l => l.match(`<${type}>;\s*rel="type"`) );
    return (links[0]) ? true : false;
  }

  async head({fedora_path}) {
    var newdir = pathutils.makeAbsoluteFcPath(fedora_path+'');

    var {response, body} = await api.head({path : newdir});

    if( !api.isSuccess(response) ) {
      return {
        error : true,
        message : `Invalid directory: ${newdir}`,
        response
      }
    }

    return {
      success : true,
      response, body
    }
  }

  async cd({fedora_path,options}) {
    var original = this.store.getCwd();
    var newdir = pathutils.makeAbsoluteFcPath(fedora_path+'');

    let type = options.type || 'http://www.w3.org/ns/ldp#Container';
    let into = options.type || 'http://www.w3.org/ns/ldp#contains';

    let {error, response, body } = await this.head({fedora_path});
    if ( error ) return {error,response,body};

    if ( ! this.isa({response,type}) ) {
      return {
        error: true,
        message : `Not an ${type}: ${newdir}`,
        response
      }
    }
    this.store.setCwd(newdir);

    return {
      success : true,
      response, body
    }
  }

}

module.exports = new LocationModel();
