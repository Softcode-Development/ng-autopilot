import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractTokens, prefixPreset, presetHeaderVersion } from '../spartan-css.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'spartan-css.mjs');

// The shape spartan's ui-theme generator writes into the target file.
const GENERATED = `@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/preflight.css' layer(base);
@import 'tailwindcss/utilities.css';

@import '@spartan-ng/brain/hlm-tailwind-preset.css';

:root {
  color-scheme: light;
  --radius: 0.625rem;
  --primary: oklch(0.21 0.006 285.885);
}

:root.dark {
  color-scheme: dark;
  --primary: oklch(0.92 0.004 286.32);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
}
`;

test('extractTokens keeps only the light and dark token blocks', () => {
  const out = extractTokens(GENERATED);
  assert.match(out, /^:root \{\n  color-scheme: light;/);
  assert.match(out, /:root\.dark \{\n  color-scheme: dark;\n  --primary: oklch\(0\.92 0\.004 286\.32\);\n\}\n$/);
  assert.doesNotMatch(out, /@import|@layer|@apply/);
});

test('extractTokens on a file that already holds only tokens changes nothing', () => {
  const once = extractTokens(GENERATED);
  assert.equal(extractTokens(once), once);
});

test('prefixPreset prefixes @apply lists and nothing else', () => {
  const preset = "@import 'tw-animate-css';\n@custom-variant dark (&:is(.dark *));\n@utility scroll-fade-y {\n\t@apply scroll-fade;\n\tmask: none;\n}\n";
  const out = prefixPreset(preset, 'tw', '1.8.0');
  assert.match(out, /@apply tw:scroll-fade;/);
  assert.match(out, /@import 'tw-animate-css';/);
  assert.match(out, /@utility scroll-fade-y \{/);
  assert.equal(presetHeaderVersion(out), '1.8.0');
  assert.equal(prefixPreset(out, 'tw', '1.8.0'), out, 'idempotent');
});

test('CLI: tokens rewrites the file in place; preset copies the installed brain preset with its version', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'spartan-css-'));
  try {
    mkdirSync(path.join(root, 'src', 'styles', 'tokens'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'styles', 'tokens', 'colors.css'), GENERATED);
    const brain = path.join(root, 'node_modules', '@spartan-ng', 'brain');
    mkdirSync(brain, { recursive: true });
    writeFileSync(path.join(brain, 'package.json'), JSON.stringify({ name: '@spartan-ng/brain', version: '9.9.9' }));
    writeFileSync(path.join(brain, 'hlm-tailwind-preset.css'), '@utility a {\n\t@apply b;\n}\n');

    const t = spawnSync(process.execPath, [script, 'tokens', 'src/styles/tokens/colors.css'], { cwd: root, encoding: 'utf8' });
    assert.equal(t.status, 0, t.stderr);
    assert.doesNotMatch(readFileSync(path.join(root, 'src', 'styles', 'tokens', 'colors.css'), 'utf8'), /@import/);

    const p = spawnSync(process.execPath, [script, 'preset', 'src/styles/spartan-preset.css', '--prefix', 'tw'], { cwd: root, encoding: 'utf8' });
    assert.equal(p.status, 0, p.stderr);
    const copy = readFileSync(path.join(root, 'src', 'styles', 'spartan-preset.css'), 'utf8');
    assert.match(copy, /@apply tw:b;/);
    assert.equal(presetHeaderVersion(copy), '9.9.9');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
