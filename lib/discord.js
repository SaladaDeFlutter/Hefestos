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
      GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on('error', (err) => console.error(`[${botRow.name}] Error:`, err.message));
  client.on('shardDisconnect', (evt) => evt && console.warn(`[${botRow.name}] Disconnected: ${evt.code}`));

  client.on('ready', async () => {
    queues.set(id, []);
    console.log(`[${botRow.name}] Online`);
    if (!botRow.session_id) {
      try {
        const session = await opencode.createSession(botRow.name);
        botRow.session_id = session.id;
        await db.setBotSession(botRow.id, session.id);
      } catch (e) {}
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
      try { await db.deleteBotSession(botRow.id); botRow.session_id = null; } catch (e) {}
      return msg.reply('Conversa resetada. Ola, em que posso ajudar?').catch(() => {});
    }

    if (content === '!ajuda' || content === '!help') {
      return msg.reply('Comandos:\n`!reset` - reinicia a conversa\n`!ajuda` - mostra esta ajuda\n\nRespondo no PV e ao ser mencionado.').catch(() => {});
    }

    const q = queues.get(id);
    if (!q) return;

    const displayName = msg.author.displayName || msg.author.username;
    q.push({ msg, content, userId: msg.author.id, username: displayName });
    if (q.length === 1) processQueue(botRow);
  });

  client.login(botRow.discord_token.trim()).catch(err => {
    console.error(`[${botRow.name}] Login failed:`, err.message);
  });

  bots.set(id, { client, bot: botRow });
}

async function processQueue(botRow) {
  const id = String(botRow.id);
  const q = queues.get(id);
  if (!q || q.length === 0) return;
  const { msg, content, username } = q[0];

  try {
    const fresh = await db.getBot(botRow.id);
    if (fresh?.system_prompt) botRow.system_prompt = fresh.system_prompt;
    if (!botRow.session_id) {
      const session = await opencode.createSession(botRow.name);
      botRow.session_id = session.id;
      await db.setBotSession(botRow.id, session.id);
    }

    await msg.channel.sendTyping();
    const response = await opencode.sendToBot(botRow.session_id, botRow.system_prompt || null, `[${username}]: ${content}`);
    const text = opencode.extractResponse(response);
    if (text) {
      for (const chunk of text.match(/.{1,2000}/gs) || []) await msg.reply(chunk).catch(() => {});
    }
  } catch (err) {
    console.error(`[${botRow.name}] Error:`, err.message);
    await msg.reply(`Erro: ${err.message.slice(0, 300)}`).catch(() => {});
  }

  q.shift();
  if (q.length > 0) processQueue(botRow);
}

function stop(botId) {
  const entry = bots.get(String(botId));
  if (entry) { entry.client.destroy(); bots.delete(String(botId)); queues.delete(String(botId)); }
}

function isOnline(botId) {
  return !!(bots.get(String(botId))?.client.user);
}

async function restart(botId, botRow) { stop(botId); start(botRow); }

async function loadAll() {
  const all = await db.listBots();
  for (const b of all) start(b);
  console.log(`${all.length} bot(s) loaded`);
}

module.exports = { start, stop, restart, loadAll, isOnline };
