const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const OPENCODE = { hostname: '127.0.0.1', port: 10001 };

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  const opts = {
    hostname: OPENCODE.hostname,
    port: OPENCODE.port,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:10001' },
  };

  const proxy = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OpenCode server unavailable' }));
    }
  });

  req.pipe(proxy);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Hefestos proxy listening on port ${PORT} (opencode on ${OPENCODE.port})`);
});
