/**
 * 僧侣 vs 暗影刺客：太极连环掌 + 暗影防御 999 护盾交互测试
 *
 * 复现 bug：当僧侣有太极 Token 时，太极连环掌的 rollDie bonusDamage
 * 在 TOKEN_RESPONSE_REQUESTED 中断后未被清零，导致函数末尾 fallback
 * 生成额外的 DAMAGE_DEALT 事件，消耗暗影刺客的 999 护盾，
 * 使后续主伤害失去护盾保护。
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing';
import {
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    type CommandInput,
} from './test-utils';

// ============================================================================
// 跨英雄 setup
// ============================================================================

function createMonkVsShadowThief(
    playerIds: PlayerId[],
    random: RandomFn,
    mutate?: (core: DiceThroneCore) => void
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const commands: CommandInput[] = [
        cmd('SELECT_CHARACTER', '0', { characterId: 'monk' }),
        cmd('SELECT_CHARACTER', '1', { characterId: 'shadow_thief' }),
        cmd('PLAYER_READY', '1'),
        cmd('HOST_START_GAME', '0'),
    ];

    for (const input of commands) {
        const command = {
            type: input.type,
            playerId: input.playerId,
            payload: input.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    if (mutate) {
        mutate(state.core);
    }

    return state;
}

// ============================================================================
// 测试
// ============================================================================

describe('僧侣 vs 暗影刺客：太极连环掌 + 暗影防御护盾', () => {
    it('僧侣有太极 Token 时，暗影刺客 2 暗影面的 999 护盾应正确免除伤害', () => {
        // 随机数队列：
        // 僧侣进攻掷骰 5 次 d(6) → [1,1,1,3,4] = 3 fist + 1 palm + 1 taiji → 触发 taiji-combo
        // 太极连环掌 rollDie 1 次 d(6) → [1] = fist → bonusDamage +2 → 总伤害 6+2=8
        // 暗影刺客防御掷骰 4 次 d(6) → [6,6,1,3] = 2 shadow + 1 dagger + 1 bag
        //   → 2 shadow 触发 999 护盾 + SNEAK + SNEAK_ATTACK
        const queuedRandom = createQueuedRandom([
            // 僧侣进攻掷骰（5 次）
            1, 1, 1, 3, 4,
            // 太极连环掌 rollDie（1 次）
            1,  // fist → bonusDamage +2
            // 暗影刺客防御掷骰（4 次）
            6, 6, 1, 3,
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, r) => createMonkVsShadowThief(playerIds, r, (core) => {
                // 预设僧侣有 2 个太极 Token（触发 beforeDamageDealt 响应窗口）
                core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2;
                // 移除暗影刺客的恐惧反击，只保留暗影守护（自动选择防御技能）
                core.players['1'].abilities = core.players['1'].abilities.filter(
                    a => a.id !== 'fearless-riposte'
                );
            }),
            assertFn: assertState,
            silent: false,
        });

        const result = runner.run({
            name: '太极连环掌 + 暗影防御 999 护盾',
            commands: [
                cmd('ADVANCE_PHASE', '0'),                              // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),                                  // 5 × d(6) → [1,1,1,3,4]
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),                              // 响应窗口
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                cmd('ADVANCE_PHASE', '0'),                              // offensiveRoll → defensiveRoll
                // 防御阶段
                cmd('ROLL_DICE', '1'),                                  // 4 × d(6) → [6,6,1,3]
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),                              // defensiveRoll exit → resolveAttack
                // 僧侣有太极 → TOKEN_RESPONSE_REQUESTED（beforeDamageDealt）→ halt
                cmd('SKIP_TOKEN_RESPONSE', '0'),                        // 跳过太极加伤 → 伤害结算 → main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        tokens: {
                            [TOKEN_IDS.TAIJI]: 2,  // 太极未消耗（跳过了响应）
                        },
                    },
                    '1': {
                        tokens: {
                            [TOKEN_IDS.SNEAK]: 1,        // 2 暗影面获得潜行
                            [TOKEN_IDS.SNEAK_ATTACK]: 1,  // 2 暗影面获得伏击
                        },
                    },
                },
            },
        });

        expect(result.assertionErrors).toEqual([]);

        // 核心断言：暗影刺客 HP 不应减少（999 护盾应免除所有伤害）
        const defenderHp = result.finalState.core.players['1'].resources[RESOURCE_IDS.HP];
        expect(defenderHp).toBe(INITIAL_HEALTH);
    });

    it('太极连环掌 II（2 骰）+ 暗影防御 999 护盾也应正确免除伤害', () => {
        // 太极连环掌 II：rollDie diceCount=2，基础伤害 5
        // 随机数队列：
        // 僧侣进攻掷骰 5 次 → [1,1,1,3,4] = 3 fist + 1 palm + 1 taiji → taiji-combo
        // 太极连环掌 II rollDie 2 次 → [1,3] = fist(+2) + palm(+3) → bonusDamage=5 → 总伤害 5+5=10
        // 暗影刺客防御掷骰 4 次 → [6,6,1,3] = 2 shadow
        const queuedRandom = createQueuedRandom([
            1, 1, 1, 3, 4,  // 僧侣进攻掷骰
            1, 3,            // 太极连环掌 II rollDie（fist+palm）
            6, 6, 1, 3,     // 暗影刺客防御掷骰
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, r) => createMonkVsShadowThief(playerIds, r, (core) => {
                // 预设僧侣有太极 Token
                core.players['0'].tokens[TOKEN_IDS.TAIJI] = 3;
                // 升级太极连环掌到 II 级（diceCount=2，基础伤害 5）
                const taijiComboIdx = core.players['0'].abilities.findIndex(a => a.id === 'taiji-combo');
                if (taijiComboIdx >= 0) {
                    // 通过 abilityLevels 标记为 2 级，但实际需要替换 AbilityDef
                    // 直接修改 effects 来模拟 II 级
                    const ability = core.players['0'].abilities[taijiComboIdx];
                    ability.effects = [
                        {
                            description: 'rollDie',
                            action: {
                                type: 'rollDie', target: 'self', diceCount: 2,
                                conditionalEffects: [
                                    { face: 'fist', bonusDamage: 2 },
                                    { face: 'palm', bonusDamage: 3 },
                                    { face: 'taiji', grantToken: { tokenId: TOKEN_IDS.TAIJI, value: 2 } },
                                    { face: 'lotus', triggerChoice: { titleKey: 'choices.evasiveOrPurifyToken', options: [{ tokenId: 'evasive', value: 1 }, { tokenId: 'purify', value: 1 }] } },
                                ],
                            },
                            timing: 'withDamage',
                        },
                        { description: 'damage5', action: { type: 'damage', target: 'opponent', value: 5 } },
                    ];
                }
                // 移除恐惧反击
                core.players['1'].abilities = core.players['1'].abilities.filter(
                    a => a.id !== 'fearless-riposte'
                );
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '太极连环掌 II + 暗影防御 999 护盾',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'taiji-combo' }),
                cmd('ADVANCE_PHASE', '0'),                              // offensiveRoll → defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),                              // defensiveRoll exit → resolveAttack
                // rollDie(diceCount=2) 产生 displayOnly BONUS_DICE_REROLL_REQUESTED → halt
                cmd('SKIP_BONUS_DICE_REROLL', '0'),                     // 确认骰子结果
                // damage(5) 产生 TOKEN_RESPONSE_REQUESTED（僧侣有太极）→ halt
                cmd('SKIP_TOKEN_RESPONSE', '0'),                        // 跳过太极加伤 → main2
            ],
            expect: {
                turnPhase: 'main2',
            },
        });

        expect(result.assertionErrors).toEqual([]);

        // 核心断言：暗影刺客 HP 不应减少
        const defenderHp = result.finalState.core.players['1'].resources[RESOURCE_IDS.HP];
        expect(defenderHp).toBe(INITIAL_HEALTH);
    });
});
