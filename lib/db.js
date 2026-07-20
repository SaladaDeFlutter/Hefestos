const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bots (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      discord_token TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      session_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS session_id TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS system_prompt TEXT;

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

async function setBotSession(botId, sessionId) {
  await pool.query('UPDATE bots SET session_id = $1 WHERE id = $2', [sessionId, botId]);
}

async function setBotPrompt(botId, systemPrompt) {
  await pool.query('UPDATE bots SET system_prompt = $1 WHERE id = $2', [systemPrompt, botId]);
}

async function deleteBotSession(botId) {
  const { rows } = await pool.query('SELECT session_id FROM bots WHERE id = $1', [botId]);
  if (rows[0]?.session_id) {
    try { await fetch(`http://127.0.0.1:10001/session/${rows[0].session_id}`, { method: 'DELETE' }); } catch (e) {}
  }
  await pool.query('UPDATE bots SET session_id = NULL WHERE id = $1', [botId]);
}

async function listBots() { const { rows } = await pool.query('SELECT * FROM bots ORDER BY created_at DESC'); return rows; }

async function createBot(name, discordToken, description) {
  const { rows } = await pool.query(
    'INSERT INTO bots (name, discord_token, description) VALUES ($1,$2,$3) RETURNING *',
    [name, discordToken, description || null]
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

async function deleteBot(id) { await pool.query('DELETE FROM bots WHERE id = $1', [id]); }
async function getBot(id) { const { rows } = await pool.query('SELECT * FROM bots WHERE id = $1', [id]); return rows[0] || null; }

module.exports = { migrate, setBotSession, setBotPrompt, deleteBotSession, listBots, createBot, updateBot, deleteBot, getBot };
