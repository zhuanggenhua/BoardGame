import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runAcceptanceWatchdog } from './betrayal-public-local-acceptance-watchdog.mjs';

test('a hung acceptance step has an initial checkpoint and a readable timeout report before its child is terminated', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'betrayal-acceptance-watchdog-'));
  const runnerPath = path.join(directory, 'fake-acceptance-runner.mjs');
  const markerPath = path.join(directory, 'runner-start-state.json');
  await writeFile(runnerPath, [
    "import { readFileSync, writeFileSync } from 'node:fs';",
    "const report = JSON.parse(readFileSync(process.env.BETRAYAL_PUBLIC_ACCEPTANCE_REPORT_PATH, 'utf8'));",
    "const checkpointPath = process.env.BETRAYAL_PUBLIC_ACCEPTANCE_CHECKPOINT_PATH;",
    "const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8'));",
    "writeFileSync(process.env.BETRAYAL_TEST_MARKER_PATH, JSON.stringify({ reportStatus: report.status, caseStatus: report.caseStatus, checkpointPhase: checkpoint.phase }));",
    "writeFileSync(checkpointPath, JSON.stringify({ ...checkpoint, phase: 'fixture-hanging-step', steps: [{ name: 'simulated hanging page evaluation', status: 'IN_PROGRESS' }] }));",
    "process.stdout.write('step-started\\n');",
    'setInterval(() => {}, 1000);',
  ].join('\n'), 'utf8');
  let timeoutReportWasReadableBeforeTermination = false;

  try {
    const result = await runAcceptanceWatchdog({
      projectRoot: directory,
      acceptanceRoot: path.join(directory, 'evidence'),
      runnerPath,
      runnerArgs: ['--case', 'room-reveal-sequencing'],
      timeoutMs: 750,
      env: { ...process.env, BETRAYAL_TEST_MARKER_PATH: markerPath },
      onTimeoutReportWritten: async (reportPath, report, child) => {
        const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
        const marker = JSON.parse(await readFile(markerPath, 'utf8'));
        assert.equal(writtenReport.status, 'TIMEOUT');
        assert.equal(writtenReport.caseStatus, 'TIMEOUT');
        assert.equal(writtenReport.watchdog.reportWrittenBeforeTermination, true);
        assert.equal(writtenReport.phase, 'fixture-hanging-step');
        assert.equal(writtenReport.steps[0].name, 'simulated hanging page evaluation');
        assert.equal(marker.reportStatus, 'IN_PROGRESS');
        assert.equal(marker.caseStatus, 'IN_PROGRESS');
        assert.equal(marker.checkpointPhase, 'watchdog-initialized');
        assert.equal(child.exitCode, null);
        timeoutReportWasReadableBeforeTermination = true;
      },
    });
    const report = JSON.parse(await readFile(result.reportPath, 'utf8'));
    assert.equal(result.timedOut, true);
    assert.equal(result.childTerminated, true, JSON.stringify(report.watchdog.termination));
    assert.equal(timeoutReportWasReadableBeforeTermination, true);
    assert.equal(report.caseStatus, 'TIMEOUT');
    assert.equal(report.watchdog.childTerminated, true);
  } finally {
    // Windows may briefly keep the child's former working directory busy after
    // its exit event. Retry only this test-owned temporary directory; if the
    // lock is persistent, let cleanup fail rather than hiding an orphan child.
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
