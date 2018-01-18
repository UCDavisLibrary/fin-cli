const api = require('@ucd-lib/fin-node-api');
const path = require('path');
const fs = require('fs');
const Logger = require('../logger');
const {URL} = require('url');
const config = require('../models/ConfigModel');
const inquirer = require('inquirer');
const editor = require('../editor');
const model = require('../models/AclModel');
const LocationStore = require('../stores/LocationStore');
const pathutils = require('../pathutils');

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
      .command('acl del [path]')
      .description('Del ACL authorization at provided path')
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
  }

  async show(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');
    let aclPaths = await api.acl.get({path: dir}) || [];

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

      if( response.__groups__ ) {
        Logger.log(`\n== Groups ${aclPath} ==`);
        for( var key in response.__groups__ ) {
          Logger.log(`\n  ${key}\n   - users: `+response.__groups__[key].join(', '));
        }
        delete response.__groups__;
      }

      Logger.log(`\n== Permissions ${aclPath} ==`);

      for( let cpath in response ) {
        Logger.log(`\n  ${cpath}`+(response[cpath].aclRoot ? ' (ACL ROOT)' : ''));
        this._printPermissions(response[cpath].authorization);
      }
    }

    Logger.log(`\n\n*Note root permissions are not shown propagated in this view\n`);
  }

  async authorizations(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');
    let response = await api.acl.authorizations({path: dir});
  
    if( args.options.verbose ) {
      Logger.log(`\n== Permissions ==\n`);
      this._printPermissions(response.authorization);
    } else {
      this._printPermissions(response.authorization, ' ');
    }

    if( args.options.verbose ) {
      Logger.log(`\n== ACL Container ==`);
      Logger.log('\n  '+response.definedAt);

      Logger.log(`\n== Authorization Containers ==`);
      for( let cpath in response.authorizations ) {
        Logger.log(`\n  ${cpath}`);
        this._printPermissions(response.authorizations[cpath]);
      }

      Logger.log();
    }    
  }

  async remove(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');
    let {response} = await api.delete({
      path: dir,
      permanent : true
    });

    Logger.log(response.statusCode, response.body);
  }

  async create(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');
    let {response} = await api.acl.create({path: dir});
    Logger.log(response.statusCode, response.body);
  }

  async add(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');
    
    let modes = [];
    args.mode = args.mode.trim().toLowerCase();
    if( args.mode.indexOf('r') > -1 ) modes.push(api.acl.MODES.READ);
    if( args.mode.indexOf('w') > -1 ) modes.push(api.acl.MODES.WRITE);

    let options = {
      path : dir,
      agent : args.agent,
      modes : modes
    }
    
    if( args.options.group ) {
      options.type = 'group';
    }

    let {response} = await api.acl.add(options);
    Logger.log(response.statusCode, response.body);
  }

  async addGroup(args) {
    let dir = pathutils.makeAbsoluteFcPath(args.path || '.');

    let agents = [];
    if( args.options.agent ) {
      if( !Array.isArray(args.options.agent) ) {
        agents.push(args.options.agent);
      } else {
        agents = args.options.agent;
      }
    }

    let {response} = await api.acl.addGroup({
      path : dir,
      name : args.name,
      agents : agents
    });
    console.log(response.statusCode, response.body);
  }

  _printPermissions(authorization, space = '    ') {
    for( let user in authorization ) {
      let hasRead = authorization[user][api.acl.MODES.READ];
      let hasWrite = authorization[user][api.acl.MODES.WRITE];
      
      let rw = hasRead ? 'r' : '-';
      rw += hasWrite ? 'w' : '-';

      Logger.log(`${space}${rw} ${user}`);
    }
  }

  
}



module.exports = new AclCli();