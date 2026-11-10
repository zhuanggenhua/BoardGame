import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { EventStreamRollbackContext } from '../../../../engine/hooks/EventStreamRollbackContext';
import type { MatchState } from '../../../../engine/types';
import type { FateDominationCore } from '../../domain/types';

const destroy = vi.fn();
vi.mock('../../fgo-runtime/fgoPreload', () => ({
  FGO_SERVANTS: {}, loadedFgoCharacter: () => undefined, loadedFgoNoble: () => ({ effects: { duration: 1, timeline: [] } }),
  preloadFgoCharacter: vi.fn(), preloadFgoNoble: vi.fn(), retainFgoAssets: () => () => {},
}));
vi.mock('../../fgo-runtime/fgoCharacterRuntime', () => ({ createFgoBattleRuntime: vi.fn() }));
vi.mock('../../fgo-runtime/fgoSceneRuntime', () => ({ createFgoSceneRuntime: () => ({ destroy }) }));

import { FateFgoEffects } from '../FateFgoEffects';

it('重连同步清除尚未结束的演出，避免旧画面继续覆盖新状态', () => {
  const makeState = (entries: unknown[]) => ({
    core: { players: { '0': { servantId: 'servant-saber', isRevealed: true } } },
    sys: { eventStream: { entries } },
  }) as unknown as MatchState<FateDominationCore>;
  const draw = (entries: unknown[], seq: number) => <EventStreamRollbackContext.Provider value={{ seq, watermark: null, reconcileSeq: 0 }}>
    <FateFgoEffects state={makeState(entries)} viewerId={null} />
  </EventStreamRollbackContext.Provider>;
  const view = render(draw([], 0));
  view.rerender(draw([{ id: 1, event: { type: 'ATTACKS_CONFIRMED', payload: { playerId: '0', cardIds: ['sc_saber_np:1'] } } }], 0));
  expect(screen.getByTestId('fate-fgo-noble')).toBeTruthy();
  view.rerender(draw([], 1));
  expect(screen.queryByTestId('fate-fgo-noble')).toBeNull();
  expect(destroy).toHaveBeenCalledOnce();
});
