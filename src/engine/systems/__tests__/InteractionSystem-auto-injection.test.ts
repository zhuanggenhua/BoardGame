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
    createInteractionSystem,
    createSimpleChoice,
    queueInteraction,
    resolveInteraction,
    refreshInteractionOptions,
} from '../InteractionSystem';
import { createSimpleChoiceSystem } from '../SimpleChoiceSystem';
import type { MatchState } from '../../types';

interface TestCore {
    players: {
        [playerId: string]: {
            hand: Array<{ uid: string; defId: string }>;
        };
    };
}

const dummyRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(array: T[]) => array,
};

describe('InteractionSystem - 通用刷新', () => {
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

        // 验证：应该保持原始选项（因为过滤后只剩 1 个，无法满足 min=2）
        const currentInteraction = state.sys.interaction.current;
        const options = (currentInteraction?.data as any).options || [];
        expect(options).toHaveLength(3); // 保持原始的 3 个选项
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
