import { describe, expect, it, vi } from 'vitest';
import { registerGameAiRuntime, type AiLegalAction } from '../../ai';
import type { MatchState } from '../../types';
import type { GameEngineConfig } from '../engineConfig';
import {
    OnlineAiManualRecoveryCoordinator,
    type OnlineAiManualRecoveryCoordinatorHooks,
    type OnlineAiManualRecoveryMatch,
} from '../onlineAiManualRecoveryCoordinator';
import type { ForceEndTurnStalledAiResolution } from '../onlineAiRecovery';
import type { OnlineAiWatchdogSeatController } from '../onlineAiWatchdogSeatControllers';

function createState(phase = 'setup'): MatchState<unknown> {
    return {
        core: { activePlayerId: '0' },
        sys: {
            phase,
            turnNumber: 1,
            eventStream: { nextId: 1, entries: [] },
        },
    } as MatchState<unknown>;
}

function createEngineConfig(gameId: string): GameEngineConfig {
    return {
        gameId,
        onlineAiRecovery: {
            shouldTreatActionAsManualSetupSelection: () => true,
        },
    } as GameEngineConfig;
}

function createMatch(gameId: string, overrides: Partial<OnlineAiManualRecoveryMatch> = {}): OnlineAiManualRecoveryMatch {
    return {
        matchID: `match-${gameId}`,
        gameId,
        state: createState(),
        stateID: 7,
        unloaded: false,
        engineConfig: createEngineConfig(gameId),
        metadata: {
            gameName: gameId,
            players: {
                '0': { name: 'Host', ownerKey: 'owner-1' },
                '1': { name: 'AI' },
            },
            createdAt: 1,
            updatedAt: 1,
            setupData: {
                ownerKey: 'owner-1',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', manualSetupSelection: true },
                },
            },
        },
        ...overrides,
    };
}

function createSetupAction(): AiLegalAction {
    return {
        actionId: 'setup-select-faction:elves',
        kind: 'setup-select-faction',
        label: '选择阵营',
        commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'elves' } }],
    };
}

function createCandidate(): ForceEndTurnStalledAiResolution {
    return {
        playerId: '1',
        reason: 'active-turn',
        fingerprintHint: 'active-turn:1',
        resolution: {
            playerId: '1',
            attemptKey: 'attempt-active-turn',
            source: 'local-ai',
            action: {
                actionId: 'force-end-turn:1',
                kind: 'force-end-turn',
                label: '强制结束 AI 回合',
                commands: [],
            },
        },
    };
}

function createHooks(
    overrides: Partial<OnlineAiManualRecoveryCoordinatorHooks<OnlineAiManualRecoveryMatch>> = {},
): OnlineAiManualRecoveryCoordinatorHooks<OnlineAiManualRecoveryMatch> {
    return {
        buildSeatControllers: vi.fn(() => ({
            '0': { type: 'human' },
            '1': { type: 'local-ai' },
        } satisfies Record<string, OnlineAiWatchdogSeatController>)),
        isMatchExecuting: vi.fn(() => false),
        isRecoveryInFlight: vi.fn(() => false),
        resolvePrivateOverlay: vi.fn((match) => match.state),
        executeManualSetupCommand: vi.fn(async () => true),
        resolveRecoveryCandidate: vi.fn(async () => createCandidate()),
        buildRecoveryFingerprint: vi.fn(() => 'fingerprint-1'),
        clearTracker: vi.fn(),
        setTracker: vi.fn(),
        beginInFlight: vi.fn(),
        finishInFlight: vi.fn(),
        runRecoverySequence: vi.fn(async () => undefined),
        hasRecoveryResolved: vi.fn(async () => true),
        now: vi.fn(() => 1_234),
        ...overrides,
    };
}

describe('OnlineAiManualRecoveryCoordinator', () => {
    it('人工 setup 只提交选择意图，正式命令从当前 AI legal action 重新生成', async () => {
        const gameId = 'manual-recovery-setup-test';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [createSetupAction()],
        });
        const match = createMatch(gameId);
        const hooks = createHooks();
        const coordinator = new OnlineAiManualRecoveryCoordinator({
            rulesVersion: 'rules-test',
            gameManifests: {},
            hooks,
        });

        await expect(coordinator.handleManualSetupSelection(match, '0', {
            targetPlayerId: '1',
            actionKind: 'setup-select-faction',
            selectionId: 'elves',
        })).resolves.toBe(true);

        expect(hooks.executeManualSetupCommand).toHaveBeenCalledWith({
            match,
            playerId: '1',
            commandType: 'SELECT_FACTION',
            commandPayload: { factionId: 'elves' },
            expectedStateID: 7,
        });
    });

    it('manual force 在房间执行中时拒绝且不启动 recovery sequence', async () => {
        const match = createMatch('manual-recovery-busy-test');
        const hooks = createHooks({
            isMatchExecuting: vi.fn(() => true),
        });
        const coordinator = new OnlineAiManualRecoveryCoordinator({
            rulesVersion: 'rules-test',
            gameManifests: {},
            hooks,
        });

        await expect(coordinator.handleManualForceEndAiPhase(match, '0')).resolves.toEqual({
            accepted: false,
            reason: 'busy',
        });
        expect(hooks.runRecoverySequence).not.toHaveBeenCalled();
        expect(hooks.setTracker).not.toHaveBeenCalled();
    });

    it('manual force 空闲时设置 recovery tracker 并复用 recovery sequence', async () => {
        const match = createMatch('manual-recovery-force-test');
        const candidate = createCandidate();
        const hooks = createHooks({
            resolveRecoveryCandidate: vi.fn(async () => candidate),
        });
        const coordinator = new OnlineAiManualRecoveryCoordinator({
            rulesVersion: 'rules-test',
            gameManifests: {},
            hooks,
        });

        await expect(coordinator.handleManualForceEndAiPhase(match, '0')).resolves.toEqual({
            accepted: true,
        });

        expect(hooks.setTracker).toHaveBeenCalledWith(match.matchID, expect.objectContaining({
            key: '1:active-turn:fingerprint-1',
            firstSeenAt: 1_234,
            autoSubmittedAt: 1_234,
        }));
        expect(hooks.beginInFlight).toHaveBeenCalledWith(match.matchID);
        expect(hooks.runRecoverySequence).toHaveBeenCalledWith(expect.objectContaining({
            match,
            candidate,
            options: { allowManualImmediateAiContinuation: true },
        }));
        expect(hooks.finishInFlight).toHaveBeenCalledWith(match.matchID);
    });
});
