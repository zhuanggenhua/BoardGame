import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function isExpectedLocalAiTurnOwner(persisted, humanPlayerId) {
  if (!persisted?.snapshotFound || !persisted.seedMatchesCurrentUrl) return false;
  const currentPlayerId = String(persisted.currentPlayerId ?? '');
  return currentPlayerId.length > 0
    && currentPlayerId !== String(humanPlayerId)
    && persisted.seatControllers?.[currentPlayerId]?.type === 'local-ai';
}

export function withTimeout(promise, timeoutMs, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

export async function waitForPendingDecisionOrSettledBoard(readState, { timeoutMs = 30_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() <= deadline) {
    lastState = await readState();
    const pendingKinds = Array.isArray(lastState?.pendingKinds) ? lastState.pendingKinds : [];
    if (pendingKinds.length > 0) return { kind: 'pending', state: lastState };
    if (lastState?.settledBoard === true) return { kind: 'settled', state: lastState };
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remainingMs)));
  }
  throw new Error(`resolution state exceeded ${timeoutMs} ms; last state: ${JSON.stringify(lastState)}`);
}

export async function waitForPendingDecisionPresentation(readState, isDecisionVisible, { timeoutMs = 15_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastState = null;
  while (Date.now() <= deadline) {
    if (await isDecisionVisible()) return { kind: 'visible', state: lastState };
    lastState = await readState();
    if (lastState?.settledBoard === true && (lastState.pendingKinds?.length ?? 0) === 0) {
      return { kind: 'settled', state: lastState };
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remainingMs)));
  }
  throw new Error(`pending decision presentation exceeded ${timeoutMs} ms; last state: ${JSON.stringify(lastState)}`);
}

export function requireSettledBoard(result) {
  if (result?.kind !== 'settled') {
    const pendingKinds = result?.state?.pendingKinds ?? [];
    throw new Error(`pending business decisions remain: ${pendingKinds.join(', ') || 'board is not usable'}`);
  }
  return result.state;
}

export async function writeCheckpoint(destination, value) {
  const directory = path.dirname(destination);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export function startDeadline(timeoutMs, onExpire) {
  let active = true;
  const timer = setTimeout(() => {
    if (!active) return;
    active = false;
    try { Promise.resolve(onExpire()).catch(() => {}); }
    catch { /* deadline callbacks must not become unhandled rejections */ }
  }, timeoutMs);
  return () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
  };
}
