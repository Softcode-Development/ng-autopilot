import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prefixClassList, prefixSource, prefixTemplate, prefixTwMerge } from '../prefix.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prefix.mjs');

test('every utility token gets one prefix: variants, arbitrary values, markers, important', () => {
  assert.equal(prefixClassList('inline-flex shrink-0 items-center', 'tw'), 'tw:inline-flex tw:shrink-0 tw:items-center');
  assert.equal(prefixClassList('data-[state=open]:animate-in [&_ng-icon]:size-4', 'tw'), 'tw:data-[state=open]:animate-in tw:[&_ng-icon]:size-4');
  assert.equal(prefixClassList('**:data-[slot=x]:text-muted-foreground!', 'tw'), 'tw:**:data-[slot=x]:text-muted-foreground!');
  assert.equal(prefixClassList('gap-(--card-spacing) [--card-spacing:--spacing(6)] group/card', 'tw'), 'tw:gap-(--card-spacing) tw:[--card-spacing:--spacing(6)] tw:group/card');
  assert.equal(prefixClassList("[&_ng-icon:not([class*='text-'])]:text-[length:--spacing(4)]", 'tw'), "tw:[&_ng-icon:not([class*='text-'])]:text-[length:--spacing(4)]");
});

test('already prefixed tokens and spartan hook classes stay; whitespace is kept', () => {
  assert.equal(prefixClassList('tw:flex  spartan-button\n gap-2', 'tw'), 'tw:flex  spartan-button\n tw:gap-2');
  assert.equal(prefixClassList('', 'tw'), '');
});

const SOURCE = `import { cva } from 'class-variance-authority';
import { classes } from './utils';

export const buttonVariants = cva('inline-flex rounded-md border', {
  variants: {
    variant: { default: 'bg-primary text-primary-foreground', outline: 'border-input bg-background' },
    size: { sm: 'h-8 px-3' },
  },
  compoundVariants: [{ variant: 'outline', size: 'sm', class: 'px-2' }],
  defaultVariants: { variant: 'default', size: 'sm' },
});

@Directive({ selector: 'button[hlmBtn]', host: { 'data-slot': 'button' } })
export class Button {
  constructor() {
    classes(() => ['flex flex-col', this.open() && 'data-open:animate-in', \`gap-2\`]);
  }
}

@Component({
  selector: 'hlm-thing',
  template: \`
    <button class="absolute end-4 top-4" [class.x]="y" [class]="z">
      <span class="sr-only">{{ label() }}</span>
    </button>
  \`,
})
export class Thing {}
`;

test('prefixSource: class strings in cva base and variant values, classes() and inline templates; nothing else', () => {
  const out = prefixSource(SOURCE, 'tw');
  assert.match(out, /cva\('tw:inline-flex tw:rounded-md tw:border'/);
  assert.match(out, /default: 'tw:bg-primary tw:text-primary-foreground'/);
  assert.match(out, /sm: 'tw:h-8 tw:px-3'/);
  assert.match(out, /class: 'tw:px-2'/);
  assert.match(out, /compoundVariants: \[\{ variant: 'outline', size: 'sm'/, 'compound keys are not classes');
  assert.match(out, /defaultVariants: \{ variant: 'default', size: 'sm' \}/, 'default variants are keys');
  assert.match(out, /classes\(\(\) => \['tw:flex tw:flex-col', this\.open\(\) && 'tw:data-open:animate-in', `tw:gap-2`\]\)/);
  assert.match(out, /class="tw:absolute tw:end-4 tw:top-4" \[class\.x\]="y" \[class\]="z"/);
  assert.match(out, /<span class="tw:sr-only">/);
  assert.match(out, /selector: 'button\[hlmBtn\]'/);
  assert.match(out, /'data-slot': 'button'/);
  assert.match(out, /from 'class-variance-authority'/);
});

test('prefixSource twice equals once', () => {
  const once = prefixSource(SOURCE, 'tw');
  assert.equal(prefixSource(once, 'tw'), once);
});

test('prefixTemplate leaves bound and interpolated class attributes alone', () => {
  assert.equal(prefixTemplate('<a class="flex gap-2" [class]="x" class="{{ y }}">', 'tw'), '<a class="tw:flex tw:gap-2" [class]="x" class="{{ y }}">');
});

test('prefixTwMerge makes hlm() merge prefixed classes', () => {
  const util = "import { type ClassValue, clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nexport function hlm(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}\n";
  const out = prefixTwMerge(util, 'tw');
  assert.match(out, /import \{ extendTailwindMerge \} from 'tailwind-merge';\n\nconst twMerge = extendTailwindMerge\(\{ prefix: 'tw' \}\);/);
  assert.equal(prefixTwMerge(out, 'tw'), out);
});

test('CLI rewrites .ts files under the components path and reports them', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'spartan-prefix-'));
  try {
    mkdirSync(path.join(root, 'ui', 'button', 'src', 'lib'), { recursive: true });
    mkdirSync(path.join(root, 'ui', 'utils', 'src', 'lib'), { recursive: true });
    writeFileSync(path.join(root, 'ui', 'button', 'src', 'lib', 'hlm-button.ts'), SOURCE);
    writeFileSync(path.join(root, 'ui', 'utils', 'src', 'lib', 'hlm.ts'), "import { twMerge } from 'tailwind-merge';\n");
    const r = spawnSync(process.execPath, [script, 'ui', '--prefix', 'tw'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /2 file\(s\) prefixed/);
    assert.match(readFileSync(path.join(root, 'ui', 'button', 'src', 'lib', 'hlm-button.ts'), 'utf8'), /cva\('tw:inline-flex/);
    const again = spawnSync(process.execPath, [script, 'ui', '--prefix', 'tw'], { cwd: root, encoding: 'utf8' });
    assert.match(again.stdout, /0 file\(s\) prefixed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
