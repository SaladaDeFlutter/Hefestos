const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  await pool.query(`
    DROP TABLE IF EXISTS bot_configs CASCADE;
    DROP TABLE IF EXISTS bots CASCADE;
    DROP TABLE IF EXISTS chats CASCADE;

    CREATE TABLE IF NOT EXISTS bots (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      discord_token TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chats (
      bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (bot_id, user_id)
    );
  `);
  console.log('DB migrated');
}

async function listBots() {
  const { rows } = await pool.query('SELECT * FROM bots ORDER BY created_at DESC');
  return rows;
}

async function createBot(name, discordToken) {
  const { rows } = await pool.query(
    'INSERT INTO bots (name, discord_token) VALUES ($1,$2) RETURNING *',
    [name, discordToken]
  );
  return rows[0];
}

async function updateBot(id, name, discordToken) {
  const { rows } = await pool.query(
    'UPDATE bots SET name=$1, discord_token=$2 WHERE id=$3 RETURNING *',
    [name, discordToken, id]
  );
  return rows[0];
}

async function deleteBot(id) {
  await pool.query('DELETE FROM bots WHERE id = $1', [id]);
}

async function getSession(botId, userId) {
  const { rows } = await pool.query(
    'SELECT session_id FROM chats WHERE bot_id = $1 AND user_id = $2',
    [botId, userId]
  );
  return rows[0]?.session_id || null;
}

async function saveSession(botId, userId, sessionId) {
  await pool.query(
    'INSERT INTO chats (bot_id, user_id, session_id) VALUES ($1,$2,$3) ON CONFLICT (bot_id, user_id) DO UPDATE SET session_id = $3',
    [botId, userId, sessionId]
  );
}

async function deleteSession(botId, userId) {
  await pool.query('DELETE FROM chats WHERE bot_id = $1 AND user_id = $2', [botId, userId]);
}

module.exports = { migrate, listBots, createBot, updateBot, deleteBot, getSession, saveSession, deleteSession };
