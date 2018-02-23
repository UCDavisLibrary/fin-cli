const api = require('@ucd-lib/fin-node-api');

const Logger = require('../lib/logger');
const location = require('../lib/location');

class AclCli {

  init(vorpal) {
    vorpal
      .command('acl show [path]')
      .option('-v --verbose', 'show all defined rules for ACL')
      .description('Show ACL container for provided container')
      .action(args => this.show(args));

    vorpal
      .command('acl auth [path]')
      .option('-v --verbose', 'show all defined authorization containers for this path')
      .description('Show ACL authorization for this path')
      .action(args => this.authorizations(args));

    vorpal
      .command('acl delete [path]')
      .description('Delete ACL authorization at provided path')
      .action(args => this.remove(args));

    vorpal
      .command('acl create [path]')
      .description('Create ACL container for provided path')
      .action(args => this.create(args));

    vorpal
      .command('acl add <agent> <mode> [path]')
      .option('-g --group', 'Agent is a group (AgentClass)')
      .option('-a --acl-path', 'Path to acl (if multiple)')
      .description('Add authorization to provided path. mode can be any combo of r, w, or rw')
      .action(args => this.add(args));

    vorpal
      .command('acl add-group <name> [path]')
      .option('-a --agent <agent>', 'Agent to add to group')
      .description('Create new group, optionally add agents to group')
      .action(args => this.addGroup(args));

    vorpal
      .command('acl modify-group [path]')
      .option('-a --add-agent <agent>', 'Agent to add to group')
      .option('-r --remove-agent <agent>', 'Agent to remvoe from group')
      .description('Add/remove agents from group')
      .action(args => this.modifyGroup(args));
  }

  async show(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');
    let response = await api.acl.get({path: dir});
    if( response.error ) {
      return Logger.log(response.error.message);
    }

    let aclPaths = response.data || [];

    if( args.options.verbose ) {
      Logger.log(`\n== ACL Container(s) ==`);
      Logger.log('\n  '+aclPaths.join('\n  '));
    } else {
      Logger.log(aclPaths.join('\n'));
    }

    if( !args.options.verbose ) return;

    for( var i = 0; i < aclPaths.length; i++ ) {
      let aclPath = aclPaths[i];

      let response = await api.acl.allACLAuthorizations({path: aclPath});
      if( response.error ) {
        return Logger.log(response.error.message);
      }
      let authorizations = response.data;

      if( authorizations.__groups__ ) {
        // Logger.log(`\n== Groups ${aclPath} ==`);
        // for( var key in response.__groups__ ) {
        //   Logger.log(`\n  ${key}\n   - users: `+response.__groups__[key].join(', '));
        // }
        delete authorizations.__groups__;
      }

      Logger.log(`\n== Permissions ${aclPath} ==`);

      for( let cpath in authorizations ) {
        Logger.log(`\n  ${cpath}`+(authorizations[cpath].aclRoot ? ' (ACL ROOT)' : ''));
        this._printPermissions(authorizations[cpath].authorization);
      }
    }

    Logger.log('');
  }

  async authorizations(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');
    let response = await api.acl.authorizations({path: dir});
    if( response.error ) {
      return Logger.log(response.error.message);
    }
  
    if( args.options.verbose ) {
      Logger.log(`\n== Permissions ==\n`);
      this._printPermissions(response.data.authorization);
    } else {
      this._printPermissions(response.data.authorization, ' ');
    }

    if( args.options.verbose ) {
      Logger.log(`\n== ACL Container ==`);
      Logger.log('\n  '+response.data.definedAt);

      Logger.log(`\n== Authorization Containers ==`);
      for( let cpath in response.data.authorizations ) {
        Logger.log(`\n  ${cpath}`);
        this._printPermissions(response.data.authorizations[cpath]);
      }

      Logger.log();
    }    
  }

  async remove(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');
    let response = await api.delete({
      path: dir,
      permanent : true
    });

    Logger.log(response.last.statusCode, response.last.body);
  }

  async create(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');

    let response = await api.acl.create({path: dir});
    if( response.error ) {
      return Logger.log(response.error.message);
    }


    Logger.log(`ACL created at ${dir}`);
  }

  async add(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');
    
    let modes = [];
    args.mode = args.mode.trim().toLowerCase();
    if( args.mode.indexOf('r') > -1 ) modes.push(api.acl.MODES.READ);
    if( args.mode.indexOf('w') > -1 ) modes.push(api.acl.MODES.WRITE);

    if( args.agent === 'PUBLIC' || args.agent === 'PUBLIC_AGENT' ) {
      args.agent = api.acl.PUBLIC_AGENT;
    }

    let options = {
      path : dir,
      agent : args.agent,
      modes : modes
    }
    
    if( args.options.group ) {
      options.type = 'group';
    }

    let response = await api.acl.add(options);

    if( response.error ) {
      return Logger.log(response.error.message);
    }

    Logger.log(`Authorization added ${response.last.body.replace(api.getBaseUrl(options),'')}`);
  }

  async addGroup(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');

    let agents = [];
    if( args.options.agent ) {
      if( !Array.isArray(args.options.agent) ) {
        agents.push(args.options.agent);
      } else {
        agents = args.options.agent;
      }
    }

    let response = await api.acl.addGroup({
      path : dir,
      name : args.name,
      agents : agents
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }

    Logger.log(`Group ${args.name} created at ${dir}`);
  }

  async modifyGroup(args) {
    let dir = location.makeAbsoluteFcPath(args.path || '.');

    let response = await api.acl.modifyGroupAgents({
      path : dir,
      addAgents : args.options['add-agent'],
      removeAgents : args.options['remove-agent']
    });

    if( response.error ) {
      return Logger.log(response.error.message);
    }

    Logger.log(`Group ${args.path} modified`);
  }

  _printPermissions(authorization, space = '    ') {
    let baseUrl = api.getBaseUrl({});

    for( let user in authorization ) {
      let hasRead = authorization[user][api.acl.MODES.READ];
      let hasWrite = authorization[user][api.acl.MODES.WRITE];
      
      let rw = hasRead ? 'r' : '-';
      rw += hasWrite ? 'w' : '-';

      Logger.log(`${space}${rw} ${user.replace(baseUrl, '')}`);
    }
  }  
}


module.exports = new AclCli();