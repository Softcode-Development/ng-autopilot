import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listening, toUrl } from '../server/listening.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'listening.mjs');

async function withServer(status, fn) {
  const server = createServer((_, res) => res.writeHead(status).end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// A port that was free a moment ago: bind it, release it, use it.
const freePort = () => withServer(200, (port) => port);

function run(...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.on('close', (code) => resolve({ code, stdout }));
  });
}

test('a port becomes a localhost URL; a URL stays as given', () => {
  assert.equal(toUrl(4200), 'http://localhost:4200/');
  assert.equal(toUrl('4200'), 'http://localhost:4200/');
  assert.equal(toUrl('http://127.0.0.1:3000/health'), 'http://127.0.0.1:3000/health');
});

test('any HTTP answer counts as listening, a 404 too; a closed port does not', async () => {
  await withServer(404, async (port) => {
    assert.deepEqual(await listening(`http://127.0.0.1:${port}/`), { url: `http://127.0.0.1:${port}/`, listening: true, status: 404 });
  });
  const port = await freePort();
  assert.equal((await listening(`http://127.0.0.1:${port}/`)).listening, false);
});

test('CLI: one line per target, exit 0 only when every target answers', async () => {
  const closed = await freePort();
  await withServer(200, async (port) => {
    const up = await run(`http://127.0.0.1:${port}/`);
    assert.equal(up.code, 0);
    assert.match(up.stdout, /^listening http:\/\/127\.0\.0\.1:\d+\/ \(HTTP 200\)/);
    const mixed = await run(`http://127.0.0.1:${port}/`, `http://127.0.0.1:${closed}/`);
    assert.equal(mixed.code, 1);
    assert.match(mixed.stdout, /not listening http:\/\/127\.0\.0\.1:\d+\//);
  });
  assert.equal((await run()).code, 2);
});
