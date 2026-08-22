import type { MatchState, PlayerId, RandomFn } from '../types';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import { getAiSeatIds } from '../ai';
import type { AuthoritativeCommandQueueItem } from './authoritativeCommandQueue';
import type { GameEngineConfig } from './engineConfig';
import { extractTrustedSetupSeatControllers } from './onlineAiSeatControllers';
import type { MatchMetadata, MatchStorage, StoredMatchState } from './storage';
import { createTrackedRandom } from './trackedRandom';

export type MatchRoomRegistryActiveMatch<CommandOptions = unknown> = {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    playerIds: PlayerId[];
    stateID: number;
    connections: Map<string, Set<string>>;
    spectatorSockets: Set<string>;
    offlineTimers: Map<string, ReturnType<typeof setTimeout>>;
    lastBroadcastedViews: Map<string, unknown>;
    lastCommandPlayerId: string | null;
    executing: boolean;
    unloaded: boolean;
    commandQueue: Array<AuthoritativeCommandQueueItem<CommandOptions>>;
    lastCommandFailureReason: string | null;
};

export type MatchRoomRegistryConfig = {
    storage: MatchStorage;
    gameIndex: Map<string, GameEngineConfig>;
};

export const resolveStoredRandomSeed = (
    state: StoredMatchState,
    matchID: string,
): string => {
    const storedSeed = (state as { randomSeed?: unknown }).randomSeed;
    return typeof storedSeed === 'string' && storedSeed.length > 0 ? storedSeed : matchID;
};

export const resolveStoredRandomCursor = (state: StoredMatchState): number => {
    const storedCursor = (state as { randomCursor?: unknown }).randomCursor;
    if (typeof storedCursor !== 'number' || !Number.isFinite(storedCursor) || storedCursor < 0) {
        return 0;
    }
    return Math.floor(storedCursor);
};

export class MatchRoomRegistry<CommandOptions = unknown> {
    private readonly activeMatches = new Map<string, MatchRoomRegistryActiveMatch<CommandOptions>>();
    private readonly storage: MatchStorage;
    private readonly gameIndex: Map<string, GameEngineConfig>;

    constructor(config: MatchRoomRegistryConfig) {
        this.storage = config.storage;
        this.gameIndex = config.gameIndex;
    }

    get(matchID: string): MatchRoomRegistryActiveMatch<CommandOptions> | undefined {
        return this.activeMatches.get(matchID);
    }

    values(): IterableIterator<MatchRoomRegistryActiveMatch<CommandOptions>> {
        return this.activeMatches.values();
    }

    set(matchID: string, match: MatchRoomRegistryActiveMatch<CommandOptions>): void {
        this.activeMatches.set(matchID, match);
    }

    delete(matchID: string): boolean {
        return this.activeMatches.delete(matchID);
    }

    replaceMetadata(matchID: string, metadata: MatchMetadata): void {
        const active = this.activeMatches.get(matchID);
        if (active) {
            active.metadata = metadata;
        }
    }

    mergeMetadata(matchID: string, metadata: MatchMetadata): void {
        const active = this.activeMatches.get(matchID);
        if (!active) {
            return;
        }
        active.metadata = {
            ...active.metadata,
            ...metadata,
            players: metadata.players,
        };
    }

    async getOrLoad(matchID: string): Promise<MatchRoomRegistryActiveMatch<CommandOptions> | undefined> {
        return this.activeMatches.get(matchID) ?? this.load(matchID);
    }

    async load(matchID: string): Promise<MatchRoomRegistryActiveMatch<CommandOptions> | undefined> {
        const result = await this.storage.fetch(matchID, { state: true, metadata: true });
        if (!result.state || !result.metadata) {
            return undefined;
        }

        const match = this.buildLoadedMatch(matchID, result.state, result.metadata);
        if (!match) {
            return undefined;
        }
        this.activeMatches.set(matchID, match);
        return match;
    }

    activeMatchesForLegacyAccess(): Map<string, MatchRoomRegistryActiveMatch<CommandOptions>> {
        return this.activeMatches;
    }

    private buildLoadedMatch(
        matchID: string,
        storedState: StoredMatchState,
        metadata: MatchMetadata,
    ): MatchRoomRegistryActiveMatch<CommandOptions> | undefined {
        const gameId = metadata.gameName;
        const engineConfig = this.gameIndex.get(gameId);
        if (!engineConfig) {
            return undefined;
        }

        const state = setUndoAiSeatIds(
            storedState.G as MatchState<unknown>,
            getAiSeatIds(extractTrustedSetupSeatControllers(metadata.setupData)),
        );
        const randomSeed = resolveStoredRandomSeed(storedState, matchID);
        const randomCursor = resolveStoredRandomCursor(storedState);
        const trackedRandom = createTrackedRandom(randomSeed, randomCursor);

        return {
            matchID,
            gameId,
            engineConfig,
            state,
            metadata,
            randomSeed,
            random: trackedRandom.random,
            getRandomCursor: trackedRandom.getCursor,
            playerIds: Object.keys(metadata.players) as PlayerId[],
            stateID: storedState._stateID,
            lastCommandPlayerId: null,
            connections: new Map(),
            spectatorSockets: new Set(),
            offlineTimers: new Map(),
            lastBroadcastedViews: new Map(),
            executing: false,
            unloaded: false,
            commandQueue: [],
            lastCommandFailureReason: null,
        };
    }
}
