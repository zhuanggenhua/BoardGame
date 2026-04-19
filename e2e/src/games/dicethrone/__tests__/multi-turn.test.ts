/**
 * DiceThrone 多回合流程测试
 *
 * 覆盖范围：
 * 1. 收入阶段 CP/抽牌
 * 2. 先手首回合跳过收入
 * 3. 回合切换与玩家交替
 * 4. 击倒跳过攻击阶段
 * 5. 脑震荡跳过收入阶段
 */

import { describe, it, expect } from 'vitest';
import {
    createRunner,
    createInitializedState,
    createNoResponseSetupWithEmptyHand,
    fixedRandom,
    cmd,
    expectedIncomeCp,
} from './test-utils';
import { INITIAL_CP } from '../domain/types';
import { STATUS_IDS } from '../domain/ids';

describe('多回合流程', () => {
    describe('收入阶段', () => {
        it('先手首回合跳过收入阶段', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '先手跳过收入',
                commands: [
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: INITIAL_CP }, // CP 不变
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('非先手收入阶段获得 1 CP 与 1 张牌', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '非先手收入',
                setup: createNoResponseSetupWithEmptyHand(),
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人)
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    turnNumber: 2,
                    players: {
                        '1': {
                            cp: expectedIncomeCp,
                            handSize: 1, // 空手牌 + 收入抽 1 张
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('回合切换', () => {
        it('完整回合后切换到对手', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '回合切换',
                setup: createNoResponseSetupWithEmptyHand(),
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人)
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    turnNumber: 2,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('两个完整回合后回到先手', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '两回合后回到先手',
                setup: createNoResponseSetupWithEmptyHand(),
                commands: [
                    // 玩家 0 回合
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人)
                    // 玩家 1 回合
                    cmd('ADVANCE_PHASE', '1'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '1'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '1'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '1'), // discard -> upkeep (换人)
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '0',
                    turnNumber: 3,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('击倒效果', () => {
        it('击倒未移除时跳过攻击阶段并自动移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒跳过攻击',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    return state;
                },
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // main1 -> 跳过 offensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('花费 2 CP 移除击倒后可正常攻击', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '花费CP移除击倒',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    return state;
                },
                commands: [
                    cmd('PAY_TO_REMOVE_KNOCKDOWN', '0'),
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 2,
                            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('CP 不足时无法花费移除击倒', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'CP不足无法移除击倒',
                setup: (playerIds, random) => {
                    const state = createInitializedState(playerIds, random);
                    state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    state.core.players['0'].resources.cp = 1;
                    return state;
                },
                commands: [
                    cmd('PAY_TO_REMOVE_KNOCKDOWN', '0'),
                ],
                expect: {
                    errorAtStep: { step: 1, error: 'not_enough_cp' },
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            statusEffects: { [STATUS_IDS.KNOCKDOWN]: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
