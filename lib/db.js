const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_configs (
      id SERIAL PRIMARY KEY,
      guild_id TEXT UNIQUE NOT NULL,
      guild_name TEXT,
      provider TEXT NOT NULL DEFAULT 'deepseek',
      model TEXT NOT NULL DEFAULT 'deepseek/deepseek-v4-flash',
      api_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, channel_id)
    );
  `);
  console.log('Database migrated');
}

async function getConfig(guildId) {
  const { rows } = await pool.query(
    'SELECT * FROM bot_configs WHERE guild_id = $1', [guildId]
  );
  return rows[0] || null;
}

async function upsertConfig(guildId, guildName, provider, model, apiKey) {
  const { rows } = await pool.query(
    `INSERT INTO bot_configs (guild_id, guild_name, provider, model, api_key)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (guild_id) DO UPDATE SET
       guild_name = $2, provider = $3, model = $4, api_key = $5,
       updated_at = NOW()
     RETURNING *`,
    [guildId, guildName, provider, model, apiKey]
  );
  return rows[0];
}

async function getSession(userId, channelId) {
  const { rows } = await pool.query(
    'SELECT session_id FROM chat_sessions WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId]
  );
  return rows[0]?.session_id || null;
}

async function saveSession(guildId, channelId, userId, sessionId) {
  await pool.query(
    `INSERT INTO chat_sessions (guild_id, channel_id, user_id, session_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, channel_id) DO UPDATE SET session_id = $4`,
    [guildId, channelId, userId, sessionId]
  );
}

async function deleteSession(userId, channelId) {
  await pool.query(
    'DELETE FROM chat_sessions WHERE user_id = $1 AND channel_id = $2',
    [userId, channelId]
  );
}

async function listConfigs() {
  const { rows } = await pool.query('SELECT * FROM bot_configs ORDER BY created_at DESC');
  return rows;
}

async function deleteConfig(guildId) {
  await pool.query('DELETE FROM bot_configs WHERE guild_id = $1', [guildId]);
  await pool.query('DELETE FROM chat_sessions WHERE guild_id = $1', [guildId]);
}

module.exports = { migrate, getConfig, upsertConfig, getSession, saveSession, deleteSession, listConfigs, deleteConfig };
