/**
 * DiceThrone 卡牌系统测试
 *
 * 覆盖范围：
 * 1. 卖牌获得 CP
 * 2. 弃牌阶段手牌超限阻止推进
 * 3. 弃牌后可推进
 * 4. 卖牌在弃牌阶段也可用
 * 5. 升级卡 CP 不足时无法打出
 * 6. 升级卡跳级限制
 */

import { describe, it, expect } from 'vitest';
import {
    createRunner,
    createSetupWithHand,
    fixedRandom,
    cmd,
    expectedHandSize,
} from './test-utils';
import { INITIAL_CP, HAND_LIMIT } from '../domain/types';

describe('卡牌系统', () => {
    describe('卖牌', () => {
        it('卖牌获得 1 CP', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '卖牌获得1CP',
                commands: [
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
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
                    cmd('ADVANCE_PHASE', '0'),
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
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('ADVANCE_PHASE', '0'), // discard -> 应被阻止
                ],
                expect: {
                    errorAtStep: { step: 8, error: 'cannot_advance_phase' },
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
            // 先抽 3 张到 7 张，进入弃牌阶段后弃 1 张到 6 张
            const result = runner.run({
                name: '弃牌后可推进',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'), // 手牌 7
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('DISCARD_CARD', '0', { cardId: 'card-enlightenment' }), // 弃 1 张到 6
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人)
                ],
                expect: {
                    turnPhase: 'upkeep',
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
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> main2
                    cmd('ADVANCE_PHASE', '0'), // main2 -> discard
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }), // 卖 1 张到 6
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep
                ],
                expect: {
                    turnPhase: 'upkeep',
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
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    errorAtStep: { step: 2, error: 'notEnoughCp' },
                    turnPhase: 'main1',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('不可跳级升级（直接 I -> III）', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '跳级升级被拒绝',
                setup: createSetupWithHand(['card-meditation-3'], { cp: 10 }),
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    errorAtStep: { step: 2, error: 'upgradeCardSkipLevel' },
                    turnPhase: 'main1',
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
                    cmd('ADVANCE_PHASE', '0'), // upkeep -> main1
                    cmd('ADVANCE_PHASE', '0'), // main1 -> offensiveRoll
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    errorAtStep: { step: 3, error: 'wrongPhaseForUpgrade' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
