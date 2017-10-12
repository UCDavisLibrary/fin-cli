const path = require('path');
const api = require('../api');
const config = require('../config');
const logger = require('./logger');
const pathutils = require('../pathutils');

class InteractiveLocation {

  constructor() {
    this.cwd = '/';
    pathutils.init(this);
  }

  init(vorpal, container) {
    this.container = container;
    this.vorpal = vorpal;

    var self = this;
    vorpal.command('pwd').action(this.pwd.bind(this));
    vorpal.command('ls [dir]').action(this.ls.bind(this))
          

    vorpal.command('cd <dir>')
          .action(function(args){ 
            return self.cd(args, this)
          })
          .autocomplete({
            data: this.cdAutoComplete.bind(this)
          });
  }

  pwd(args, callback) {
    logger.log(this.cwd);
    callback();
  }

  async ls(args) {
    var lspath = args.dir || this.cwd;
    var fileinfo = await this.container.locationInfo(lspath);
    
    // if this is a file, quit out
    if( fileinfo.type === this.container.TYPES.DATA_FILE ) {
      if( args.data ) return [];
      return logger.error(`location ${lspath} is a binary file`);
    }

    var {response, body} = await api.get({
      path : lspath,
      headers : {
        Accept : api.RDF_FORMATS.JSON_LD
      }
    });
    
    if( response.statusCode === 200 ) {
      try {
        var body = JSON.parse(body)[0];
      } catch(e) {
        logger.error(`Invalid response from server: \n===${body}\n===\n`, response);
        return;
      }

      if(  body['http://www.w3.org/ns/ldp#contains'] ) {
        var re = new RegExp(config.host+config.basePath+lspath+'/?');
        var contains = body['http://www.w3.org/ns/ldp#contains']
                            .map(item => {
                              return item['@id'].replace(re, '');
                            })
        
        if( args.data ) return contains;
        logger.log(contains.join(' '));
      } else {
        if( args.data ) return [];
        console.log('No Children: '+lspath);
      }
    } else {
      if( args.data ) return [];
      logger.error('Invalid directory: '+lspath, response);
    }
  }

  async cdAutoComplete(input) {
    var ls = await this.ls({data: true});
    var matches = [];

    var re = new RegExp('^'+input);
    ls.forEach(dir => {
      if( dir.match(re) ) matches.push(dir);
    });

    return matches;
  }

  // async cdAutoComplete(input) {
  //   var orginput = input;
  //   if( !input.match(/^\//) ) {
  //     input = path.resolve(this.cwd, input);
  //   }

  //   var pathinfo = path.parse(input);

  //   var queriedPath = pathinfo.dir;
  //   var ls = await this.ls({data: true, path: queriedPath});
  //   var matches = [];

  //   if( ls.length === 0 ) {
  //     queriedPath = path.join(pathinfo.dir, pathinfo.base);
  //     ls = await this.ls({data: true, path: queriedPath});
  //   }
  //   ls = ls.map(item => path.join(queriedPath, item));

  //   var re = new RegExp('^'+path.join(pathinfo.dir, pathinfo.base));
  //   var replace = new RegExp('.*'+input);
  //   ls.forEach(dir => {
  //     if( dir.match(re) ) matches.push(dir.replace(replace, orginput));
  //   });

  //   return matches;
  // }

  async cd(args, command) {
    var original = this.cwd;

    this.cwd = pathutils.makeAbsoluteFcPath(args.dir+'');

    var {response, body} = await api.head({path : this.cwd});

    if( response.statusCode !== 200 ) {
       logger.error(`Invalid directory: ${this.cwd}`, response);
       this.cwd = original;
    }

  }


}

module.exports = new InteractiveLocation();