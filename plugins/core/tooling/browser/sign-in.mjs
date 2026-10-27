#!/usr/bin/env node
// The owner signs in once; agents then browse signed in. Agents never type credentials.
//
//   node tools/autopilot/browser/sign-in.mjs <url> [<url>...]
//
// Opens a Chrome window (Playwright, the installed Chrome or Edge) on each URL. Sign in —
// on every origin the visual gate needs — then close the window: cookies and local storage go
// to .claude/browser/storage-state.json (git-ignored), which tools/autopilot/browser/mcp.mjs
// loads into every agent browser session. Run it again when the session expires; an existing
// file is loaded first, so one run can add an origin without losing the others.
//
// For a cloud session, put the file into the environment variable AUTOPILOT_BROWSER_STORAGE_STATE
// (its JSON, or `base64 -w0` of it) in the cloud environment's settings at claude.ai/code.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findBrowser, ROOT, STORAGE_STATE } from './mcp.mjs';

export const PLAYWRIGHT = 'playwright@__PLAYWRIGHT__';

export function signInArgs(urls, { root = ROOT, browser = findBrowser(), exists = existsSync } = {}) {
  const state = path.join(root, STORAGE_STATE);
  const args = [PLAYWRIGHT, 'open', '--channel', /msedge|edge/i.test(browser ?? '') ? 'msedge' : 'chrome', '--save-storage', state];
  if (exists(state)) args.push('--load-storage', state);
  return [...args, ...urls];
}

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error('usage: sign-in.mjs <url> [<url>...]   e.g. node tools/autopilot/browser/sign-in.mjs http://localhost:4200/login');
    process.exit(2);
  }
  mkdirSync(path.join(ROOT, path.dirname(STORAGE_STATE)), { recursive: true });
  const args = ['-y', ...signInArgs(urls)];
  console.log(`Sign in in the window that opens, then close it. Saving to ${STORAGE_STATE}.`);
  const child = process.platform === 'win32'
    ? spawn(`npx ${args.map(quote).join(' ')}`, { stdio: 'inherit', shell: true, cwd: ROOT })
    : spawn('npx', args, { stdio: 'inherit', cwd: ROOT });
  child.on('exit', (code) => {
    if (code === 0 && existsSync(path.join(ROOT, STORAGE_STATE))) console.log(`Saved ${STORAGE_STATE}.`);
    process.exit(code ?? 1);
  });
}
