#!/usr/bin/env node
// OpenAPI tooling, configured in .claude/golden.json → nestjs.openapi:
// {
//   "snapshot": "apps/api/openapi.json",
//   "triggers": ["^apps/api/src/.*\\.(controller|dto|schema|module)\\.ts$"],
//   "regenerate": ["npx nx run api:openapi", "npm run generate:api-client"],
//   "stage": ["apps/api/openapi.json", "libs/api-client/src/openapi-schema.ts"]
// }
//
//   node tools/golden/nestjs/openapi.mjs regenerate   (husky pre-commit) — regenerate + stage when API sources are staged
//   node tools/golden/nestjs/openapi.mjs lint [file]  (pre-push / CI)   — every operation carries the golden metadata

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BODY_METHODS = new Set(['post', 'put', 'patch']);
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export function loadOpenApiConfig(root) {
  const file = path.join(root, '.claude', 'golden.json');
  const cfg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).nestjs?.openapi : undefined;
  if (!cfg?.snapshot) throw new Error('No nestjs.openapi.snapshot in .claude/golden.json');
  return { triggers: [], regenerate: [], stage: [], ...cfg };
}

// Golden rule errors-and-contracts: summary, a typed success response,
// 401 unless public (`security: []`), 422 when the operation takes a body.
export function lintDocument(doc) {
  const findings = [];
  const globalSecurity = Array.isArray(doc.security) && doc.security.length > 0;
  for (const [route, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      const missing = [];
      const responses = op.responses ?? {};
      const codes = Object.keys(responses);
      if (!op.summary) missing.push('summary');
      const success = codes.filter((c) => /^2\d\d$/.test(c));
      if (success.length === 0) missing.push('2xx response');
      else if (!success.some((c) => c === '204' || responses[c]?.content)) missing.push('typed 2xx response body');
      const isPublic = Array.isArray(op.security) ? op.security.length === 0 : !globalSecurity && !op.security;
      if (!isPublic && !codes.includes('401')) missing.push('401 response');
      if ((BODY_METHODS.has(method) || op.requestBody) && !op.requestBody) missing.push('requestBody');
      if (op.requestBody && !codes.includes('422') && !codes.includes('400')) missing.push('422 response');
      if (missing.length) findings.push(`${method.toUpperCase()} ${route}${op.operationId ? ` [${op.operationId}]` : ''}: missing ${missing.join(', ')}`);
    }
  }
  return findings;
}

export function stagedTriggers(stagedFiles, triggers) {
  const res = triggers.map((t) => new RegExp(t));
  return stagedFiles.filter((f) => res.some((re) => re.test(f)));
}

function regenerate(root, cfg) {
  const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  if (stagedTriggers(staged, cfg.triggers).length === 0) return;
  console.log('[hook:openapi] API sources staged — regenerating the OpenAPI snapshot and client…');
  for (const cmd of cfg.regenerate) execSync(cmd, { cwd: root, stdio: 'inherit' });
  if (cfg.stage.length) execSync(`git add ${cfg.stage.map((s) => `"${s}"`).join(' ')}`, { cwd: root, stdio: 'inherit' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const [command, file] = process.argv.slice(2);
  const cfg = loadOpenApiConfig(root);
  if (command === 'regenerate') {
    regenerate(root, cfg);
  } else if (command === 'lint') {
    const doc = JSON.parse(readFileSync(path.resolve(root, file ?? cfg.snapshot), 'utf8'));
    const findings = lintDocument(doc);
    for (const f of findings) console.error(`[openapi-lint] ${f}`);
    if (findings.length) process.exit(1);
    console.log('[openapi-lint] ok');
  } else {
    console.error('usage: openapi.mjs regenerate | lint [file]');
    process.exit(2);
  }
}
