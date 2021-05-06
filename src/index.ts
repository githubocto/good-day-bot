import 'dotenv/config';
import express, { Request, Response } from 'express';
import { createEventAdapter } from '@slack/events-api';
// import { createMessageAdapter } from '@slack/interactive-messages';
import { writeToFile } from './github';
import { getHomeBlocks, saveUser } from './onboarding';
import { getUser } from './user';
import { slaxios } from './api';
import { createChartsForUser } from './chart';
// eslint-disable-next-line max-len
import { promptUser, checkRepo, promptCheckRepo, parseSlackResponse, getChannelId, promptUserFormSubmission } from './message';

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET || '';

// Initialize
const slackEvents = createEventAdapter(slackSigningSecret);
// const slackInteractions = createMessageAdapter(slackSigningSecret); // we could replace slack endpoint with this

const app = express();

app.use('/slack/events', slackEvents.requestListener());

app.use(express.json());

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Express running on port ${port} in ${app.settings.env} mode`);
});

export const updateHome = async (slackUserId: string, blocks: any) => {
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

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('app_home_opened', async (event) => {
  const slackUserId = event.user;
  saveUser({
    slackUserId,
    channelId: event.channel,
  });
  const blocks = getHomeBlocks();
  await updateHome(slackUserId, blocks);
});

app.get('/', async (req, res) => {
  res.send('beep boop');
});

// types: https://github.com/slackapi/bolt-js/blob/main/src/types/actions/block-action.ts
app.post('/interactive', express.urlencoded({ extended: true }), async (req: Request, res: Response) => {
  const payload = JSON.parse(req.body.payload);
  const slackUserId = payload.user.id;

  const user = await getUser(slackUserId);

  const actionId = payload.actions[0].action_id;

  switch (actionId) {
    case 'onboarding-github-repo': {
      const repo = payload.actions[0].value;
      const wholeRepoString = repo.split('github.com/')[1] || '';
      const [owner, name] = wholeRepoString.split('/');
      if (!owner || !name) {
        return res.status(400).send('Invalid repo URL');
      }

      saveUser({
        slackUserId,
        repoOwner: owner,
        repoName: name,
      });

      const newBlocks = getHomeBlocks({ repo: wholeRepoString, timezone: '', isSaved: 'true' });
      await updateHome(slackUserId, newBlocks);
      await promptCheckRepo(user);
      break;
    }
    case 'onboarding-timepicker-action': {
      const newPromptTime = payload.actions[0].selected_time;
      saveUser({
        slackUserId,
        promptTime: newPromptTime,
      });

      // await promptUser(user.channelid);
      // await createChartsForUser(user);
      break;
    }
    case 'check-repo': {
      checkRepo(user);
      break;
    }
    case 'record_day': {
      console.log('record day');
      const { blocks } = payload.message;
      const date = blocks[0].block_id;
      const state = payload.state.values;

      const data = await parseSlackResponse(date, state);
      const error = await writeToFile(user || {}, data);

      if (error.status !== 200) {
        res.sendStatus(error.status);
        return null;
      }

      await promptUserFormSubmission(user);

      break;
    }
    case 'trigger_prompt': {
      const channelId = await getChannelId(user.slackid);
      if (channelId) await promptUser(channelId);
      break;
    }
    case 'trigger_report': {
      await createChartsForUser(user);
      break;
    }
    default: {
      // no action
    }
  }

  return res.sendStatus(200);
});

app.post('/notify', async (req: Request, res: Response) => {
  if (!req.body.user_id) {
    res.status(400).send('You must provide a User ID');
    return;
  }

  try {
    const channelId = await getChannelId(req.body.user_id);

    if (channelId) {
      await promptUser(channelId);
    }

    res.status(200).send(req.body.user_id);
    return;
  } catch (e) {
    console.error('Failed to open conversation for user', req.body.user_id);
  }
});
