import { getChannelId } from './slack-messages';
import { User } from './types';
import { slaxios } from './api';

export const notifyUserOfSummary = async (user: User) => {
  const link = `https://github.com/${user.ghuser}/${user.ghrepo}`;
  const blocks = [
    {
      type: 'header',
      block_id: 'text',
      text: {
        type: 'plain_text',
        text: 'Your weekly summary is ready!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Check it out on GitHub',
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Check it out',
          emoji: true,
        },
        value: 'click_me_123',
        url: link,
        action_id: 'check-report',
      },
    },
  ];

  const channelId = await getChannelId(user.slackid);

  await slaxios.post('chat.postMessage', {
    channel: channelId,
    blocks,
  });

  // await sendImageToSlack(`/tmp/${images[0].filename}`, images[0].filename, 'Summary for week', user);
};
