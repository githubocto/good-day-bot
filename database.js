const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.PG_CONN_STRING,
});

module.exports = { pool };
