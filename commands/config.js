// Load our command class
const Config = require('../lib/command-config').Config;

// The string used to execute this command in the terminal
exports.command = 'config';

// Description of this command
exports.describe = 'Specify data (i.e. accountId and accessToken) needed for subsequent Tempo API calls. Also allows a custom jiraBaseUrl to be specified for display purposes.';

// Function used to configure options for this command
exports.builder = yargs => Config.builder(yargs);

// Function used to execute this command
exports.handler = function (argv) {
  const config = new Config(argv);
  config.execute();
}