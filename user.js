const { pool } = require("./database");
const axios = require("axios");
const { slaxios } = require("./api");

const getUser = async (slackUserId) => {
  if (!slackUserId) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  return users[0];
};

module.exports = { getUser };
