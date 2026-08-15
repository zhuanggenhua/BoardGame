import { describe, expect, it } from 'vitest';
import { createSimpleChoice } from '../../systems/InteractionSystem';
import type { MatchState } from '../../types';
import {
    buildAiOwnedBlockingInteractionFallbackActions,
    diagnoseAiOwnedBlockingInteraction,
} from '../diagnostics';
import { extractAiInteractionSnapshot } from '../snapshots';
import type { AiLegalAction } from '../types';

const createStateWithInteraction = (current: unknown): MatchState<unknown> => ({
    core: {},
    ctx: {
        currentPlayer: '0',
        turn: 1,
        phase: 'main',
    },
    log: [],
    undoStack: [],
    redoStack: [],
    sys: {
        interaction: {
            current,
            queue: [],
            isBlocked: true,
        },
    },
} as unknown as MatchState<unknown>);

const sampleLegalAction: AiLegalAction = {
    actionId: 'sample',
    kind: 'interaction-choice',
    label: '示例动作',
    commands: [{
        type: 'SYS_INTERACTION_RESPOND',
        payload: { interactionId: 'sample' },
    }],
};

describe('AI interaction semantics', () => {
    it('simple-choice 可暴露 AI 语义，同时保留 UI kind', () => {
        const interaction = createSimpleChoice(
            'choose-target',
            '0',
            '选择目标',
            [
                { id: 'p1', label: '玩家 1', value: { playerId: '1' } },
                { id: 'p2', label: '玩家 2', value: { playerId: '2' } },
            ],
            {
                sourceId: 'test-select-player',
                ai: {
                    status: 'semantic',
                    decisions: [{
                        kind: 'select-player',
                        interactionId: 'choose-target',
                        actorPlayerId: '0',
                        sourceId: 'test-select-player',
                        selection: { min: 1, max: 1 },
                        skipPolicy: 'forbidden',
                        candidates: [
                            { id: 'player:1', playerId: '1', label: '玩家 1' },
                            { id: 'player:2', playerId: '2', label: '玩家 2' },
                        ],
                    }],
                },
            },
        );

        const snapshot = extractAiInteractionSnapshot(createStateWithInteraction(interaction));

        expect(snapshot?.kind).toBe('simple-choice');
        expect(snapshot?.sourceId).toBe('test-select-player');
        expect(snapshot?.ai?.status).toBe('semantic');
        expect(snapshot?.aiDecisions?.[0]?.kind).toBe('select-player');
        expect(snapshot?.aiDecisions?.[0]?.selection).toEqual({ min: 1, max: 1 });
        expect(snapshot?.aiDecisions?.[0]?.skipPolicy).toBe('forbidden');
    });

    it('AI 快照会从当前交互重建语义候选，避免复用旧候选', () => {
        const firstInteraction = createSimpleChoice(
            'choose-target',
            '0',
            '选择目标',
            [{ id: 'p1', label: '玩家 1', value: { playerId: '1' } }],
            {
                sourceId: 'first',
                ai: {
                    status: 'semantic',
                    decisions: [{
                        kind: 'select-player',
                        interactionId: 'choose-target',
                        actorPlayerId: '0',
                        selection: { min: 1, max: 1 },
                        candidates: [{ id: 'player:1', playerId: '1' }],
                    }],
                },
            },
        );
        const secondInteraction = createSimpleChoice(
            'choose-target',
            '0',
            '选择目标',
            [{ id: 'p2', label: '玩家 2', value: { playerId: '2' } }],
            {
                sourceId: 'second',
                ai: {
                    status: 'semantic',
                    decisions: [{
                        kind: 'select-player',
                        interactionId: 'choose-target',
                        actorPlayerId: '0',
                        selection: { min: 1, max: 1 },
                        candidates: [{ id: 'player:2', playerId: '2' }],
                    }],
                },
            },
        );

        const firstSnapshot = extractAiInteractionSnapshot(createStateWithInteraction(firstInteraction));
        const secondSnapshot = extractAiInteractionSnapshot(createStateWithInteraction(secondInteraction));

        expect(firstSnapshot?.aiDecisions?.[0]?.candidates.map((candidate) => candidate.id)).toEqual(['player:1']);
        expect(secondSnapshot?.aiDecisions?.[0]?.candidates.map((candidate) => candidate.id)).toEqual(['player:2']);
    });

    it('诊断 gate 会报告缺少 AI 语义或适配器的阻塞交互', () => {
        const diagnostic = diagnoseAiOwnedBlockingInteraction({
            playerId: '0',
            state: createStateWithInteraction({
                id: 'unsupported',
                kind: 'custom-blocking',
                playerId: '0',
                data: { sourceId: 'custom-source' },
            }),
            legalActions: [],
        });

        expect(diagnostic).toMatchObject({
            status: 'missing-support',
            interactionId: 'unsupported',
            interactionKind: 'custom-blocking',
            sourceId: 'custom-source',
            ownerPlayerId: '0',
        });
    });

    it('诊断 gate 可识别自定义交互适配器', () => {
        const diagnostic = diagnoseAiOwnedBlockingInteraction({
            playerId: '1',
            state: createStateWithInteraction({
                id: 'targeting-roll',
                kind: 'test:custom-choice',
                playerId: '1',
                data: { sourceId: 'targetingRoll' },
            }),
            legalActions: [sampleLegalAction],
            adapterInteractionKinds: ['test:custom-choice'],
        });

        expect(diagnostic).toMatchObject({
            status: 'ok',
            interactionKind: 'test:custom-choice',
            hasAdapter: true,
        });
    });

    it('诊断 gate 可识别 simple-choice 适配器', () => {
        const diagnostic = diagnoseAiOwnedBlockingInteraction({
            playerId: '0',
            state: createStateWithInteraction({
                id: 'test-reaction',
                kind: 'simple-choice',
                playerId: '0',
                data: { sourceId: 'test_reaction_choose' },
            }),
            legalActions: [sampleLegalAction],
            adapterInteractionKinds: ['simple-choice'],
        });

        expect(diagnostic).toMatchObject({
            status: 'ok',
            interactionKind: 'simple-choice',
            sourceId: 'test_reaction_choose',
            hasAdapter: true,
        });
    });

    it('阻塞交互缺少动作时会生成带 interactionId 的紧急取消动作', () => {
        const actions = buildAiOwnedBlockingInteractionFallbackActions({
            playerId: '0',
            state: createStateWithInteraction({
                id: 'custom-blocker',
                kind: 'custom-blocking',
                playerId: '0',
                data: { sourceId: 'custom-source' },
            }),
            legalActions: [],
        });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: 'interaction-cancel',
            commands: [{
                type: 'SYS_INTERACTION_CANCEL',
                payload: {
                    interactionId: 'custom-blocker',
                    reason: 'missing-support',
                },
            }],
            metadata: {
                interactionId: 'custom-blocker',
                interactionKind: 'custom-blocking',
                sourceId: 'custom-source',
                diagnosticStatus: 'missing-support',
                emergencyFallback: true,
            },
        });
    });
});
