var BaseModel = require('cork-app-utils').BaseModel;
var models = {};

class ModelBase extends BaseModel {

  registerIOC(name) {
    super.registerIOC(name);
    models[name] = this;
  }

  get models() {
    return models;
  }

}

module.exports = ModelBase;