/* eslint-disable max-len */
import { Block, KnownBlock } from '@slack/types';
import { slaxios } from './api';
import { isBotInRepo } from './github';
import { User } from './types';

export const getHomeBlocks = async (user: User) => {
  const repo = user ? `${user.ghuser}/${user.ghrepo}` : undefined;
  console.log('getHomeBlocks');

  const isBotSetUp = await isBotInRepo(user.ghuser, user.ghrepo);
  console.log(user);
  console.log(isBotSetUp);
  const repoUrl = `https://github.com/${user.ghuser}/${user.ghrepo}`;
  const isSetUp = repo && user.timezone && user.prompt_time && isBotSetUp;

  const promptTime = user.prompt_time;
  const [hour] = promptTime.split(':');
  const friendlyPromptTime = `${+hour % 12}:00 ${+hour > 12 ? 'PM' : 'AM'}`;

  const debugStep = isBotSetUp
    ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `All set! We'll save your data in *<${repoUrl}|${repo}>*`,
          },
        },
      ]
    : [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🤔 Hmm, something needs to be updated',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Make sure to add the \`good-day-bot\` as a collaborator to your repo (and if given an option with *write* permissions). Go to <${repoUrl}/settings/access|${repoUrl}/settings/access> to do that.`,
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Check my repo again',
            },
            value: 'GitHub',
            action_id: 'check-repo',
          },
        },
        {
          type: 'image',
          image_url: 'https://github.com/githubocto/good-day-images/blob/master/invite-permission.png?raw=true',
          alt_text: 'Add good-day-bot to your repo',
        },

        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Once invited, you should see something like this:',
          },
        },
        {
          type: 'image',
          image_url: 'https://github.com/githubocto/good-day-images/blob/master/write-permission.png?raw=true',
          alt_text: 'Enable write premissions (if given the option)',
        },
      ];

  const header = isSetUp
    ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Welcome to Good Day. You're all set up! You'll get a message on *weekdays at ${friendlyPromptTime}* to fill in your Good Day form.
We left the set-up instructions below, in case you want to change your GitHub repository or your prompt time.`,
          },
        },
        {
          // blank section for spacing
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
        { type: 'divider' },
        {
          // blank section for spacing
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ' ',
          },
        },
      ]
    : [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Welcome to Good Day! There are just a few steps to get set up.',
          },
        },
      ];

  const footer = isSetUp
    ? [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `You're all set 🙌! You'll get a message on weekdays at ${friendlyPromptTime} to fill in your Good Day form.`,
            emoji: true,
          },
        },
      ]
    : [];
  return ([
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'The Good Day Project',
        emoji: true,
      },
    },
    ...header,
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
        initial_value: repoUrl,
      },
      label: {
        type: 'plain_text',
        text: 'Paste the URL of your GitHub repo, then hit enter:',
        emoji: true,
      },
    },
    ...debugStep,
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*What time you would like me to ask how your day went?*
_This is in your timezone${user.timezone ? ` (${user.timezone})` : ''}_`,
      },
      accessory: {
        type: 'timepicker',
        initial_time: user.prompt_time,
        placeholder: {
          type: 'plain_text',
          text: 'Select time',
          emoji: true,
        },
        action_id: 'onboarding-timepicker-action',
      },
    },
    ...footer,
    { type: 'divider' },
    { type: 'divider' },
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
};

export const updateHome = async (slackUserId: string, blocks: (Block | KnownBlock)[]) => {
  const args = {
    user_id: slackUserId,
    view: {
      type: 'home',
      title: {
        type: 'plain_text',
        text: 'The Good Day Project',
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
