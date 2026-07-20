const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');
const opencode = require('./opencode');

const bots = new Map();

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

  client.on('ready', () => {
    console.log(`[${botRow.name}] Online: ${client.user.tag}`);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const isDM = !msg.guild;
    const isMention = !isDM && msg.mentions.has(client.user);
    if (!isDM && !isMention) return;

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    if (content === '!reset') {
      await db.deleteSession(botRow.id, msg.author.id);
      await msg.reply('Conversa resetada.');
      return;
    }

    await msg.channel.sendTyping();

    try {
      let sessionId = await db.getSession(botRow.id, msg.author.id);
      if (!sessionId) {
        const session = await opencode.createSession(msg.author.username);
        sessionId = session.id;
        await db.saveSession(botRow.id, msg.author.id, sessionId);
      }

      const response = await opencode.sendWithContext(sessionId, content);
      const text = opencode.extractResponse(response);

      if (text) {
        const chunks = text.match(/.{1,2000}/gs) || [];
        for (const chunk of chunks) await msg.reply(chunk);
      } else {
        await msg.reply('Resposta vazia.');
      }
    } catch (err) {
      console.error(`[${botRow.name}] Erro:`, err.message);
      await msg.reply(`Erro: ${err.message.slice(0, 500)}`).catch(() => {});
    }
  });

  client.login(botRow.discord_token).catch(err => {
    console.error(`[${botRow.name}] Login:`, err.message);
  });

  bots.set(id, { client, bot: botRow });
}

function stop(botId) {
  const entry = bots.get(String(botId));
  if (entry) { entry.client.destroy(); bots.delete(String(botId)); }
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
