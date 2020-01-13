// Load our command class
const Get = require('../lib/command-get').Get;

// The string used to execute this command in the terminal
exports.command = 'get';

// Description of this command
exports.describe = 'Get your planned time from Tempo. A span of up to 14 days can be specified. If no dates are provided, only the current day will be returned.';

// Function used to configure options for this command
exports.builder = yargs => Get.builder(yargs);

// Function used to execute this command
exports.handler = function (argv) {
  const get = new Get(argv);
  get.execute();
}