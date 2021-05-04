const cron = require("node-cron");
const { pool } = require("./database");

cron.schedule("0 * * * *", async () => {
  const usersToPromptQuery = `
  SELECT
	  slackid
  FROM
	  users
  WHERE
	  extract(hour from now() at time zone timezone) = extract(hour FROM TO_TIMESTAMP(prompt_time, 'HH24:MI'))
  `;

  const { rows: users } = await pool.query(usersToPromptQuery);

  users.forEach((user) => {
    // TODO: logic for publishing new view!
  });
});
