import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSteps } from '../setup.mjs';

const deps = [
  { name: 'frontend-design', marketplace: { name: 'claude-plugins-official', source: 'anthropics/claude-plugins-official' }, usedBy: 'x' },
  { name: 'design', marketplace: { name: 'knowledge-work-plugins', source: 'anthropics/knowledge-work-plugins' }, usedBy: 'y' },
];
const base = { goldenName: 'claude-golden', goldenPlugins: ['core', 'angular'], deps, source: '/golden' };
const cmds = (steps) => steps.map((s) => s.args.join(' '));

test('fresh machine: register, install + disable every golden plugin, install missing dependencies', () => {
  const steps = cmds(planSteps({ ...base, installed: [], marketplaces: [] }));
  assert.deepEqual(steps, [
    'plugin marketplace add /golden',
    'plugin install core@claude-golden --scope user',
    'plugin disable core@claude-golden --scope user',
    'plugin install angular@claude-golden --scope user',
    'plugin disable angular@claude-golden --scope user',
    'plugin marketplace add anthropics/claude-plugins-official',
    'plugin install frontend-design@claude-plugins-official --scope user',
    'plugin marketplace add anthropics/knowledge-work-plugins',
    'plugin install design@knowledge-work-plugins --scope user',
  ]);
});

test('a synced copy of a dependency counts as present (no duplicate install)', () => {
  const installed = [{ id: 'design@synced', enabled: true }, { id: 'frontend-design@claude-plugins-official', enabled: true }];
  const steps = cmds(planSteps({ ...base, installed, marketplaces: [{ name: 'claude-golden' }] }));
  assert.equal(steps.some((c) => c.includes('design@knowledge-work-plugins')), false);
  assert.equal(steps.some((c) => c.includes('frontend-design@')), false);
});

test('already set up: nothing to do; an enabled golden plugin at user scope gets disabled again', () => {
  const installed = [
    { id: 'core@claude-golden', enabled: false },
    { id: 'angular@claude-golden', enabled: true },
    { id: 'frontend-design@claude-plugins-official', enabled: true },
    { id: 'design@synced', enabled: true },
  ];
  const steps = cmds(planSteps({ ...base, installed, marketplaces: [{ name: 'claude-golden' }] }));
  assert.deepEqual(steps, ['plugin disable angular@claude-golden --scope user']);
});
