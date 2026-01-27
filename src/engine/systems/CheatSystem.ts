/**
 * Cheat 系统（仅开发模式）
 * 
 * 提供调试用的作弊命令，用于快速测试游戏状态。
 */

import type { PlayerId } from '../types';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

// ============================================================================
// Cheat 命令类型
// ============================================================================

export const CHEAT_COMMANDS = {
    /** 修改资源值 */
    SET_RESOURCE: 'SYS_CHEAT_SET_RESOURCE',
    /** 增加资源值 */
    ADD_RESOURCE: 'SYS_CHEAT_ADD_RESOURCE',
    /** 设置回合阶段 */
    SET_PHASE: 'SYS_CHEAT_SET_PHASE',
    /** 抽取指定卡牌 */
    DRAW_SPECIFIC_CARD: 'SYS_CHEAT_DRAW_SPECIFIC_CARD',
    /** 根据索引发牌（从牌库指定位置发牌到手牌） */
    DEAL_CARD_BY_INDEX: 'SYS_CHEAT_DEAL_CARD_BY_INDEX',
    /** 设置骰子面 */
    SET_DICE: 'SYS_CHEAT_SET_DICE',
    /** 设置 Token 数量 */
    SET_TOKEN: 'SYS_CHEAT_SET_TOKEN',
    /** 直接设置整个游戏状态（调试用） */
    SET_STATE: 'SYS_CHEAT_SET_STATE',
} as const;

// ============================================================================
// Cheat Payload 类型
// ============================================================================

export interface SetResourcePayload {
    playerId: PlayerId;
    resourceId: string;
    value: number;
}

export interface AddResourcePayload {
    playerId: PlayerId;
    resourceId: string;
    delta: number;
}

export interface SetPhasePayload {
    phase: string;
}

export interface SetDicePayload {
    diceValues: number[];
}

export interface SetTokenPayload {
    playerId: PlayerId;
    tokenId: string;
    amount: number;
}

export interface SetStatePayload<TCore> {
    state: TCore;
}

export interface DealCardByIndexPayload {
    playerId: PlayerId;
    /** 牌库索引（0=牌库顶，从前往后） */
    deckIndex: number;
}

// ============================================================================
// 通用资源修改器接口
// ============================================================================

export interface CheatResourceModifier<TCore> {
    /** 获取玩家资源值 */
    getResource: (core: TCore, playerId: PlayerId, resourceId: string) => number | undefined;
    /** 设置玩家资源值 */
    setResource: (core: TCore, playerId: PlayerId, resourceId: string, value: number) => TCore;
    /** 设置阶段（可选） */
    setPhase?: (core: TCore, phase: string) => TCore;
    /** 设置骰子值（可选） */
    setDice?: (core: TCore, values: number[]) => TCore;
    /** 设置 Token 数量（可选） */
    setToken?: (core: TCore, playerId: PlayerId, tokenId: string, amount: number) => TCore;
    /** 根据索引发牌（可选） */
    dealCardByIndex?: (core: TCore, playerId: PlayerId, deckIndex: number) => TCore;
}

// ============================================================================
// 创建 Cheat 系统
// ============================================================================

export function createCheatSystem<TCore>(
    modifier?: CheatResourceModifier<TCore>
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.CHEAT,
        name: 'Cheat 系统',
        priority: 1, // 最高优先级，确保作弊命令最先处理

        beforeCommand: ({ state, command }): HookResult<TCore> | void => {
            // 仅在开发模式下生效
            if (typeof window !== 'undefined' && !import.meta.env.DEV) {
                if (command.type.startsWith('SYS_CHEAT_')) {
                    return { halt: true, error: '作弊命令仅在开发模式下可用' };
                }
                return;
            }

            if (!modifier) return;

            // 处理设置资源命令
            if (command.type === CHEAT_COMMANDS.SET_RESOURCE) {
                const payload = command.payload as SetResourcePayload;
                const newCore = modifier.setResource(
                    state.core,
                    payload.playerId,
                    payload.resourceId,
                    payload.value
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理增加资源命令
            if (command.type === CHEAT_COMMANDS.ADD_RESOURCE) {
                const payload = command.payload as AddResourcePayload;
                const currentValue = modifier.getResource(
                    state.core,
                    payload.playerId,
                    payload.resourceId
                ) ?? 0;
                const newCore = modifier.setResource(
                    state.core,
                    payload.playerId,
                    payload.resourceId,
                    currentValue + payload.delta
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理设置阶段命令
            if (command.type === CHEAT_COMMANDS.SET_PHASE && modifier.setPhase) {
                const payload = command.payload as SetPhasePayload;
                const newCore = modifier.setPhase(state.core, payload.phase);
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理设置骰子命令
            if (command.type === CHEAT_COMMANDS.SET_DICE && modifier.setDice) {
                const payload = command.payload as SetDicePayload;
                const newCore = modifier.setDice(state.core, payload.diceValues);
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理设置 Token 命令
            if (command.type === CHEAT_COMMANDS.SET_TOKEN && modifier.setToken) {
                const payload = command.payload as SetTokenPayload;
                const newCore = modifier.setToken(
                    state.core,
                    payload.playerId,
                    payload.tokenId,
                    payload.amount
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }
            
            // 处理根据索引发牌命令
            if (command.type === CHEAT_COMMANDS.DEAL_CARD_BY_INDEX && modifier.dealCardByIndex) {
                const payload = command.payload as DealCardByIndexPayload;
                const newCore = modifier.dealCardByIndex(
                    state.core,
                    payload.playerId,
                    payload.deckIndex
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }
            
            // 处理直接设置状态命令
            if (command.type === CHEAT_COMMANDS.SET_STATE) {
                const payload = command.payload as SetStatePayload<TCore>;
                return {
                    halt: true,
                    state: { ...state, core: payload.state },
                };
            }
        },
    };
}
