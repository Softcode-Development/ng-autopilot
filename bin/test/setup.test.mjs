import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSteps } from '../setup.mjs';

const deps = [
  { name: 'frontend-design', marketplace: { name: 'claude-plugins-official', source: 'anthropics/claude-plugins-official' }, usedBy: 'x' },
  { name: 'design', marketplace: { name: 'knowledge-work-plugins', source: 'anthropics/knowledge-work-plugins' }, usedBy: 'y' },
];
const base = { autopilotName: 'ng-autopilot', autopilotPlugins: ['core', 'angular'], deps, source: '/autopilot' };
const cmds = (steps) => steps.map((s) => s.args.join(' '));

test('fresh machine: register, install + disable every autopilot plugin, install missing dependencies', () => {
  const steps = cmds(planSteps({ ...base, installed: [], marketplaces: [] }));
  assert.deepEqual(steps, [
    'plugin marketplace add /autopilot',
    'plugin install core@ng-autopilot --scope user',
    'plugin disable core@ng-autopilot --scope user',
    'plugin install angular@ng-autopilot --scope user',
    'plugin disable angular@ng-autopilot --scope user',
    'plugin marketplace add anthropics/claude-plugins-official',
    'plugin install frontend-design@claude-plugins-official --scope user',
    'plugin marketplace add anthropics/knowledge-work-plugins',
    'plugin install design@knowledge-work-plugins --scope user',
  ]);
});

test('a synced copy of a dependency counts as present (no duplicate install)', () => {
  const installed = [{ id: 'design@synced', enabled: true }, { id: 'frontend-design@claude-plugins-official', enabled: true }];
  const steps = cmds(planSteps({ ...base, installed, marketplaces: [{ name: 'ng-autopilot' }] }));
  assert.equal(steps.some((c) => c.includes('design@knowledge-work-plugins')), false);
  assert.equal(steps.some((c) => c.includes('frontend-design@')), false);
});

test('already set up: nothing to do; an enabled autopilot plugin at user scope gets disabled again', () => {
  const installed = [
    { id: 'core@ng-autopilot', enabled: false },
    { id: 'angular@ng-autopilot', enabled: true },
    { id: 'frontend-design@claude-plugins-official', enabled: true },
    { id: 'design@synced', enabled: true },
  ];
  const steps = cmds(planSteps({ ...base, installed, marketplaces: [{ name: 'ng-autopilot' }] }));
  assert.deepEqual(steps, ['plugin disable angular@ng-autopilot --scope user']);
});
