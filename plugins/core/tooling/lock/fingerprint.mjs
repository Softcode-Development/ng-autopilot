// Fingerprints of generated files, stored in .claude/autopilot.lock.json by sync.
// Line endings are normalised so a Windows autocrlf checkout is not a change.

import { createHash } from 'node:crypto';

export const LOCK_PATH = '.claude/autopilot.lock.json';
export const GENERATED_ROOTS = ['.claude/rules/autopilot/', 'tools/autopilot/'];

export function fingerprint(content) {
  return createHash('sha256').update(String(content).replace(/\r\n/g, '\n')).digest('hex');
}
