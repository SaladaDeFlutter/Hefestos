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
    console.log(`[${botRow.name}] Bot online: ${client.user.tag}`);
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
      await msg.reply('Sua conversa foi resetada.');
      return;
    }

    await msg.channel.sendTyping();
    const userId = msg.author.id;

    try {
      await opencode.setAuth(botRow.provider, botRow.api_key);

      let sessionId = await db.getSession(botRow.id, userId);
      if (!sessionId) {
        const session = await opencode.createSession(`${msg.author.username}`);
        sessionId = session.id;
        await db.saveSession(botRow.id, userId, sessionId);
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
        await msg.reply('Resposta vazia.');
      }
    } catch (err) {
      console.error(`[${botRow.name}] Erro:`, err.message);
      await msg.reply(`Erro: ${err.message}`);
    }
  });

  client.login(botRow.discord_token).catch(err => {
    console.error(`[${botRow.name}] Login falhou:`, err.message);
  });

  bots.set(id, { client, bot: botRow });
}

async function stop(botId) {
  const id = String(botId);
  const entry = bots.get(id);
  if (entry) {
    entry.client.destroy();
    bots.delete(id);
    console.log(`[${entry.bot.name}] Bot stopped`);
  }
}

async function restart(botId, botRow) {
  await stop(botId);
  start(botRow);
}

async function loadAll() {
  const all = await db.listBots();
  for (const b of all) start(b);
  console.log(`${all.length} bots loaded`);
}

module.exports = { start, stop, restart, loadAll };
