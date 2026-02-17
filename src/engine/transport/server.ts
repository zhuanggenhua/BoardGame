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
    'dt:card-interaction': 'CANCEL_INTERACTION',
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
    /** 命令执行锁（串行执行） */
    executing: boolean;
    /** 待执行命令队列 */
    commandQueue: Array<{
        commandType: string;
        payload: unknown;
        playerID: string;
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
                return base.d(max);
            },
            range: (min: number, max: number) => {
                cursor += 1;
                return base.range(min, max);
            },
            shuffle: <T>(array: T[]): T[] => {
                cursor += Math.max(0, array.length - 1);
                return base.shuffle(array);
            },
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
                await this.handleCommand(matchID, info.playerID, commandType, payload);
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

        console.log(`[TEST] State injected for match ${matchID}`);
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
                    console.warn('[GameTransport] disconnect player sockets failed', {
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
                    console.warn('[GameTransport] disconnect room sockets failed', { matchID, error });
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

        // 发送当前状态（经 playerView 过滤）
        const viewState = this.applyPlayerView(match, playerID);
        const matchPlayers = this.buildMatchPlayers(match);
        socket.emit('state:sync', matchID, viewState, matchPlayers);

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

            // 处理队列中的后续命令
            while (match.commandQueue.length > 0) {
                const next = match.commandQueue.shift()!;
                const queuedSuccess = await this.executeCommandInternal(match, next.playerID, next.commandType, next.payload);
                next.resolve(queuedSuccess);
            }

            return success;
        } finally {
            match.executing = false;
        }
    }

    private async executeCommandInternal(
        match: ActiveMatch,
        playerID: string,
        commandType: string,
        payload: unknown,
    ): Promise<boolean> {
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

        if (!result.success) {
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

        // 更新状态
        match.state = result.state;
        match.stateID += 1;

        // 持久化
        const storedState: StoredMatchState = {
            G: result.state,
            _stateID: match.stateID,
            randomSeed: match.randomSeed,
            randomCursor: match.getRandomCursor(),
        };
        await this.storage.setState(match.matchID, storedState);

        // 广播状态（每个玩家收到经 playerView 过滤的版本）
        this.broadcastState(match);

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
                console.error(`[GameTransport] setMetadata 失败（断线标记可能未持久化） matchID=${match.matchID} playerID=${playerID}`, err);
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

        // 对每个已连接的玩家发送经 playerView 过滤的状态
        for (const [playerID, sockets] of match.connections) {
            const viewState = this.applyPlayerView(match, playerID);
            for (const sid of sockets) {
                nsp.to(sid).emit('state:update', match.matchID, viewState, matchPlayers);
            }
        }

        // 旁观者使用 spectator 视图（当前默认完整视图）
        if (match.spectatorSockets.size > 0) {
            const spectatorView = this.applyPlayerView(match, null);
            for (const sid of match.spectatorSockets) {
                nsp.to(sid).emit('state:update', match.matchID, spectatorView, matchPlayers);
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
