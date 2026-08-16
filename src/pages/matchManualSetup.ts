import type { MatchState } from '../engine/types';
import { isManualSetupSelectionEnabledForSeat, type AiSeatController } from '../engine/ai';
import {
    resolveOnlineAiCurrentPlayerId,
    type OnlineAiRecoveryEngineConfig,
} from '../engine/transport/onlineAiRecovery';

export type ManualSetupSelectionActionKind =
    | 'select-faction'
    | 'setup-select-faction'
    | 'setup-select-character';

const MANUAL_SETUP_SELECTION_ACTION_KINDS = new Set([
    'select-faction',
    'setup-select-faction',
    'setup-select-character',
]);

const MANUAL_SETUP_READY_COMMAND_TYPES = new Set([
    'PLAYER_READY',
    'sw:player_ready',
]);

type ManualSetupRecoveryEngineConfig = OnlineAiRecoveryEngineConfig;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isManualSetupSelectionActionKind(kind: string): kind is ManualSetupSelectionActionKind {
    return MANUAL_SETUP_SELECTION_ACTION_KINDS.has(kind);
}

export function shouldStageManualSetupSelectionBeforeReady(actionKind: string): boolean {
    return actionKind === 'setup-select-faction' || actionKind === 'setup-select-character';
}

export function isManualSetupReadyCommand(type: string): boolean {
    return MANUAL_SETUP_READY_COMMAND_TYPES.has(type);
}

function resolveManualSetupSelectionTakeoverOverride(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null | undefined {
    const resolver = args.engineConfig?.onlineAiRecovery?.resolveManualSetupSelectionTakeoverPlayerId;
    if (!resolver || !args.sharedState) {
        return undefined;
    }
    return resolver({
        sharedState: args.sharedState,
        currentPlayerId: args.currentPlayerId,
        seatControllers: args.seatControllers,
        hasManualDispatch: args.hasManualDispatch,
    });
}

function resolveManualSetupAttemptReleaseOverride(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: string;
    selectionId: string;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean | undefined {
    const resolver = args.engineConfig?.onlineAiRecovery?.shouldReleaseManualSetupAttemptFromSharedState;
    if (!resolver || !args.sharedState) {
        return undefined;
    }
    return resolver({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
    });
}

function resolveManualSetupSelectionActionKindOverride(args: {
    type: string;
    payload: unknown;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null | undefined {
    const resolver = args.engineConfig?.onlineAiRecovery?.resolveManualSetupSelectionActionKindFromCommand;
    if (!resolver) {
        return undefined;
    }
    return resolver({
        type: args.type,
        payload: args.payload,
    });
}

function resolveManualSetupSelectionIdOverride(args: {
    actionKind: string;
    payload: unknown;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null | undefined {
    const resolver = args.engineConfig?.onlineAiRecovery?.resolveManualSetupSelectionId;
    if (!resolver) {
        return undefined;
    }
    return resolver({
        actionKind: args.actionKind,
        payload: args.payload,
    });
}

function resolveManualSetupSharedConfirmationOverride(args: {
    playerId: string;
    actionKind: string;
    selectionId: string | null;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean | undefined {
    const resolver = args.engineConfig?.onlineAiRecovery?.shouldAwaitManualSetupSharedConfirmation;
    if (!resolver) {
        return undefined;
    }
    return resolver({
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
    });
}

export function shouldTakeOverManualSetupSelection(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean {
    return resolveManualSetupSelectionTakeoverPlayerId(args) !== null;
}

export function resolveOnlineManualSetupTakeoverPlayerId(args: {
    sharedState: MatchState<unknown> | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null {
    return resolveManualSetupSelectionTakeoverPlayerId({
        sharedState: args.sharedState,
        currentPlayerId: resolveOnlineAiCurrentPlayerId(args.sharedState, {
            engineConfig: args.engineConfig,
        }),
        seatControllers: args.seatControllers,
        hasManualDispatch: args.hasManualDispatch,
        engineConfig: args.engineConfig,
    });
}

export function resolveManualSetupSelectionTakeoverPlayerId(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null {
    if (!args.hasManualDispatch || !args.sharedState || typeof args.sharedState !== 'object') {
        return null;
    }

    const manualAiSeatIds = Object.entries(args.seatControllers)
        .filter(([, controller]) => isManualSetupSelectionEnabledForSeat(controller))
        .map(([playerId]) => playerId);
    if (manualAiSeatIds.length === 0) {
        return null;
    }

    const overriddenPlayerId = resolveManualSetupSelectionTakeoverOverride(args);
    if (overriddenPlayerId !== undefined) {
        return overriddenPlayerId;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : null;
    if (phase === 'factionSelect' && args.currentPlayerId && manualAiSeatIds.includes(args.currentPlayerId)) {
        return args.currentPlayerId;
    }

    const core = isPlainRecord(args.sharedState.core) ? args.sharedState.core : null;
    if (core?.hostStarted !== false) {
        return null;
    }

    const selectedFactions = isPlainRecord(core.selectedFactions) ? core.selectedFactions : null;
    if (selectedFactions) {
        return manualAiSeatIds.find((playerId) => {
            const selectedFaction = selectedFactions[playerId];
            return typeof selectedFaction !== 'string' || selectedFaction === 'unselected';
        }) ?? null;
    }

    const selectedCharacters = isPlainRecord(core.selectedCharacters) ? core.selectedCharacters : null;
    if (selectedCharacters) {
        return manualAiSeatIds.find((playerId) => {
            const selectedCharacter = selectedCharacters[playerId];
            return typeof selectedCharacter !== 'string' || selectedCharacter === 'unselected';
        }) ?? null;
    }

    return null;
}

export function shouldReleaseManualSetupAttemptFromSharedState(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: string;
    selectionId: string | null | undefined;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean {
    const selectionId = typeof args.selectionId === 'string' ? args.selectionId : '';
    if (!selectionId || !args.sharedState || typeof args.sharedState !== 'object') {
        return false;
    }

    const overriddenReleaseDecision = resolveManualSetupAttemptReleaseOverride({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId,
        engineConfig: args.engineConfig,
    });
    if (overriddenReleaseDecision !== undefined) {
        return overriddenReleaseDecision;
    }
    if (!isManualSetupSelectionActionKind(args.actionKind)) {
        return false;
    }

    const phase = typeof args.sharedState.sys?.phase === 'string'
        ? args.sharedState.sys.phase
        : null;
    const core = args.sharedState.core as {
        hostStarted?: unknown;
        factionSelection?: {
            playerSelections?: Record<string, unknown>;
        };
        selectedFactions?: Record<string, unknown>;
        selectedCharacters?: Record<string, unknown>;
    } | undefined;

    if (args.actionKind === 'select-faction') {
        const selectedByPlayer = core?.factionSelection?.playerSelections?.[args.playerId];
        const selectedFactionIds = Array.isArray(selectedByPlayer)
            ? selectedByPlayer.filter((item): item is string => typeof item === 'string')
            : [];
        if (selectedFactionIds.includes(selectionId)) {
            return true;
        }
        return phase !== null && phase !== 'factionSelect';
    }

    if (args.actionKind === 'setup-select-faction') {
        if (core?.selectedFactions?.[args.playerId] === selectionId) {
            return true;
        }
        return core?.hostStarted === true;
    }

    if (core?.selectedCharacters?.[args.playerId] === selectionId) {
        return true;
    }
    return core?.hostStarted === true;
}

export function shouldReleaseFactionSelectAttemptFromSharedState(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    factionId: string | null | undefined;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean {
    return shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: 'select-faction',
        selectionId: args.factionId,
        engineConfig: args.engineConfig,
    });
}

export function resolveManualSetupSelectionId(args: {
    actionKind: string;
    payload: unknown;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null {
    const overriddenSelectionId = resolveManualSetupSelectionIdOverride({
        actionKind: args.actionKind,
        payload: args.payload,
        engineConfig: args.engineConfig,
    });
    if (overriddenSelectionId !== undefined) {
        return typeof overriddenSelectionId === 'string' ? overriddenSelectionId : null;
    }
    if (!isManualSetupSelectionActionKind(args.actionKind)) {
        return null;
    }

    if (!isPlainRecord(args.payload)) {
        return null;
    }

    if (args.actionKind === 'setup-select-character') {
        return typeof args.payload.characterId === 'string' ? args.payload.characterId : null;
    }

    return typeof args.payload.factionId === 'string' ? args.payload.factionId : null;
}

export function shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt(
    actionKind: string,
    options?: {
        playerId?: string;
        selectionId?: string | null;
        engineConfig?: ManualSetupRecoveryEngineConfig | null;
    },
): boolean {
    const overriddenDecision = options?.playerId
        ? resolveManualSetupSharedConfirmationOverride({
            playerId: options.playerId,
            actionKind,
            selectionId: options.selectionId ?? null,
            engineConfig: options.engineConfig,
        })
        : undefined;
    if (overriddenDecision !== undefined) {
        return overriddenDecision;
    }
    return isManualSetupSelectionActionKind(actionKind);
}

export function resolveManualSetupAttemptReleaseSource(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: string;
    selectionId: string | null | undefined;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): 'shared' | 'seat' | null {
    if (shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.sharedState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
        engineConfig: args.engineConfig,
    })) {
        return 'shared';
    }

    if (shouldReleaseManualSetupAttemptFromSharedState({
        sharedState: args.seatState,
        playerId: args.playerId,
        actionKind: args.actionKind,
        selectionId: args.selectionId,
        engineConfig: args.engineConfig,
    })) {
        return 'seat';
    }

    return null;
}

export function resolveManualSetupSelectionActionKindFromCommand(args: {
    type: string;
    payload: unknown;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): string | null {
    const overriddenActionKind = resolveManualSetupSelectionActionKindOverride(args);
    if (overriddenActionKind !== undefined) {
        return overriddenActionKind;
    }

    if (!isPlainRecord(args.payload)) {
        return null;
    }
    if (typeof args.payload.characterId === 'string') {
        return 'setup-select-character';
    }
    if (typeof args.payload.factionId !== 'string') {
        return null;
    }
    return 'setup-select-faction';
}
