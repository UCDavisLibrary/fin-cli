const Logger = require('../lib/logger');
const location = require('../lib/location');

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
    Logger.log(location.getCwd());
  }

  async ls(args) {
    var response = await location.ls(args);

    if( response.error ) {
      return Logger.log(result.error.message);
    }

    if( response.data.length === 0 ) {
      Logger.log('No Children: '+lspath);
    } else {
      Logger.log(response.data.join(' '));
    }
  }

  async cdAutoComplete(input) {
    var response = await location.ls({});
    var matches = [];

    var re = new RegExp('^'+input);
    response.data.forEach(dir => {
      if( dir.match(re) ) matches.push(dir);
    });

    return matches;
  }

  async cd(args, command) {
    var response = await location.cd(args);
    if( response.error ) {
      Logger.error(result.error.message);
    }
  }
}

module.exports = new LocationCli();