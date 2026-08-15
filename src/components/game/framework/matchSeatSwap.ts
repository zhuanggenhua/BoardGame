import type { AiSeatController } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import { resolveOrderedPlayerIds } from './playerDisplay';

type CoreRecord = Record<string, unknown>;
export type MatchSeatSwapMode = 'request' | 'instant';

export type MatchSeatSwapConfig = {
    mode: MatchSeatSwapMode;
    requestCommandType: string;
    respondCommandType?: string | null;
    cancelCommandType?: string | null;
};

export interface PendingSeatSwapRequest {
    requesterId: string;
    targetPlayerId: string;
}

export interface MatchSeatSwapContext {
    seatSwapMode: MatchSeatSwapMode;
    seatingOrder: string[];
    seatControllerTypeByPlayerId: Record<string, string>;
    pendingSeatSwapRequest: PendingSeatSwapRequest | null;
    requestSeatSwapCommandType: string;
    respondSeatSwapCommandType: string | null;
    cancelSeatSwapCommandType: string | null;
}

export interface ResolveMatchSeatSwapContextArgs {
    seatSwapConfig?: MatchSeatSwapConfig | null;
    state?: MatchState<unknown> | null;
    myPlayerId?: string | null;
    seatControllers?: Record<string, AiSeatController>;
}

function isRecord(value: unknown): value is CoreRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canUseSeatSwap(seatSwapMode: MatchSeatSwapMode, state: MatchState<unknown>, coreRecord: CoreRecord): boolean {
    const sysPhase = state.sys?.phase;
    const corePhase = typeof coreRecord.phase === 'string' ? coreRecord.phase : null;
    const hasFactionSelectionState = isRecord(coreRecord.factionSelection) || isRecord(coreRecord.selectedFactions);
    const isSetupNotStarted = coreRecord.hostStarted !== true;

    if (seatSwapMode === 'request') {
        return (
            sysPhase === 'setup'
            || sysPhase === 'factionSelect'
            || corePhase === 'setup'
            || corePhase === 'factionSelect'
        );
    }

    return (
        isSetupNotStarted
        && (
            sysPhase === 'setup'
            || sysPhase === 'factionSelect'
            || corePhase === 'factionSelect'
            || hasFactionSelectionState
        )
    );
}

function resolveSeatingOrder(coreRecord: CoreRecord): string[] {
    const preferredOrder = Array.isArray(coreRecord.seatingOrder)
        ? coreRecord.seatingOrder.filter((playerId): playerId is string => typeof playerId === 'string')
        : [];
    const turnOrder = Array.isArray(coreRecord.turnOrder)
        ? coreRecord.turnOrder.filter((playerId): playerId is string => typeof playerId === 'string')
        : [];
    const players = isRecord(coreRecord.players)
        ? coreRecord.players as Record<string, unknown>
        : undefined;
    const playerIds = Object.keys(players ?? {});
    const startingPlayerId = typeof coreRecord.startingPlayerId === 'string'
        ? coreRecord.startingPlayerId
        : null;
    const rotatedPlayerIds = (
        startingPlayerId
        && playerIds.length > 1
        && playerIds.includes(startingPlayerId)
    )
        ? [startingPlayerId, ...playerIds.filter((playerId) => playerId !== startingPlayerId)]
        : [];

    return resolveOrderedPlayerIds({
        preferredOrder,
        fallbackOrder: turnOrder.length > 0 ? turnOrder : rotatedPlayerIds,
        players,
    });
}

function resolveSeatControllerTypeByPlayerId(
    seatingOrder: string[],
    coreRecord: CoreRecord,
    seatControllers: Record<string, AiSeatController>,
): Record<string, string> {
    const seatControllerTypeByPlayerId: Record<string, string> = {};
    const coreSeatControllers = isRecord(coreRecord.seatControllers)
        ? coreRecord.seatControllers as Record<string, unknown>
        : {};

    for (const playerId of seatingOrder) {
        const coreController = coreSeatControllers[playerId];
        if (isRecord(coreController) && typeof coreController.type === 'string') {
            seatControllerTypeByPlayerId[playerId] = coreController.type;
            continue;
        }

        const fallbackControllerType = seatControllers[playerId]?.type;
        if (typeof fallbackControllerType === 'string') {
            seatControllerTypeByPlayerId[playerId] = fallbackControllerType;
        }
    }

    return seatControllerTypeByPlayerId;
}

function resolvePendingSeatSwapRequest(
    seatSwapMode: MatchSeatSwapMode,
    coreRecord: CoreRecord,
): PendingSeatSwapRequest | null {
    if (seatSwapMode !== 'request' || !isRecord(coreRecord.seatSwapRequest)) {
        return null;
    }

    const requesterId = coreRecord.seatSwapRequest.requesterId;
    const targetPlayerId = coreRecord.seatSwapRequest.targetPlayerId;
    if (typeof requesterId !== 'string' || typeof targetPlayerId !== 'string') {
        return null;
    }

    return {
        requesterId,
        targetPlayerId,
    };
}

export function resolveMatchSeatSwapContext({
    seatSwapConfig,
    state,
    myPlayerId,
    seatControllers = {},
}: ResolveMatchSeatSwapContextArgs): MatchSeatSwapContext | null {
    if (!seatSwapConfig || !state || myPlayerId == null || !isRecord(state.core)) {
        return null;
    }

    const seatSwapMode = seatSwapConfig.mode;
    const normalizedMyPlayerId = String(myPlayerId);
    const coreRecord = state.core as CoreRecord;
    if (!canUseSeatSwap(seatSwapMode, state, coreRecord)) {
        return null;
    }

    const seatingOrder = resolveSeatingOrder(coreRecord);
    if (seatingOrder.length < 2 || !seatingOrder.includes(normalizedMyPlayerId)) {
        return null;
    }

    return {
        seatSwapMode,
        seatingOrder,
        seatControllerTypeByPlayerId: resolveSeatControllerTypeByPlayerId(seatingOrder, coreRecord, seatControllers),
        pendingSeatSwapRequest: resolvePendingSeatSwapRequest(seatSwapMode, coreRecord),
        requestSeatSwapCommandType: seatSwapConfig.requestCommandType,
        respondSeatSwapCommandType: seatSwapConfig.respondCommandType ?? null,
        cancelSeatSwapCommandType: seatSwapConfig.cancelCommandType ?? null,
    };
}
