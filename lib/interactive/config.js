const config = require('../config');
const auth = require('../auth');
const inquirer = require('inquirer');

class InteractiveConfig {

  async init(vorpal) {
    vorpal.command('login <username>')
          .description('Login as a user')
          .action(this.login);
          
    vorpal.command('display config').action(this.display);

    if( !config.host ) {
      console.log('Fedora host not set.');

      var args = await inquirer.prompt([{
        type: 'text',
        name: 'host',
        message: 'Fedora Host: '
      },
      {
        type: 'text',
        name: 'path',
        message: 'Fedora Base Path [ex: /rest]: '
      }])

      config.host = args.host;
      config.basePath = args.path.replace(/\/$/, '');

      this.display();
    } else {
      this.display();
    }
  }

  /**
   * Login User
   */
  async login(params, cb) {
    return this.prompt([{
        type: 'password',
        name: 'password',
        message: 'password: '
    }]).then(async args => {
      var resp = await auth.login({
        username : params.username,
        password : args.password
      });

      if( resp ) console.log(`Logged in as ${params.username}`);
      else console.log('Invalid username or password');
    });
  }



  display(args, callback) {
console.log(`
Welcome to the UCD DAMS - Fedora CLI

- Current Config -
Host/Base Path: ${config.host}${config.basePath}
User: ${config.username ? config.username : 'Not logged in'}
Config File: ${config.getConfigFileLocation() ? config.getConfigFileLocation() : 'Not set'}
`);
    if( callback ) callback();
  }

}

module.exports = new InteractiveConfig();