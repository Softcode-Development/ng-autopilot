// Technology added to package.json after install that autopilot.json does not
// cover yet. Read by the SessionStart context and by doctor.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const FIX = 'run /autopilot:install (reconfigure) and sync';

const CHECKS = [
  { has: (deps) => 'tailwindcss' in deps, covered: (c) => c.stylelint?.tailwind === true, what: 'tailwindcss is installed but stylelint.tailwind is false' },
  { has: (deps) => 'primeng' in deps, covered: (c) => c.packs.includes('primeng'), what: 'primeng is installed but the primeng pack is not' },
  { has: (deps) => Object.keys(deps).some((d) => d.startsWith('@spartan-ng/')), covered: (c) => c.packs.includes('spartan'), what: 'spartan/ng is installed but the spartan pack is not' },
  { has: (deps) => '@nestjs/core' in deps, covered: (c) => c.packs.includes('nestjs'), what: 'NestJS is installed but the nestjs pack is not' },
];

export function stackDrift(pkg, config) {
  if (!Array.isArray(config?.packs)) return [];
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  return CHECKS.filter((c) => c.has(deps) && !c.covered(config)).map((c) => `${c.what} — ${FIX}`);
}

export function readPackageJson(root) {
  const file = path.join(root, 'package.json');
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  } catch {
    return {};
  }
}
