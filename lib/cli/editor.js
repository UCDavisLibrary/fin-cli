const path = require('path');
const fs = require('fs');
const os = require('os');
const spawn = require('child_process').spawn;

const Editors = {
  vscode : {
    cmd : 'code',
    args : ['-n', '-w']
  }
}

module.exports = (body, options = {}) => {
  if( !options.editor ) options.editor = 'vscode';
  if( !Editors[options.editor] ) options.editor = 'vscode';
  if( !options.ext ) options.ext = 'ttl';

  return new Promise(async (resolve, reject) => {
    var file = prepTmpFile(body);

    var editor = Editors[options.editor];
    var opts = editor.args.splice(0).push(file);

    var vscode = spawn(editor.cmd, opts);      
    vscode.on('close', () => {
      var newbody = fs.readFileSync(file, 'utf-8');
      fs.unlinkSync(file);
      resolve(newbody);
    });
  });
}

function prepTmpFile(body, ext) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcrepo-'));
  var file = path.join(dir, 'fccli-editor.'+ext);
  fs.writeFileSync(file, body);
  return file;
}