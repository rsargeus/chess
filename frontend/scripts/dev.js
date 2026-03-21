require('dotenv').config();
const esbuild = require('esbuild');
const http = require('http');
const fs = require('fs');
const path = require('path');

const clients = [];

esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  banner: { js: '(() => { const es = new EventSource("/esbuild"); es.onmessage = () => location.reload(); })();' },
  define: {
    '__AUTH0_DOMAIN__':     JSON.stringify(process.env.AUTH0_DOMAIN    ?? ''),
    '__AUTH0_CLIENT_ID__':  JSON.stringify(process.env.AUTH0_CLIENT_ID  ?? ''),
    '__AUTH0_AUDIENCE__':   JSON.stringify(process.env.AUTH0_AUDIENCE   ?? ''),
    '__BACKEND_URL__':      JSON.stringify(''),
  },
}).then(ctx => {
  ctx.watch();

  http.createServer((req, res) => {
    // Proxy /games and /checkout to backend
    if (req.url.startsWith('/games') || req.url.startsWith('/checkout')) {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: 'localhost:3000' },
      };
      const proxy = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxy.on('error', () => res.writeHead(502).end('Backend unavailable'));
      req.pipe(proxy);
      return;
    }

    // SSE for live reload
    if (req.url === '/esbuild') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      clients.push(res);
      req.on('close', () => clients.splice(clients.indexOf(res), 1));
      return;
    }

    // Serve static files
    let filePath = req.url === '/' ? 'src/index.html' : req.url.startsWith('/dist') ? req.url.slice(1) : req.url.startsWith('/src/') ? req.url.slice(1) : 'src/index.html';
    const ext = path.extname(filePath);
    const contentType = ext === '.js' ? 'application/javascript' : ext === '.map' ? 'application/json' : ext === '.css' ? 'text/css' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'text/html';
    try {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fs.readFileSync(filePath));
    } catch {
      res.writeHead(404).end('Not found');
    }
  }).listen(5173, () => console.log('Frontend dev server → http://localhost:5173'));
});
