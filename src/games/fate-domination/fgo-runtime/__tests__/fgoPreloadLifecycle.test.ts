import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn(), asset: vi.fn() }));
vi.mock('../fgoAssets', () => ({ readFgoJson: mocks.read, readFgoAsset: mocks.asset }));
import { loadedFgoCharacter, loadedFgoNoble, preloadFgoCharacter, preloadFgoNoble, retainFgoAssets } from '../fgoPreload';

describe('Fate 预载生命周期', () => {
  beforeEach(() => { mocks.read.mockReset(); mocks.asset.mockReset(); });
  it('最后一个牌桌退出时取消未完成的预载，并允许下个牌桌重新加载', async () => {
    let finishFirst!: (value: unknown) => void;
    let finishSecond!: (value: unknown) => void;
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
    const releaseFirst = retainFgoAssets();
    const first = preloadFgoCharacter('servant-saber');
    const firstSignal = mocks.read.mock.calls[0][2] as AbortSignal;
    releaseFirst();
    expect(firstSignal.aborted).toBe(true);
    const releaseSecond = retainFgoAssets();
    const second = preloadFgoCharacter('servant-saber');
    expect(mocks.read).toHaveBeenCalledTimes(2);
    finishFirst({});
    await first;
    expect(loadedFgoCharacter('servant-saber')).toBeUndefined();
    releaseSecond();
    finishSecond({});
    await second;
    expect(loadedFgoCharacter('servant-saber')).toBeUndefined();
    expect(mocks.asset).not.toHaveBeenCalled();
  });

  it('选择正在低优先级预载的角色时，取消旧请求并以高优先级重新加载', async () => {
    let finishLow!: (value: unknown) => void;
    let finishHigh!: (value: unknown) => void;
    mocks.read.mockImplementationOnce(() => new Promise(resolve => { finishLow = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishHigh = resolve; }));
    const release = retainFgoAssets();
    const low = preloadFgoCharacter('servant-cu-chulainn', 'low');
    const lowSignal = mocks.read.mock.calls[0][2] as AbortSignal;
    const high = preloadFgoCharacter('servant-cu-chulainn', 'high');
    expect(lowSignal.aborted).toBe(true);
    expect(mocks.read.mock.calls[1][1]).toBe('high');
    release();
    finishLow({}); finishHigh({});
    await Promise.all([low, high]);
    expect(loadedFgoCharacter('servant-cu-chulainn')).toBeUndefined();
  });

  it('宝具预载提升优先级时取消旧请求，对局退出后不保留旧数据', async () => {
    const finish: Array<(value: unknown) => void> = [];
    mocks.read.mockImplementation(() => new Promise(resolve => { finish.push(resolve); }));
    const release = retainFgoAssets();
    const low = preloadFgoNoble('low');
    expect(mocks.read).toHaveBeenCalledTimes(5);
    const lowSignal = mocks.read.mock.calls[0][2] as AbortSignal;
    const high = preloadFgoNoble('high');
    expect(lowSignal.aborted).toBe(true);
    expect(mocks.read).toHaveBeenCalledTimes(10);
    expect(mocks.read.mock.calls[5][1]).toBe('high');
    release();
    finish.forEach(resolve => resolve({}));
    await Promise.all([low, high]);
    expect(loadedFgoNoble()).toBeUndefined();
  });
});
