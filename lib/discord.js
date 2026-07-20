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

  client.on('ready', async () => {
    console.log(`[${botRow.name}] Online: ${client.user.tag}`);
    if (!botRow.session_id) {
      const session = await opencode.createSession(botRow.name);
      botRow.session_id = session.id;
      await db.setBotSession(botRow.id, session.id);
    }
    queues.set(id, []);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const isDM = !msg.guild;
    const isMention = !isDM && msg.mentions.has(client.user);
    if (!isDM && !isMention) return;

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    if (content === '!reset' && isDM) {
      await db.deleteBotSession(botRow.id);
      await msg.reply('Conversa resetada.');
      return;
    }

    const q = queues.get(id);
    if (!q) return;

    const username = msg.author.displayName || msg.author.username;
    const entry = { msg, content, userId: msg.author.id, username };
    q.push(entry);
    if (q.length === 1) processQueue(botRow);
  });

  client.login(botRow.discord_token).catch(err => {
    console.error(`[${botRow.name}] Login:`, err.message);
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
    const prompt = `[${username} (ID: ${userId})]: ${content}`;
    const response = await opencode.sendWithContext(botRow.session_id, prompt);
    const text = opencode.extractResponse(response);

    if (text) {
      const chunks = text.match(/.{1,2000}/gs) || [];
      for (const chunk of chunks) await msg.reply(chunk).catch(() => {});
    } else {
      await msg.reply('Sem resposta.').catch(() => {});
    }
  } catch (err) {
    console.error(`[${botRow.name}] Erro:`, err.message);
    await msg.reply(`Erro: ${err.message.slice(0, 500)}`).catch(() => {});
  }

  q.shift();
  if (q.length > 0) processQueue(botRow);
}

function stop(botId) {
  const id = String(botId);
  const entry = bots.get(id);
  if (entry) { entry.client.destroy(); bots.delete(id); queues.delete(id); }
}

async function restart(botId, botRow) {
  stop(botId);
  start(botRow);
}

async function loadAll() {
  const all = await db.listBots();
  for (const b of all) start(b);
  console.log(`${all.length} bots carregados`);
}

module.exports = { start, stop, restart, loadAll };
