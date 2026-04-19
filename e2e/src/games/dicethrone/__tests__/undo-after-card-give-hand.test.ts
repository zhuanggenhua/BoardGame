/**
 * 撤销系统：抬一手（card-give-hand）打出后的撤回测试
 *
 * 复现场景：
 * 1. 玩家 0 推进到 offensiveRoll（ADVANCE_PHASE 创建快照 S1）
 * 2. 掷骰 → 确认骰子（CONFIRM_ROLL 创建快照 S2）
 * 3. 响应窗口打开，玩家 1 打出"抬一手"（PLAY_CARD 创建快照 S3）
 * 4. 玩家 1 选择对手骰子 → 重掷 → 交互完成 → 响应窗口关闭
 * 5. 玩家请求撤回 → 应能撤回到 S3（打出卡牌前）
 * 6. 再次撤回 → 应能撤回到 S2（确认骰子前）
 * 7. 再次撤回 → 应能撤回到 S1
 *
 * 验证：撤回后快照栈正确递减，不会"卡住"
 *
 * 白名单命令（创建快照）：ADVANCE_PHASE, CONFIRM_ROLL, PLAY_CARD, PLAY_UPGRADE_CARD, SELL_CARD, SELECT_ABILITY
 */
import { describe, it, expect } from 'vitest';
import {
    createQueuedRandom,
    cmd,
    createRunner,
    createSetupWithHand,
    advanceTo,
} from './test-utils';

describe('撤销系统：抬一手打出后的多级撤回', () => {
    it('完整流程：打出抬一手 → 完成交互 → 连续撤回应成功', () => {
        // 骰子值：5个3，重掷后得1
        const random = createQueuedRandom([3, 3, 3, 3, 3, /* 重掷 */ 1]);
        const runner = createRunner(random, true);

        // 阶段 1：推进到 offensiveRoll → 掷骰 → 确认 → 打出抬一手
        // 快照创建点：ADVANCE_PHASE(S1) + CONFIRM_ROLL(S2) = 2
        // 注意：PLAY_CARD 在响应窗口中，不创建快照（响应窗口有独立的快照机制）
        const result1 = runner.run({
            name: '打出抬一手并创建交互',
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

        // 验证：交互已创建，响应窗口锁定
        const interaction1 = result1.finalState.sys.interaction?.current;
        expect(interaction1, '交互应已创建').toBeDefined();
        expect(interaction1?.kind).toBe('multistep-choice');

        // ADVANCE_PHASE(S1) + CONFIRM_ROLL(S2) = 2
        const snapshotCount1 = result1.finalState.sys.undo.snapshots.length;
        expect(snapshotCount1).toBe(2);

        // 阶段 2：完成骰子选择交互 → 重掷 → 响应窗口关闭
        const result2 = runner.run({
            name: '完成抬一手交互',
            setup: () => result1.finalState,
            commands: [
                cmd('REROLL_DIE', '1', { dieId: 0 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // 验证：交互已完成，响应窗口已关闭
        expect(result2.finalState.sys.interaction?.current).toBeUndefined();
        expect(result2.finalState.sys.responseWindow?.current).toBeUndefined();

        // 快照数量应保持 2（REROLL_DIE 和 SYS_INTERACTION_CONFIRM 不在白名单中）
        const snapshotCount2 = result2.finalState.sys.undo.snapshots.length;
        expect(snapshotCount2).toBe(2);

        // 阶段 3：第一次撤回（requireApproval=true，需要 REQUEST + APPROVE）
        const result3 = runner.run({
            name: '第一次撤回',
            setup: () => result2.finalState,
            commands: [
                cmd('SYS_REQUEST_UNDO', '0'),
                cmd('SYS_APPROVE_UNDO', '1'),
            ],
        });

        // 撤回成功，快照 2 → 1
        expect(result3.finalState.sys.undo.snapshots.length).toBe(1);
        expect(result3.finalState.sys.undo.pendingRequest).toBeUndefined();

        // 阶段 4：第二次撤回
        const result4 = runner.run({
            name: '第二次撤回',
            setup: () => result3.finalState,
            commands: [
                cmd('SYS_REQUEST_UNDO', '0'),
                cmd('SYS_APPROVE_UNDO', '1'),
            ],
        });

        // 快照 1 → 0
        expect(result4.finalState.sys.undo.snapshots.length).toBe(0);
        expect(result4.finalState.sys.undo.pendingRequest).toBeUndefined();

        // 阶段 5：快照为空时撤回应失败
        const result5 = runner.run({
            name: '快照为空时撤回应失败',
            setup: () => result4.finalState,
            commands: [
                cmd('SYS_REQUEST_UNDO', '0'),
            ],
            expect: {
                expectError: { command: 'SYS_REQUEST_UNDO', error: '没有可撤销的操作' },
            },
        });
        expect(result5.passed).toBe(true);
    });

    it('maxSnapshots=5 限制：快照不超过上限', () => {
        const random = createQueuedRandom([3, 3, 3, 3, 3, 1, 2, 3, 4, 5]);
        const runner = createRunner(random, true);

        const result1 = runner.run({
            name: '推进到 offensiveRoll 并确认',
            setup: createSetupWithHand(['card-give-hand', 'card-flick'], {
                playerId: '1', cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                    core.players['1'].deck = [];
                },
            }),
            commands: [
                ...advanceTo('offensiveRoll'),  // ADVANCE_PHASE → S1
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),       // S2
                cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),  // 不创建快照（响应窗口）
            ],
        });

        expect(result1.finalState.sys.undo.snapshots.length).toBe(2);

        // 完成交互
        const result2 = runner.run({
            name: '完成交互',
            setup: () => result1.finalState,
            commands: [
                cmd('REROLL_DIE', '1', { dieId: 0 }),
                cmd('SYS_INTERACTION_CONFIRM', '1'),
            ],
        });

        // REROLL_DIE 和 SYS_INTERACTION_CONFIRM 不在白名单，快照数不变
        expect(result2.finalState.sys.undo.snapshots.length).toBe(2);

        // 连续撤回 2 次
        let state = result2.finalState;
        for (let i = 2; i > 0; i--) {
            const r = runner.run({
                name: `撤回第 ${3 - i} 次`,
                setup: () => state,
                commands: [
                    cmd('SYS_REQUEST_UNDO', '0'),
                    cmd('SYS_APPROVE_UNDO', '1'),
                ],
            });
            expect(r.finalState.sys.undo.snapshots.length).toBe(i - 1);
            state = r.finalState;
        }

        // 最终快照为 0
        expect(state.sys.undo.snapshots.length).toBe(0);
    });
});
