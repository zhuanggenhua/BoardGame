import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { injectTutorialInteractionId } from '../tutorialAiCommand';

type TestCore = { activePlayerId: string };
type TestInteraction = {
    id: string;
    playerId: string;
    kind?: string;
    data?: unknown;
};

const createState = (interaction?: TestInteraction): MatchState<TestCore> => ({
    core: { activePlayerId: '0' },
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: interaction
            ? { current: interaction, queue: [], isBlocked: false }
            : { queue: [] },
        log: { entries: [], maxEntries: 0 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: { current: undefined },
        tutorial: {
            active: true,
            stepIndex: 0,
            steps: [],
            step: null,
            allowManualSkip: false,
            pendingAnimationAdvance: false,
        },
        turnNumber: 1,
        phase: 'main1',
    },
});

describe('injectTutorialInteractionId', () => {
    it('教程 AI 的交互命令缺少 interactionId 时，应补当前交互 id', () => {
        const payload = injectTutorialInteractionId({
            state: createState({ id: 'tutorial-choice-1', playerId: '1' }),
            commandType: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
            tutorialPlayerId: '1',
            isTutorialAiCommand: true,
        });

        expect(payload).toEqual({
            interactionId: 'tutorial-choice-1',
            optionId: 'skip',
        });
    });

    it('教程 AI 命令若已显式带 interactionId，不应覆盖原值', () => {
        const payload = injectTutorialInteractionId({
            state: createState({ id: 'tutorial-choice-1', playerId: '1' }),
            commandType: 'SYS_INTERACTION_CANCEL',
            payload: { interactionId: 'explicit-id', reason: 'skip' },
            tutorialPlayerId: '1',
            isTutorialAiCommand: true,
        });

        expect(payload).toEqual({
            interactionId: 'explicit-id',
            reason: 'skip',
        });
    });

    it('当前交互不属于教程 AI 指定玩家时，不应误补别人的 interactionId', () => {
        const payload = injectTutorialInteractionId({
            state: createState({ id: 'tutorial-choice-1', playerId: '0' }),
            commandType: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
            tutorialPlayerId: '1',
            isTutorialAiCommand: true,
        });

        expect(payload).toEqual({ optionId: 'skip' });
    });

    it('教程 AI 可从当前 ChoiceRequest 候选补全正式命令 payload', () => {
        const payload = injectTutorialInteractionId({
            state: createState({
                id: 'dt-token-response-damage-1',
                playerId: '0',
                kind: 'dt:token-response',
                data: {
                    choiceRequestContract: {
                        requestId: 'choice-1',
                        playerId: '0',
                        kind: 'optional-skip',
                        selection: { min: 0, max: 1 },
                        resolution: { type: 'candidate-commands' },
                        candidates: [{
                            id: 'skip',
                            commands: [{
                                type: 'SKIP_TOKEN_RESPONSE',
                                payload: { pendingDamageId: 'damage-1' },
                            }],
                        }],
                    },
                },
            }),
            commandType: 'SKIP_TOKEN_RESPONSE',
            payload: {
                __tutorialChoiceCandidateId: 'skip',
                pendingDamageId: 'stale-script-value',
            },
            tutorialPlayerId: '0',
            isTutorialAiCommand: true,
        });

        expect(payload).toEqual({ pendingDamageId: 'damage-1' });
    });

    it('教程 AI 指向不存在的 ChoiceRequest 候选时应暴露合同错误', () => {
        expect(() => injectTutorialInteractionId({
            state: createState({
                id: 'dt-token-response-damage-1',
                playerId: '0',
                kind: 'dt:token-response',
                data: {
                    choiceRequestContract: {
                        requestId: 'choice-1',
                        playerId: '0',
                        kind: 'optional-skip',
                        selection: { min: 0, max: 1 },
                        resolution: { type: 'candidate-commands' },
                        candidates: [],
                    },
                },
            }),
            commandType: 'SKIP_TOKEN_RESPONSE',
            payload: { __tutorialChoiceCandidateId: 'skip' },
            tutorialPlayerId: '0',
            isTutorialAiCommand: true,
        })).toThrow('教程 AI 候选 skip 不属于当前可用 ChoiceRequest');
    });
});
