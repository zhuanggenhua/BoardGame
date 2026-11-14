import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EventStreamRollbackContext } from '../../../../engine/hooks/EventStreamRollbackContext';
import type { MatchState } from '../../../../engine/types';
import type { FateDominationCore } from '../../domain/types';
import type { CutsceneRuntimeStatus } from '../../fgo-runtime/cutsceneDemoRuntime';

const runtime = vi.hoisted(() => ({ destroy: vi.fn(), status: undefined as ((value: CutsceneRuntimeStatus) => void) | undefined }));
vi.mock('../../fgo-runtime/fgoPreload', () => ({
  FGO_SERVANTS: {}, loadedFgoCharacter: () => undefined, loadedFgoNoble: () => ({ effects: { duration: 18.5, timeline: [
    { type: 'fade', time: 16.35, duration: 1, fadeCurve: [{ time: 0, value: 0 }, { time: 1, value: 1 }] },
  ] } }),
  preloadFgoCharacter: vi.fn(), preloadFgoNoble: vi.fn(), retainFgoAssets: () => () => {},
}));
vi.mock('../../fgo-runtime/fgoCharacterRuntime', () => ({ createFgoBattleRuntime: vi.fn() }));
vi.mock('../../fgo-runtime/fgoSceneRuntime', () => ({
  createFgoSceneRuntime: (_host: unknown, _loaded: unknown, options: { onStatus: (value: CutsceneRuntimeStatus) => void }) => {
    runtime.status = options.onStatus;
    return { destroy: runtime.destroy };
  },
}));

import { FateFgoEffects } from '../FateFgoEffects';

const state = (entries: unknown[]) => ({
  core: { players: { '0': { servantId: 'servant-saber', isRevealed: true } } },
  sys: { eventStream: { entries } },
}) as unknown as MatchState<FateDominationCore>;
const draw = (entries: unknown[], seq: number, watermark: number | null) =>
  <EventStreamRollbackContext.Provider value={{ seq, watermark, reconcileSeq: 0 }}>
    <FateFgoEffects state={state(entries)} viewerId={null} />
  </EventStreamRollbackContext.Provider>;
const noble = (id: number) => ({ id, event: { type: 'LOCATION_RESOLVED', payload: { locationId: 'miyama', results: [], noblePlayerIds: ['0'] } } });

beforeEach(() => { runtime.destroy.mockClear(); runtime.status = undefined; });

it('回滚保留水位前的演出，移除水位后的排队演出', () => {
  const view = render(draw([], 0, null));
  view.rerender(draw([noble(1), noble(2)], 0, null));
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  view.rerender(draw([], 1, 1));
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  expect(runtime.destroy).not.toHaveBeenCalled();
  act(() => runtime.status?.({ time: 18.5, duration: 18.5, phase: 'end', firedEvents: [], isPlaying: false }));
  expect(screen.queryByTestId('fate-fgo-noble')).toBeNull();
  expect(runtime.destroy).toHaveBeenCalledOnce();
});

it('撤回后事件水位回退，不播放已撤回的排队演出', () => {
  const view = render(draw([], 0, null));
  view.rerender(draw([noble(1), noble(2)], 0, null));
  view.rerender(draw([noble(1)], 0, null));
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  act(() => runtime.status?.({ time: 18.5, duration: 18.5, phase: 'end', firedEvents: [], isPlaying: false }));
  expect(screen.queryByTestId('fate-fgo-noble')).toBeNull();
  expect(runtime.destroy).toHaveBeenCalledOnce();
});

it('宝具淡出完成后结束纯白尾段，保留后续排队演出', () => {
  const view = render(draw([], 0, null));
  view.rerender(draw([noble(1), noble(2)], 0, null));
  const firstStatus = runtime.status;
  act(() => firstStatus?.({ time: 17.2, duration: 18.5, phase: 'fade', firedEvents: [], isPlaying: true }));
  expect(runtime.destroy).not.toHaveBeenCalled();
  act(() => {
    firstStatus?.({ time: 17.35, duration: 18.5, phase: 'fade', firedEvents: [], isPlaying: true });
    firstStatus?.({ time: 17.4, duration: 18.5, phase: 'fade', firedEvents: [], isPlaying: true });
  });
  expect(runtime.destroy).toHaveBeenCalledOnce();
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
});

it('跳过当前宝具后播放下一项，旧回调不能跳过下一项', () => {
  const view = render(draw([], 0, null));
  view.rerender(draw([noble(1), noble(2)], 0, null));
  const oldStatus = runtime.status;
  fireEvent.click(screen.getByRole('button'));
  expect(runtime.destroy).toHaveBeenCalledOnce();
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  act(() => oldStatus?.({ time: 18.5, duration: 18.5, phase: 'end', firedEvents: [], isPlaying: false }));
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByTestId('fate-fgo-noble')).toBeNull();
  expect(runtime.destroy).toHaveBeenCalledTimes(2);
});
