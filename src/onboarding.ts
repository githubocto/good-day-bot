import  { pool } from "./database"
import { slaxios } from "./api"

export const saveUser = async (config: any) => {
  const {
    slackUserId,
    repoOwner,
    repoName,
    timezone,
    promptTime,
    channelId,
  } = config;

  if (!slackUserId) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);
  let user = users[0];

  if (!user) {
    const createUserSql = `INSERT INTO USERS (slackid) VALUES ('${slackUserId}')`;

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
    channelid: channelId,
    timezone: userDataRes.data.user.tz,
    prompt_time: promptTime,
  }

  // TODO: fix any types below
  const keys = Object.keys(metrics).filter((key) => (metrics as any)[key as string]);
  const valuesString = keys.map((key) => `${key}='${(metrics as any)[key]}'`).join(", ");
  const updateUserSql = `UPDATE USERS SET ${valuesString} WHERE slackid='${slackUserId}'`;

  await pool.query(updateUserSql);
};

// TODO: edit default valuees correctly for typescript
export const getHomeBlocks = ({ repo, timezone, isSaved } = { repo: '', timezone: '', isSaved: ''}) => {
  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Good Day",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Welcome to Good Day! There are just a few steps to get set up.",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "1️⃣\n*Create a GitHub repo*\nClick the link on the right and create a new empty GitHub repository. It can be named anything you like, such as *good-day*.",
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
        type: "mrkdwn",
        text:
          "2️⃣\n*Invite the good-day bot*\nIn your new GitHub repo, click over to *Settings* and into *Manage access* (in the sidebar).\nOnce you click the *Invite a collaborator* button, search for `Good day bot` and add the first option.",
      },
      // accessory: {
      //   type: "button",
      //   text: {
      //     type: "plain_text",
      //     text: "+ Good Day bot",
      //   },
      //   value: "GitHub",
      //   url: "https://github.com/new",
      //   action_id: "button-action",
      // },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "3️⃣\n*Check your setup*\nAll set? Go to the home page of your repository and copy + paste the url here:",
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
        text: "Paste the URL of your GitHub repo, then hit enter:",
        emoji: true,
      },
    },
    repo && {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎉 Great success! We'll save your data in *${repo}*`,
      },
    },
    // {
    //   type: "image",
    //   title: {
    //     type: "plain_text",
    //     text: "image1",
    //     emoji: true,
    //   },
    //   image_url:
    //     "https://api.slack.com/img/blocks/bkb_template_images/onboardingComplex.jpg",
    //   alt_text: "image1",
    // },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `What time you would like me to ask how your day went? _This is in your timezone${
          timezone ? ` (${timezone})` : ""
        }_`,
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
    ...(isSaved
      ? [
          {
            type: "divider",
          },
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "👏 All set! Looking forward to catching up soon!",
              emoji: true,
            },
          },
        ]
      : []),
  ].filter(Boolean);
};