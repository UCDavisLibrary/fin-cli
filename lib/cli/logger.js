class Logger {

  init(vorpal) {
    this.vorpal = vorpal;
  }

  log() {
    this.vorpal.activeCommand.log.apply(this.vorpal.activeCommand, arguments);
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