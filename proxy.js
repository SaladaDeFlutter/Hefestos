const http = require('http');

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  const opts = {
    hostname: '127.0.0.1',
    port: 10001,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:10001' },
  };

  const proxy = http.request(opts, (proxyRes) => {
    const headers = { ...proxyRes.headers };

    if ((req.url.includes('/event') || req.url.includes('/events')) && headers['content-type'] === 'text/html') {
      headers['content-type'] = 'text/event-stream';
    }

    delete headers['transfer-encoding'];
    delete headers['connection'];
    delete headers['keep-alive'];

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream unavailable' }));
    }
  });

  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log(`Proxy :${PORT} -> opencode:10001`);
});
