const axios = require("axios");

const apiUrl = "https://slack.com/api";

const slaxios = axios.create({
  baseURL: apiUrl,
  headers: {
    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
  },
});

module.exports = { slaxios };
