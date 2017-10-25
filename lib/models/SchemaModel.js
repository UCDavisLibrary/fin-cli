var requestCallback = require('request');
var parseString = require('xml2js').parseString;
var DOMParser = require('xmldom').DOMParser;

process.on('unhandledRejection', e => console.error(e));

function parseXml(xmlString) {
  return new Promise((resolve, reject) => {
    var options = {
      errorHandler : {
        warning: function(w){},
        error: function() {},
        fatalError: function(e) {
          throw new Error(e);
        }
      }
    }

    var xmlStringSerialized = new DOMParser(options).parseFromString(xmlString, "text/xml");
    parseString(xmlStringSerialized, function (err, result) {
      if( err ) reject(err);
      else resolve(result);
    }); 
  });
}

function request(options) {
  return new Promise((resolve, reject) => {
    requestCallback(options,  (error, response, body) => {
      if( error ) return reject(error);
      resolve({response, body});
    });
  });
}

async function parse(url) {
  var options = {
    headers : {
      Accept : 'application/rdf+xml'
    },
    uri : url
  }

  try {
    var {response, body} = await request(options);
  } catch(e) {
    return {
      error : true,
      message : 'Unable to access resource: '+e.message,
      url : url
    };
  }

  if( response.statusCode !== 200 ) {
    return {
      error : true,
      message : 'Unable to access resource',
      url : url,
      statusCode : response.statusCode
    };
  }

  var result = await parseXml(body);

  if( !result['rdf:RDF'] ) {
    return {
      error : true,
      message : 'Not a RDF resource description',
      url : url
    };
  }

  var root = result['rdf:RDF'];

  var schema = {
    success : true,
    url : url,
    schema : {}
  }

  var sections = ['owl:ObjectProperty', 'owl:DatatypeProperty', 'rdf:Property', 'rdfs:Class',
                  'Class', 'rdf:Description'];
  
  sections.forEach(section => {
    if( !root[section] ) return;
    root[section].forEach(item => parseItem(item, section.replace(/.*:/, ''), schema.schema));
  });
  

  return schema;
}

function parseItem(item, is, schema) {
  var parsed = {
    is : is,
    key : getKey(item.$),
    comments : [],
    notes : [],
    type : '',
    range : '',
    subPropertyOf : '',
    subClassOf : ''
  }

  var resources = ['rdf:type', 'rdfs:range', 'rdfs:domain', 'range', 'domain'];
  resources.forEach(type => {
    if( item[type] && item[type].length > 0 ) {
      parsed[type.replace(/.*:/, '')] = getResourceSingleton(item[type])
    }
  });

  if( item['rdfs:subPropertyOf'] ) {
    parsed['subPropertyOf'] = getResourceSingleton(item['rdfs:subPropertyOf']);
  }

  if( item['rdfs:subClassOf'] ) {
    parsed['subClassOf'] = getResourceSingleton(item['rdfs:subClassOf']);
  }


  var commentTypes = ['rdfs:comment', 'comment'];
  commentTypes.forEach(type => {
    if( !item[type] ) return;
    item[type].forEach(comment => {
      parsed.comments.push(typeof comment === 'string' ? comment : comment._);
    });
  });
  if( item.$ && item.$['rdfs:comment'] ) {
    parsed.comments.push(item.$['rdfs:comment']);
  }

  var noteTypes = ['skos:scopeNote', 'skos:editorialNote'];
  noteTypes.forEach(type => {
    if( !item[type] ) return;
    item[type].forEach(note => parsed.notes.push(note._));
  });

  schema[parsed.key] = parsed;
}

function getResourceSingleton(item) {
  if( item && item.length > 0 ) {
    if( typeof item[0].$ === 'string' ) return item[0].$;

    if( item[0].$ && item[0].$['rdf:resource'] ) {
      return item[0].$['rdf:resource'];
    }
  }
  return '';
}

function getKey($) {
  if( $['rdf:about'] ) {
    if( $['rdf:about'].indexOf('#') > -1 ) {
      return $['rdf:about'].replace(/.*#/, '');
    } else {
      return $['rdf:about'].replace(/.*\//, '');
    }
  }
  if( $['rdf:ID'] ) return $['rdf:ID'];
  return ''
}

class SchemaParser {

  async parseSchema(url) {
    return await parse(url);
  }

  async parseTurtleHeader(turtle, cache) {
    var schemas = {};
    var lines = turtle.split('\n');

    for( var i = 0; i < lines.length; i++ ) {
      var line = lines[i];

      if( !line.trim().match(/^@prefix/) ) continue; 
      var url = line.replace(/(^.*<|>.*)/g, '');

      if( cache && cache[url] ) continue;

      schemas[url] = await parse(url);
    };

    return schemas;
  }
}

module.exports = new SchemaParser();