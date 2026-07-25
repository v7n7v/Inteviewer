const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { build } = require('esbuild');

const repoRoot = path.join(__dirname, '..');

async function loadBootstrapModule() {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-workspace-auth-bootstrap-'));
  const outfile = path.join(outdir, 'workspace-auth-bootstrap.cjs');
  await build({
    entryPoints: [path.join(repoRoot, 'lib/workspace-auth-bootstrap.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  return require(outfile);
}

const bootstrapModule = loadBootstrapModule();

function fakeScheduler() {
  let callback = null;
  let cancelled = false;
  return {
    schedule(next) {
      callback = next;
      return 1;
    },
    cancel() {
      cancelled = true;
    },
    fire() {
      callback?.();
    },
    get cancelled() {
      return cancelled;
    },
  };
}

test('workspace bootstrap watchdog reaches a terminal state when Firebase never emits', async () => {
  const { createWorkspaceBootstrapWatchdog } = await bootstrapModule;
  const timer = fakeScheduler();
  let timeoutCount = 0;
  const watchdog = createWorkspaceBootstrapWatchdog({
    onTimeout: () => { timeoutCount += 1; },
    schedule: timer.schedule,
    cancel: timer.cancel,
  });

  timer.fire();
  timer.fire();
  assert.equal(timeoutCount, 1);
  assert.equal(watchdog.complete(), false);
});

test('successful auth bootstrap cancels the watchdog without firing recovery', async () => {
  const { createWorkspaceBootstrapWatchdog } = await bootstrapModule;
  const timer = fakeScheduler();
  let timeoutCount = 0;
  const watchdog = createWorkspaceBootstrapWatchdog({
    onTimeout: () => { timeoutCount += 1; },
    schedule: timer.schedule,
    cancel: timer.cancel,
  });

  assert.equal(watchdog.complete(), true);
  assert.equal(timer.cancelled, true);
  timer.fire();
  assert.equal(timeoutCount, 0);
});

test('WorkspaceFrame bounds loading and does not treat profile errors as missing profiles', () => {
  const frame = fs.readFileSync(path.join(repoRoot, 'components/workspace/WorkspaceFrame.tsx'), 'utf8');
  assert.match(frame, /createWorkspaceBootstrapWatchdog/);
  assert.match(frame, /authHelpers\.getUser\(\)/);
  assert.match(frame, /\.finally\(finishLoading\)/);
  assert.match(frame, /else if \(success && showOnboardingPrompt/);
  assert.match(frame, /sequence !== authSequence/);
  assert.match(frame, /watchdog\.dispose\(\)/);
});
