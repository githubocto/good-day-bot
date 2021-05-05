import axios from 'axios';

const apiUrl = 'https://slack.com/api';

export const slaxios = axios.create({
  baseURL: apiUrl,
  headers: {
    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
  },
});
