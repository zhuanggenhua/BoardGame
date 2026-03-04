import type {
    MatchStorage,
    MatchMetadata,
    StoredMatchState,
    CreateMatchData,
    FetchOpts,
    FetchResult,
    ListMatchesOpts,
} from '../../engine/transport/storage';
import { mongoStorage, MongoStorage } from './MongoStorage';
import logger from '../../../server/logger';

const DISCONNECT_GRACE_MS = 5 * 60 * 1000;

type OwnerType = 'user' | 'guest';
type StorageTarget = 'mongo' | 'memory';

type MatchSetupData = {
    ttlSeconds?: number;
    ownerKey?: string;
    ownerType?: OwnerType;
};

const parseSetupData = (value: unknown): MatchSetupData => {
    if (!value || typeof value !== 'object') return {};
    const raw = value as Record<string, unknown>;
    const ownerType = raw.ownerType === 'user' || raw.ownerType === 'guest' ? raw.ownerType : undefined;
    return {
        ttlSeconds: typeof raw.ttlSeconds === 'number' ? raw.ttlSeconds : undefined,
        ownerKey: typeof raw.ownerKey === 'string' ? raw.ownerKey : undefined,
        ownerType,
    };
};

const resolveSetupDataFromCreateMatch = (data: CreateMatchData): MatchSetupData => {
    const stateG = data.initialState?.G as Record<string, unknown> | undefined;
    const setupDataFromState = parseSetupData(stateG?.__setupData);
    const setupDataFromMetadata = parseSetupData((data.metadata as { setupData?: unknown } | undefined)?.setupData);
    return { ...setupDataFromMetadata, ...setupDataFromState };
};

const resolveStorageTarget = (setupData: MatchSetupData): StorageTarget => {
    const ownerKey = setupData.ownerKey;
    const ownerType = setupData.ownerType;
    if (ownerType === 'user' || (ownerKey ? ownerKey.startsWith('user:') : false)) return 'mongo';
    if (ownerType === 'guest' || (ownerKey ? ownerKey.startsWith('guest:') : false)) return 'memory';
    return 'memory';
};

const hasConnectedPlayer = (metadata: MatchMetadata): boolean => {
    const players = metadata.players as Record<string, { isConnected?: boolean }> | undefined;
    if (!players) return false;
    return Object.values(players).some(player => Boolean(player?.isConnected));
};

const hasFetchResult = (result: FetchResult, opts: FetchOpts): boolean => {
    if (opts.state && typeof result.state !== 'undefined') return true;
    if (opts.metadata && typeof result.metadata !== 'undefined') return true;
    return false;
};

/**
 * 内存存储（游客房间使用）
 */
class InMemoryStorage {
    private readonly stateMap = new Map<string, StoredMatchState>();
    private readonly metadataMap = new Map<string, MatchMetadata>();

    createMatch(matchID: string, data: CreateMatchData): void {
        this.stateMap.set(matchID, data.initialState);
        this.metadataMap.set(matchID, data.metadata);
    }

    setState(matchID: string, state: StoredMatchState): void {
        this.stateMap.set(matchID, state);
    }

    setMetadata(matchID: string, metadata: MatchMetadata): void {
        this.metadataMap.set(matchID, metadata);
    }

    fetch(matchID: string, opts: FetchOpts): FetchResult {
        const result: FetchResult = {};
        if (opts.state) result.state = this.stateMap.get(matchID);
        if (opts.metadata) result.metadata = this.metadataMap.get(matchID);
        return result;
    }

    wipe(matchID: string): void {
        this.stateMap.delete(matchID);
        this.metadataMap.delete(matchID);
    }

    listMatches(opts?: ListMatchesOpts): string[] {
        return [...this.metadataMap.entries()]
            .filter(([, metadata]) => {
                if (!opts) return true;
                if (opts.gameName !== undefined && metadata.gameName !== opts.gameName) return false;
                if (opts.where) {
                    if (opts.where.isGameover !== undefined) {
                        const isGameover = metadata.gameover !== undefined;
                        if (isGameover !== opts.where.isGameover) return false;
                    }
                    if (opts.where.updatedBefore !== undefined && metadata.updatedAt >= opts.where.updatedBefore) {
                        return false;
                    }
                    if (opts.where.updatedAfter !== undefined && metadata.updatedAt <= opts.where.updatedAfter) {
                        return false;
                    }
                }
                return true;
            })
            .map(([key]) => key);
    }
}

export class HybridStorage implements MatchStorage {
    private readonly mongo: MongoStorage;
    private readonly memory: InMemoryStorage;
    private readonly matchStorage = new Map<string, StorageTarget>();
    private readonly guestOwnerIndex = new Map<string, string>();
    private readonly guestMatchOwner = new Map<string, string>();

    constructor(mongo: MongoStorage) {
        this.mongo = mongo;
        this.memory = new InMemoryStorage();
    }

    async connect(): Promise<void> {
        await this.mongo.connect();
    }

    async createMatch(matchID: string, data: CreateMatchData): Promise<void> {
        const setupData = resolveSetupDataFromCreateMatch(data);
        const target = resolveStorageTarget(setupData);
        const ownerKey = setupData.ownerKey;

        if (target === 'memory') {
            if (ownerKey) {
                const existingMatchID = this.guestOwnerIndex.get(ownerKey);
                if (existingMatchID) {
                    this.memory.wipe(existingMatchID);
                    this.matchStorage.delete(existingMatchID);
                    this.guestMatchOwner.delete(existingMatchID);
                }
                this.guestOwnerIndex.set(ownerKey, matchID);
                this.guestMatchOwner.set(matchID, ownerKey);
            }
            this.matchStorage.set(matchID, 'memory');
            this.memory.createMatch(matchID, data);
            return;
        }

        this.matchStorage.set(matchID, 'mongo');
        await this.mongo.createMatch(matchID, data);
    }

    async setState(matchID: string, state: StoredMatchState): Promise<void> {
        const target = await this.resolveStorageForMatch(matchID);
        if (target === 'mongo') {
            await this.mongo.setState(matchID, state);
            return;
        }
        if (target === 'memory') {
            this.memory.setState(matchID, state);
            return;
        }
        logger.warn(`[HybridStorage] setState 未找到房间 matchID=${matchID}`);
    }

    async setMetadata(matchID: string, metadata: MatchMetadata): Promise<void> {
        const target = await this.resolveStorageForMatch(matchID);
        if (target === 'mongo') {
            await this.mongo.setMetadata(matchID, metadata);
            return;
        }
        if (target === 'memory') {
            const nextMetadata = this.applyDisconnectionSince(metadata);
            this.memory.setMetadata(matchID, nextMetadata);
            return;
        }
        logger.warn(`[HybridStorage] setMetadata 未找到房间 matchID=${matchID}`);
    }

    async fetch(matchID: string, opts: FetchOpts): Promise<FetchResult> {
        const target = this.matchStorage.get(matchID);
        if (target === 'mongo') {
            return await this.mongo.fetch(matchID, opts);
        }
        if (target === 'memory') {
            return this.memory.fetch(matchID, opts);
        }

        const mongoResult = await this.mongo.fetch(matchID, opts);
        if (hasFetchResult(mongoResult, opts)) {
            this.matchStorage.set(matchID, 'mongo');
            return mongoResult;
        }

        const memoryResult = this.memory.fetch(matchID, opts);
        if (hasFetchResult(memoryResult, opts)) {
            this.matchStorage.set(matchID, 'memory');
            return memoryResult;
        }

        return mongoResult;
    }

    async wipe(matchID: string): Promise<void> {
        const target = await this.resolveStorageForMatch(matchID);
        if (target === 'mongo') {
            await this.mongo.wipe(matchID);
        } else if (target === 'memory') {
            this.wipeMemoryMatch(matchID);
        }
        this.matchStorage.delete(matchID);
    }

    async listMatches(opts?: ListMatchesOpts): Promise<string[]> {
        const mongoMatches = await this.mongo.listMatches(opts);
        const memoryMatches = this.memory.listMatches(opts);
        const merged = new Set<string>([...mongoMatches, ...memoryMatches]);
        return Array.from(merged);
    }

    async cleanupEphemeralMatches(graceMs = DISCONNECT_GRACE_MS): Promise<number> {
        const cleanedMongo = await this.mongo.cleanupEphemeralMatches();
        const now = Date.now();
        let cleanedMemory = 0;

        const memoryMatches = this.memory.listMatches();
        for (const matchID of memoryMatches) {
            const { metadata } = this.memory.fetch(matchID, { metadata: true });
            if (!metadata) continue;
            const setupData = parseSetupData((metadata as { setupData?: unknown }).setupData);
            const ttlSeconds = setupData.ttlSeconds ?? 0;
            if (ttlSeconds !== 0) continue;

            const metaWith = metadata as MatchMetadata & { disconnectedSince?: number | null };
            const connected = hasConnectedPlayer(metadata);
            if (connected) {
                if (metaWith.disconnectedSince) {
                    delete metaWith.disconnectedSince;
                    this.memory.setMetadata(matchID, metadata);
                }
                continue;
            }

            const disconnectedSince = typeof metaWith.disconnectedSince === 'number' ? metaWith.disconnectedSince : undefined;
            if (!disconnectedSince) {
                metaWith.disconnectedSince = now;
                this.memory.setMetadata(matchID, metadata);
                continue;
            }

            if (now - disconnectedSince >= graceMs) {
                this.wipeMemoryMatch(matchID);
                cleanedMemory += 1;
            }
        }

        const total = cleanedMongo + cleanedMemory;
        if (total > 0) {
            logger.info(`[HybridStorage] 清理临时房间: ${total} 个 (mongo=${cleanedMongo}, memory=${cleanedMemory})`);
        }
        return total;
    }

    private async resolveStorageForMatch(matchID: string): Promise<StorageTarget | null> {
        const cached = this.matchStorage.get(matchID);
        if (cached) return cached;

        const mongoCheck = await this.mongo.fetch(matchID, { metadata: true });
        if (mongoCheck?.metadata) {
            this.matchStorage.set(matchID, 'mongo');
            return 'mongo';
        }

        const memoryCheck = this.memory.fetch(matchID, { metadata: true });
        if (memoryCheck?.metadata) {
            this.matchStorage.set(matchID, 'memory');
            return 'memory';
        }

        return null;
    }

    private wipeMemoryMatch(matchID: string): void {
        this.memory.wipe(matchID);
        const ownerKey = this.guestMatchOwner.get(matchID);
        if (ownerKey) {
            this.guestOwnerIndex.delete(ownerKey);
            this.guestMatchOwner.delete(matchID);
        }
    }

    private applyDisconnectionSince(metadata: MatchMetadata): MatchMetadata {
        const setupData = parseSetupData((metadata as { setupData?: unknown }).setupData);
        const ttlSeconds = setupData.ttlSeconds ?? 0;
        const nextMetadata = metadata as MatchMetadata & { disconnectedSince?: number | null };
        if (ttlSeconds !== 0) {
            if (nextMetadata.disconnectedSince) {
                delete nextMetadata.disconnectedSince;
            }
            return metadata;
        }

        const connected = hasConnectedPlayer(metadata);
        if (connected) {
            if (nextMetadata.disconnectedSince) {
                delete nextMetadata.disconnectedSince;
            }
            return metadata;
        }

        if (!nextMetadata.disconnectedSince) {
            nextMetadata.disconnectedSince = Date.now();
        }
        return metadata;
    }
}

export const hybridStorage = new HybridStorage(mongoStorage);
