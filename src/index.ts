import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createEventAdapter } from '@slack/events-api';
import { createMessageAdapter } from '@slack/interactive-messages';
import { Block, HeaderBlock } from '@slack/types';
import { getRepoInvitations, isBotInRepo, writeToFile } from './github';
import { getHomeBlocks, updateHome } from './slack-home';
import { getUser, saveUser } from './user';
import { notifyUserOfSummary } from './chart';
import { track } from './analytics';

import {
  parseSlackResponse,
  getChannelId,
  messageUserQuestionsForm,
  messageUserFormSuccessful,
} from './slack-messages';
import { User } from './types';

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

const slackEvents = createEventAdapter(slackSigningSecret);
const slackInteractions = createMessageAdapter(slackSigningSecret);

const app = express();

app.use('/events', slackEvents.requestListener());
app.use('/interactive', slackInteractions.requestListener());

app.use(express.json());

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express running on port ${port} in ${app.settings.env} mode`);
});

/* Slack events */

// Docs: https://api.slack.com/events/message.im

slackEvents.on('app_home_opened', async (event) => {
  const slackUserId = event.user;
  const user: User = await getUser(slackUserId);

  // user exists
  if (user) {
    const blocks = await getHomeBlocks(user);
    await updateHome(slackUserId, blocks);

    track({ event: 'app_home_opened' });
  } else {
    // first time user opening the app
    const defaultUser = {
      prompt_time: '17:00',
      slackid: slackUserId,
      is_unsubscribed: false,
    };

    const blocks = await getHomeBlocks(defaultUser, true);
    await updateHome(slackUserId, blocks);

    await saveUser({
      ...defaultUser,
    });

    track({ event: 'app_home_opened_first_time' });
  }
});

/* Slack interactive messages */

// Docs: https://slack.dev/node-slack-sdk/interactive-messages
// Docs: https://www.npmjs.com/package/@slack/interactive-messages

const getUserFromPayload = async (payload: any) => {
  const slackUserId = payload.user.id;
  const user: User = await getUser(slackUserId);
  return user;
};

slackInteractions.action({ actionId: 'onboarding-github-repo' }, async (payload, respond) => {
  const repo = payload.actions[0].value;
  const wholeRepoString = repo.split('github.com/')[1] || '';
  const [owner, name] = wholeRepoString.split('/');
  if (!owner || !name) {
    await respond({ text: 'Invalid repo UR.' }); // TODO: send a message if invalid repo
    return;
  }

  const slackUserId = payload.user.id;
  let user = await getUser(slackUserId);

  await saveUser({
    slackid: slackUserId,
    ghuser: owner,
    ghrepo: name,
  });
  user = await getUser(slackUserId);
  await getRepoInvitations(user.ghuser, user.ghrepo);

  const newBlocks = await getHomeBlocks(user);
  await updateHome(slackUserId, newBlocks);

  // check if repo successful the first time
  const isBotSetUp = await isBotInRepo(owner, name);
  if (isBotSetUp) {
    track({ event: 'onboarding-github-repo-success' });
  }
});

slackInteractions.action({ actionId: 'onboarding-timepicker-action' }, async (payload) => {
  const slackUserId = payload.user.id;
  let user = await getUser(slackUserId);

  const newPromptTime = payload.actions[0].selected_time;

  await saveUser({
    slackid: slackUserId,
    prompt_time: newPromptTime,
  });
  user = await getUser(slackUserId);

  const newBlocks = await getHomeBlocks(user);
  await updateHome(slackUserId, newBlocks);

  track({ event: 'onboarding-timepicker-action-success', payload: { time: newPromptTime } });
});

slackInteractions.action({ actionId: 'check-repo' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await getRepoInvitations(user.ghuser, user.ghrepo);
  const newBlocks = await getHomeBlocks(user);
  await updateHome(user.slackid, newBlocks);

  // check if repo successful after providing instructions
  const isBotSetUp = await isBotInRepo(user.ghuser, user.ghrepo);
  if (isBotSetUp) {
    track({ event: 'onboarding-github-repo-success-followup' });
  }
});

slackInteractions.action({ actionId: 'trigger-prompt' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await messageUserQuestionsForm(user.channelid);
});

slackInteractions.action({ actionId: 'trigger-report' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await notifyUserOfSummary(user);

  // report sent to user
  track({ event: 'trigger-report' });
});

slackInteractions.action({ actionId: 'check-report' }, async () => {
  // user clicks 'check report' button
  track({ event: 'check-report' });
});

slackInteractions.action({ actionId: 'resubscribe' }, async (payload) => {
  let user = await getUserFromPayload(payload);
  await saveUser({
    slackid: user.slackid,
    is_unsubscribed: false,
  });
  user = await getUserFromPayload(payload);
  const newBlocks = await getHomeBlocks(user);
  await updateHome(user.slackid, newBlocks);

  track({ event: 'resubscribe' });
});

slackInteractions.action({ actionId: 'unsubscribe' }, async (payload) => {
  let user = await getUserFromPayload(payload);
  await saveUser({
    slackid: user.slackid,
    is_unsubscribed: true,
  });
  user = await getUserFromPayload(payload);
  const newBlocks = await getHomeBlocks(user);
  await updateHome(user.slackid, newBlocks);

  track({ event: 'unsubscribe' });
});

slackInteractions.action({ actionId: 'record-day' }, async (payload) => {
  console.log('record day');
  console.log(JSON.stringify(payload));
  const user = await getUserFromPayload(payload);

  const blocks = payload.message.blocks as Block[];
  const headerBlock = blocks[0] as HeaderBlock;
  const date = headerBlock.block_id;

  const state = payload.state.values;

  const data = await parseSlackResponse(date, state);
  const error = await writeToFile(user, data);

  if (error.status !== 200) {
    return;
  }

  await messageUserFormSuccessful(user);

  track({ event: 'record-day-successful' });
});

// Everything else we don't catch above like a dropdown menu select on the user form
// Important to have anyway so app registers a 200 status code when that happens
// If not user sees a warning in Slack
slackInteractions.action({}, (payload) => {
  // console.log(payload);
  // console.log('Form drowndown select');
});

/* Server endpoints */

app.get('/', async (req, res) => {
  res.send('beep boop beep boop');
});

app.post('/notify', async (req: Request, res: Response) => {
  if (!req.body.user_id) {
    res.status(400).send('You must provide a User ID');
    return;
  }

  try {
    const channelId = await getChannelId(req.body.user_id);

    if (channelId) {
      await messageUserQuestionsForm(channelId);
    }

    res.status(200).send(req.body.user_id);
    return;
  } catch (e) {
    console.error('Failed to open conversation for user', req.body.user_id);
  }
});

app.post('/notify-summary', async (req, res) => {
  if (!req.body.user_id) {
    res.status(400).send('You must provide a User ID');
    return;
  }

  try {
    const user = await getUser(req.body.user_id);
    if (!user) throw new Error('User not found');

    await notifyUserOfSummary(user);

    res.status(200).send(req.body.user_id);
    return;
  } catch (e) {
    console.error('Failed to open conversation for user', req.body.user_id);
  }
});
