import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBash } from '../guard-bash.mjs';

const config = {
  protectedPaths: [
    { glob: 'prisma/schema.prisma', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'prisma/migrations/**', flag: 'db-migrator-active', reason: 'owned by the db-migrator agent' },
    { glob: 'openspec/specs/**', flag: 'opsx-archive-in-progress', reason: 'promoted truth' },
  ],
};
const blocked = (cmd, opts = { config }) => evaluateBash(cmd, opts).blocked;

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
  'redirect into golden rules': 'echo x > .claude/rules/golden/state.md',
};

const ALLOW = {
  'rm -rf relative': 'rm -rf .smoke-tmp',
  'rm -rf dist': 'rm -rf dist/seller-ui',
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

test('protected write passes when its flag is set', () => {
  const opts = { config, isFlagSet: (f) => f === 'db-migrator-active' };
  assert.equal(blocked("echo x >> prisma/schema.prisma", opts), false);
  assert.equal(blocked('cat a > openspec/specs/x/spec.md', opts), true);
});

test('golden rules protected without any project config', () => {
  assert.equal(blocked('echo x > .claude/rules/golden/a.md', {}), true);
});

test('block reason names the rule', () => {
  assert.match(evaluateBash('git push -f').reason, /force push/);
});
