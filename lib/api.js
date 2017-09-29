const request = require('./request');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const config = require('./config');

class FedoraApi {

  constructor() {
    this.transaction = '';

    this.RDF_FORMATS = {
      JSON_LD : 'application/ld+json',
      N_TRIPLES : 'application/n-triples',
      RDF_XML : 'application/rdf+xml',
      N3 : 'text/n3',
      PLAIN : 'text/plain',
      TURTLE : 'text/turtle'
    }

    this.FILE_EXTENSIONS = {
      '.json' : this.RDF_FORMATS.JSON_LD,
      '.nt' : this.RDF_FORMATS.N_TRIPLES,
      '.xml' : this.RDF_FORMATS.RDF_XML,
      '.n3' : this.RDF_FORMATS.N3,
      '.txt' : this.RDF_FORMATS.PLAIN,
      '.ttl' : this.RDF_FORMATS.TURTLE
    }
  }

  async _request(options) {
    return request(options);
  }

  _createBasePath(options) {
    return (options.basePath ? options.basePath : config.basePath) +
            (this.transaction ? '/'+this.transaction : '');
  }

  _createBaseUrl(options) {
    return (options.host ? options.host : config.host) + this._createBasePath(options);
  }

  _createUrl(options) {
    return this._createBaseUrl(options)+options.path;
  }

  _baseRequest(method, options) {
    return {
      method : method,
      headers : options.headers,
      uri : this._createUrl(options)
    }
  }

  _extensionHelper(options) {
    if( options.headers['Content-Type'] ) return;
    if( options.fileIsContent ) return;
    var info = path.parse(options.file);

    var knownContentType = this.FILE_EXTENSIONS[info.ext.toLowerCase()];
    if( knownContentType ) {
      options.isRdfType = true;
      options.headers['Content-Type'] = knownContentType;
    } else {
      options.isRdfType = false;
    }
  }

  _destinationHelper(options) {
    if( !options.headers ) options.headers = {};
    if( !options.headers.Destination && options.destination ) {
      options.headers.Destination = (options.host ? options.host : config.host)+options.destination;
    }
  }

  async _fileHelper(options) {
    if( options.fileIsContent ) return;
    if( !options.file ) throw new Error('File required');
    if( !options.headers ) options.headers = {};
    
    var pathinfo = path.parse(options.file);
    if( !pathinfo.root ) {
      options.file = path.resolve(process.cwd(), options.file);
    }

    // set content type if known and not already set
    this._extensionHelper(options);

    // set the checksum
    if( !options.isRdfType ) {
      var sha = await this._sha256(options.file);
      options.headers.digest = `sha256=${sha}`;
    }

    // see if we are auto slugging or not
    // var autoSlug = config.autoSlug;
    // if( options.autoSlug !== undefined ) autoSlug = options.autoSlug;
    // if( !autoSlug ) options.headers['Slug'] = options.path; 
    // console.log(options.path);

    // set the content disposition from file name or provided filename option
    if( !options.headers['Content-Disposition'] && !options.isRdfType ) {
      if( options.filename ) {
        options.headers['Content-Disposition'] = `attachment; filename="${options.filename}"`;
      } else {
        var info = path.parse(options.file);
        options.headers['Content-Disposition'] = `attachment; filename="${info.name}"`;
      }
    }
  }

  _sha256(file) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf-8', (err, data) => {
        if( err ) return reject(err);
        var hash = crypto.createHash('sha256');
        hash.update(data);
        resolve(hash.digest('hex'));
      });
    });
  }

  /**
   * Retrieve the content of the resource
   */
  async get(options) {
    var req = this._baseRequest('GET', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * Retrieve the content of the resource
   */
  async head(options) {
    var req = this._baseRequest('HEAD', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * Create new resources within a LDP container
   * 
   * @param {*} options 
   */
  async create(options) {
    await this._fileHelper(options);

    var req = this._baseRequest('POST', options);
    req.body = fs.createReadStream(options.file);

    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * Create a resource with a specified path, or replace the triples associated 
   * with a resource with the triples provided in the request body.
   * 
   * @param {*} options 
   */
  async update(options) {
    await this._fileHelper(options);

    var req = this._baseRequest('PUT', options);
    if( options.fileIsContent ) req.body = options.file;
    else req.body = fs.createReadStream(options.file);

    if( options.partial ) {
      req.headers.Prefer = 'handling=lenient; received="minimal"';
    }
    
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  async patch(options) {
    if( !options.headers ) options.headers = {};
    options.headers['Content-Type'] = 'application/sparql-update';

    var req = this._baseRequest('PATCH', options);
    
    if( options.fileIsContent ) req.body = options.file;
    else req.body = fs.createReadStream(options.file);

    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  /**
   * Delete a resource
   * 
   * @param {*} options 
   */
  async remove(options) {
    var req = this._baseRequest('DELETE', options);
    try {
      if( options.permanent ) {
        await this._request(req);
        req.uri = req.uri + '/fcr:tombstone';
        return await this._request(req);
      } else {
        return await this._request(req);
      } 
    } catch(e) {
      throw e;
    }
  }

  /**
   * Copy a resource (and its subtree) to a new location
   * 
   * @param {*} options 
   */
  async copy(options) {
    this._destinationHelper(options);
    var req = this._baseRequest('COPY', options);
    try {
      return await this._request(req);
    } catch(e) {
      throw e;
    }
  }

  async startTransation(options = {}) {
    options.path = '/fcr:tx';
    var req = this._baseRequest('POST', options);
    try {
      var {response, body} = await this._request(req);
      this.transaction = new URL(parresponse.headers.Location).pathname.split('/').pop();
    } catch(e) {
      throw e;
    }
  }

  async commitTransation(options = {}) {
    options.path = '/fcr:tx/fcr:commit';
    var req = this._baseRequest('POST', options);
    try {
      var {response, body} = await this._request(req);
      this.transaction = '';
      return {response, body};
    } catch(e) {
      throw e;
    }
  }

  async rollbackTransation(options = {}) {
    options.path = '/fcr:tx/fcr:rollback';
    var req = this._baseRequest('POST', options);
    try {
      var {response, body} = await this._request(req);
      this.transaction = '';
      return {response, body};
    } catch(e) {
      throw e;
    }
  }
}

module.exports = new FedoraApi();