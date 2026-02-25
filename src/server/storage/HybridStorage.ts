/**
 * 统一存储层
 *
 * 历史上区分 user→MongoDB / guest→内存，导致游客对局在服务重启后丢失。
 * 现在统一走 MongoDB，游客和注册用户的房间享有相同的持久化和清理策略。
 *
 * HybridStorage 保留为 MongoStorage 的薄代理，维持对外接口不变。
 */

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

export class HybridStorage implements MatchStorage {
    private readonly mongo: MongoStorage;

    constructor(mongo: MongoStorage) {
        this.mongo = mongo;
    }

    async connect(): Promise<void> {
        await this.mongo.connect();
    }

    async createMatch(matchID: string, data: CreateMatchData): Promise<void> {
        await this.mongo.createMatch(matchID, data);
    }

    async setState(matchID: string, state: StoredMatchState): Promise<void> {
        await this.mongo.setState(matchID, state);
    }

    async setMetadata(matchID: string, metadata: MatchMetadata): Promise<void> {
        await this.mongo.setMetadata(matchID, metadata);
    }

    async fetch(matchID: string, opts: FetchOpts): Promise<FetchResult> {
        return await this.mongo.fetch(matchID, opts);
    }

    async wipe(matchID: string): Promise<void> {
        await this.mongo.wipe(matchID);
    }

    async listMatches(opts?: ListMatchesOpts): Promise<string[]> {
        return await this.mongo.listMatches(opts);
    }

    /**
     * 清理临时房间（ttlSeconds=0 且全员断线超时）
     * 委托给 MongoStorage.cleanupEphemeralMatches
     */
    async cleanupEphemeralMatches(graceMs?: number): Promise<number> {
        return await this.mongo.cleanupEphemeralMatches(graceMs);
    }
}

export const hybridStorage = new HybridStorage(mongoStorage);
