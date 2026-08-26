#!/usr/bin/env node
/**
 * Verifies the Groq model hardcoded in coaching.ts still exists in Groq's
 * model list. Groq retires models without notice — this is what "Ask coach"
 * broke on in production once already (llama-3.1-8b-instant 404'd).
 * Not part of `npm test` (needs a real GROQ_API_KEY + network) — run before
 * deploys or periodically via cron: `npm run check-groq-model`.
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error('check-groq-model: GROQ_API_KEY not set');
  process.exit(1);
}

const coachingSrc = fs.readFileSync(path.resolve(__dirname, '../src/coaching.ts'), 'utf8');
const match = coachingSrc.match(/model:\s*'([^']+)'/);
if (!match) {
  console.error('check-groq-model: could not find a model string in src/coaching.ts');
  process.exit(1);
}
const configuredModel = match[1];

fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: `Bearer ${apiKey}` },
})
  .then(res => {
    if (!res.ok) throw new Error(`Groq /models returned ${res.status}`);
    return res.json();
  })
  .then(({ data }) => {
    const ids = data.map(m => m.id);
    if (ids.includes(configuredModel)) {
      console.log(`check-groq-model: OK — '${configuredModel}' is live on Groq`);
      process.exit(0);
    }
    console.error(`check-groq-model: FAIL — '${configuredModel}' is not in Groq's current model list`);
    console.error(`Available models: ${ids.join(', ')}`);
    process.exit(1);
  })
  .catch(err => {
    console.error('check-groq-model: request failed —', err.message);
    process.exit(1);
  });
