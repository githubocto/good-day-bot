import { slaxios } from './api';
import { pool } from './database';
import { getChannelId } from './slack-messages';
import { User } from './types';

export const saveUser = async (config: any) => {
  const { slackUserId, repoOwner, repoName, promptTime } = config;

  if (!slackUserId) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);
  const user = users[0];

  if (!user) {
    const createUserSql = `INSERT INTO USERS (slackid) VALUES ('${slackUserId}')`;

    await pool.query(createUserSql);
  }

  const userDataRes = await slaxios.get('users.info', {
    params: {
      user: slackUserId,
      include_locale: true,
    },
  });

  const metrics = {
    ghrepo: repoName,
    ghuser: repoOwner,
    timezone: userDataRes.data.user.tz,
    prompt_time: promptTime,
  };

  // TODO: fix any types below
  const keys = Object.keys(metrics).filter((key) => (metrics as any)[key as string]);
  const valuesString = keys.map((key) => `${key}='${(metrics as any)[key]}'`).join(', ');
  const updateUserSql = `UPDATE USERS SET ${valuesString} WHERE slackid='${slackUserId}'`;

  await pool.query(updateUserSql);
};

export const getUser = async (slackUserId: any): Promise<any> => {
  if (!slackUserId) {
    return null;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  const user: User = users[0];

  const channelid = await getChannelId(user.slackid);
  user.channelid = channelid;

  return user;
};
