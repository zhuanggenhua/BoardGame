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
    TutorialRandomPolicy,
    TutorialState,
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
import { FLOW_COMMANDS } from './systems/FlowSystem';
import { TUTORIAL_COMMANDS } from './systems/TutorialSystem';

// 所有系统命令（自动合并到 commandTypes）
const ALL_SYSTEM_COMMANDS: string[] = [
    ...Object.values(FLOW_COMMANDS),
    ...Object.values(UNDO_COMMANDS),
    ...Object.values(REMATCH_COMMANDS),
    ...Object.values(PROMPT_COMMANDS),
    ...Object.values(TUTORIAL_COMMANDS),
];

const RANDOM_SEQUENCE_MAX = 1000000;

const normalizePolicyValue = (value: number, max: number): number => {
    if (!Number.isFinite(value) || max <= 0) return 1;
    const floored = Math.floor(value);
    if (floored <= 0) return 1;
    if (floored > max) return ((floored - 1) % max) + 1;
    return floored;
};

const getTutorialPolicy = (tutorial?: TutorialState): TutorialRandomPolicy | undefined => {
    if (!tutorial?.active) return undefined;
    const policy = tutorial.randomPolicy;
    if (!policy || policy.values.length === 0) return undefined;
    return policy;
};

type TutorialRandomTracker = { consumed: number };

const createTutorialRandom = (
    base: RandomFn,
    getTutorial: () => TutorialState | undefined,
    tracker: TutorialRandomTracker
): RandomFn => {
    const consume = (max: number): number | null => {
        const policy = getTutorialPolicy(getTutorial());
        if (!policy) return null;
        const values = policy.values;
        if (values.length === 0) return null;
        if (policy.mode === 'fixed') {
            return normalizePolicyValue(values[0], max);
        }
        const cursor = policy.cursor ?? 0;
        const index = (cursor + tracker.consumed) % values.length;
        tracker.consumed += 1;
        return normalizePolicyValue(values[index], max);
    };

    return {
        random: () => {
            const value = consume(RANDOM_SEQUENCE_MAX);
            if (value === null) return base.random();
            return (value - 1) / RANDOM_SEQUENCE_MAX;
        },
        d: (max: number) => {
            const value = consume(max);
            return value ?? base.d(max);
        },
        range: (min: number, max: number) => {
            const span = max - min + 1;
            const value = consume(span);
            return value === null ? base.range(min, max) : min + value - 1;
        },
        shuffle: <T>(array: T[]): T[] => {
            const policy = getTutorialPolicy(getTutorial());
            if (!policy) return base.shuffle(array);
            const result = [...array];
            for (let i = result.length - 1; i > 0; i--) {
                const value = consume(i + 1);
                if (value === null) return base.shuffle(array);
                const j = value - 1;
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        },
    };
};

const applyTutorialRandomCursor = (tutorial: TutorialState, consumed: number): TutorialState => {
    if (!tutorial.active || consumed <= 0) return tutorial;
    const policy = tutorial.randomPolicy;
    if (!policy || policy.mode !== 'sequence') return tutorial;
    const cursor = policy.cursor ?? 0;
    return {
        ...tutorial,
        randomPolicy: {
            ...policy,
            cursor: cursor + consumed,
        },
    };
};

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

    // 自动合并系统命令到 commandTypes（游戏无需手动添加）
    const mergedCommandTypes = commandTypes?.length
        ? [...new Set([...commandTypes, ...ALL_SYSTEM_COMMANDS])]
        : undefined;

    // 生成通用 move 处理器
    const createMoveHandler = (commandType: string): Move<MatchState<TCore>> => {
        let warnedSpectator = false;
        return ({ G, ctx, random, playerID }, payload: unknown) => {
            const coreCurrentPlayer = (G as { core?: { currentPlayer?: string } }).core?.currentPlayer;
            const isClient = typeof window !== 'undefined';

            const globalMode = isClient
                ? (window as Window & { __BG_GAME_MODE__?: string; __BG_IS_SPECTATOR__?: boolean }).__BG_GAME_MODE__
                : undefined;
            const isSpectator = isClient
                ? (window as Window & { __BG_IS_SPECTATOR__?: boolean }).__BG_IS_SPECTATOR__ === true
                : false;
            const isLocalLikeMode = globalMode === 'local' || globalMode === 'tutorial';
            if (!isLocalLikeMode && isSpectator) {
                if (isClient && import.meta.env.DEV && !warnedSpectator) {
                    console.warn('[Spectate][Adapter] blocked command', { commandType });
                    warnedSpectator = true;
                }
                return;
            }

            // 重要：在 online 模式下，缺失 playerID 时不能允许用 ctx.currentPlayer 行动。
            // 否则旁观者可能修改状态。
            const isMissingPlayer = playerID === null || playerID === undefined;
            if (!isLocalLikeMode && isMissingPlayer) {
                // 在服务端所有对局都是 online；在客户端这表示旁观者模式。
                return;
            }

            // 仅 local/tutorial 可跳过校验。
            const shouldSkipValidation = isLocalLikeMode;

            // 解析实际行动者 playerId。
            // - local/tutorial：hotseat 模式下由当前回合玩家行动（忽略 boardgame.io 的 playerID，避免永远是 P0）。
            // - online：要求显式 playerID。
            const resolvedPlayerId = isLocalLikeMode
                ? (coreCurrentPlayer ?? ctx.currentPlayer)
                : playerID;

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

            // 日志已移除：教程系统已稳定

            // 撤销调试日志只在 DEV 下输出，避免正常开发被刷屏。
            if (isUndoCommand && import.meta.env.DEV) {
                console.log('[撤销调试][命令]', {
                    commandType,
                    playerId: normalizedPlayerId,
                    ctxCurrentPlayer: ctx.currentPlayer,
                    payload,
                });
            }

            const tutorialTracker: TutorialRandomTracker = { consumed: 0 };

            // 创建随机数生成器（包装 Boardgame.io 的 random）
            const baseRandom: RandomFn = {
                random: () => random.Number(),
                d: (max: number) => random.Die(max),
                range: (min: number, max: number) => min + Math.floor(random.Number() * (max - min + 1)),
                shuffle: <T>(array: T[]): T[] => random.Shuffle(array),
            };
            const randomFn = createTutorialRandom(
                baseRandom,
                () => (G as MatchState<TCore>).sys?.tutorial,
                tutorialTracker
            );

            // 获取玩家列表
            const playerIds = (ctx.playOrder as Array<string | number>).map((id) => String(id)) as PlayerId[];

            // 执行管线
            const pipelineConfig: PipelineConfig<TCore, Command, GameEvent> = {
                domain: domain as DomainCore<TCore, Command, GameEvent>,
                systems,
                systemsConfig,
            };

            // 调试日志
            if (commandType === 'ADVANCE_PHASE') {
                console.log('[ADVANCE_PHASE] 执行前', {
                    commandType,
                    playerId: normalizedPlayerId,
                    currentPhase: (G as { core?: { turnPhase?: string } }).core?.turnPhase,
                });
            }

            let result = executePipeline(
                pipelineConfig,
                G,
                command,
                randomFn,
                playerIds
            );

            if (result.success && tutorialTracker.consumed > 0) {
                const updatedTutorial = applyTutorialRandomCursor(
                    result.state.sys.tutorial,
                    tutorialTracker.consumed
                );
                if (updatedTutorial !== result.state.sys.tutorial) {
                    result = {
                        ...result,
                        state: {
                            ...result.state,
                            sys: {
                                ...result.state.sys,
                                tutorial: updatedTutorial,
                            },
                        },
                    };
                }
            }

            // 调试日志
            if (commandType === 'ADVANCE_PHASE') {
                console.log('[ADVANCE_PHASE] 执行后', {
                    success: result.success,
                    error: result.error,
                    'sys.phase': (result.state as { sys?: { phase?: string } }).sys?.phase,
                    'core.turnPhase': (result.state as { core?: { turnPhase?: string } }).core?.turnPhase,
                });
            }

            if (isUndoCommand && import.meta.env.DEV) {
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

            // 日志已移除：教程系统已稳定

            // 直接修改 G（Boardgame.io 使用 Immer）
            Object.assign(G, result.state);

            // 日志已移除：教程系统已稳定
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
            const playerIds = (ctx.playOrder as Array<string | number>).map((id) => String(id)) as PlayerId[];
            
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
    setup: (playerIds: PlayerId[]) => MatchState<TCore>;
    execute: (state: MatchState<TCore>, command: TCommand) => { state: MatchState<TCore>; events: TEvent[] };
} {
    const random = createSeededRandom(seed);

    return {
        setup: (playerIds: PlayerId[]) => {
            const core = domain.setup(playerIds, random);
            const sys = createInitialSystemState(playerIds, [], undefined);
            return { sys, core };
        },
        execute: (state: MatchState<TCore>, command: TCommand) => {
            const events = domain.execute(state, command, random);
            let core = state.core;
            for (const event of events) {
                core = domain.reduce(core, event);
            }
            return { state: { ...state, core }, events };
        },
    };
}
