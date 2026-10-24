import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeCheckpoint } from './betrayal-public-local-acceptance-runtime.mjs';

const DEFAULT_TARGET = 'https://boardgame-betrayal-local-verification.blushbison1024.chatgpt.site/play/betrayal/local';
const DEFAULT_TIMEOUT_MS = 180_000;

const childHasExited = (child) => child.exitCode !== null || child.signalCode !== null;

async function waitForChildExit(child, timeoutMs) {
  if (childHasExited(child)) return true;
  let timer;
  const exited = once(child, 'exit').then(() => true);
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    await Promise.race([exited, timedOut]);
    return childHasExited(child);
  } finally {
    clearTimeout(timer);
  }
}

async function terminateOwnedChildTree(child) {
  if (!child.pid || childHasExited(child)) return { attempted: false, childTerminated: childHasExited(child) };

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch (error) {
      if (!(await waitForChildExit(child, 1_000))) {
        return { attempted: true, childTerminated: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    const childTerminated = await waitForChildExit(child, 2_000);
    return { attempted: true, childTerminated, method: 'taskkill /T /F' };
  }

  child.kill('SIGTERM');
  if (!(await waitForChildExit(child, 500))) child.kill('SIGKILL');
  const childTerminated = await waitForChildExit(child, 1_000);
  return { attempted: true, childTerminated, method: 'SIGTERM then SIGKILL if needed' };
}

async function readCheckpoint(checkpointPath) {
  if (!checkpointPath) return null;
  try {
    return JSON.parse(await readFile(checkpointPath, 'utf8'));
  } catch {
    return null;
  }
}

export function watchChildProcess(child, {
  timeoutMs,
  reportPath,
  checkpointPath,
  baseReport,
  onTimeoutReportWritten,
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be positive');
  if (!reportPath) throw new TypeError('reportPath is required');

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finishNormally = (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut: false, exitCode: code, signal, childPid: child.pid ?? null });
    };

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', finishNormally);

    timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      const timedOutAt = new Date().toISOString();
      const checkpoint = await readCheckpoint(checkpointPath);
      const report = {
        ...baseReport,
        ...(checkpoint ?? {}),
        status: 'TIMEOUT',
        caseStatus: 'TIMEOUT',
        functionalStatus: 'NOT_VERIFIED',
        verdict: 'TIMEOUT',
        finishedAt: timedOutAt,
        watchdog: {
          ...(baseReport?.watchdog ?? {}),
          status: 'TIMEOUT',
          timeoutMs,
          childPid: child.pid ?? null,
          childTerminated: false,
          reportWrittenBeforeTermination: false,
          lastCheckpointPath: checkpointPath ?? null,
        },
      };

      let reportWriteError = null;
      try {
        // Persist the terminal state before sending any termination signal to the owned child tree.
        await writeCheckpoint(reportPath, report);
        report.watchdog.reportWrittenBeforeTermination = true;
        await writeCheckpoint(reportPath, report);
        await onTimeoutReportWritten?.(reportPath, report, child);
      } catch (error) {
        reportWriteError = error instanceof Error ? error.message : String(error);
      }

      const termination = await terminateOwnedChildTree(child);
      report.watchdog.childTerminated = termination.childTerminated;
      report.watchdog.termination = termination;
      if (reportWriteError) report.watchdog.reportWriteError = reportWriteError;
      report.finishedAt = new Date().toISOString();

      try {
        // Rewrite after exit so a child racing finalization cannot replace the timeout result.
        await writeCheckpoint(reportPath, report);
      } catch (error) {
        report.watchdog.finalReportWriteError = error instanceof Error ? error.message : String(error);
      }
      resolve({ timedOut: true, childTerminated: termination.childTerminated, childPid: child.pid ?? null, reportPath, report });
    }, timeoutMs);
  });
}

function getOptionValue(args, option) {
  const index = args.indexOf(option);
  return index < 0 ? null : args[index + 1] ?? null;
}

export async function runAcceptanceWatchdog({
  projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  runnerPath = path.join(projectRoot, 'scripts/verify/betrayal-public-local-acceptance.mjs'),
  runnerArgs = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  env = process.env,
  acceptanceRoot = path.join(projectRoot, 'test-results/evidence-screenshots/betrayal/public-local-acceptance'),
  onTimeoutReportWritten,
} = {}) {
  const runId = `${new Date().toISOString().replace(/[:.]/gu, '-')}-${randomBytes(3).toString('hex')}`;
  const runDir = path.join(acceptanceRoot, `run-${runId}`);
  const reportPath = path.join(runDir, 'acceptance-report.json');
  const checkpointPath = path.join(runDir, 'acceptance-report.partial.json');
  const caseName = getOptionValue(runnerArgs, '--case') ?? 'full-flow';
  const targetUrl = env.BASE_URL ?? DEFAULT_TARGET;
  const manifestPath = env.EXPECTED_BUNDLE_MANIFEST_PATH ?? null;
  let expectedBundleManifest = null;
  if (manifestPath) {
    try {
      const resolvedManifest = path.resolve(projectRoot, manifestPath);
      expectedBundleManifest = JSON.parse(await readFile(resolvedManifest, 'utf8'));
    } catch (error) {
      expectedBundleManifest = { readError: error instanceof Error ? error.message : String(error) };
    }
  }

  const startedAt = new Date().toISOString();
  const baseReport = {
    schemaVersion: 1,
    type: 'public-local-acceptance-watchdog-report',
    status: 'IN_PROGRESS',
    case: caseName,
    caseStatus: 'IN_PROGRESS',
    functionalStatus: 'NOT_VERIFIED',
    verdict: 'PENDING',
    runId,
    startedAt,
    target: targetUrl,
    expectedPublishedSiteVersion: expectedBundleManifest?.siteVersion ?? null,
    expectedBundleSha256: expectedBundleManifest?.bundles ?? [],
    environment: { host: os.hostname(), node: process.version },
    steps: [],
    media: [],
    diagnostics: {},
    watchdog: { status: 'RUNNING', timeoutMs, childPid: null },
  };
  await writeCheckpoint(reportPath, baseReport);
  await writeCheckpoint(checkpointPath, { ...baseReport, type: 'public-local-acceptance-checkpoint', phase: 'watchdog-initialized' });

  const child = spawn(process.execPath, [runnerPath, ...runnerArgs], {
    cwd: projectRoot,
    env: {
      ...env,
      BETRAYAL_PUBLIC_ACCEPTANCE_RUN_ID: runId,
      BETRAYAL_PUBLIC_ACCEPTANCE_REPORT_PATH: reportPath,
      BETRAYAL_PUBLIC_ACCEPTANCE_CHECKPOINT_PATH: checkpointPath,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
  baseReport.watchdog.childPid = child.pid ?? null;

  let result;
  try {
    result = await watchChildProcess(child, {
      timeoutMs,
      reportPath,
      checkpointPath,
      baseReport,
      onTimeoutReportWritten,
    });
  } catch (error) {
    await writeCheckpoint(reportPath, {
      ...baseReport,
      status: 'START_FAILED',
      caseStatus: 'FAIL',
      functionalStatus: 'NOT_VERIFIED',
      verdict: 'REVISE',
      finishedAt: new Date().toISOString(),
      failure: error instanceof Error ? error.message : String(error),
      watchdog: { ...baseReport.watchdog, status: 'START_FAILED' },
    });
    throw error;
  }
  if (result.timedOut) {
    console.error(`[public-local-acceptance-watchdog] timeout report: ${reportPath}`);
  } else {
    const currentReport = await readCheckpoint(reportPath);
    if (currentReport?.status === 'IN_PROGRESS' || currentReport?.caseStatus === 'IN_PROGRESS') {
      await writeCheckpoint(reportPath, {
        ...currentReport,
        status: 'CHILD_EXITED_WITHOUT_FINAL_REPORT',
        caseStatus: 'NOT_VERIFIED',
        functionalStatus: 'NOT_VERIFIED',
        verdict: 'REVISE',
        finishedAt: new Date().toISOString(),
        watchdog: { ...baseReport.watchdog, status: 'CHILD_EXITED', exitCode: result.exitCode },
      });
    }
    console.log(`[public-local-acceptance-watchdog] child exit=${result.exitCode}; report: ${reportPath}`);
  }
  return { ...result, reportPath, checkpointPath, runDir };
}

async function runWatchdogCli() {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const result = await runAcceptanceWatchdog({ projectRoot, runnerArgs: process.argv.slice(2) });
  process.exitCode = result.timedOut ? 124 : result.exitCode ?? 1;
}

const thisFile = path.resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runWatchdogCli().catch((error) => {
    console.error(`[public-local-acceptance-watchdog] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
