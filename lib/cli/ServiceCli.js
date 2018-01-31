const api = require('@ucd-lib/fin-node-api');
const fs = require('fs');
const Logger = require('../lib/logger');
const location = require('../lib/location');

class ServiceCli {

  init(vorpal) {
    vorpal
      .command('service info <id>')
      .description('Show info for service')
      .action(args => this.show(args));

    vorpal
      .command('service list')
      .description('List all services for server')
      .option('-v --verbose', 'show info for each service')
      .action(args => this.list(args));

    vorpal
      .command('service create <id> <type>')
      .option('-t --title <title>', 'Nice title for service')
      .option('-d --description <description>', 'Description of service')
      .option('-u --url-template <template>', 'url template (ProxyService Only).  ex: http://my-service.com{{fcPath}}?extPath={{svcPath}}')
      .option('-f --frame <frame>', 'frame definition (FrameService Only).  Can be JSON of path to json file.')
      .option('-w --webhook <url>', 'url to post fcrepo event notifications')
      .option('-w --supported-type <url>', 'Supported ldp type for this service.  Currently needs to be of: http://www.w3.org/ns/ldp#')
      .description('Create a service.  Type can be [ProxyService|FrameService|WebhookService]')
      .action(args => this.create(args));

    vorpal
      .command('service del <id>')
      .description('Delete a service')
      .action(args => this.remove(args));

  }

  async show(args) {
    try {
      let info = await api.service.get({id: args.id});
      this._print(info);
      Logger.log();
    } catch(e) {
      Logger.error(e.message);
    }  
  }

  async list(args) {
    let services = await api.service.list();

    if( args.options.verbose ) {
      services.forEach(service => this._print(service));
      Logger.log();
    } else {
      services.forEach(service => Logger.log(service.id));
    }
  }

  async create(args) {
    let options = {
      id : args.id,
      title : args.id,
      description : '',
      type : args.type
    }

    if( args.options.title ) options.title = args.options.title;
    if( args.options.description ) options.description = args.options.description;
    if( args.options.webhook ) options.webhook = args.options.webhook;
    if( args.options['url-template'] ) options.urlTemplate = args.options['url-template'];
    if( args.options['supported-type'] ) options.supportedType = args.options['supported-type'];

    if( args.options.frame ) {
      let frame = args.options.frame.trim();
      if( frame.match(/^({|\[)/) ) {
        options.frame = frame;
      } else {
        options.frame = fs.readFileSync(frame, 'utf-8');
      }
    }

    options.frame = JSON.parse(options.frame);

    let {response} = await api.service.create(options);
    Logger.log(response.statusCode+' '+response.body);
  }

  async remove(args) {
    let dir = api.service.ROOT + '/' + args.id;
    let {response} = await api.delete({
      path: dir,
      permanent : true
    });

    Logger.log(response.statusCode, response.body);
  }

  _print(info) {
    Logger.log('\n== Service: '+info.id+' ==');
    if( info.title ) Logger.log('Title: '+info.title);
    if( info.description ) Logger.log('Description: '+info.description);
    if( info.type ) Logger.log('Type: '+info.type);
    if( info.supportedTypes.length ) Logger.log('Supported Types: '+info.supportedTypes.join(', '));
    if( info.urlTemplate ) Logger.log('URL Template: '+info.urlTemplate);
    if( info.webhook ) Logger.log('Webhook: '+info.webhook);
    if( info.frame ) Logger.log('Frame: '+JSON.stringify(JSON.parse(info.frame), '  ', '  '));
  }



}

module.exports = new ServiceCli();