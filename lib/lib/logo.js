const fs = require('fs');
const path = require('path');
const Logger = require('./logger');
const config = require('../cli/ConfigCli');
const VERSION = require(path.join(__dirname, '..', '..', 'package')).version;

Logger.log(`
   ____       __                _______   ____
  / __/__ ___/ /__  _______ _  / ___/ /  /  _/
 / _// -_) _  / _ \\/ __/ _ \`/ / /__/ /___/ /  
/_/  \\__/\\_,_/\\___/_/  \\_,_/  \\___/____/___/
v${VERSION}

============= UCD LIBRARY DAMS SHELL =============

Welcome to the Fedora CLI for the UCD Library DAMS
`);
config.display();