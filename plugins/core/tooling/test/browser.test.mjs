import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { findBrowser, mcpArgs, STORAGE_STATE, storageStateFromEnv } from '../browser/mcp.mjs';
import { signInArgs } from '../browser/sign-in.mjs';

const root = path.resolve('/project');
const state = path.join(root, STORAGE_STATE);

test('browser: CHROME_BIN first, then Chrome before Edge on Windows, then the cloud Chrome for Testing on Linux', () => {
  assert.equal(findBrowser({ CHROME_BIN: '/x/chrome' }, 'linux', () => false), '/x/chrome');
  const win = { PROGRAMFILES: 'C:\\Program Files', LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' };
  const edge = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
  const chrome = 'C:\\Users\\a\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(findBrowser(win, 'win32', (p) => p === edge || p === chrome), chrome);
  assert.equal(findBrowser(win, 'win32', (p) => p === edge), edge);
  assert.equal(findBrowser({ PATH: '/usr/local/bin:/usr/bin' }, 'linux', (p) => p === '/opt/chrome-linux64/chrome'), '/opt/chrome-linux64/chrome');
  assert.equal(findBrowser({ PATH: '/usr/local/bin' }, 'linux', (p) => p === '/usr/local/bin/google-chrome'), '/usr/local/bin/google-chrome');
  assert.equal(findBrowser({}, 'linux', () => false), undefined);
});

test('MCP args: isolated, headless, output in .claude/tmp/browser, the found browser; the saved sign-in when there is one', () => {
  const args = mcpArgs({ root, env: {}, browser: '/opt/chrome-linux64/chrome', exists: () => false });
  assert.match(args[0], /^@playwright\/mcp@/);
  for (const a of ['--isolated', '--headless']) assert.ok(args.includes(a), a);
  assert.equal(args[args.indexOf('--output-dir') + 1], path.join(root, '.claude', 'tmp', 'browser'));
  assert.equal(args[args.indexOf('--executable-path') + 1], '/opt/chrome-linux64/chrome');
  assert.ok(!args.includes('--storage-state') && !args.includes('--no-sandbox'));

  const signedIn = mcpArgs({ root, env: { CLAUDE_CODE_REMOTE: 'true' }, browser: '/c', exists: (p) => p === state });
  assert.equal(signedIn[signedIn.indexOf('--storage-state') + 1], state);
  assert.ok(signedIn.includes('--no-sandbox'), 'root on a cloud VM');
});

test('MCP args: AUTOPILOT_BROWSER_HEADED=1 shows the window; no browser found falls back to the chrome channel', () => {
  const args = mcpArgs({ root, env: { AUTOPILOT_BROWSER_HEADED: '1' }, browser: undefined, exists: () => false });
  assert.ok(!args.includes('--headless'));
  assert.equal(args[args.indexOf('--browser') + 1], 'chrome');
});

test('storage state from the environment: JSON or base64 of it; anything else is refused', () => {
  const json = '{"cookies":[],"origins":[]}';
  assert.equal(storageStateFromEnv(json), json);
  assert.equal(storageStateFromEnv(Buffer.from(json).toString('base64')), json);
  assert.equal(storageStateFromEnv(''), null);
  assert.equal(storageStateFromEnv(undefined), null);
  assert.throws(() => storageStateFromEnv('not-a-state'));
});

test('sign-in: saves to the storage-state file, loads an existing one first, opens Edge when that is the browser', () => {
  const fresh = signInArgs(['http://localhost:4200/login'], { root, browser: 'C:\\Chrome\\chrome.exe', exists: () => false });
  assert.deepEqual(fresh.slice(1), ['open', '--channel', 'chrome', '--save-storage', state, 'http://localhost:4200/login']);
  const again = signInArgs(['http://a', 'http://b'], { root, browser: 'C:\\Edge\\msedge.exe', exists: () => true });
  assert.deepEqual(again.slice(1), ['open', '--channel', 'msedge', '--save-storage', state, '--load-storage', state, 'http://a', 'http://b']);
});
