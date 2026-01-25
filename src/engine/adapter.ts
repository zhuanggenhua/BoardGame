/**
 * Boardgame.io 适配器工厂
 * 
 * 将 Domain Core + Systems 组装成 Boardgame.io Game。
 * 适配层是"纪律执行点"：规则不得写在 moves，隐藏信息必须由统一机制过滤。
 */

import type { Game, Move } from 'boardgame.io';
import type {
    Command,
    DomainCore,
    GameEvent,
    GameOverResult,
    MatchState,
    PlayerId,
    RandomFn,
} from './types';
import type { EngineSystem, GameSystemsConfig } from './systems/types';
import {
    createInitialSystemState,
    createSeededRandom,
    executePipeline,
    type PipelineConfig,
} from './pipeline';
import { dispatchEngineNotification } from './notifications';
import { UNDO_COMMANDS } from './systems/UndoSystem';
import { REMATCH_COMMANDS } from './systems/RematchSystem';
import { PROMPT_COMMANDS } from './systems/PromptSystem';

// 所有系统命令（自动合并到 commandTypes）
const ALL_SYSTEM_COMMANDS: string[] = [
    ...Object.values(UNDO_COMMANDS),
    ...Object.values(REMATCH_COMMANDS),
    ...Object.values(PROMPT_COMMANDS),
];

// ============================================================================
// 适配器配置
// ============================================================================

export interface AdapterConfig<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
> {
    /** 领域内核 */
    domain: DomainCore<TCore, TCommand, TEvent>;
    /** 启用的系统 */
    systems: EngineSystem<TCore>[];
    /** 系统配置 */
    systemsConfig?: GameSystemsConfig;
    /** 玩家数量范围 */
    minPlayers?: number;
    maxPlayers?: number;
    /** 显式命令类型列表（用于生成可枚举 moves） */
    commandTypes?: string[];
    /** 是否禁用撤销 */
    disableUndo?: boolean;
}

// ============================================================================
// 创建适配器
// ============================================================================

export function createGameAdapter<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
>(config: AdapterConfig<TCore, TCommand, TEvent>): Game<MatchState<TCore>> {
    const { domain, systems, systemsConfig, commandTypes } = config;
    const undoCommandTypes = new Set<string>(Object.values(UNDO_COMMANDS));
    const systemCommandTypes = new Set<string>(ALL_SYSTEM_COMMANDS);

    // 自动合并系统命令到 commandTypes（游戏无需手动添加）
    const mergedCommandTypes = commandTypes?.length
        ? [...new Set([...commandTypes, ...ALL_SYSTEM_COMMANDS])]
        : undefined;

    // 生成通用 move 处理器
    const createMoveHandler = (commandType: string): Move<MatchState<TCore>> => {
        return ({ G, ctx, random, playerID }, payload: unknown) => {
            const coreCurrentPlayer = (G as { core?: { currentPlayer?: string } }).core?.currentPlayer;
            const isSystemCommand = systemCommandTypes.has(commandType);
            const isAssumedPlayer = playerID === null
                || playerID === undefined
                || String(playerID) === String(ctx.currentPlayer);
            const isClient = typeof window !== 'undefined';
            const shouldAvoidCtxPlayer = isClient && (playerID === null || playerID === undefined) && !coreCurrentPlayer;
            const globalMode = isClient
                ? (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__
                : undefined;
            const isLocalMode = globalMode === 'local';
            const shouldSkipValidation = playerID === null || playerID === undefined || isLocalMode;
            const resolvedPlayerId = (!isSystemCommand && isClient && coreCurrentPlayer && isAssumedPlayer)
                ? coreCurrentPlayer
                : (shouldAvoidCtxPlayer ? playerID : (playerID ?? coreCurrentPlayer ?? ctx.currentPlayer));
            const normalizedPlayerId = resolvedPlayerId !== null && resolvedPlayerId !== undefined
                ? String(resolvedPlayerId)
                : '';
            const isUndoCommand = undoCommandTypes.has(commandType);

            const command: Command = {
                type: commandType,
                playerId: normalizedPlayerId,
                payload,
                timestamp: Date.now(),
                skipValidation: shouldSkipValidation,
            };

            if (isUndoCommand) {
                console.log('[撤销调试][命令]', {
                    commandType,
                    playerId: normalizedPlayerId,
                    ctxCurrentPlayer: ctx.currentPlayer,
                    payload,
                });
            }

            // 创建随机数生成器（包装 Boardgame.io 的 random）
            const randomFn: RandomFn = {
                random: () => random.Number(),
                d: (max: number) => random.Die(max),
                range: (min: number, max: number) => min + Math.floor(random.Number() * (max - min + 1)),
                shuffle: <T>(array: T[]): T[] => random.Shuffle(array),
            };

            // 获取玩家列表
            const playerIds = (ctx.playOrder as Array<string | number>).map((id) => String(id)) as PlayerId[];

            // 执行管线
            const pipelineConfig: PipelineConfig<TCore, Command, GameEvent> = {
                domain: domain as DomainCore<TCore, Command, GameEvent>,
                systems,
                systemsConfig,
            };

            const result = executePipeline(
                pipelineConfig,
                G,
                command,
                randomFn,
                playerIds
            );

            if (isUndoCommand) {
                console.log('[撤销调试][结果]', {
                    commandType,
                    success: result.success,
                    error: result.error,
                    pendingRequest: result.state.sys.undo.pendingRequest,
                    historyLen: result.state.sys.undo.snapshots.length,
                });
            }

            if (!result.success) {
                dispatchEngineNotification({
                    gameId: domain.gameId,
                    error: result.error ?? 'unknownError',
                });
                return;
            }

            // 直接修改 G（Boardgame.io 使用 Immer）
            Object.assign(G, result.state);
        };
    };

    // 生成 moves（需可枚举，否则 Boardgame.io client 无法注入）
    // 系统命令已自动合并，游戏只需声明业务命令
    const moves: Record<string, Move<MatchState<TCore>>> = mergedCommandTypes?.length
        ? Object.fromEntries(mergedCommandTypes.map((type) => [type, createMoveHandler(type)]))
        : new Proxy(
            {},
            {
                get: (_target, prop: string) => createMoveHandler(prop),
            }
        );

    return {
        name: domain.gameId,

        setup: ({ ctx, random }): MatchState<TCore> => {
            const playerIds = ctx.playOrder as PlayerId[];
            
            // 封装 boardgame.io 的 random 为引擎层 RandomFn
            const randomFn: RandomFn = {
                random: () => random.Number(),
                d: (max: number) => random.Die(max),
                range: (min: number, max: number) => min + Math.floor(random.Number() * (max - min + 1)),
                shuffle: <T>(array: T[]): T[] => random.Shuffle([...array]),
            };
            
            const core = domain.setup(playerIds, randomFn);
            const sys = createInitialSystemState(playerIds, systems, undefined);

            return { sys, core };
        },

        moves,

        turn: {
            // 允许所有玩家在所有阶段尝试动作，实际权限由 domain.validate 控制
            activePlayers: { all: 'play' },
        },

        endIf: ({ G }): GameOverResult | undefined => {
            if (domain.isGameOver) {
                return domain.isGameOver(G.core);
            }
            return undefined;
        },

        playerView: ({ G, playerID }): MatchState<TCore> => {
            if (!playerID) return G;

            let viewCore = G.core;
            let viewSys = G.sys;

            // 应用领域层的视图过滤
            if (domain.playerView) {
                viewCore = { ...G.core, ...domain.playerView(G.core, playerID) };
            }

            // 应用系统层的视图过滤
            for (const system of systems) {
                if (system.playerView) {
                    viewSys = { ...viewSys, ...system.playerView(G, playerID) };
                }
            }

            return { sys: viewSys, core: viewCore };
        },

        minPlayers: config.minPlayers ?? 2,
        maxPlayers: config.maxPlayers ?? 2,
    };
}

// ============================================================================
// 辅助函数：创建确定性适配器（用于回放）
// ============================================================================

export function createReplayAdapter<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
>(
    domain: DomainCore<TCore, TCommand, TEvent>,
    seed: string
): {
    setup: (playerIds: PlayerId[]) => TCore;
    execute: (state: TCore, command: TCommand) => { state: TCore; events: TEvent[] };
} {
    const random = createSeededRandom(seed);

    return {
        setup: (playerIds: PlayerId[]) => domain.setup(playerIds, random),
        execute: (state: TCore, command: TCommand) => {
            const events = domain.execute(state, command, random);
            let newState = state;
            for (const event of events) {
                newState = domain.reduce(newState, event);
            }
            return { state: newState, events };
        },
    };
}
