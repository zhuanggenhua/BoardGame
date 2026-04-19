/**
 * 引擎适配器工厂
 *
 * 将 Domain Core + Systems 组装成 GameEngineConfig（用于 GameTransportServer）。
 * 同时提供 createReplayAdapter 用于确定性回放。
 */

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
} from './pipeline';

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
    /** 显式命令类型列表（用于命令校验与调试面板展示） */
    commandTypes?: string[];
    /** 是否禁用撤销 */
    disableUndo?: boolean;
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

// ============================================================================
// 创建引擎配置
// ============================================================================

/**
 * 从 AdapterConfig 创建 GameEngineConfig
 *
 * 用于 GameTransportServer，是引擎的唯一入口。
 */
export function createGameEngine<
    TCore,
    TCommand extends Command = Command,
    TEvent extends GameEvent = GameEvent
>(config: AdapterConfig<TCore, TCommand, TEvent>): import('./transport/server').GameEngineConfig<TCore, TCommand, TEvent> {
    return {
        gameId: config.domain.gameId,
        domain: config.domain,
        systems: config.systems,
        systemsConfig: config.systemsConfig,
        commandTypes: config.commandTypes,
        minPlayers: config.minPlayers,
        maxPlayers: config.maxPlayers,
        disableUndo: config.disableUndo,
    };
}
