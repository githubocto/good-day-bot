require("dotenv").config();

const express = require("express");
const { createEventAdapter } = require("@slack/events-api");

const { writeToFile } = require("./github");
const { getHomeBlocks, saveUser } = require("./onboarding");
const { getUser } = require("./user");
const { slaxios } = require("./api");
const { promptUser } = require("./message");

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

// Initialize
const slackEvents = createEventAdapter(slackSigningSecret);

const app = express();

app.use("/slack/events", slackEvents.requestListener());

app.use(express.urlencoded({ extended: true }));

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
  const slackUserId = event.user;
  saveUser({
    slackUserId,
    channelId: event.channel,
  });
  const blocks = getHomeBlocks();
  await updateHome({ slackUserId, blocks });
});

app.get("/", async (req, res) => {
  res.send("beep boop");
});

app.post("/interactive", async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  const slackUserId = payload.user.id;

  const user = await getUser(slackUserId);

  const actionId = payload.actions[0].action_id;

  if (actionId === "onboarding-timepicker-action") {
    const newPromptTime = payload.actions[0].selected_time;
    saveUser({
      slackUserId,
      promptTime: newPromptTime,
    });
  } else if (actionId === "onboarding-github-repo") {
    const repo = payload.actions[0].value;
    const wholeRepoString = repo.split("github.com/")[1] || "";
    const [owner, name] = wholeRepoString.split("/");
    if (!owner || !name) {
      return res.status(400).send("Invalid repo URL");
    }

    saveUser({
      slackUserId,
      repoOwner: owner,
      repoName: name,
    });

    const newBlocks = getHomeBlocks({ repo: wholeRepoString, isSaved: true });
    await updateHome({ slackUserId, blocks: newBlocks });
  } else if (actionId === "record_day") {
    const error = await writeToFile(user || {}, payload);

    if (error) {
      res.sendStatus(error.status);
      return;
    }
  }

  // if (Array.isArray(body.payload)) {
  //   throw new Error(
  //     `malformed payload`
  //   )
  // }

  res.sendStatus(200);
});

const updateHome = async ({ slackUserId, blocks }) => {
  const args = {
    user_id: slackUserId,
    view: {
      type: "home",
      title: {
        type: "plain_text",
        text: "Keep notes!",
      },
      blocks: blocks,
    },
  };
  try {
    await slaxios.post(`views.publish`, args);
  } catch (e) {
    console.error(e);
  }
};
