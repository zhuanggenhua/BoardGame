/**
 * 响应窗口 + 交互锁定完整性测试。
 *
 * 核心校验：
 * 在 afterRollConfirmed 响应窗口中打出会创建交互的卡牌后，
 * 响应窗口必须保持打开，并通过 pendingInteractionId 继续锁定，
 * 直到交互完成或取消。
 */
import { describe, expect, it } from 'vitest';
import {
    advanceTo,
    cmd,
    createQueuedRandom,
    createRunner,
    createSetupWithHand,
} from './test-utils';

function assertWindowLockedWithInteraction(
    state: any,
    expectedInteractionKind: string,
    expectedPlayerId: string,
) {
    const interaction = state.sys.interaction?.current;
    expect(interaction, '交互应已创建').toBeDefined();
    expect(interaction?.kind).toBe(expectedInteractionKind);
    expect(interaction?.playerId).toBe(expectedPlayerId);

    const responseWindow = state.sys.responseWindow?.current;
    expect(responseWindow, '响应窗口应保持打开').toBeDefined();
    expect(responseWindow?.pendingInteractionId, '响应窗口应被交互锁定').toBeDefined();
}

describe('响应窗口交互锁定：骰子修改类（modifyDie）', () => {
    it('弹一手（modify-die-adjust-1, target=select）：完整流程', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在 afterRollConfirmed 窗口中打出',
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

        assertWindowLockedWithInteraction(result1.finalState, 'multistep-choice', '1');
        const meta1 = (result1.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta1?.targetOpponentDice).toBe(true);

        const result2 = runner.run({
            name: '修改骰子并确认交互',
            setup: () => result1.finalState,
            commands: [
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        expect(result2.finalState.core.dice.find((d: any) => d.id === 0)?.value).toBe(4);
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        expect(result2.finalState.sys.responseWindow?.current).toBeUndefined();
    });

    it('惊不惊喜（modify-die-any-1, target=select）：窗口锁定', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '惊不惊喜在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-surprise'], {
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
                cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('modifyDie');
        expect(meta?.targetOpponentDice).toBe(true);
    });

    it('意不意外（modify-die-any-2, target=select）：窗口锁定', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '意不意外在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-unexpected'], {
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
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('modifyDie');
        expect(meta?.selectCount).toBe(2);
    });
});

describe('modifyDie 严格超限回归', () => {
    it('card-unexpected 只能修改 2 颗骰子，第 3 次 MODIFY_DIE 会被拒绝', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: 'card-unexpected 在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-unexpected'], {
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
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        runner.setState(setupResult.finalState);

        const firstModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 4 });
        expect(firstModify.success).toBe(true);

        const secondModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 1, newValue: 5 });
        expect(secondModify.success).toBe(true);

        const thirdModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 2, newValue: 6 });
        expect(thirdModify.success).toBe(false);
        expect(thirdModify.error).toBe('modify_die_limit_reached');

        const diceValues = thirdModify.finalState.core.dice.map((die: any) => die.value);
        expect(diceValues.slice(0, 5)).toEqual([4, 5, 3, 3, 3]);

        const completedDieIds = (thirdModify.finalState.sys.interaction?.current?.data as any)?.completedDieIds;
        expect(completedDieIds).toEqual([0, 1]);
    });

    it('card-unexpected 重复修改同一颗骰子时，应拒绝重复消费且不得提前完成交互', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: 'card-unexpected 重复修改同一颗骰子',
            setup: createSetupWithHand(['card-unexpected'], {
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
                cmd('PLAY_CARD', '1', { cardId: 'card-unexpected' }),
            ],
        });

        runner.setState(setupResult.finalState);

        const firstModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 4 });
        expect(firstModify.success).toBe(true);

        const secondModify = runner.dispatch('MODIFY_DIE', { playerId: '1', dieId: 0, newValue: 5 });
        expect(secondModify.success).toBe(false);
        expect(secondModify.error).toBe('die_already_completed');
        expect(secondModify.finalState.sys.interaction?.current?.kind).toBe('multistep-choice');
        expect((secondModify.finalState.sys.interaction?.current?.data as any)?.completedDieIds).toEqual([0]);
    });
});

describe('响应窗口交互锁定：骰子重掷类（selectDie）', () => {
    it('抬一手（reroll-opponent-die-1, target=opponent）：窗口锁定', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3, 1]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '抬一手在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-give-hand'], {
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
                cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
            ],
        });

        assertWindowLockedWithInteraction(result.finalState, 'multistep-choice', '1');
        const meta = (result.finalState.sys.interaction?.current?.data as any)?.meta;
        expect(meta?.dtType).toBe('selectDie');
        expect(meta?.targetOpponentDice).toBe(true);
    });
});

describe('响应窗口交互锁定：取消交互', () => {
    it('交互锁定期间 RESPONSE_PASS 应被拒绝，且不得提前清掉窗口或交互', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const setupResult = runner.run({
            name: '弹一手在响应窗口中打出并创建交互',
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

        assertWindowLockedWithInteraction(setupResult.finalState, 'multistep-choice', '1');
        runner.setState(setupResult.finalState);

        const blockedPass = runner.dispatch('RESPONSE_PASS', { playerId: '1' });

        expect(blockedPass.success).toBe(false);
        expect(blockedPass.error).toBe('交互处理中，无法跳过响应');
        expect(blockedPass.finalState.sys.interaction?.current?.kind).toBe('multistep-choice');
        expect(blockedPass.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();
    });

    it('取消弹一手交互后，卡牌返回手牌', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在响应窗口中打出',
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

        assertWindowLockedWithInteraction(result1.finalState, 'multistep-choice', '1');

        const result2 = runner.run({
            name: '取消弹一手交互',
            setup: () => result1.finalState,
            commands: [cmd('SYS_INTERACTION_CANCEL', '1')],
        });

        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        expect(result2.finalState.core.players['1'].hand.some((c: any) => c.id === 'card-flick')).toBe(true);
    });
});
