const Logger = require('../lib/logger');
const location = require('../lib/location');
const api = require('@ucd-lib/fin-node-api');

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
    
    vorpal
      .command('mkdir <id> [path]')
      .option('-t --title <title>', 'Nice title for directory')
      .option('-d --description <description>', 'Description of directory')
      .option('-D --direct', 'Directory is a direct container.  membershipResource defaults to parent unless provided')
      .option('-m --membership-resource', '')
      .description('Make directory (non-binary container)')
      .action(args => this.mkdir(args));

    vorpal
      .command('rm <path>')
      .option('-l --leave-tombstone', 'Leave the /fcr:tombstone resource')
      .description('Remove a container and children (like rm -rf)')
      .action(args => this.rm(args));
  }

  async pwd(args) {
    Logger.log(location.getCwd());
  }

  async ls(args) {
    var response = await location.ls(args);

    if( response.error ) {
      return Logger.log(result.error.message);
    }

    if( response.data.length !== 0 ) {
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

  async mkdir(args) {
    let parent = location.makeAbsoluteFcPath(args.path || '.');

    let json = {
      '@id' : ''
    };
    
    // some directory metadata
    if( args.options.title ) {
      json['http://purl.org/dc/elements/1.1/title'] = {'@value': args.options.title}
    }
    if( args.options.description ) {
      json['http://purl.org/dc/elements/1.1/title'] = {'@value': args.options.description}
    }

    // if direct container
    if( args.options.direct ) {
      json['http://www.w3.org/1999/02/22-rdf-syntax-ns#type'] = {
        '@id': 'http://www.w3.org/ns/ldp#DirectContainer'
      }
      json['http://www.w3.org/ns/ldp#hasMemberRelation'] = {
        '@id': 'http://pcdm.org/models#hasMember'
      }
      json['http://www.w3.org/ns/ldp#isMemberOfRelation'] = {
        '@id': 'http://pcdm.org/models#memberOf'
      }
      json['http://www.w3.org/ns/ldp#membershipResource'] = {
        '@id': api.getConfig().basePath+location.makeAbsoluteFcPath(args.options['membership-resource'] || parent)
      }
    }

    let response = await api.postEnsureSlug({
      path : parent,
      slug : args.id,
      headers : {'Content-Type': api.RDF_FORMATS.JSON_LD},
      content : JSON.stringify(json)
    });

    console.log(response.last.statusCode, response.last.body);
  }

  async rm(args) {
    let response = await api.delete({
      path : location.makeAbsoluteFcPath(args.path || '.'),
      permanent : args.options['leave-tombstone'] ? false : true
    });
    console.log(response.last.statusCode, response.last.body);
  }
}

module.exports = new LocationCli();