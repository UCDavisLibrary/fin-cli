const path = require('path');
const fs = require('fs');
const schema = require('../schema');
const Logger = require('./logger');

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var SCHEMA_CACHE_PATH = path.join(getUserHome(), '.fccli-schemacache');

class InteractiveSchema {

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

    vorpal.command('schema <url> [property]').action(this.show.bind(this));
  }

  async get(url) {
    var urlSchema = await schema.parseSchema(url);
    this._cache[url] = urlSchema;
    this.cache = Object.assign({}, this._cache);
    return urlSchema;
  }

  async show(args) {
    if( !args.url.match(/^http/) ) {

    }

    var urlSchema;
    if( this.cache[args.url] ) {
      urlSchema = this.cache[args.url];
    } else {
      urlSchema = await this.get(args.url);
    }

    if( urlSchema.error ) {
      Logger.log(urlSchema);
      return;
    }

    var display = [];
    urlSchema = urlSchema.schema;

    if( args.property ) {
      if( !urlSchema[args.property] ) {
        return Logger.log(`Schema: ${args.url} has no property: ${args.property}`);
      }

      var info = this._showPropertyHelper(args.property, urlSchema[args.property]);
      display.push(info.join('\n'));
    } else {
      for( var key in urlSchema ) {
        var info = this._showPropertyHelper(key, urlSchema[key]);
        display.push(info.join('\n'));
      }
    }

    Logger.log(display.join('\n'));
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



module.exports = new InteractiveSchema();