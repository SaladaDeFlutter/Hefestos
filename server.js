const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const discord = require('./lib/discord');

const PORT = process.env.PORT || 10000;
const OCPORT = 10001;
const ADMIN = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf-8');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === '/admin') return html(res, ADMIN);
  if (u.pathname === '/admin/api/health') return json(res, { ok: true });

  if (u.pathname === '/admin/api/bots' && req.method === 'GET') {
    return json(res, await db.listBots());
  }
  if (u.pathname === '/admin/api/bots' && req.method === 'POST') {
    const { name, discord_token } = JSON.parse(await readBody(req));
    if (!name || !discord_token) return json(res, 400, { error: 'name e discord_token obrigatórios' });
    const bot = await db.createBot(name, discord_token);
    discord.start(bot);
    return json(res, bot);
  }
  if (u.pathname.startsWith('/admin/api/bots/')) {
    const id = parseInt(u.pathname.split('/').pop());
    if (req.method === 'PUT') {
      const { name, discord_token } = JSON.parse(await readBody(req));
      const bot = await db.updateBot(id, name, discord_token);
      discord.restart(id, bot).catch(e => console.error(e));
      return json(res, bot);
    }
    if (req.method === 'DELETE') {
      discord.stop(id);
      await db.deleteBot(id);
      return json(res, { ok: true });
    }
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

function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}
function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
}

server.listen(PORT, async () => {
  console.log(`Hefestos :${PORT} → opencode :${OCPORT}`);
  await db.migrate();
  discord.loadAll();
});
