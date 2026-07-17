const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');
const discord = require('./lib/discord');
const opencode = require('./lib/opencode');

const PORT = process.env.PORT || 10000;
const OPENCODE_PORT = 10001;
const ADMIN_HTML = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf-8');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/admin') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(ADMIN_HTML);
    return;
  }

  if (url.pathname === '/admin/api/configs' && req.method === 'GET') {
    const configs = await db.listConfigs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(configs));
    return;
  }

  if (url.pathname === '/admin/api/configs' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { guild_id, guild_name, provider, model, api_key, discord_token } = JSON.parse(body);
      const config = await db.upsertConfig(guild_id, guild_name, provider, model, api_key, discord_token);
      if (discord_token) {
        discord.restart(guild_id, config).catch(err => console.error('Discord restart error:', err.message));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname.startsWith('/admin/api/configs/') && req.method === 'DELETE') {
    const guildId = url.pathname.split('/').pop();
    await discord.stop(guildId);
    await db.deleteConfig(guildId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/admin/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  proxyToOpenCode(req, res);
});

function proxyToOpenCode(req, res) {
  const opts = {
    hostname: '127.0.0.1',
    port: OPENCODE_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${OPENCODE_PORT}` },
  };

  const proxy = http.request(opts, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    if ((req.url.includes('/event') || req.url.includes('/events')) && headers['content-type'] === 'text/html') {
      headers['content-type'] = 'text/event-stream';
    }
    delete headers['transfer-encoding'];
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end();
    }
  });

  req.pipe(proxy);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

async function init() {
  await db.migrate();
  await discord.loadAll();
}

server.listen(PORT, () => {
  console.log(`Hefestos on port ${PORT} (opencode on ${OPENCODE_PORT})`);
  init();
});
