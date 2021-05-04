const axios = require("axios");
const { slaxios } = require("./api");
const { EmojiConvertor } = require("emoji-js");

// Slack convertes emojis to shortcode. We need to convert back to unicode
const emoji = new EmojiConvertor.EmojiConvertor();
emoji.replace_mode = "unified";

const questions = [
  {
    title: ":thinking_face: *How was your workday?*",
    id: "workday_quality",
    placeholder: "My workday was…",
    options: [
      ":sob: Terrible",
      ":slightly_frowning_face: Bad",
      ":neutral_face: OK",
      ":slightly_smiling_face: Good",
      ":heart_eyes: Awesome!",
    ],
  },
  {
    id: "worked_with_other_people",
    title: ":busts_in_silhouette: I worked with other people…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "helped_other_people",
    title: ":raised_hands: I helped other people…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "interrupted",
    title: ":rotating_light: My work was interrupted…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "goals",
    title: ":dart: I made progress towards my goals…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "high_quality_work",
    title: ":sparkles: I did high-quality work…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "lot_of_work",
    title: ":rocket: I did a lot of work…",
    placeholder: "How much?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "breaks",
    title: ":coffee: I took breaks today…",
    placeholder: "How often?",
    options: [
      "None of the day",
      "A little of the day",
      "Some of the day",
      "Much of the day",
      "Most or all of the day",
    ],
  },
  {
    id: "meetings",
    title:
      ":speaking_head_in_silhouette: How many meetings did you have today?",
    placeholder: "plain_text",
    options: ["None", "1", "2", "3–4", "5 or more"],
  },
  {
    id: "emotions",
    title: ":thought_balloon: How do you feel about your workday?",
    placeholder: "I feel…",
    options: [
      ":grimacing: Tense or nervous",
      ":worried: Stressed or upset",
      ":cry: Sad or depressed",
      ":yawning_face: Bored",
      ":relaxed: Calm or relaxed",
      ":relieved: Serene or content",
      ":slightly_smiling_face: Happy or elated",
      ":grinning: Excited or alert",
    ],
  },
  {
    id: "most_productive",
    title: ":chart_with_upwards_trend: Today, I felt *most* productive:",
    placeholder: "When?",
    options: [
      ":sunrise: In the morning (9:00–11:00)",
      ":clock12: Mid-day (11:00-13:00)",
      ":clock2: Early afternoon (13:00-15:00)",
      ":clock5: Late afternoon (15:00-17:00)",
      ":night_with_stars: Outside of typical work hours",
      ":date: Equally throughout the day",
    ],
  },
  {
    id: "least_productive",
    title: ":chart_with_downwards_trend: Today, I felt *least* productive:",
    placeholder: "When?",
    options: [
      ":sunrise: In the morning (9:00–11:00)",
      ":clock12: Mid-day (11:00-13:00)",
      ":clock2: Early afternoon (13:00-15:00)",
      ":clock5: Late afternoon (15:00-17:00)",
      ":night_with_stars: Outside of typical work hours",
      ":date: Equally throughout the day",
    ],
  },
];

const messageBlocks = [
  {
    type: "section",
    block_id: "/8H",
    text: {
      type: "mrkdwn",
      text: "Hope you had a good day today! Tell us about it:",
      verbatim: false,
    },
  },
  {
    type: "divider",
    block_id: "AWBp",
  },
  ...questions.map(({ id, title, placeholder, options }) => ({
    type: "section",
    block_id: id + "_block",
    text: {
      type: "mrkdwn",
      text: title,
      verbatim: false,
    },
    accessory: {
      type: "static_select",
      action_id: id,
      placeholder: {
        type: "plain_text",
        text: placeholder,
        emoji: true,
      },
      options: options.map((option, i) => ({
        text: {
          type: "plain_text",
          text: option,
          emoji: true,
        },
        value: i + "",
      })),
    },
  })),
  {
    type: "divider",
    block_id: "zTe",
  },
  {
    type: "actions",
    block_id: "5YgP",
    elements: [
      {
        type: "button",
        action_id: "record_day",
        text: {
          type: "plain_text",
          text: "Save my response",
          emoji: true,
        },
        value: "2021-04-21|idan|repo",
      },
    ],
  },
];

const promptUser = async (user) => {
  console.log("promptUser", user);

  const date = new Date();
  const dateString = date.toLocaleDateString();
  const dateFormattedString = date.toDateString();

  const blocks = [
    {
      type: "header",
      block_id: dateString,
      text: {
        type: "plain_text",
        text: dateFormattedString,
        emoji: true,
      },
    },
    ...messageBlocks,
  ];

  const args = {
    // user_id: slackUserId,
    channel: user.channelid,
    blocks,
  };
  try {
    const res = await slaxios.post(`chat.postMessage`, args);

    console.log("res", res.data);
  } catch (e) {
    console.error(e);
  }
};

// TODO: Create a type for our payload once we decide on parameters
const parseSlackResponse = (payload, newFile = false) => {
  // const options = slackOptions(payload);
  console.log("payload", payload);
  const blocks = payload.message.blocks;
  const date = blocks[0].block_id;
  console.log("date", date);
  const state = payload.state.values;
  // console.log("state", state);

  let parsedResponseHeader = `date,`;
  let parsedResponseBody = `${date},`;
  for (const val of Object.values(state)) {
    const userSelectedOptionId = Object.keys(val)[0];

    const userSelectedOption = val[userSelectedOptionId].selected_option?.value
      ? val[userSelectedOptionId].selected_option.value
      : ""; // a string number

    const question = questions.find((o) => o.id === userSelectedOptionId);
    const optionText = question.options[parseInt(userSelectedOption)] || "N/A";

    parsedResponseHeader += userSelectedOptionId + ",";
    parsedResponseBody += optionText + ",";
  }

  // convert shortcode emojis to unicode
  parsedResponseBody = emoji.replace_colons(parsedResponseBody);

  if (newFile) {
    return parsedResponseHeader + "\n" + parsedResponseBody;
  }

  return parsedResponseBody;
};

// is user submitting block by clicking the button? or just selecting from dropdowns
const isButtonSubmit = (payload) => {
  const actions = payload.actions;

  for (const action of actions) {
    if (action.type === "button" && action.action_id === "record_day") {
      return true;
    }
  }

  return false;
};

module.exports = { promptUser, isButtonSubmit, parseSlackResponse };
