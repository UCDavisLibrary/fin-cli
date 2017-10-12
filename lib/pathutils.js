var path = require('path');
var LocationStore = require('./stores/LocationStore')

class PathUtils {

  makeAbsolutePath(file) {
    file = file.trim();

    if( file.match(/^~/) ) {
      return path.join(this.getUserHome(), file.replace(/^~/, ''));
    } else if( !path.isAbsolute(file) ) {
      return path.join(process.cwd(), file);
    }
    return file;
  }

  makeAbsoluteFcPath(fcpath = '.') {
    if( !fcpath.match(/^\//) ) {
      return this.joinUrlPath(LocationStore.getCwd(), fcpath);
    }
    return fcpath;
  }

  joinUrlPath() {
    var newpath = path.join.apply(path, arguments);
    if( path.sep !== '/' ) newpath = newpath.replace(path.sep, '/');
    return newpath;
  }

  getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
  }

}

module.exports = new PathUtils();