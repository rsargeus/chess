require('dotenv').config();
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.buildSync({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  define: {
    '__AUTH0_DOMAIN__':     JSON.stringify(process.env.AUTH0_DOMAIN    ?? ''),
    '__AUTH0_CLIENT_ID__':  JSON.stringify(process.env.AUTH0_CLIENT_ID  ?? ''),
    '__AUTH0_AUDIENCE__':   JSON.stringify(process.env.AUTH0_AUDIENCE   ?? ''),
    '__BACKEND_URL__':      JSON.stringify(process.env.BACKEND_URL      ?? ''),
    '__WS_URL__':           JSON.stringify((process.env.BACKEND_URL ?? '').replace(/^http/, 'ws')),
  },
});

// Copy static assets to dist/
const imageFiles = ['src/chess-hero.png', 'src/chess-welcome.png', 'src/favicon.svg', 'src/sw.js'];
for (const file of imageFiles) {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', path.basename(file)));
  }
}

// Copy public/ directory to dist/
const publicDir = 'public';
if (fs.existsSync(publicDir)) {
  for (const file of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, file), path.join('dist', file));
  }
}

// Copy index.html and rewrite asset paths for production
let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace('/dist/bundle.js', '/bundle.js');
html = html.replace('/src/chess-hero.png', '/chess-hero.png');
html = html.replace('/src/chess-welcome.png', '/chess-welcome.png');
html = html.replace('/src/favicon.svg', '/favicon.svg');
fs.writeFileSync('dist/index.html', html);

// Copy privacy.html
let privacy = fs.readFileSync('src/privacy.html', 'utf8');
privacy = privacy.replace('/src/favicon.svg', '/favicon.svg');
fs.writeFileSync('dist/privacy.html', privacy);

console.log('Build complete → dist/');
