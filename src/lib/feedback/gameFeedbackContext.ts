import type { MatchState } from '../../engine/types';
import type { FeedbackReplayTriggerReference } from '../../engine/transport/feedbackReplayCaptureTypes';
import type { FeedbackCommandSummary } from './feedbackPayload';

type GameFeedbackContext = {
    state: MatchState<unknown>;
    scopeId?: string;
    playerId?: string | null;
    isGameOver?: boolean;
    isLocalMode?: boolean;
    stateId?: number;
    stateRevision?: number;
    randomCursor?: number;
    latestCommand?: GameFeedbackCommandTrace;
    recentCommands?: GameFeedbackCommandSummary[];
};

type GameFeedbackCommandSummary = {
    commandId: string;
    commandType: string;
    playerId?: string | null;
    issuedAt: number;
    stateId?: number;
    randomCursor?: number;
};

type GameFeedbackCommandTrace = GameFeedbackCommandSummary & {
    beforeState?: MatchState<unknown>;
    afterState?: MatchState<unknown>;
    afterStateId?: number;
    afterRandomCursor?: number;
};

type GameFeedbackDiagnosticContext = {
    state?: MatchState<unknown>;
    before?: MatchState<unknown>;
    after?: MatchState<unknown>;
    roomId?: string;
    requestId?: string;
    stateId?: number;
    stateRevision?: number;
    randomCursor?: number;
    commandTraceTail?: GameFeedbackCommandSummary[];
    lastCommand?: FeedbackCommandSummary;
};

let currentGameFeedbackContext: GameFeedbackContext | null = null;
let nextCommandSequence = 0;

export const setCurrentGameFeedbackContext = (context: GameFeedbackContext | null) => {
    if (!context) {
        currentGameFeedbackContext = null;
        return;
    }
    const sameScope = typeof context.scopeId === 'string'
        && context.scopeId.length > 0
        && currentGameFeedbackContext?.scopeId === context.scopeId;
    const latestCommand = sameScope ? currentGameFeedbackContext?.latestCommand : undefined;
    const stateAdvanced = latestCommand
        && latestCommand.afterState === undefined
        && latestCommand.beforeState !== context.state;
    currentGameFeedbackContext = {
        ...context,
        ...(sameScope && currentGameFeedbackContext?.recentCommands
            ? { recentCommands: currentGameFeedbackContext.recentCommands }
            : {}),
        ...(latestCommand ? {
            latestCommand: stateAdvanced
                ? {
                    ...latestCommand,
                    afterState: context.state,
                    afterStateId: context.stateId,
                    afterRandomCursor: context.randomCursor,
                }
                : latestCommand,
        } : {}),
    };
};

export const clearCurrentGameFeedbackContext = (state?: MatchState<unknown> | null) => {
    if (!state || currentGameFeedbackContext?.state === state) {
        currentGameFeedbackContext = null;
    }
};

export const getCurrentGameFeedbackContext = (): GameFeedbackContext | null => currentGameFeedbackContext;

export const recordGameFeedbackCommand = (args: {
    commandType: string;
    payload: unknown;
    playerId?: string | null;
    stateId?: number;
    randomCursor?: number;
}) => {
    if (!currentGameFeedbackContext) return;
    const issuedAt = Date.now();
    const commandId = `game-command-${issuedAt}-${nextCommandSequence++}`;
    const summary: GameFeedbackCommandSummary = {
        commandId,
        commandType: args.commandType,
        playerId: args.playerId,
        issuedAt,
        stateId: args.stateId ?? currentGameFeedbackContext.stateId,
        randomCursor: args.randomCursor ?? currentGameFeedbackContext.randomCursor,
    };
    currentGameFeedbackContext = {
        ...currentGameFeedbackContext,
        latestCommand: {
            ...summary,
            beforeState: currentGameFeedbackContext.state,
        },
        recentCommands: [...(currentGameFeedbackContext.recentCommands ?? []), summary].slice(-12),
    };
};

export const getCurrentGameFeedbackDiagnosticContext = (): GameFeedbackDiagnosticContext => {
    const context = currentGameFeedbackContext;
    if (!context) return {};
    const command = context.latestCommand;
    // `context.state` is the newest authoritative view. `latestCommand.afterState`
    // records that command's own result and can legitimately lag after later
    // automatic transitions, so it must never supply the current-state fields.
    const state = context.state;
    const commandAfterState = command?.afterState;
    const sys = state.sys as unknown as { roomId?: unknown; stateId?: unknown; revision?: unknown };
    const priorInteractionId = command?.beforeState?.sys.interaction?.current?.id;
    const interactionId = state.sys.interaction?.current?.id;
    const commandAfterInteractionId = commandAfterState?.sys.interaction?.current?.id;
    const responseWindow = state.sys.responseWindow?.current as { id?: unknown; windowId?: unknown } | undefined;
    const requestId = typeof interactionId === 'string'
        ? interactionId
        : typeof responseWindow?.id === 'string'
                ? responseWindow.id
                : typeof responseWindow?.windowId === 'string'
                    ? responseWindow.windowId
                    : typeof commandAfterInteractionId === 'string'
                        ? commandAfterInteractionId
                        : typeof priorInteractionId === 'string'
                            ? priorInteractionId
                    : undefined;
    const lastCommand = command
        ? {
            commandId: command.commandId,
            commandType: command.commandType,
            playerId: command.playerId,
            issuedAt: command.issuedAt,
            stateId: command.stateId,
            randomCursor: command.randomCursor,
            afterStateId: command.afterStateId,
            afterRandomCursor: command.afterRandomCursor,
        }
        : undefined;
    return {
        state,
        before: command?.beforeState,
        after: commandAfterState,
        roomId: typeof sys.roomId === 'string' ? sys.roomId : undefined,
        requestId,
        stateId: context.stateId ?? (typeof sys.stateId === 'number' ? sys.stateId : undefined),
        stateRevision: context.stateRevision ?? (typeof sys.revision === 'number' ? sys.revision : undefined),
        randomCursor: context.randomCursor ?? command?.afterRandomCursor ?? command?.randomCursor,
        commandTraceTail: context.recentCommands,
        lastCommand,
    };
};

/** Stable pointer to the last submitted command; the server resolves the private payload and authoritative states. */
export const getCurrentGameFeedbackReplayTriggerReference = (): FeedbackReplayTriggerReference | undefined => {
    const context = currentGameFeedbackContext;
    const command = context?.latestCommand;
    const playerId = typeof command?.playerId === 'string'
        ? command.playerId
        : typeof context?.playerId === 'string' ? context.playerId : undefined;
    if (!command || !playerId || typeof command.stateId !== 'number' || !command.commandType) return undefined;
    const diagnosticContext = getCurrentGameFeedbackDiagnosticContext();
    return {
        commandType: command.commandType,
        playerId,
        stateIdBefore: command.stateId,
        ...(typeof command.randomCursor === 'number' ? { randomCursorBefore: command.randomCursor } : {}),
        ...(diagnosticContext.requestId ? { requestId: diagnosticContext.requestId } : {}),
    };
};
