#!/usr/bin/env node
// The browser agents drive: starts the Playwright MCP server (@playwright/mcp) that the
// project's .mcp.json registers as `playwright`. Headless Chrome, locally and in cloud sessions.
//
//   node tools/autopilot/browser/mcp.mjs     (.mcp.json runs it; MCP over stdio)
//
// - Browser: CHROME_BIN, else Chrome or Edge in the platform's standard location — on a cloud
//   VM the Chrome for Testing that tools/autopilot/cloud/setup.sh installs. Never downloads one.
// - Signed in: loads .claude/browser/storage-state.json, which the owner saves once with
//   `node tools/autopilot/browser/sign-in.mjs <url>`. In a cloud session, the environment
//   variable AUTOPILOT_BROWSER_STORAGE_STATE (that file's JSON, or base64 of it) writes it first.
// - Output (screenshots, snapshots) goes to .claude/tmp/browser/.
// - AUTOPILOT_BROWSER_HEADED=1 shows the window, to watch an agent work locally.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLAYWRIGHT_MCP = '@playwright/mcp@__PLAYWRIGHT_MCP__';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const STORAGE_STATE = '.claude/browser/storage-state.json';

/** CHROME_BIN, else Chrome (then Edge) in the platform's standard install location. */
export function findBrowser(env = process.env, platform = process.platform, exists = existsSync) {
  if (env.CHROME_BIN) return env.CHROME_BIN;
  const candidates = [];
  if (platform === 'win32') {
    const bases = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
    for (const base of bases) candidates.push(path.win32.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    for (const base of bases) candidates.push(path.win32.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
  } else {
    const dirs = (env.PATH ?? '').split(':').filter(Boolean).concat('/usr/bin');
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) for (const dir of dirs) candidates.push(`${dir}/${name}`);
    candidates.push('/opt/chrome-linux64/chrome');
  }
  return candidates.find((c) => exists(c));
}

/** The storage state from AUTOPILOT_BROWSER_STORAGE_STATE (JSON, or base64 of it), or null. */
export function storageStateFromEnv(value) {
  if (!value?.trim()) return null;
  const text = value.trim().startsWith('{') ? value.trim() : Buffer.from(value.trim(), 'base64').toString('utf8');
  JSON.parse(text);
  return text;
}

export function mcpArgs({ root = ROOT, env = process.env, browser = findBrowser(env), exists = existsSync } = {}) {
  const args = [PLAYWRIGHT_MCP, '--isolated', '--output-dir', path.join(root, '.claude', 'tmp', 'browser'), '--viewport-size', '1280x800'];
  if (env.AUTOPILOT_BROWSER_HEADED !== '1') args.push('--headless');
  if (browser) args.push('--executable-path', browser);
  else args.push('--browser', 'chrome');
  // A cloud VM runs everything as root, where Chrome's sandbox cannot start.
  if (env.CLAUDE_CODE_REMOTE === 'true') args.push('--no-sandbox');
  const state = path.join(root, STORAGE_STATE);
  if (exists(state)) args.push('--storage-state', state);
  return args;
}

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const state = storageStateFromEnv(process.env.AUTOPILOT_BROWSER_STORAGE_STATE);
    if (state && !existsSync(path.join(ROOT, STORAGE_STATE))) {
      mkdirSync(path.dirname(path.join(ROOT, STORAGE_STATE)), { recursive: true });
      writeFileSync(path.join(ROOT, STORAGE_STATE), state);
    }
  } catch (e) {
    console.error(`[autopilot browser] AUTOPILOT_BROWSER_STORAGE_STATE is not a storage-state JSON (or base64 of one): ${e.message}`);
  }
  if (!findBrowser()) console.error('[autopilot browser] no Chrome or Edge found in the standard locations — set CHROME_BIN; in a cloud session, add tools/autopilot/cloud/setup.sh as the environment setup script');
  const args = ['-y', ...mcpArgs()];
  // On Windows `npx` is a .cmd shim that cannot be spawned without a shell.
  const child = process.platform === 'win32'
    ? spawn(`npx ${args.map(quote).join(' ')}`, { stdio: 'inherit', shell: true, cwd: ROOT })
    : spawn('npx', args, { stdio: 'inherit', cwd: ROOT });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
  child.on('error', (e) => {
    console.error(e.message);
    process.exit(1);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
}
