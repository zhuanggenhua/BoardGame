/**
 * 抬一手（card-give-hand）边界测试
 *
 * 卡牌规则：选择对手的1颗骰子，强制他重掷该骰子
 * - 费用：1 CP
 * - timing: roll（只能在投掷阶段使用）
 * - playCondition:
 *   - requireIsNotRoller: 不能是当前投掷方（只能在对手投掷时使用）
 *   - requireRollConfirmed: 对手必须已确认骰面
 *   - requireHasRolled: 必须已投掷过
 *   - requireOpponentDiceExists: 必须有骰子可操作
 */

import { describe, it, expect } from 'vitest';
import { checkPlayCard } from '../domain/rules';
import { COMMON_CARDS } from '../domain/commonCards';
import type { DiceThroneCore } from '../domain/types';
import {
    createQueuedRandom,
    cmd,
    createRunner,
    createSetupWithHand,
    getCardById,
    advanceTo,
} from './test-utils';

const giveHandCard = COMMON_CARDS.find(c => c.id === 'card-give-hand')!;

/** 构造最小化的 core 状态用于 checkPlayCard 单元测试 */
const makeCore = (overrides: Partial<DiceThroneCore> = {}): DiceThroneCore => ({
    activePlayerId: '0',
    turnNumber: 1,
    turnPhase: 'offensiveRoll',
    dice: [1, 2, 3, 4, 5],
    rollCount: 1,
    rollConfirmed: true,
    rollsRemaining: 0,
    pendingAttack: null,
    pendingInteraction: null,
    lastResolvedAttackDamage: null,
    players: {
        '0': {
            heroId: 'monk',
            health: 50,
            resources: { cp: 10 },
            hand: [],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: {},
            abilityLevels: {},
            abilities: [],
        } as any,
        '1': {
            heroId: 'monk',
            health: 50,
            resources: { cp: 10 },
            hand: [giveHandCard],
            deck: [],
            discard: [],
            statusEffects: {},
            tokens: {},
            abilityLevels: {},
            abilities: [],
        } as any,
    },
    ...overrides,
} as DiceThroneCore);

describe('抬一手（card-give-hand）边界测试', () => {

    describe('playCondition 数据完整性', () => {
        it('commonCards 中的定义必须包含 playCondition', () => {
            expect(giveHandCard.playCondition).toBeDefined();
            expect(giveHandCard.playCondition!.requireIsNotRoller).toBe(true);
            expect(giveHandCard.playCondition!.requireRollConfirmed).toBe(true);
            expect(giveHandCard.playCondition!.requireHasRolled).toBe(true);
            expect(giveHandCard.playCondition!.requireOpponentDiceExists).toBe(true);
        });

        it('通过 getCardById 获取的卡牌也包含 playCondition', () => {
            const card = getCardById('card-give-hand');
            expect(card.playCondition).toBeDefined();
            expect(card.playCondition!.requireIsNotRoller).toBe(true);
        });
    });

    describe('checkPlayCard 单元测试 — 阶段限制', () => {
        it('进攻投掷阶段 — 非投掷方（玩家1）可以打出', () => {
            const core = makeCore({ activePlayerId: '0', rollConfirmed: true, rollCount: 1 });
            const result = checkPlayCard(core, '1', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(true);
        });

        it('进攻投掷阶段 — 投掷方（玩家0）不能打出（requireIsNotRoller）', () => {
            const core = makeCore({ activePlayerId: '0', rollConfirmed: true, rollCount: 1 });
            const result = checkPlayCard(core, '0', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('requireIsNotRoller');
        });

        it('防御投掷阶段 — 进攻方（玩家0）可以打出', () => {
            const core = makeCore({
                activePlayerId: '0',
                rollConfirmed: true,
                rollCount: 1,
                pendingAttack: { attackerId: '0', defenderId: '1' } as any,
            });
            // 防御阶段 rollerId = defenderId = '1'，所以玩家0不是投掷方，可以打出
            const result = checkPlayCard(core, '0', giveHandCard, 'defensiveRoll');
            expect(result.ok).toBe(true);
        });

        it('防御投掷阶段 — 防御方（投掷方）不能打出', () => {
            const core = makeCore({
                activePlayerId: '0',
                rollConfirmed: true,
                rollCount: 1,
                pendingAttack: { attackerId: '0', defenderId: '1' } as any,
            });
            // 防御阶段 rollerId = defenderId = '1'，玩家1是投掷方
            const result = checkPlayCard(core, '1', giveHandCard, 'defensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('requireIsNotRoller');
        });

        it('main1 阶段不能打出（timing=roll 限制）', () => {
            const core = makeCore({ rollConfirmed: true, rollCount: 1 });
            const result = checkPlayCard(core, '1', giveHandCard, 'main1');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('wrongPhaseForRoll');
        });

        it('main2 阶段不能打出', () => {
            const core = makeCore({ rollConfirmed: true, rollCount: 1 });
            const result = checkPlayCard(core, '1', giveHandCard, 'main2');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('wrongPhaseForRoll');
        });

        it('discard 阶段不能打出', () => {
            const core = makeCore({ rollConfirmed: true, rollCount: 1 });
            const result = checkPlayCard(core, '1', giveHandCard, 'discard');
            expect(result.ok).toBe(false);
        });
    });

    describe('checkPlayCard 单元测试 — 前置条件', () => {
        it('未投掷时不能打出（requireHasRolled）', () => {
            const core = makeCore({ rollCount: 0, rollConfirmed: false, dice: [] });
            const result = checkPlayCard(core, '1', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('requireHasRolled');
        });

        it('骰面未确认时不能打出（requireRollConfirmed）', () => {
            const core = makeCore({ rollCount: 1, rollConfirmed: false });
            const result = checkPlayCard(core, '1', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('requireRollConfirmed');
        });

        it('没有骰子时不能打出（requireOpponentDiceExists）', () => {
            const core = makeCore({ rollCount: 1, rollConfirmed: true, dice: [] });
            const result = checkPlayCard(core, '1', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('requireOpponentDiceExists');
        });

        it('CP 不足时不能打出', () => {
            const core = makeCore({ rollCount: 1, rollConfirmed: true });
            core.players['1'].resources.cp = 0;
            const result = checkPlayCard(core, '1', giveHandCard, 'offensiveRoll');
            expect(result.ok).toBe(false);
            expect((result as any).reason).toBe('notEnoughCp');
        });
    });

    describe('GameTestRunner 集成测试 — 边界场景', () => {
        it('自己的进攻投掷阶段不能使用抬一手（回归验证）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '抬一手 — 自己投掷阶段被拒绝',
                setup: createSetupWithHand(['card-give-hand'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    // 玩家0是投掷方，不能使用抬一手
                    cmd('PLAY_CARD', '0', { cardId: 'card-give-hand' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'requireIsNotRoller' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('对手未确认骰面时不能使用抬一手', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '抬一手 — 未确认骰面被拒绝',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-give-hand')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    // 不 CONFIRM_ROLL，直接尝试打出
                    cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'requireRollConfirmed' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('对手未投掷时不能使用抬一手', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '抬一手 — 未投掷被拒绝',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-give-hand')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    // 不投掷，直接尝试打出
                    cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'requireHasRolled' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });
});
