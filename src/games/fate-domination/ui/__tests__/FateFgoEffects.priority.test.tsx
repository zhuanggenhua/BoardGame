import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { MatchState } from '../../../../engine/types';
import type { FateDominationCore } from '../../domain/types';

const preload = vi.hoisted(() => vi.fn(async () => {}));
const preloadCharacter = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../fgo-runtime/fgoPreload', () => ({
  FGO_SERVANTS: { 'servant-saber': '100100' }, loadedFgoCharacter: () => undefined, loadedFgoNoble: () => undefined,
  preloadFgoCharacter: preloadCharacter, preloadFgoNoble: preload, retainFgoAssets: () => () => {},
}));
vi.mock('../../fgo-runtime/fgoCharacterRuntime', () => ({ createFgoBattleRuntime: vi.fn() }));
vi.mock('../../fgo-runtime/fgoSceneRuntime', () => ({ createFgoSceneRuntime: vi.fn() }));

import { FateFgoEffects } from '../FateFgoEffects';

it('Saber 真名隐藏时低优先级预载角色和宝具，公开后提升优先级', () => {
  vi.useFakeTimers();
  try {
    const state = (isRevealed: boolean) => ({
      core: { players: { '0': { servantId: 'servant-saber', isRevealed } } },
      sys: { eventStream: { entries: [] } },
    }) as unknown as MatchState<FateDominationCore>;
    const view = render(<FateFgoEffects state={state(false)} viewerId="0" />);
    act(() => vi.advanceTimersByTime(1000));
    expect(preloadCharacter).toHaveBeenCalledWith('servant-saber', 'low');
    expect(preloadCharacter).not.toHaveBeenCalledWith('servant-saber', 'high');
    expect(preload).toHaveBeenCalledWith('low');
    expect(preload).not.toHaveBeenCalledWith('high');
    view.rerender(<FateFgoEffects state={state(true)} viewerId="0" />);
    expect(preloadCharacter).toHaveBeenCalledWith('servant-saber', 'high');
    expect(preload).toHaveBeenCalledWith('high');
    view.unmount();
  } finally { vi.useRealTimers(); }
});
