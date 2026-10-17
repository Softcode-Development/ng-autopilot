#!/usr/bin/env node
// Print a project-owned file as sync would create it for this project, even when the
// project already has its own copy — the reference to merge from when a project adopts
// a newer template (e.g. docs/DESIGN_SYSTEM.md after adopting the design-system starter).
//
//   node bin/template.mjs <project-dir> <path>

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderFiles } from './lib/render.mjs';
import { AUTOPILOT_ROOT } from './sync.mjs';

export function renderedProjectFile(projectRoot, rel) {
  const config = JSON.parse(readFileSync(path.join(projectRoot, '.claude', 'autopilot.json'), 'utf8'));
  const file = renderFiles(AUTOPILOT_ROOT, config).files.find((f) => f.kind === 'once' && f.path === rel.replaceAll('\\', '/'));
  return file?.content ?? null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [target, rel] = process.argv.slice(2);
  if (!target || !rel) {
    console.error('usage: node bin/template.mjs <project-dir> <path>');
    process.exit(2);
  }
  const content = renderedProjectFile(path.resolve(target), rel);
  if (content === null) {
    console.error(`${rel} is not a project file sync creates for this project`);
    process.exit(1);
  }
  process.stdout.write(content);
}
