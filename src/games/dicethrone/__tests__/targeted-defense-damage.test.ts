/**
 * 测试锁定 buff 在防御投掷造成伤害时是否生效
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { testSystems, createQueuedRandom, cmd, assertState, createHeroMatchup } from './test-utils';
import { STATUS_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';

describe('锁定 buff 在防御投掷造成伤害时生效', () => {
  it('迷影步造成的伤害应该被锁定 buff 加成 +2', () => {
    // 测试场景：
    // 1. 玩家0有锁定 buff
    // 2. 玩家1使用防御技能（迷影步）造成伤害给玩家0
    // 3. 验证玩家0受到的伤害是否被锁定 buff 加成了 +2

    // 骰子值序列：
    // [1,1,1,1,1] 玩家0攻击骰（5弓）→ 触发 longbow-5-1 (7伤害)
    // [4,4,4,4,4] 玩家1防御骰（5足）→ 迷影步造成5点伤害
    const random = createQueuedRandom([1, 1, 1, 1, 1, 4, 4, 4, 4, 4]);

    const runner = new GameTestRunner({
      domain: DiceThroneDomain,
      systems: testSystems,
      playerIds: ['0', '1'],
      random,
      setup: createHeroMatchup('moon_elf', 'moon_elf', (core) => {
        // 给玩家0施加锁定 buff
        core.players['0'].statusEffects[STATUS_IDS.TARGETED] = 1;
      }),
      assertFn: assertState,
      silent: true,
    });

    const result = runner.run({
      name: '锁定buff在防御投掷造成伤害时生效',
      commands: [
        cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll
        cmd('ROLL_DICE', '0'),
        cmd('CONFIRM_ROLL', '0'),
        cmd('SELECT_ABILITY', '0', { abilityId: 'longbow-5-1' }),
        cmd('ADVANCE_PHASE', '0'), // offensiveRoll → defensiveRoll
        cmd('ROLL_DICE', '1'),
        cmd('CONFIRM_ROLL', '1'),
        cmd('ADVANCE_PHASE', '1'), // defensiveRoll → main2（触发迷影步）
      ],
      expect: {
        turnPhase: 'main2',
        players: {
          '0': {
            // 迷影步：5个足面 = 5点伤害
            // 锁定 buff：+2 伤害
            // 期望：50 - (5 + 2) = 43
            hp: INITIAL_HEALTH - 7,
            statusEffects: { [STATUS_IDS.TARGETED]: 1 }, // 锁定是持续效果，不会自动移除
          },
          '1': {
            // 玩家1受到 longbow-5-1 的7点伤害
            hp: INITIAL_HEALTH - 7,
          },
        },
      },
    });

    expect(result.assertionErrors).toEqual([]);
  });
});
