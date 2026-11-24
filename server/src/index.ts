import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openHistory } from './db.js';
import { createOllamaClient, PREFERRED_MODELS } from './ollama.js';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT ?? 8787);
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const DB_PATH = process.env.DB_PATH ?? resolve(here, '..', 'data', 'parksense.db');
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000);

mkdirSync(dirname(DB_PATH), { recursive: true });

const history = openHistory(DB_PATH);
const ollama = createOllamaClient(OLLAMA_URL, { timeoutMs: TIMEOUT_MS });
const { app, refreshModel } = createApp({
  ollama,
  history,
  preferredModels: PREFERRED_MODELS,
  modelOverride: process.env.OLLAMA_MODEL,
  log: (line) => console.log(`[parksense] ${line}`),
});

const server = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[parksense] API on http://localhost:${PORT}`);
  const s = await refreshModel(true);
  if (!s.reachable) {
    console.log(
      `[parksense] Ollama not reachable at ${OLLAMA_URL} — the app will run in Demo mode.`,
    );
  } else if (!s.model) {
    console.log(
      `[parksense] No vision model found (installed: ${s.installed.join(', ') || 'none'}). Run: ollama pull ${PREFERRED_MODELS[0]}`,
    );
  } else {
    console.log(`[parksense] Using vision model ${s.model}`);
  }
});

function shutdown() {
  server.close(() => {
    history.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
