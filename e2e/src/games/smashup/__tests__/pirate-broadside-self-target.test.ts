/**
 * 测试：侧翼开炮可以选择自己
 * 
 * Bug: 侧翼开炮只能选择对手，不能选择自己
 * - 描述："消灭一个玩家的所有力量为2或以下的随从"（Destroy all of one player's minions）
 * - 实现：只能选择对手（m.controller !== playerId）
 * - 修复：允许选择任何玩家，包括自己
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import { runCommand } from './testRunner';
import { makeState, makePlayer, makeCard, makeBase, makeMinion, makeMatchState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
import type { RandomFn } from '../../../engine/types';

beforeAll(() => {
    initAllAbilities();
});

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: () => 1,
    range: (min) => min,
};

describe('侧翼开炮可以选择自己', () => {
    it('选项中应该包含自己（当自己有弱随从时）', () => {
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
                makeBase('test_base', [
                    makeMinion('m1', 'test_minion', '0', 3), // 己方强随从
                    makeMinion('m2', 'test_minion', '0', 2), // 己方弱随从
                    makeMinion('m3', 'test_minion', '1', 2), // 对手弱随从
                ]),
            ],
        });

        const ms = makeMatchState(state);

        // 打出侧翼开炮
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.title).toContain('选择基地和玩家');

        // 验证选项包含所有玩家（包括自己）
        const options = (interaction?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options.length).toBeGreaterThanOrEqual(2); // 至少2个选项（自己+对手）

        // 验证包含自己（P0）
        const selfOption = options.find((opt: any) => opt.value?.targetPlayerId === '0');
        expect(selfOption).toBeDefined();
        expect(selfOption.label).toContain('你自己');

        // 验证包含对手（P1）
        const opponentOption = options.find((opt: any) => opt.value?.targetPlayerId === '1');
        expect(opponentOption).toBeDefined();
    });

    it('可以选择自己并消灭自己的弱随从', () => {
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
                makeBase('test_base', [
                    makeMinion('m1', 'test_minion', '0', 3), // 己方强随从（不会被消灭）
                    makeMinion('m2', 'test_minion', '0', 2), // 己方弱随从（会被消灭）
                    makeMinion('m3', 'test_minion', '0', 1), // 己方弱随从（会被消灭）
                    makeMinion('m4', 'test_minion', '1', 2), // 对手弱随从（不会被消灭）
                ]),
            ],
        });

        const ms = makeMatchState(state);

        // 打出侧翼开炮
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 验证选项中包含自己
        const options = (interaction?.data as any)?.options;
        const selfOption = options.find((opt: any) => opt.value?.targetPlayerId === '0');
        expect(selfOption).toBeDefined();
        expect(selfOption.label).toContain('2个弱随从'); // m2 和 m3
    });

    it('可以选择对手并消灭对手的弱随从', () => {
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
                makeBase('test_base', [
                    makeMinion('m1', 'test_minion', '0', 3), // 己方随从
                    makeMinion('m2', 'test_minion', '1', 2), // 对手弱随从
                    makeMinion('m3', 'test_minion', '1', 1), // 对手弱随从
                ]),
            ],
        });

        const ms = makeMatchState(state);

        // 打出侧翼开炮
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 验证选项中包含对手
        const options = (interaction?.data as any)?.options;
        const opponentOption = options.find((opt: any) => opt.value?.targetPlayerId === '1');
        expect(opponentOption).toBeDefined();
        expect(opponentOption.label).toContain('2个弱随从'); // m2 和 m3
    });

    it('没有己方随从的基地不会出现在选项中', () => {
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
                makeBase('base1', [
                    makeMinion('m1', 'test_minion', '0', 3), // 基地1有己方随从
                    makeMinion('m2', 'test_minion', '1', 2),
                ]),
                makeBase('base2', [
                    makeMinion('m3', 'test_minion', '1', 2), // 基地2没有己方随从
                    makeMinion('m4', 'test_minion', '1', 1),
                ]),
            ],
        });

        const ms = makeMatchState(state);

        // 打出侧翼开炮
        const result = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'broadside1', targetBaseIndex: 0 },
            timestamp: 1000,
        } as any, defaultRandom);

        // 验证交互存在
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();

        // 验证选项中只包含基地1
        const options = (interaction?.data as any)?.options;
        const base1Options = options.filter((opt: any) => opt.value?.baseIndex === 0);
        const base2Options = options.filter((opt: any) => opt.value?.baseIndex === 1);
        
        expect(base1Options.length).toBeGreaterThan(0);
        expect(base2Options.length).toBe(0);
    });
});
