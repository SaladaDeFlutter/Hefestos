const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./db');
const opencode = require('./opencode');

const bots = new Map();
const queues = new Map();

function start(botRow) {
  const id = String(botRow.id);
  if (bots.has(id)) bots.get(id).client.destroy();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on('error', (err) => console.error(`[${botRow.name}] Socket error:`, err.message));
  client.on('warn', (w) => console.warn(`[${botRow.name}] Warn:`, w));
  client.on('shardDisconnect', (evt, id) => console.warn(`[${botRow.name}] Disconnect:`, evt?.code, evt?.reason));

  client.on('ready', async () => {
    console.log(`[${botRow.name}] READY - ${client.user.tag} (${client.user.id})`);
    queues.set(id, []);

    try {
      if (!botRow.session_id) {
        const session = await opencode.createSession(botRow.name);
        botRow.session_id = session.id;
        await db.setBotSession(botRow.id, session.id);
        console.log(`[${botRow.name}] Session created: ${session.id}`);
      }
    } catch (err) {
      console.error(`[${botRow.name}] Session error:`, err.message);
    }
  });

  client.on('messageCreate', async (msg) => {
    console.log(`[${botRow.name}] MSG from ${msg.author.tag}: "${msg.content.slice(0, 50)}" DM=${!msg.guild}`);

    if (msg.author.bot) return console.log(`[${botRow.name}] ..ignored (bot)`);

    const isDM = !msg.guild;
    const isMention = !isDM && msg.mentions.has(client.user);

    if (!isDM && !isMention) return console.log(`[${botRow.name}] ..ignored (no mention)`);

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return console.log(`[${botRow.name}] ..ignored (empty)`);

    if (content === '!reset' && isDM) {
      try { await db.deleteBotSession(botRow.id); } catch (e) {}
      await msg.reply('Resetado.').catch(() => {});
      return;
    }

    const q = queues.get(id);
    if (!q) return console.log(`[${botRow.name}] ..ignored (no queue)`);

    const displayName = msg.author.displayName || msg.author.username;
    console.log(`[${botRow.name}] QUEUE +1 from ${displayName}, queue size: ${q.length + 1}`);
    q.push({ msg, content, userId: msg.author.id, username: displayName });
    if (q.length === 1) processQueue(botRow);
  });

  console.log(`[${botRow.name}] Connecting to Discord... (token starts: ${botRow.discord_token.slice(0, 10)}...)`);
  client.login(botRow.discord_token.trim()).then(() => {
    console.log(`[${botRow.name}] login() resolved (WebSocket connected, waiting READY event)`);
  }).catch(err => {
    console.error(`[${botRow.name}] LOGIN FAILED:`, err.message, err.code);
  });

  bots.set(id, { client, bot: botRow });
}

async function processQueue(botRow) {
  const id = String(botRow.id);
  const q = queues.get(id);
  if (!q || q.length === 0) return;

  const { msg, content, username } = q[0];
  console.log(`[${botRow.name}] Processing: "${content.slice(0, 50)}" from ${username}`);

  try {
    if (!botRow.session_id) {
      const session = await opencode.createSession(botRow.name);
      botRow.session_id = session.id;
      await db.setBotSession(botRow.id, session.id);
    }

    const fresh = await db.getBot(botRow.id);
    if (fresh?.system_prompt) botRow.system_prompt = fresh.system_prompt;

    await msg.channel.sendTyping();
    const response = await opencode.sendToBot(botRow.session_id, botRow.system_prompt || null, `[${username}]: ${content}`);
    const text = opencode.extractResponse(response);
    console.log(`[${botRow.name}] Reply length: ${text?.length || 0}`);

    if (text) {
      for (const chunk of text.match(/.{1,2000}/gs) || []) {
        await msg.reply(chunk).catch(e => console.error(`[${botRow.name}] Reply send error:`, e.message));
      }
    }
  } catch (err) {
    console.error(`[${botRow.name}] Processing error:`, err.message);
    await msg.reply(`Erro: ${err.message.slice(0, 500)}`).catch(() => {});
  }

  q.shift();
  if (q.length > 0) processQueue(botRow);
}

function stop(botId) {
  const entry = bots.get(String(botId));
  if (entry) { entry.client.destroy(); bots.delete(String(botId)); queues.delete(String(botId)); }
}

function isOnline(botId) {
  const entry = bots.get(String(botId));
  return !!(entry && entry.client.user);
}

async function restart(botId, botRow) { stop(botId); start(botRow); }

async function loadAll() {
  const all = await db.listBots();
  for (const b of all) start(b);
  console.log(`${all.length} bot(s) starting...`);
}

module.exports = { start, stop, restart, loadAll, isOnline };
