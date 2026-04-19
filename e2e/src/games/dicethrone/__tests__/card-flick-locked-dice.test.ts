/**
 * 测试"弹一手"卡牌修改对手锁定骰子的功能
 * 
 * Bug: 对手锁定的骰子，我方用"弹一手"不能改变对手的骰子
 * 根因: UI 层判断 `!d.isKept` 时没有考虑 `targetOpponentDice` 字段
 * 修复: 当 `targetOpponentDice=true` 时，忽略锁定状态
 */
import { describe, it, expect } from 'vitest';
import { createRunner, createQueuedRandom, cmd, createSetupWithHand, advanceTo } from './test-utils';

describe('弹一手修改对手锁定骰子', () => {
    it('对手锁定骰子后，我方打出"弹一手"应该能修改对手的锁定骰子', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]); // 玩家0投掷结果
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
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // 验证：骰子0的值从3变为4（即使它是锁定的）
        const finalDice = result.finalState.core.dice;
        const die0 = finalDice.find(d => d.id === 0);
        expect(die0?.value).toBe(4);
        expect(die0?.isKept).toBe(true); // 锁定状态不变
    });

    it('对手未锁定骰子时,我方打出"弹一手"也能正常修改', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
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
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // 验证：骰子0的值从3变为4
        const finalDice = result.finalState.core.dice;
        const die0 = finalDice.find(d => d.id === 0);
        expect(die0?.value).toBe(4);
        expect(die0?.isKept).toBe(false);
    });

    it('自己打出"弹一手"修改自己的骰子时，不能修改已锁定的骰子', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手不能修改自己的锁定骰子',
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
            ],
        });

        // 验证：交互已创建，targetOpponentDice=false（因为玩家0是 rollerId）
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        const meta = (interaction?.data as any)?.meta;
        expect(meta?.targetOpponentDice).toBe(false); // 玩家0是 rollerId，所以是 false
        
        // UI 层应该只允许修改未锁定的骰子（骰子1-4），不能修改骰子0
    });
});
