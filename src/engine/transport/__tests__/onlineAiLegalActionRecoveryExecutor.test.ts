import { describe, expect, it, vi } from 'vitest';
import type { AiResolution } from '../../ai';
import type { MatchState } from '../../types';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import {
    executeOnlineAiLegalActionRecovery,
    type OnlineAiLegalActionRecoveryExecutionHooks,
    type OnlineAiLegalActionRecoveryExecutionMatch,
} from '../onlineAiLegalActionRecoveryExecutor';

const createState = (): MatchState<unknown> => ({
    core: { activePlayerId: '1' },
    sys: { phase: 'summon', turnNumber: 1 },
}) as unknown as MatchState<unknown>;

const createCandidate = (): ForceEndTurnStalledAiResolution => ({
    playerId: '1',
    reason: 'active-turn',
    resolution: {
        playerId: '1',
        attemptKey: 'force-end-turn:1',
        source: 'local-ai',
        action: {
            actionId: 'force-end-turn:1',
            kind: 'force-end-turn',
            label: '强制结束 AI 回合',
            commands: [],
        },
    },
});

const createResolution = (commands: AiResolution['action']['commands']): AiResolution => ({
    playerId: '1',
    attemptKey: 'legal-action:1',
    source: 'local-ai',
    action: {
        actionId: 'legal-summon-chain',
        kind: 'summon-unit',
        label: '召唤单位',
        commands,
        metadata: { source: 'test' },
    },
});

const createMatch = (): OnlineAiLegalActionRecoveryExecutionMatch => ({
    matchID: 'match-legal-action-executor',
    gameId: 'test-game',
    state: createState(),
    stateID: 0,
    unloaded: false,
    lastCommandFailureReason: null,
});

const createHooks = (
    overrides: Partial<OnlineAiLegalActionRecoveryExecutionHooks> = {},
): OnlineAiLegalActionRecoveryExecutionHooks => ({
    getLatestSeatController: vi.fn(() => ({ type: 'local-ai' as const })),
    buildProgressMarker: vi.fn(() => 'marker'),
    buildRecoveryFingerprint: vi.fn((marker) => `fingerprint:${marker}`),
    isStillOwnedByRecoveredAi: vi.fn(() => true),
    hasRecoveryResolved: vi.fn(async () => true),
    settleRecoveryResolvedStatus: vi.fn(),
    resetRecoveryAttempt: vi.fn(),
    validateCommand: vi.fn(() => ({ valid: true })),
    executeCommand: vi.fn(async () => true),
    broadcastState: vi.fn(),
    onPrecheckDeferred: vi.fn(),
    onAuthoritativeInvalidCommand: vi.fn(async () => {}),
    onStoppedAfterOwnershipChanged: vi.fn(),
    onRecoveredLegalAction: vi.fn(),
    ...overrides,
});

describe('onlineAiLegalActionRecoveryExecutor', () => {
    it('第一条命令后归属不再是同一 AI 时应停止后续命令并按已恢复返回', async () => {
        const match = createMatch();
        const hooks = createHooks({
            isStillOwnedByRecoveredAi: vi.fn(() => false),
            executeCommand: vi.fn(async (command) => {
                match.stateID += 1;
                return command.type === 'FIRST_OK';
            }),
        });

        const result = await executeOnlineAiLegalActionRecovery({
            match,
            candidate: createCandidate(),
            resolution: createResolution([
                { type: 'FIRST_OK', payload: { step: 1 } },
                { type: 'SECOND_SHOULD_NOT_RUN', payload: { step: 2 } },
            ]),
            seatController: { type: 'local-ai' },
            emitTrace: vi.fn(),
            hooks,
        });

        expect(hooks.executeCommand).toHaveBeenCalledTimes(1);
        expect(hooks.executeCommand).toHaveBeenCalledWith({ type: 'FIRST_OK', payload: { step: 1 } });
        expect(hooks.broadcastState).toHaveBeenCalledTimes(1);
        expect(hooks.settleRecoveryResolvedStatus).toHaveBeenCalledWith(true);
        expect(hooks.onStoppedAfterOwnershipChanged).toHaveBeenCalledWith({
            playerId: '1',
            actionId: 'legal-summon-chain',
            actionKind: 'summon-unit',
            executedCommandTypes: ['FIRST_OK'],
            resolved: true,
        });
        expect(result).toMatchObject({
            applied: true,
            resolved: true,
            executedCommandTypes: ['FIRST_OK'],
            reportedAction: {
                candidateReason: 'active-turn',
                playerId: '1',
                actionKind: 'summon-unit',
                actionId: 'legal-summon-chain',
                metadata: { source: 'test' },
            },
        });
    });

    it('权威预检拒绝时不进入执行管线并返回命令失败合同', async () => {
        const match = createMatch();
        const hooks = createHooks({
            validateCommand: vi.fn(() => ({ valid: false, error: '手牌中没有该卡牌' })),
        });

        const result = await executeOnlineAiLegalActionRecovery({
            match,
            candidate: createCandidate(),
            resolution: createResolution([
                { type: 'PLAY_CARD', payload: { cardUid: 'missing' } },
            ]),
            seatController: { type: 'local-ai' },
            emitTrace: vi.fn(),
            hooks,
        });

        expect(hooks.executeCommand).not.toHaveBeenCalled();
        expect(hooks.onAuthoritativeInvalidCommand).toHaveBeenCalledWith({
            playerId: '1',
            command: { type: 'PLAY_CARD', payload: { cardUid: 'missing' } },
            commandFailureReason: '手牌中没有该卡牌',
            progressMarker: 'marker',
            stateIDBefore: 0,
        });
        expect(hooks.resetRecoveryAttempt).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            applied: false,
            resolved: false,
            blockedReason: null,
            executedCommandTypes: [],
            outcome: 'legal-action-command-failed',
            failedCommandType: 'PLAY_CARD',
            commandFailureReason: '手牌中没有该卡牌',
            reportedAction: null,
        });
    });
});
