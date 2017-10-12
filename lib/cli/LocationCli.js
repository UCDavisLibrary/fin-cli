const Logger = require('./logger');
const model = require('../models/LocationModel');

class LocationCli {

  init(vorpal) {
    this.vorpal = vorpal;

    var self = this;
    vorpal.command('pwd').action(this.pwd.bind(this));
    vorpal.command('ls [fedora_path]').action(this.ls.bind(this))
          

    vorpal.command('cd <fedora_path>')
          .action(function(args){ 
            return self.cd(args, this)
          })
          .autocomplete({
            data: this.cdAutoComplete.bind(this)
          });
  }

  async pwd(args) {
    Logger.log(model.cwd());
  }

  async ls(args) {
    var result = await model.ls(args);

    if( result.error ) {
      return Logger.error(result.message, result.response);
    }

    if( result.length === 0 ) {
      Logger.log('No Children: '+lspath);
    } else {
      Logger.log(result.join(' '));
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

  async cd(args, command) {
    var result = await model.cd(args);

    if( result.error ) {
       Logger.error(result.message, result.response);
    }
  }
}

module.exports = new LocationCli();