import  { pool } from "./database"
import { slaxios } from "./api"

export const getUser = async (slackUserId: any) => {
  if (!slackUserId) {
    return;
  }

  const findUserSql = `SELECT * FROM users where slackid='${slackUserId}' LIMIT 1`;

  const { rows: users } = await pool.query(findUserSql);

  return users[0];
};