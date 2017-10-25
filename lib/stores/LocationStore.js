var BaseStore = require('cork-app-utils').BaseStore;

class LocationStore extends BaseStore {

  constructor() {
    super();
    
    this.data = {
      cwd : '/'
    }

    this.events = {
      CWD_UPDATE : 'cwd-update'
    }
  }

  setCwd(path) {
    this.data.cwd = path;
    this.emit(this.events.CWD_UPDATE, path);
  }

  getCwd() {
    return this.data.cwd;
  }

}

module.exports = new LocationStore();