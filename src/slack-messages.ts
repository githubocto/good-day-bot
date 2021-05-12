import { EmojiConvertor } from 'emoji-js';
import FormData from 'form-data';
import fs from 'fs';
import { Block, KnownBlock, SectionBlock } from '@slack/types';
import { slaxios } from './api';
import { User } from './types';

// Slack convertes emojis to shortcode. We need to convert back to unicode
const emoji = new EmojiConvertor.EmojiConvertor();
emoji.replace_mode = 'unified';

/* General utils */

export const getChannelId = async (userId: string) => {
  const slackRes = await slaxios.post('/conversations.open', {
    users: userId,
  });
  return slackRes.data.channel.id;
};

export const messageUser = async (channel: string, blocks: (KnownBlock | Block)[]) => {
  const args = {
    channel,
    blocks,
  };

  try {
    await slaxios.post('chat.postMessage', args);
  } catch (e) {
    console.error(e);
  }
};

export const messageUserImage = async (imagePath: string, imageName: string, imageTitle: string, user: User) => {
  const channelId = await getChannelId(user.slackid);
  if (!channelId) {
    console.log('Channel not found for user ', user.slackid);
    return;
  }

  const form = new FormData();
  form.append('title', imageTitle);
  form.append('filename', imageName);
  form.append('filetype', 'auto');
  form.append('channels', channelId);
  form.append('file', fs.createReadStream(imagePath));

  try {
    await slaxios.post('files.upload', form, {
      headers: form.getHeaders(),
    });
  } catch (e) {
    console.log(e);
  }
};

/* Time changes */

const getTimeChangeBlock = (time: string) => {
  const block: SectionBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `You've changed your daily time to: ${time}.`,
      },
    },
  ];

  return block;
};

export const messageUserTimeChange = async (user: User, time: string) => {
  const channelId = await getChannelId(user.slackid);

  await messageUser(channelId, getTimeChangeBlock(time));
};

/* Good day form questions */

export const questions = [
  {
    title: ':thinking_face: How was your workday?',
    id: 'workday_quality',
    placeholder: 'My workday was…',
    options: [
      ':sob: Terrible',
      ':slightly_frowning_face: Bad',
      ':neutral_face: OK',
      ':slightly_smiling_face: Good',
      ':heart_eyes: Awesome!',
    ],
  },
  {
    id: 'worked_with_other_people',
    title: ':busts_in_silhouette: I worked with other people…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'helped_other_people',
    title: ':raised_hands: I helped other people…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'interrupted',
    title: ':rotating_light: My work was interrupted…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'goals',
    title: ':dart: I made progress towards my goals…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'high_quality_work',
    title: ':sparkles: I did high-quality work…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'lot_of_work',
    title: ':rocket: I did a lot of work…',
    placeholder: 'How much?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'breaks',
    title: ':coffee: I took breaks today…',
    placeholder: 'How often?',
    options: ['None of the day', 'A little of the day', 'Some of the day', 'Much of the day', 'Most or all of the day'],
  },
  {
    id: 'meetings',
    title: ':speaking_head_in_silhouette: How many meetings did you have today?',
    placeholder: 'How many?',
    options: ['None', '1', '2', '3–4', '5 or more'],
  },
  {
    id: 'emotions',
    title: ':thought_balloon: How do you feel about your workday?',
    placeholder: 'I feel…',
    options: [
      ':grimacing: Tense or nervous',
      ':worried: Stressed or upset',
      ':cry: Sad or depressed',
      ':yawning_face: Bored',
      ':relaxed: Calm or relaxed',
      ':relieved: Serene or content',
      ':slightly_smiling_face: Happy or elated',
      ':grinning: Excited or alert',
    ],
  },
  {
    id: 'most_productive',
    title: ':chart_with_upwards_trend: Today, I felt *most* productive:',
    placeholder: 'When?',
    options: [
      ':sunrise: In the morning (9:00–11:00)',
      ':clock12: Mid-day (11:00-13:00)',
      ':clock2: Early afternoon (13:00-15:00)',
      ':clock5: Late afternoon (15:00-17:00)',
      ':night_with_stars: Outside of typical work hours',
      ':date: Equally throughout the day',
    ],
  },
  {
    id: 'least_productive',
    title: ':chart_with_downwards_trend: Today, I felt *least* productive:',
    placeholder: 'When?',
    options: [
      ':sunrise: In the morning (9:00–11:00)',
      ':clock12: Mid-day (11:00-13:00)',
      ':clock2: Early afternoon (13:00-15:00)',
      ':clock5: Late afternoon (15:00-17:00)',
      ':night_with_stars: Outside of typical work hours',
      ':date: Equally throughout the day',
    ],
  },
].map((d) => ({
  ...d,
  titleWithEmoji: emoji.replace_colons(d.title),
  optionsWithEmoji: d.options.map((option) => emoji.replace_colons(option)),
}));

const messageBlocks: (KnownBlock | Block)[] = [
  {
    type: 'section',
    block_id: '/8H',
    text: {
      type: 'mrkdwn',
      text: 'Hope you had a good day today! Tell us about it:',
      verbatim: false,
    },
  },
  {
    type: 'divider',
    block_id: 'AWBp',
  },
  ...questions.map(({ id, title, placeholder, options }) => ({
    type: 'section',
    block_id: `${id}_block`,
    text: {
      type: 'mrkdwn',
      text: title,
      verbatim: false,
    },
    accessory: {
      type: 'static_select',
      action_id: id,
      placeholder: {
        type: 'plain_text',
        text: placeholder,
        emoji: true,
      },
      options: options.map((option, i) => ({
        text: {
          type: 'plain_text',
          text: option,
          emoji: true,
        },
        value: `${i}`,
      })),
    },
  })),
  {
    type: 'divider',
    block_id: 'zTe',
  },
  {
    type: 'actions',
    block_id: '5YgP',
    elements: [
      {
        type: 'button',
        action_id: 'record-day',
        text: {
          type: 'plain_text',
          text: 'Save my response',
          emoji: true,
        },
        value: '2021-04-21|idan|repo',
      },
    ],
  },
];

// TODO: Create a type for our payload once we decide on parameters
export const parseSlackResponse = (date: string, state: any) => {
  const states = Object.values(state);
  const data = { date };
  states.forEach((stateData: any) => {
    const fieldId = Object.keys(stateData)[0];
    const question = questions.find((o) => o.id === fieldId);
    let questionText = question.title;
    questionText = emoji.replace_colons(questionText);
    questionText = questionText.replace(/,/g, '');
    const value = stateData[fieldId].selected_option?.value; // selected option number
    let option = question.options[value] || 'N/A';
    option = emoji.replace_colons(option);
    data[questionText] = option;
  });

  return data;
};

const formSuccessfulMessages = [
  'You\'re set for today!',
  'Saved!',
  'Thanks for doing that.',
  'Your Good Day form has been saved.',
  'Keep it up 🙌',
  'Hope you have a great day tomorrow.',
];

const getFormSuccessfulBlock = () => {
  const message = formSuccessfulMessages[Math.floor(Math.random() * formSuccessfulMessages.length)];
  console.log(message);
  const block: SectionBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: message,
      },
    },
  ];

  return block;
};

export const messageUserQuestionsForm = async (channelId: string) => {
  const date = new Date();
  const dateString = date.toLocaleDateString();
  const dateFormattedString = date.toDateString();

  const blocks = [
    {
      type: 'header',
      block_id: dateString,
      text: {
        type: 'plain_text',
        text: dateFormattedString,
        emoji: true,
      },
    },
    ...messageBlocks,
  ];

  await messageUser(channelId, blocks);
};

export const messageUserFormSuccessful = async (user: User) => {
  const channelId = await getChannelId(user.slackid);

  await messageUser(channelId, getFormSuccessfulBlock());
};
