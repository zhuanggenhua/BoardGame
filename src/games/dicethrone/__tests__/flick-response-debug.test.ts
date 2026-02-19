/**
 * 验证弹一手在 afterRollConfirmed 响应窗口中打出的完整流程
 * 
 * 核心验证点：
 * 1. 交互创建后响应窗口必须保持打开（pendingInteractionId 锁定）
 * 2. 交互完成后响应窗口正确推进/关闭
 * 3. targetOpponentDice 根据 card.target 正确设置
 */
import { describe, it, expect } from 'vitest';
import {
    createQueuedRandom,
    cmd,
    createRunner,
    createSetupWithHand,
    advanceTo,
} from './test-utils';

describe('弹一手在响应窗口中的行为', () => {
    it('afterRollConfirmed 窗口中打出弹一手：交互创建 + 响应窗口保持锁定 + 骰子修改成功', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        // 第一步：打出弹一手
        const result1 = runner.run({
            name: '弹一手在 afterRollConfirmed 响应窗口中打出',
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

        // 验证：弹一手被打出
        expect(result1.finalState.core.players['1'].hand.length).toBe(0);
        expect(result1.finalState.core.players['1'].discard.some((c: any) => c.id === 'card-flick')).toBe(true);

        // 验证：交互已创建
        const interaction = result1.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.kind).toBe('multistep-choice');
        expect(interaction?.playerId).toBe('1');

        // 关键验证：响应窗口必须保持打开（pendingInteractionId 锁定）
        // 这是之前 bug 的核心——窗口在交互创建前就被 CARD_PLAYED 事件关闭了
        const rw = result1.finalState.sys.responseWindow?.current;
        expect(rw).toBeDefined();
        expect(rw?.pendingInteractionId).toBeDefined();

        // 第二步：执行 MODIFY_DIE 命令
        const result2 = runner.run({
            name: '弹一手修改骰子',
            setup: () => result1.finalState,
            commands: [
                cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 4 }),
            ],
        });

        // 验证：骰子被修改
        const modifiedDie = result2.finalState.core.dice.find((d: any) => d.id === 0);
        expect(modifiedDie?.value).toBe(4);
        
        // 验证：交互已完成
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        
        // 验证：响应窗口在交互完成后正确关闭（只有1个响应者且已行动）
        expect(result2.finalState.sys.responseWindow?.current).toBeUndefined();
    });

    it('弹一手 target=select 应正确设置 targetOpponentDice=true', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '弹一手 targetOpponentDice 验证',
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

        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        const meta = (interaction?.data as any)?.meta;
        expect(meta?.targetOpponentDice).toBe(true);
    });

    it('自用骰子修改卡（如"出六"）应设置 targetOpponentDice=false', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3]);
        const runner = createRunner(random, false);

        const result = runner.run({
            name: '出六 targetOpponentDice 验证',
            setup: createSetupWithHand(['card-play-six'], {
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
                cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
            ],
        });

        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        const meta = (interaction?.data as any)?.meta;
        expect(meta?.targetOpponentDice).toBe(false);
    });
});
