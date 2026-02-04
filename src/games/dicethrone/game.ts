/**
 * DiceThrone 游戏定义（新引擎架构）
 * 
 * 使用领域内核 + 引擎适配器
 */

import type { ActionLogEntry, Command, GameEvent, MatchState, PlayerId } from '../../engine/types';
import {
    createGameAdapter,
    createActionLogSystem,
    createCheatSystem,
    createFlowSystem,
    createLogSystem,
    createPromptSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
    CHEAT_COMMANDS,
    UNDO_COMMANDS,
    type CheatResourceModifier,
    type FlowHooks,
    type PhaseExitResult,
} from '../../engine';
import { DiceThroneDomain } from './domain';
import { DICETHRONE_COMMANDS, STATUS_IDS } from './domain/ids';
import type { AbilityCard, DiceThroneCore, TurnPhase, DiceThroneEvent, CpChangedEvent, TurnChangedEvent, StatusRemovedEvent } from './domain/types';
import { createDiceThroneEventSystem } from './domain/systems';
import { canAdvancePhase, getNextPhase, getNextPlayerId } from './domain/rules';
import { resolveAttack, resolveOffensivePreDefenseEffects } from './domain/attack';
import { resourceSystem } from './domain/resourceSystem';
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
    dealCardByAtlasIndex: (core, playerId, atlasIndex) => {
        const player = core.players[playerId];
        if (!player) return core;

        // 在牌库中查找具有指定 atlasIndex 的卡牌
        const deckIndex = player.deck.findIndex(
            (card) => card.previewRef?.type === 'atlas' && card.previewRef.index === atlasIndex
        );
        if (deckIndex === -1) return core;

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
    initialPhase: 'setup',

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

        // ========== setup 阶段退出：初始化所有玩家角色数据 ==========
        if (from === 'setup') {
            const playerIds = Object.keys(core.players);
            const initEvents: GameEvent[] = [];

            // 教程模式：自动为玩家 1 选择默认角色
            const isTutorialMode = typeof window !== 'undefined'
                && (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__ === 'tutorial';
            
            if (isTutorialMode && (!core.selectedCharacters['1'] || core.selectedCharacters['1'] === 'unselected')) {
                core.selectedCharacters['1'] = 'monk'; // 默认选择僧侣作为对手
            }

            for (const pid of playerIds) {
                const charId = core.selectedCharacters[pid];
                if (charId && charId !== 'unselected') {
                    // 发送初始化事件（此处由于 reducer 已处理部分，可能需要专门的 INIT_HERO_STATE 事件或直接在 reducer 处理）
                    // 按照架构，最好是发送一个事件，让 reducer 执行 initHeroState 逻辑
                    initEvents.push({
                        type: 'HERO_INITIALIZED',
                        payload: {
                            playerId: pid,
                            characterId: charId as any,
                            // 牌库已经在 CHARACTER_SELECTED 时确定了（payload.initialDeckCardIds），
                            // 但为了严谨，这里可以再次确认或由 reducer 从 core.selectedCharacters 读取
                        },
                        sourceCommandType: command.type,
                        timestamp,
                    } as any);
                }
            }

            // 同时创建骰子（如果是首位玩家，通常使用他的角色骰子，或者由系统在 EnterRollPhase 时切换）
            // 初始骰子逻辑在进入 RollPhase 时会自动 resetDice
            
            if (initEvents.length > 0) {
                events.push(...initEvents);
            }
        }

        // ========== main1 阶段退出：检查击倒状态 ==========
        if (from === 'main1' && to === 'offensiveRoll') {
            const player = core.players[core.activePlayerId];
            const knockdownStacks = player?.statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0;
            if (knockdownStacks > 0) {
                // 有击倒状态，跳过 offensiveRoll 并移除击倒
                const statusRemovedEvent: StatusRemovedEvent = {
                    type: 'STATUS_REMOVED',
                    payload: {
                        targetId: core.activePlayerId,
                        statusId: STATUS_IDS.KNOCKDOWN,
                        stacks: knockdownStacks,
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
                const hasBonusDiceRerollOff = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceRerollOff) {
                    return { events, halt: true };
                }

                // 无待处理内容，直接进入 main2
                return { events, overrideNextPhase: 'main2' };
            }
            // 无 pendingAttack，直接进入 main2
            return { events, overrideNextPhase: 'main2' };
        }

        // ========== defensiveRoll 阶段退出 ==========
        // 设计原则：不做"最后机会"响应窗口，玩家想打牌应在防御阶段主动打出
        if (from === 'defensiveRoll') {
            if (core.pendingAttack) {
                // 直接结算攻击
                const attackEvents = resolveAttack(core, random);
                events.push(...attackEvents);

                const hasAttackChoice = attackEvents.some((event) => event.type === 'CHOICE_REQUESTED');
                const hasTokenResponse = attackEvents.some((event) => event.type === 'TOKEN_RESPONSE_REQUESTED');
                const hasBonusDiceReroll = attackEvents.some((event) => event.type === 'BONUS_DICE_REROLL_REQUESTED');
                if (hasAttackChoice || hasTokenResponse || hasBonusDiceReroll) {
                    return { events, halt: true };
                }
            }
            // 显式指定下一阶段为 main2（无论是否有 pendingAttack）
            return { events, overrideNextPhase: 'main2' };
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

        // setup 阶段：房主开始或玩家准备后，若满足条件则自动推进
        if (core.turnPhase === 'setup') {
            const hasSetupGateEvent = events.some(e => e.type === 'HOST_STARTED' || e.type === 'PLAYER_READY');
            if (hasSetupGateEvent && canAdvancePhase(core)) {
                return { autoContinue: true, playerId: core.activePlayerId };
            }
        }

        // 检查是否有需要自动继续的事件
        const hasTokenResponseClosed = events.some(e => e.type === 'TOKEN_RESPONSE_CLOSED');
        const hasChoiceResolved = events.some(e => e.type === 'CHOICE_RESOLVED');
        const hasBonusDiceSettled = events.some(e => e.type === 'BONUS_DICE_SETTLED');

        // 如果有这些事件，且没有其他阻塞条件，则自动继续
        if (hasTokenResponseClosed || hasChoiceResolved || hasBonusDiceSettled) {
            // 检查是否有阻塞条件
            const hasActivePrompt = state.sys.prompt?.current !== undefined;
            const hasActiveResponseWindow = state.sys.responseWindow?.current !== undefined;
            const hasPendingInteraction = core.pendingInteraction !== undefined;
            const hasPendingDamage = core.pendingDamage !== undefined;
            const hasPendingBonusDice = core.pendingBonusDiceSettlement !== undefined;

            // 只有在没有其他阻塞条件时才自动继续
            if (!hasActivePrompt && !hasActiveResponseWindow && !hasPendingInteraction && !hasPendingDamage && !hasPendingBonusDice) {
                return {
                    autoContinue: true,
                    playerId: core.activePlayerId,
                };
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

// ============================================================================
// ActionLog 共享白名单 + 格式化
// ============================================================================

const ACTION_ALLOWLIST = [
    'PLAY_CARD',
    'PLAY_UPGRADE_CARD',
    // 注意：阶段推进属于明确的规则行为，允许撤回 + 记录。
    'ADVANCE_PHASE',
] as const;

function formatDiceThroneActionEntry({
    command,
    state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const core = (state as MatchState<DiceThroneCore>).core;
    const timestamp = command.timestamp ?? Date.now();

    if (command.type === 'PLAY_CARD' || command.type === 'PLAY_UPGRADE_CARD') {
        const cardId = (command.payload as { cardId: string }).cardId;
        const card = findDiceThroneCard(core, cardId, command.playerId);
        if (!card || !card.previewRef) return null;

        const actionText = command.type === 'PLAY_UPGRADE_CARD' ? '打出升级卡 ' : '打出卡牌 ';

        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [
                { type: 'text', text: actionText },
                {
                    type: 'card',
                    cardId: card.id,
                    previewText: card.name,
                },
            ],
        };
    }

    if (command.type === 'ADVANCE_PHASE') {
        const phaseChanged = [...events]
            .reverse()
            .find(event => event.type === 'SYS_PHASE_CHANGED') as
            | { payload?: { to?: string } }
            | undefined;
        const nextPhase = phaseChanged?.payload?.to ?? getNextPhase(core);
        const phaseLabel = nextPhase ? `推进阶段：${nextPhase}` : '推进阶段';
        return {
            id: `${command.type}-${command.playerId}-${timestamp}`,
            timestamp,
            actorId: command.playerId,
            kind: command.type,
            segments: [{ type: 'text', text: phaseLabel }],
        };
    }

    return null;
}

function findDiceThroneCard(
    core: DiceThroneCore,
    cardId: string,
    playerId?: PlayerId
): AbilityCard | undefined {
    if (playerId && core.players[playerId]) {
        const player = core.players[playerId];
        return (
            player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId)
        );
    }

    for (const player of Object.values(core.players)) {
        const found = player.hand.find(card => card.id === cardId)
            ?? player.deck.find(card => card.id === cardId)
            ?? player.discard.find(card => card.id === cardId);
        if (found) return found;
    }

    return undefined;
}

// 创建系统集合（默认系统 + FlowSystem + DiceThrone 专用系统 + 作弊系统）
// FlowSystem 配置由 FlowHooks 提供，符合设计规范
// 注意：撤销快照保留 1 个 + 极度缩减日志（maxEntries: 20）以避免 MongoDB 16MB 限制
const systems = [
    createFlowSystem<DiceThroneCore>({ hooks: diceThroneFlowHooks }),
    createLogSystem({ maxEntries: 20 }),  // 极度减少，不考虑回放
    createActionLogSystem({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatDiceThroneActionEntry,
    }),
    createUndoSystem({
        maxSnapshots: 10,
        // 只对白名单命令做撤回快照，避免 UI/系统行为导致“一进局就可撤回”。
        snapshotCommandAllowlist: ACTION_ALLOWLIST,
    }),
    createPromptSystem(),
    createRematchSystem(),
    createResponseWindowSystem(),
    createTutorialSystem(),
    createDiceThroneEventSystem(),
    createCheatSystem<DiceThroneCore>(diceThroneCheatModifier),
];

// 导出系统配置供测试使用
export { systems as diceThroneSystemsForTest };

// 所有业务命令类型（必须显式列出才能生成可枚举 moves）
const COMMAND_TYPES = [
    // 骰子操作
    'ROLL_DICE',
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
    // 选角相关
    'SELECT_CHARACTER',
    'HOST_START_GAME',
    'PLAYER_READY',
    // Token 响应系统
    'USE_TOKEN',
    'SKIP_TOKEN_RESPONSE',
    'USE_PURIFY',
    // 击倒移除
    DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN,
    // 奖励骰重掷
    'REROLL_BONUS_DIE',
    'SKIP_BONUS_DICE_REROLL',
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
    CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX,
    CHEAT_COMMANDS.SET_STATE,
];

// 使用适配器创建 Boardgame.io Game
export const DiceThroneGame = createGameAdapter({
    domain: DiceThroneDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 2, // 固定 2 人游戏
    commandTypes: COMMAND_TYPES,
});

export default DiceThroneGame;

// 导出类型（兼容）
export type { DiceThroneCore } from './domain';
