var fs = require('fs-extra');
var path = require('path');
var pathutils = require('../pathutils');

class ImportCli {

  init(vorpal) {
    vorpal.command('import <dir> [fcpath]')
          .description('Import a UCD DAMS serialized directory.  Optionally, provide root path in fedora')
          .action(this.import.bind(this));
  }

  async import() {

  }

  async walk(dir, fcpath = '/') {

    var contents = await fs.readdir(dir);

    var index = contents.indexOf('index.ttl');
    if( index > -1 ) {
      contents.splice(index, 1);

      // TODO: insert rdf container
    }

    let files = {};
    let dirs = [];
    for( var i = 0; i < contents.length; i++ ) {
      let filepath = path.join(dir, contents[i]);
      let stat = await fs.stat();
      
      if( stat.isDirectory() ) {
        dirs.push(filepath);
      } else if( stat.isFile() ) {
        if( files[filepath+'.ttl'] ) {
          files[filepath+'.ttl'] = filepath;
        } else if( filepath.match(/\.ttl$/) ) {
          let tmp = filepath.replace(/\.ttl$/, '');
          if( files[tmp] ) {
            files[filepath] = tmp;
            delete files[tmp]
          } else {
            files[filepath] = '';
          }
        } else {
          files[filepath] = '';
        }
      }
    }

    for( var rdffile in files ) {
      let binaryfile = files[rdffile];

      // todo: insert binary files
    }

    for( var i = 0; i < dirs.length; i++ ) {
      await this.walk(path.join(dir, dirs[i]), pathutils.joinUrlPath(fcpath, dirs[i]));
    }
  }

}