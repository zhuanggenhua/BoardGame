/**
 * D2 维度：验证-执行前置条件对齐测试（基于当前引擎 API）
 *
 * 目标：
 * 1. 验证层拒绝时，执行层不应推进状态
 * 2. 验证层允许时，执行层应产生可观测状态变化
 * 3. 能力注册表中的验证函数结构完整
 */

import { describe, test, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import CardiaDomain from '../domain';
import { Cardia } from '../game';
import { CARDIA_COMMANDS } from '../domain/commands';
import { abilityRegistry } from '../domain/abilityRegistry';
import { CARD_IDS } from '../domain/ids';
import type { CardiaCore } from '../domain/core-types';

function createRunner() {
  return new GameTestRunner({
    domain: CardiaDomain,
    systems: Cardia.systems,
    playerIds: ['p0', 'p1'],
    random: {
      random: () => 0.5,
      d: (sides: number) => Math.floor(0.5 * sides) + 1,
      range: (min: number, max: number) => Math.floor(0.5 * (max - min + 1)) + min,
      shuffle: <T>(arr: T[]) => [...arr],
    },
  });
}

describe('Feature: cardia-full-audit, Property D2: 验证-执行前置条件对齐', () => {
  test('D2.1 验证层拒绝：同一回合二次打牌必须失败且状态不前进', () => {
    const runner = createRunner();
    const state = runner.getState();
    const cardUid = state.core.players.p0.hand[0]?.uid;
    expect(cardUid).toBeDefined();

    const first = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
      playerId: 'p0',
      cardUid,
      slotIndex: 0,
    });
    expect(first.success).toBe(true);

    const second = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
      playerId: 'p0',
      cardUid: state.core.players.p0.hand[1]?.uid ?? cardUid,
      slotIndex: 0,
    });
    expect(second.success).toBe(false);
    expect(second.error).toBeTruthy();
    expect(runner.getState().core.players.p0.hasPlayed).toBe(true);
  });

  test('D2.1 验证层拒绝：手牌为空时打牌失败且手牌数量保持 0', () => {
    const runner = createRunner();
    const before = runner.getState();
    const nextCore: CardiaCore = {
      ...before.core,
      players: {
        ...before.core.players,
        p0: {
          ...before.core.players.p0,
          hand: [],
        },
      },
    };
    runner.setState({ ...before, core: nextCore });

    const result = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
      playerId: 'p0',
      cardUid: 'missing-card',
      slotIndex: 0,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(runner.getState().core.players.p0.hand.length).toBe(0);
  });

  test('D2.2 结构一致性：能力注册表中 customValidator 必须是函数', () => {
    const defs = abilityRegistry.getAll();
    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) {
      const customValidator = def.validation?.customValidator;
      if (customValidator !== undefined) {
        expect(typeof customValidator).toBe('function');
      }
    }
  });

  test('D2.4 验证层允许时执行层生效：合法打牌后 hasPlayed=true 且 currentCard 已写入', () => {
    const runner = createRunner();
    const hand = runner.getState().core.players.p0.hand;
    const target = hand.find((c) => c.defId === CARD_IDS.CARD_01) ?? hand[0];
    expect(target).toBeDefined();

    const result = runner.dispatch(CARDIA_COMMANDS.PLAY_CARD, {
      playerId: 'p0',
      cardUid: target.uid,
      slotIndex: 0,
    });
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(runner.getState().core.players.p0.hasPlayed).toBe(true);
    expect(runner.getState().core.players.p0.currentCard?.uid).toBe(target.uid);
  });
});

