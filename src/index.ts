import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createEventAdapter } from '@slack/events-api';
import { createMessageAdapter } from '@slack/interactive-messages';
import { Block, HeaderBlock } from '@slack/types';
import { getRepoInvitations, writeToFile } from './github';
import { getHomeBlocks, updateHome } from './slack-home';
import { getUser, saveUser } from './user';
import { notifyUserOfSummary } from './chart';
// eslint-disable-next-line max-len
import {
  parseSlackResponse,
  getChannelId,
  messageUserQuestionsForm,
  messageUserFormSuccessful,
} from './slack-messages';
import { User } from './types';

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

const slackEvents = createEventAdapter(slackSigningSecret);
const slackInteractions = createMessageAdapter(slackSigningSecret); // we could replace slack endpoint with this

const app = express();

app.use('/slack/events', slackEvents.requestListener());
app.use('/interactive', slackInteractions.requestListener());

app.use(express.json());

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express running on port ${port} in ${app.settings.env} mode`);
});

/* Slack events */

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('app_home_opened', async (event) => {
  const slackUserId = event.user;
  const user: User = await getUser(slackUserId);
  // saveUser({
  //   slackUserId,
  // });
  const blocks = await getHomeBlocks(user);
  await updateHome(slackUserId, blocks);
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
    slackUserId,
    repoOwner: owner,
    repoName: name,
  });
  user = await getUser(slackUserId);
  await getRepoInvitations(user.ghuser, user.ghrepo);

  const newBlocks = await getHomeBlocks(user);
  console.log('newBlocks', newBlocks);
  await updateHome(slackUserId, newBlocks);
});

slackInteractions.action({ actionId: 'onboarding-timepicker-action' }, async (payload) => {
  console.log('select timepicker');
  const slackUserId = payload.user.id;
  let user = await getUser(slackUserId);

  const newPromptTime = payload.actions[0].selected_time;

  await saveUser({
    slackUserId,
    promptTime: newPromptTime,
  });
  user = await getUser(slackUserId);

  const newBlocks = await getHomeBlocks(user);
  await updateHome(slackUserId, newBlocks);
});

slackInteractions.action({ actionId: 'check-repo' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await getRepoInvitations(user.ghuser, user.ghrepo);
  const newBlocks = await getHomeBlocks(user);
  await updateHome(user.slackid, newBlocks);
  // checkRepo(user);
});

slackInteractions.action({ actionId: 'trigger_prompt' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await messageUserQuestionsForm(user.channelid);
});

slackInteractions.action({ actionId: 'trigger_report' }, async (payload) => {
  const user = await getUserFromPayload(payload);
  await notifyUserOfSummary(user);
});

slackInteractions.action({ actionId: 'record_day' }, async (payload) => {
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
});

// Everything else we don't catch above like a dropdown menu select on the user form
// Important to have anyway so app registers a 200 status code when that happens
// If not user sees a warning in Slack
slackInteractions.action({}, (payload) => {
  // console.log('Form drowndown select');
});

/* Server endpoints */

app.get('/', async (req, res) => {
  res.send('beep boop');
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
