require('dotenv').config();
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Clean old hashed bundle files from previous builds
if (fs.existsSync('dist')) {
  for (const f of fs.readdirSync('dist')) {
    if (/^bundle-[a-zA-Z0-9]+\.js(\.map)?$/.test(f)) fs.unlinkSync(path.join('dist', f));
  }
} else {
  fs.mkdirSync('dist');
}

const result = esbuild.buildSync({
  entryPoints: [{ in: 'src/main.ts', out: 'bundle' }],
  bundle: true,
  outdir: 'dist',
  entryNames: '[name]-[hash]',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  metafile: true,
  define: {
    '__AUTH0_DOMAIN__':     JSON.stringify(process.env.AUTH0_DOMAIN    ?? ''),
    '__AUTH0_CLIENT_ID__':  JSON.stringify(process.env.AUTH0_CLIENT_ID  ?? ''),
    '__AUTH0_AUDIENCE__':   JSON.stringify(process.env.AUTH0_AUDIENCE   ?? ''),
    '__BACKEND_URL__':      JSON.stringify(process.env.BACKEND_URL      ?? ''),
    '__WS_URL__':           JSON.stringify((process.env.BACKEND_URL ?? '').replace(/^http/, 'ws')),
  },
});

// Resolve hashed bundle filename from metafile (e.g. "bundle-A1B2C3D4.js")
const bundleFile = Object.keys(result.metafile.outputs)
  .find(f => f.endsWith('.js') && !f.endsWith('.js.map'));
const bundleFilename = path.basename(bundleFile);

// Copy static assets to dist/
for (const file of ['src/chess-hero.png', 'src/chess-welcome.png', 'src/favicon.svg']) {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join('dist', path.basename(file)));
}

// Copy public/ directory to dist/
const publicDir = 'public';
if (fs.existsSync(publicDir)) {
  for (const file of fs.readdirSync(publicDir)) {
    fs.copyFileSync(path.join(publicDir, file), path.join('dist', file));
  }
}

// Copy sw.js and patch: fresh cache version + hashed bundle filename
const cacheVersion = `chess-arena-${Date.now()}`;
let sw = fs.readFileSync('src/sw.js', 'utf8');
sw = sw.replace("'chess-arena-v2'", `'${cacheVersion}'`);
sw = sw.replace("'/bundle.js'", `'/${bundleFilename}'`);
fs.writeFileSync('dist/sw.js', sw);

// Copy index.html and rewrite asset paths for production
let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace('/dist/bundle.js', `/${bundleFilename}`);
html = html.replace('/src/chess-hero.png', '/chess-hero.png');
html = html.replace('/src/chess-welcome.png', '/chess-welcome.png');
html = html.replace('/src/favicon.svg', '/favicon.svg');
fs.writeFileSync('dist/index.html', html);

// Copy privacy.html
let privacy = fs.readFileSync('src/privacy.html', 'utf8');
privacy = privacy.replace('/src/favicon.svg', '/favicon.svg');
fs.writeFileSync('dist/privacy.html', privacy);

console.log(`Build complete → dist/ (bundle: ${bundleFilename}, cache: ${cacheVersion})`);
