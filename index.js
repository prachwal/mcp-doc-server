#!/usr/bin/env node
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env if present (non-fatal if missing)
try {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
} catch {
  // dotenv optional
}

const requiredEnvVars = ['SKILLS_DIR', 'API_KEYS'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`[mcp-doc-server] Missing required environment variables: ${missing.join(', ')}`);
  console.error('Set them in .env or export them before starting.');
  process.exit(1);
}

const { startServer } = await import('./lib/server.js');
await startServer();
