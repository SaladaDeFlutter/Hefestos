const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');
const opencode = require('./opencode');

const bots = new Map();

function start(guildId, config) {
  const existing = bots.get(guildId);
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
    console.log(`[${guildId}] Bot ready: ${client.user.tag}`);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const isDM = !msg.guild;
    const isMention = msg.mentions.has(client.user);
    if (!isDM && !isMention) return;

    if (!isDM && msg.guild.id !== guildId) return;

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    await msg.channel.sendTyping();

    const channelId = msg.channel.id;
    const userId = msg.author.id;

    try {
      await opencode.setAuth(config.provider, config.api_key);

      let sessionId = await db.getSession(userId, channelId);
      if (!sessionId) {
        const session = await opencode.createSession(`${msg.author.username}`);
        sessionId = session.id;
        await db.saveSession(guildId, channelId, userId, sessionId);
      }

      const response = await opencode.sendMessage(sessionId, content);
      const text = opencode.extractResponse(response);

      if (text) {
        if (text.length > 2000) {
          for (let i = 0; i < text.length; i += 2000) {
            await msg.reply(text.slice(i, i + 2000));
          }
        } else {
          await msg.reply(text);
        }
      } else {
        await msg.reply('Recebi resposta vazia.');
      }
    } catch (err) {
      console.error(`[${guildId}] Erro:`, err.message);
      if (!isDM) await msg.reply(`Erro: ${err.message}`);
    }
  });

  client.login(config.discord_token).catch(err => {
    console.error(`[${guildId}] Login falhou:`, err.message);
  });

  bots.set(guildId, { client, config });
}

async function stop(guildId) {
  const entry = bots.get(guildId);
  if (entry) {
    entry.client.destroy();
    bots.delete(guildId);
    console.log(`[${guildId}] Bot stopped`);
  }
}

async function restart(guildId, config) {
  await stop(guildId);
  start(guildId, config);
}

async function loadAll() {
  const configs = await db.listConfigs();
  for (const c of configs) {
    if (c.discord_token) {
      start(c.guild_id, c);
    }
  }
  console.log(`Loaded ${configs.length} bot configs`);
}

module.exports = { start, stop, restart, loadAll };
