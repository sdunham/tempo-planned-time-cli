#!/usr/bin/env node

const yargonaut = require('yargonaut');
const yargs = require('yargs');

// TODO: https://www.twilio.com/blog/how-to-build-a-cli-with-node-js
// TODO: Docs
// TODO: Installation options/instructions

// Set up some basic output styles using yargonaut 
yargonaut
  .style('yellow')
  .helpStyle('green')
  .errorsStyle('red');

// Configure yargs with our commands and some examples
yargs
  .scriptName('tempo-planned-time')
  .usage('$0 <cmd> [args]')
  .commandDir('commands')
  .demandCommand()
  .example('$0 config --account foo --token bar','Sets your accountId to "foo" and accessToken to "bar"')
  .example('$0 config --url https://mycompany.atlassian.net','Sets your jiraBaseUrl to "https://mycompany.atlassian.net"')
  .example('$0 get','Gets planned time for the current day')
  .example('$0 get --from 2020-01-10 --to 2020-01-12','Gets planned time between 2020-01-10 and 2020-01-12')
  .wrap(Math.min(130, yargs.terminalWidth()))
  .help()
  .argv