#!/usr/bin/env node
// What global CSS a project already loads, and where it would clash with Tailwind — the evidence
// install uses to propose design.legacyCss. Any library counts (Bootstrap, Angular Material,
// Nebular, Foundation, Bulma, PrimeFlex, an old Tailwind, the app's own global SCSS …).
//
//   node bin/css-collisions.mjs <project-dir> [--json]
//
// Reads every stylesheet angular.json lists under build styles (except the autopilot Tailwind
// entry, src/styles/tailwind.css, which is new code), follows their @import / @use, collects class
// selectors and element-level rules, and asks Tailwind's own engine which of those class names are
// also Tailwind utilities (semantic colour names included). SCSS entries are compiled with the
// project's sass so loop-generated classes (`.p-#{$i}`) are seen; without sass they are read as text.
// Tailwind and sass come from the project first, then from this repo; the check degrades, never fails.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AUTOPILOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWN_ENTRY = 'src/styles/tailwind.css';
// Semantic colour names UI-library presets add to Tailwind (spartan, tailwindcss-primeui).
const SEMANTIC_COLOURS = ['primary', 'secondary', 'muted', 'accent', 'destructive', 'background', 'foreground', 'card', 'popover', 'border', 'input', 'ring', 'surface', 'success', 'info', 'warning', 'danger'];

const posix = (p) => p.replaceAll('\\', '/');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// Rule selectors; at-rule preludes (@media …, @supports …) are not selectors.
const selectorsOf = (css) => [...stripComments(css).replace(/@[a-z-]+[^{;]*\{/gi, '{').matchAll(/([^{};]+)\{/g)]
  .map((m) => m[1].trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));

export function classSelectors(css) {
  const names = new Set();
  for (const sel of selectorsOf(css)) for (const m of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(m[1]);
  return names;
}

export function elementRules(css) {
  return selectorsOf(css).filter((sel) => sel.split(',').some((part) => /^(\*|[a-z][a-z0-9]*)(?![\w-])/.test(part.trim()))).length;
}

const libraryOf = (rel) => {
  const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(rel);
  return m ? m[1] : 'app';
};

// A package resolved from the project first, then from this repo; null when neither has it.
function resolveFrom(name, root) {
  for (const base of [path.join(root, 'package.json'), path.join(AUTOPILOT_ROOT, 'package.json')]) {
    try {
      return createRequire(base).resolve(name);
    } catch {
      // try the next base
    }
  }
  return null;
}

async function loadTailwindCompile(root) {
  const entry = resolveFrom('@tailwindcss/node', root);
  return entry ? (await import(pathToFileURL(entry).href)).compile : null;
}

function resolveImport(spec, fromFile, root) {
  const clean = spec.replace(/^~/, '');
  const bases = clean.startsWith('.') ? [path.dirname(fromFile)] : [path.dirname(fromFile), path.join(root, 'node_modules')];
  for (const base of bases) {
    const full = path.resolve(base, clean);
    const dir = path.dirname(full);
    const name = path.basename(full);
    for (const candidate of [full, `${full}.scss`, `${full}.css`, path.join(dir, `_${name}.scss`), path.join(dir, `_${name}`), path.join(full, '_index.scss'), path.join(full, 'index.scss')]) {
      if (existsSync(candidate) && /\.(s?css)$/.test(candidate)) return candidate;
    }
  }
  return null;
}

const listedStyles = (root) => {
  const angular = JSON.parse(readFileSync(path.join(root, 'angular.json'), 'utf8'));
  return Object.values(angular.projects ?? {}).flatMap((p) => p.architect?.build?.options?.styles ?? [])
    .map((s) => (typeof s === 'string' ? s : s.input)).filter((s) => posix(s) !== OWN_ENTRY);
};

// Every global stylesheet, in load order, with the library it comes from.
export function globalStylesheets(root) {
  const seen = new Set();
  const out = [];
  const visit = (file) => {
    if (!file || seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const rel = posix(path.relative(root, file));
    out.push({ file: rel, library: libraryOf(rel), css: readFileSync(file, 'utf8') });
    for (const m of stripComments(out.at(-1).css).matchAll(/@(?:import|use|forward)\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      if (/^(https?:|tailwindcss)/.test(m[1])) continue;
      visit(resolveImport(m[1], file, root));
    }
  };
  for (const s of listedStyles(root)) visit(path.resolve(root, s));
  return out;
}

// The CSS the listed SCSS entries really produce, when the project's sass can compile them.
function compiledScss(root) {
  const entry = resolveFrom('sass', root);
  if (!entry) return [];
  const sass = createRequire(entry)(entry);
  return listedStyles(root).filter((s) => /\.s[ac]ss$/.test(s)).flatMap((s) => {
    try {
      return [sass.compile(path.resolve(root, s), { loadPaths: [root, path.join(root, 'node_modules')], quietDeps: true, logger: { warn() {}, debug() {} } }).css];
    } catch {
      return [];
    }
  });
}

// `@import 'tailwindcss'` resolves from the project when its Tailwind is v4 (the engine this check
// speaks), else from this repo.
function tailwindBase(root) {
  try {
    const { version } = JSON.parse(readFileSync(path.join(root, 'node_modules', 'tailwindcss', 'package.json'), 'utf8'));
    if (Number(version.split('.')[0]) >= 4) return root;
  } catch {
    // not installed in the project
  }
  return AUTOPILOT_ROOT;
}

export async function analyse(root, { loadCompile = loadTailwindCompile } = {}) {
  let sheets;
  try {
    sheets = globalStylesheets(root);
  } catch (e) {
    return {
      sources: [], collisions: null, elementRules: 0, legacyCss: false,
      note: `angular.json could not be read (${e.message.split('\n')[0]}) — list the global stylesheets by hand and decide design.legacyCss with the owner.`,
    };
  }
  const texts = [...sheets.map((s) => s.css), ...compiledScss(root)];
  const classes = new Set(texts.flatMap((css) => [...classSelectors(css)]));
  const elements = sheets.reduce((n, s) => n + elementRules(s.css), 0);
  const compile = await loadCompile(root);
  let collisions = null;
  let note = null;
  if (compile) {
    try {
      const theme = SEMANTIC_COLOURS.map((c) => `--color-${c}: #000;`).join(' ');
      const compiler = await compile(`@import 'tailwindcss';\n@theme { ${theme} }`, { base: tailwindBase(root), onDependency() {} });
      const generated = new Set([...compiler.build([...classes]).matchAll(/^\s*\.((?:\\.|[\w-])+)\s*[{:,]/gm)].map((m) => m[1].replace(/\\/g, '')));
      collisions = [...classes].filter((c) => generated.has(c)).sort();
    } catch (e) {
      note = `Tailwind could not check the collisions (${e.message.split('\n')[0]}) — the element rules below are the evidence.`;
    }
  } else {
    note = 'Tailwind is not installed here, so class collisions were not checked — re-run after installing the devDependencies.';
  }
  return {
    sources: sheets.map(({ file, library, css }) => ({ file, library, classes: classSelectors(css).size, elementRules: elementRules(css) })),
    collisions,
    elementRules: elements,
    legacyCss: (collisions?.length ?? 0) > 0 || elements > 0,
    note,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node css-collisions.mjs <project-dir> [--json]');
    process.exit(2);
  }
  const report = await analyse(path.resolve(target));
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else if (!report.sources.length && report.note) {
    console.log(report.note);
  } else {
    console.log('Global stylesheets:');
    for (const s of report.sources) console.log(`  ${s.library.padEnd(20)} ${s.file}  (${s.classes} classes, ${s.elementRules} element rules)`);
    if (report.collisions) {
      console.log(`\n${report.collisions.length} class names collide with Tailwind utilities: ${report.collisions.slice(0, 40).join(', ')}${report.collisions.length > 40 ? ', …' : ''}`);
    } else {
      console.log(`\n${report.note}`);
    }
    console.log(`${report.elementRules} element-level rules (body, headings, links, …) style every page.`);
    console.log(report.legacyCss
      ? '\n→ recommend design.legacyCss: true (tw: prefix, no Tailwind reset) — legacy pages stay as they are.'
      : '\n→ recommend design.legacyCss: false — no global CSS a modern setup would disturb.');
  }
}
