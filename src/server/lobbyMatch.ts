import { resolveSeatPlayerDisplayName } from '../engine/ai';
import type { MatchMetadata } from '../engine/transport/storage';
import { resolveMatchStatus } from '../engine/transport/storage';
import type { LobbyMatch } from '../shared/lobby';
import { buildGamePublicRoomSummary } from '../games/serverLobbySummary';

type SetupDataRecord = (Record<string, unknown> & {
    seatControllers?: Record<string, unknown>;
}) | undefined;

export interface MatchDetailPayload {
    matchID: string;
    gameName: string;
    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
    setupData?: unknown;
    createdAt: number;
    updatedAt: number;
    gameover?: unknown;
    status: 'waiting' | 'playing' | 'finished';
}

function readSetupDataRecord(metadata: MatchMetadata): SetupDataRecord {
    return metadata.setupData && typeof metadata.setupData === 'object' && !Array.isArray(metadata.setupData)
        ? metadata.setupData as SetupDataRecord
        : undefined;
}

function normalizeGameName(name?: string): string {
    return (name || '').toLowerCase();
}

function buildMatchPlayers(metadata: MatchMetadata): Array<{ id: number; name?: string; isConnected?: boolean }> {
    const setupDataRecord = readSetupDataRecord(metadata);
    const seatControllers = setupDataRecord?.seatControllers;

    return Object.entries(metadata.players).map(([id, data]) => ({
        id: Number(id),
        name: resolveSeatPlayerDisplayName({
            playerId: id,
            name: data.name,
            seatControllers,
        }),
        isConnected: data.isConnected,
    }));
}

export function buildLobbyMatch(matchID: string, metadata: MatchMetadata, runtimeState?: unknown): LobbyMatch {
    const normalizedGameName = normalizeGameName(metadata.gameName);
    const setupDataRecord = readSetupDataRecord(metadata);
    const players = buildMatchPlayers(metadata);

    return {
        matchID,
        gameName: metadata.gameName,
        players,
        totalSeats: players.length,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        roomName: typeof setupDataRecord?.roomName === 'string' ? setupDataRecord.roomName : undefined,
        ownerKey: typeof setupDataRecord?.ownerKey === 'string' ? setupDataRecord.ownerKey : undefined,
        ownerType: setupDataRecord?.ownerType === 'user' || setupDataRecord?.ownerType === 'guest'
            ? setupDataRecord.ownerType
            : undefined,
        isLocked: typeof setupDataRecord?.password === 'string' && setupDataRecord.password.length > 0,
        publicSetupSummary: buildGamePublicRoomSummary(normalizedGameName, setupDataRecord, runtimeState),
        gameover: !!metadata.gameover,
        status: resolveMatchStatus(metadata),
    };
}

export function buildMatchDetailPayload(matchID: string, metadata: MatchMetadata): MatchDetailPayload {
    return {
        matchID,
        gameName: metadata.gameName,
        players: buildMatchPlayers(metadata),
        setupData: metadata.setupData,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        gameover: metadata.gameover,
        status: resolveMatchStatus(metadata),
    };
}
