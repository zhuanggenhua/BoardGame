/**
 * 验证"抬一手"（card-give-hand）在响应窗口中正确触发
 * 
 * 抬一手：选择对手的1颗骰子，强制他重掷该骰子
 * timing: 'roll', target: 'opponent', customActionId: 'reroll-opponent-die-1'
 * playCondition.requireRollConfirmed: true
 * 
 * 回归测试：修复 CONFIRM_ROLL 使用 pre-reduce 状态导致 rollConfirmed=false，
 * requireRollConfirmed 的卡牌无法通过 isCardPlayableInResponseWindow 检查
 */
import { describe, it, expect } from 'vitest';
import {
    createQueuedRandom,
    cmd,
    createRunner,
    createSetupWithHand,
    advanceTo,
} from './test-utils';

describe('抬一手（card-give-hand）响应窗口触发', () => {
    it('进攻阶段：防御方确认骰面后，进攻方可在响应窗口打出抬一手', () => {
        // 僧侣骰子面：fist=1,2; taiji=4,5
        // 投出 [1,1,1,4,5] → 3个fist → 可选 fist-technique-3（4点伤害）
        const random = createQueuedRandom([1, 1, 1, 4, 5, /* 重掷值 */ 2]);
        const runner = createRunner(random, false);

        const result1 = runner.run({
            name: '进攻方投骰确认后防御方打出抬一手',
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
                // afterRollConfirmed 响应窗口打开，防御方打出抬一手
                cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
            ],
        });

        // 抬一手已打出，交互已创建（选择重掷哪颗骰子）
        expect(result1.finalState.core.players['1'].hand.length).toBe(0);
        expect(result1.finalState.sys.interaction?.current).toBeDefined();
        // 响应窗口必须保持打开（pendingInteractionId 锁定）
        expect(result1.finalState.sys.responseWindow?.current).toBeDefined();
        expect(result1.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();
    });

    it('防御阶段：进攻方在 afterRollConfirmed 窗口打出抬一手强制重掷防御方骰子', () => {
        // 场景：防御阶段，防御方确认骰面后，进攻方打出抬一手
        const random = createQueuedRandom([
            1, 1, 1, 4, 5,  // 进攻方投骰
            3, 3, 3, 3, 3,  // 防御方投骰
            /* 重掷值 */ 1,  // 进攻方用抬一手重掷防御方的骰子
        ]);
        const runner = createRunner(random, false);

        // 进攻方持有抬一手，推进到防御阶段
        const result1 = runner.run({
            name: '推进到防御阶段',
            setup: createSetupWithHand(['card-give-hand'], {
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
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-3' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
        });

        expect(result1.finalState.sys.phase).toBe('defensiveRoll');

        // 防御方投骰并确认 → afterRollConfirmed 响应窗口应打开
        const result2 = runner.run({
            name: '防御方投骰并确认',
            setup: () => result1.finalState,
            commands: [
                cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
            ],
        });

        // 核心断言：响应窗口必须打开（修复前此处为 undefined）
        expect(result2.finalState.sys.responseWindow?.current).toBeDefined();

        // 进攻方在响应窗口中打出抬一手
        const result3 = runner.run({
            name: '进攻方打出抬一手',
            setup: () => result2.finalState,
            commands: [
                cmd('PLAY_CARD', '0', { cardId: 'card-give-hand' }),
            ],
        });

        // 交互已创建（选择重掷哪颗骰子）
        expect(result3.finalState.sys.interaction?.current).toBeDefined();
        // 响应窗口必须保持打开（pendingInteractionId 锁定）
        expect(result3.finalState.sys.responseWindow?.current).toBeDefined();
        expect(result3.finalState.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();

        // 选择重掷第一颗骰子
        const result4 = runner.run({
            name: '进攻方选择重掷防御方的骰子',
            setup: () => result3.finalState,
            commands: [
                cmd('REROLL_DIE', '0', { dieId: 0 }),
            ],
        });

        // 重掷完成，交互关闭
        expect(result4.finalState.sys.interaction?.current).toBeFalsy();
    });
});
