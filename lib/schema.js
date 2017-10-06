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

// var test = `
// @prefix premis:  <http://www.loc.gov/premis/rdf/v1#> .
// @prefix test:  <info:fedora/test/> .
// @prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
// @prefix ns002:  <http://www.w3.org/ns/auth/acl#> .
// @prefix ns001:  <http://fedora.info/definitions/v4/webac#> .
// @prefix xsi:  <http://www.w3.org/2001/XMLSchema-instance> .
// @prefix xmlns:  <http://www.w3.org/2000/xmlns/> .
// @prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
// @prefix fedora:  <http://fedora.info/definitions/v4/repository#> .
// @prefix xml:  <http://www.w3.org/XML/1998/namespace> .
// @prefix ebucore:  <http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#> .
// @prefix ldp:  <http://www.w3.org/ns/ldp#> .
// @prefix xs:  <http://www.w3.org/2001/XMLSchema> .
// @prefix fedoraconfig:  <http://fedora.info/definitions/v4/config#> .
// @prefix foaf:  <http://xmlns.com/foaf/0.1/> .
// @prefix authz:  <http://fedora.info/definitions/v4/authorization#> .
// @prefix dc:  <http://purl.org/dc/elements/1.1/> .

// <http://localhost:3000/fcrepo/rest/>
//         fedora:lastModified            "2017-10-05T21:20:45.179Z"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;
//         rdf:type                       ldp:RDFSource ;
//         rdf:type                       ldp:Container ;
//         rdf:type                       ldp:BasicContainer ;
//         fedora:writable                "true"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
//         rdf:type                       fedora:RepositoryRoot ;
//         rdf:type                       fedora:Resource ;
//         rdf:type                       fedora:Container ;
//         ldp:contains                   <http://localhost:3000/fcrepo/rest/acl> ;
//         ldp:contains                   <http://localhost:3000/fcrepo/rest/foo> ;
//         fedora:hasTransactionProvider  <http://localhost:3000/fcrepo/rest/fcr:tx> .
// `;

// var sp = new SchemaParser();
// sp.parseTurtleHeader(test)
//   .then(schemas => console.log(schemas['http://purl.org/dc/elements/1.1/'].schema));


// (async function() {
//   // await call('http://fedora.info/definitions/v4/repository');

//   // call('http://www.loc.gov/premis/rdf/v1')
//   // call('http://www.w3.org/2000/01/rdf-schema')
//   // call('http://www.w3.org/ns/auth/acl')
//   // call('http://fedora.info/definitions/v4/webac')
//   // call('http://www.w3.org/2001/XMLSchema-instance')
//   // call('http://www.w3.org/2000/xmlns/')
//   // call('http://www.w3.org/1999/02/22-rdf-syntax-ns')
//   // call('http://fedora.info/definitions/v4/repository')
//   // call('http://www.w3.org/XML/1998/namespace')
//   // await call('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore')
//   // call('http://www.w3.org/ns/ldp')
//   // call('http://www.w3.org/2001/XMLSchema')
//   // call('http://fedora.info/definitions/v4/config')
//   // call('http://xmlns.com/foaf/0.1/')
//   // call('http://fedora.info/definitions/v4/authorization')
//   call('http://purl.org/dc/elements/1.1/')
// })();