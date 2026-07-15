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

  const headers = { ...req.headers };
  delete headers['host'];

  const proxy = http.request({
    hostname: OPENCODE.hostname,
    port: OPENCODE.port,
    path: req.url,
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: ' + err.message);
  });

  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log(`Hefestos proxy => http://0.0.0.0:${PORT} (opencode on :${OPENCODE.port})`);
});
