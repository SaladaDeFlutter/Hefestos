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

  if (u.pathname === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(ADMIN);
  }

  if (u.pathname === '/admin/api/bots' && req.method === 'GET') {
    const bots = await db.listBots();
    return json(res, 200, bots);
  }

  if (u.pathname === '/admin/api/bots' && req.method === 'POST') {
    const b = await readBody(req);
    const { name, provider, model, api_key, discord_token } = JSON.parse(b);
    const bot = await db.createBot(name, provider, model, api_key, discord_token);
    discord.start(bot);
    return json(res, 200, bot);
  }

  if (u.pathname.startsWith('/admin/api/bots/') && req.method === 'PUT') {
    const id = parseInt(u.pathname.split('/').pop());
    const b = await readBody(req);
    const { name, provider, model, api_key, discord_token } = JSON.parse(b);
    const bot = await db.updateBot(id, name, provider, model, api_key, discord_token);
    discord.restart(id, bot).catch(e => console.error(e));
    return json(res, 200, bot);
  }

  if (u.pathname.startsWith('/admin/api/bots/') && req.method === 'DELETE') {
    const id = parseInt(u.pathname.split('/').pop());
    await discord.stop(id);
    await db.deleteBot(id);
    return json(res, 200, { ok: true });
  }

  if (u.pathname === '/admin/api/health') {
    return json(res, 200, { ok: true });
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
    if ((req.url.includes('/event')) && h['content-type'] === 'text/html')
      h['content-type'] = 'text/event-stream';
    delete h['transfer-encoding'];
    res.writeHead(pr.statusCode, h);
    pr.pipe(res);
  });
  p.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end(); } });
  req.pipe(p);
}

function json(res, code, data) {
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
