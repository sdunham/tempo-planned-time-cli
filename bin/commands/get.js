// Grab the modules we'll need
const Conf = require('conf');
const config = new Conf();
const Moment = require('moment');
const MomentRange = require('moment-range');
const moment = MomentRange.extendMoment(Moment);
const cliTable = require('cli-table3');
const chalk = require('chalk');

// The string used to execute this command in the terminal
exports.command = 'get';

// Description of this command
exports.describe = 'Get your planned time from Tempo. A span of up to 14 days can be specified. If no dates are provided, only the current day will be returned.';

// Function used to configure options for this command
exports.builder = (yargs) => {
  return yargs
    .option('fromDate', {
      alias: 'from',
      type: 'string',
      default: moment().format('YYYY-MM-DD'),
      describe: 'The start date to get planned time for (defaults to the current day). Format: YYYY-MM-DD'
    })
    .option('toDate', {
      alias: 'to',
      type: 'string',
      default: moment().format('YYYY-MM-DD'),
      describe: 'The end date to get planned time for (defaults to the current day). Format: YYYY-MM-DD'
    });
};

// Helper function for mapping an array of plan objects to a date range
const mapPlans = (from, to, plans) => {
  // Create a range object spanning the start of the from date to the end of the to date
  const queryRange = moment.range(from.startOf('day'), to.endOf('day'));
  // Initialize an object with each day in our range as the keys,
  // and an empty array as each value
  const mappedPlans = Array.from(
    queryRange.by('days')
  ).reduce((acc, day) => {
    acc[day.format('YYYY-MM-DD')] = [];
    return acc;
  }, {});

  // Grab the relevant data from each plan and put it in the array for each
  // applicable day in the queried range
  plans.forEach(plan => {
    const start = moment(plan.startDate, 'YYYY-MM-DD');
    const end = moment(plan.endDate, 'YYYY-MM-DD');
    const planRange = moment.range(start.startOf('day'), end.endOf('day'));
    const applicableRange = queryRange.intersect(planRange);
    const planData = {
      task: plan.planItem.self,
      taskKey: plan.planItem.self.substring(
        plan.planItem.self.lastIndexOf('/') + 1
      ),
      description: plan.description,
      startDate: plan.startDate,
      endDate: plan.endDate,
      secondsPerDay: plan.secondsPerDay,
      plannedTime: moment.duration(plan.secondsPerDay, 'seconds').humanize()
    };

    Array.from(applicableRange.by('days'))
      .forEach(planItemDate => {
        mappedPlans[planItemDate.format('YYYY-MM-DD')].push(planData);
      });
  });

  return mappedPlans;
};

// Function used to execute this command
exports.handler = function (argv) {
  // Grab relevant config and command option data
  const accountId = config.get('accountId');
  const token = config.get('token');
  const jiraBaseUrl = config.get('jiraBaseUrl', 'https://sitecrafting.atlassian.net/');
  const from = moment(argv.fromDate, 'YYYY-MM-DD');
  const to = moment(argv.toDate, 'YYYY-MM-DD');

  // Do we have the required config data to execute this command?
  if (!accountId || !token) {
    console.error(chalk.red('New install, who dis? It looks like you haven\'t run the config command yet to specify your account id and token.'));
    return;
  }

  // Are the dates passed to this command valid?
  if (!from.isValid() || !to.isValid()) {
    console.error(chalk.red('Invalid dates provided. Dates must be formatted as YYYY-MM-DD.'));
    return;
  }

  // Is the from date after the to date?
  if (from.isAfter(to)) {
    console.error(chalk.red('Provided fromDate occurs after toDate.'));
    return;
  }

  // Is the date range specified more than the max of 14 days?
  if (to.diff(from, 'days') > 13) {
    console.error(chalk.red('A maximum of 14 days of planned time can be requested at once. Please update the provided fromDate and/or toDate options.'));
    return;
  }

  // Pull plan data from the Tempo API and output a fancy table with the results
  const axios = require('axios');
  const requestConfig = {
    headers: {'Authorization': `bearer ${token}`}
  };
  axios
    .get(
      `https://api.tempo.io/core/3/plans/user/${accountId}?from=${from.format('YYYY-MM-DD')}&to=${to.format('YYYY-MM-DD')}`,
      requestConfig
    )
    .then(res => {
      const mappedPlans = mapPlans(from, to, res.data.results);
      const resultsTable = new cliTable({
        head: []
      });

      // Iterate through each of the days planned time was requestd for
      for (plannedDate in mappedPlans) {
        const formattedDate = moment(plannedDate).format('ddd, MMM Do YYYY');
        // Day header row
        resultsTable.push(
          [{
            colSpan: 4, 
            hAlign:'center', 
            content: chalk.bold(`Planned time for ${formattedDate}`)
          }]
        );

        if (mappedPlans[plannedDate].length === 0) {
          // Tell the user they can do whatever they want today!
          resultsTable.push(
            [{
              colSpan: 4, 
              hAlign:'center', 
              content: chalk.italic('No planned time for this day!')
            }]
          );
        } else {
          // The user has stuff to do :(
          resultsTable.push(
            [
              chalk.hex('#00aeef').bold('Task'),
              chalk.hex('#00aeef').bold('Planned Time'),
              chalk.hex('#00aeef').bold('Description'),
              chalk.hex('#00aeef').bold('Task Link')
            ]
          );

          mappedPlans[plannedDate].forEach(plannedItem => {
            resultsTable.push(
              [
                plannedItem.taskKey,
                plannedItem.plannedTime,
                plannedItem.description,
                `${jiraBaseUrl}browse/${plannedItem.taskKey}`
              ]
            );
          });
        }
      }
      console.log(resultsTable.toString());
    })
    .catch(err => console.error(chalk.red(err)));
}