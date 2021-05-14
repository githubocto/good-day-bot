import { Block, KnownBlock } from '@slack/types';
import { slaxios } from './api';
import { User } from './types';

// eslint-disable-next-line no-shadow
export enum Debug {
  noDebug = 'none', // first time user, do not show any debug info
  inviteBot = 'invite', // debug message to invite bot
  repoClaimed = 'claimed', // repo was already claimed by someone else
  setupComplete = 'complete', // repo setup successful
  invalidRepo = 'invalid' // repo is invalid
}

const padding = {
  // blank section for spacing
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: ' ',
  },
};

export const getHomeBlocks = async (user: User, debug?: Debug) => {
  const repo = (user.ghuser && user.ghrepo) ? `${user.ghuser}/${user.ghrepo}` : '';
  const repoUrl = (user.ghuser && user.ghrepo) ? `https://github.com/${user.ghuser}/${user.ghrepo}` : '';

  const isUnsubscribed = user.is_unsubscribed;

  const promptTime = user.prompt_time;
  const [hour] = promptTime.split(':');
  const friendlyPromptTime = +hour === 12 ? '12:00 PM' : `${+hour % 12}:00 ${+hour >= 12 ? 'PM' : 'AM'}`;

  // repo is only truly setup when Debug is setupComplete
  const isSetUp = !((debug === Debug.repoClaimed || debug === Debug.inviteBot || debug === Debug.noDebug || debug === Debug.invalidRepo));

  const showDebug = (() => {
    switch (debug) {
      case Debug.inviteBot:
        return [
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
              value: `${repoUrl}`,
              action_id: 'check-repo',
            },
          },
          {
            type: 'image',
            image_url: 'https://github.com/githubocto/good-day-bot/blob/main/assets/invite-permission.png?raw=true',
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
            image_url: 'https://github.com/githubocto/good-day-bot/blob/main/assets/write-permission.png?raw=true',
            alt_text: 'Enable write premissions (if given the option)',
          },
        ];
      case Debug.repoClaimed:
        return [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hmm it looks like someone that is not you has already registered that repo *<${repoUrl}|${repo}>*`,
            },
          },
        ];
      case Debug.invalidRepo:
        return [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'There\'s something wrong with your repo URL. Try adding it in this format https://github.com/username/repo',
            },
          },
        ];
      case Debug.setupComplete:
        return [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `All set! We'll save your data in *<${repoUrl}|${repo}>*`,
            },
          },
        ];
      case Debug.noDebug:
        return '';
      default:
        return '';
    }
  })();

  // eslint-disable-next-line no-nested-ternary
  const header = isUnsubscribed
    ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            // eslint-disable-next-line quotes
            text: `Welcome to Good Day. *You have paused messages for now*.`,
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Turn messages back on',
            },
            value: 'GitHub',
            action_id: 'resubscribe',
          },
        },
        padding,
        padding,
        { type: 'divider' },
        padding,
        padding,
      ]
    : isSetUp
    ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Welcome to Good Day. You're all set up! You'll get a message on *weekdays at ${friendlyPromptTime}* to fill in your Good Day form.
We left the set-up instructions below, in case you want to change your GitHub repository or your prompt time.`,
          },
        },
        padding,
        { type: 'divider' },
        padding,
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

  const unsubscribe = isSetUp
    ? [
        padding,
        { type: 'divider' },
        padding,
        {
          type: 'section',
          text: {
            type: 'plain_text',
            // eslint-disable-next-line quotes
            text: `🛑 Not interested in receiving messages from Good Day anymore?`,
            emoji: true,
          },
          accessory: isUnsubscribed
            ? {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Turn messages back on',
                },
                value: 'GitHub',
                action_id: 'resubscribe',
              }
            : {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Turn messages off',
                },
                value: 'GitHub',
                action_id: 'unsubscribe',
              },
        },
      ]
    : [];

  // eslint-disable-next-line no-nested-ternary
  const footer = isUnsubscribed
    ? [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            // eslint-disable-next-line quotes
            text: `You're all set, but you have paused messages for now.`,
            emoji: true,
          },
        },
      ]
    : isSetUp
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
      type: 'image',
      image_url: 'https://github.com/githubocto/good-day-bot/blob/main/assets/banner.png?raw=true',
      alt_text: 'The Good Day Project',
    },
    padding,
    ...header,
    padding,
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
    padding,
    padding,
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '2️⃣\n*Invite the good-day bot*\nIn your new GitHub repo, click over to *Settings* and into *Manage access* (in the sidebar).\nClick the *Invite a collaborator* button and add the `good-day-bot` user.\nIf you get the option, give the bot `write` access.',
      },
    },
    padding,
    padding,
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
    ...showDebug,
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
    ...unsubscribe,
    ...footer,
    // These blocks are useful for debugging
    /*
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
          value: 'trigger-prompt',
          action_id: 'trigger-prompt',
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
          value: 'trigger-report',
          action_id: 'trigger-report',
        },
      ],
    },
    */
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
    await slaxios.post('views.publish', args);
  } catch (e) {
    console.error(e);
  }
};
