import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getFxFrameSubscriberCount,
  resetFxFrameClockForTests,
  scheduleFxFrameCallback,
  subscribeFxFrame,
  type FxFrameCallback,
} from '../frameClock';

describe('fx frame clock', () => {
  afterEach(() => {
    resetFxFrameClockForTests();
    vi.unstubAllGlobals();
  });

  it('用一个 requestAnimationFrame 驱动多个订阅者', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const first: FxFrameCallback = vi.fn();
    const second: FxFrameCallback = vi.fn();

    const unsubscribeFirst = subscribeFxFrame(first);
    const unsubscribeSecond = subscribeFxFrame(second);

    expect(getFxFrameSubscriberCount()).toBe(2);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    pendingFrames.shift()!(100);

    expect(first).toHaveBeenCalledWith(expect.objectContaining({ now: 100, deltaMs: 0, frame: 1 }));
    expect(second).toHaveBeenCalledWith(expect.objectContaining({ now: 100, deltaMs: 0, frame: 1 }));
    expect(requestFrame).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    expect(getFxFrameSubscriberCount()).toBe(1);

    unsubscribeSecond();
    expect(getFxFrameSubscriberCount()).toBe(0);
    expect(cancelFrame).toHaveBeenCalled();
  });

  it('限制大间隔帧的 delta，避免后台恢复后特效跳帧', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const callback: FxFrameCallback = vi.fn();
    subscribeFxFrame(callback);

    pendingFrames.shift()!(100);
    pendingFrames.shift()!(260);

    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
      now: 260,
      deltaMs: 50,
      deltaSec: 0.05,
      frame: 2,
    }));
  });

  it('按共享帧时钟触发一次性延迟回调', () => {
    const pendingFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const callback = vi.fn();
    scheduleFxFrameCallback(32, callback);

    pendingFrames.shift()!(100);
    expect(callback).not.toHaveBeenCalled();

    pendingFrames.shift()!(116);
    expect(callback).not.toHaveBeenCalled();

    pendingFrames.shift()!(132);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ now: 132 }));
    expect(getFxFrameSubscriberCount()).toBe(0);
  });
});
