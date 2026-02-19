/**
 * MongoDB 存储实现
 *
 * 实现 MatchStorage 接口，支持 TTL 自动过期
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
    MatchStorage,
    MatchMetadata,
    StoredMatchState,
    CreateMatchData,
    FetchOpts,
    FetchResult,
    ListMatchesOpts,
} from '../../engine/transport/storage';
import { hasOccupiedPlayers } from '../matchOccupancy';
import logger from '../../../server/logger';

// 房间文档接口
interface IMatchDocument extends Document {
    matchID: string;
    gameName: string;
    state: StoredMatchState | null;
    metadata: MatchMetadata | null;
    /** TTL 秒数，0 表示不保存（所有人离开即销毁）*/
    ttlSeconds: number;
    /** 过期时间（MongoDB TTL 索引使用） */
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// 房间 Schema
const MatchSchema = new Schema<IMatchDocument>(
    {
        matchID: { type: String, required: true, unique: true, index: true },
        gameName: { type: String, required: true, index: true },
        state: { type: Schema.Types.Mixed, default: null },
        metadata: { type: Schema.Types.Mixed, default: null },
        ttlSeconds: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null }, // TTL 索引
    },
    {
        timestamps: true,
        minimize: false, // 保留空对象（如 players: { "0": {}, "1": {} }），防止 Mongoose 默认移除
    }
);

// TTL 索引：当 expiresAt 到期时自动删除文档
// 注意：MongoDB TTL 索引在后台每 60 秒检查一次
MatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

let MatchModel: Model<IMatchDocument> | null = null;

const getMatchModel = (): Model<IMatchDocument> => {
    if (!MatchModel) {
        // 避免重复编译模型
        MatchModel = mongoose.models.Match as Model<IMatchDocument> ||
            mongoose.model<IMatchDocument>('Match', MatchSchema);
    }
    return MatchModel;
};

/**
 * 计算过期时间
 */
const calculateExpiresAt = (ttlSeconds: number): Date | null => {
    if (ttlSeconds <= 0) return null;
    return new Date(Date.now() + ttlSeconds * 1000);
};

/**
 * MongoDB 存储实现
 */
export class MongoStorage implements MatchStorage {
    private bootTimeMs = Date.now();

    async connect(): Promise<void> {
        // mongoose 连接由 connectDB() 统一管理
        // 这里只确保模型已初始化
        getMatchModel();
        this.bootTimeMs = Date.now();
        logger.info('[MongoStorage] 已连接');
    }

    async createMatch(matchID: string, data: CreateMatchData): Promise<void> {
        const Match = getMatchModel();
        
        type MatchSetupData = { ttlSeconds?: number; ownerKey?: string; ownerType?: 'user' | 'guest' };
        const parseSetupData = (value: unknown): MatchSetupData => {
            if (!value || typeof value !== 'object') return {};
            const raw = value as Record<string, unknown>;
            return {
                ttlSeconds: typeof raw.ttlSeconds === 'number' ? raw.ttlSeconds : undefined,
                ownerKey: typeof raw.ownerKey === 'string' ? raw.ownerKey : undefined,
                ownerType: raw.ownerType === 'user' || raw.ownerType === 'guest' ? raw.ownerType : undefined,
            };
        };

        // 从 setupData 中提取 TTL / owner 配置
        const stateG = data.initialState?.G as Record<string, unknown> | undefined;
        const setupDataFromState = parseSetupData(stateG?.__setupData);
        const setupDataFromMetadata = parseSetupData((data.metadata as { setupData?: unknown } | undefined)?.setupData);
        const setupData = { ...setupDataFromMetadata, ...setupDataFromState };
        const ttlSeconds = setupData.ttlSeconds ?? 0;
        const ownerKey = setupData.ownerKey;
        const ownerType = setupData.ownerType;

        // 全局单房间限制：同一 ownerKey 创建新房间时自动清理旧房间
        if (ownerKey) {
            const existingMatches = await Match.find({
                'metadata.setupData.ownerKey': ownerKey,
            }).select('matchID').lean();

            if (existingMatches.length > 0) {
                const matchIds = existingMatches.map(doc => doc.matchID);
                await Match.deleteMany({ matchID: { $in: matchIds } });
                logger.info(`[MongoStorage] 覆盖旧房间 ownerKey=${ownerKey} ownerType=${ownerType ?? 'unknown'} count=${matchIds.length}`);
            }
        }
        
        const expiresAt = calculateExpiresAt(ttlSeconds);

        await Match.create({
            matchID,
            gameName: data.metadata.gameName,
            state: data.initialState,
            metadata: data.metadata,
            ttlSeconds,
            expiresAt,
        });

        logger.info(`[MongoStorage] 创建房间 matchID=${matchID} ttlSeconds=${ttlSeconds} ownerKey=${ownerKey ?? 'null'} ownerType=${ownerType ?? 'unknown'}`);
    }

    async setState(matchID: string, state: StoredMatchState): Promise<void> {
        const Match = getMatchModel();
        
        // 存储时裁剪 undo 快照和过多日志，避免超过 MongoDB 16MB 限制
        // 撤销快照仅保留最近 1 条，用于在线撤回
        const stateToSave = this.sanitizeStateForStorage(state);
        
        // 简单超限告警（保留最少监控）
        const stateSize = JSON.stringify(stateToSave).length;
        if (stateSize > 8 * 1024 * 1024) {
            logger.warn(`[MongoStorage] 状态过大: matchID=${matchID}, size=${(stateSize / 1024 / 1024).toFixed(2)}MB`);
        }
        
        const update: Record<string, unknown> = { state: stateToSave };

        await Match.updateOne({ matchID }, update);
    }

    /**
     * 清理 state 以便安全存储（剔除不需要持久化的大对象）
     * 防止超过 MongoDB 16MB 文档限制
     */
    private sanitizeStateForStorage(state: StoredMatchState): StoredMatchState {
        if (!state || typeof state !== 'object') {
            logger.warn('[MongoStorage] sanitize: state 不是对象');
            return state;
        }
        // 状态结构是 { G: { sys, core }, _stateID, ... }
        // 游戏状态在 G 里面，G 的结构是 { sys, core }
        const G = (state as { G?: Record<string, unknown> }).G;
        if (!G) {
            logger.warn('[MongoStorage] sanitize: G 不存在');
            return state;
        }
        
        const sys = G.sys as Record<string, unknown> | undefined;
        if (!sys) {
            logger.warn('[MongoStorage] sanitize: sys 不存在');
            return state;
        }
        

        // 裁剪 undo 快照（只保留最近 1 条）
        const sanitizedSys = { ...sys };
        if (sanitizedSys.undo && typeof sanitizedSys.undo === 'object') {
            const undo = sanitizedSys.undo as { snapshots?: unknown[] } & Record<string, unknown>;
            const snapshots = Array.isArray(undo.snapshots) ? undo.snapshots.slice(-1) : [];
            sanitizedSys.undo = {
                ...undo,
                snapshots,
            };
        }

        // LogSystem 已移除，log.entries 始终为空，无需裁剪

        const sanitizedState: StoredMatchState = {
            ...state,
            G: {
                ...G,
                sys: sanitizedSys,
            },
        };
        
        return sanitizedState;
    }

    async setMetadata(matchID: string, metadata: MatchMetadata): Promise<void> {
        const Match = getMatchModel();
        let refreshedExpiresAt: Date | null | undefined;
        let ttlSeconds = 0;

        try {
            const existing = await Match.findOne({ matchID }).select('metadata ttlSeconds expiresAt').lean();
            ttlSeconds = existing?.ttlSeconds ?? 0;
            const expiresAt = existing?.expiresAt ?? null;

            // TTL 房间：有玩家重新连接时刷新 expiresAt
            if (ttlSeconds > 0 && expiresAt && expiresAt.getTime() > Date.now()) {
                const prevConnected = (existing?.metadata as { players?: Record<string, { isConnected?: boolean }> } | null)?.players?.['0']?.isConnected;
                const nextConnected = (metadata as { players?: Record<string, { isConnected?: boolean }> } | null)?.players?.['0']?.isConnected;

                if (!prevConnected && nextConnected) {
                    refreshedExpiresAt = calculateExpiresAt(ttlSeconds);
                }
            }
        } catch (error) {
            logger.warn('[MongoStorage] 读取房间元数据用于 TTL 刷新失败:', error);
        }

        if (ttlSeconds === 0) {
            const players = metadata.players as Record<string, { isConnected?: boolean }> | undefined;
            const connected = players ? Object.values(players).some(player => Boolean(player?.isConnected)) : false;
            const metadataWith = metadata as MatchMetadata & { disconnectedSince?: number | null };
            if (connected) {
                if (metadataWith.disconnectedSince) {
                    logger.info(`[MongoStorage] 清理断线标记 matchID=${matchID} reason=reconnected`);
                    delete metadataWith.disconnectedSince;
                }
            } else if (!metadataWith.disconnectedSince) {
                logger.info(`[MongoStorage] 记录断线时间 matchID=${matchID}`);
                metadataWith.disconnectedSince = Date.now();
            }
        }

        const update: Record<string, unknown> = { metadata };
        if (refreshedExpiresAt) {
            update.expiresAt = refreshedExpiresAt;
        }

        await Match.updateOne({ matchID }, update);
    }

    async fetch(
        matchID: string,
        opts: FetchOpts
    ): Promise<FetchResult> {
        const Match = getMatchModel();
        const doc = await Match.findOne({ matchID }).lean();

        if (!doc) {
            return {};
        }

        const result: FetchResult = {};

        if (opts.state) {
            result.state = doc.state as StoredMatchState;
        }
        if (opts.metadata) {
            result.metadata = doc.metadata as MatchMetadata;
        }

        return result;
    }

    async wipe(matchID: string): Promise<void> {
        const Match = getMatchModel();
        await Match.deleteOne({ matchID });
        logger.info(`[MongoStorage] 删除房间 ${matchID}`);
    }

    async listMatches(opts?: ListMatchesOpts): Promise<string[]> {
        const Match = getMatchModel();
        
        const query: Record<string, unknown> = {};
        
        if (opts?.gameName) {
            query.gameName = opts.gameName;
        }
        
        if (opts?.where) {
            if (opts.where.isGameover !== undefined) {
                query['metadata.gameover'] = opts.where.isGameover ? { $ne: null } : null;
            }
            if (opts.where.updatedBefore !== undefined) {
                query.updatedAt = { $lt: new Date(opts.where.updatedBefore) };
            }
            if (opts.where.updatedAfter !== undefined) {
                query.updatedAt = { 
                    ...(query.updatedAt as Record<string, unknown> || {}),
                    $gt: new Date(opts.where.updatedAfter) 
                };
            }
        }

        const docs = await Match.find(query).select('matchID').lean();
        return docs.map(doc => doc.matchID);
    }

    /**
     * 清理"不保存"的空房间（所有玩家都离开）或全员断开且空闲超时的房间
     * 由服务端定期调用或在玩家离开时触发
     */
    /**
     * 清理无效房间（仅清理损坏的房间数据）
     *
     * 删除条件：
     * - 无 metadata 或 metadata.players 的损坏房间
     */
    async cleanupEmptyMatches(): Promise<number> {
        const Match = getMatchModel();
        const emptyMatches = await Match.find({
            $or: [
                { metadata: null },
                { metadata: { $exists: false } },
                { 'metadata.players': { $exists: false } },
            ],
        }).select('matchID metadata').lean();

        const toDelete: string[] = [];

        for (const doc of emptyMatches) {
            const metadata = doc.metadata as MatchMetadata | null;
            if (!metadata?.players) {
                toDelete.push(doc.matchID);
                logger.info(`[Cleanup] 删除 ${doc.matchID}: 无 metadata.players（损坏数据）`);
            }
            // 不再基于 "name 为空" 删除房间
        }

        if (toDelete.length > 0) {
            await Match.deleteMany({ matchID: { $in: toDelete } });
            logger.info(`[MongoStorage] 清理损坏房间: ${toDelete.length} 个`);
        }

        return toDelete.length;
    }

    /**
     * 清理临时房间（ttlSeconds=0 且无在线玩家）
     * 主要用于服务重启时回收“未保存”房间
     */
    async cleanupEphemeralMatches(graceMs = 5 * 60 * 1000): Promise<number> {
        const Match = getMatchModel();
        const ephemeralMatches = await Match.find({
            $or: [{ ttlSeconds: 0 }, { ttlSeconds: null }, { ttlSeconds: { $exists: false } }],
        }).lean();
        const toDelete: string[] = [];
        const now = Date.now();

        for (const doc of ephemeralMatches) {
            const metadata = doc.metadata as (MatchMetadata & { disconnectedSince?: number | null }) | null;
            const players = metadata?.players as Record<string, { isConnected?: boolean }> | undefined;
            const hasConnectedPlayer = players
                ? Object.values(players).some(player => Boolean(player?.isConnected))
                : false;
            const playerValues = players ? Object.values(players) : [];
            const connectedCount = playerValues.filter(player => Boolean(player?.isConnected)).length;
            const occupiedCount = playerValues.filter(player => Boolean(player?.isConnected || (player as { name?: string }).name || (player as { credentials?: string }).credentials)).length;
            const updatedAtMs = doc.updatedAt ? new Date(doc.updatedAt).getTime() : now;
            const idleMs = now - updatedAtMs;
            const isStaleConnected = hasConnectedPlayer && updatedAtMs < this.bootTimeMs;

            if (hasConnectedPlayer) {
                // 强制降级阈值：isConnected=true 但长时间无更新，视为幽灵连接
                // 可能原因：setMetadata 失败导致 isConnected 未写回 MongoDB
                const FORCE_DISCONNECT_MS = 30 * 60 * 1000; // 30 分钟
                const shouldForceDisconnect = isStaleConnected || idleMs >= FORCE_DISCONNECT_MS;

                if (shouldForceDisconnect) {
                    const metadataWith = metadata as MatchMetadata & { disconnectedSince?: number | null };
                    const seatValues = playerValues as Array<{ isConnected?: boolean | null }>;
                    let changed = false;
                    seatValues.forEach((seat) => {
                        if (seat?.isConnected) {
                            seat.isConnected = false;
                            changed = true;
                        }
                    });
                    if (!metadataWith.disconnectedSince) {
                        metadataWith.disconnectedSince = now;
                        changed = true;
                    }
                    if (changed) {
                        await Match.updateOne({ matchID: doc.matchID }, { metadata });
                    }
                    const reason = isStaleConnected ? 'stale_after_restart' : 'ghost_connection';
                    logger.warn(`[Cleanup] 强制标记断线 matchID=${doc.matchID} reason=${reason} connected=${connectedCount} occupied=${occupiedCount} idleMs=${idleMs}`);
                    continue;
                }
                if (metadata?.disconnectedSince) {
                    delete metadata.disconnectedSince;
                    await Match.updateOne({ matchID: doc.matchID }, { metadata });
                }
                continue;
            }

            if (!metadata) continue;
            const disconnectedSince = typeof metadata.disconnectedSince === 'number' ? metadata.disconnectedSince : undefined;
            if (!disconnectedSince) {
                logger.info(`[Cleanup] 标记断线时间 matchID=${doc.matchID} reason=disconnected_since_missing connected=${connectedCount} occupied=${occupiedCount}`);
                metadata.disconnectedSince = now;
                await Match.updateOne({ matchID: doc.matchID }, { metadata });
                continue;
            }

            if (now - disconnectedSince >= graceMs) {
                toDelete.push(doc.matchID);
                logger.info(`[Cleanup] 删除临时房间 matchID=${doc.matchID} reason=ephemeral_disconnected_timeout`);
            } else {
                logger.info(`[Cleanup] 等待断线宽限 matchID=${doc.matchID} remainingMs=${graceMs - (now - disconnectedSince)} connected=${connectedCount} occupied=${occupiedCount}`);
            }
        }

        if (toDelete.length > 0) {
            await Match.deleteMany({ matchID: { $in: toDelete } });
            logger.info(`[MongoStorage] 清理临时房间: ${toDelete.length} 个`);
        }

        return toDelete.length;
    }

    /**
     * 清理同 ownerKey 的重复房间，仅保留最近更新的一条
     */
    async cleanupDuplicateOwnerMatches(): Promise<number> {
        const Match = getMatchModel();
        const docs = await Match.find({
            'metadata.setupData.ownerKey': { $exists: true, $ne: null },
        }).select('matchID updatedAt metadata.setupData.ownerKey').lean();

        const grouped = new Map<string, Array<{ matchID: string; updatedAt?: Date }>>();
        for (const doc of docs) {
            const ownerKey = (doc as { metadata?: { setupData?: { ownerKey?: string } } }).metadata?.setupData?.ownerKey;
            if (!ownerKey) continue;
            const list = grouped.get(ownerKey) ?? [];
            list.push({ matchID: doc.matchID, updatedAt: doc.updatedAt ?? undefined });
            grouped.set(ownerKey, list);
        }

        const toDelete: string[] = [];
        for (const [ownerKey, matches] of grouped.entries()) {
            if (matches.length <= 1) continue;
            matches.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
            const stale = matches.slice(1);
            for (const match of stale) {
                toDelete.push(match.matchID);
                logger.info(`[Cleanup] 删除重复房间 ownerKey=${ownerKey} matchID=${match.matchID}`);
            }
        }

        if (toDelete.length > 0) {
            await Match.deleteMany({ matchID: { $in: toDelete } });
            logger.info(`[MongoStorage] 清理重复 ownerKey 房间: ${toDelete.length} 个`);
        }

        return toDelete.length;
    }

    /**
     * 清理历史遗留房间（缺失 ownerKey 或 guest:unknown）且无人占座
     * 用于修复旧逻辑遗留的无法覆盖房间
     */
    async cleanupLegacyMatches(hoursOld: number = 24): Promise<number> {
        const Match = getMatchModel();
        const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

        const legacyMatches = await Match.find({
            updatedAt: { $lt: cutoffTime },
            $or: [
                { 'metadata.setupData.ownerKey': { $exists: false } },
                { 'metadata.setupData.ownerKey': null },
                { 'metadata.setupData.ownerKey': 'guest:unknown' },
                { 'metadata.setupData.ownerKey': 'guest:invalid' },
            ],
        }).lean();

        const toDelete: string[] = [];
        for (const doc of legacyMatches) {
            const metadata = doc.metadata as MatchMetadata | null;
            const players = metadata?.players as Record<string, { name?: string; credentials?: string; isConnected?: boolean }> | undefined;
            if (!hasOccupiedPlayers(players)) {
                toDelete.push(doc.matchID);
                logger.info(`[Cleanup] 删除遗留房间 matchID=${doc.matchID} reason=legacy_owner`);
            }
        }

        if (toDelete.length > 0) {
            await Match.deleteMany({ matchID: { $in: toDelete } });
            logger.info(`[MongoStorage] 清理遗留房间: ${toDelete.length} 个`);
        }

        return toDelete.length;
    }

    /**
     * 清理所有过期的旧房间（updatedAt 超过 N 小时的）
     * 手动调用或定期执行，用于清理数据库
     */
    async cleanupOldMatches(hoursOld: number = 24): Promise<number> {
        const Match = getMatchModel();
        
        const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
        
        // 查找所有超过指定时间的房间
        const result = await Match.deleteMany({
            updatedAt: { $lt: cutoffTime },
        });

        logger.info(`[MongoStorage] 清理过期房间 (>${hoursOld}h): ${result.deletedCount} 个`);
        return result.deletedCount ?? 0;
    }

    /**
     * 获取所有房间的大小统计信息（用于调试）
     */
    async getStorageStats(): Promise<{
        totalMatches: number;
        largeMatches: Array<{ matchID: string; sizeMB: number }>;
    }> {
        const Match = getMatchModel();
        const matches = await Match.find({}).select('matchID state').lean();
        
        const largeMatches: Array<{ matchID: string; sizeMB: number }> = [];
        
        for (const doc of matches) {
            const size = JSON.stringify(doc.state).length;
            const sizeMB = size / 1024 / 1024;
            if (sizeMB > 1) {
                largeMatches.push({ matchID: doc.matchID, sizeMB });
            }
        }
        
        // 按大小排序
        largeMatches.sort((a, b) => b.sizeMB - a.sizeMB);
        
        return {
            totalMatches: matches.length,
            largeMatches,
        };
    }
}

// 导出单例
export const mongoStorage = new MongoStorage();
