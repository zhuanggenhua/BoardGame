/**
 * Shared FX frame clock.
 *
 * Canvas, shader and particle effects should subscribe here instead of each
 * creating its own requestAnimationFrame loop. This mirrors a game-engine
 * style ticker: one frame pump, many render/update subscribers.
 */

export interface FxFrame {
  now: number;
  deltaMs: number;
  deltaSec: number;
  frame: number;
}

export type FxFrameCallback = (frame: FxFrame) => void;
export type FxFrameSubscription = () => void;
export type FxFrameScheduledCallback = (frame: FxFrame) => void;

const MAX_DELTA_MS = 50;

const subscribers = new Set<FxFrameCallback>();

let frameHandle: number | ReturnType<typeof setTimeout> | null = null;
let lastFrameNow = 0;
let frameIndex = 0;

function getNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function normalizeFrameNow(now: number): number {
  return Number.isFinite(now) ? now : getNow();
}

function requestNextFrame(callback: (now: number) => void): number | ReturnType<typeof setTimeout> {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(getNow()), 16);
}

function cancelNextFrame(handle: number | ReturnType<typeof setTimeout>) {
  if (typeof cancelAnimationFrame === 'function' && typeof handle === 'number') {
    cancelAnimationFrame(handle);
    return;
  }
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

function stopFrameLoop() {
  if (frameHandle !== null) {
    cancelNextFrame(frameHandle);
    frameHandle = null;
  }
  lastFrameNow = 0;
}

function scheduleFrame() {
  if (frameHandle !== null || subscribers.size === 0) return;
  frameHandle = requestNextFrame(runFrame);
}

function runFrame(now: number) {
  const frameNow = normalizeFrameNow(now);
  frameHandle = null;

  const rawDeltaMs = lastFrameNow > 0 ? frameNow - lastFrameNow : 0;
  const deltaMs = Math.max(0, Math.min(rawDeltaMs, MAX_DELTA_MS));
  lastFrameNow = frameNow;
  frameIndex += 1;

  const frame: FxFrame = {
    now: frameNow,
    deltaMs,
    deltaSec: deltaMs / 1000,
    frame: frameIndex,
  };

  for (const subscriber of [...subscribers]) {
    subscriber(frame);
  }

  scheduleFrame();
}

export function subscribeFxFrame(callback: FxFrameCallback): FxFrameSubscription {
  subscribers.add(callback);
  scheduleFrame();

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      stopFrameLoop();
    }
  };
}

/**
 * Schedule a one-shot callback on the shared FX frame clock.
 *
 * Use this for animation timeline milestones such as impact / completion when
 * the callback should land on a rendered frame instead of firing between frames.
 */
export function scheduleFxFrameCallback(
  delayMs: number,
  callback: FxFrameScheduledCallback,
): FxFrameSubscription {
  const targetDelayMs = Math.max(0, delayMs);
  let firstFrameNow: number | null = null;
  let unsubscribe: FxFrameSubscription | undefined;
  let done = false;

  const finish = (frame: FxFrame) => {
    if (done) return;
    done = true;
    unsubscribe?.();
    callback(frame);
  };

  unsubscribe = subscribeFxFrame((frame) => {
    if (firstFrameNow === null) {
      firstFrameNow = frame.now;
    }
    if (frame.now - firstFrameNow >= targetDelayMs) {
      finish(frame);
    }
  });

  return () => {
    if (done) return;
    done = true;
    unsubscribe?.();
  };
}

export function getFxFrameSubscriberCount(): number {
  return subscribers.size;
}

export function resetFxFrameClockForTests() {
  subscribers.clear();
  stopFrameLoop();
  frameIndex = 0;
}
