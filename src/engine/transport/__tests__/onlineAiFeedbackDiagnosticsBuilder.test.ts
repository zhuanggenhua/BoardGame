import { describe, expect, it } from 'vitest';
import type { GameEvent, MatchState } from '../../types';
import { INTERACTION_COMMANDS, INTERACTION_EVENTS } from '../../systems/InteractionSystem';
import type { GameEngineConfig } from '../engineConfig';
import { OnlineAiFeedbackDiagnosticsBuilder, type OnlineAiFeedbackDiagnosticsMatch } from '../onlineAiFeedbackDiagnosticsBuilder';

const createEngineConfig = (): GameEngineConfig => ({
    gameId: 'diagnostics-test',
    domain: {
        setup: () => ({ currentPlayer: '1' }),
        validate: () => ({ valid: true }),
        execute: ({ state }) => ({ state, events: [] }),
    },
    systems: [],
} as unknown as GameEngineConfig);

const createState = (): MatchState<unknown> => ({
    core: { currentPlayer: '1' },
    sys: {
        phase: 'main',
        turnNumber: 3,
        interaction: {
            current: {
                id: 'choice-empty',
                kind: 'simple-choice',
                playerId: '1',
                data: {
                    sourceId: 'source-empty',
                    options: [],
                },
            },
            queue: [],
            isBlocked: true,
        },
        actionLog: {
            entries: [{ text: 'latest action', event: { type: 'LATEST_ACTION' } }],
        },
        eventStream: {
            nextId: 1,
            entries: [{ type: 'LATEST_EVENT', timestamp: 10 }],
        },
    },
} as unknown as MatchState<unknown>);

const createMatch = (setupData: unknown = {
    seatControllers: { '1': { type: 'local-ai' } },
}): OnlineAiFeedbackDiagnosticsMatch => ({
    matchID: 'match-diagnostics',
    gameId: 'diagnostics-test',
    engineConfig: createEngineConfig(),
    state: createState(),
    metadata: { setupData },
});

const createBuilder = (): OnlineAiFeedbackDiagnosticsBuilder => new OnlineAiFeedbackDiagnosticsBuilder({
    rulesVersion: 'rules-test',
    applyPlayerView: (match) => match.state as MatchState<unknown>,
});

describe('OnlineAiFeedbackDiagnosticsBuilder', () => {
    it('buildCommandFailureFeedbackPayload 通过 builder 保留命令失败诊断合同', () => {
        const builder = createBuilder();
        const match = createMatch();

        const payload = builder.buildCommandFailureFeedbackPayload({
            match,
            playerId: '1',
            commandType: 'TEST_COMMAND',
            reason: 'pipeline_error: denied',
            commandPayload: { cardUid: 'card-1' },
            progressMarker: 'marker-1',
            stateIdBefore: 8,
            visibleState: createState(),
            feedbackSource: 'online-ai-watchdog',
        });

        expect(payload).toMatchObject({
            matchId: 'match-diagnostics',
            gameId: 'diagnostics-test',
            playerId: '1',
            incidentKind: 'command-failed',
            feedbackSource: 'online-ai-watchdog',
            severity: 'high',
            commandType: 'TEST_COMMAND',
        });
        expect(JSON.parse(payload.stateSnapshot)).toMatchObject({
            kind: 'command-failure-feedback',
            stateIDBefore: 8,
            command: { payload: { cardUid: 'card-1' } },
        });
    });

    it('buildUnsatisfiableInteractionFeedback 为 AI 自动跳过的无解交互生成可定位反馈', async () => {
        const builder = createBuilder();
        const match = createMatch();
        const event: GameEvent = {
            type: INTERACTION_EVENTS.CANCELLED,
            payload: {
                reason: 'empty-options',
                interactionId: 'choice-empty',
            },
            timestamp: 1,
        };

        const feedback = await builder.buildUnsatisfiableInteractionFeedback({
            match,
            playerId: '1',
            seatControllerType: 'local-ai',
            commandType: INTERACTION_COMMANDS.CANCEL,
            event,
            progressMarkerBefore: 'marker-before',
            preCommandSeatView: createState(),
        });

        expect(feedback).toMatchObject({
            matchId: 'match-diagnostics',
            gameId: 'diagnostics-test',
            playerId: '1',
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            severity: 'medium',
            status: 'open',
            reason: 'empty-options',
            trackerKey: '1:unsatisfiable-interaction:choice-empty:empty-options:marker-before',
        });
        const snapshot = JSON.parse(feedback?.stateSnapshot ?? '{}') as {
            interaction?: {
                seat?: { id?: string; sourceId?: string };
                seatUnsatisfiableReason?: string;
            };
        };
        expect(snapshot.interaction?.seat).toMatchObject({
            id: 'choice-empty',
            sourceId: 'source-empty',
        });
        expect(snapshot.interaction?.seatUnsatisfiableReason).toBe('empty-options');
    });

    it('buildUnsatisfiableInteractionFeedback 不为 human 座位生成系统反馈', async () => {
        const builder = createBuilder();
        const feedback = await builder.buildUnsatisfiableInteractionFeedback({
            match: createMatch({ seatControllers: { '1': { type: 'human' } } }),
            playerId: '1',
            seatControllerType: 'human',
            commandType: INTERACTION_COMMANDS.CANCEL,
            event: {
                type: INTERACTION_EVENTS.CANCELLED,
                payload: { reason: 'empty-options', interactionId: 'choice-empty' },
                timestamp: 1,
            },
            progressMarkerBefore: 'marker-before',
            preCommandSeatView: createState(),
        });

        expect(feedback).toBeNull();
    });
});
