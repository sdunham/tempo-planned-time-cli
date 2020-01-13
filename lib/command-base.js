/**
 * Used to implement base functionality used by all command classes.
 * All command classes should extend this class.
 */
class Base {
  /**
   * Constructs our class and loads module dependencies
   * @param {Object} argv User arguments, as parsed by yargs module
   */
  constructor(argv){
    this.argv = argv;
    this.chalk = require('chalk');
    const Conf = require('conf');
    this.config = new Conf({projectName: 'tempo-planned-time-cli'});
  }

  /**
   * Outputs the given error message as red text
   * @param {string} message 
   */
  outputError(message){
    console.error(this.chalk.red(message));
  }

  /**
   * Outputs the given warning message as yellow text
   * @param {string} message 
   */
  outputWarning(message){
    console.warn(this.chalk.yellow(message));
  }

  /**
   * Outputs the given success message as green text
   * @param {string} message 
   */
  outputSuccess(message){
    console.log(this.chalk.green(message));
  }

  /**
   * Outputs the given message with no formatting
   * @param {string} message 
   */
  outputDefault(message){
    console.log(message);
  }
}

exports.Base = Base;