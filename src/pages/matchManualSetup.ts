import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import type { GameEngineConfig } from '../engine/transport/server';

export type ManualSetupSelectionActionKind =
    | 'select-faction'
    | 'setup-select-faction'
    | 'setup-select-character';

const MANUAL_SETUP_SELECTION_ACTION_KINDS = new Set([
    'select-faction',
    'setup-select-faction',
    'setup-select-character',
]);

type ManualSetupRecoveryEngineConfig = Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isManualSetupSelectionActionKind(kind: string): kind is ManualSetupSelectionActionKind {
    return MANUAL_SETUP_SELECTION_ACTION_KINDS.has(kind);
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
    actionKind: ManualSetupSelectionActionKind;
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

export function shouldTakeOverManualSetupSelection(args: {
    sharedState: MatchState<unknown> | null | undefined;
    currentPlayerId: string | null;
    seatControllers: Record<string, AiSeatController>;
    hasManualDispatch: boolean;
    engineConfig?: ManualSetupRecoveryEngineConfig | null;
}): boolean {
    return resolveManualSetupSelectionTakeoverPlayerId(args) !== null;
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
        .filter(([, controller]) => controller.type !== 'human' && controller.manualFactionSelection === true)
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

    if (isPlainRecord(core.selectedFactions)) {
        if (args.currentPlayerId && args.seatControllers[args.currentPlayerId]?.type === 'human') {
            const currentPlayerFaction = core.selectedFactions?.[args.currentPlayerId];
            if (typeof currentPlayerFaction !== 'string' || currentPlayerFaction === 'unselected') {
                return null;
            }
        }
        return manualAiSeatIds.find((playerId) => {
            const selectedFaction = core.selectedFactions?.[playerId];
            return typeof selectedFaction !== 'string' || selectedFaction === 'unselected';
        }) ?? null;
    }

    if (isPlainRecord(core.selectedCharacters)) {
        if (args.currentPlayerId && args.seatControllers[args.currentPlayerId]?.type === 'human') {
            const currentPlayerCharacter = core.selectedCharacters?.[args.currentPlayerId];
            if (typeof currentPlayerCharacter !== 'string' || currentPlayerCharacter === 'unselected') {
                return null;
            }
        }
        return manualAiSeatIds.find((playerId) => {
            const selectedCharacter = core.selectedCharacters?.[playerId];
            return typeof selectedCharacter !== 'string' || selectedCharacter === 'unselected';
        }) ?? null;
    }

    return null;
}

export function shouldReleaseManualSetupAttemptFromSharedState(args: {
    sharedState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
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
}): string | null {
    if (!isManualSetupSelectionActionKind(args.actionKind) || !isPlainRecord(args.payload)) {
        return null;
    }

    if (args.actionKind === 'setup-select-character') {
        return typeof args.payload.characterId === 'string' ? args.payload.characterId : null;
    }

    return typeof args.payload.factionId === 'string' ? args.payload.factionId : null;
}

export function shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt(actionKind: string): boolean {
    return isManualSetupSelectionActionKind(actionKind);
}

export function resolveManualSetupAttemptReleaseSource(args: {
    sharedState: MatchState<unknown> | null | undefined;
    seatState: MatchState<unknown> | null | undefined;
    playerId: string;
    actionKind: ManualSetupSelectionActionKind;
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
}): ManualSetupSelectionActionKind | null {
    if (!isPlainRecord(args.payload)) {
        return null;
    }
    if (typeof args.payload.characterId === 'string') {
        return 'setup-select-character';
    }
    if (typeof args.payload.factionId !== 'string') {
        return null;
    }
    return args.type === 'su:select_faction'
        ? 'select-faction'
        : 'setup-select-faction';
}
