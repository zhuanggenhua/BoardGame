import { describe, it, expect } from 'vitest';
import type { MatchState, Command, RandomFn } from '../../types';
import { buildTargetAiHint, createInteractionHintScorer, scoreAiHint } from '../../ai';
import type { AiDecisionContext, AiLegalAction } from '../../ai';
import {
    createInteractionSystem,
    createCompareRollChoice,
    createSimpleChoice,
    INTERACTION_COMMANDS,
} from '../InteractionSystem';
import { createCompareRollChoiceSystem } from '../CompareRollChoiceSystem';
import { createSimpleChoiceSystem } from '../SimpleChoiceSystem';

interface TestCore {
    value: number;
}

const mockRandom: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: () => 1,
    shuffle: (arr) => [...arr],
};

const createTestState = (): MatchState<TestCore> => {
    const current = createSimpleChoice(
        'interaction-current',
        '0',
        '当前选择',
        [{ id: 'a', label: 'A', value: 'a' }],
    );
    const queued = createSimpleChoice(
        'interaction-queued',
        '1',
        '队列选择',
        [{ id: 'b', label: 'B', value: 'b' }],
    );

    return {
        core: { value: 0 },
        sys: {
            interaction: {
                current,
                queue: [queued],
            },
        },
    } as unknown as MatchState<TestCore>;
};

describe('InteractionSystem', () => {
    it('SYS_INTERACTION_CANCEL 应取消当前交互并推进队列', () => {
        const system = createInteractionSystem<TestCore>();
        const state = createTestState();
        const command: Command = {
            type: INTERACTION_COMMANDS.CANCEL,
            playerId: '0',
            payload: {},
            timestamp: 100,
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.state?.sys.interaction.current?.id).toBe('interaction-queued');
        expect(result?.state?.sys.interaction.queue).toHaveLength(0);
        expect(result?.events?.[0]).toMatchObject({
            type: 'SYS_INTERACTION_CANCELLED',
            payload: {
                interactionId: 'interaction-current',
                playerId: '0',
            },
            timestamp: 100,
        });
    });

    it('非交互拥有者无法取消交互', () => {
        const system = createInteractionSystem<TestCore>();
        const state = createTestState();
        const command: Command = {
            type: INTERACTION_COMMANDS.CANCEL,
            playerId: '1',
            payload: {},
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('不是你的交互');
    });

    it('playerView should match player ids even when number/string types differ', () => {
        const system = createInteractionSystem<TestCore>();
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current: createSimpleChoice(
                        'interaction-target-1',
                        '1',
                        'target prompt',
                        [{ id: 'a', label: 'A', value: 'a' }],
                    ),
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;

        const viewForTarget = system.playerView?.(state, 1 as unknown as string) as any;
        expect(viewForTarget?.interaction?.current?.id).toBe('interaction-target-1');
        expect(viewForTarget?.interaction?.isBlocked).toBe(false);

        const viewForOther = system.playerView?.(state, 0 as unknown as string) as any;
        expect(viewForOther?.interaction?.current).toBeUndefined();
        expect(viewForOther?.interaction?.isBlocked).toBe(true);
    });

    it('playerView 应为 optionsGenerator 刷新的同 ID 选项保留卡面元数据', () => {
        const system = createInteractionSystem<TestCore>();
        const interaction = createSimpleChoice(
            'interaction-player-view-refresh',
            '0',
            '查看对手手牌',
            [
                {
                    id: 'card-1',
                    label: '测试卡牌',
                    value: { cardUid: 'card-1', defId: 'test-card-1' },
                    displayMode: 'card' as const,
                },
            ],
        );
        (interaction.data as typeof interaction.data & {
            optionsGenerator?: (state: MatchState<TestCore>) => Array<{ id: string; label: string; value: { cardUid: string } }>;
        }).optionsGenerator = () => [
            {
                id: 'card-1',
                label: '测试卡牌',
                value: { cardUid: 'card-1' },
            },
        ];

        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current: interaction,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;

        const viewForTarget = system.playerView?.(state, '0') as any;
        const option = viewForTarget?.interaction?.current?.data?.options?.[0];

        expect(option?.displayMode).toBe('card');
        expect(option?.value?.defId).toBe('test-card-1');
    });

    it('非 slider simple-choice 允许追加 mergedValue 字段，但不允许覆盖原字段', () => {
        const system = createSimpleChoiceSystem<TestCore>();
        const current = createSimpleChoice(
            'interaction-merge',
            '0',
            '合并扩展值',
            [{ id: 'a', label: 'A', value: { cardUid: 'card-1', defId: 'safe-choice' } }],
        );
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;
        const command: Command = {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                optionId: 'a',
                mergedValue: { baseIndex: 2 },
            },
            timestamp: 100,
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.events?.[0]).toMatchObject({
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                value: {
                    cardUid: 'card-1',
                    defId: 'safe-choice',
                    baseIndex: 2,
                },
            },
        });
    });

    it('非 slider simple-choice 不允许通过 mergedValue 覆盖原字段', () => {
        const system = createSimpleChoiceSystem<TestCore>();
        const current = createSimpleChoice(
            'interaction-merge-protected',
            '0',
            '覆盖保护',
            [{ id: 'a', label: 'A', value: { customId: 'safe-choice', value: 3 } }],
        );
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;
        const command: Command = {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                optionId: 'a',
                mergedValue: { customId: 'forged-choice', value: 999 },
            },
            timestamp: 100,
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(true);
        expect(result?.error).toBe('非法的选择值');
    });

    it('slider simple-choice 只允许覆盖数值字段，保留原选项元数据', () => {
        const system = createSimpleChoiceSystem<TestCore>();
        const current = createSimpleChoice(
            'interaction-slider',
            '0',
            '滑动选择',
            [{ id: 'confirm', label: '确认', value: { customId: 'safe-choice', tokenId: 'safe-token', value: 3, amount: 3 } }],
        );
        (current.data as typeof current.data & { slider?: { confirmLabelKey: string } }).slider = {
            confirmLabelKey: 'choices.confirm',
        };
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;
        const command: Command = {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                optionId: 'confirm',
                mergedValue: { customId: 'forged-choice', tokenId: 'forged-token', value: 2, amount: 2 },
            },
            timestamp: 100,
        };

        const result = system.beforeCommand?.({
            state,
            command,
            events: [],
            random: mockRandom,
            playerIds: ['0'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.events?.[0]).toMatchObject({
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                value: {
                    customId: 'safe-choice',
                    tokenId: 'safe-token',
                    value: 2,
                    amount: 2,
                },
            },
        });
    });

    it('compare-roll-choice 选择分支后应发出 RESOLVED 事件', () => {
        const system = createCompareRollChoiceSystem<TestCore>();
        const current = createCompareRollChoice(
            'interaction-compare-roll',
            '0',
            {
                title: '对比掷骰',
                sourceId: 'duel',
                contestants: [
                    { label: '我方', roll: 6 },
                    { label: '对手', roll: 1 },
                ],
                options: [
                    { id: 'deal-3', label: '造成 3 伤害', value: { customId: 'deal-3', value: 3 } },
                ],
            },
        );
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;

        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.RESPOND,
                playerId: '0',
                payload: { optionId: 'deal-3' },
                timestamp: 100,
            },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.state?.sys.interaction.current).toBeUndefined();
        expect(result?.events?.[0]).toMatchObject({
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                sourceId: 'duel',
                optionId: 'deal-3',
                value: { customId: 'deal-3', value: 3 },
            },
        });
    });

    it('compare-roll-choice 无选项确认时应复用 confirmValue 发出 RESOLVED 事件', () => {
        const system = createCompareRollChoiceSystem<TestCore>();
        const current = createCompareRollChoice(
            'interaction-compare-roll-autoconfirm',
            '0',
            {
                title: '摊到牌面',
                sourceId: 'showdown',
                contestants: [
                    { label: '我方', roll: 6 },
                    { label: '对手', roll: 1 },
                ],
                confirmValue: { customId: 'showdown-win', value: 2 },
            },
        );
        const state: MatchState<TestCore> = {
            core: { value: 0 },
            sys: {
                interaction: {
                    current,
                    queue: [],
                },
            },
        } as unknown as MatchState<TestCore>;

        const result = system.beforeCommand?.({
            state,
            command: {
                type: INTERACTION_COMMANDS.CONFIRM,
                playerId: '0',
                payload: {},
                timestamp: 100,
            },
            events: [],
            random: mockRandom,
            playerIds: ['0', '1'],
        });

        expect(result?.halt).toBe(false);
        expect(result?.events?.[0]).toMatchObject({
            type: 'SYS_INTERACTION_RESOLVED',
            payload: {
                sourceId: 'showdown',
                optionId: null,
                value: { customId: 'showdown-win', value: 2 },
            },
        });
    });

    it('buildTargetAiHint 会为 inspect 目标推导 relation / intent / target tags', () => {
        const hint = buildTargetAiHint({
            actorPlayerId: '0',
            targetPlayerId: '1',
            effectIntent: 'inspect',
            targetKind: 'player',
        });

        expect(hint.relationToActor).toBe('enemy');
        expect(hint.effectIntent).toBe('inspect');
        expect(hint.targetKind).toBe('player');
        expect(hint.tags).toEqual(expect.arrayContaining([
            'target:player',
            'relation:enemy',
            'intent:inspect',
        ]));
    });

    it('buildTargetAiHint 会以 target/actor 推导 relation，而不是接受外部覆盖', () => {
        const hint = buildTargetAiHint({
            actorPlayerId: '0',
            targetPlayerId: '2',
            relationToActor: 'ally',
            effectIntent: 'buff',
            targetKind: 'player',
        });

        expect(hint.relationToActor).toBe('enemy');
        expect(hint.tags).toEqual(expect.arrayContaining([
            'relation:enemy',
            'intent:buff',
        ]));
    });

    it('inspect 语义评分会优先侦察敌方而不是己方', () => {
        const enemyHint = buildTargetAiHint({
            actorPlayerId: '0',
            targetPlayerId: '1',
            effectIntent: 'inspect',
            targetKind: 'player',
        });
        const selfHint = buildTargetAiHint({
            actorPlayerId: '0',
            targetPlayerId: '0',
            effectIntent: 'inspect',
            targetKind: 'player',
        });

        expect(scoreAiHint(enemyHint)).toBeGreaterThan(scoreAiHint(selfHint));
    });

    it('createInteractionHintScorer 会在玩家目标交互中优先选择敌方 inspect 目标', () => {
        const scorer = createInteractionHintScorer({ id: 'interaction-inspect' });
        const legalActions: AiLegalAction[] = [
            {
                actionId: 'inspect-self',
                kind: 'interaction-choice',
                label: '查看自己',
                commands: [],
                aiHints: [buildTargetAiHint({
                    actorPlayerId: '0',
                    targetPlayerId: '0',
                    effectIntent: 'inspect',
                    targetKind: 'player',
                })],
            },
            {
                actionId: 'inspect-enemy',
                kind: 'interaction-choice',
                label: '查看对手',
                commands: [],
                aiHints: [buildTargetAiHint({
                    actorPlayerId: '0',
                    targetPlayerId: '1',
                    effectIntent: 'inspect',
                    targetKind: 'player',
                })],
            },
        ];
        const context: AiDecisionContext = {
            gameId: 'test',
            matchId: 'test-match',
            playerId: '0',
            visibleState: createTestState(),
            interaction: null,
            responseWindow: null,
            legalActions,
            rulesVersion: null,
            decisionBudgetMs: 100,
            source: 'local',
            difficulty: {
                level: 'expert',
                searchDepth: 1,
                shortlistSize: 4,
                simulationBudgetMs: 50,
                randomness: 0,
                beliefSampleCount: 1,
                evaluatorProfile: 'expert',
            },
        };

        const selfScore = scorer.score(context, legalActions[0]);
        const enemyScore = scorer.score(context, legalActions[1]);

        expect((enemyScore as { score: number }).score).toBeGreaterThan((selfScore as { score: number }).score);
    });
});
