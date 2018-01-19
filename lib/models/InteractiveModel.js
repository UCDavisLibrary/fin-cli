const ModelBase = require('./ModelBase');
const api = require('@ucd-lib/fin-node-api');
const config = require('../lib/config');
const turtleParser = require('../lib/turtle');

const CONTAINS = 'http://www.w3.org/ns/ldp#contains';

class InteractiveModel extends ModelBase {

  constructor() {
    super();
    this.registerIOC('InteractiveModel');
  }


  async update(args, newrdf, oldrdf) {
    var sparql = await this._turtleToSparqlUpdate(newrdf, oldrdf);
    
    return await api.patch({
      path : args.fedora_path,
      headers : {
        'Content-Type' : api.RDF_FORMATS.SPARQL_UPDATE
      },
      partial : true,
      content : sparql
    });
  }

  async createFromRdf(args, rdf) {
    return await api.put({
      headers : {
        'Content-Type' : api.RDF_FORMATS.TURTLE
      },
      path : args.fedora_path,
      content : rdf
    });
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
        if( del.triples[i].predicate === CONTAINS ) {
          del.triples.splice(i, 1);
        }
      }
      deletes = del.triples.map(this._genericTripleToSparqlUpdate).join('\n');
    }

    for( var i = add.triples.length-1; i >= 0; i-- ) {
      if( add.triples[i].predicate === CONTAINS ) {
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

  _genericTripleToSparqlUpdate(triple) {
    if( triple.object.match(/^http/i) ) {
      return `<> <${triple.predicate}> <${triple.object}> .`;
    }
    return `<> <${triple.predicate}> ${triple.object.replace(/\^\^.*/, '')} .`;
  }

}

module.exports = new InteractiveModel();