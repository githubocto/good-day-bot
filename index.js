require("dotenv").config();

const express = require("express");
const { createEventAdapter } = require("@slack/events-api");

const { writeToFile } = require("./interactive");
const { getHomeBlocks, saveUser } = require("./onboarding");
const { slaxios } = require("./api");

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

// Initialize
const slackEvents = createEventAdapter(slackSigningSecret);

const app = express();

app.use("/slack/events", slackEvents.requestListener());

if (process.env.NODE_ENV === "development") {
  app.use(express.json());
} else {
  app.use(express.urlencoded({ extended: true }));
}

const port = process.env.NODE_ENV === "development" ? 3000 : process.env.PORT;

const server = app.listen(port, () => {
  console.log(
    "Express web server is running on port %d in %s mode",
    server.address().port,
    app.settings.env
  );
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
      blocks: getHomeBlocks(),
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

app.post("/interactive", async (req, res) => {
  const payload = JSON.parse(req.body.payload);

  const actionId = payload.actions[0].action_id;
  if (actionId === "onboarding-timepicker-action") {
    const newPromptTime = payload.actions[0].selected_time;
    saveUser({
      slackUserId: payload.user.id,
      promptTime: newPromptTime,
    });
  } else if (actionId === "onboarding-github-repo") {
    const repo = payload.actions[0].value;
    const wholeRepoString = repo.split("github.com/")[1] || "";
    const [owner, name] = wholeRepoString.split("/");
    if (!owner || !name) {
      return res.status(400).send("Invalid repo URL");
    }

    const slackUserId = payload.user.id;

    saveUser({
      slackUserId,
      repoOwner: owner,
      repoName: name,
    });

    const newBlocks = getHomeBlocks({ repo: wholeRepoString });

    const args = {
      user_id: slackUserId,
      view: {
        type: "home",
        title: {
          type: "plain_text",
          text: "Keep notes!",
        },
        blocks: newBlocks,
      },
    };
    try {
      await slaxios.post(`views.publish`, args);
    } catch (e) {
      console.error(e);
    }
  } else {
    writeToFile(req);
  }

  // if (Array.isArray(body.payload)) {
  //   throw new Error(
  //     `malformed payload`
  //   )
  // }

  let response = { body: "", status: 200 };

  // if a block action then assume it's good day log data to write?
  if (
    payload?.type === "block_actions" &&
    payload?.actions[0]?.action_id === "record_day"
  ) {
    const owner = req.body.owner ? req.body.owner : "githubocto";
    const repo = req.body.repo ? req.body.repo : "good-day-demo";
    const path = req.body.path ? req.body.path : "good-day.csv";
    response = await writeToFile(owner, repo, path, payload);
  }

  res.sendStatus(200);
});
