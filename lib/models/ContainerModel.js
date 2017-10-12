const ModelBase = require('./ModelBase');
const api = require('../api');
const LocationStore = require('../stores/LocationStore');
const config = require('./ConfigModel');
const pathutils = require('../pathutils');
const turtleParser = require('../turtle');


class ContainerModel extends ModelBase {

  constructor() {
    super();
    this.registerIOC('ContainerModel');

    this.TYPES = {
      DATA_FILE : 'DATA_FILE',
      CONTAINER : 'CONTAINER'
    }
  }

  async locationInfo(path) {
    path = pathutils.makeAbsoluteFcPath(path);
    var {response, body} = await api.head({path});

    var link = response.headers['link'];
    if( link ) link = this._parseLinkHeader(link);
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

  async update(args, newrdf, oldrdf) {
    var sparql = await this._turtleToSparqlUpdate(newrdf, oldrdf);
    
    return await api.patch({
      path : args.fedora_path,
      headers : {
        'Content-Type' : api.RDF_FORMATS.SPARQL_UPDATE
      },
      fileIsContent : true,
      partial : true,
      file : sparql
    });
  }

  async createFromRdf(args, rdf) {
    return await api.update({
      headers : {
        'Content-Type' : api.RDF_FORMATS.TURTLE
      },
      path : args.fedora_path,
      fileIsContent : true,
      file : rdf
    });
  }

  async get(args) {
    return await api.get({
      path: pathutils.makeAbsoluteFcPath(args.fedora_path)
    });
  }

  async remove(args) {
    return await api.remove({
      path : pathutils.makeAbsoluteFcPath(args.fedora_path),
      permanent : true
    });
  }

  async info(args) {
    args.fedora_path = pathutils.makeAbsoluteFcPath(args.fedora_path || '.');
    var info = await this.locationInfo(args.fedora_path);

    var infoPath = LocationStore.getCwd();
    if( info.type === this.TYPES.DATA_FILE ) {
      infoPath = info.link.describedby[0].replace(config.host+config.basePath, '');
    }

    var {response, body} = await api.get({
      path : infoPath,
      headers : {
        Accept : api.RDF_FORMATS.TURTLE
      }
    });

    return {info, body, response}
  }

  async startTransaction() {
    return await api.startTransaction();
  }

  async commitTransaction() {
    return await api.commitTransaction();
  }

  async rollbackTransaction() {
    return await api.rollbackTransaction();
  }

  async _turtleToSparqlUpdate(newturtle, oldturtle) {
    var add = await turtleParser(newturtle);
    var del;
    if( oldturtle ) {
      del = await turtleParser(oldturtle);
    }

    var headers = [];
    for( var key in add.prefixes ) {
      headers.push(`PREFIX ${key}: <${add.prefixes[key]}>`);
    }
    for( var key in config.globalPrefix ) {
      if( add.prefixes[key] ) continue;
      headers.push(`PREFIX ${key}: <${config.globalPrefix[key]}>`);
    }
    headers = headers.join('\n');

    var deletes = '';
    if( del ) {
      for( var i = del.triples.length-1; i >= 0; i-- ) {
        if( del.triples[i].predicate === 'http://www.w3.org/ns/ldp#contains' ) {
          del.triples.splice(i, 1);
        }
      }
      deletes = del.triples.map(this._genericTripleToSparqlUpdate).join('\n');
    }

    for( var i = add.triples.length-1; i >= 0; i-- ) {
      if( add.triples[i].predicate === 'http://www.w3.org/ns/ldp#contains' ) {
        add.triples.splice(i, 1);
      }
    }
    var inserts = add.triples.map(this._genericTripleToSparqlUpdate).join('\n');

    return `${headers}
    
    DELETE {   
      ${deletes}
    }
    INSERT {   
      ${inserts}
    }
    
    WHERE { }
    `;
  }

  _parseLinkHeader(link) {
    var info = link.split(',')
                    .map(item => {
                      var parts = item.split(';');
                      var value = parts[0].replace(/(<|>)/g, '');
                      var is = parts[1].split('=')[1].replace(/"/g, '');
                      return {is: is, value: value.trim()};
                    });

    var result = {};
    info.forEach(item => {
      if( result[item.is] ) result[item.is].push(item.value);
      else result[item.is] = [item.value];
    });

    return result;
  }

  _genericTripleToSparqlUpdate(triple) {
    if( triple.object.match(/^http/i) ) {
      return `<> <${triple.predicate}> <${triple.object}> .`;
    }
    return `<> <${triple.predicate}> ${triple.object.replace(/\^\^.*/, '')} .`;
  }

}

module.exports = new ContainerModel();