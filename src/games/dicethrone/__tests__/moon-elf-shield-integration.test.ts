/**
 * 月精灵百分比护盾集成测试
 *
 * 验证迷影步 II 的 50% 伤害减免护盾在完整 pipeline 中是否生效。
 * 场景：暗影盗贼（破隐一击）攻击月精灵（迷影步 II 防御）
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import type { DiceThroneCore, DiceThroneCommand, DiceThroneEvent } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_HEALTH, INITIAL_CP } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { GameTestRunner } from '../../../engine/testing';
import {
    createQueuedRandom,
    cmd,
    testSystems,
    assertState,
    createHeroMatchup,
    type CommandInput,
} from './test-utils';

// ============================================================================
// Setup
// ============================================================================

function createShadowThiefVsMoonElf(
    playerIds: PlayerId[],
    random: RandomFn,
    mutate?: (core: DiceThroneCore) => void
): MatchState<DiceThroneCore> {
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const commands: CommandInput[] = [
        cmd('SELECT_CHARACTER', '0', { characterId: 'shadow_thief' }),
        cmd('SELECT_CHARACTER', '1', { characterId: 'moon_elf' }),
        cmd('PLAYER_READY', '1'),
        cmd('HOST_START_GAME', '0'),
    ];

    for (const input of commands) {
        const command = { type: input.type, playerId: input.playerId, payload: input.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }

    // 清空手牌避免响应窗口干扰
    for (const pid of playerIds) {
        const player = state.core.players[pid];
        if (player) {
            player.deck = [...player.deck, ...player.hand];
            player.hand = [];
        }
    }

    mutate?.(state.core);
    return state;
}

// ============================================================================
// 测试
// ============================================================================

describe('月精灵百分比护盾集成测试', () => {
    it('迷影步 II 的 50% 护盾应减免暗影盗贼破隐一击的伤害（无 Token 响应路径）', () => {
        // 暗影盗贼进攻掷骰 5 次 → [1,2,3,4,5] = 大顺子 → 触发 kidney-shot
        // kidney-shot: gainCp(4) + damage-full-cp(bonusCp=4)
        // 初始 CP=1 → 1+4=5 → 伤害=5
        // 月精灵防御掷骰 5 次 → [4,4,1,1,1] = 2 foot + 3 bow
        //   → 迷影步 II: 3 bow → 3 伤害反击, 2 foot → 50% 护盾
        // 预期：暗影盗贼受到 3 点反击伤害，月精灵受到 ceil(5*0.5)=3 点减免后 5-3=2 点伤害
        //
        // 注意：双方都没有 Token（手牌已清空），不会触发 Token 响应窗口
        const queuedRandom = createQueuedRandom([
            // 暗影盗贼进攻掷骰（5 次）
            1, 2, 3, 4, 5,
            // 月精灵防御掷骰（5 次）
            4, 4, 1, 1, 1,
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, r) => createShadowThiefVsMoonElf(playerIds, r, (core) => {
                // 设置初始 CP=1（kidney-shot 会 +4 → 总 CP=5 → 伤害=5）
                core.players['0'].resources[RESOURCE_IDS.CP] = 1;
                // 升级迷影步到 II 级
                const elusiveIdx = core.players['1'].abilities.findIndex(a => a.id === 'elusive-step');
                if (elusiveIdx >= 0) {
                    core.players['1'].abilities[elusiveIdx].effects = [
                        {
                            description: '迷影步 II 防御结算',
                            action: { type: 'custom', target: 'self', customActionId: 'moon_elf-elusive-step-resolve-2' },
                            timing: 'withDamage',
                        },
                    ];
                }
                // 确保月精灵只有迷影步一个防御技能（自动选择）
                core.players['1'].abilities = core.players['1'].abilities.filter(
                    a => a.type !== 'defensive' || a.id === 'elusive-step'
                );
                // 清空双方 Token，避免 Token 响应窗口
                for (const pid of ['0', '1']) {
                    const player = core.players[pid];
                    if (player) {
                        for (const key of Object.keys(player.tokens)) {
                            player.tokens[key] = 0;
                        }
                    }
                }
            }),
            assertFn: assertState,
            silent: false,
        });

        const result = runner.run({
            name: '迷影步 II 50% 护盾 vs 破隐一击（无 Token 响应）',
            commands: [
                cmd('ADVANCE_PHASE', '0'),                              // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),                                  // 5 × d(6) → [1,2,3,4,5]
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),                              // 响应窗口
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),                              // offensiveRoll → defensiveRoll
                // 月精灵防御阶段（迷影步自动选择）
                cmd('ROLL_DICE', '1'),                                  // 5 × d(6) → [4,4,1,1,1]
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),                              // defensiveRoll exit → resolveAttack
                // 暗影盗贼有伏击 Token 定义（即使数量为 0）→ TOKEN_RESPONSE_REQUESTED → halt
                cmd('SKIP_TOKEN_RESPONSE', '0'),                        // 跳过伏击加伤 → 伤害结算 → main2
            ],
            expect: {
                turnPhase: 'main2',
            },
        });

        expect(result.assertionErrors).toEqual([]);

        // 核心断言：月精灵 HP 应减少 2 点（5 伤害 - ceil(5*0.5)=3 减免 = 2 实际伤害）
        const core = result.finalState.core;
        const moonElfHp = core.players['1'].resources[RESOURCE_IDS.HP];
        const expectedHp = INITIAL_HEALTH - 2;
        expect(moonElfHp).toBe(expectedHp);

        // 暗影盗贼应受到 3 点反击伤害（迷影步 II: 1×弓面数=3）
        const shadowThiefHp = core.players['0'].resources[RESOURCE_IDS.HP];
        expect(shadowThiefHp).toBe(INITIAL_HEALTH - 3);
    });

    it('迷影步 II 的 50% 护盾应减免暗影盗贼破隐一击的伤害（有 Token 响应路径）', () => {
        // 与上一个测试相同，但暗影盗贼有太极 Token → 触发 Token 响应窗口
        // 暗影盗贼进攻掷骰 5 次 → [1,2,3,4,5] = 大顺子 → kidney-shot
        // 初始 CP=1 → 1+4=5 → 伤害=5
        // 月精灵防御掷骰 5 次 → [4,4,1,1,1] = 2 foot + 3 bow
        //   → 迷影步 II: 3 bow → 3 伤害反击, 2 foot → 50% 护盾
        // Token 响应：暗影盗贼跳过太极加伤
        // 预期：月精灵受到 5-3=2 点伤害
        const queuedRandom = createQueuedRandom([
            // 暗影盗贼进攻掷骰（5 次）
            1, 2, 3, 4, 5,
            // 月精灵防御掷骰（5 次）
            4, 4, 1, 1, 1,
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: (playerIds, r) => createShadowThiefVsMoonElf(playerIds, r, (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 1;
                // 给暗影盗贼太极 Token（触发 beforeDamageDealt 响应窗口）
                core.players['0'].tokens.taiji = 2;
                // 升级迷影步到 II 级
                const elusiveIdx = core.players['1'].abilities.findIndex(a => a.id === 'elusive-step');
                if (elusiveIdx >= 0) {
                    core.players['1'].abilities[elusiveIdx].effects = [
                        {
                            description: '迷影步 II 防御结算',
                            action: { type: 'custom', target: 'self', customActionId: 'moon_elf-elusive-step-resolve-2' },
                            timing: 'withDamage',
                        },
                    ];
                }
                // 确保月精灵只有迷影步一个防御技能
                core.players['1'].abilities = core.players['1'].abilities.filter(
                    a => a.type !== 'defensive' || a.id === 'elusive-step'
                );
            }),
            assertFn: assertState,
            silent: false,
        });

        const result = runner.run({
            name: '迷影步 II 50% 护盾 vs 破隐一击（有 Token 响应）',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('RESPONSE_PASS', '0'),
                cmd('RESPONSE_PASS', '1'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                cmd('ADVANCE_PHASE', '0'),                              // offensiveRoll → defensiveRoll
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '1'),                              // defensiveRoll exit → resolveAttack
                // 暗影盗贼有太极 → TOKEN_RESPONSE_REQUESTED → halt
                cmd('SKIP_TOKEN_RESPONSE', '0'),                        // 跳过太极加伤 → 伤害结算
            ],
            expect: {
                turnPhase: 'main2',
            },
        });

        expect(result.assertionErrors).toEqual([]);

        // 核心断言：月精灵 HP 应减少 2 点（5 伤害 - ceil(5/2)=3 减免 = 2 实际伤害）
        // 注意：迷影步 II 使用 PREVENT_DAMAGE 事件，计算方式为 ceil(damage/2)
        const moonElfHp = result.finalState.core.players['1'].resources[RESOURCE_IDS.HP];
        expect(moonElfHp).toBe(INITIAL_HEALTH - 2);

        // 暗影盗贼应受到 3 点反击伤害
        const shadowThiefHp = result.finalState.core.players['0'].resources[RESOURCE_IDS.HP];
        expect(shadowThiefHp).toBe(INITIAL_HEALTH - 3);
    });
});
