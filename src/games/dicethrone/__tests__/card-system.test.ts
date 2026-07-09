/**
 * DiceThrone 卡牌系统测试
 *
 * 覆盖范围：
 * 1. 卖牌获得 CP
 * 2. 弃牌阶段手牌超限阻止推进
 * 3. 弃牌后可推进
 * 4. 卖牌在弃牌阶段也可用
 * 5. 升级卡 CP 不足时无法打出
 * 6. 升级卡允许直接从 I 升到 III
 */

import { describe, it, expect } from 'vitest';
import {
    createRunner,
    createSetupWithHand,
    createHeroMatchup,
    fixedRandom,
    createQueuedRandom,
    cmd,
    advanceTo,
    expectedHandSize,
} from './test-utils';
import { reduce } from '../domain/reducer';
import type { AttackResolvedEvent, DamageDealtEvent } from '../domain/types';
import { INITIAL_CP, HAND_LIMIT, INITIAL_HEALTH } from '../domain/types';

describe('卡牌系统', () => {
    describe('卖牌', () => {
        it('卖牌获得 1 CP', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '卖牌获得1CP',
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP + 1,
                            handSize: expectedHandSize - 1,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('连续卖两张牌获得 2 CP', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '连续卖两张牌',
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                    cmd('SELL_CARD', '0', { cardId: 'card-inner-peace' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP + 2,
                            handSize: expectedHandSize - 2,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('弃牌阶段', () => {
        it('手牌超限时不可推进阶段', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '弃牌阶段手牌超限阻止推进',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'), // 手牌 7 (> HAND_LIMIT=6)
                    ...advanceTo('discard'),
                    cmd('ADVANCE_PHASE', '0'), // discard -> 应被阻止
                ],
                expect: {
                    expectError: { command: 'ADVANCE_PHASE', error: 'cannot_advance_phase' },
                    turnPhase: 'discard',
                    players: {
                        '0': { handSize: HAND_LIMIT + 1 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('弃牌后手牌 <= 限制可推进', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '弃牌后可推进',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'), // 手牌 7
                    ...advanceTo('discard'),
                    cmd('DISCARD_CARD', '0', { cardId: 'card-enlightenment' }), // 弃 1 张到 6
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人，自动推进到 main1)
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    turnNumber: 2,
                    players: {
                        '0': { handSize: HAND_LIMIT },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('弃牌阶段可以卖牌代替弃牌', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '弃牌阶段卖牌',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'), // 手牌 7
                    ...advanceTo('discard'),
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }), // 卖 1 张到 6
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep
                ],
                expect: {
                    turnPhase: 'main1',
                    activePlayerId: '1',
                    players: {
                        '0': {
                            handSize: HAND_LIMIT,
                            cp: INITIAL_CP + 1,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('升级卡限制', () => {
        it('CP 不足时无法打出升级卡', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'CP不足无法升级',
                setup: createSetupWithHand(['card-meditation-2'], { cp: 0 }),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_UPGRADE_CARD', error: 'notEnoughCp' },
                    turnPhase: 'main1',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('允许直接跳级升级（直接 I -> III）', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '跳级升级成功',
                setup: createSetupWithHand(['card-meditation-3'], { cp: 10 }),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 7,
                            abilityLevels: { meditation: 3 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('投掷阶段不可使用升级卡', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '投掷阶段升级被拒绝',
                setup: createSetupWithHand(['card-meditation-2'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_UPGRADE_CARD', error: 'wrongPhaseForUpgrade' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('防御瞬发牌限制', () => {
        it('下次不算不能在主阶段预先打出', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '下次不算需要待结算伤害',
                setup: createSetupWithHand(['card-next-time'], { cp: 1 }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-next-time' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'requirePendingDamage' },
                    turnPhase: 'main1',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('进入 defensiveRoll 后防御方可以先打出下次不算', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '下次不算在 defensiveRoll 可提前打出',
                setup: createSetupWithHand(['card-next-time'], {
                    playerId: '1',
                    cp: 1,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['1'].hand = [core.players['1'].hand[0]];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('PLAY_CARD', '1', { cardId: 'card-next-time' }),
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    players: {
                        '1': {
                            handSize: 0,
                            discardSize: 1,
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].damageShields).toEqual([
                expect.objectContaining({
                    sourceId: 'card-next-time',
                    value: 6,
                }),
            ]);
        });

        it('下次不算在待结算伤害大于 6 时最多只吸收 6 点，剩余伤害正常结算', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '下次不算只吸收 6 点，8 点攻击剩余 2 点正常结算',
                setup: createSetupWithHand(['card-next-time'], {
                    playerId: '1',
                    cp: 1,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['1'].hand = [core.players['1'].hand[0]];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('PLAY_CARD', '1', { cardId: 'card-next-time' }),
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    players: {
                        '1': {
                            handSize: 0,
                            discardSize: 1,
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].damageShields).toEqual([
                expect.objectContaining({
                    sourceId: 'card-next-time',
                    value: 6,
                }),
            ]);

            const afterDamage = reduce(result.finalState.core, {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: '1',
                    amount: 8,
                    actualDamage: 8,
                    sourceAbilityId: 'fist-technique-5',
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 1,
            } as DamageDealtEvent);

            expect(afterDamage.players['1'].resources.hp).toBe(INITIAL_HEALTH - 2);
            expect(afterDamage.players['1'].damageShields).toEqual([]);
            expect(afterDamage.pendingAttack?.resolvedDamage).toBe(2);

            const afterResolved = reduce(afterDamage, {
                type: 'ATTACK_RESOLVED',
                payload: {
                    attackerId: '0',
                    defenderId: '1',
                    sourceAbilityId: 'fist-technique-5',
                    totalDamage: 8,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: 2,
            } as AttackResolvedEvent);

            expect(afterResolved.lastResolvedAttackDamage).toBe(2);
            expect(afterResolved.pendingAttack).toBeNull();
        });

        it('不可防御伤害仍应给防御方打出下次不算的受伤前时机', () => {
            const runner = createRunner(createQueuedRandom([6, 6, 6, 6, 1]));
            const result = runner.run({
                name: '影步不可防御伤害允许下次不算响应',
                setup: createHeroMatchup('ninja', 'monk', (core) => {
                    core.players['0'].hand = [];
                    core.players['1'].hand = core.players['1'].hand.filter(card => card.id === 'card-next-time');
                    if (!core.players['1'].hand.some(card => card.id === 'card-next-time')) {
                        const nextTime = core.players['1'].deck.find(card => card.id === 'card-next-time');
                        if (nextTime) {
                            core.players['1'].deck = core.players['1'].deck.filter(card => card !== nextTime);
                            core.players['1'].hand = [nextTime];
                        }
                    }
                    core.players['1'].resources.cp = 1;
                    core.players['1'].tokens = {};
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'shadow-step' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('PLAY_CARD', '1', { cardId: 'card-next-time' }),
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
                expect: {
                    players: {
                        '1': {
                            hp: INITIAL_HEALTH,
                            handSize: 0,
                            discardSize: 1,
                        },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['1'].damageShields).toEqual([]);
        });
    });
});
