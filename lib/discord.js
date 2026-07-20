const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');
const opencode = require('./opencode');

const bots = new Map();
const queues = new Map();

function start(botRow) {
  const id = String(botRow.id);
  const existing = bots.get(id);
  if (existing) existing.client.destroy();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.on('error', (err) => {
    console.error(`[${botRow.name}] Discord error:`, err.message);
  });

  client.on('debug', (info) => {
    if (process.env.DEBUG_DISCORD) console.log(`[${botRow.name}] Debug:`, info);
  });

  client.on('ready', async () => {
    console.log(`[${botRow.name}] Online: ${client.user.tag}`);
    queues.set(id, []);
    try {
      if (!botRow.session_id) {
        const session = await opencode.createSession(botRow.name);
        botRow.session_id = session.id;
        await db.setBotSession(botRow.id, session.id);
      }
    } catch (err) {
      console.error(`[${botRow.name}] Session init:`, err.message);
    }
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const isDM = !msg.guild;
    const isMention = !isDM && msg.mentions.has(client.user);
    if (!isDM && !isMention) return;

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    if (content === '!reset' && isDM) {
      try { await db.deleteBotSession(botRow.id); } catch (e) {}
      await msg.reply('Conversa resetada.').catch(() => {});
      return;
    }

    const q = queues.get(id);
    if (!q) return;

    const username = msg.author.displayName || msg.author.username;
    q.push({ msg, content, userId: msg.author.id, username });
    if (q.length === 1) processQueue(botRow);
  });

  console.log(`[${botRow.name}] Starting login...`);
  client.login(botRow.discord_token).catch(err => {
    console.error(`[${botRow.name}] Login failed:`, err.message);
  });

  bots.set(id, { client, bot: botRow });
}

async function processQueue(botRow) {
  const id = String(botRow.id);
  const q = queues.get(id);
  if (!q || q.length === 0) return;

  const { msg, content, userId, username } = q[0];

  try {
    if (!botRow.session_id) {
      const session = await opencode.createSession(botRow.name);
      botRow.session_id = session.id;
      await db.setBotSession(botRow.id, session.id);
    }

    await msg.channel.sendTyping();
    const response = await opencode.sendWithContext(botRow.session_id, `[${username}]: ${content}`);
    const text = opencode.extractResponse(response);

    if (text) {
      for (const chunk of text.match(/.{1,2000}/gs) || []) {
        await msg.reply(chunk).catch(() => {});
      }
    } else {
      await msg.reply('Sem resposta.').catch(() => {});
    }
  } catch (err) {
    console.error(`[${botRow.name}] Reply error:`, err.message);
    await msg.reply(`Erro: ${err.message.slice(0, 500)}`).catch(() => {});
  }

  q.shift();
  if (q.length > 0) processQueue(botRow);
}

function stop(botId) {
  const entry = bots.get(String(botId));
  if (entry) { entry.client.destroy(); bots.delete(String(botId)); queues.delete(String(botId)); }
}

async function restart(botId, botRow) { stop(botId); start(botRow); }

async function loadAll() {
  const all = await db.listBots();
  for (const b of all) start(b);
  console.log(`${all.length} bots loaded`);
}

function isOnline(botId) {
  const entry = bots.get(String(botId));
  return !!(entry && entry.client.user);
}

module.exports = { start, stop, restart, loadAll, isOnline };
