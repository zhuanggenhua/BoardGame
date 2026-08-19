/**
 * 测试"弹一手"卡牌修改对手锁定骰子的功能
 * 
 * Bug: 对手锁定的骰子，我方用"弹一手"不能改变对手的骰子
 * 根因: UI 层判断 `!d.isKept` 时没有考虑 `targetOpponentDice` 字段
 * 修复: 当 `targetOpponentDice=true` 时，忽略锁定状态
 */
import { describe, it, expect } from 'vitest';
import { createRunner, createQueuedRandom, cmd, createSetupWithHand, advanceTo } from './test-utils';
import { RESOURCE_IDS } from '../domain/resources';

describe('弹一手修改对手锁定骰子', () => {
    it('对手锁定骰子后，我方打出"弹一手"应该能修改对手的锁定骰子', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]); // 玩家0投掷结果
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手修改对手锁定骰子',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1', // 玩家1持有弹一手
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                // 玩家0投掷骰子
                cmd('ROLL_DICE', '0'),
                // 玩家0锁定前3颗骰子
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 1 }),
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 2 }),
                // 玩家0确认骰面
                cmd('CONFIRM_ROLL', '0'),
                // 玩家1（对手）在响应窗口中打出"弹一手"
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
                // 玩家1选择修改骰子0（已锁定）的值，增加1
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 2 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // 验证：骰子0的值从1变为2（即使它是锁定的）
        const finalDice = result.finalState.core.dice;
        const die0 = finalDice.find(d => d.id === 0);
        expect(die0?.value).toBe(2);
        expect(die0?.isKept).toBe(true); // 锁定状态不变
    });

    it('对手未锁定骰子时,我方打出"弹一手"也能正常修改', () => {
        const random = createQueuedRandom([1, 1, 1, 1, 1]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手修改对手未锁定骰子',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 2 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // 验证：骰子0的值从1变为2
        const finalDice = result.finalState.core.dice;
        const die0 = finalDice.find(d => d.id === 0);
        expect(die0?.value).toBe(2);
        expect(die0?.isKept).toBe(false);
    });

    it('进攻投掷确认骰面后，即使未选定攻击，对手也能在确认骰窗口打出"弹一手"改骰', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手在确认骰后即可响应',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-flick' }),
            ],
        });

        expect(result.finalState.sys.interaction?.current).toBeDefined();
        expect(result.finalState.core.players['1'].hand.map(card => card.id)).not.toContain('card-flick');
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(9);
        expect(result.finalState.core.dice.map(die => die.value)).toEqual([3, 3, 3, 3, 3]);
    });

    it('自己打出"弹一手"修改自己的骰子时，也能修改已锁定的骰子并保留锁定状态', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手修改自己的锁定骰子',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '0', // 玩家0持有弹一手
                cp: 10,
                mutate: (core) => {
                    core.players['1'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                // 玩家0锁定骰子0
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),
                // 玩家0打出弹一手（修改自己的骰子）
                cmd('PLAY_CARD', '0', { cardId: 'card-flick' }),
                cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 4 }),
                cmd('SYS_INTERACTION_CONFIRM', '0'),
            ],
        });

        const die0 = result.finalState.core.dice.find(d => d.id === 0);
        expect(die0?.value).toBe(4);
        expect(die0?.isKept).toBe(true);
    });

    it('自己打出"俺也一样"时，已锁定骰子也可以作为复制目标', () => {
        const random = createQueuedRandom([4, 2, 3, 5, 6]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '俺也一样复制到已锁定骰子',
            setup: createSetupWithHand(['card-me-too'], {
                playerId: '0',
                cp: 10,
                mutate: (core) => {
                    core.players['1'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),
                cmd('PLAY_CARD', '0', { cardId: 'card-me-too' }),
                cmd('MODIFY_DIE', '0', { dieId: 4, newValue: 6 }),
                cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
            ],
        });

        const die0 = result.finalState.core.dice.find(d => d.id === 0);
        expect(die0?.value).toBe(6);
        expect(die0?.isKept).toBe(true);
    });

    it('对手打出"俺也一样"时，不能复制并修改当前投掷方的骰子', () => {
        const random = createQueuedRandom([4, 2, 3, 5, 6]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '俺也一样不能修改对手骰子',
            setup: createSetupWithHand(['card-me-too'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-me-too' }),
            ],
        });

        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeUndefined();
        expect(result.finalState.core.players['1'].hand.map(card => card.id)).toContain('card-me-too');
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(10);
    });

    it('对手打出"不愧是我"时，不能重掷当前投掷方的骰子', () => {
        const random = createQueuedRandom([4, 2, 3, 5, 6]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '不愧是我不能重掷对手骰子',
            setup: createSetupWithHand(['card-worthy-of-me'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-worthy-of-me' }),
            ],
        });

        expect(result.finalState.sys.interaction?.current).toBeUndefined();
        expect(result.finalState.core.dice.map(die => die.value)).toEqual([4, 2, 3, 5, 6]);
        expect(result.finalState.core.players['1'].hand.map(card => card.id)).toContain('card-worthy-of-me');
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(10);
    });

    it('对手打出"我又行了"时，不能重掷当前投掷方的骰子', () => {
        const random = createQueuedRandom([4, 2, 3, 5, 6]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '我又行了不能重掷对手骰子',
            setup: createSetupWithHand(['card-i-can-again'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('PLAY_CARD', '1', { cardId: 'card-i-can-again' }),
            ],
        });

        expect(result.finalState.sys.interaction?.current).toBeUndefined();
        expect(result.finalState.core.dice.map(die => die.value)).toEqual([4, 2, 3, 5, 6]);
        expect(result.finalState.core.players['1'].hand.map(card => card.id)).toContain('card-i-can-again');
        expect(result.finalState.core.players['1'].resources[RESOURCE_IDS.CP]).toBe(10);
    });
});
