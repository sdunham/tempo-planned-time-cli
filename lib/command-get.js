const Base = require('./command-base').Base;

/**
 * Class used to implement the functionality for the get command.
 * Used to validate user input, program configuration, and to query
 * the Tempo API to pull and display planned time
 */
class Get extends Base {
  /**
   * Constructs our class and loads module dependencies
   * @param {Object} argv User arguments, as parsed by yargs module
   */
  constructor(argv) {
    super(argv);

    const Moment = require('moment');
    const MomentRange = require('moment-range');
    this.moment = MomentRange.extendMoment(Moment);
    this.cliTable = require('cli-table3');
    this.axios = require('axios');
    this.queryContainsPlans = false;
  }

  /**
   * Adds options to the provided instance of yargs and returns it
   * @param {Yargs} yargs Yargs instance
   * @returns {Yargs} The updated yargs instance
   */
  static builder(yargs){
    const moment = require('moment');
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
      })
      .option('tomorrow', {
        type: 'boolean',
        default: false,
        describe: 'Alias for getting planned time for tomorrow'
      })
      .option('week', {
        type: 'boolean',
        default: false,
        describe: 'Alias for getting planned time for the next week (including today)'
      });
  }

  /**
   * Validates that the required config data exists
   * @throws Error if required config data isn't set
   * @return {bool|void} True if config is valid, void otherwise
   */
  validateConfig(){
    const accountId = this.config.get('accountId');
    const token = this.config.get('token');

    // Do we have the required config data to execute this command?
    if (!accountId || !token) {
      throw new Error(
        'New install, who dis? It looks like you haven\'t run the config command yet to specify your account id and token.'
      );
    }

    return true;
  }

  /**
   * Checks for unexpected/invalid user input
   * @param {{from: string, to: string}} dates Object containing from 
   *                                           and to date strings based
   *                                           on user input
   * @throws Error if the user args are invalid in some way
   * @return {bool|void} True if args are valid, void otherwise
   */
  validateArgs(dates){
    // Providing both the tomorrow and week options isn't considered valid
    if (this.argv.tomorrow && this.argv.week) {
      throw new Error('Do you want tomorrow of the next week? Make up your mind!');
    }

    // Are the dates passed to this command valid?
    if (!dates.from.isValid() || !dates.to.isValid()) {
      throw new Error('Invalid dates provided. Dates must be formatted as YYYY-MM-DD.');
    }

    // Is the from date after the to date?
    if (dates.from.isAfter(dates.to)) {
      throw new Error('Provided fromDate occurs after toDate.');
    }

    // Is the date range specified more than the max of 14 days?
    if (dates.to.diff(dates.from, 'days') > 13) {
      throw new Error(
        'A maximum of 14 days of planned time can be requested at once. Please update the provided fromDate and/or toDate options.'
      );
    }

    return true;
  }

  /**
   * Determines the from and to dates for the Tempo API
   * query based on user input
   * 
   * @returns {{from: string, to: string}} Object containing the 
   *                                       from and to dates
   */
  getQueryFromAndToDates() {
    const dates = {};
  
    if (this.argv.tomorrow) {
      dates.from = this.moment().add(1, 'day');
      dates.to = dates.from.clone();
    } else if (this.argv.week) {
      dates.from = this.moment();
      dates.to = dates.from.clone();
      dates.to.add(6, 'days');
    } else {
      // The from and to date options default to the current date
      dates.from = this.moment(this.argv.fromDate, 'YYYY-MM-DD');
      dates.to = this.moment(this.argv.toDate, 'YYYY-MM-DD');
    }
  
    return dates;
  }

  /**
   * Helper function to get a date range for each applicable pair of from and to 
   * dates for a given plan object returned by the Tempo API.
   * @param {Object} plan A plan result object returned by the Tempo API
   * @returns {Object[]} Array of applicable moment date range objects for this plan
   */
  getPlanDateRanges(plan) {
    const ranges = [];

    // dates.values is an array of objects containing from and to dates the for given plan,
    // as well as the number of planned seconds for that date range
    plan.dates.values.forEach(planDateValues => {
      // Sanity check to make sure Tempo didn't return a plan date value that has 
      // 0 seconds planned (which can totally happen for some reason)
      if (!planDateValues.timePlannedSeconds) {
        return;
      }
      let start = this.moment(planDateValues.from, 'YYYY-MM-DD');
      let end = this.moment(planDateValues.to, 'YYYY-MM-DD');
      // For some insane reason, Tempo can return a plan with a to date that occurs 
      // before the from date, so let's account for this...
      if (this.moment(end).isBefore(start)) {
        [start, end] = [end, start];
      }
      const range = this.moment.range(start.startOf('day'), end.endOf('day'));
      ranges.push(range);
    });

    return ranges;
  }

  /**
   * Helper function for mapping an array of plan objects to a date range
   * @param {Moment} from Moment object representing the query from date
   * @param {Moment} to Moment object representing the query to date
   * @param {Object[]} plans Array of Tempo API plan objects
   * @returns {Object.<string, array>} Object mapping date strings to arrays 
   *                                   of data describing the plans for each date
   */
  mapPlans(from, to, plans) {
    // Create a range object spanning the start of the from date to the end of the to date
    const queryRange = this.moment.range(from.startOf('day'), to.endOf('day'));
    // Initialize an object with each day in our range as the keys,
    // and an empty array as each value
    const mappedPlans = Array.from(
      queryRange.by('days')
    ).reduce((acc, day) => {
      acc[day.format('YYYY-MM-DD')] = [];
      return acc;
    }, {});
  
    // Iterate through each of our plan objects
    plans.forEach(plan => {
      // Iterate through each of the date ranges provided for this plan
      const planRanges = this.getPlanDateRanges(plan);
      planRanges.forEach(planRange => {
        // Determine the intersection between the range we queried for
        // and this plan date range
        const applicableRange = queryRange.intersect(planRange);
        const planData = {
          task: plan.planItem.self,
          taskKey: plan.planItem.self.substring(
            plan.planItem.self.lastIndexOf('/') + 1
          ),
          description: plan.description,
          secondsPerDay: plan.secondsPerDay,
          plannedTime: this.moment.duration(plan.secondsPerDay, 'seconds').humanize()
        };
    
        // Insert this plan's data into each applicable day for the query range
        Array
          .from(applicableRange.by('days'))
          .forEach(planItemDate => {
            mappedPlans[planItemDate.format('YYYY-MM-DD')].push(planData);
          });
      });
    });
  
    return mappedPlans;
  }

  /**
   * Builds a CLI table object based on the plan data generated by mapPlans
   * @param {Object.<string, array>} mappedPlans Object mapping date strings to arrays 
   *                                   of data describing the plans for each date
   * @param {string} jiraBaseUrl The Jira base URL these plans are associated with
   * @returns {CliTable} A CliTable instance based on the data in mappedPlans
   */
  buildResultsTable(mappedPlans, jiraBaseUrl){
    const resultsTable = new this.cliTable({
      head: []
    });

    // Iterate through each of the days planned time was requested for
    for (const plannedDate in mappedPlans) {
      const formattedDate = this.moment(plannedDate).format('ddd, MMM Do YYYY');
      // Day header row
      resultsTable.push(
        [{
          colSpan: this.queryContainsPlans ? 4 : 1, 
          hAlign:'center', 
          content: this.chalk.bold(`Planned time for ${formattedDate}`)
        }]
      );

      if (mappedPlans[plannedDate].length === 0) {
        // Tell the user they can do whatever they want today!
        resultsTable.push(
          [{
            colSpan: this.queryContainsPlans ? 4 : 1, 
            hAlign:'center', 
            content: this.chalk.italic('No planned time for this day!')
          }]
        );
      } else {
        // The user has stuff to do :(
        resultsTable.push(
          [
            this.chalk.hex('#00aeef').bold('Task'),
            this.chalk.hex('#00aeef').bold('Planned Time'),
            this.chalk.hex('#00aeef').bold('Description'),
            this.chalk.hex('#00aeef').bold('Task Link')
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

    return resultsTable;
  }

  /**
   * Executes this command and outputs the result
   * @returns void
   */
  execute(){
    // Grab relevant config and command option data
    const accountId = this.config.get('accountId');
    const token = this.config.get('token');
    const jiraBaseUrl = this.config.get('jiraBaseUrl', 'https://sitecrafting.atlassian.net/');
    
    try {
      this.validateConfig();
      const dates = this.getQueryFromAndToDates();
      this.validateArgs(dates);

      const from = dates.from;
      const to = dates.to;

      // Pull plan data from the Tempo API and output a fancy table with the results
      const requestConfig = {
        headers: {'Authorization': `bearer ${token}`}
      };
      this.axios
        .get(
          `https://api.tempo.io/core/3/plans/user/${accountId}?from=${from.format('YYYY-MM-DD')}&to=${to.format('YYYY-MM-DD')}`,
          requestConfig
        )
        .then(res => {
          this.queryContainsPlans = res.data.results.length > 0;
          const mappedPlans = this.mapPlans(from, to, res.data.results);
          const resultsTable = this.buildResultsTable(mappedPlans, jiraBaseUrl);
          this.outputDefault(resultsTable.toString());
        })
        .catch(err => this.outputError(err));
    } catch (error) {
      this.outputError(error.message);
    }
  }
}

exports.Get = Get;