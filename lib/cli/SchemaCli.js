const path = require('path');
const fs = require('fs');
const schema = require('../models/SchemaModel');
const Logger = require('../lib/logger');
const config = require('../lib/config');
const {URL} = require('url');

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var SCHEMA_CACHE_PATH = path.join(getUserHome(), '.fccli-schemacache');

class SchemaCli {

  constructor() {
    if( !fs.existsSync(SCHEMA_CACHE_PATH) ) {
      fs.writeFileSync(SCHEMA_CACHE_PATH, '{}');
    }
  }

  get cache() {
    if( !this._cache ) {
      this._cache = JSON.parse(fs.readFileSync(SCHEMA_CACHE_PATH, 'utf-8'));
    }
    return this._cache;
  }
  set cache(cache) {
    fs.writeFileSync(SCHEMA_CACHE_PATH, JSON.stringify(cache));
    this._cache = cache;
  }

  init(vorpal) {
    this.vorpal = vorpal;

    vorpal.command('schema <url>')
          .option('-l, --list', 'List properties for schema')
          .action(this.show.bind(this))
          .autocomplete(this.showAutoComplete.bind(this))
  }

  async get(url) {
    var urlSchema = await schema.parseSchema(url);
    this._cache[url] = urlSchema;
    this.cache = Object.assign({}, this._cache);
    return urlSchema;
  }

  async show(args) {
    var {url, property} = this._splitProperty(args.url);

    var urlSchema;
    if( this.cache[url] ) {
      urlSchema = this.cache[url];
    } else {
      urlSchema = await this.get(url);
    }

    if( urlSchema.error ) {
      Logger.log(urlSchema);
      return;
    }

    var display = [];
    urlSchema = urlSchema.schema;

    if( args.options.list ) {
      return Logger.log(Object.keys(urlSchema).join(' '));
    }

    if( property ) {
      if( !urlSchema[property] ) {
        return Logger.log(`Schema: ${url} has no property: ${property}`);
      }

      var info = this._showPropertyHelper(property, urlSchema[property]);
      display.push(info.join('\n'));
    } else {
      for( var key in urlSchema ) {
        var info = this._showPropertyHelper(key, urlSchema[key]);
        display.push(info.join('\n'));
      }
    }

    Logger.log(display.join('\n'));
  }

  async showAutoComplete(input) {
    var {url, property, prefix} = this._splitProperty(input);

    var matches = [];

    // url search
    if( property === null ) {
      var re = new RegExp(url, 'i');
      for( var key in config.basePrefix ) {
        if( re.test(key) ) matches.push(key.replace(/.*\//, ''));
        if( re.test(config.basePrefix[key]) ) matches.push(config.basePrefix[key].replace(/.*\//, ''));
      }
      for( var key in this.cache ) {
        if( re.test(key) && matches.indexOf(key) === -1 ) {
          matches.push(key.replace(/.*\//, ''));
        }
      }
    } else {  
      var urlSchema;
      if( this.cache[url] ) {
        urlSchema = this.cache[url];
      } else {
        urlSchema = await this.get(url);
      }

      if( urlSchema.error ) {
        return [];
      }

      var re = new RegExp(property || '.*', 'i');

      for( var key in urlSchema.schema ) {
        if( re.test(key) ) {
          if( prefix ) matches.push(prefix+':'+key);
          // hack for vorpal bug: https://github.com/dthree/vorpal/issues/124
          else matches.push((url+key).replace(/.*\//, ''));
        }
      }
    }

    return matches;
  }

  _splitProperty(url) {
    var property = null;

    if( !url.match(/^http/) ) {
      if( url.indexOf(':') > -1 ) {
        var parts = url.split(':');
        url = parts[0];
        property = parts[1];
      }

      if( config.basePrefix[url] ) {
        var fullurl = config.basePrefix[url];
        return {url: fullurl, property, prefix: url};
      } else {
        return {url, property, prefix: url};
      }
    }

    if( !url.match(/(\/|#)$/) ) {
      var urlInfo = new URL(url);
      if( urlInfo.hash ) {
        property = urlInfo.hash.replace(/#/, '');
        url = urlInfo.protocol+'//'+urlInfo.host+urlInfo.pathname+'#';
      } else {
        var urlpath = urlInfo.pathname.split('/');
        property = urlpath.pop();
        url = urlInfo.protocol+'//'+urlInfo.host+urlpath.join('/')+'/';
      }
    }

    return {url, property};
  }

  _showPropertyHelper(key, obj) {
    var info = [key+':'];
    for( var attr in obj ) {
      if( Array.isArray(obj[attr]) ) {
        if( obj[attr].length > 0 ) {
          info.push(`  - ${attr}: ${obj[attr].join('\n')}`);
        }
      } else if( obj[attr] ) {
        info.push(`  - ${attr}: ${obj[attr]}`);
      }
    }
    return info;
  }




}



module.exports = new SchemaCli();