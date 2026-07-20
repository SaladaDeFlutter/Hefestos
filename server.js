const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const discord = require('./lib/discord');
const opencode = require('./lib/opencode');

const PORT = process.env.PORT || 10000;
const OCPORT = 10001;
const ADMIN = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf-8');

function clientIdFromToken(token) {
  try { return Buffer.from(token.split('.')[0], 'base64').toString(); } catch { return null; }
}
function inviteUrl(token) {
  const cid = clientIdFromToken(token);
  return cid ? `https://discord.com/oauth2/authorize?client_id=${cid}&permissions=2147551232&scope=bot` : null;
}

async function formatPrompt(description) {
  if (!description?.trim()) return null;
  const session = await opencode.createSession('format');
  const resp = await opencode.sendMessage(session.id,
    `Converta isso em um system prompt conciso para IA (3 frases no maximo). Apenas o prompt, sem explicacoes:\n\n"${description}"`
  );
  return opencode.extractResponse(resp)?.trim() || null;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === '/admin') return html(res, ADMIN);
  if (u.pathname === '/admin/api/health') return json(res, { ok: true });

  if (u.pathname === '/admin/api/bots' && req.method === 'GET') {
    const bots = await db.listBots();
    return json(res, bots.map(b => ({
      id: b.id, name: b.name, description: b.description, created_at: b.created_at,
      online: discord.isOnline(b.id),
      invite: inviteUrl(b.discord_token),
      discord_token: b.discord_token,
    })));
  }

  if (u.pathname === '/admin/api/bots' && req.method === 'POST') {
    const { name, discord_token, description } = JSON.parse(await readBody(req));
    if (!name || !discord_token) return json(res, { error: 'Nome e token obrigatorios' }, 400);
    const bot = await db.createBot(name, discord_token, description || null);
    discord.start(bot);
    if (description?.trim()) {
      formatPrompt(description).then(prompt => {
        if (prompt) db.setBotPrompt(bot.id, prompt);
      }).catch(() => {});
    }
    return json(res, bot);
  }

  if (u.pathname.startsWith('/admin/api/bots/') && req.method === 'PUT') {
    const id = parseInt(u.pathname.split('/').pop());
    const { name, discord_token } = JSON.parse(await readBody(req));
    const bot = await db.updateBot(id, name, discord_token);
    discord.restart(id, bot).catch(e => console.error(e));
    return json(res, bot);
  }

  if (u.pathname.startsWith('/admin/api/bots/') && req.method === 'DELETE') {
    const id = parseInt(u.pathname.split('/').pop());
    discord.stop(id);
    await db.deleteBot(id);
    return json(res, { ok: true });
  }

  if (u.pathname.match(/^\/admin\/api\/bots\/\d+\/test$/) && req.method === 'POST') {
    const id = parseInt(u.pathname.split('/')[4]);
    const bot = await db.getBot(id);
    if (!bot) return json(res, { error: 'Not found' }, 404);
    try {
      const r = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${bot.discord_token.trim()}` } });
      const data = await r.json();
      return json(res, { ok: r.ok, username: data.username, error: r.ok ? null : data.message });
    } catch (e) { return json(res, { ok: false, error: e.message }); }
  }

  if (u.pathname.match(/^\/admin\/api\/bots\/\d+\/customize$/) && req.method === 'POST') {
    const id = parseInt(u.pathname.split('/')[4]);
    const bot = await db.getBot(id);
    if (!bot) return json(res, { error: 'Not found' }, 404);
    try {
      const body = await readBody(req);
      const { username, avatar } = JSON.parse(body);
      const payload = {};
      if (username) payload.username = username;
      if (avatar) payload.avatar = avatar;
      if (Object.keys(payload).length) {
        await fetch('https://discord.com/api/v10/users/@me', {
          method: 'PATCH', headers: { Authorization: `Bot ${bot.discord_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (username) await db.updateBot(id, username, bot.discord_token);
      }
      return json(res, { ok: true });
    } catch (e) { return json(res, { error: e.message }, 400); }
  }

  proxy(req, res);
});

function proxy(req, res) {
  const opts = {
    hostname: '127.0.0.1', port: OCPORT, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${OCPORT}` },
  };
  const p = http.request(opts, (pr) => {
    const h = { ...pr.headers };
    if (req.url.includes('/event') && h['content-type'] === 'text/html')
      h['content-type'] = 'text/event-stream';
    delete h['transfer-encoding'];
    res.writeHead(pr.statusCode, h);
    pr.pipe(res);
  });
  p.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end(); } });
  req.pipe(p);
}

function html(res, body) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(body); }
function json(res, data, code = 200) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); }); }

server.listen(PORT, async () => {
  console.log(`Hefestos :${PORT} -> opencode :${OCPORT}`);
  await db.migrate();
  await discord.loadAll();
});
