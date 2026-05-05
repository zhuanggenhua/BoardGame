import { useMemo } from 'react';
import type { MatchPlayerInfo } from '../../../engine/transport/protocol';
import type { MatchState } from '../../../engine/types';
import {
    buildPlayerDisplayNameMap,
    getCompactPlayerBadgeLabel,
    resolveOrderedPlayerIds,
    type PlayerDisplayNameMap,
} from './playerDisplay';

type UnknownRecord = Record<string, unknown>;
type RawPlayerId = string | number;

export interface MatchPlayerViewModel {
    orderedPlayerIds: string[];
    playerNames: PlayerDisplayNameMap;
    playerOrderLabels: Record<string, string>;
    selfPlayerId?: string;
    selfPlayerName?: string;
    turnPlayerId?: string;
    turnPlayerName?: string;
    activeActorId?: string;
    activeActorName?: string;
    getPlayerName: (playerId: string | null | undefined) => string;
    getPlayerOrderLabel: (playerId: string | null | undefined) => string;
    getPlayerBadgeLabel: (playerId: string | null | undefined, maxChars?: number) => string;
}

export interface MatchPlayerViewModelResolverContext<TCore> {
    state?: MatchState<TCore> | null;
    core?: TCore | null;
    playerID: string | null;
    orderedPlayerIds: string[];
    matchData?: MatchPlayerInfo[];
}

export interface BuildMatchPlayerViewModelOptions<TCore> {
    state?: MatchState<TCore> | null;
    core?: TCore | null;
    playerID?: string | null;
    matchData?: MatchPlayerInfo[];
    getFallbackName?: (playerId: string) => string;
    resolvePlayers?: (core: TCore) => Record<string, unknown> | null | undefined;
    resolvePreferredOrder?: (context: MatchPlayerViewModelResolverContext<TCore>) => readonly RawPlayerId[] | null | undefined;
    resolveFallbackOrder?: (context: MatchPlayerViewModelResolverContext<TCore>) => readonly RawPlayerId[] | null | undefined;
    resolveSelfPlayerId?: (context: MatchPlayerViewModelResolverContext<TCore>) => RawPlayerId | null | undefined;
    resolveTurnPlayerId?: (context: MatchPlayerViewModelResolverContext<TCore>) => RawPlayerId | null | undefined;
    resolveActiveActorId?: (context: MatchPlayerViewModelResolverContext<TCore> & { turnPlayerId?: string }) => RawPlayerId | null | undefined;
}

function normalizePlayerId(playerId: RawPlayerId | null | undefined): string | undefined {
    if (playerId === null || playerId === undefined) {
        return undefined;
    }
    return String(playerId);
}

function isRecord(value: unknown): value is UnknownRecord {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function defaultFallbackPlayerName(playerId: string): string {
    const numericPlayerId = Number(playerId);
    return Number.isFinite(numericPlayerId) ? `P${numericPlayerId + 1}` : playerId;
}

function defaultFallbackPlayerOrderLabel(playerId: string): string {
    const numericPlayerId = Number(playerId);
    return Number.isFinite(numericPlayerId) ? `P${numericPlayerId + 1}` : playerId;
}

function inferPlayers(core: unknown): Record<string, unknown> | undefined {
    if (!isRecord(core) || !isRecord(core.players)) {
        return undefined;
    }
    return core.players;
}

function inferPreferredOrder(core: unknown): readonly RawPlayerId[] | undefined {
    if (!isRecord(core)) {
        return undefined;
    }
    if (Array.isArray(core.seatOrder)) {
        return core.seatOrder as readonly RawPlayerId[];
    }
    if (Array.isArray(core.seatingOrder)) {
        return core.seatingOrder as readonly RawPlayerId[];
    }
    return undefined;
}

function inferFallbackOrder(core: unknown): readonly RawPlayerId[] | undefined {
    if (!isRecord(core)) {
        return undefined;
    }
    if (Array.isArray(core.playerOrder)) {
        return core.playerOrder as readonly RawPlayerId[];
    }
    if (Array.isArray(core.turnOrder)) {
        return core.turnOrder as readonly RawPlayerId[];
    }
    return undefined;
}

function inferTurnPlayerId(core: unknown): RawPlayerId | undefined {
    if (!isRecord(core)) {
        return undefined;
    }
    if (typeof core.activePlayerId === 'string' || typeof core.activePlayerId === 'number') {
        return core.activePlayerId as RawPlayerId;
    }
    if (typeof core.currentPlayer === 'string' || typeof core.currentPlayer === 'number') {
        return core.currentPlayer as RawPlayerId;
    }
    if (typeof core.currentPlayerId === 'string' || typeof core.currentPlayerId === 'number') {
        return core.currentPlayerId as RawPlayerId;
    }
    if (Array.isArray(core.turnOrder) && typeof core.currentPlayerIndex === 'number') {
        return (core.turnOrder as readonly RawPlayerId[])[core.currentPlayerIndex];
    }
    return undefined;
}

function buildNameSourcePlayerIds(
    orderedPlayerIds: string[],
    players: Record<string, unknown> | undefined,
    matchData: MatchPlayerInfo[] | undefined,
    playerID: string | null,
): string[] {
    const mergedPlayerIds: string[] = [];
    const seen = new Set<string>();

    const append = (rawPlayerId: RawPlayerId | null | undefined) => {
        const normalizedPlayerId = normalizePlayerId(rawPlayerId);
        if (!normalizedPlayerId || seen.has(normalizedPlayerId)) {
            return;
        }
        seen.add(normalizedPlayerId);
        mergedPlayerIds.push(normalizedPlayerId);
    };

    orderedPlayerIds.forEach(append);
    Object.keys(players ?? {}).forEach(append);
    matchData?.forEach((player) => append(player.id));
    append(playerID);

    return mergedPlayerIds;
}

export function buildMatchPlayerViewModel<TCore>(
    options: BuildMatchPlayerViewModelOptions<TCore>,
): MatchPlayerViewModel {
    const state = options.state ?? null;
    const core = options.core ?? state?.core ?? null;
    const playerID = options.playerID ?? null;
    const baseResolverContext: MatchPlayerViewModelResolverContext<TCore> = {
        state,
        core,
        playerID,
        orderedPlayerIds: [],
        matchData: options.matchData,
    };

    const players = core
        ? (options.resolvePlayers?.(core) ?? inferPlayers(core))
        : undefined;
    const preferredOrder = core
        ? (options.resolvePreferredOrder?.(baseResolverContext) ?? inferPreferredOrder(core))
        : undefined;
    const fallbackOrder = core
        ? (options.resolveFallbackOrder?.(baseResolverContext) ?? inferFallbackOrder(core))
        : undefined;
    const orderedPlayerIds = resolveOrderedPlayerIds({
        preferredOrder,
        fallbackOrder,
        players,
    });
    const resolverContext: MatchPlayerViewModelResolverContext<TCore> = {
        ...baseResolverContext,
        orderedPlayerIds,
    };
    const getFallbackName = options.getFallbackName ?? defaultFallbackPlayerName;
    const playerNames = buildPlayerDisplayNameMap(
        buildNameSourcePlayerIds(orderedPlayerIds, players, options.matchData, playerID),
        options.matchData,
        getFallbackName,
    );
    const playerOrderLabels = Object.fromEntries(
        orderedPlayerIds.map((targetPlayerId, index) => [targetPlayerId, `P${index + 1}`]),
    ) as Record<string, string>;
    const getPlayerName = (targetPlayerId: string | null | undefined): string => {
        const normalizedPlayerId = normalizePlayerId(targetPlayerId);
        if (!normalizedPlayerId) {
            return '';
        }
        return playerNames[normalizedPlayerId] ?? getFallbackName(normalizedPlayerId);
    };
    const getPlayerOrderLabel = (targetPlayerId: string | null | undefined): string => {
        const normalizedPlayerId = normalizePlayerId(targetPlayerId);
        if (!normalizedPlayerId) {
            return '';
        }
        return playerOrderLabels[normalizedPlayerId] ?? defaultFallbackPlayerOrderLabel(normalizedPlayerId);
    };
    const selfPlayerId = normalizePlayerId(
        options.resolveSelfPlayerId?.(resolverContext)
        ?? playerID
        ?? orderedPlayerIds[0],
    );
    const turnPlayerId = normalizePlayerId(
        options.resolveTurnPlayerId?.(resolverContext)
        ?? inferTurnPlayerId(core),
    );
    const activeActorId = normalizePlayerId(
        options.resolveActiveActorId?.({
            ...resolverContext,
            turnPlayerId,
        })
        ?? turnPlayerId,
    );

    return {
        orderedPlayerIds,
        playerNames,
        playerOrderLabels,
        selfPlayerId,
        selfPlayerName: selfPlayerId ? getPlayerName(selfPlayerId) : undefined,
        turnPlayerId,
        turnPlayerName: turnPlayerId ? getPlayerName(turnPlayerId) : undefined,
        activeActorId,
        activeActorName: activeActorId ? getPlayerName(activeActorId) : undefined,
        getPlayerName,
        getPlayerOrderLabel,
        getPlayerBadgeLabel: (targetPlayerId, maxChars = 2) => getCompactPlayerBadgeLabel(getPlayerName(targetPlayerId), maxChars),
    };
}

export function useMatchPlayerViewModel<TCore>(
    options: BuildMatchPlayerViewModelOptions<TCore>,
): MatchPlayerViewModel {
    return useMemo(() => buildMatchPlayerViewModel(options), [options]);
}
