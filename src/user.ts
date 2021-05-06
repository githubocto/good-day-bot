import { pool } from './database';
import { User } from './types';

export const getUser = async (slackUserId: any): Promise<any> => {
  if (!slackUserId) {
    return null;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  // TOOD: fetch new channel ID return with User object (channels.open)

  return users[0] as User;
};
