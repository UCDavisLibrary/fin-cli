var Logger = require('./logger');
var config = require('./ConfigCli');

Logger.log(`
   ____       __                _______   ____
  / __/__ ___/ /__  _______ _  / ___/ /  /  _/
 / _// -_) _  / _ \\/ __/ _ \`/ / /__/ /___/ /  
/_/  \\__/\\_,_/\\___/_/  \\_,_/  \\___/____/___/

============= UCD LIBRARY DAMS SHELL =============

Welcome to the Fedora CLI for the UCD Library DAMS
`);
config.display();