const api = require('@ucd-lib/fin-node-api');

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
      .option('-f --frame <frame>', 'frame definition (FrameService Only).')
      .option('-w --webhook <url>', 'url to post fcrepo event notifications')
      .description('Create a service.  Type can be [ProxyService|FrameService|WebhookService]')
      .action(args => this.create(args));

    vorpal
      .command('service del <id>')
      .description('Delete a service')
      .action(args => this.remove(args));

  }

  async show(args) {
    let dir = api.service.ROOT + '/' + args.id;
    let {response} = await api.get({
      path: dir,
      headers : {Accept: api.RDF_FORMATS.JSON_LD}
    }) || [];

    if( response.statusCode !== 200 ) {
      return Logger.error(response.statusCode+' '+response.body);
    }

    let container = api.service._getContainer(JSON.parse(response.body));
    let info = api.service._getServiceInfo(container);

    this._print(info);
    Logger.log();
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
      type : args.type
    }

    let attrs = ['title', 'description', 'url-template', 'url'];
    attrs.forEach(attr => {
      if( args.options[attr] ) options[attr] = args.options[attr];
    });

    if( args.options.frame ) {
      let frame = args.options.frame.trim();
      if( frame.match(/^({|\[)/) ) {
        options.frame = frame;
      } else {
        options.frame = fs.readFileSync(frame, 'utf-8');
      }
    }

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
    if( info.urlTemplate ) Logger.log('URL Template: '+info.urlTemplate);
    if( info.webhook ) Logger.log('Webhook: '+info.webhook);
    if( info.frame ) Logger.log('Frame: '+JSON.stringify(JSON.parse(info.frame), '  ', '  '));
  }



}

module.exports = new ServiceCli();