class Logger {

  init(vorpal) {
    this.vorpal = vorpal;
  }

  _getOutput() {
    return this.vorpal.activeCommand || console;
  }

  log() {
    var output = this._getOutput();
    output.log.apply(output, arguments);
  }

  error(msg, response) {
    if( response ) {
      this.log(`ERROR
${response.statusCode} ${msg}

==REQUEST==
${response.request.uri.href}
${JSON.stringify(response.request.headers, '  ', '  ')}

==RESPONSE==
${JSON.stringify(response.headers, '  ', '  ')}
`);
    } else {
      this.log(msg);
    }
  }

}

module.exports = new Logger();