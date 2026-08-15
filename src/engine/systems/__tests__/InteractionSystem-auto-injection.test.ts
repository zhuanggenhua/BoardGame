/**
 * InteractionSystem 通用刷新单元测试
 * 
 * 测试场景：
 * 1. refreshInteractionOptions 自动检测选项类型（cardUid/minionUid/baseIndex）
 * 2. 基于最新状态过滤选项（只保留仍然有效的选项）
 * 3. 连续交互时，后续交互看到的是最新的状态
 * 4. 智能处理 multi.min 限制（降级）
 */

import { describe, it, expect } from 'vitest';
import {
    INTERACTION_COMMANDS,
    INTERACTION_EVENTS,
    getCurrentTrackedCardTopSnapshot,
    getCurrentTrackedIdTopSnapshot,
    createSimpleChoice,
    queueInteraction,
    resolveInteraction,
    refreshInteractionOptions,
} from '../InteractionSystem';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
    getActiveResolutionOwner,
    getResolutionFrameById,
    pushResolutionFrame,
    setResolutionFrameDeferredPayload,
    upsertActiveResolutionFrame,
} from '../resolutionStack';
import { createSimpleChoiceSystem } from '../SimpleChoiceSystem';
import type { MatchState } from '../../types';

interface TestCore {
    players: {
        [playerId: string]: {
            hand: Array<{ uid: string; defId: string }>;
        };
    };
    bases?: Array<{
        buriedCards?: Array<{ uid: string; defId: string; controllerId?: string }>;
    }>;
}

const dummyRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(array: T[]) => array,
};

describe('InteractionSystem - 通用刷新', () => {
    it('decisionEpoch 只应在当前决策面变化时递增', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                decisionEpoch: 0,
                interaction: { queue: [] },
            },
        } as any;

        state = queueInteraction(state, createSimpleChoice(
            'interaction-1',
            'p1',
            '第一步',
            [{ id: 'a', label: 'A', value: { id: 'a' } }],
            { sourceId: 'step-1' },
        ));
        expect(state.sys.decisionEpoch).toBe(1);

        state = queueInteraction(state, createSimpleChoice(
            'interaction-2',
            'p1',
            '第二步',
            [{ id: 'b', label: 'B', value: { id: 'b' } }],
            { sourceId: 'step-2' },
        ));
        expect(state.sys.decisionEpoch).toBe(1);

        state = resolveInteraction(state);
        expect(state.sys.interaction.current?.id).toBe('interaction-2');
        expect(state.sys.decisionEpoch).toBe(2);
    });

    it('refreshInteractionOptions 在同一 interaction id 下刷新选项时应递增 decisionEpoch', () => {
        const state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-2', defId: 'card-2' },
                        ],
                    },
                },
            },
            sys: {
                decisionEpoch: 4,
                interaction: {
                    current: createSimpleChoice(
                        'interaction-refresh',
                        'p1',
                        '刷新',
                        [
                            { id: 'card-1', label: 'Card 1', value: { cardUid: 'card-1' } },
                            { id: 'card-2', label: 'Card 2', value: { cardUid: 'card-2' } },
                        ],
                        { sourceId: 'refresh-test', autoRefresh: 'hand' },
                    ),
                    queue: [],
                },
            },
        } as any;

        const refreshed = refreshInteractionOptions(state);
        const refreshedOptions = ((refreshed.sys.interaction.current?.data as any)?.options ?? []).map((option: { id: string }) => option.id);

        expect(refreshedOptions).toEqual(['card-2']);
        expect(refreshed.sys.decisionEpoch).toBe(5);
    });

    it('queueInteraction / resolveInteraction 应同步 active resolution frame 的 interaction blocker', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        state = upsertActiveResolutionFrame(state, {
            id: 'frame-1',
            kind: 'test:resolution',
            ordering: 'explicit',
            status: 'running',
            phase: 'phase1',
            phaseGate: 'block-advance-when-blocked',
        });

        state = queueInteraction(state, createSimpleChoice(
            'interaction-1',
            'p1',
            '测试交互',
            [{ id: 'ok', label: '确定', value: { ok: true } }],
            { sourceId: 'test' },
        ));

        expect(getActiveResolutionFrame(state)).toMatchObject({
            id: 'frame-1',
            status: 'blocked',
            blockedBy: {
                type: 'interaction',
                id: 'interaction-1',
            },
        });

        state = resolveInteraction(state);

        expect(getActiveResolutionFrame(state)).toMatchObject({
            id: 'frame-1',
            status: 'running',
            blockedBy: undefined,
        });
    });

    it('pushResolutionFrame / completeResolutionFrame 应在子 frame 完成后恢复父 frame', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        state = upsertActiveResolutionFrame(state, {
            id: 'parent-frame',
            kind: 'test:scoring-frame',
            ordering: 'explicit-order',
            status: 'running',
            phase: 'scoreBases',
            phaseGate: 'block-advance-when-blocked',
        });

        state = pushResolutionFrame(state, {
            id: 'child-frame',
            kind: 'test:after-scoring',
            ordering: 'nested-body',
            status: 'running',
            phase: 'scoreBases',
            phaseGate: 'block-advance-when-blocked',
        });

        expect(getActiveResolutionFrame(state)).toMatchObject({
            id: 'child-frame',
            parentFrameId: 'parent-frame',
        });
        expect(getResolutionFrameById(state, 'parent-frame')).toMatchObject({
            status: 'suspended',
            blockedBy: {
                type: 'child-frame',
                id: 'child-frame',
            },
        });

        state = completeResolutionFrame(state, 'child-frame');

        expect(getActiveResolutionFrame(state)).toMatchObject({
            id: 'parent-frame',
            status: 'running',
            blockedBy: undefined,
            suspendedByFrameId: undefined,
        });
        expect(getResolutionFrameById(state, 'child-frame')).toBeUndefined();
    });

    it('resolution frame 应持有 deferred payload，且子 frame 完成不应丢失父 frame payload', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        state = upsertActiveResolutionFrame(state, {
            id: 'parent-frame',
            kind: 'test:scoring-frame',
            ordering: 'explicit-order',
            status: 'running',
            phase: 'scoreBases',
            phaseGate: 'block-advance-when-blocked',
        });
        state = setResolutionFrameDeferredPayload(state, 'parent-frame', {
            deferredEvents: [{ type: 'A', payload: { ok: true }, timestamp: 1 }],
            deferredActions: [{ kind: 'follow-up' }],
        });
        state = pushResolutionFrame(state, {
            id: 'child-frame',
            kind: 'test:reaction',
            ordering: 'nested-body',
            status: 'running',
            phase: 'scoreBases',
            phaseGate: 'block-advance-when-blocked',
        });

        state = completeResolutionFrame(state, 'child-frame');

        expect(getResolutionFrameById(state, 'parent-frame')).toMatchObject({
            deferredEvents: [{ type: 'A', payload: { ok: true }, timestamp: 1 }],
            deferredActions: [{ kind: 'follow-up' }],
        });
    });

    it('交互阻塞 active resolution frame 时应同步 foreground owner，并在交互结束后清空', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        state = upsertActiveResolutionFrame(state, {
            id: 'frame-owner-test',
            kind: 'test:choice',
            ordering: 'explicit-order',
            status: 'running',
            ownerGame: 'test-game',
            phase: 'main',
            phaseGate: 'block-advance-when-blocked',
        });

        state = queueInteraction(state, createSimpleChoice(
            'interaction-owner-test',
            'p1',
            '选择',
            [{ id: 'ok', label: '确定', value: { ok: true } }],
            { sourceId: 'owner-test' },
        ));

        expect(getActiveResolutionOwner(state)).toEqual({
            system: 'interaction',
            id: 'interaction-owner-test',
            kind: 'simple-choice',
            gameId: 'test-game',
            resolutionFrameId: 'frame-owner-test',
            blocksProgress: true,
        });

        state = resolveInteraction(state);

        expect(getActiveResolutionOwner(state)).toBeUndefined();
    });

    it('getCurrentTrackedCardTopSnapshot 只应保留当前仍连续位于顶部的揭示牌', () => {
        const snapshot = getCurrentTrackedCardTopSnapshot(
            [
                { uid: 'intrude', defId: 'x' },
                { uid: 'card-1', defId: 'a' },
                { uid: 'card-2', defId: 'b' },
            ],
            [
                { uid: 'card-1', defId: 'a', tag: 'tracked-1' },
                { uid: 'card-2', defId: 'b', tag: 'tracked-2' },
            ],
        );

        expect(snapshot).toEqual([]);
    });

    it('getCurrentTrackedCardTopSnapshot 应按当前顶部顺序返回仍属于原揭示集合的连续块', () => {
        const snapshot = getCurrentTrackedCardTopSnapshot(
            [
                { uid: 'card-2', defId: 'b' },
                { uid: 'card-1', defId: 'a' },
                { uid: 'rest', defId: 'z' },
            ],
            [
                { uid: 'card-1', defId: 'a', tag: 'tracked-1' },
                { uid: 'card-2', defId: 'b', tag: 'tracked-2' },
            ],
        );

        expect(snapshot).toEqual([
            { uid: 'card-2', defId: 'b', tag: 'tracked-2' },
            { uid: 'card-1', defId: 'a', tag: 'tracked-1' },
        ]);
    });

    it('getCurrentTrackedCardTopSnapshot 遇到同 uid 但 defId 变化时不应复用旧揭示牌', () => {
        const snapshot = getCurrentTrackedCardTopSnapshot(
            [
                { uid: 'card-1', defId: 'replacement' },
                { uid: 'card-2', defId: 'b' },
            ],
            [
                { uid: 'card-1', defId: 'a', tag: 'tracked-1' },
                { uid: 'card-2', defId: 'b', tag: 'tracked-2' },
            ],
        );

        expect(snapshot).toEqual([]);
    });

    it('getCurrentTrackedIdTopSnapshot 只应保留当前仍连续位于顶部的字符串快照', () => {
        const snapshot = getCurrentTrackedIdTopSnapshot(
            ['base-a', 'base-b', 'base-c'],
            ['base-a', 'base-b', 'base-x'],
        );

        expect(snapshot).toEqual(['base-a', 'base-b']);
    });

    it('应该自动检测选项中的 cardUid 字段并刷新选项', () => {
        // 1. 创建初始状态：玩家有 3 张手牌
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                            { uid: 'card-3', defId: 'test-card-3' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 2. 创建包含 cardUid 的交互（声明 autoRefresh: 'hand'）
        const interaction = createSimpleChoice(
            'test-interaction',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3', defId: 'test-card-3' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        // 3. 将交互加入队列
        state = queueInteraction(state, interaction);

        // 4. 模拟弃掉 card-2
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-3', defId: 'test-card-3' },
                        ],
                    },
                },
            },
        };

        // 5. 调用 refreshInteractionOptions（通用刷新）
        state = refreshInteractionOptions(state);

        // 6. 验证：选项应该只包含 card-1 和 card-3（card-2 已被弃掉）
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        const cardUids = options.map((opt: any) => opt.value?.cardUid).filter(Boolean);

        expect(cardUids).toHaveLength(2);
        expect(cardUids).toContain('card-1');
        expect(cardUids).toContain('card-3');
        expect(cardUids).not.toContain('card-2');
    });

    it('连续交互时，第二个交互应该看到最新的手牌状态', () => {
        // 1. 创建初始状态：玩家有 3 张手牌
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                            { uid: 'card-3', defId: 'test-card-3' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 2. 创建第一个交互（声明 autoRefresh: 'hand'）
        const interaction1 = createSimpleChoice(
            'interaction-1',
            'p1',
            '第一次选择',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3', defId: 'test-card-3' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        // 3. 创建第二个交互（使用相同的初始选项，声明 autoRefresh: 'hand'）
        const interaction2 = createSimpleChoice(
            'interaction-2',
            'p1',
            '第二次选择',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3', defId: 'test-card-3' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        // 4. 将两个交互加入队列
        state = queueInteraction(state, interaction1);
        state = queueInteraction(state, interaction2);

        // 5. 模拟第一次交互完成：弃掉 card-2
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-3', defId: 'test-card-3' },
                        ],
                    },
                },
            },
        };

        // 6. 解决第一个交互，弹出第二个交互
        state = resolveInteraction(state);

        // 7. 验证：第二个交互的选项应该只包含 card-1 和 card-3（card-2 已被弃掉）
        const currentInteraction = state.sys.interaction.current;
        expect(currentInteraction).toBeTruthy();
        expect(currentInteraction?.id).toBe('interaction-2');

        const options = (currentInteraction?.data as any).options || [];
        const cardUids = options.map((opt: any) => opt.value?.cardUid).filter(Boolean);

        expect(cardUids).toHaveLength(2);
        expect(cardUids).toContain('card-1');
        expect(cardUids).toContain('card-3');
        expect(cardUids).not.toContain('card-2'); // card-2 已被弃掉
    });

    it('不包含引用字段的交互不应该被过滤', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 创建不包含 cardUid 的交互
        const interaction = createSimpleChoice(
            'test-interaction',
            'p1',
            '选择一个选项',
            [
                { id: 'opt-1', label: '选项 1', value: { action: 'action-1' } },
                { id: 'opt-2', label: '选项 2', value: { action: 'action-2' } },
            ],
        );

        state = queueInteraction(state, interaction);

        // 调用 refreshInteractionOptions
        state = refreshInteractionOptions(state);

        // 验证：选项应该保持不变（因为不包含引用字段）
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(2);
    });

    it('手动提供的 optionsGenerator 应该优先使用', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 创建带有手动 optionsGenerator 的交互
        const customGenerator = () => [
            { id: 'custom', label: 'Custom Option', value: { custom: true } },
        ];

        const interaction = createSimpleChoice(
            'test-interaction',
            'p1',
            '选择',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
            ],
        );

        // 手动注入 optionsGenerator
        (interaction.data as any).optionsGenerator = customGenerator;

        state = queueInteraction(state, interaction);

        // 调用 refreshInteractionOptions
        state = refreshInteractionOptions(state);

        // 验证：应该使用手动提供的 optionsGenerator
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(1);
        expect(options[0].id).toBe('custom');
    });

    it('refreshInteractionOptions 应为同 ID 选项保留原始卡面元数据', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'test-renderable-metadata-refresh',
            'p1',
            '选择一张卡牌',
            [
                {
                    id: 'card-1',
                    label: '卡牌 1',
                    value: { cardUid: 'card-1', defId: 'test-card-1' },
                    displayMode: 'card' as const,
                },
            ],
            { sourceId: 'test' },
        );

        (interaction.data as any).optionsGenerator = () => [
            {
                id: 'card-1',
                label: '卡牌 1',
                value: { cardUid: 'card-1' },
            },
        ];

        state = queueInteraction(state, interaction);
        state = refreshInteractionOptions(state);

        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(1);
        expect(options[0].displayMode).toBe('card');
        expect(options[0].value.defId).toBe('test-card-1');
    });

    it('选项中包含非卡牌选项（如 skip）时，应该保留这些选项', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 创建第一个交互（声明 autoRefresh: 'hand'）
        const interaction1 = createSimpleChoice(
            'interaction-1',
            'p1',
            '第一次选择',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        // 创建第二个交互（包含 skip 选项，声明 autoRefresh: 'hand'）
        const interaction2 = createSimpleChoice(
            'interaction-2',
            'p1',
            '选择一张卡牌或跳过',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'skip', label: '跳过', value: { skip: true } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        // 将两个交互加入队列
        state = queueInteraction(state, interaction1);
        state = queueInteraction(state, interaction2);

        // 模拟第一次交互完成：弃掉 card-1
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
        };

        // 解决第一个交互，弹出第二个交互
        state = resolveInteraction(state);

        // 验证：skip 选项应该被保留
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];

        expect(options).toHaveLength(2); // card-2 + skip
        expect(options.some((opt: any) => opt.value?.skip === true)).toBe(true);
        expect(options.some((opt: any) => opt.value?.cardUid === 'card-2')).toBe(true);
        expect(options.some((opt: any) => opt.value?.cardUid === 'card-1')).toBe(false);
    });

    it('多选交互且 min > 0 时，过滤后无法满足 min 应该保持原始选项', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                            { uid: 'card-3', defId: 'test-card-3' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 创建多选交互（min=2, max=2，声明 autoRefresh: 'hand'）
        const interaction = createSimpleChoice(
            'multi-select',
            'p1',
            '选择 2 张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
                { id: 'opt-3', label: '卡牌 3', value: { cardUid: 'card-3', defId: 'test-card-3' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand', multi: { min: 2, max: 2 } },
        );

        state = queueInteraction(state, interaction);

        // 模拟弃掉 2 张卡牌，只剩 1 张
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                        ],
                    },
                },
            },
        };

        // 调用 refreshInteractionOptions
        state = refreshInteractionOptions(state);

        // 验证：现在应把“min 无法满足”正规化成“剩余有效选项 + emergency skip”
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(2);
        expect(options.map((option: any) => option.id)).toEqual(['opt-1', '__emergency_skip__']);
    });

    it('required 单选在动态刷新后变成空数组时，应自动注入紧急跳过选项', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'required-empty-after-refresh',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [],
                    },
                },
            },
        };

        state = refreshInteractionOptions(state);

        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(1);
        expect(options[0].id).toBe('__emergency_skip__');
        expect(options[0].value.__emergency_skip__).toBe(true);
    });

    it('紧急跳过选项应该在刷新时被保留', () => {
        // 测试场景：当 createSimpleChoice 创建了空选项交互时，会自动添加紧急跳过选项
        // 刷新时应该保留这个选项（类似 __cancel__）
        
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        // 创建一个包含紧急跳过选项的交互
        const interaction = createSimpleChoice(
            'test-emergency',
            'p1',
            '测试紧急跳过',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1' } },
                { id: '__emergency_skip__', label: '跳过（无可用选项）', value: { __emergency_skip__: true } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' }
        );

        state = queueInteraction(state, interaction);

        // 模拟状态变更：卡牌被弃掉
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [], // 手牌清空
                    },
                },
            },
        };

        // 刷新选项
        state = refreshInteractionOptions(state);

        // 验证：紧急跳过选项应该被保留
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];

        expect(options).toHaveLength(1); // 只剩紧急跳过选项
        expect(options[0].id).toBe('__emergency_skip__');
        expect(options[0].value.__emergency_skip__).toBe(true);
    });

    it('createSimpleChoice 遇到全部选项 disabled 时，应自动追加 emergency skip', () => {
        const interaction = createSimpleChoice(
            'all-disabled-choice',
            'p1',
            '测试全部不可选',
            [{
                id: 'disabled-only',
                label: '唯一目标',
                value: { targetId: 'm-1' },
                disabled: true,
            }],
            { sourceId: 'all-disabled-choice' },
        );

        const options = (interaction.data as any).options ?? [];
        expect(options).toHaveLength(2);
        expect(options.some((option: any) => option.id === '__emergency_skip__')).toBe(true);
        const emergencyOption = options.find((option: any) => option.id === '__emergency_skip__');
        expect(emergencyOption?.value?.__emergency_skip__).toBe(true);
        expect(emergencyOption?.value?.__emergency_skip_reason__).toBe('all-options-disabled');
    });

    it('刷新后若 enabled 选项数量不足 multi.min，应自动追加 emergency skip', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'min-unreachable-choice',
            'p1',
            '测试最少选择数不可达',
            [
                { id: 'card-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'card-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'min-unreachable-choice', autoRefresh: 'hand', multi: { min: 2, max: 2 } },
        );

        state = queueInteraction(state, interaction);
        state = refreshInteractionOptions(state);

        const options = (state.sys.interaction.current?.data as any)?.options ?? [];
        expect(options.some((option: any) => option.id === '__emergency_skip__')).toBe(true);
        const emergencyOption = options.find((option: any) => option.id === '__emergency_skip__');
        expect(emergencyOption?.value?.__emergency_skip_reason__).toBe('min-selection-unreachable');
    });

    it('未声明 live 响应校验时保持原有快照响应行为', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'respond-with-snapshot',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                    },
                },
            },
        };

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'opt-2' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.events).toHaveLength(1);
        expect(result?.events?.[0].type).toBe(INTERACTION_EVENTS.RESOLVED);
        expect((result?.events?.[0] as any).payload.optionId).toBe('opt-2');
    });

    it('responseValidationMode 为 live 时应拒绝已失效的响应选项', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'respond-with-revalidation',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                    },
                },
            },
        };

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'opt-2' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('无效的选择');
    });

    it('responseValidationMode 为 live 时，RESOLVED 事件仍应保留原始 interactionData 快照', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'respond-with-live-snapshot',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                    },
                },
            },
        };

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'opt-1' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.events?.[0].type).toBe(INTERACTION_EVENTS.RESOLVED);
        expect(((result?.events?.[0] as any)?.payload?.interactionData?.options ?? []).map((option: any) => option.id))
            .toEqual(['opt-1', 'opt-2']);
    });

    it('autoRefresh=buried 时，后续交互弹出应剔除已失效的埋葬牌选项', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
                bases: [{
                    buriedCards: [
                        { uid: 'buried-1', defId: 'card-1', controllerId: 'p1' },
                        { uid: 'buried-2', defId: 'card-2', controllerId: 'p1' },
                    ],
                }],
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const current = createSimpleChoice(
            'interaction-current',
            'p1',
            '当前步骤',
            [{ id: 'skip', label: '跳过', value: { skip: true } }],
        );
        const queued = createSimpleChoice(
            'interaction-buried',
            'p1',
            '选择埋葬牌',
            [
                { id: 'buried-1', label: '埋葬牌 1', value: { cardUid: 'buried-1', baseIndex: 0, defId: 'card-1' } },
                { id: 'buried-2', label: '埋葬牌 2', value: { cardUid: 'buried-2', baseIndex: 0, defId: 'card-2' } },
            ],
            { sourceId: 'test-buried', autoRefresh: 'buried', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, current);
        state = queueInteraction(state, queued);
        state = {
            ...state,
            core: {
                ...state.core,
                bases: [{
                    buriedCards: [{ uid: 'buried-1', defId: 'card-1', controllerId: 'p1' }],
                }],
            },
        };

        state = resolveInteraction(state);

        const options = (state.sys.interaction.current?.data as any)?.options ?? [];
        expect(options.map((option: any) => option.value?.cardUid)).toEqual(['buried-1']);
    });

    it('autoRefresh=buried 且 live 校验时，应拒绝已被移除的埋葬牌响应', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: { hand: [] },
                },
                bases: [{
                    buriedCards: [{ uid: 'buried-1', defId: 'card-1', controllerId: 'p1' }],
                }],
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'respond-with-buried-live',
            'p1',
            '选择埋葬牌',
            [
                { id: 'buried-1', label: '埋葬牌 1', value: { cardUid: 'buried-1', baseIndex: 0, defId: 'card-1' } },
                { id: 'buried-2', label: '埋葬牌 2', value: { cardUid: 'buried-2', baseIndex: 0, defId: 'card-2' } },
            ],
            { sourceId: 'test-buried', autoRefresh: 'buried', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                bases: [{
                    buriedCards: [{ uid: 'buried-1', defId: 'card-1', controllerId: 'p1' }],
                }],
            },
        };

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'buried-2' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('无效的选择');
    });

    it('autoRefresh=discard 时，应保留弃牌堆中仍存在同名分组选项并剔除失效分组', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [],
                        discard: [{ uid: 'discard-a', defId: 'minion-a' }],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'discard-defid-refresh',
            'p1',
            '选择弃牌堆中的分组',
            [
                { id: 'group-a', label: 'A', value: { defId: 'minion-a' } },
                { id: 'group-b', label: 'B', value: { defId: 'minion-b' } },
            ],
            { sourceId: 'discard-defid-refresh', autoRefresh: 'discard', responseValidationMode: 'live' },
        );

        const current = createSimpleChoice(
            'discard-placeholder',
            'p1',
            '占位',
            [{ id: 'skip', label: '跳过', value: { skip: true } }],
        );
        state = queueInteraction(state, current);
        state = queueInteraction(state, interaction);
        state = resolveInteraction(state);

        const options = (state.sys.interaction.current?.data as any)?.options ?? [];
        expect(options.map((option: any) => option.id)).toEqual(['group-a']);
    });

    it('autoRefresh=hand_or_discard 且 live 校验时，应拒绝已离开指定来源区域的响应', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [],
                        discard: [{ uid: 'discard-1', defId: 'card-1' }],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'mixed-refresh',
            'p1',
            '选择手牌或弃牌堆中的卡',
            [
                { id: 'discard-1', label: '弃牌', value: { cardUid: 'discard-1', zone: 'discard', defId: 'card-1' } },
                { id: 'hand-1', label: '手牌', value: { cardUid: 'hand-1', zone: 'hand', defId: 'card-2' } },
            ],
            { sourceId: 'mixed-refresh', autoRefresh: 'hand_or_discard', responseValidationMode: 'live' },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    ...state.core.players,
                    p1: {
                        ...state.core.players.p1,
                        discard: [],
                        hand: [{ uid: 'discard-1', defId: 'card-1' }],
                    },
                },
            },
        } as any;

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'discard-1' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('无效的选择');
    });

    it('紧急跳过选项被响应时，应取消交互而不是报无效选择', () => {
        const state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [],
                    },
                },
            },
            sys: {
                interaction: {
                    current: {
                        id: 'required-empty-live',
                        playerId: 'p1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'test',
                            options: [
                                { id: '__emergency_skip__', label: '跳过（无可用选项）', value: { __emergency_skip__: true } },
                            ],
                            responseValidationMode: 'live',
                            autoRefresh: 'hand',
                        },
                    },
                    queue: [],
                },
            },
        } as any;

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: '__emergency_skip__' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.state?.sys.interaction.current).toBeUndefined();
        expect(result?.events?.[0].type).toBe(INTERACTION_EVENTS.CANCELLED);
        expect((result?.events?.[0] as any)?.payload?.reason).toBe('empty-options');
    });

    it('旧字段 revalidateOnRespond 仍兼容映射到 live 语义', () => {
        let state: MatchState<TestCore> = {
            core: {
                players: {
                    p1: {
                        hand: [
                            { uid: 'card-1', defId: 'test-card-1' },
                            { uid: 'card-2', defId: 'test-card-2' },
                        ],
                    },
                },
            },
            sys: {
                interaction: { queue: [] },
            },
        } as any;

        const interaction = createSimpleChoice(
            'respond-with-legacy-live-flag',
            'p1',
            '选择一张卡牌',
            [
                { id: 'opt-1', label: '卡牌 1', value: { cardUid: 'card-1', defId: 'test-card-1' } },
                { id: 'opt-2', label: '卡牌 2', value: { cardUid: 'card-2', defId: 'test-card-2' } },
            ],
            { sourceId: 'test', autoRefresh: 'hand', revalidateOnRespond: true },
        );

        state = queueInteraction(state, interaction);
        state = {
            ...state,
            core: {
                ...state.core,
                players: {
                    p1: {
                        hand: [{ uid: 'card-1', defId: 'test-card-1' }],
                    },
                },
            },
        };

        const system = createSimpleChoiceSystem<TestCore>();
        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: 'p1',
                payload: { optionId: 'opt-2' },
            } as any,
            events: [],
            random: dummyRandom as any,
            playerIds: ['p1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('无效的选择');
    });
});
