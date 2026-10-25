import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  isExpectedLocalAiTurnOwner,
  requireSettledBoard,
  waitForPendingDecisionOrSettledBoard,
  waitForPendingDecisionPresentation,
  startDeadline,
  withTimeout,
  writeCheckpoint,
} from './betrayal-public-local-acceptance-runtime.mjs';

test('AI turn handoff is recognized while its pending check is still resolving', () => {
  const persisted = {
    snapshotFound: true,
    seedMatchesCurrentUrl: true,
    currentPlayerId: '1',
    seatControllers: { '1': { type: 'local-ai' } },
    pendingEventRollStart: { sourceTitle: '一条秘密通道' },
    pendingEventRollResolution: null,
  };
  assert.equal(isExpectedLocalAiTurnOwner(persisted, '0'), true);
  assert.equal(isExpectedLocalAiTurnOwner({ ...persisted, currentPlayerId: '0' }, '0'), false);
  assert.equal(isExpectedLocalAiTurnOwner({ ...persisted, seedMatchesCurrentUrl: false }, '0'), false);
  assert.equal(isExpectedLocalAiTurnOwner({ ...persisted, seatControllers: { '1': { type: 'human' } } }, '0'), false);
});

test('resolution polling ignores a transient empty panel gap until a decision or usable board appears', async () => {
  const states = [
    { pendingKinds: [], settledBoard: false, phase: 'transition-gap' },
    { pendingKinds: ['event-choice'], settledBoard: false, phase: 'event-choice' },
  ];
  const result = await waitForPendingDecisionOrSettledBoard(async () => states.shift(), { timeoutMs: 100, intervalMs: 1 });
  assert.equal(result.kind, 'pending');
  assert.deepEqual(result.state.pendingKinds, ['event-choice']);
});

test('resolution action-budget exhaustion rejects a still-pending decision', async () => {
  const lastState = await waitForPendingDecisionOrSettledBoard(
    async () => ({ pendingKinds: ['discovery'], settledBoard: false }),
    { timeoutMs: 5, intervalMs: 1 },
  );
  assert.equal(lastState.kind, 'pending');
  assert.throws(() => requireSettledBoard(lastState), /pending business decisions remain/);
});

test('persisted pending decisions may mount after the board temporarily looks settled', async () => {
  let reads = 0;
  let visibleChecks = 0;
  const result = await waitForPendingDecisionPresentation(
    async () => {
      reads += 1;
      return { pendingKinds: ['persisted-card-resolution'], settledBoard: false };
    },
    async () => {
      visibleChecks += 1;
      return visibleChecks >= 4;
    },
    { timeoutMs: 100, intervalMs: 1 },
  );
  assert.equal(result.kind, 'visible');
  assert.ok(reads >= 2);
  assert.equal(visibleChecks, 4);
});

test('bounded browser diagnostics can abandon a hung map snapshot', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'map resource snapshot'),
    /map resource snapshot exceeded 10 ms/,
  );
});

test('diagnostic checkpoints are atomically written before later cleanup', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'betrayal-acceptance-checkpoint-'));
  const checkpointPath = path.join(directory, 'acceptance-report.partial.json');
  const checkpoint = { phase: 'before-browser-cleanup', currentStep: 'map-readiness', screenshotCount: 1 };
  try {
    await writeCheckpoint(checkpointPath, checkpoint);
    assert.deepEqual(JSON.parse(await readFile(checkpointPath, 'utf8')), checkpoint);
    const updatedCheckpoint = { ...checkpoint, phase: 'before-browser-cleanup', screenshotCount: 2 };
    await writeCheckpoint(checkpointPath, updatedCheckpoint);
    assert.deepEqual(JSON.parse(await readFile(checkpointPath, 'utf8')), updatedCheckpoint);
    assert.deepEqual(await readdir(directory), ['acceptance-report.partial.json']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('the total diagnostic deadline invokes its handler once and can be cancelled', async () => {
  let calls = 0;
  let resolveExpired;
  const expired = new Promise((resolve) => { resolveExpired = resolve; });
  const cancel = startDeadline(10, () => {
    calls += 1;
    resolveExpired();
  });
  await expired;
  await new Promise((resolve) => setTimeout(resolve, 20));
  cancel();
  assert.equal(calls, 1);

  let cancelledCalls = 0;
  const cancelBeforeDeadline = startDeadline(10, () => { cancelledCalls += 1; });
  cancelBeforeDeadline();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cancelledCalls, 0);
});
