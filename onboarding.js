const { pool } = require("./database");
const axios = require("axios");
const { slaxios } = require("./api");

const saveUser = async (config) => {
  const { slackUserId, repoOwner, repoName, timezone, promptTime } = config;

  if (!slackUserId) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;
  console.log("findUserSql", findUserSql);

  const { rows: users } = await pool.query(findUserSql);
  let user = users[0];
  console.log("users", users);
  console.log("user", user);

  if (!user) {
    const createUserSql = `INSERT INTO USERS (slackid) VALUES ('${slackUserId}')`;

    console.log("createUserSql", createUserSql);

    await pool.query(createUserSql);
  }

  const userDataRes = await slaxios.get("users.info", {
    params: {
      user: slackUserId,
      include_locale: true,
    },
  });

  const metrics = {
    ghrepo: repoName,
    ghuser: repoOwner,
    timezone: userDataRes.data.user.tz,
    prompt_time: promptTime,
  };

  const keys = Object.keys(metrics).filter((key) => metrics[key]);
  const valuesString = keys.map((key) => `${key}='${metrics[key]}'`).join(", ");
  const updateUserSql = `UPDATE USERS SET ${valuesString} WHERE slackid='${slackUserId}'`;
  console.log("updateUserSql", updateUserSql);

  await pool.query(updateUserSql);
};

const getHomeBlocks = ({ repo }) => {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Welcome! Let's get started.",
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: "1️⃣ Create a GitHub repo",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "+ GitHub repo",
        },
        value: "GitHub",
        url: "https://github.com/new",
        action_id: "button-action",
      },
    },
    {
      type: "section",
      text: {
        type: "plain_text",
        text: "2️⃣ Invite the good-day bot",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "+ Good Day bot",
        },
        value: "GitHub",
        url: "https://github.com/new",
        action_id: "button-action",
      },
    },
    {
      dispatch_action: true,
      type: "input",
      element: {
        type: "plain_text_input",
        action_id: "onboarding-github-repo",
      },
      label: {
        type: "plain_text",
        text: "Paste the URL of your GitHub repo:",
        emoji: true,
      },
    },
    repo && {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎉 Success! Repo saved as ${repo}`,
      },
    },
    {
      type: "image",
      title: {
        type: "plain_text",
        text: "image1",
        emoji: true,
      },
      image_url:
        "https://api.slack.com/img/blocks/bkb_template_images/onboardingComplex.jpg",
      alt_text: "image1",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Choose what time you would like to be prompted",
      },
      accessory: {
        type: "timepicker",
        initial_time: "16:00",
        placeholder: {
          type: "plain_text",
          text: "Select time",
          emoji: true,
        },
        action_id: "onboarding-timepicker-action",
      },
    },
  ].filter(Boolean);
};

module.exports = { getHomeBlocks, saveUser };
