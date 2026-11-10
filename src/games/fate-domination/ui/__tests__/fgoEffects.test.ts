import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventStreamEntry } from '../../../../engine/types';
import type { FateDominationCore } from '../../domain/types';

const ready = vi.hoisted(() => ({ characters: new Set<string>(), noble: false }));
vi.mock('../../fgo-runtime/fgoPreload', () => ({
  FGO_SERVANTS: { 'servant-saber': '100100', 'servant-cu-chulainn': '300100', 'servant-medusa': '400100' },
  loadedFgoCharacter: (id: string) => ready.characters.has(id) ? {} : undefined,
  loadedFgoNoble: () => ready.noble ? {} : undefined,
  preloadFgoCharacter: vi.fn(), preloadFgoNoble: vi.fn(),
}));
vi.mock('../../fgo-runtime/fgoCharacterRuntime', () => ({ createFgoBattleRuntime: vi.fn() }));
vi.mock('../../fgo-runtime/fgoSceneRuntime', () => ({ createFgoSceneRuntime: vi.fn() }));

import { fateFgoSequenceFor } from '../fgoSequence';

const player = (servantId: string, isRevealed: boolean, deploymentSlot: number | null = null) => ({ servantId, isRevealed, deploymentSlot });
const core = { players: {
  '0': player('servant-saber', true), '1': player('servant-cu-chulainn', true),
  '2': player('servant-medusa', false),
}, battlefield: { miyama: { playerIds: ['0', '1', '2'] }, shinto: { playerIds: [] }, recon: { playerIds: [] } } } as unknown as FateDominationCore;
const event = (type: string, payload: unknown): EventStreamEntry => ({ id: 42, event: { type, payload } }) as EventStreamEntry;
const location = (results: Array<{ playerId: string; power: number; status: string }>, locationId = 'miyama') =>
  event('LOCATION_RESOLVED', { locationId, results });

describe('Fate 角色演出事件', () => {
  beforeEach(() => { ready.characters.clear(); ready.noble = false; });

  it('按实际地点结果区分攻击与受击，隐藏身份和未加载角色不出镜', () => {
    ready.characters.add('servant-saber'); ready.characters.add('servant-cu-chulainn'); ready.characters.add('servant-medusa');
    const result = fateFgoSequenceFor(location([
      { playerId: '0', power: 8, status: 'representative-win' },
      { playerId: '1', power: 4, status: 'deferred' },
      { playerId: '2', power: 2, status: 'deferred' },
    ]), core);
    expect(result).toEqual({ id: 42, kind: 'battle', locationId: 'miyama', laneCount: 3, actors: [
      { playerId: '1', servantId: 'servant-cu-chulainn', role: 'damage', lane: 0, targetLane: 1, facing: 'right' },
      { playerId: '0', servantId: 'servant-saber', role: 'attack', lane: 1, targetLane: 0, facing: 'left' },
    ] });
    ready.characters.clear();
    expect(fateFgoSequenceFor(location([
      { playerId: '0', power: 8, status: 'representative-win' },
      { playerId: '1', power: 4, status: 'deferred' },
    ]), core)).toBeUndefined();
  });

  it('按地图棋子站位确定左右和相向，交换胜负不交换玩家位置', () => {
    ready.characters.add('servant-saber'); ready.characters.add('servant-cu-chulainn');
    const result = (winner: string) => fateFgoSequenceFor(location([
      { playerId: '0', power: winner === '0' ? 8 : 4, status: winner === '0' ? 'representative-win' : 'deferred' },
      { playerId: '1', power: winner === '1' ? 8 : 4, status: winner === '1' ? 'representative-win' : 'deferred' },
    ]), core);
    const leftWins = result('1'); const rightWins = result('0');
    expect(leftWins?.kind).toBe('battle'); expect(rightWins?.kind).toBe('battle');
    if (leftWins?.kind !== 'battle' || rightWins?.kind !== 'battle') throw new Error('缺少战斗演出');
    expect(leftWins.actors.map(a => [a.playerId, a.lane, a.facing, a.role])).toEqual([
      ['1', 0, 'right', 'attack'], ['0', 1, 'left', 'damage'],
    ]);
    expect(rightWins.actors.map(a => [a.playerId, a.lane, a.facing, a.role])).toEqual([
      ['1', 0, 'right', 'damage'], ['0', 1, 'left', 'attack'],
    ]);
  });

  it('平手和侦察不会凭空制造受击对象', () => {
    ready.characters.add('servant-saber'); ready.characters.add('servant-cu-chulainn');
    const tied = [{ playerId: '0', power: 4, status: 'representative-win' }, { playerId: '1', power: 4, status: 'representative-win' }];
    expect(fateFgoSequenceFor(location(tied), core)).toBeUndefined();
    expect(fateFgoSequenceFor(location(tied, 'recon'), core)).toBeUndefined();
  });

  it('仅确认誓约胜利之剑且真名公开、素材就绪时播放宝具', () => {
    const confirmed = event('ATTACKS_CONFIRMED', { playerId: '0', cardIds: ['sc_saber_np:2', 'other'] });
    expect(fateFgoSequenceFor(confirmed, core)).toBeUndefined();
    ready.noble = true;
    expect(fateFgoSequenceFor(confirmed, core)).toEqual({ id: 42, kind: 'noble' });
    const hidden = { players: { ...core.players, '0': player('servant-saber', false) } } as unknown as FateDominationCore;
    expect(fateFgoSequenceFor(confirmed, hidden)).toBeUndefined();
    expect(fateFgoSequenceFor(event('ATTACKS_CONFIRMED', { playerId: '0', cardIds: ['sc_saber_2:1'] }), core)).toBeUndefined();
  });
});
