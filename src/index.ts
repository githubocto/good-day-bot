import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createEventAdapter } from '@slack/events-api';
import { createMessageAdapter } from '@slack/interactive-messages';
import { Block, HeaderBlock } from '@slack/types';
import { getRepoInvitations, isBotInRepo, writeToFile } from './github';
import { getHomeBlocks, updateHome, Debug } from './slack-home';
import { getUser, isRepoUnique, saveUser } from './user';
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
    // there are two cases - if a user exists but hasn't saved a valid repo and if a user exists and has saved a valid repo
    const blocks = user.ghrepo ? await getHomeBlocks(user, Debug.setupComplete) : await getHomeBlocks(user, Debug.noDebug);
    await updateHome(slackUserId, blocks);

    track({ event: 'app_home_opened' });
  } else {
    // first time user opening the app
    const defaultUser = {
      prompt_time: '17:00',
      slackid: slackUserId,
      is_unsubscribed: false,
    };

    const blocks = await getHomeBlocks(defaultUser, Debug.noDebug);
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

const showHomeBlock = async (isBotSetUp: boolean, slackUserId: string, owner: string, name: string) => {
  let newBlocks;
  // is bot setup? if yes, proceed to check if repo is unique
  if (isBotSetUp) {
    const isUnique = await isRepoUnique(slackUserId, owner, name);

    // if repo is unique then we can save the repo info in the DB
    if (isUnique) {
      await saveUser({
        slackid: slackUserId,
        ghuser: owner,
        ghrepo: name,
      });
      const user: User = await getUser(slackUserId); // fetch the newly saved user
      newBlocks = await getHomeBlocks(user, Debug.setupComplete);

      // check if repo successful
      if (isBotSetUp) {
        track({ event: 'onboarding-github-repo-success' });
      }
    } else { // if repo is NOT unique, show debug message around claiming a unique repo
      const user: User = await getUser(slackUserId);
      user.ghuser = owner;
      user.ghrepo = name;
      newBlocks = await getHomeBlocks(user, Debug.repoClaimed);

      if (isBotSetUp) {
        track({ event: 'onboarding-github-repo-collision' });
      }
    }
  } else { // if bot is not setup show debug info for inviting the bot
    const user: User = await getUser(slackUserId);
    user.ghuser = owner;
    user.ghrepo = name;
    newBlocks = await getHomeBlocks(user, Debug.inviteBot);

    if (isBotSetUp) {
      track({ event: 'onboarding-github-repo-no-bot-invite' });
    }
  }

  await updateHome(slackUserId, newBlocks);
};

slackInteractions.action({ actionId: 'onboarding-github-repo' }, async (payload) => {
  const repo = payload.actions[0].value;
  const wholeRepoString = repo.split('github.com/')[1] || '';
  const [owner, name] = wholeRepoString.split('/');
  if (!owner || !name) {
    const slackUserId = payload.user.id;
    const user: User = await getUser(slackUserId);
    const newBlocks = await getHomeBlocks(user, Debug.invalidRepo);
    await updateHome(slackUserId, newBlocks);
    return;
  }

  // try to accept the repo invitation
  await getRepoInvitations(owner, name);
  const isBotSetUp = await isBotInRepo(owner, name);

  // show home block given state of the repo and user
  const slackUserId = payload.user.id;
  await showHomeBlock(isBotSetUp, slackUserId, owner, name);
});

// we might not have saved the repo yet in our database
// haven't verified the bot is added and that it's a unique repo
slackInteractions.action({ actionId: 'check-repo' }, async (payload) => {
  const [owner, name] = payload.actions[0].value.replace('https://github.com/', '').split('/');

  // try to accept the repo invitation
  await getRepoInvitations(owner, name);
  const isBotSetUp = await isBotInRepo(owner, name);

  // show home block given state of the repo and user
  const slackUserId = payload.user.id;
  await showHomeBlock(isBotSetUp, slackUserId, owner, name);
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

// Express server endpoints

const checkAuthenticationHeaders = (authorizationString: string) => {
  const encoded = authorizationString.split(' ')[1];
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const id = decoded.split(':')[0];
  const secret = decoded.split(':')[1];
  if (id !== process.env.AZURE_FUNCTIONS_ID || secret !== process.env.AZURE_FUNCTIONS_SECRET) {
    return false;
  }

  return true;
};

app.get('/', async (req: Request, res: Response) => {
  res.send('beep boop beep boop');
});

app.post('/notify', async (req: Request, res: Response) => {
  // Authentication
  if (!req.headers.authorization) {
    return res.status(401).send('No credentials sent!');
  }
  const authenticated = checkAuthenticationHeaders(req.headers.authorization);
  if (!authenticated) {
    return res.status(401).send('Invalid credentials');
  }

  if (!req.body.user_id) {
    return res.status(400).send('You must provide a User ID');
  }

  try {
    const channelId = await getChannelId(req.body.user_id);

    if (channelId) {
      await messageUserQuestionsForm(channelId);
    }

    return res.status(200).send(req.body.user_id);
  } catch (e) {
    console.error('Failed to open conversation for user', req.body.user_id);
  }

  return res.status(200);
});

app.post('/notify-summary', async (req: Request, res: Response) => {
  // Authentication
  if (!req.headers.authorization) {
    return res.status(401).send('No credentials sent!');
  }
  const authenticated = checkAuthenticationHeaders(req.headers.authorization);
  if (!authenticated) {
    return res.status(401).send('Invalid credentials');
  }

  if (!req.body.user_id) {
    return res.status(400).send('You must provide a User ID');
  }

  try {
    const user = await getUser(req.body.user_id);
    if (!user) throw new Error('User not found');

    await notifyUserOfSummary(user);

    return res.status(200).send(req.body.user_id);
  } catch (e) {
    console.error('Failed to open conversation for user', req.body.user_id);
  }

  return res.status(200);
});
