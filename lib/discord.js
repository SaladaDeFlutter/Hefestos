const { Client, GatewayIntentBits } = require('discord.js');
const db = require('./db');
const opencode = require('./opencode');

let client = null;

function start(token) {
  if (client) client.destroy();

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.on('ready', () => {
    console.log(`Discord bot ready: ${client.user.tag}`);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;
    const isDM = !msg.guild;
    const isMention = msg.mentions.has(client.user);
    if (!isDM && !isMention) return;

    const guildId = isDM ? msg.author.id : msg.guild.id;
    const config = await db.getConfig(guildId);
    if (!config) {
      if (isDM) await msg.reply('Este bot não está configurado. Use o painel admin para configurar.');
      return;
    }

    const content = msg.content.replace(/<@!?\d+>/g, '').trim();
    if (!content) return;

    const typing = msg.channel.sendTyping();
    const channelId = msg.channel.id;
    const userId = msg.author.id;

    try {
      await opencode.setAuth(config.provider, config.api_key);

      let sessionId = await db.getSession(userId, channelId);
      if (!sessionId) {
        const session = await opencode.createSession(`${msg.author.username}-${channelId}`);
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
        await msg.reply('Recebi a resposta, mas está vazia.');
      }
    } catch (err) {
      console.error('Discord error:', err.message);
      if (!isDM) await msg.reply(`Erro: ${err.message}`);
    } finally {
      await typing;
    }
  });

  return client.login(token);
}

async function stop() {
  if (client) {
    client.destroy();
    client = null;
  }
}

module.exports = { start, stop };
