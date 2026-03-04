/**
 * 潜行 vs 高温爆破 — 额外投掷是否触发
 * 
 * 场景：火法师（player 0）用 pyro-blast 攻击有潜行的暗影刺客（player 1）
 * 预期：潜行免除所有伤害，但 bonus roll 仍然触发（非伤害效果生效）
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState, PlayerId, RandomFn, GameEvent } from '../../../engine/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest } from '../game';
import type { EngineSystem } from '../../../engine/systems/types';
import {
    createQueuedRandom,
    assertState,
    cmd,
} from './test-utils';

const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

/**
 * 创建火法师 vs 暗影刺客的 setup
 * player 0 = pyromancer, player 1 = shadow_thief
 */
function createPyroVsShadowSetup(opts?: { mutate?: (core: DiceThroneCore) => void }) {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const core = DiceThroneDomain.setup(playerIds, random);
        const sys = createInitialSystemState(playerIds, testSystems, undefined);
        let state: MatchState<DiceThroneCore> = { sys, core };
        const cfg = { domain: DiceThroneDomain, systems: testSystems };

        const setupCmds = [
            { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'pyromancer' } },
            { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'shadow_thief' } },
            { type: 'PLAYER_READY', playerId: '1', payload: {} },
            { type: 'HOST_START_GAME', playerId: '0', payload: {} },
        ];

        for (const c of setupCmds) {
            const r = executePipeline(cfg, state,
                { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() },
                random, playerIds);
            if (r.success) state = r.state as MatchState<DiceThroneCore>;
        }

        // 清空手牌避免响应窗口干扰
        for (const pid of playerIds) {
            state.core.players[pid].hand = [];
        }

        opts?.mutate?.(state.core);
        return state;
    };
}

describe('潜行 vs 高温爆破 — 额外投掷触发', () => {
    it('防御方有潜行时，pyro-blast (I级) 的 bonus roll 仍然触发', () => {
        // 炎术士骰面：1,2,3→fire  4→magma  5→fiery_soul  6→meteor
        // pyro-blast 触发条件：3 fire + 1 meteor
        // 进攻骰: [1,1,1,6,5] → 3 fire + 1 meteor + 1 fiery_soul → pyro-blast
        // bonus roll: d(6)=1 → fire 面 → bonusDamage: 3（应被潜行免除）
        const random = createQueuedRandom([
            1, 1, 1, 6, 5,  // 进攻掷骰 5 颗
            1,               // pyro-blast bonus roll: d(6)=1 → fire 面 → +3 伤害
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createPyroVsShadowSetup({
                mutate: (core) => {
                    // 给防御者（玩家1）1层潜行
                    core.players['1'].tokens[TOKEN_IDS.SNEAK] = 1;
                    core.sneakGainedTurn = { '1': 1 }; // 第1回合获得（当前回合）
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '潜行 vs 高温爆破 I级 bonus roll',
            commands: [
                cmd('ADVANCE_PHASE', '0'),  // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),      // 5 × d(6) → [1,1,1,6,5]
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'pyro-blast' }),
                cmd('ADVANCE_PHASE', '0'),  // offensiveRoll → 潜行判定 → main2
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        tokens: {
                            [TOKEN_IDS.SNEAK]: 1, // 潜行不立即消耗，回合末清除
                        },
                        resources: {
                            [RESOURCE_IDS.HP]: 50, // 伤害被免除
                        },
                    },
                },
            },
        });

        const allEventTypes = result.steps.flatMap(s => s.events);
        const bonusDieCount = allEventTypes.filter(t => t === 'BONUS_DIE_ROLLED').length;
        
        console.log('=== I级 每步事件 ===');
        result.steps.forEach(s => {
            console.log(`  Step ${s.step} [${s.commandType}] success=${s.success} events=[${s.events.join(', ')}]`);
        });

        expect(bonusDieCount, '高温爆破 I级的额外投掷应该触发').toBeGreaterThan(0);
        expect(result.assertionErrors).toHaveLength(0);
    });

    it('防御方有潜行时，pyro-blast II级 的 bonus roll 仍然触发', () => {
        // pyro-blast II 使用 custom action: pyro-blast-2-roll（投2颗骰子）
        // 进攻骰: [1,1,1,6,5] → 3 fire + 1 meteor + 1 fiery_soul → pyro-blast
        // bonus roll: 2颗 d(6)=[1,1] → 2个 fire 面 → 各+3伤害（应被潜行免除）
        const random = createQueuedRandom([
            1, 1, 1, 6, 5,  // 进攻掷骰 5 颗
            1, 1,            // pyro-blast-2-roll: 2 × d(6)=[1,1] → 2个 fire 面
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createPyroVsShadowSetup({
                mutate: (core) => {
                    // 给防御者（玩家1）1层潜行
                    core.players['1'].tokens[TOKEN_IDS.SNEAK] = 1;
                    core.sneakGainedTurn = { '1': 1 }; // 第1回合获得（当前回合）
                    // 升级 pyro-blast → PYRO_BLAST_2
                    const p0 = core.players['0'];
                    const idx = p0.abilities.findIndex(a => a.id === 'pyro-blast');
                    if (idx >= 0) {
                        // 动态 import 会有问题，直接内联升级
                        p0.abilities[idx] = {
                            ...p0.abilities[idx],
                            effects: [
                                p0.abilities[idx].effects[0], // damage(6)
                                {
                                    description: 'bonus roll',
                                    action: {
                                        type: 'custom' as const,
                                        target: 'self' as const,
                                        customActionId: 'pyro-blast-2-roll',
                                    },
                                    timing: 'withDamage' as const,
                                },
                            ],
                        };
                    }
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '潜行 vs 高温爆破 II级 bonus roll',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'pyro-blast' }),
                cmd('ADVANCE_PHASE', '0'),
                // halt 后需要处理 displayOnly 的奖励骰展示
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        tokens: { [TOKEN_IDS.SNEAK]: 1 }, // 潜行不立即消耗，回合末清除
                        resources: { [RESOURCE_IDS.HP]: 50 }, // 伤害被免除
                    },
                },
            },
        });

        const allEventTypes = result.steps.flatMap(s => s.events);
        const bonusDieCount = allEventTypes.filter(t => t === 'BONUS_DIE_ROLLED').length;
        
        console.log('=== II级 每步事件 ===');
        result.steps.forEach(s => {
            console.log(`  Step ${s.step} [${s.commandType}] success=${s.success} events=[${s.events.join(', ')}]`);
        });

        expect(bonusDieCount, '高温爆破 II级的额外投掷应该触发').toBeGreaterThan(0);
        expect(result.assertionErrors).toHaveLength(0);
    });
});
