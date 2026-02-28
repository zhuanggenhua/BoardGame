/**
 * 游戏状态同步服务端
 *
 * 基于 socket.io 实现：
 * - 接收客户端命令 → 执行 pipeline → playerView 过滤 → 广播状态
 * - 管理玩家连接状态
 * - 内置离线交互裁决（断线 → graceMs → 自动 CANCEL_INTERACTION）
 */

import type { Server as IOServer, Socket as IOSocket } from 'socket.io';
import type { Command, DomainCore, GameEvent, MatchState, PlayerId, RandomFn } from '../types';
import type { EngineSystem, GameSystemsConfig } from '../systems/types';
import type {
    MatchStorage,
    StoredMatchState,
    MatchMetadata,
} from './storage';
import type {
    MatchPlayerInfo,
} from './protocol';
import logger, { gameLogger } from '../../../server/logger.js';
import {
    executePipeline,
    createSeededRandom,
    createInitialSystemState,
    type PipelineConfig,
} from '../pipeline';
import { INTERACTION_COMMANDS } from '../systems/InteractionSystem';

// 离线裁决：按交互 kind 选择最小语义正确的兜底命令
// - simple-choice: 走通用系统取消
// - dt:*: 走 DiceThrone 领域命令，确保回滚/清理逻辑完整执行
const OFFLINE_ADJUDICATION_COMMAND_BY_KIND: Record<string, string> = {
    'simple-choice': INTERACTION_COMMANDS.CANCEL,
    'dt:card-interaction': INTERACTION_COMMANDS.CANCEL, // 已迁移到 InteractionSystem
    'dt:token-response': 'SKIP_TOKEN_RESPONSE',
    'dt:bonus-dice': 'SKIP_BONUS_DICE_REROLL',
};

const resolveOfflineAdjudicationCommandType = (kind: unknown): string => {
    if (typeof kind !== 'string') {
        return INTERACTION_COMMANDS.CANCEL;
    }
    return OFFLINE_ADJUDICATION_COMMAND_BY_KIND[kind] ?? INTERACTION_COMMANDS.CANCEL;
};

// ============================================================================
// 游戏引擎定义
// ============================================================================

/**
 * 游戏引擎配置
 *
 * 每个游戏注册一个 GameEngineConfig，由 GameTransportServer 统一管理。
 */
export interface GameEngineConfig<
    TCore = unknown,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent,
> {
    /** 游戏 ID */
    gameId: string;
    /** 领域内核 */
    domain: DomainCore<TCore, TCommand, TEvent>;
    /** 启用的系统 */
    systems: EngineSystem<TCore>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
    /** 命令类型列表 */
    commandTypes?: string[];
    /** 玩家数量范围 */
    minPlayers?: number;
    maxPlayers?: number;
    /** 是否禁用撤销 */
    disableUndo?: boolean;
}

// ============================================================================
// 内部类型
// ============================================================================

/** 运行中的对局上下文 */
interface ActiveMatch {
    matchID: string;
    gameId: string;
    engineConfig: GameEngineConfig;
    state: MatchState<unknown>;
    metadata: MatchMetadata;
    randomSeed: string;
    random: RandomFn;
    getRandomCursor: () => number;
    playerIds: PlayerId[];
    /** 状态版本号（每次命令执行后递增） */
    stateID: number;
    /** 玩家 socket 连接索引：playerID → Set<socketId> */
    connections: Map<string, Set<string>>;
    /** 旁观者 socket 集合 */
    spectatorSockets: Set<string>;
    /** 离线裁决定时器：playerID → timer */
    offlineTimers: Map<string, ReturnType<typeof setTimeout>>;
    /** 最后执行命令的玩家 ID（供 broadcastState 携带到 meta，乐观引擎用于区分自己/对手的命令） */
    lastCommandPlayerId: string | null;
    /** 命令执行锁（串行执行） */
    executing: boolean;
    /** 待执行命令队列（普通命令 + batch 任务共用同一队列保证串行） */
    commandQueue: Array<{
        commandType: string;
        payload: unknown;
        playerID: string;
        resolve: (success: boolean) => void;
    } | {
        /** batch 任务标记 */
        _batch: true;
        execute: () => Promise<void>;
        resolve: (success: boolean) => void;
    }>;
}

/** socket 关联信息 */
interface SocketInfo {
    matchID: string;
    playerID: string | null;
    credentials?: string;
}

const resolveStoredRandomSeed = (
    state: StoredMatchState,
    matchID: string,
): string => {
    const storedSeed = (state as { randomSeed?: unknown }).randomSeed;
    return typeof storedSeed === 'string' && storedSeed.length > 0 ? storedSeed : matchID;
};

const resolveStoredRandomCursor = (state: StoredMatchState): number => {
    const storedCursor = (state as { randomCursor?: unknown }).randomCursor;
    if (typeof storedCursor !== 'number' || !Number.isFinite(storedCursor) || storedCursor < 0) {
        return 0;
    }
    return Math.floor(storedCursor);
};

const createTrackedRandom = (seed: string, initialCursor = 0): { random: RandomFn; getCursor: () => number } => {
    const base = createSeededRandom(seed);
    const normalizedCursor = Number.isFinite(initialCursor) && initialCursor > 0
        ? Math.floor(initialCursor)
        : 0;

    for (let i = 0; i < normalizedCursor; i++) {
        base.random();
    }

    let cursor = normalizedCursor;

    return {
        random: {
            random: () => {
                cursor += 1;
                return base.random();
            },
            d: (max: number) => {
                cursor += 1;
                return Math.floor(base.random() * max) + 1;
            },
            range: (min: number, max: number) => {
                cursor += 1;
                return Math.floor(base.random() * (max - min + 1)) + min;
            },
            shuffle: <T>(array: T[]): T[] => {
                cursor += Math.max(0, array.length - 1);
                // Fisher-Yates shuffle
                const result = [...array];
                for (let i = result.length - 1; i > 0; i--) {
                    const j = Math.floor(base.random() * (i + 1));
                    [result[i], result[j]] = [result[j], result[i]];
                }
                return result;
            },
            getCursor: () => cursor,
        },
        getCursor: () => cursor,
    };
};

// ============================================================================
// GameTransportServer
// ============================================================================

export interface GameTransportServerConfig {
    /** socket.io 服务器实例 */
    io: IOServer;
    /** 存储层 */
    storage: MatchStorage;
    /** 注册的游戏引擎 */
    games: GameEngineConfig[];
    /** 离线裁决宽限期（毫秒），默认 30000 */
    offlineGraceMs?: number;
    /** 认证回调（可选） */
    authenticate?: (
        matchID: string,
        playerID: string,
        credentials: string | undefined,
        metadata: MatchMetadata,
    ) => boolean | Promise<boolean>;
    /** 游戏结束回调（可选） */
    onGameOver?: (matchID: string, gameName: string, gameover: unknown) => void;
}

export class GameTransportServer {
    private readonly io: IOServer;
    private readonly storage: MatchStorage;
    private readonly gameIndex: Map<string, GameEngineConfig>;
    private readonly activeMatches: Map<string, ActiveMatch>;
    private readonly socketIndex: Map<string, SocketInfo>;
    private readonly offlineGraceMs: number;
    private readonly authenticate?: GameTransportServerConfig['authenticate'];
    private readonly onGameOver?: GameTransportServerConfig['onGameOver'];

    constructor(config: GameTransportServerConfig) {
        this.io = config.io;
        this.storage = config.storage;
        this.gameIndex = new Map(config.games.map((g) => [g.gameId, g]));
        this.activeMatches = new Map();
        this.socketIndex = new Map();
        this.offlineGraceMs = config.offlineGraceMs ?? 30000;
        this.authenticate = config.authenticate;
        this.onGameOver = config.onGameOver;
    }

    /** 启动传输层，监听 /game namespace */
    start(): void {
        const nsp = this.io.of('/game');

        nsp.on('connection', (socket: IOSocket) => {
            socket.on('sync', async (
                matchID: string,
                playerID: string | null,
                credentials?: string,
            ) => {
                if (!matchID) return;
                await this.handleSync(socket, matchID, playerID, credentials);
            });

            socket.on('command', async (
                matchID: string,
                commandType: string,
                payload: unknown,
                credentials?: string,
            ) => {
                if (!matchID || !commandType) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('error', matchID, 'unauthorized');
                    return;
                }
                // 教程 AI 命令：payload 中携带 __tutorialPlayerId 时，以该 ID 作为执行者
                // 仅在教程模式激活时生效，防止普通玩家伪造 playerId
                const payloadRecord = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
                const tutorialOverrideId = typeof payloadRecord?.__tutorialPlayerId === 'string'
                    ? payloadRecord.__tutorialPlayerId
                    : undefined;
                const match = this.activeMatches.get(matchID);
                const isTutorialActive = !!(match?.state?.sys as Record<string, unknown> | undefined)
                    ?.tutorial && !!(match?.state?.sys as { tutorial?: { active?: boolean } })?.tutorial?.active;
                const resolvedPlayerId = (tutorialOverrideId && isTutorialActive)
                    ? tutorialOverrideId
                    : info.playerID;
                // 清除 payload 中的 __tutorialPlayerId，避免传入领域层
                const normalizedPayload = payloadRecord && '__tutorialPlayerId' in payloadRecord
                    ? (() => { const { __tutorialPlayerId: _ignored, ...rest } = payloadRecord; return rest; })()
                    : payload;
                await this.handleCommand(matchID, resolvedPlayerId, commandType, normalizedPayload);
            });

            socket.on('batch', async (
                matchID: string,
                batchId: string,
                commands: Array<{ type: string; payload: unknown }>,
                credentials?: string,
            ) => {
                if (!matchID || !batchId || !Array.isArray(commands)) return;
                const info = this.socketIndex.get(socket.id);
                if (!info || info.matchID !== matchID || !info.playerID) return;
                const authorized = await this.validateCommandAuth(matchID, info.playerID, info.credentials ?? credentials);
                if (!authorized) {
                    socket.emit('batch:rejected', matchID, batchId, 'unauthorized');
                    return;
                }
                await this.handleBatch(socket, matchID, info.playerID, batchId, commands);
            });

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    // ========================================================================
    // 公共 API（供 REST 路由调用）
    // ========================================================================

    /** 创建对局并初始化状态 */
    async setupMatch(
        matchID: string,
        gameId: string,
        playerIds: PlayerId[],
        seed: string,
        _setupData?: unknown,
    ): Promise<{ state: MatchState<unknown>; randomCursor: number } | null> {
        const engineConfig = this.gameIndex.get(gameId);
        if (!engineConfig) return null;

        const trackedRandom = createTrackedRandom(seed, 0);
        const core = engineConfig.domain.setup(playerIds, trackedRandom.random);
        const sys = createInitialSystemState(
            playerIds,
            engineConfig.systems as EngineSystem[],
            matchID,
        );
        const state: MatchState<unknown> = { sys, core };
        return {
            state,
            randomCursor: trackedRandom.getCursor(),
        };
    }

    /** 执行命令（供服务端内部调用，如离线裁决） */
    async executeCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
    ): Promise<boolean> {
        return this.handleCommand(matchID, playerID, commandType, payload);
    }

    /**
     * 覆盖活跃对局的 metadata 缓存（REST 更新 metadata 后调用）
     */
    updateMatchMetadata(matchID: string, metadata: MatchMetadata): void {
        const active = this.activeMatches.get(matchID);
        if (!active) return;
        active.metadata = metadata;
    }

    /**
     * 测试专用：直接注入对局状态
     * 
     * 此方法绕过正常的命令执行流程，直接修改服务器状态并广播到所有客户端。
     * 仅在测试环境使用。
     * 
     * @param matchID 对局 ID
     * @param state 新的对局状态
     */
    async injectState(matchID: string, state: MatchState<unknown>): Promise<void> {
        // 环境检查
        if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development') {
            throw new Error('injectState is only available in test/development environment');
        }

        // 验证状态结构
        if (!state || typeof state !== 'object') {
            throw new Error('Invalid state: must be an object');
        }
        if (!state.core || typeof state.core !== 'object') {
            throw new Error('Invalid state: missing or invalid core');
        }
        if (!state.sys || typeof state.sys !== 'object') {
            throw new Error('Invalid state: missing or invalid sys');
        }

        // 加载或获取活跃对局
        let match = this.activeMatches.get(matchID);
        if (!match) {
            match = await this.loadMatch(matchID);
            if (!match) {
                throw new Error(`Match ${matchID} not found`);
            }
        }

        // 更新状态
        match.state = state;
        match.stateID += 1;

        // 持久化到存储
        const storedState: StoredMatchState = {
            G: state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(matchID, storedState);

        // 广播到所有客户端
        this.broadcastState(match);

        logger.info(`[TEST] State injected for match ${matchID}`);
    }

    /**
     * 主动断开某个玩家在对局内的所有连接（离座释放权限）
     */
    disconnectPlayer(matchID: string, playerID: string, options?: { disconnectSockets?: boolean }): void {
        const match = this.activeMatches.get(matchID);
        if (!match) return;

        const conns = match.connections.get(playerID);
        if (!conns || conns.size === 0) return;

        const socketIds = new Set(conns);
        match.connections.delete(playerID);
        for (const sid of socketIds) {
            this.socketIndex.delete(sid);
        }

        // 从传输层视角将该玩家标记为离线，并触发离线裁决兜底。
        this.onPlayerFullyDisconnected(match, playerID);

        if (options?.disconnectSockets) {
            const nsp = this.io.of('/game');
            void nsp.in(`game:${matchID}`).fetchSockets()
                .then((sockets) => {
                    for (const socket of sockets) {
                        if (socketIds.has(socket.id)) {
                            socket.disconnect(true);
                        }
                    }
                })
                .catch((error) => {
                    logger.warn('[GameTransport] disconnect player sockets failed', {
                        matchID,
                        playerID,
                        error,
                    });
                });
        }
    }

    /** 卸载活跃对局（销毁房间时调用） */
    unloadMatch(matchID: string, options?: { disconnectSockets?: boolean }): void {
        const match = this.activeMatches.get(matchID);
        if (!match) return;

        for (const timer of match.offlineTimers.values()) {
            clearTimeout(timer);
        }
        match.offlineTimers.clear();

        while (match.commandQueue.length > 0) {
            const queued = match.commandQueue.shift();
            queued?.resolve(false);
        }

        for (const sockets of match.connections.values()) {
            for (const sid of sockets) {
                this.socketIndex.delete(sid);
            }
        }
        for (const sid of match.spectatorSockets) {
            this.socketIndex.delete(sid);
        }

        this.activeMatches.delete(matchID);

        if (options?.disconnectSockets) {
            const nsp = this.io.of('/game');
            void nsp.in(`game:${matchID}`).fetchSockets()
                .then((sockets) => {
                    sockets.forEach((s) => s.disconnect(true));
                })
                .catch((error) => {
                    logger.warn('[GameTransport] disconnect room sockets failed', { matchID, error });
                });
        }
    }

    // ========================================================================
    // 内部处理
    // ========================================================================

    private async handleSync(
        socket: IOSocket,
        matchID: string,
        playerID: string | null,
        credentials?: string,
    ): Promise<void> {
        // 加载或获取活跃对局
        let match = this.activeMatches.get(matchID);
        if (!match) {
            match = await this.loadMatch(matchID);
            if (!match) {
                socket.emit('error', matchID, 'match_not_found');
                return;
            }
        }

        // 认证（旁观者无需凭证）。
        // 这里必须基于存储层最新 metadata 做校验，避免 leave/join 后内存缓存滞后。
        if (playerID !== null) {
            const ok = await this.validateCommandAuth(matchID, playerID, credentials);
            if (!ok) {
                socket.emit('error', matchID, 'unauthorized');
                return;
            }
        }

        // 注册 socket
        const prevInfo = this.socketIndex.get(socket.id);
        if (prevInfo && (prevInfo.matchID !== matchID || prevInfo.playerID !== playerID)) {
            this.removeSocketFromMatch(socket.id, prevInfo);
        }

        this.socketIndex.set(socket.id, { matchID, playerID, credentials });
        socket.join(`game:${matchID}`);

        if (playerID === null) {
            match.spectatorSockets.add(socket.id);
        } else {
            // 更新连接状态
            const conns = match.connections.get(playerID) ?? new Set();
            conns.add(socket.id);
            match.connections.set(playerID, conns);

            // 取消离线裁决定时器
            const timer = match.offlineTimers.get(playerID);
            if (timer) {
                clearTimeout(timer);
                match.offlineTimers.delete(playerID);
            }

            // 更新 metadata 连接状态
            if (match.metadata.players[playerID]) {
                match.metadata.players[playerID].isConnected = true;
                await this.storage.setMetadata(matchID, match.metadata);
            }
        }

        // 发送当前状态（经 playerView 过滤 + 传输裁剪）
        // 重连同步时清空 eventStream entries，避免客户端重播历史事件
        const viewState = this.stripStateForTransport(
            this.applyPlayerView(match, playerID),
            { stripEventStream: true },
        );
        const matchPlayers = this.buildMatchPlayers(match);
        socket.emit('state:sync', matchID, viewState, matchPlayers, {
            seed: match.randomSeed,
            cursor: match.getRandomCursor(),
        });

        // 通知其他玩家（旁观者不触发玩家连接事件）
        if (playerID !== null) {
            socket.to(`game:${matchID}`).emit('player:connected', matchID, playerID);
        }
    }

    private async handleCommand(
        matchID: string,
        playerID: string,
        commandType: string,
        payload: unknown,
    ): Promise<boolean> {
        const match = this.activeMatches.get(matchID);
        if (!match) return false;

        // 串行执行：如果正在执行，加入队列
        if (match.executing) {
            return new Promise<boolean>((resolve) => {
                match.commandQueue.push({
                    commandType,
                    payload,
                    playerID,
                    resolve,
                });
            });
        }

        match.executing = true;
        try {
            const success = await this.executeCommandInternal(match, playerID, commandType, payload);

            // 处理队列中的后续命令（包括 batch 任务）
            while (match.commandQueue.length > 0) {
                const next = match.commandQueue.shift()!;
                if ('_batch' in next) {
                    // batch 任务：执行完整的 batch 逻辑
                    await next.execute();
                    next.resolve(true);
                } else {
                    const queuedSuccess = await this.executeCommandInternal(match, next.playerID, next.commandType, next.payload);
                    next.resolve(queuedSuccess);
                }
            }

            return success;
        } finally {
            match.executing = false;
        }
    }

    /**
     * 处理批量命令（Task 7）
     * 
     * 批次内命令串行执行，任一失败则中止并回滚整个批次。
     * 成功后返回权威状态（已裁剪 EventStream）。
     */
    private async handleBatch(
        socket: IOSocket,
        matchID: string,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
    ): Promise<void> {
        const match = this.activeMatches.get(matchID);
        if (!match) {
            socket.emit('batch:rejected', matchID, batchId, 'match_not_found');
            return;
        }

        // 串行执行：如果正在执行，将整个 batch 任务排入队列（与 handleCommand 保持一致）
        if (match.executing) {
            await new Promise<void>((resolve) => {
                match.commandQueue.push({
                    _batch: true,
                    execute: () => this.executeBatchInternal(socket, match, playerID, batchId, commands),
                    resolve: () => resolve(),
                });
            });
            return;
        }

        match.executing = true;
        // 在执行前保存内存快照，用于批次失败时回滚
        // rollbackToStateID 依赖存储层，但存储层只保存最新状态，无法回到中间状态
        const snapshotState = match.state;
        const snapshotStateID = match.stateID;

        try {
            // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
            for (const cmd of commands) {
                const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, { suppressBroadcast: true });
                if (!success) {
                    // 命令失败 - 从内存快照恢复到批次开始前的状态
                    match.state = snapshotState;
                    match.stateID = snapshotStateID;
                    // 持久化回滚后的状态，确保存储层与内存一致
                    const rollbackStored = {
                        G: snapshotState,
                        _stateID: snapshotStateID,
                        randomSeed: match.randomSeed,
                        randomCursor: match.getRandomCursor(),
                    };
                    await this.storage.setState(matchID, rollbackStored);
                    this.broadcastState(match);
                    socket.emit('batch:rejected', matchID, batchId, 'command_failed');
                    return;
                }
            }

            // 批次成功 - 广播最终状态给所有玩家（包括对手），然后发送确认给发送者
            this.broadcastState(match);
            // batch:confirmed 是乐观更新的确认响应，客户端已通过本地预测消费了事件
            const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
            socket.emit('batch:confirmed', matchID, batchId, authoritative);
        } finally {
            // 消费 batch 执行期间排队的普通命令和 batch 任务（与 handleCommand 保持一致）
            while (match.commandQueue.length > 0) {
                const next = match.commandQueue.shift()!;
                if ('_batch' in next) {
                    await next.execute();
                    next.resolve(true);
                } else {
                    const queuedSuccess = await this.executeCommandInternal(match, next.playerID, next.commandType, next.payload);
                    next.resolve(queuedSuccess);
                }
            }
            match.executing = false;
        }
    }

    /**
     * batch 核心执行逻辑（供 handleBatch 直接调用和队列消费共用）
     * 调用方负责设置/清理 match.executing，此方法不修改 executing 标志。
     */
    private async executeBatchInternal(
        socket: IOSocket,
        match: ActiveMatch,
        playerID: string,
        batchId: string,
        commands: Array<{ type: string; payload: unknown }>,
    ): Promise<void> {
        const matchID = match.matchID;
        const snapshotState = match.state;
        const snapshotStateID = match.stateID;

        // 批次内命令串行执行（抑制中间广播，避免客户端收到中间状态导致动画重播）
        for (const cmd of commands) {
            const success = await this.executeCommandInternal(match, playerID, cmd.type, cmd.payload, { suppressBroadcast: true });
            if (!success) {
                match.state = snapshotState;
                match.stateID = snapshotStateID;
                const rollbackStored = {
                    G: snapshotState,
                    _stateID: snapshotStateID,
                    randomSeed: match.randomSeed,
                    randomCursor: match.getRandomCursor(),
                };
                await this.storage.setState(matchID, rollbackStored);
                this.broadcastState(match);
                socket.emit('batch:rejected', matchID, batchId, 'command_failed');
                return;
            }
        }

        // 批次成功 - 广播最终状态给所有玩家，然后发送确认给发送者
        this.broadcastState(match);
        const authoritative = this.stripStateForTransport(match.state, { stripEventStream: true });
        socket.emit('batch:confirmed', matchID, batchId, authoritative);
    }

    /**
     * 回滚到指定 stateID（从存储层重新加载）
     */
    private async rollbackToStateID(match: ActiveMatch, targetStateID: number): Promise<void> {
        const result = await this.storage.fetch(match.matchID, { state: true });
        if (!result.state || result.state._stateID !== targetStateID) {
            logger.error(`[GameTransport] Rollback failed: state ${targetStateID} not found`);
            return;
        }

        match.state = result.state.G as MatchState<unknown>;
        match.stateID = targetStateID;

        // 广播回滚后的状态
        this.broadcastState(match);
    }

    /**
     * 传输前状态裁剪（统一入口）
     *
     * 在 playerView 过滤之后、socket.emit 之前调用，移除客户端不需要的大体积数据：
     * 1. undo.snapshots — 完整 MatchState 深拷贝，客户端只需 length（判断能否撤回）
     *    ⚠️ 安全：快照含所有玩家完整状态（手牌/牌库），不过滤会泄漏隐私信息
     * 2. eventStream.entries — 仅在重连/batch确认时清空；正常广播时保留（客户端需消费事件驱动动画）
     * 3. log.entries — 引擎级调试日志（command/event 完整对象），客户端 UI 层不读取
     * 4. tutorial.steps — 客户端只用 step（当前步骤）和 stepIndex，steps 数组只需 length
     *
     * @param options.stripEventStream 是否清空 eventStream.entries（默认 false）
     *   - true: 用于 state:sync（重连）和 batch:confirmed（乐观确认），客户端不需要历史事件
     *   - false: 用于 state:update（正常广播），客户端需要消费事件驱动动画/特效/交互
     */
    private stripStateForTransport(viewState: unknown, options?: { stripEventStream?: boolean }): unknown {
        const state = viewState as { sys?: Record<string, unknown> };
        if (!state.sys) return viewState;

        const sys = state.sys;
        const patches: Record<string, unknown> = {};

        // 1. undo: 清空 snapshots，保留 length 供客户端判断"能否撤回"
        const undo = sys.undo as { snapshots?: unknown[]; maxSnapshots?: number; pendingRequest?: unknown } | undefined;
        if (undo?.snapshots && undo.snapshots.length > 0) {
            patches.undo = {
                ...undo,
                snapshots: [],
                /** 客户端通过此字段判断是否有可撤回的快照 */
                snapshotCount: undo.snapshots.length,
            };
        }

        // 2. eventStream: 仅在 stripEventStream=true 时清空 entries（重连/批次确认）
        //    broadcastState 需要保留 entries，供客户端 EventStream 消费（如技能触发事件）
        const shouldStripEventStream = options?.stripEventStream ?? false;
        if (shouldStripEventStream) {
            const es = sys.eventStream as { entries?: unknown[]; nextId?: number; maxEntries?: number } | undefined;
            if (es?.entries && es.entries.length > 0) {
                const lastEntry = es.entries[es.entries.length - 1] as { id?: number } | undefined;
                patches.eventStream = {
                    ...es,
                    entries: [],
                    nextId: (lastEntry?.id ?? (es.nextId ?? 1) - 1) + 1,
                };
            }
        }

        // 3. log: LogSystem 已移除，无需裁剪（entries 始终为空）

        // 4. tutorial: 只保留 step + stepIndex + 标量字段，steps 数组替换为空数组 + totalSteps
        const tutorial = sys.tutorial as {
            active?: boolean;
            steps?: unknown[];
            step?: unknown;
            stepIndex?: number;
        } | undefined;
        if (tutorial?.steps && tutorial.steps.length > 0) {
            patches.tutorial = {
                ...tutorial,
                steps: [],
                /** 客户端通过此字段判断 isLastStep */
                totalSteps: tutorial.steps.length,
            };
        }

        // 无需裁剪
        if (Object.keys(patches).length === 0) return viewState;

        return {
            ...state,
            sys: { ...sys, ...patches },
        };
    }

    private async executeCommandInternal(
        match: ActiveMatch,
        playerID: string,
        commandType: string,
        payload: unknown,
        options?: { suppressBroadcast?: boolean },
    ): Promise<boolean> {
        const startTime = Date.now();
        const { engineConfig, state, random, playerIds } = match;

        const command: Command = {
            type: commandType,
            playerId: playerID,
            payload,
            timestamp: Date.now(),
        };

        const pipelineConfig: PipelineConfig<unknown, Command, GameEvent> = {
            domain: engineConfig.domain as DomainCore<unknown, Command, GameEvent>,
            systems: engineConfig.systems as EngineSystem<unknown>[],
            systemsConfig: engineConfig.systemsConfig,
        };

        const result = executePipeline(pipelineConfig, state, command, random, playerIds);

        const duration = Date.now() - startTime;

        if (!result.success) {
            gameLogger.commandFailed(
                match.matchID,
                commandType,
                playerID,
                new Error(result.error ?? 'command_failed')
            );

            // 通知发送者
            const nsp = this.io.of('/game');
            const sockets = match.connections.get(playerID);
            if (sockets) {
                for (const sid of sockets) {
                    nsp.to(sid).emit('error', match.matchID, result.error ?? 'command_failed');
                }
            }
            return false;
        }

        // 记录成功日志
        gameLogger.commandExecuted(match.matchID, commandType, playerID, duration);

        // 更新状态
        match.state = result.state;
        match.stateID += 1;
        // 记录最后执行命令的玩家，供 broadcastState 携带到 meta
        match.lastCommandPlayerId = playerID;

        // 撤回恢复：检测 UndoSystem 是否请求重置随机数游标
        const restoredCursor = (result.state.sys?.undo as { restoredRandomCursor?: number } | undefined)?.restoredRandomCursor;
        if (typeof restoredCursor === 'number' && restoredCursor >= 0) {
            // 重建 trackedRandom，从快照记录的游标位置恢复随机序列
            const rebuilt = createTrackedRandom(match.randomSeed, restoredCursor);
            match.random = rebuilt.random;
            match.getRandomCursor = rebuilt.getCursor;
            logger.info('[UndoServer] random-cursor-restored', {
                matchID: match.matchID,
                restoredCursor,
            });
            // 清除信号，避免持久化到存储层
            match.state = {
                ...match.state,
                sys: {
                    ...match.state.sys,
                    undo: {
                        ...match.state.sys.undo,
                        restoredRandomCursor: undefined,
                    },
                },
            };
        }

        // 持久化
        const storedState: StoredMatchState = {
            G: match.state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(match.matchID, storedState);

        // 广播状态（批次执行期间抑制中间广播，仅在批次完成后统一广播）
        if (!options?.suppressBroadcast) {
            this.broadcastState(match);
        }

        // 检查游戏结束（管线已将结果写入 sys.gameover）
        const gameOver = result.state.sys.gameover;
        if (gameOver && !match.metadata.gameover) {
            match.metadata.gameover = gameOver;
            await this.storage.setMetadata(match.matchID, match.metadata);
            this.onGameOver?.(match.matchID, engineConfig.gameId, gameOver);
        }

        return true;
    }

    private handleDisconnect(socket: IOSocket): void {
        const info = this.socketIndex.get(socket.id);
        if (!info) return;

        // 记录断开日志
        gameLogger.socketDisconnected(socket.id, info.matchID, 'client_disconnect');

        this.socketIndex.delete(socket.id);
        this.removeSocketFromMatch(socket.id, info);
    }

    private removeSocketFromMatch(socketId: string, info: SocketInfo): void {
        const match = this.activeMatches.get(info.matchID);
        if (!match) return;

        if (info.playerID === null) {
            match.spectatorSockets.delete(socketId);
            return;
        }

        const conns = match.connections.get(info.playerID);
        if (conns) {
            conns.delete(socketId);
            if (conns.size === 0) {
                match.connections.delete(info.playerID);
                this.onPlayerFullyDisconnected(match, info.playerID);
            }
        }
    }

    private onPlayerFullyDisconnected(
        match: ActiveMatch,
        playerID: string,
    ): void {
        // 更新 metadata
        if (match.metadata.players[playerID]) {
            match.metadata.players[playerID].isConnected = false;
            this.storage.setMetadata(match.matchID, match.metadata).catch((err) => {
                logger.error(`[GameTransport] setMetadata 失败（断线标记可能未持久化） matchID=${match.matchID} playerID=${playerID}`, err);
            });
        }

        // 通知其他玩家
        const nsp = this.io.of('/game');
        nsp.to(`game:${match.matchID}`).emit('player:disconnected', match.matchID, playerID);

        // 启动离线裁决定时器
        this.scheduleOfflineAdjudication(match, playerID);
    }

    // ========================================================================
    // 离线交互裁决
    // ========================================================================

    private scheduleOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): void {
        // 清除已有定时器
        const existing = match.offlineTimers.get(playerID);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            match.offlineTimers.delete(playerID);
            void this.runOfflineAdjudication(match, playerID);
        }, this.offlineGraceMs);

        match.offlineTimers.set(playerID, timer);
    }

    private async runOfflineAdjudication(
        match: ActiveMatch,
        playerID: string,
    ): Promise<void> {
        // 检查玩家是否仍然离线
        if (match.connections.has(playerID)) return;

        // 检查是否有待处理的交互属于该玩家
        const interaction = (match.state.sys as {
            interaction?: {
                current?: { kind?: string; playerId?: string };
            };
        })
            ?.interaction?.current;
        if (!interaction || interaction.playerId !== playerID) return;

        const commandType = resolveOfflineAdjudicationCommandType(interaction.kind);

        // 离线裁决必须与玩家命令共用同一串行通道，避免并发写状态
        await this.handleCommand(match.matchID, playerID, commandType, {});
    }

    // ========================================================================
    // 状态广播
    // ========================================================================

    private broadcastState(match: ActiveMatch): void {
        const nsp = this.io.of('/game');
        const matchPlayers = this.buildMatchPlayers(match);

        // 附带 stateID + lastCommandPlayerId + randomCursor 元数据，供乐观引擎精确匹配和随机数同步
        const meta: { stateID: number; lastCommandPlayerId?: string; randomCursor: number } = {
            stateID: match.stateID,
            randomCursor: match.getRandomCursor(),
        };
        if (match.lastCommandPlayerId) {
            meta.lastCommandPlayerId = match.lastCommandPlayerId;
        }

        // 对每个已连接的玩家发送经 playerView 过滤 + 传输裁剪的状态
        for (const [playerID, sockets] of match.connections) {
            const viewState = this.stripStateForTransport(this.applyPlayerView(match, playerID));
            for (const sid of sockets) {
                nsp.to(sid).emit('state:update', match.matchID, viewState, matchPlayers, meta);
            }
        }

        // 旁观者使用 spectator 视图（当前默认完整视图）
        if (match.spectatorSockets.size > 0) {
            const spectatorView = this.stripStateForTransport(this.applyPlayerView(match, null));
            for (const sid of match.spectatorSockets) {
                nsp.to(sid).emit('state:update', match.matchID, spectatorView, matchPlayers, meta);
            }
        }
    }

    private applyPlayerView(match: ActiveMatch, playerID: string | null): unknown {
        const { engineConfig, state } = match;
        let viewCore = state.core;
        let viewSys: unknown = state.sys;

        if (playerID !== null && engineConfig.domain.playerView) {
            const partial = engineConfig.domain.playerView(state.core, playerID);
            viewCore = partial !== undefined ? { ...(state.core as Record<string, unknown>), ...partial } : state.core;
        }

        if (playerID !== null) {
            for (const system of engineConfig.systems as EngineSystem<unknown>[]) {
                if (!system.playerView) continue;
                const sysPartial = system.playerView(state as MatchState<unknown>, playerID);
                viewSys = { ...(viewSys as Record<string, unknown>), ...sysPartial };
            }
        }

        return { sys: viewSys, core: viewCore };
    }

    private buildMatchPlayers(match: ActiveMatch): MatchPlayerInfo[] {
        return Object.entries(match.metadata.players).map(([id, data]) => ({
            id: Number(id),
            name: data.name,
            isConnected: data.isConnected,
        }));
    }

    // ========================================================================
    // 对局加载
    // ========================================================================

    private async loadMatch(matchID: string): Promise<ActiveMatch | undefined> {
        const result = await this.storage.fetch(matchID, { state: true, metadata: true });
        if (!result.state || !result.metadata) return undefined;

        const gameId = result.metadata.gameName;
        const engineConfig = this.gameIndex.get(gameId);
        if (!engineConfig) return undefined;

        const state = result.state.G as MatchState<unknown>;
        const playerIds = Object.keys(result.metadata.players) as PlayerId[];

        const randomSeed = resolveStoredRandomSeed(result.state, matchID);
        const randomCursor = resolveStoredRandomCursor(result.state);
        const trackedRandom = createTrackedRandom(randomSeed, randomCursor);

        const match: ActiveMatch = {
            matchID,
            gameId,
            engineConfig,
            state,
            metadata: result.metadata,
            randomSeed,
            random: trackedRandom.random,
            getRandomCursor: trackedRandom.getCursor,
            playerIds,
            stateID: result.state._stateID,
            lastCommandPlayerId: null,
            connections: new Map(),
            spectatorSockets: new Set(),
            offlineTimers: new Map(),
            executing: false,
            commandQueue: [],
        };

        this.activeMatches.set(matchID, match);
        return match;
    }

    private async validateCommandAuth(
        matchID: string,
        playerID: string,
        credentials?: string,
    ): Promise<boolean> {
        if (!this.authenticate) return true;

        const result = await this.storage.fetch(matchID, { metadata: true });
        const metadata = result.metadata;
        if (!metadata) return false;

        const ok = await this.authenticate(matchID, playerID, credentials, metadata);
        if (!ok) return false;

        const active = this.activeMatches.get(matchID);
        if (active) {
            active.metadata = metadata;
        }
        return true;
    }
}
