import { slaxios } from './api';
import { pool } from './database';
import { getChannelId } from './slack-messages';
import { User } from './types';

export const saveUser = async (config: User) => {
  // eslint-disable-next-line camelcase
  const { slackid, ghuser, ghrepo, prompt_time, is_unsubscribed } = config;

  if (!slackid) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackid}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);
  const user = users[0];

  if (!user) {
    const createUserSql = `INSERT INTO USERS (slackid) VALUES ('${slackid}')`;

    await pool.query(createUserSql);
  }

  const userDataRes = await slaxios.get('users.info', {
    params: {
      user: slackid,
      include_locale: true,
    },
  });

  const metrics = {
    ghrepo,
    ghuser,
    timezone: userDataRes.data.user.tz,
    prompt_time,
    is_unsubscribed,
  };

  // only updates records that are not undefined
  const keys = Object.keys(metrics).filter((key) => (metrics as any)[key as string] !== undefined);
  const valuesString = keys.map((key) => `${key}='${(metrics as any)[key]}'`).join(', ');
  const updateUserSql = `UPDATE USERS SET ${valuesString} WHERE slackid='${slackid}'`;

  await pool.query(updateUserSql);
};

export const getUser = async (slackUserId: any): Promise<User> => {
  if (!slackUserId) {
    return null;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  console.log(users);

  // no user found we need to return
  if (users.length === 0) {
    return null;
  }

  const user: User = users[0];

  const channelid = await getChannelId(user.slackid);
  user.channelid = channelid;

  return user;
};
