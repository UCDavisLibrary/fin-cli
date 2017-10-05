class Logger {

  init(vorpal) {
    this.vorpal = vorpal;
  }

  log() {
    this.vorpal.activeCommand.log.apply(this.vorpal.activeCommand, arguments);
  }

  error(msg, response) {
    if( response ) {
      this.log(`${response.statusCode} ${msg}

${JSON.stringify(response.headers, '  ', '  ')}
`);
    } else {
      this.log(msg);
    }
  }

}

module.exports = new Logger();