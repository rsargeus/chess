require('dotenv').config();
const esbuild = require('esbuild');

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
  },
});
console.log('Build complete → dist/bundle.js');
