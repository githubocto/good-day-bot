/* eslint-disable max-len */
import { Block, KnownBlock } from '@slack/types';
import { slaxios } from './api';

// TODO: edit default valuees correctly for typescript
export const getHomeBlocks = ({ repo, timezone, isSaved } = { repo: '', timezone: '', isSaved: '' }) =>
  ([
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Good Day',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Welcome to Good Day! There are just a few steps to get set up.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '1️⃣\n*Create a GitHub repo*\nClick the link on the right and create a new empty GitHub repository. It can be named anything you like, such as *good-day*.',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '+ GitHub repo',
        },
        value: 'GitHub',
        url: 'https://github.com/new',
        action_id: 'button-action',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '2️⃣\n*Invite the good-day bot*\nIn your new GitHub repo, click over to *Settings* and into *Manage access* (in the sidebar).\nOnce you click the *Invite a collaborator* button, search for `Good day bot` and add the first option.',
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
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '3️⃣\n*Check your setup*\nAll set? Go to the home page of your repository and copy + paste the url here:',
      },
    },
    {
      dispatch_action: true,
      type: 'input',
      element: {
        type: 'plain_text_input',
        action_id: 'onboarding-github-repo',
      },
      label: {
        type: 'plain_text',
        text: 'Paste the URL of your GitHub repo, then hit enter:',
        emoji: true,
      },
    },
    repo && {
      type: 'section',
      text: {
        type: 'mrkdwn',
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
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `What time you would like me to ask how your day went? _This is in your timezone${
          timezone ? ` (${timezone})` : ''
        }_`,
      },
      accessory: {
        type: 'timepicker',
        initial_time: '16:00',
        placeholder: {
          type: 'plain_text',
          text: 'Select time',
          emoji: true,
        },
        action_id: 'onboarding-timepicker-action',
      },
    },
    ...(isSaved
      ? [
        {
          type: 'divider',
        },
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '👏 All set! Looking forward to catching up soon!',
            emoji: true,
          },
        },
      ]
      : []),
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Trigger prompt',
            emoji: true,
          },
          value: 'trigger_prompt',
          action_id: 'trigger_prompt',
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Trigger report',
            emoji: true,
          },
          value: 'trigger_report',
          action_id: 'trigger_report',
        },
      ],
    },
  ] as (KnownBlock | Block)[]).filter(Boolean);

export const updateHome = async (slackUserId: string, blocks: (Block | KnownBlock)[]) => {
  const args = {
    user_id: slackUserId,
    view: {
      type: 'home',
      title: {
        type: 'plain_text',
        text: 'Keep notes!',
      },
      blocks,
    },
  };
  try {
    const res = await slaxios.post('views.publish', args);
    console.log(res.data);
  } catch (e) {
    console.error(e);
  }
};
