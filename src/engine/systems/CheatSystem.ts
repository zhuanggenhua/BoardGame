/**
 * Cheat 系统
 * 
 * 提供调试用的作弊命令，用于快速测试游戏状态。
 * 教程系统也依赖作弊命令注入固定手牌/资源。
 */

import type { MatchState, PipelineContext, PlayerId } from '../types';
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
    /** 兼容旧教程/旧面板的 deck-only atlas 发牌；atlas 不是跨游戏稳定主键 */
    DEAL_CARD_BY_ATLAS_INDEX: 'SYS_CHEAT_DEAL_CARD_BY_ATLAS_INDEX',
    /** 根据稳定 cardId 直接补牌到手牌（不依赖当前剩余牌库） */
    ADD_CARD_TO_HAND_BY_CARD_ID: 'SYS_CHEAT_ADD_CARD_TO_HAND_BY_CARD_ID',
    /** 根据索引发牌（只从当前剩余牌库指定位置移动到手牌） */
    DEAL_CARD_BY_INDEX: 'SYS_CHEAT_DEAL_CARD_BY_INDEX',
    /** 根据图集索引将牌库卡牌移入弃牌堆 */
    DEAL_CARD_TO_DISCARD: 'SYS_CHEAT_DEAL_CARD_TO_DISCARD',
    /** 设置骰子面 */
    SET_DICE: 'SYS_CHEAT_SET_DICE',
    /** 设置 Token 数量 */
    SET_TOKEN: 'SYS_CHEAT_SET_TOKEN',
    /** 设置状态效果数量 */
    SET_STATUS: 'SYS_CHEAT_SET_STATUS',
    /** 直接设置整个游戏状态（调试用） */
    SET_STATE: 'SYS_CHEAT_SET_STATE',
    /** 合并部分字段到游戏状态（教程注入 pendingDamage 等场景） */
    MERGE_STATE: 'SYS_CHEAT_MERGE_STATE',
    /** 删除手牌（按 uid 从手牌移入弃牌堆） */
    REMOVE_HAND_CARD: 'SYS_CHEAT_REMOVE_HAND_CARD',
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
    phase?: string;
}

export interface SetTokenPayload {
    playerId: PlayerId;
    tokenId: string;
    amount: number;
}

export interface SetStatusPayload {
    playerId: PlayerId;
    statusId: string;
    amount: number;
}

export interface SetStatePayload<TCore> {
    state: TCore;
}

export interface MergeStatePayload {
    /** 要合并到 core 的部分字段 */
    fields: Record<string, unknown>;
}

export interface DealCardByIndexPayload {
    playerId: PlayerId;
    /** 牌库索引（0=牌库顶，从前往后） */
    deckIndex: number;
}

export interface DealCardByAtlasIndexPayload {
    playerId: PlayerId;
    /** 图集索引。仅用于兼容 deck-only atlas helper，不应当作稳定身份键。 */
    atlasIndex: number;
}

export interface AddCardToHandByCardIdPayload {
    playerId: PlayerId;
    /** 游戏层稳定 cardId。若游戏不支持完整卡池注入，UI 必须显式降级为 deck-only。 */
    cardId: string;
}

export interface DealCardToDiscardPayload {
    playerId: PlayerId;
    /** 图集索引 */
    atlasIndex: number;
}

export interface RemoveHandCardPayload {
    playerId: PlayerId;
    /** 手牌的 uid */
    cardUid: string;
}

// ============================================================================
// 通用资源修改器接口
// ============================================================================

export type CheatCommandHandler<TCore> = (
    ctx: PipelineContext<TCore>,
) => HookResult<TCore> | void;

export interface CheatResourceModifier<TCore> {
    /** 获取玩家资源值 */
    getResource: (core: TCore, playerId: PlayerId, resourceId: string) => number | undefined;
    /** 设置玩家资源值 */
    setResource: (core: TCore, playerId: PlayerId, resourceId: string, value: number) => TCore;
    /** 设置阶段（可选） */
    setPhase?: (core: TCore, phase: string) => TCore;
    /** 设置骰子值（可选） */
    setDice?: (core: TCore, values: number[], options?: { phase?: string }) => TCore;
    /** 设置 Token 数量（可选） */
    setToken?: (core: TCore, playerId: PlayerId, tokenId: string, amount: number) => TCore;
    /** 设置状态效果数量（可选） */
    setStatus?: (core: TCore, playerId: PlayerId, statusId: string, amount: number) => TCore;
    /** 根据索引发牌（可选，deck-only） */
    dealCardByIndex?: (core: TCore, playerId: PlayerId, deckIndex: number) => TCore;
    /** 根据图集索引发牌（可选，兼容旧教程的 deck-only atlas helper） */
    dealCardByAtlasIndex?: (core: TCore, playerId: PlayerId, atlasIndex: number) => TCore;
    /** 根据稳定 cardId 直接补牌到手牌（可选，不依赖当前剩余牌库） */
    addCardToHandByCardId?: (core: TCore, playerId: PlayerId, cardId: string) => TCore;
    /** 根据图集索引将牌库卡牌移入弃牌堆（可选） */
    dealCardToDiscard?: (core: TCore, playerId: PlayerId, atlasIndex: number) => TCore;
    /** 删除手牌（按 uid 从手牌移入弃牌堆，可选） */
    removeHandCard?: (core: TCore, playerId: PlayerId, cardUid: string) => TCore;
    /** 游戏侧调试命令扩展；引擎只按 command.type 路由，不承载游戏语义 */
    customCommands?: Record<string, CheatCommandHandler<TCore>>;
}

// ============================================================================
// 深度合并工具（用于 MERGE_STATE）
// ============================================================================

/**
 * 深度合并两个对象。数组和原始值直接覆盖，普通对象递归合并。
 * 仅处理 plain object，不处理 class 实例/Date/RegExp 等。
 */
function isPlainObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
): Record<string, unknown> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const tgtVal = target[key];
        if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
            result[key] = deepMerge(tgtVal, srcVal);
        } else {
            result[key] = srcVal;
        }
    }
    return result;
}

// ============================================================================
// 创建 Cheat 系统
// ============================================================================

// ============================================================================

export function createCheatSystem<TCore>(
    modifier?: CheatResourceModifier<TCore>,
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.CHEAT,
        name: 'Cheat 系统',
        priority: 1, // 最高优先级，确保作弊命令最先处理

        beforeCommand: (ctx): HookResult<TCore> | void => {
            const { state, command } = ctx;
            // 通用状态注入命令不依赖游戏专用 modifier。
            if (command.type === CHEAT_COMMANDS.SET_STATE) {
                const payload = command.payload as SetStatePayload<TCore>;
                const hasSystemFields = payload.state && typeof payload.state === 'object' && 'sys' in payload.state;

                if (hasSystemFields) {
                    return {
                        halt: true,
                        state: payload.state as MatchState<TCore>,
                    };
                }

                return {
                    halt: true,
                    state: { ...state, core: payload.state },
                };
            }

            if (command.type === CHEAT_COMMANDS.MERGE_STATE) {
                const payload = command.payload as MergeStatePayload;
                return {
                    halt: true,
                    state: {
                        ...state,
                        core: deepMerge(state.core as Record<string, unknown>, payload.fields) as TCore,
                    },
                };
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
                const newCore = modifier.setDice(state.core, payload.diceValues, { phase: payload.phase });
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

            // 处理设置状态效果命令
            if (command.type === CHEAT_COMMANDS.SET_STATUS && modifier.setStatus) {
                const payload = command.payload as SetStatusPayload;
                const newCore = modifier.setStatus(
                    state.core,
                    payload.playerId,
                    payload.statusId,
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

            // 处理根据图集索引发牌命令
            if (command.type === CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX && modifier.dealCardByAtlasIndex) {
                const payload = command.payload as DealCardByAtlasIndexPayload;
                const newCore = modifier.dealCardByAtlasIndex(
                    state.core,
                    payload.playerId,
                    payload.atlasIndex
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            if (command.type === CHEAT_COMMANDS.ADD_CARD_TO_HAND_BY_CARD_ID && modifier.addCardToHandByCardId) {
                const payload = command.payload as AddCardToHandByCardIdPayload;
                const newCore = modifier.addCardToHandByCardId(
                    state.core,
                    payload.playerId,
                    payload.cardId,
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理根据图集索引将卡牌移入弃牌堆命令
            if (command.type === CHEAT_COMMANDS.DEAL_CARD_TO_DISCARD && modifier.dealCardToDiscard) {
                const payload = command.payload as DealCardToDiscardPayload;
                const newCore = modifier.dealCardToDiscard(
                    state.core,
                    payload.playerId,
                    payload.atlasIndex
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            // 处理删除手牌命令
            if (command.type === CHEAT_COMMANDS.REMOVE_HAND_CARD && modifier.removeHandCard) {
                const payload = command.payload as RemoveHandCardPayload;
                const newCore = modifier.removeHandCard(
                    state.core,
                    payload.playerId,
                    payload.cardUid
                );
                return {
                    halt: true,
                    state: { ...state, core: newCore },
                };
            }

            const customCommand = modifier.customCommands?.[command.type];
            if (customCommand) return customCommand(ctx);

        },
    };
}
