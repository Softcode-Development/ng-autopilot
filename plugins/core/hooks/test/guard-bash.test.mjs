import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBash } from '../guard-bash.mjs';

const config = {
  packs: [],
  protectedPaths: [
    { glob: 'prisma/schema.prisma', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'prisma/migrations/**', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'openspec/specs/**', flag: 'opsx-archive-in-progress', reason: 'promoted truth' },
  ],
};
const onBranch = (name) => () => name;
const blocked = (cmd, opts = { config }) => evaluateBash(cmd, { currentBranch: onBranch('feat/x'), ...opts }).blocked;

const BLOCK = {
  'rm -rf /': 'rm -rf /',
  'rm -rf absolute path': 'rm -rf /tmp/something-important',
  'rm -fr windows drive path': 'rm -fr C:/apps/x',
  'rm -rf home': 'rm -rf ~',
  'rm -rf $HOME': 'rm -rf $HOME/x',
  'rm -rf bare glob': 'rm -rf *',
  'push --force': 'git push --force origin main',
  'push -f': 'git push -f',
  'push --force-with-lease': 'git push --force-with-lease origin feat',
  'push +refspec': 'git push origin +main',
  'no-verify': 'git commit --no-verify -m skip',
  'pnpm publish': 'pnpm publish',
  'npm publish': 'npm publish --access public',
  'reset --hard': 'git reset --hard HEAD~1',
  'clean -fdx': 'git clean -fdx',
  'clean -fd': 'git clean -fd',
  'checkout -- .': 'git checkout -- .',
  'restore .': 'git restore .',
  'cat .env.local': 'cat .env.local',
  'grep .env': 'grep SECRET .env',
  'cat apps/api/.env': 'cat apps/api/.env',
  'cat .env.production': 'cat .env.production',
  'cat secrets/': 'cat ./secrets/cert.pem',
  'head key file': 'head deploy/server.key',
  'cat .env with backslashes': 'cat apps\\api\\.env',
  'type secrets with backslashes': 'type deploy\\secrets\\db.txt',
  'cat non-key file under secrets/': 'cat secrets/db-password.txt',
  'redirect into schema.prisma': "echo 'model Foo {}' >> prisma/schema.prisma",
  'redirect into specs': 'cat tmp.md > openspec/specs/transactions/spec.md',
  'tee into specs': 'echo data | tee openspec/specs/transactions/spec.md',
  'redirect into autopilot rules': 'echo x > .claude/rules/autopilot/state.md',
};

const ALLOW = {
  'rm -rf relative': 'rm -rf .smoke-tmp',
  'rm -rf dist': 'rm -rf dist/web-app',
  'push plain': 'git push origin feat/x',
  'push -u': 'git push -u origin feat/x',
  'reset --soft': 'git reset --soft HEAD~1',
  'checkout branch': 'git checkout -b feat/x',
  'restore one file': 'git restore src/app/a.ts',
  'cat .env.example': 'cat apps/api/.env.example',
  'cat .env.sample': 'cat .env.sample',
  'grep in .env.template': 'grep KEY .env.template',
  'mention of .env without read verb': 'echo "copy .env.example to .env"',
  'prose mention of redirect': "echo 'note: backticked > redirect into openspec/specs/ docs are fine in prose'",
  'fd redirect': 'ls openspec/specs/ 2>/dev/null',
  'read protected path': 'cat prisma/schema.prisma',
  'key-like name that is not a key file': 'cat src/app/keyboard.ts',
  'pnpm test': 'pnpm test',
  'nx affected': 'pnpm exec nx affected -t lint',
  'npm run test:ci': 'npm run test:ci',
  'git status': 'git status',
  'empty command': '',
};

for (const [name, cmd] of Object.entries(BLOCK)) {
  test(`blocks: ${name}`, () => assert.equal(blocked(cmd), true, cmd));
}
for (const [name, cmd] of Object.entries(ALLOW)) {
  test(`allows: ${name}`, () => assert.equal(blocked(cmd), false, cmd));
}

const TRUNK_PUSH = {
  'explicit trunk': 'git push origin main',
  'explicit master': 'git push origin master',
  'explicit production': 'git push origin production',
  'set upstream to main': 'git push -u origin main',
  'HEAD:main': 'git push origin HEAD:main',
  'branch:main': 'git push origin feat/x:main',
  'refs/heads/main': 'git push origin HEAD:refs/heads/main',
  'delete main': 'git push origin :main',
  'git -C dir': 'git -C ../app push origin main',
  'after another command': 'npm test && git push origin main',
  'env assignment first': 'GIT_TRACE=1 git push origin main',
  'with a push option': 'git push -o ci.skip origin main',
  'quoted refspec': 'git push origin "main"',
  '--all': 'git push --all origin',
  '--mirror': 'git push --mirror',
};
for (const [name, cmd] of Object.entries(TRUNK_PUSH)) {
  test(`blocks a push to a trunk: ${name}`, () => assert.equal(blocked(cmd), true, cmd));
}

test('a bare push, a push to the remote only, or HEAD, is blocked on a trunk and allowed on a feature branch', () => {
  for (const cmd of ['git push', 'git push origin', 'git push -u origin HEAD', 'git push origin HEAD']) {
    assert.equal(blocked(cmd, { config, currentBranch: onBranch('main') }), true, `${cmd} on main`);
    assert.equal(blocked(cmd, { config, currentBranch: onBranch('production') }), true, `${cmd} on production`);
    assert.equal(blocked(cmd, { config, currentBranch: onBranch('feat/x') }), false, `${cmd} on feat/x`);
  }
});

test('projects add trunks with protectedBranches', () => {
  const withRelease = { config: { ...config, protectedBranches: ['release'] } };
  assert.equal(blocked('git push origin release', withRelease), true);
  assert.equal(blocked('git push', { ...withRelease, currentBranch: onBranch('release') }), true);
  assert.equal(blocked('git push origin release'), false);
});

test('not a push to a trunk: branches named like one, and git mentioned as text', () => {
  assert.equal(blocked('git push origin main-menu-fix'), false);
  assert.equal(blocked('git push origin feat/main'), false);
  assert.equal(blocked('git commit -m "docs: never git push origin main"'), false);
  assert.equal(blocked("node gen.mjs <<'EOF'\n  'x': 'git push --all origin',\nEOF"), false);
});

test('the reason names the trunk and the way forward', () => {
  assert.match(evaluateBash('git push origin HEAD:main', { currentBranch: onBranch('feat/x') }).reason, /protected trunk refused: it targets main.*open a PR/);
});

test('protected write passes when its flag is set', () => {
  const opts = { config, isFlagSet: (f) => f === 'db-migrator-active' };
  assert.equal(blocked("echo x >> prisma/schema.prisma", opts), false);
  assert.equal(blocked('cat a > openspec/specs/x/spec.md', opts), true);
});

test('generated-file protection starts once a project is installed (autopilot.json with packs)', () => {
  assert.equal(blocked('echo x > .claude/rules/autopilot/a.md', {}), false);
  assert.equal(blocked('echo x > CLAUDE.md', {}), false);
  assert.equal(blocked('echo x > .claude/rules/autopilot/a.md', { config: { packs: [] } }), true);
  assert.equal(blocked('git push -f', {}), true, 'safety rules apply everywhere');
});

test('block reason names the rule', () => {
  assert.match(evaluateBash('git push -f').reason, /force push/);
});
