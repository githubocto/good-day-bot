const cron = require("node-cron");

cron.schedule("0 * * * *", () => {
  // For every hour this job runs, we need to find all of the users in the database for whom their prompt_time hour is equal to the current hour
});
