import { pool } from './database';
import { getChannelId } from './message';
import { User } from './types';

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
