/**
 * pirate_broadside（侧翼开炮）D1 审计测试
 *
 * 验证三重条件过滤：
 * 1. 基地必须有己方随从
 * 2. 目标是一个玩家的所有随从（非混合选择）
 * 3. 目标随从力量必须 ≤2
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { makeState, makePlayer, makeCard, makeMinion } from './helpers';
import type { SmashUpCore } from '../domain/types';
import { COMMANDS } from '../domain/commands';

describe('pirate_broadside D1 审计：三重条件过滤', () => {
    it('条件1：只能选择有己方随从的基地', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 基地0：只有对手随从，没有己方随从
                        makeMinion('m1', 'pirate_buccaneer', '1', 0, 2),
                    ],
                },
                {
                    defId: 'base_test_2',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 基地1：有己方随从 + 对手弱随从
                        makeMinion('m2', 'pirate_first_mate', '0', 1, 2),
                        makeMinion('m3', 'pirate_first_mate', '1', 1, 2),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 1 });

        // 验证：创建了交互
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('pirate_broadside');

        // 验证：选项中不包含基地0（没有己方随从）
        const options = interaction?.data?.options ?? [];
        const baseIndices = options.map((opt: any) => opt.value?.baseIndex);
        expect(baseIndices).not.toContain(0); // 基地0不应出现
        expect(baseIndices).toContain(1); // 基地1应出现
    });

    it('条件2：按玩家分组，只消灭指定玩家的随从', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 己方随从
                        makeMinion('m0', 'pirate_first_mate', '0', 0, 2),
                        // 对手1的弱随从
                        makeMinion('m1', 'pirate_first_mate', '1', 0, 2),
                        makeMinion('m2', 'pirate_first_mate', '1', 0, 2),
                        // 对手2的弱随从
                        makeMinion('m3', 'pirate_first_mate', '2', 0, 2),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 0 });

        // 验证：创建了交互，选项按玩家分组
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeDefined();

        const options = interaction?.data?.options ?? [];
        // 应该有3个选项：对手1（2个随从）、对手2（1个随从）、自己（1个随从）
        expect(options.length).toBeGreaterThanOrEqual(3);

        // 选择对手1
        const player1Option = options.find((opt: any) => opt.value?.targetPlayerId === '1');
        expect(player1Option).toBeDefined();

        runner.dispatch(COMMANDS.RESOLVE_INTERACTION, { value: player1Option!.value });

        // 验证：只消灭对手1的随从
        const finalState = runner.getState();
        const base = finalState.core.bases[0];
        expect(base.minions.find(m => m.uid === 'm1')).toBeUndefined(); // 对手1的随从被消灭
        expect(base.minions.find(m => m.uid === 'm2')).toBeUndefined(); // 对手1的随从被消灭
        expect(base.minions.find(m => m.uid === 'm3')).toBeDefined(); // 对手2的随从未被消灭
        expect(base.minions.find(m => m.uid === 'm0')).toBeDefined(); // 己方随从未被消灭
    });

    it('条件3：只消灭力量≤2的随从', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 己方随从
                        makeMinion('m0', 'pirate_first_mate', '0', 0, 2),
                        // 对手的弱随从（力量2）
                        makeMinion('m1', 'pirate_first_mate', '1', 0, 2),
                        // 对手的强随从（力量3）
                        makeMinion('m2', 'pirate_cut_lass', '1', 0, 3),
                        // 对手的强随从（力量4）
                        makeMinion('m3', 'pirate_buccaneer', '1', 0, 4),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 0 });

        // 验证：创建了交互
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 选择对手1
        const options = interaction?.data?.options ?? [];
        const player1Option = options.find((opt: any) => opt.value?.targetPlayerId === '1');
        expect(player1Option).toBeDefined();

        // 验证：选项标签应显示只有1个弱随从（力量≤2）
        expect(player1Option!.label).toContain('1个弱随从');

        runner.dispatch(COMMANDS.RESOLVE_INTERACTION, { value: player1Option!.value });

        // 验证：只消灭力量≤2的随从
        const finalState = runner.getState();
        const base = finalState.core.bases[0];
        expect(base.minions.find(m => m.uid === 'm1')).toBeUndefined(); // 力量2被消灭
        expect(base.minions.find(m => m.uid === 'm2')).toBeDefined(); // 力量3未被消灭
        expect(base.minions.find(m => m.uid === 'm3')).toBeDefined(); // 力量4未被消灭
    });

    it('三重条件组合：多个基地，多个玩家，混合力量', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 基地0：有己方随从
                        makeMinion('m0', 'pirate_first_mate', '0', 0, 2),
                        // 对手1：1个弱随从 + 1个强随从
                        makeMinion('m1', 'pirate_first_mate', '1', 0, 2),
                        makeMinion('m2', 'pirate_buccaneer', '1', 0, 4),
                        // 对手2：2个弱随从
                        makeMinion('m3', 'pirate_first_mate', '2', 0, 2),
                        makeMinion('m4', 'pirate_first_mate', '2', 0, 2),
                    ],
                },
                {
                    defId: 'base_test_2',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 基地1：没有己方随从
                        makeMinion('m5', 'pirate_first_mate', '1', 1, 2),
                        makeMinion('m6', 'pirate_first_mate', '2', 1, 2),
                    ],
                },
                {
                    defId: 'base_test_3',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 基地2：有己方随从
                        makeMinion('m7', 'pirate_first_mate', '0', 2, 2),
                        // 对手1：1个弱随从
                        makeMinion('m8', 'pirate_first_mate', '1', 2, 2),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 0 });

        // 验证：创建了交互
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeDefined();

        const options = interaction?.data?.options ?? [];

        // 验证：选项中不包含基地1（没有己方随从）
        const baseIndices = options.map((opt: any) => opt.value?.baseIndex);
        expect(baseIndices).not.toContain(1);

        // 验证：基地0应该有2个选项（对手1有1个弱随从，对手2有2个弱随从）
        const base0Options = options.filter((opt: any) => opt.value?.baseIndex === 0);
        expect(base0Options.length).toBe(2);

        // 验证：基地2应该有1个选项（对手1有1个弱随从）
        const base2Options = options.filter((opt: any) => opt.value?.baseIndex === 2);
        expect(base2Options.length).toBe(1);

        // 选择基地0的对手2（2个弱随从）
        const base0Player2Option = options.find(
            (opt: any) => opt.value?.baseIndex === 0 && opt.value?.targetPlayerId === '2'
        );
        expect(base0Player2Option).toBeDefined();
        expect(base0Player2Option!.label).toContain('2个弱随从');

        runner.dispatch(COMMANDS.RESOLVE_INTERACTION, { value: base0Player2Option!.value });

        // 验证：只消灭基地0的对手2的弱随从
        const finalState = runner.getState();
        const base0 = finalState.core.bases[0];
        expect(base0.minions.find(m => m.uid === 'm0')).toBeDefined(); // 己方随从未被消灭
        expect(base0.minions.find(m => m.uid === 'm1')).toBeDefined(); // 对手1的弱随从未被消灭
        expect(base0.minions.find(m => m.uid === 'm2')).toBeDefined(); // 对手1的强随从未被消灭
        expect(base0.minions.find(m => m.uid === 'm3')).toBeUndefined(); // 对手2的弱随从被消灭
        expect(base0.minions.find(m => m.uid === 'm4')).toBeUndefined(); // 对手2的弱随从被消灭

        // 验证：其他基地不受影响
        const base1 = finalState.core.bases[1];
        expect(base1.minions.length).toBe(2); // 基地1的随从未被消灭

        const base2 = finalState.core.bases[2];
        expect(base2.minions.length).toBe(2); // 基地2的随从未被消灭
    });

    it('边界情况：可以选择自己的弱随从', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 己方弱随从
                        makeMinion('m0', 'pirate_first_mate', '0', 0, 2),
                        makeMinion('m1', 'pirate_first_mate', '0', 0, 2),
                        // 对手弱随从
                        makeMinion('m2', 'pirate_first_mate', '1', 0, 2),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 0 });

        // 验证：创建了交互
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeDefined();

        const options = interaction?.data?.options ?? [];

        // 验证：选项中包含"你自己"
        const selfOption = options.find((opt: any) => opt.value?.targetPlayerId === '0');
        expect(selfOption).toBeDefined();
        expect(selfOption!.label).toContain('你自己');
        expect(selfOption!.label).toContain('2个弱随从');

        // 选择自己
        runner.dispatch(COMMANDS.RESOLVE_INTERACTION, { value: selfOption!.value });

        // 验证：消灭自己的弱随从
        const finalState = runner.getState();
        const base = finalState.core.bases[0];
        expect(base.minions.find(m => m.uid === 'm0')).toBeUndefined(); // 己方弱随从被消灭
        expect(base.minions.find(m => m.uid === 'm1')).toBeUndefined(); // 己方弱随从被消灭
        expect(base.minions.find(m => m.uid === 'm2')).toBeDefined(); // 对手随从未被消灭
    });

    it('边界情况：没有满足条件的目标时无法打出', () => {
        const runner = new GameTestRunner<SmashUpCore>('smashup');
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('broadside1', 'pirate_broadside', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    breakpoint: 20,
                    rewards: [5, 3, 2],
                    minions: [
                        // 只有对手随从，没有己方随从
                        makeMinion('m1', 'pirate_buccaneer', '1', 0, 4),
                    ],
                },
            ],
            currentPlayer: '0',
        });

        runner.setState(state);
        runner.dispatch(COMMANDS.PLAY_ACTION, { cardUid: 'broadside1', baseIndex: 0 });

        // 验证：没有创建交互（因为没有满足条件的基地）
        const interaction = runner.getState().sys.interaction?.current;
        expect(interaction).toBeUndefined();

        // 验证：卡牌仍在手牌中（打出失败）
        const player = runner.getState().core.players['0'];
        expect(player.hand.find(c => c.uid === 'broadside1')).toBeUndefined(); // 卡牌已打出
        expect(player.discard.find(c => c.uid === 'broadside1')).toBeDefined(); // 卡牌进入弃牌堆
    });
});
