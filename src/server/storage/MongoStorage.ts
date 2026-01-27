/**
 * MongoDB 存储适配器 for boardgame.io
 * 
 * 实现 StorageAPI.Async 接口，支持 TTL 自动过期
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import type { State, Server, LogEntry } from 'boardgame.io';
import type { StorageAPI } from 'boardgame.io/dist/types/src/server/db';

// 房间文档接口
interface IMatchDocument extends Document {
    matchID: string;
    gameName: string;
    state: State | null;
    initialState: State | null;
    metadata: Server.MatchData | null;
    log: LogEntry[];
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
        initialState: { type: Schema.Types.Mixed, default: null },
        metadata: { type: Schema.Types.Mixed, default: null },
        log: { type: [Schema.Types.Mixed], default: [] },
        ttlSeconds: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null, index: { expires: 0 } }, // TTL 索引
    },
    {
        timestamps: true,
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
export class MongoStorage implements StorageAPI.Async {
    private connected = false;

    type(): 'ASYNC' {
        return 'ASYNC';
    }

    async connect(): Promise<void> {
        // mongoose 连接由 connectDB() 统一管理
        // 这里只确保模型已初始化
        getMatchModel();
        this.connected = true;
        console.log('[MongoStorage] 已连接');
    }

    async createMatch(matchID: string, opts: StorageAPI.CreateMatchOpts): Promise<void> {
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
        const stateG = (opts.initialState as State | undefined)?.G as Record<string, unknown> | undefined;
        const setupDataFromState = parseSetupData(stateG?.__setupData);
        const setupDataFromMetadata = parseSetupData((opts.metadata as { setupData?: unknown } | undefined)?.setupData);
        const setupData = { ...setupDataFromMetadata, ...setupDataFromState };
        const ttlSeconds = setupData.ttlSeconds ?? 0;
        const ownerKey = setupData.ownerKey;

        // 全局单房间限制：同一 ownerKey 只能有一个未结束的房间
        if (ownerKey) {
            const existing = await Match.findOne({
                'metadata.setupData.ownerKey': ownerKey,
                $or: [
                    { 'metadata.gameover': null },
                    { 'metadata.gameover': { $exists: false } },
                ],
            }).select('matchID gameName');
            if (existing) {
                throw new Error(`[Lobby] ACTIVE_MATCH_EXISTS:${existing.gameName}:${existing.matchID}`);
            }
        }
        
        const expiresAt = calculateExpiresAt(ttlSeconds);

        await Match.create({
            matchID,
            gameName: opts.metadata.gameName,
            state: opts.initialState,
            initialState: opts.initialState,
            metadata: opts.metadata,
            log: [],
            ttlSeconds,
            expiresAt,
        });

        console.log(`[MongoStorage] 创建房间 ${matchID}, TTL=${ttlSeconds}s`);
    }

    async setState(matchID: string, state: State, deltalog?: LogEntry[]): Promise<void> {
        const Match = getMatchModel();
        
        // 存储时剔除 undo 快照和过多日志，避免超过 MongoDB 16MB 限制
        // 撤销快照只在内存中保留，不需要持久化
        const stateToSave = this.sanitizeStateForStorage(state);
        
        // 简单超限告警（保留最少监控）
        const stateSize = JSON.stringify(stateToSave).length;
        if (stateSize > 8 * 1024 * 1024) {
            console.warn(`[MongoStorage] 状态过大: matchID=${matchID}, size=${(stateSize / 1024 / 1024).toFixed(2)}MB`);
        }
        
        const update: Record<string, unknown> = { state: stateToSave };
        
        // 限制 Match.log 大小（只保留最近 10 条）
        if (deltalog && deltalog.length > 0) {
            update.$push = { log: { $each: deltalog, $slice: -10 } };
        }

        await Match.updateOne({ matchID }, update);
    }

    /**
     * 清理 state 以便安全存储（剔除不需要持久化的大对象）
     * 防止超过 MongoDB 16MB 文档限制
     */
    private sanitizeStateForStorage(state: State): State {
        if (!state || typeof state !== 'object') {
            console.warn('[MongoStorage] sanitize: state 不是对象');
            return state;
        }
        
        // boardgame.io State 结构是 { G, ctx, ... }
        // 游戏状态在 G 里面，G 的结构是 { sys, core }
        const G = (state as { G?: Record<string, unknown> }).G;
        if (!G) {
            console.warn('[MongoStorage] sanitize: G 不存在');
            return state;
        }
        
        const sys = G.sys as Record<string, unknown> | undefined;
        if (!sys) {
            console.warn('[MongoStorage] sanitize: sys 不存在');
            return state;
        }
        

        // 剔除 undo 快照（不持久化，在内存中管理即可）
        const sanitizedSys = { ...sys };
        if (sanitizedSys.undo && typeof sanitizedSys.undo === 'object') {
            sanitizedSys.undo = {
                ...(sanitizedSys.undo as Record<string, unknown>),
                snapshots: [], // 清空快照
            };
        }

        // 限制日志条目数量（保留最近 10 条，并清理大型事件 payload）
        if (sanitizedSys.log && typeof sanitizedSys.log === 'object') {
            const log = sanitizedSys.log as { entries?: unknown[]; maxEntries?: number };
            if (Array.isArray(log.entries)) {
                const originalCount = log.entries.length;
                // 只保留最近 10 条日志
                const recentEntries = log.entries.slice(-10);
                // 清理每个日志条目中的大型对象
                const cleanedEntries = recentEntries.map(entry => this.cleanLogEntry(entry));
                sanitizedSys.log = {
                    ...log,
                    entries: cleanedEntries,
                };
            }
        }

        const sanitizedState = {
            ...state,
            G: {
                ...G,
                sys: sanitizedSys,
            },
        } as State & Record<string, unknown>;
        
        // 清理 boardgame.io 的 plugins 字段（这是状态膨胀的主要来源）
        if (sanitizedState.plugins && typeof sanitizedState.plugins === 'object') {
            const plugins = sanitizedState.plugins as Record<string, unknown>;
            const pluginsBefore = JSON.stringify(plugins).length;
            
            // 遍历所有插件并清理
            for (const pluginName of Object.keys(plugins)) {
                const plugin = plugins[pluginName] as Record<string, unknown> | undefined;
                if (!plugin || typeof plugin !== 'object') continue;
                
                // 清理 data 数组（log/events 插件都有）
                if (Array.isArray(plugin.data)) {
                    const originalLen = plugin.data.length;
                    if (originalLen > 10) {
                        plugin.data = plugin.data.slice(-10);
                    }
                }
                
                // 清理 api 字段（可能包含历史记录）
                if (plugin.api && typeof plugin.api === 'object') {
                    const api = plugin.api as Record<string, unknown>;
                    // events 插件的 api 里可能有大量事件
                    if (Array.isArray(api.events)) {
                        const originalLen = api.events.length;
                        if (originalLen > 10) {
                            api.events = api.events.slice(-10);
                        }
                    }
                }
            }
        }
        
        // 清空 boardgame.io 的 _undo/_redo 字段（如果存在）
        if (sanitizedState._undo) {
            sanitizedState._undo = [];
        }
        if (sanitizedState._redo) {
            sanitizedState._redo = [];
        }
        
        return sanitizedState as State;
    }

    /**
     * 清理单个日志条目，移除大型嵌套对象
     */
    private cleanLogEntry(entry: unknown): unknown {
        if (!entry || typeof entry !== 'object') return entry;
        const e = entry as { type?: string; data?: unknown };
        
        if (e.type !== 'event' || !e.data) return entry;
        
        const event = e.data as { type?: string; payload?: Record<string, unknown> };
        if (!event.payload) return entry;

        // 清理特定事件类型中的大型对象
        const cleanedPayload = { ...event.payload };
        
        // ABILITY_REPLACED 事件：移除完整的 newAbilityDef，只保留 ID
        if (event.type === 'ABILITY_REPLACED' && cleanedPayload.newAbilityDef) {
            const abilityDef = cleanedPayload.newAbilityDef as { id?: string };
            cleanedPayload.newAbilityDef = { id: abilityDef.id ?? 'unknown' };
        }
        
        // DECK_SHUFFLED 事件：移除完整的牌库顺序，只保留数量
        if (event.type === 'DECK_SHUFFLED' && Array.isArray(cleanedPayload.deckCardIds)) {
            cleanedPayload.deckCardCount = (cleanedPayload.deckCardIds as unknown[]).length;
            delete cleanedPayload.deckCardIds;
        }

        return {
            ...e,
            data: {
                ...event,
                payload: cleanedPayload,
            },
        };
    }

    async setMetadata(matchID: string, metadata: Server.MatchData): Promise<void> {
        const Match = getMatchModel();
        let refreshedExpiresAt: Date | null | undefined;

        try {
            const existing = await Match.findOne({ matchID }).select('metadata ttlSeconds expiresAt').lean();
            const ttlSeconds = existing?.ttlSeconds ?? 0;
            const expiresAt = existing?.expiresAt ?? null;

            if (ttlSeconds > 0 && expiresAt && expiresAt.getTime() > Date.now()) {
                const prevConnected = (existing?.metadata as { players?: Record<string, { isConnected?: boolean }> } | null)?.players?.['0']?.isConnected;
                const nextConnected = (metadata as { players?: Record<string, { isConnected?: boolean }> } | null)?.players?.['0']?.isConnected;
                // 房主从断开 -> 连接（且尚未过期）时，刷新 TTL
                if (!prevConnected && nextConnected) {
                    refreshedExpiresAt = calculateExpiresAt(ttlSeconds);
                }
            }
        } catch (error) {
            console.warn('[MongoStorage] 读取房间元数据用于 TTL 刷新失败:', error);
        }

        const update: Record<string, unknown> = { metadata };
        if (refreshedExpiresAt) {
            update.expiresAt = refreshedExpiresAt;
        }

        await Match.updateOne({ matchID }, update);
    }

    async fetch<O extends StorageAPI.FetchOpts>(
        matchID: string,
        opts: O
    ): Promise<StorageAPI.FetchResult<O>> {
        const Match = getMatchModel();
        const doc = await Match.findOne({ matchID }).lean();

        if (!doc) {
            return {} as StorageAPI.FetchResult<O>;
        }

        const result: Partial<StorageAPI.FetchFields> = {};

        if (opts.state) {
            result.state = doc.state as State;
        }
        if (opts.log) {
            result.log = doc.log as LogEntry[];
        }
        if (opts.metadata) {
            result.metadata = doc.metadata as Server.MatchData;
        }
        if (opts.initialState) {
            result.initialState = doc.initialState as State;
        }

        return result as StorageAPI.FetchResult<O>;
    }

    async wipe(matchID: string): Promise<void> {
        const Match = getMatchModel();
        await Match.deleteOne({ matchID });
        console.log(`[MongoStorage] 删除房间 ${matchID}`);
    }

    async listMatches(opts?: StorageAPI.ListMatchesOpts): Promise<string[]> {
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
     * 
     * 注意：
     * - 不会因为玩家离开（name 为空）而删除房间
     * - 房间只能通过 destroyMatch 手动删除
     * - 如需清理长期无人房间，使用 cleanupOldMatches
     */
    async cleanupEmptyMatches(): Promise<number> {
        const Match = getMatchModel();
        
        // 查找 ttlSeconds=0 或未设置 ttlSeconds 的房间（兼容旧数据）
        const emptyMatches = await Match.find({
            $or: [
                { ttlSeconds: 0 },
                { ttlSeconds: null },
                { ttlSeconds: { $exists: false } },
            ],
        }).lean();

        const toDelete: string[] = [];
        
        for (const doc of emptyMatches) {
            const metadata = doc.metadata as Server.MatchData | null;
            
            // 仅删除无 metadata.players 的损坏房间
            if (!metadata?.players) {
                toDelete.push(doc.matchID);
                console.log(`[Cleanup] 删除 ${doc.matchID}: 无 metadata.players（损坏数据）`);
            }
            // 不再基于 "name 为空" 删除房间
        }
        
        if (toDelete.length > 0) {
            await Match.deleteMany({ matchID: { $in: toDelete } });
            console.log(`[MongoStorage] 清理损坏房间: ${toDelete.length} 个`);
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

        console.log(`[MongoStorage] 清理过期房间 (>${hoursOld}h): ${result.deletedCount} 个`);
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
