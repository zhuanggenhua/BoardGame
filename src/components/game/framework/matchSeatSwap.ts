import type { AiSeatController } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import { resolveOrderedPlayerIds } from './playerDisplay';

type CoreRecord = Record<string, unknown>;

export type MatchSeatSwapMode = 'request' | 'instant';

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
    gameId?: string | null;
    state?: MatchState<unknown> | null;
    myPlayerId?: string | null;
    seatControllers?: Record<string, AiSeatController>;
}

function isRecord(value: unknown): value is CoreRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function resolveSeatSwapMode(gameId?: string | null): MatchSeatSwapMode | null {
    if (gameId === 'dicethrone') {
        return 'request';
    }
    if (gameId === 'smashup' || gameId === 'summonerwars') {
        return 'instant';
    }
    return null;
}

function resolveSeatSwapCommandTypes(gameId?: string | null): Pick<
    MatchSeatSwapContext,
    'requestSeatSwapCommandType' | 'respondSeatSwapCommandType' | 'cancelSeatSwapCommandType'
> | null {
    if (gameId === 'dicethrone') {
        return {
            requestSeatSwapCommandType: 'REQUEST_SEAT_SWAP',
            respondSeatSwapCommandType: 'RESPOND_SEAT_SWAP',
            cancelSeatSwapCommandType: 'CANCEL_SEAT_SWAP',
        };
    }

    if (gameId === 'smashup') {
        return {
            requestSeatSwapCommandType: 'su:swap_seat',
            respondSeatSwapCommandType: null,
            cancelSeatSwapCommandType: null,
        };
    }

    if (gameId === 'summonerwars') {
        return {
            requestSeatSwapCommandType: 'sw:swap_seat',
            respondSeatSwapCommandType: null,
            cancelSeatSwapCommandType: null,
        };
    }

    return null;
}

function canUseSeatSwap(seatSwapMode: MatchSeatSwapMode, state: MatchState<unknown>, coreRecord: CoreRecord): boolean {
    const sysPhase = state.sys?.phase;
    const corePhase = typeof coreRecord.phase === 'string' ? coreRecord.phase : null;
    const hasFactionSelectionState = isRecord(coreRecord.factionSelection) || isRecord(coreRecord.selectedFactions);
    const isSetupNotStarted = coreRecord.hostStarted === false;

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
    gameId,
    state,
    myPlayerId,
    seatControllers = {},
}: ResolveMatchSeatSwapContextArgs): MatchSeatSwapContext | null {
    const seatSwapMode = resolveSeatSwapMode(gameId);
    const commandTypes = resolveSeatSwapCommandTypes(gameId);
    if (!seatSwapMode || !commandTypes || !state || myPlayerId == null || !isRecord(state.core)) {
        return null;
    }

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
        ...commandTypes,
    };
}
