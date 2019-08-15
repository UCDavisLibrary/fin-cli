const api = require('@ucd-lib/fin-node-api');

class AclCli {

  init(vorpal) {
    vorpal
      .command('acl add-admin <username>')
      .description('Add site level admin')
      .action(args => this.addAdmin(args));

    vorpal
      .command('acl remove-admin <username>')
      .description('Remove site level admin')
      .action(args => this.removeAdmin(args));
  }

  addAdmin(args) {
    return api.acl.addAdmin({username: args.username});
  }

  removeAdmin(args) {
    return api.acl.removeAdmin({username: args.username});
  }
}


module.exports = new AclCli();