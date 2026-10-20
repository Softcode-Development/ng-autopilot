#!/usr/bin/env node
// Is a dev server already answering? Agents ask this before starting a server, so
// they reuse the one that runs (often the owner's) instead of starting a second one.
//
//   node tools/autopilot/server/listening.mjs 4200
//   node tools/autopilot/server/listening.mjs http://localhost:4200/orders 3000
//
// Prints one line per target; exit 0 when every target answers, 1 otherwise.
// Any HTTP status counts as listening — a 404 still means a server owns the port.

import { fileURLToPath } from 'node:url';

export const toUrl = (target) => (/^\d+$/.test(String(target)) ? `http://localhost:${target}/` : String(target));

export async function listening(target, { timeoutMs = 3000 } = {}) {
  const url = toUrl(target);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return { url, listening: true, status: res.status };
  } catch {
    return { url, listening: false };
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error('usage: listening.mjs <port | url> [...]');
    process.exit(2);
  }
  const results = await Promise.all(targets.map((t) => listening(t)));
  for (const r of results) console.log(r.listening ? `listening ${r.url} (HTTP ${r.status})` : `not listening ${r.url}`);
  process.exit(results.every((r) => r.listening) ? 0 : 1);
}
