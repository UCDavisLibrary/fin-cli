const Logger = require('./logger');
const model = require('../models/LocationModel');

class LocationCli {

  init(vorpal) {
    this.vorpal = vorpal;

    var self = this;
    vorpal.command('pwd').action(this.pwd.bind(this));
    vorpal.command('ls [fedora_path]').action(this.ls.bind(this));

    vorpal.command('cd <fedora_path>')
      .option('--into <into>','Specify the predicate to cd into.')
      .option('--type <type>','Specify the type of object to cd into.')
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
    let ls = await model.ls({});
    let matches = [];

    let type = 'http://www.w3.org/ns/ldp#Container';
    let re = new RegExp('^'+input);

    ls.forEach(fedora_path => {
      /// This won't work as we don't know the into and type options :(
//      let {response, body} = await model.head({fedora_path});
 //         if ( ! model.isa({response,type}) ) {
 //           return {
  //            error: true,
//              message : `Not an ${type}: ${newdir}`,
//              response
//            }
//          }
//          return {
//            success : true,
//            response, body
//          }
//        }
      if (fedora_path.match(re)) matches.push(fedora_path);
    });

    return matches;
  }

  async cd(args, command) {
    var result = await model.cd(args);

    if( result.error ) {
       Logger.error(result.message, result.response);
    }
    delete result.response;
  }
}

module.exports = new LocationCli();
