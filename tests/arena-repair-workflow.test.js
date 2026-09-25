'use strict';

// Text-level pins on .github/workflows/arena-repair.yml — the scheduled
// gate that repairs arena/bug-* PRs which never got CI approval because
// they're authored by github-actions[bot] (the action_required trap).
//
// This intentionally does NOT execute the workflow (no gh/git calls) —
// it just parses the YAML as text and checks the properties the spec
// requires are present and haven't regressed.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'arena-repair.yml');
const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');

test('arena-repair.yml exists', () => {
  assert.ok(fs.existsSync(WORKFLOW_PATH), 'expected .github/workflows/arena-repair.yml to exist');
});

test('is schedule-triggered (not pull_request-triggered)', () => {
  assert.match(yaml, /\n {2}schedule:\s*\n\s*- cron: ['"]\*\/15 \* \* \* \*['"]/);
  assert.match(yaml, /\n {2}workflow_dispatch:/);
});

test('permissions are exactly contents+pull-requests write', () => {
  const match = yaml.match(/\npermissions:\n([\s\S]*?)\n(?:\n|concurrency:|env:|jobs:)/);
  assert.ok(match, 'expected a top-level permissions block');
  const block = match[1];
  const perms = {};
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*([a-z-]+):\s*(\S+)\s*$/);
    if (m) perms[m[1]] = m[2];
  }
  assert.deepEqual(perms, { contents: 'write', 'pull-requests': 'write' });
});

test('has the arena-repair comment marker for dedupe/guarding', () => {
  assert.match(yaml, /<!-- arena-repair -->/);
});

test('has the loud, specific error when the AI fixer key is rejected', () => {
  assert.match(
    yaml,
    /AI fixer key rejected — ANTHROPIC_API_KEY on gatetest-arena is invalid \(owner rotation\)/
  );
  // Must actually surface as a GitHub Actions error annotation.
  assert.match(yaml, /::error::AI fixer key rejected/);
});

test('caps work at 3 PRs per run', () => {
  assert.match(yaml, /MAX_PRS=3/);
  assert.match(yaml, /processed.*-ge.*MAX_PRS/);
});

test('has a concurrency guard so runs cannot overlap', () => {
  assert.match(yaml, /\nconcurrency:\n\s*group: arena-repair\n\s*cancel-in-progress: false/);
});

test('has a 20 minute job timeout and full-history checkout', () => {
  assert.match(yaml, /timeout-minutes: 20/);
  assert.match(yaml, /fetch-depth: 0/);
});

test('only ever touches arena\\/bug- branches', () => {
  assert.match(yaml, /startswith\("arena\/bug-"\)/);
});

test('runs the product fixer (gatetest fix --apply) rather than a bespoke one', () => {
  assert.match(yaml, /gatetest fix --apply/);
  assert.match(yaml, /ANTHROPIC_API_KEY/);
});
