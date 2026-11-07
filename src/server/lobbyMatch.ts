import { type AiSeatController, isAiSeatControllerLike, resolveSeatPlayerDisplayName } from '../engine/ai';
import type { MatchMetadata } from '../engine/transport/storage';
import { resolveMatchStatus } from '../engine/transport/storage';
import type { LobbyMatch, PublicSetupSummary } from '../shared/lobby';
import { buildGamePublicRoomSummary } from '../games/serverLobbySummary';

type SetupDataRecord = (Record<string, unknown> & {
    seatControllers?: Record<string, unknown>;
}) | undefined;

export interface PublicRoomSetupData {
    roomName?: string;
    ownerType?: 'user' | 'guest';
    enableAi?: boolean;
    seatControllers?: Record<string, AiSeatController>;
}

export interface MatchDetailPayload {
    matchID: string;
    gameName: string;
    players: Array<{ id: number; name?: string; isConnected?: boolean; isAi: boolean }>;
    setupData: PublicRoomSetupData;
    isLocked: boolean;
    publicSetupSummary?: PublicSetupSummary;
    createdAt: number;
    updatedAt: number;
    gameover: boolean;
    status: 'waiting' | 'playing' | 'finished';
}

function readSetupDataRecord(metadata: MatchMetadata): SetupDataRecord {
    return metadata.setupData && typeof metadata.setupData === 'object' && !Array.isArray(metadata.setupData)
        ? metadata.setupData as SetupDataRecord
        : undefined;
}

// Public metadata is a read model, never a rematch configuration source.
function buildPublicSetupData(metadata: MatchMetadata): PublicRoomSetupData {
    const source = readSetupDataRecord(metadata);
    const result: PublicRoomSetupData = {};
    if (typeof source?.roomName === 'string') result.roomName = source.roomName;
    if (source?.ownerType === 'user' || source?.ownerType === 'guest') result.ownerType = source.ownerType;
    if (typeof source?.enableAi === 'boolean') result.enableAi = source.enableAi;
    const rawControllers = source?.seatControllers;
    if (rawControllers && typeof rawControllers === 'object' && !Array.isArray(rawControllers)) {
        const controllers: Record<string, AiSeatController> = {};
        for (const playerId of Object.keys(metadata.players)) {
            if (!/^(0|[1-9]\d*)$/.test(playerId)) continue;
            const raw = rawControllers[playerId];
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            const input = raw as Record<string, unknown>;
            let controller: AiSeatController;
            if (input.type === 'human') {
                controllers[playerId] = { type: 'human' };
                continue;
            } else if (input.type === 'local-ai') {
                controller = { type: 'local-ai' };
                if (typeof input.policyId === 'string') controller.policyId = input.policyId;
                if (input.difficulty === 'easy' || input.difficulty === 'normal' || input.difficulty === 'hard' || input.difficulty === 'expert') {
                    controller.difficulty = input.difficulty;
                }
            } else if (input.type === 'remote-ai' && typeof input.providerId === 'string') {
                controller = { type: 'remote-ai', providerId: input.providerId };
                if (typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs)) controller.timeoutMs = input.timeoutMs;
                if (typeof input.retryCount === 'number' && Number.isFinite(input.retryCount)) controller.retryCount = input.retryCount;
            } else {
                continue;
            }
            if (typeof input.fallbackPolicyId === 'string') controller.fallbackPolicyId = input.fallbackPolicyId;
            if (typeof input.minimumActionDelayMs === 'number' && Number.isFinite(input.minimumActionDelayMs)) controller.minimumActionDelayMs = input.minimumActionDelayMs;
            if (typeof input.manualSetupSelection === 'boolean') controller.manualSetupSelection = input.manualSetupSelection;
            if (typeof input.manualFactionSelection === 'boolean') controller.manualFactionSelection = input.manualFactionSelection;
            controllers[playerId] = controller;
        }
        result.seatControllers = controllers;
    }
    return result;
}

function normalizeGameName(name?: string): string {
    return (name || '').toLowerCase();
}

function buildMatchPlayers(metadata: MatchMetadata): Array<{ id: number; name?: string; isConnected?: boolean; isAi: boolean }> {
    const setupDataRecord = readSetupDataRecord(metadata);
    const seatControllers = setupDataRecord?.seatControllers;

    return Object.entries(metadata.players).map(([id, data]) => ({
        id: Number(id),
        name: resolveSeatPlayerDisplayName({
            playerId: id,
            name: typeof data.name === 'string' ? data.name : undefined,
            seatControllers,
        }),
        isConnected: typeof data.isConnected === 'boolean' ? data.isConnected : undefined,
        isAi: isAiSeatControllerLike(seatControllers?.[String(id)]),
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
    const setupDataRecord = readSetupDataRecord(metadata);
    return {
        matchID,
        gameName: metadata.gameName,
        players: buildMatchPlayers(metadata),
        setupData: buildPublicSetupData(metadata),
        isLocked: typeof setupDataRecord?.password === 'string' && setupDataRecord.password.length > 0,
        publicSetupSummary: buildGamePublicRoomSummary(normalizeGameName(metadata.gameName), setupDataRecord),
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        gameover: !!metadata.gameover,
        status: resolveMatchStatus(metadata),
    };
}
