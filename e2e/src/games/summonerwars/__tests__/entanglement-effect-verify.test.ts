/**
 * 验证：交缠颂歌共享技能是否真的影响移动/攻击/战力计算
 */
import { describe, it, expect } from 'vitest';
import { SummonerWarsDomain, SW_COMMANDS } from '../domain';
import type { SummonerWarsCore, BoardUnit, UnitCard, PlayerId, CellCoord } from '../domain/types';
import type { RandomFn, GameEvent } from '../../../engine/types';
import {
  getUnitAbilities, getUnitBaseAbilities,
  canMoveToEnhanced, getUnitMoveEnhancements,
  canAttackEnhanced, getEffectiveAttackRange,
  hasChargeAbility,
} from '../domain/helpers';
import { getEffectiveStrengthValue } from '../domain/abilityResolver';
import { createInitializedCore, generateInstanceId } from './test-helpers';

function createTestRandom(): RandomFn {
  return { shuffle: <T>(a: T[]) => a, random: () => 0.5, d: (m: number) => Math.ceil(m / 2), range: (a: number, b: number) => Math.floor((a + b) / 2) };
}
const fixedTimestamp = 1000;

function executeAndReduce(
  state: SummonerWarsCore, commandType: string, payload: Record<string, unknown>
): { newState: SummonerWarsCore; events: GameEvent[] } {
  const fullState = { core: state, sys: {} as any };
  const command = { type: commandType, payload, timestamp: fixedTimestamp, playerId: state.currentPlayer };
  const events = SummonerWarsDomain.execute(fullState, command, createTestRandom());
  let newState = state;
  for (const event of events) { newState = SummonerWarsDomain.reduce(newState, event); }
  return { newState, events };
}

describe('交缠颂歌共享技能实际效果验证', () => {
  function setupEntanglement(): SummonerWarsCore {
    const state = createInitializedCore(['0', '1'], createTestRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    for (let r = 0; r <= 7; r++) for (let c = 0; c < 6; c++) { state.board[r][c].unit = undefined; state.board[r][c].structure = undefined; }

    // unit1: 近战，有 charge（冲锋），无 flying
    const card1: UnitCard = { id: 't1', cardType: 'unit', name: '冲锋兵', unitClass: 'common', faction: 'barbaric', strength: 2, life: 3, cost: 2, attackType: 'melee', attackRange: 1, abilities: ['charge'], deckSymbols: [] };
    // unit2: 远程，有 flying（飞行），无 charge
    const card2: UnitCard = { id: 't2', cardType: 'unit', name: '飞行兵', unitClass: 'common', faction: 'barbaric', strength: 1, life: 4, cost: 3, attackType: 'ranged', attackRange: 3, abilities: ['flying'], deckSymbols: [] };

    state.board[4][2].unit = { instanceId: generateInstanceId('target-1'), cardId: 'target-1', card: card1, owner: '0' as PlayerId, position: { row: 4, col: 2 }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false };
    state.board[4][4].unit = { instanceId: generateInstanceId('target-2'), cardId: 'target-2', card: card2, owner: '0' as PlayerId, position: { row: 4, col: 4 }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false };

    state.phase = 'summon';
    state.currentPlayer = '0';

    // 打出交缠颂歌
    state.players['0'].hand.push({
      id: 'barbaric-chant-of-entanglement-0', cardType: 'event', name: '交缠颂歌',
      playPhase: 'summon', isActive: true, effect: '两个友方士兵共享技能。', cost: 0, faction: 'barbaric', deckSymbols: [],
    } as any);

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'barbaric-chant-of-entanglement-0',
      targets: [{ row: 4, col: 2 }, { row: 4, col: 4 }],
    });

    return newState;
  }

  it('冲锋兵获得飞行后，移动增强应包含 canPassThrough', () => {
    const state = setupEntanglement();
    const unit1 = state.board[4][2].unit!;
    
    // 验证技能列表
    const abilities = getUnitAbilities(unit1, state);
    expect(abilities).toContain('charge');
    expect(abilities).toContain('flying'); // 从 unit2 共享

    // 验证移动增强
    const enhancements = getUnitMoveEnhancements(state, { row: 4, col: 2 });
    console.log('冲锋兵移动增强:', enhancements);
    expect(enhancements.canPassThrough).toBe(true); // flying 给的
    expect(enhancements.isChargeUnit).toBe(true); // 自带 charge
    expect(enhancements.extraDistance).toBeGreaterThanOrEqual(1); // flying +1
  });

  it('飞行兵获得冲锋后，hasChargeAbility 应返回 true', () => {
    const state = setupEntanglement();
    const unit2 = state.board[4][4].unit!;
    
    const abilities = getUnitAbilities(unit2, state);
    expect(abilities).toContain('flying');
    expect(abilities).toContain('charge'); // 从 unit1 共享

    expect(hasChargeAbility(unit2, state)).toBe(true);
    
    // 冲锋移动验证：4格直线应该可以（路径无阻挡）
    const canCharge = canMoveToEnhanced(state, { row: 4, col: 4 }, { row: 0, col: 4 });
    console.log('飞行兵冲锋到 (0,4):', canCharge);
    expect(canCharge).toBe(true); // 4格直线冲锋（纵向无阻挡）
  });

  it('战力计算应考虑共享的 power_up 技能', () => {
    const state = createInitializedCore(['0', '1'], createTestRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    for (let r = 0; r <= 7; r++) for (let c = 0; c < 6; c++) { state.board[r][c].unit = undefined; state.board[r][c].structure = undefined; }

    // unit1: 有 power_up（力量强化），3 充能
    const card1: UnitCard = { id: 't1', cardType: 'unit', name: '力量兵', unitClass: 'common', faction: 'barbaric', strength: 1, life: 5, cost: 3, attackType: 'melee', attackRange: 1, abilities: ['power_up'], deckSymbols: [] };
    // unit2: 无特殊技能，2 充能
    const card2: UnitCard = { id: 't2', cardType: 'unit', name: '普通兵', unitClass: 'common', faction: 'barbaric', strength: 2, life: 3, cost: 2, attackType: 'melee', attackRange: 1, abilities: [], deckSymbols: [] };

    state.board[4][2].unit = { instanceId: generateInstanceId('target-1'), cardId: 'target-1', card: card1, owner: '0' as PlayerId, position: { row: 4, col: 2 }, damage: 0, boosts: 3, hasMoved: false, hasAttacked: false };
    state.board[4][4].unit = { instanceId: generateInstanceId('target-2'), cardId: 'target-2', card: card2, owner: '0' as PlayerId, position: { row: 4, col: 4 }, damage: 0, boosts: 2, hasMoved: false, hasAttacked: false };

    state.phase = 'summon';
    state.currentPlayer = '0';

    state.players['0'].hand.push({
      id: 'barbaric-chant-of-entanglement-0', cardType: 'event', name: '交缠颂歌',
      playPhase: 'summon', isActive: true, effect: '两个友方士兵共享技能。', cost: 0, faction: 'barbaric', deckSymbols: [],
    } as any);

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'barbaric-chant-of-entanglement-0',
      targets: [{ row: 4, col: 2 }, { row: 4, col: 4 }],
    });

    const unit2 = newState.board[4][4].unit!;
    const strength = getEffectiveStrengthValue(unit2, newState);
    console.log('普通兵获得 power_up 后战力:', strength, '(基础2 + 2充能 = 4)');
    // unit2 基础战力2，有2充能，获得 power_up 后应该是 2 + min(2, 5) = 4
    expect(strength).toBe(4);
  });
});


describe('交缠颂歌共享 tempAbilities 验证', () => {
  it('交缠共享只包含基础技能（card.abilities），不含 tempAbilities', () => {
    const state = createInitializedCore(['0', '1'], createTestRandom(), { faction0: 'barbaric', faction1: 'necromancer' });
    for (let r = 0; r <= 7; r++) for (let c = 0; c < 6; c++) { state.board[r][c].unit = undefined; state.board[r][c].structure = undefined; }

    // unit1: 无技能
    const card1: UnitCard = { id: 't1', cardType: 'unit', name: '普通兵A', unitClass: 'common', faction: 'barbaric', strength: 2, life: 3, cost: 2, attackType: 'melee', attackRange: 1, abilities: [], deckSymbols: [] };
    // unit2: card.abilities=['swift'], tempAbilities=['flying']（幻化复制获得的临时技能）
    const card2: UnitCard = { id: 't2', cardType: 'unit', name: '普通兵B', unitClass: 'common', faction: 'barbaric', strength: 1, life: 4, cost: 3, attackType: 'melee', attackRange: 1, abilities: ['swift'], deckSymbols: [] };

    state.board[4][2].unit = { instanceId: generateInstanceId('target-1'), cardId: 'target-1', card: card1, owner: '0' as PlayerId, position: { row: 4, col: 2 }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false };
    state.board[4][4].unit = { instanceId: generateInstanceId('target-2'), cardId: 'target-2', card: card2, owner: '0' as PlayerId, position: { row: 4, col: 4 }, damage: 0, boosts: 0, hasMoved: false, hasAttacked: false, tempAbilities: ['flying'] };

    state.phase = 'summon';
    state.currentPlayer = '0';

    // 打出交缠颂歌
    state.players['0'].hand.push({
      id: 'barbaric-chant-of-entanglement-0', cardType: 'event', name: '交缠颂歌',
      playPhase: 'summon', isActive: true, effect: '两个友方士兵共享技能。', cost: 0, faction: 'barbaric', deckSymbols: [],
    } as any);

    const { newState } = executeAndReduce(state, SW_COMMANDS.PLAY_EVENT, {
      cardId: 'barbaric-chant-of-entanglement-0',
      targets: [{ row: 4, col: 2 }, { row: 4, col: 4 }],
    });

    const unit1 = newState.board[4][2].unit!;
    const abilities1 = getUnitAbilities(unit1, newState);

    // 规则：基础能力 = 单位卡上印刷的能力，不包括其他卡牌添加的能力
    // unit1 应获得 unit2 的 card.abilities（swift），但不含 tempAbilities（flying）
    expect(abilities1).toContain('swift');
    expect(abilities1).not.toContain('flying');

    const unit2 = newState.board[4][4].unit!;
    const abilities2 = getUnitAbilities(unit2, newState);

    // unit2 自身保留 swift（base）+ flying（temp），不从 unit1 获得新技能（unit1 无基础技能）
    expect(abilities2).toContain('swift');
    expect(abilities2).toContain('flying');
  });
});
