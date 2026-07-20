const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  await pool.query(`
    DROP TABLE IF EXISTS bot_configs CASCADE;
    DROP TABLE IF EXISTS chat_sessions CASCADE;

    CREATE TABLE IF NOT EXISTS bots (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'deepseek',
      model TEXT NOT NULL DEFAULT 'deepseek/deepseek-v4-flash',
      api_key TEXT NOT NULL,
      discord_token TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(bot_id, user_id)
    );
  `);
  console.log('Database migrated');
}

async function createBot(name, provider, model, apiKey, discordToken) {
  const { rows } = await pool.query(
    `INSERT INTO bots (name, provider, model, api_key, discord_token) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, provider, model, apiKey, discordToken]
  );
  return rows[0];
}

async function updateBot(id, name, provider, model, apiKey, discordToken) {
  const { rows } = await pool.query(
    `UPDATE bots SET name=$2, provider=$3, model=$4, api_key=$5, discord_token=$6, updated_at=NOW() WHERE id=$1 RETURNING *`,
    [id, name, provider, model, apiKey, discordToken]
  );
  return rows[0];
}

async function deleteBot(id) {
  await pool.query('DELETE FROM bots WHERE id = $1', [id]);
}

async function listBots() {
  const { rows } = await pool.query('SELECT * FROM bots ORDER BY created_at DESC');
  return rows;
}

async function getBot(id) {
  const { rows } = await pool.query('SELECT * FROM bots WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getSession(botId, userId) {
  const { rows } = await pool.query(
    'SELECT session_id FROM chat_sessions WHERE bot_id = $1 AND user_id = $2',
    [botId, userId]
  );
  return rows[0]?.session_id || null;
}

async function saveSession(botId, userId, sessionId) {
  await pool.query(
    `INSERT INTO chat_sessions (bot_id, user_id, session_id) VALUES ($1,$2,$3)
     ON CONFLICT (bot_id, user_id) DO UPDATE SET session_id = $3`,
    [botId, userId, sessionId]
  );
}

async function deleteSession(botId, userId) {
  await pool.query('DELETE FROM chat_sessions WHERE bot_id = $1 AND user_id = $2', [botId, userId]);
}

module.exports = { migrate, createBot, updateBot, deleteBot, listBots, getBot, getSession, saveSession, deleteSession };
