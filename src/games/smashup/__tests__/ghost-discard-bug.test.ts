/**
 * 测试：幽灵 + 鬼屋同时触发弃牌时，不能弃掉同一张牌两次
 * 
 * Bug 场景：
 * 1. 打出幽灵到鬼屋基地
 * 2. 幽灵 onPlay 触发：弃一张手牌（可跳过）
 * 3. 鬼屋 onMinionPlayed 触发：必须弃一张手牌
 * 4. Bug：两个交互都基于初始状态创建，可以选择同一张牌两次
 * 
 * 修复：使用 optionsGenerator，第二个交互弹出时基于最新手牌状态生成选项
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import type { CardInstance } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { smashUpSystemsForTest } from '../game';
import { createInitialSystemState } from '../../../engine/pipeline';

beforeAll(() => {
    // 注册所有能力（提供正确的 random 函数）
    const mockRandom: RandomFn = Object.assign(
        () => 0.5,
        {
            shuffle: <T>(arr: T[]): T[] => [...arr],
            integer: (min: number, max: number) => min,
        }
    );
    SmashUpDomain.setup(['0', '1'], mockRandom);
});

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makeState(overrides: Partial<SmashUpCore>): SmashUpCore {
    return {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        phase: 'main',
        players: {
            '0': {
                deck: [],
                hand: [],
                discard: [],
                vp: 0,
                minionLimit: 1,
                actionLimit: 1,
                minionsPlayed: 0,
                actionsPlayed: 0,
            },
            '1': {
                deck: [],
                hand: [],
                discard: [],
                vp: 0,
                minionLimit: 1,
                actionLimit: 1,
                minionsPlayed: 0,
                actionsPlayed: 0,
            },
        },
        bases: [
            {
                defId: 'base_haunted_house_al9000', // 鬼屋基地
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: [],
        nextUid: 1000,
        ...overrides,
    };
}

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const sys = createInitialSystemState(['0', '1'], smashUpSystemsForTest, undefined);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function createRunner(customState: MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, any, any>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: ['0', '1'],
        setup: () => customState,
        silent: true,
    });
}

describe('幽灵 + 鬼屋弃牌 bug 修复', () => {
    it('打出幽灵到鬼屋基地，两次弃牌不能选择同一张牌', () => {
        const core = makeState({
            players: {
                '0': {
                    deck: [],
                    hand: [
                        makeCard('ghost1', 'ghost_ghost', 'minion', '0'),
                        makeCard('h1', 'test_card_a', 'action', '0'),
                        makeCard('h2', 'test_card_b', 'action', '0'),
                        makeCard('h3', 'test_card_c', 'action', '0'),
                    ],
                    discard: [],
                    vp: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
                '1': {
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
            },
        });

        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        // 1. 打出幽灵到鬼屋基地
        const r1 = runner.run({
            name: '打出幽灵到鬼屋',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: { cardUid: 'ghost1', baseIndex: 0 },
                } as SmashUpCommand,
            ],
        });

        expect(r1.steps[0]?.success).toBe(true);

        // 2. 应该有两个交互：幽灵 onPlay + 鬼屋 onMinionPlayed
        const interaction1 = r1.finalState.sys.interaction.current;
        const interaction2 = r1.finalState.sys.interaction.queue[0];

        expect(interaction1).toBeDefined();
        expect(interaction2).toBeDefined();
        expect(interaction1?.data.sourceId).toBe('ghost_ghost');
        expect(interaction2?.data.sourceId).toBe('base_haunted_house_al9000');

        // 3. 第一个交互：幽灵弃牌（选择弃掉 h1）
        const options1 = (interaction1?.data as any).options;
        expect(options1.length).toBeGreaterThan(0);
        const discardH1Option = options1.find((o: any) => o.value?.cardUid === 'h1');
        expect(discardH1Option).toBeDefined();

        const r2 = runner.run({
            name: '幽灵弃牌选择 h1',
            commands: [
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: discardH1Option.id },
                },
            ],
            initialState: r1.finalState,
        });

        if (!r2.steps[0]?.success) {
            console.log('r2 失败:', r2.steps[0]?.error);
            console.log('当前交互:', r1.finalState.sys.interaction.current);
        }
        expect(r2.steps[0]?.success).toBe(true);

        // 4. 验证 h1 已被弃掉
        const p0AfterFirst = r2.finalState.core.players['0'];
        expect(p0AfterFirst.hand.some((c: CardInstance) => c.uid === 'h1')).toBe(false);
        expect(p0AfterFirst.discard.some((c: CardInstance) => c.uid === 'h1')).toBe(true);

        // 5. 第二个交互应该弹出（鬼屋弃牌）
        const interaction2Current = r2.finalState.sys.interaction.current;
        expect(interaction2Current?.data.sourceId).toBe('base_haunted_house_al9000');

        // 6. 关键验证：第二个交互的选项中不应该包含 h1（已被弃掉）
        const options2 = (interaction2Current?.data as any).options;
        expect(options2.length).toBe(2); // 只剩 h2 和 h3
        expect(options2.some((o: any) => o.value?.cardUid === 'h1')).toBe(false);
        expect(options2.some((o: any) => o.value?.cardUid === 'h2')).toBe(true);
        expect(options2.some((o: any) => o.value?.cardUid === 'h3')).toBe(true);

        // 7. 选择弃掉 h2
        const discardH2Option = options2.find((o: any) => o.value?.cardUid === 'h2');
        const r3 = runner.run({
            name: '鬼屋弃牌选择 h2',
            commands: [
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: discardH2Option.id },
                },
            ],
            initialState: r2.finalState,
        });

        expect(r3.steps[0]?.success).toBe(true);

        // 8. 最终验证：h1 和 h2 都在弃牌堆，h3 仍在手牌
        const p0Final = r3.finalState.core.players['0'];
        expect(p0Final.hand.length).toBe(1);
        expect(p0Final.hand[0].uid).toBe('h3');
        expect(p0Final.discard.length).toBe(2);
        expect(p0Final.discard.some((c: CardInstance) => c.uid === 'h1')).toBe(true);
        expect(p0Final.discard.some((c: CardInstance) => c.uid === 'h2')).toBe(true);
    });

    it('幽灵跳过弃牌，鬼屋仍然可以看到完整手牌', () => {
        const core = makeState({
            players: {
                '0': {
                    deck: [],
                    hand: [
                        makeCard('ghost1', 'ghost_ghost', 'minion', '0'),
                        makeCard('h1', 'test_card_a', 'action', '0'),
                        makeCard('h2', 'test_card_b', 'action', '0'),
                    ],
                    discard: [],
                    vp: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
                '1': {
                    deck: [],
                    hand: [],
                    discard: [],
                    vp: 0,
                    minionLimit: 1,
                    actionLimit: 1,
                    minionsPlayed: 0,
                    actionsPlayed: 0,
                },
            },
        });

        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        // 1. 打出幽灵
        const r1 = runner.run({
            name: '打出幽灵',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: { cardUid: 'ghost1', baseIndex: 0 },
                } as SmashUpCommand,
            ],
        });

        // 2. 幽灵弃牌：选择跳过
        const interaction1 = r1.finalState.sys.interaction.current;
        const skipOption = (interaction1?.data as any).options.find((o: any) => o.value?.skip);
        expect(skipOption).toBeDefined();

        const r2 = runner.run({
            name: '幽灵跳过弃牌',
            commands: [
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: skipOption.id },
                },
            ],
            initialState: r1.finalState,
        });

        // 3. 鬼屋弃牌应该看到完整手牌（h1, h2）
        const interaction2 = r2.finalState.sys.interaction.current;
        const options2 = (interaction2?.data as any).options;
        expect(options2.length).toBe(2);
        expect(options2.some((o: any) => o.value?.cardUid === 'h1')).toBe(true);
        expect(options2.some((o: any) => o.value?.cardUid === 'h2')).toBe(true);
    });
});
