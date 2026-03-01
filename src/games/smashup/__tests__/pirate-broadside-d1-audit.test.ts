/**
 * pirate_broadside（侧翼开炮）D1 审计测试
 *
 * 验证三重条件过滤：
 * 1. 基地必须有己方随从
 * 2. 目标是一个玩家的所有随从（非混合选择）
 * 3. 目标随从力量必须 ≤2
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { makeState, makePlayer, makeCard, makeMinion } from './helpers';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { initAllAbilities } from '../abilities';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

const PLAYER_IDS = ['0', '1'];

beforeAll(() => {
    initAllAbilities();
});

function createRunner(setup: (ids: PlayerId[], random: RandomFn) => MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
        ],
        playerIds: PLAYER_IDS,
        setup: (ids, random) => {
            const customState = setup(ids, random);
            // 确保 sys 对象完整初始化
            if (!customState.sys || Object.keys(customState.sys).length === 0) {
                const systems = [
                    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
                    ...createBaseSystems<SmashUpCore>(),
                ];
                const sys = systems.reduce((acc, system) => {
                    if (system.init) {
                        return { ...acc, [system.name]: system.init(ids) };
                    }
                    return acc;
                }, {} as any);
                return { ...customState, sys };
            }
            return customState;
        },
        silent: true,
    });
}

describe('pirate_broadside D1 审计：三重条件过滤', () => {
    it('条件1：只能选择有己方随从的基地', () => {
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

        const runner = createRunner(() => ({ core: state, sys: {} as any }));
        const result = runner.run({
            name: '条件1测试',
            commands: [
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside1', baseIndex: 1 } },
            ],
        });

        // 验证：创建了交互
        const interaction = result.finalState.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data?.sourceId).toBe('pirate_broadside');

        // 验证：选项中不包含基地0（没有己方随从）
        const options = interaction?.data?.options ?? [];
        const baseIndices = options.map((opt: any) => opt.value?.baseIndex);
        expect(baseIndices).not.toContain(0); // 基地0不应出现
        expect(baseIndices).toContain(1); // 基地1应出现
    });

    it('条件2：按玩家分组，只消灭指定玩家的随从', () => {
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

        const runner = createRunner(() => ({ core: state, sys: {} as any }));
        const result = runner.run({
            name: '条件2测试',
            commands: [
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside1', baseIndex: 0 } },
                { type: INTERACTION_COMMANDS.RESOLVE, playerId: '0', payload: { value: { baseIndex: 0, targetPlayerId: '1' } } },
            ],
        });

        // 验证：只消灭对手1的随从
        const finalState = result.finalState.core;
        const base = finalState.bases[0];
        expect(base.minions.find(m => m.uid === 'm1')).toBeUndefined(); // 对手1的随从被消灭
        expect(base.minions.find(m => m.uid === 'm2')).toBeUndefined(); // 对手1的随从被消灭
        expect(base.minions.find(m => m.uid === 'm3')).toBeDefined(); // 对手2的随从未被消灭
        expect(base.minions.find(m => m.uid === 'm0')).toBeDefined(); // 己方随从未被消灭
    });

    it('条件3：只消灭力量≤2的随从', () => {
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

        const runner = createRunner(() => ({ core: state, sys: {} as any }));
        const result = runner.run({
            name: '条件3测试',
            commands: [
                { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'broadside1', baseIndex: 0 } },
                { type: INTERACTION_COMMANDS.RESOLVE, playerId: '0', payload: { value: { baseIndex: 0, targetPlayerId: '1' } } },
            ],
        });

        // 验证：只消灭力量≤2的随从
        const finalState = result.finalState.core;
        const base = finalState.bases[0];
        expect(base.minions.find(m => m.uid === 'm1')).toBeUndefined(); // 力量2被消灭
        expect(base.minions.find(m => m.uid === 'm2')).toBeDefined(); // 力量3未被消灭
        expect(base.minions.find(m => m.uid === 'm3')).toBeDefined(); // 力量4未被消灭
    });
});
