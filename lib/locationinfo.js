const contentDisposition = require('content-disposition');
const api = require('@ucd-lib/fin-node-api');
const pathutils = require('./pathutils');

class LocationInfo {

  constructor() {
    this.TYPES = {
      DATA_FILE : 'DATA_FILE',
      CONTAINER : 'CONTAINER'
    }
  }

  async parse(path) {
    path = pathutils.makeAbsoluteFcPath(path);
    var {response, body} = await api.head({path});

    var link = response.headers['link'];
    if( link ) link = api.parseLinkHeader(link);
    else link = {};

    if( response.headers['content-disposition'] ) {
      return {
        status : response.statusCode,
        type : this.TYPES.DATA_FILE,
        file : contentDisposition.parse(response.headers['content-disposition']),
        link : link
      }
    }

    return {
      status : response.statusCode,
      type : this.TYPES.CONTAINER,
      link : link
    }
  }
}

module.exports = new LocationInfo();