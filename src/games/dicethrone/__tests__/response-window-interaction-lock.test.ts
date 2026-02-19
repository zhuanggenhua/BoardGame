/**
 * 响应窗口 + 交互锁定 完整性测试
 *
 * 核心验证：在响应窗口中打出会产生 INTERACTION_REQUESTED 的卡牌时，
 * 响应窗口必须保持打开（pendingInteractionId 锁定），直到交互完成后才推进/关闭。
 *
 * afterRollConfirmed 窗口中可打出的交互卡（target=select/opponent 的骰子卡）：
 * - 弹一手 (card-flick): modify-die-adjust-1, target=select
 * - 惊不惊喜 (card-surprise): modify-die-any-1, target=select
 * - 意不意外 (card-unexpected): modify-die-any-2, target=select
 * - 抬一手 (card-give-hand): reroll-opponent-die-1, target=opponent
 *
 * target=self 的骰子卡（出六、配得上我等）在 afterRollConfirmed 窗口中不可打出，
 * 因为此时场上是对手的骰子，self 目标无合法对象。
 */
import { describe, it, expect } from 'vitest';
import {
    createQueuedRandom,
    cmd,
    createRunner,
    createSetupWithHand,
    advanceTo,
} from './test-utils';

/**
 * 通用断言：打出交互卡后响应窗口必须保持锁定
 */
function assertWindowLockedWithInteraction(
    state: any,
    expectedInteractionKind: string,
    expectedPlayerId: string,
) {
    const interaction = state.sys.interaction?.current;
    expect(interaction, '交互应已创建').toBeDefined();
    expect(interaction?.kind).toBe(expectedInteractionKind);
    expect(interaction?.playerId).toBe(expectedPlayerId);

    const rw = state.sys.responseWindow?.current;
    expect(rw, '响应窗口应保持打开').toBeDefined();
    expect(rw?.pendingInteractionId, '响应窗口应被交互锁定').toBeDefined();
}

describe('响应窗口交互锁定：骰子修改类（modifyDie）', () => {
    it('弹一手（modify-die-adjust-1, target=select）：完整流程', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1', cp: 10,
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

        // 完成交互 → 响应窗口关闭
        const result2 = runner.run({
            name: '修改骰子',
            setup: () => result1.finalState,
            commands: [cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 })],
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
                playerId: '1', cp: 10,
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
                playerId: '1', cp: 10,
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

describe('响应窗口交互锁定：骰子重掷类（selectDie）', () => {
    it('抬一手（reroll-opponent-die-1, target=opponent）：窗口锁定', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3, /* 重掷 */ 1]);
        const runner = createRunner(random, true);

        const result = runner.run({
            name: '抬一手在 afterRollConfirmed 窗口中打出',
            setup: createSetupWithHand(['card-give-hand'], {
                playerId: '1', cp: 10,
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
    it('取消弹一手交互后，卡牌返还手牌', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '弹一手在响应窗口中打出',
            setup: createSetupWithHand(['card-flick'], {
                playerId: '1', cp: 10,
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

        // 取消交互
        const result2 = runner.run({
            name: '取消弹一手交互',
            setup: () => result1.finalState,
            commands: [cmd('SYS_INTERACTION_CANCEL', '1')],
        });

        // 交互已取消
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        // 卡牌应返还手牌
        expect(result2.finalState.core.players['1'].hand.some((c: any) => c.id === 'card-flick')).toBe(true);
    });
});
