import {
    getGameAiRuntime,
    resolveNextAiDispatch,
    resolveOnlineAiDecisionView,
    type AiSeatController,
} from '../ai';
import type { MatchState, RandomFn } from '../types';
import type { GameEngineConfig } from './engineConfig';
import {
    markOnlineAiVisibleActionCompleted,
    waitForOnlineAiActionDelay,
    type OnlineAiActionDelayContext,
    type OnlineAiActionDelayTraceEmitter,
} from './onlineAiActionDelay';

export type OnlineAiCommand = {
    type: string;
    payload: unknown;
};

export type OnlineAiCommandFailureFeedbackSource = 'player-command-failure' | 'online-ai-watchdog';

export type OnlineAiCommandSequenceOptions = {
    reportFailureFeedback: boolean;
    feedbackSource: OnlineAiCommandFailureFeedbackSource;
    onlineAiAttemptKey?: string | null;
};

export type OnlineAiCommandSequenceResult = {
    success: boolean;
    executedCommandTypes: string[];
    failedCommandType?: string;
    failureReason?: string | null;
    stateChanged: boolean;
};

type OnlineAiCommandSequenceMatch = {
    matchID: string;
    state: MatchState<unknown>;
    stateID: number;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    lastCommandPlayerId: string | null;
    lastBroadcastedViews: { clear: () => void };
    lastCommandFailureReason: string | null;
};

type OnlineAiCommandSequenceStoredState = {
    G: MatchState<unknown>;
    _stateID: number;
    randomSeed: string;
    randomCursor: number;
};

type OnlineAiCommandSequenceExecuteOptions = {
    suppressBroadcast: true;
    reportFailureFeedback: boolean;
    feedbackSource: OnlineAiCommandFailureFeedbackSource;
    onlineAiCircuitSource: 'watchdog';
    onlineAiAttemptKey?: string | null;
};

export async function executeOnlineAiCommandSequence(args: {
    match: OnlineAiCommandSequenceMatch;
    playerId: string;
    commands: OnlineAiCommand[];
    options: OnlineAiCommandSequenceOptions;
    createTrackedRandom: (seed: string, initialCursor: number) => { random: RandomFn; getCursor: () => number };
    persistState: (storedState: OnlineAiCommandSequenceStoredState) => Promise<void>;
    broadcastState: () => void;
    executeCommand: (
        command: OnlineAiCommand,
        options: OnlineAiCommandSequenceExecuteOptions,
    ) => Promise<boolean>;
}): Promise<OnlineAiCommandSequenceResult> {
    const { match } = args;
    const snapshotState = match.state;
    const snapshotStateID = match.stateID;
    const snapshotRandomCursor = match.getRandomCursor();
    const snapshotLastCommandPlayerId = match.lastCommandPlayerId;
    const executedCommandTypes: string[] = [];

    const restoreSnapshot = async (): Promise<void> => {
        const trackedRandom = args.createTrackedRandom(match.randomSeed, snapshotRandomCursor);
        match.state = snapshotState;
        match.stateID = snapshotStateID;
        match.random = trackedRandom.random;
        match.getRandomCursor = trackedRandom.getCursor;
        match.lastCommandPlayerId = snapshotLastCommandPlayerId;
        match.lastBroadcastedViews.clear();
        await args.persistState({
            G: snapshotState,
            _stateID: snapshotStateID,
            randomSeed: match.randomSeed,
            randomCursor: snapshotRandomCursor,
        });
        args.broadcastState();
    };

    for (const command of args.commands) {
        const success = await args.executeCommand(command, {
            suppressBroadcast: true,
            reportFailureFeedback: args.options.reportFailureFeedback,
            feedbackSource: args.options.feedbackSource,
            onlineAiCircuitSource: 'watchdog',
            onlineAiAttemptKey: args.options.onlineAiAttemptKey,
        });
        if (!success) {
            const failureReason = match.lastCommandFailureReason;
            await restoreSnapshot();
            match.lastCommandFailureReason = failureReason;
            return {
                success: false,
                executedCommandTypes,
                failedCommandType: command.type,
                failureReason,
                stateChanged: false,
            };
        }
        executedCommandTypes.push(command.type);
    }

    return {
        success: true,
        executedCommandTypes,
        stateChanged: match.stateID !== snapshotStateID,
    };
}

export type OnlineAiImmediateActionResult = {
    applied: boolean;
    playerId: string;
    actionKind: string | null;
    executedCommandTypes: string[];
    decisionMs: number;
    commandFailureReason: string | null;
};

type OnlineAiImmediateActionMatch = {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    stateID: number;
    unloaded: boolean;
};

export type OnlineAiImmediateActionExecutor = {
    applyPlayerView: (playerId: string) => MatchState<unknown>;
    getSeatControllers: () => Record<string, AiSeatController>;
    executeCommandSequence: (
        playerId: string,
        commands: OnlineAiCommand[],
        options: OnlineAiCommandSequenceOptions,
    ) => Promise<OnlineAiCommandSequenceResult>;
    clearRecoveryState: () => void;
    broadcastState: () => void;
    emitTrace: OnlineAiActionDelayTraceEmitter;
};

export async function tryExecuteOnlineAiImmediateAction(args: {
    match: OnlineAiImmediateActionMatch;
    seatControllers: Record<string, AiSeatController>;
    delayContext?: OnlineAiActionDelayContext;
    executor: OnlineAiImmediateActionExecutor;
}): Promise<OnlineAiImmediateActionResult> {
    const { match, seatControllers, delayContext, executor } = args;
    const decisionStartedAt = Date.now();
    const aiDispatchResult = await resolveNextAiDispatch({
        engineConfig: match.engineConfig,
        state: match.state,
        matchId: match.matchID,
        seatControllers,
        visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
            runtime: getGameAiRuntime(match.gameId) ?? null,
            sharedState: match.state,
            privateOverlay: executor.applyPlayerView(playerId),
            playerId,
        }),
    });
    const decisionMs = Date.now() - decisionStartedAt;
    if (aiDispatchResult.kind !== 'action') {
        return {
            applied: false,
            playerId: aiDispatchResult.kind === 'blocked' ? aiDispatchResult.playerId : '',
            actionKind: null,
            executedCommandTypes: [],
            decisionMs,
            commandFailureReason: null,
        };
    }

    const resolution = aiDispatchResult.resolution;
    const controller = seatControllers[resolution.playerId];
    if (
        !controller
        || controller.type === 'human'
        || resolution.action.commands.length === 0
    ) {
        return {
            applied: false,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            executedCommandTypes: [],
            decisionMs,
            commandFailureReason: null,
        };
    }

    const stateIDBeforeDelay = match.stateID;
    const delayResult = await waitForOnlineAiActionDelay({
        matchId: match.matchID,
        gameId: match.gameId,
        playerId: resolution.playerId,
        action: resolution.action,
        controller,
        delayContext,
        emitTrace: executor.emitTrace,
    });
    if (match.unloaded || match.stateID !== stateIDBeforeDelay) {
        return {
            applied: false,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            executedCommandTypes: [],
            decisionMs,
            commandFailureReason: null,
        };
    }
    const latestController = executor.getSeatControllers()[resolution.playerId];
    if (!latestController || latestController.type === 'human') {
        return {
            applied: false,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            executedCommandTypes: [],
            decisionMs,
            commandFailureReason: null,
        };
    }

    const sequence = await executor.executeCommandSequence(
        resolution.playerId,
        resolution.action.commands,
        {
            reportFailureFeedback: false,
            feedbackSource: 'online-ai-watchdog',
            onlineAiAttemptKey: resolution.attemptKey,
        },
    );
    if (!sequence.success) {
        return {
            applied: false,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            executedCommandTypes: sequence.executedCommandTypes,
            decisionMs,
            commandFailureReason: sequence.failureReason ?? null,
        };
    }

    if (!sequence.stateChanged) {
        return {
            applied: false,
            playerId: resolution.playerId,
            actionKind: resolution.action.kind,
            executedCommandTypes: [],
            decisionMs,
            commandFailureReason: null,
        };
    }

    markOnlineAiVisibleActionCompleted(delayContext, delayResult);
    executor.clearRecoveryState();
    executor.broadcastState();
    return {
        applied: true,
        playerId: resolution.playerId,
        actionKind: resolution.action.kind,
        executedCommandTypes: sequence.executedCommandTypes,
        decisionMs: decisionMs + delayResult.waitedMs,
        commandFailureReason: null,
    };
}
