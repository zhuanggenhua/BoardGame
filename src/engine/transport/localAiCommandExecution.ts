import {
    buildAiProgressMarker,
    type OnlineAiRecoveryEngineConfig,
} from './onlineAiRecovery';
import {
    buildLocalAiCommandProgressPayload,
    buildLocalAiCommandStateSnapshot,
    resolveLocalAiCommandEffect,
    type LocalAiCommandEffect,
} from './localAiCommandEffects';
import {
    logLocalAiPerfInfo,
    logLocalAiPerfWarn,
    type LocalAiTurnTimeline,
} from './localAiDiagnostics';
import type { MatchState } from '../types';

export async function executeLocalAiCommandWithProgress(args: {
    gameId: string;
    seed: string;
    playerId: string;
    source: string;
    actionKind: string;
    actionVisibility: 'hidden' | 'visible';
    attemptKey: string;
    command: { type: string; payload?: unknown };
    commandIndex: number;
    commandTotal: number;
    turnTimeline?: LocalAiTurnTimeline;
    dispatch: (type: string, payload: unknown) => void;
    getState: () => MatchState<unknown>;
    commandEffectsByToken: Record<string, LocalAiCommandEffect>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): Promise<LocalAiCommandEffect> {
    const normalizedPayload = args.command.payload && typeof args.command.payload === 'object'
        ? args.command.payload as Record<string, unknown>
        : {};
    const snapshotBeforeCommand = buildLocalAiCommandStateSnapshot({
        state: args.getState(),
        playerId: args.playerId,
        marker: buildAiProgressMarker(args.getState(), { engineConfig: args.engineConfig }),
    });
    const aiTraceToken = `${args.attemptKey}:${args.commandIndex}:${Date.now()}`;
    args.dispatch(args.command.type, {
        ...normalizedPayload,
        __tutorialPlayerId: args.playerId,
        __tutorialAiCommand: true,
        __aiTraceToken: aiTraceToken,
    });

    let commandEffect = args.commandEffectsByToken[aiTraceToken];
    if (!commandEffect) {
        for (let retry = 0; retry < 3; retry += 1) {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            commandEffect = args.commandEffectsByToken[aiTraceToken];
            if (commandEffect) {
                break;
            }
        }
    }
    if (commandEffect) {
        delete args.commandEffectsByToken[aiTraceToken];
    }

    const snapshotAfterCommand = buildLocalAiCommandStateSnapshot({
        state: args.getState(),
        playerId: args.playerId,
        marker: buildAiProgressMarker(args.getState(), { engineConfig: args.engineConfig }),
    });
    const effect = resolveLocalAiCommandEffect({
        before: snapshotBeforeCommand,
        after: snapshotAfterCommand,
        override: commandEffect,
    });
    const commandProgressPayload = buildLocalAiCommandProgressPayload({
        gameId: args.gameId,
        seed: args.seed,
        playerId: args.playerId,
        source: args.source,
        actionKind: args.actionKind,
        commandType: args.command.type,
        commandIndex: args.commandIndex,
        commandTotal: args.commandTotal,
        before: snapshotBeforeCommand,
        after: snapshotAfterCommand,
        effect,
    });

    if (effect.rejected) {
        return effect;
    }

    if (!effect.hasStateDelta) {
        logLocalAiPerfWarn('command-no-progress', commandProgressPayload);
        return effect;
    }

    const now = Date.now();
    const timeline = args.turnTimeline;
    if (args.actionVisibility === 'visible' && timeline && !timeline.firstVisibleCommandLogged) {
        timeline.firstVisibleCommandLogged = true;
        logLocalAiPerfInfo('ai-first-visible-command', {
            gameId: args.gameId,
            matchId: `local:${args.gameId}:${args.seed}`,
            playerId: args.playerId,
            source: args.source,
            actionKind: args.actionKind,
            commandType: args.command.type,
            commandIndex: args.commandIndex,
            turnKey: timeline.turnKey,
            turnStartedElapsedMs: now - timeline.turnStartedAt,
            decisionReadyToVisibleMs: timeline.decisionReadyAt === null
                ? null
                : now - timeline.decisionReadyAt,
            phaseBefore: snapshotBeforeCommand.phase,
            phaseAfter: snapshotAfterCommand.phase,
        });
    }

    if (args.command.type === 'ROLL_DICE') {
        logLocalAiPerfInfo('ai-roll-command', {
            gameId: args.gameId,
            matchId: `local:${args.gameId}:${args.seed}`,
            playerId: args.playerId,
            source: args.source,
            actionKind: args.actionKind,
            commandType: args.command.type,
            turnKey: timeline?.turnKey ?? null,
            rollOrdinal: timeline ? timeline.rollCount + 1 : 1,
            gapFromPreviousRollMs: timeline?.lastRollAt === null || timeline?.lastRollAt === undefined
                ? null
                : now - timeline.lastRollAt,
            turnStartedElapsedMs: timeline
                ? now - timeline.turnStartedAt
                : null,
            decisionReadyToVisibleMs: timeline?.decisionReadyAt === null || timeline?.decisionReadyAt === undefined
                ? null
                : now - timeline.decisionReadyAt,
            phaseBefore: snapshotBeforeCommand.phase,
            phaseAfter: snapshotAfterCommand.phase,
        });
        if (timeline) {
            timeline.rollCount += 1;
            timeline.lastRollAt = now;
        }
    }

    logLocalAiPerfInfo('command-progress', commandProgressPayload);
    return effect;
}

export async function executeLocalAiCommandBatch(args: {
    gameId: string;
    seed: string;
    playerId: string;
    source: string;
    actionKind: string;
    actionVisibility: 'hidden' | 'visible';
    attemptKey: string;
    commands: Array<{ type: string; payload?: unknown }>;
    turnTimeline?: LocalAiTurnTimeline;
    dispatch: (type: string, payload: unknown) => void;
    getState: () => MatchState<unknown>;
    getRandomCursor?: () => number;
    restoreBatchSnapshot?: (snapshot: { state: MatchState<unknown>; randomCursor: number | null }) => void;
    commandEffectsByToken: Record<string, LocalAiCommandEffect>;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): Promise<{
    hasAnyCommandEffect: boolean;
    rolledBack: boolean;
    failedCommandType?: string;
    failureReason?: string;
}> {
    const snapshotState = args.getState();
    const snapshotRandomCursor = args.getRandomCursor?.() ?? null;
    let hasAnyCommandEffect = false;

    for (const [commandIndex, command] of args.commands.entries()) {
        const effect = await executeLocalAiCommandWithProgress({
            gameId: args.gameId,
            seed: args.seed,
            playerId: args.playerId,
            source: args.source,
            actionKind: args.actionKind,
            actionVisibility: args.actionVisibility,
            attemptKey: args.attemptKey,
            command,
            commandIndex,
            commandTotal: args.commands.length,
            turnTimeline: args.turnTimeline,
            dispatch: args.dispatch,
            getState: args.getState,
            commandEffectsByToken: args.commandEffectsByToken,
            engineConfig: args.engineConfig,
        });
        if (effect.rejected) {
            args.restoreBatchSnapshot?.({
                state: snapshotState,
                randomCursor: snapshotRandomCursor,
            });
            logLocalAiPerfWarn('batch-rolled-back', {
                gameId: args.gameId,
                matchId: `local:${args.gameId}:${args.seed}`,
                playerId: args.playerId,
                source: args.source,
                actionKind: args.actionKind,
                failedCommandType: command.type,
                failureReason: effect.failureReason ?? 'command_failed',
                commandIndex,
                commandTotal: args.commands.length,
            });
            return {
                hasAnyCommandEffect: false,
                rolledBack: true,
                failedCommandType: command.type,
                failureReason: effect.failureReason,
            };
        }
        if (effect.hasStateDelta) {
            hasAnyCommandEffect = true;
        }
    }

    return { hasAnyCommandEffect, rolledBack: false };
}
