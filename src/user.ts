import { pool } from './database';

export const getUser = async (slackUserId: any): Promise<any> => {
  if (!slackUserId) {
    return null;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  return users[0];
};
