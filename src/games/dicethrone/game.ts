/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { GameEvent } from '../../engine/types';
import { createGameAdapter, UNDO_COMMANDS, CHEAT_COMMANDS, createCheatSystem, createFlowSystem, createLogSystem, createUndoSystem, createPromptSystem, createRematchSystem, createResponseWindowSystem, type CheatResourceModifier, type FlowHooks, type PhaseExitResult } from '../../engine';
import { DiceThroneDomain } from './domain';
import type { DiceThroneCore, TurnPhase, DiceThroneEvent, CpChangedEvent, TurnChangedEvent, ResponseWindowOpenedEvent, StatusRemovedEvent } from './domain/types';
import { createDiceThroneEventSystem } from './domain/systems';
import { canAdvancePhase, getNextPhase, getNextPlayerId, getResponderQueue } from './domain/rules';
import { resolveAttack, resolveOffensivePreDefenseEffects } from './domain/attack';
import { resourceSystem } from '../../systems/ResourceSystem';
import { RESOURCE_IDS } from './domain/resources';
import { buildDrawEvents } from './domain/deckEvents';
import { reduce } from './domain/reducer';

import { getDieFace } from './domain/rules';

// DiceThrone 作弊系统配置
const diceThroneCheatModifier: CheatResourceModifier<DiceThroneCore> = {
    getResource: (core, playerId, resourceId) => {
        return core.players[playerId]?.resources[resourceId];
    },
    setResource: (core, playerId, resourceId, value) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    resources: {
                        ...player.resources,
                        [resourceId]: value,
                    },
                },
            },
        };
    },
    setPhase: (core, phase) => {
        return {
            ...core,
            turnPhase: phase as TurnPhase,
        };
    },
    setDice: (core, values) => {
        const newDice = core.dice.map((die, i) => {
            const value = values[i] ?? die.value;
            const face = getDieFace(value);
            return {
                ...die,
                value,
                symbol: face,
                symbols: [face],
            };
        });
        return {
            ...core,
            dice: newDice,
            rollCount: core.rollCount || 1, // 确保至少有一次 roll
            rollConfirmed: false, // 允许用户重新确认
        };
    },
    setToken: (core, playerId, tokenId, amount) => {
        const player = core.players[playerId];
        if (!player) return core;
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [tokenId]: amount,
                    },
                },
            },
        };
    },
    dealCardByIndex: (core, playerId, deckIndex) => {
        const player = core.players[playerId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;
        
        // 从牌库指定位置取出卡牌
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);
        
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },
};

// 辅助函数：应用事件到 core 状态
const applyEvents = (core: DiceThroneCore, events: DiceThroneEvent[]): DiceThroneCore => {
    return events.reduce((current, event) => reduce(current, event), core);
};

const now = () => Date.now();

// DiceThrone FlowHooks 实现（符合 openspec/changes/add-flow-system/design.md Decision 3）
// sys.phase 是阶段的单一权威来源，所有阶段副作用通过 FlowHooks 实现
const diceThroneFlowHooks: FlowHooks<DiceThroneCore> = {
    initialPhase: 'upkeep',

    canAdvance: ({ state }) => {
        const ok = canAdvancePhase(state.core);
        return ok ? { ok: true } : { ok: false, error: 'cannot_advance_phase' };
    },

    getNextPhase: ({ state }) => getNextPhase(state.core),

    getActivePlayerId: ({ state, from }) => {
        // 特殊处理：discard 阶段退出后切换回合，此时需要返回下一位玩家
        // 因为 TURN_CHANGED 事件还未被 reduce
        if (from === 'discard') {
            return getNextPlayerId(state.core);
        }
        return state.core.activePlayerId;
    },

    onPhaseExit: ({ state, from, to, command, random }): PhaseExitResult | GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = now();

        // ========== main1 阶段退出：检查击倒状态 ==========
        if (from === 'main1' && to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];
            const stunStacks = player?.statusEffects['stun'] ?? 0;
            if (stunStacks > 0) {
                // 有击倒状态，跳过 offensiveRoll 并移除击倒
                const statusRemovedEvent: StatusRemovedEvent = {
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: 'stun',
                        stacks: stunStacks,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(statusRemovedEvent);
                return { events, overrideNextPhase: 'main2' };
            }
        }

        // ========== offensiveRoll 阶段退出：攻击前处理 ==========
        if (from === 'offensiveRoll') {
            if (core.pendingAttack) {
                // 处理进攻方的 preDefense 效果
                const preDefenseEvents = resolveOffensivePreDefenseEffects(core);
                events.push(...preDefenseEvents);

                const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                if (hasChoice) {
                    // 需要用户做选择，阻止阶段切换
                    return { events, halt: true };
                }

                const coreAfterPreDefense = preDefenseEvents.length > 0
                    ? applyEvents(core, preDefenseEvents as DiceThroneEvent[])
                    : core;

                if (core.pendingAttack.isDefendable) {
                    // 攻击可防御，切换到防御阶段
                    return { events, overrideNextPhase: 'defensiveRoll' };
                }

                // 攻击不可防御，直接结算
                const attackEvents = resolveAttack(coreAfterPreDefense, random, { includePreDefense: false });
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                if (hasAttackChoice || hasTokenResponse) {
                    return { events, halt: true };
                }

                // 无待处理内容，直接进入 main2
                return { events, overrideNextPhase: 'main2' };
            }
            // 无 pendingAttack，直接进入 main2
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== defensiveRoll 阶段退出：直接结算攻击 ==========
        // 设计原则：不做"最后机会"响应窗口，玩家想打牌应在防御阶段主动打出
        if (from === 'defensiveRoll' && core.pendingAttack) {
            // 直接结算攻击
            const attackEvents = resolveAttack(core, random);
            events.push(...attackEvents);

            const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
            const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
            if (hasAttackChoice || hasTokenResponse) {
                return { events, halt: true };
            }
        }

        // ========== discard 阶段退出：切换回合 ==========
        if (from === 'discard') {
            const nextPlayerId = getNextPlayerId(core);
            const turnEvent: TurnChangedEvent = {
                type: 'TURN_CHANGED',
                payload: {
                    previousPlayerId: core.activePlayerId,
                    nextPlayerId,
                    turnNumber: core.turnNumber + 1,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            events.push(turnEvent);
        }

        if (events.length > 0) {
            return events;
        }
    },

    onAutoContinueCheck: ({ state, events }): { autoContinue: boolean; playerId: string } | void => {
        const core = state.core;
        
        // 检查是否有 TOKEN_RESPONSE_CLOSED 或 CHOICE_RESOLVED 事件
        const hasTokenResponseClosed = events.some(e => e.type === 'TOKEN_RESPONSE_CLOSED');
        const hasChoiceResolved = events.some(e => e.type === 'CHOICE_RESOLVED');
        const hasInteractionCompleted = events.some(e => e.type === 'INTERACTION_COMPLETED');
        const hasInteractionCancelled = events.some(e => e.type === 'INTERACTION_CANCELLED');
        
        console.log('[onAutoContinueCheck] Called with events:', {
            eventTypes: events.map(e => e.type),
            hasTokenResponseClosed,
            hasChoiceResolved,
            hasInteractionCompleted,
            hasInteractionCancelled,
            currentPhase: state.sys.phase,
        });
        
        // 如果有这些事件，且没有其他阻塞条件，则自动继续
        if (hasTokenResponseClosed || hasChoiceResolved || hasInteractionCompleted || hasInteractionCancelled) {
            // 检查是否有阻塞条件
            const hasActivePrompt = state.sys.prompt?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            const hasPendingInteraction = core.pendingInteraction !== undefined;
            const hasPendingDamage = core.pendingDamage !== undefined;
            
            console.log('[onAutoContinueCheck] Checking blocking conditions:', {
                hasActivePrompt,
                hasActiveResponseWindow,
                hasPendingInteraction,
                hasPendingDamage,
            });
            
            // 只有在没有其他阻塞条件时才自动继续
            if (!hasActivePrompt && !hasActiveResponseWindow && !hasPendingInteraction && !hasPendingDamage) {
                console.log('[onAutoContinueCheck] Auto-continuing phase from:', state.sys.phase);
                return {
                    autoContinue: true,
                    playerId: core.activePlayerId,
                };
            } else {
                console.log('[onAutoContinueCheck] Auto-continue blocked');
            }
        }
        
        return undefined;
    },

    onPhaseEnter: ({ state, to, command, random }): GameEvent[] | void => {
        const core = state.core;
        const events: GameEvent[] = [];
        const timestamp = now();

        // ========== 进入 income 阶段：+1 CP 和抽牌 ==========
        if (to === 'income') {
            const player = core.players[core.activePlayerId];
            if (player) {
                // CP +1（使用 ResourceSystem 处理上限）
                const cpResult = resourceSystem.modify(
                    player.resources,
                    RESOURCE_IDS.CP,
                    1
                );
                const cpEvent: CpChangedEvent = {
                    type: 'CP_CHANGED',
                    payload: {
                        playerId: core.activePlayerId,
                        delta: cpResult.actualDelta,
                        newValue: cpResult.newValue,
                    },
                    sourceCommandType: command.type,
                    timestamp,
                };
                events.push(cpEvent);

                // 抽牌（牌库为空则洗弃牌堆）
                events.push(
                    ...buildDrawEvents(core, core.activePlayerId, 1, random, command.type, timestamp)
                );
            }
        }

        if (events.length > 0) {
            return events;
        }
    },
};

// 导出 FlowHooks 供测试使用
export { diceThroneFlowHooks };

// 创建系统集合（默认系统 + FlowSystem + DiceThrone 专用系统 + 作弊系统）
// FlowSystem 配置由 FlowHooks 提供，符合设计规范
// 注意：撤销快照保留 1 个 + 极度缩减日志（maxEntries: 20）以避免 MongoDB 16MB 限制
const systems = [
    createFlowSystem<DiceThroneCore>({ hooks: diceThroneFlowHooks }),
    createLogSystem({ maxEntries: 20 }),  // 极度减少，不考虑回放
    createUndoSystem({ maxSnapshots: 10 }),  // 保留10个快照，支持10次撤销
    createPromptSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createDiceThroneEventSystem(),
    createCheatSystem<DiceThroneCore>(diceThroneCheatModifier),
];

// 导出系统配置供测试使用
export { systems as diceThroneSystemsForTest };

// 所有业务命令类型（必须显式列出才能生成可枚举 moves）
const COMMAND_TYPES = [
    // 骰子操作
    'ROLL_DICE',
    'ROLL_BONUS_DIE',
    'TOGGLE_DIE_LOCK',
    'CONFIRM_ROLL',
    // 技能选择
    'SELECT_ABILITY',
    // 卡牌操作
    'DRAW_CARD',
    'DISCARD_CARD',
    'SELL_CARD',
    'UNDO_SELL_CARD',
    'REORDER_CARD_TO_END',
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 选择与阶段
    'RESOLVE_CHOICE',
    'ADVANCE_PHASE',
    // 响应窗口
    'RESPONSE_PASS',
    // 卡牌交互（骰子修改、状态移除/转移）
    'MODIFY_DIE',
    'REROLL_DIE',
    'REMOVE_STATUS',
    'TRANSFER_STATUS',
    'CONFIRM_INTERACTION',
    'CANCEL_INTERACTION',
    // Token 响应系统
    'USE_TOKEN',
    'SKIP_TOKEN_RESPONSE',
    'USE_PURIFY',
    // 击倒移除
    'PAY_TO_REMOVE_STUN',
    // 撤回系统命令
    UNDO_COMMANDS.REQUEST_UNDO,
    UNDO_COMMANDS.APPROVE_UNDO,
    UNDO_COMMANDS.REJECT_UNDO,
    UNDO_COMMANDS.CANCEL_UNDO,
    // 作弊系统命令（仅开发模式）
    CHEAT_COMMANDS.SET_RESOURCE,
    CHEAT_COMMANDS.ADD_RESOURCE,
    CHEAT_COMMANDS.SET_PHASE,
    CHEAT_COMMANDS.SET_DICE,
    CHEAT_COMMANDS.SET_TOKEN,
    CHEAT_COMMANDS.DEAL_CARD_BY_INDEX,
    CHEAT_COMMANDS.SET_STATE,
];

// 使用适配器创建 Boardgame.io Game
export const DiceThroneGame = createGameAdapter({
    domain: DiceThroneDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 4, // 支持 2-4 人游戏
    commandTypes: COMMAND_TYPES,
});

export default DiceThroneGame;

// 导出类型（兼容）
export type { DiceThroneCore } from './domain';
