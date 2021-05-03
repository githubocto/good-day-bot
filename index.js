require("dotenv").config();
const express = require("express");
const { createEventAdapter } = require("@slack/events-api");
const axios = require("axios");

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const apiUrl = "https://slack.com/api";

// Initialize
const slackEvents = createEventAdapter(slackSigningSecret);

const app = express();

app.use("/slack/events", slackEvents.requestListener());

app.use(express.json());

const server = app.listen(process.env.PORT, () => {
  console.log(
    "Express web server is running on port %d in %s mode",
    server.address().port,
    app.settings.env
  );
});

const slaxios = axios.create({
  baseURL: apiUrl,
  headers: {
    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
  },
});

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on("app_home_opened", async (event) => {
  const args = {
    user_id: event.user,
    view: {
      type: "home",
      title: {
        type: "plain_text",
        text: "Keep notes!",
      },
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Welcome!* \nThis is a home for Stickers app. You can add small notes here!",
          },
          accessory: {
            type: "button",
            action_id: "add_note",
            text: {
              type: "plain_text",
              text: "Add a Stickie",
              emoji: true,
            },
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                ":wave: Hey, my source code is on <https://glitch.com/edit/#!/apphome-demo-keep|glitch>!",
            },
          ],
        },
        {
          type: "divider",
        },
      ],
    },
  };
  try {
    const res = await slaxios.post(`views.publish`, args);
    console.log(res);
  } catch (e) {
    console.error(e);
  }
});

app.get("/", async (req, res) => {
  res.send("beep boop");
});
