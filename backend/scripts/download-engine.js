#!/usr/bin/env node
/**
 * Downloads the official Stockfish native binary for Linux x86-64.
 * Runs as part of `npm install` (postinstall) on Render.
 * Skipped silently on macOS/Windows — those use the ASM.js fallback.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

if (process.platform !== 'linux') {
  process.exit(0);
}

const binDir  = path.resolve(__dirname, '../bin');
const outFile = path.join(binDir, 'stockfish');

if (fs.existsSync(outFile)) {
  console.log('stockfish: native binary already present, skipping download');
  process.exit(0);
}

fs.mkdirSync(binDir, { recursive: true });

// Stockfish 17 — most-compatible x86-64 build (no AVX2/BMI2 required)
const url     = 'https://github.com/official-stockfish/Stockfish/releases/download/sf_17/stockfish-ubuntu-x86-64.tar';
const tarFile = '/tmp/stockfish-sf17.tar';
const tmpDir  = '/tmp/stockfish-sf17';

try {
  console.log('stockfish: downloading native binary from GitHub releases…');
  execSync(`curl -fsSL -o "${tarFile}" "${url}"`, { stdio: 'inherit' });
  fs.mkdirSync(tmpDir, { recursive: true });
  execSync(`tar -xf "${tarFile}" -C "${tmpDir}"`, { stdio: 'inherit' });

  // The archive contains stockfish/stockfish-ubuntu-x86-64
  const extracted = path.join(tmpDir, 'stockfish', 'stockfish-ubuntu-x86-64');
  if (!fs.existsSync(extracted)) {
    throw new Error(`Expected binary not found at ${extracted}`);
  }

  fs.copyFileSync(extracted, outFile);
  fs.chmodSync(outFile, 0o755);
  console.log('stockfish: native binary ready at', outFile);
} catch (err) {
  console.warn('stockfish: failed to download native binary, will fall back to ASM.js:', err.message);
  // Non-fatal — ASM.js build still works, just slower
}
