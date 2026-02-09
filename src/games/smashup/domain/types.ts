/**
 * 大杀四方 (Smash Up) - 领域类型定义
 *
 * 核心概念：
 * - 每位玩家选 2 个派系混搭成 40 张牌库
 * - 回合制：出牌 → 基地记分 → 抽牌
 * - 基地力量达到临界点时记分，前三名获 VP
 * - 先到 15 VP 胜出
 */

import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';
import type { CardPreviewRef } from '../../../systems/CardSystem/types';
import { SMASHUP_FACTION_IDS } from './ids';

// ============================================================================
// 游戏阶段
// ============================================================================

/** 游戏阶段（按规则顺序） */
export type GamePhase =
    | 'factionSelect' // 0. 派系选择
    | 'startTurn'    // 1. 回合开始
    | 'playCards'    // 2. 出牌阶段
    | 'scoreBases'   // 3. 基地记分
    | 'draw'         // 4. 抽牌阶段
    | 'endTurn';     // 5. 回合结束

export const PHASE_ORDER: GamePhase[] = [
    'factionSelect', 'startTurn', 'playCards', 'scoreBases', 'draw', 'endTurn',
];

// ============================================================================
// 卡牌定义（静态数据）
// ============================================================================

/** 卡牌类别 */
export type CardType = 'minion' | 'action';

/** 行动卡子类型 */
export type ActionSubtype = 'standard' | 'ongoing' | 'special';

/** 派系 ID */
export type FactionId = string;

/** 能力标签 */
export type AbilityTag = 'onPlay' | 'ongoing' | 'special' | 'talent' | 'extra' | 'onDestroy';

/** 随从卡定义 */
export interface MinionCardDef {
    id: string;
    type: 'minion';
    name: string;
    nameEn: string;
    faction: FactionId;
    power: number;
    abilityText?: string;
    abilityTextEn?: string;
    abilityTags?: AbilityTag[];
    /** 牌组中的数量 */
    count: number;
    previewRef?: CardPreviewRef;
}

/** 行动卡定义 */
export interface ActionCardDef {
    id: string;
    type: 'action';
    subtype: ActionSubtype;
    name: string;
    nameEn: string;
    faction: FactionId;
    effectText: string;
    effectTextEn: string;
    abilityTags?: AbilityTag[];
    count: number;
    previewRef?: CardPreviewRef;
}

/** 卡牌定义联合类型 */
export type CardDef = MinionCardDef | ActionCardDef;

/** 基地卡定义 */
export interface BaseCardDef {
    id: string;
    name: string;
    nameEn: string;
    breakpoint: number;
    /** VP 奖励：[1st, 2nd, 3rd] */
    vpAwards: [number, number, number];
    abilityText?: string;
    abilityTextEn?: string;
    /** 关联派系 */
    faction?: FactionId;
    previewRef?: CardPreviewRef;
}

// ============================================================================
// 运行时卡牌实例
// ============================================================================

/** 卡牌实例（运行时唯一） */
export interface CardInstance {
    uid: string;
    defId: string;
    type: CardType;
    owner: PlayerId;
}

/** 基地上的随从 */
export interface MinionOnBase {
    uid: string;
    defId: string;
    controller: PlayerId;
    owner: PlayerId;
    /** 印刷力量（冗余，避免频繁查表） */
    basePower: number;
    /** 力量修正（+1 指示物等） */
    powerModifier: number;
    /** 本回合是否已使用天赋 */
    talentUsed: boolean;
    /** 附着的行动卡列表（带 owner 追踪） */
    attachedActions: AttachedActionOnMinion[];
}

/** 随从上附着的行动卡 */
export interface AttachedActionOnMinion {
    uid: string;
    defId: string;
    ownerId: PlayerId;
}

/** 基地上附着的持续行动卡 */
export interface OngoingActionOnBase {
    uid: string;
    defId: string;
    ownerId: PlayerId;
}

/** 场上的基地 */
export interface BaseInPlay {
    defId: string;
    minions: MinionOnBase[];
    /** 持续行动卡列表 */
    ongoingActions: OngoingActionOnBase[];
}

// ============================================================================
// 玩家状态
// ============================================================================

export interface PlayerState {
    id: PlayerId;
    vp: number;
    hand: CardInstance[];
    /** 牌库（索引 0 为顶部） */
    deck: CardInstance[];
    discard: CardInstance[];
    /** 本回合已打出随从数 */
    minionsPlayed: number;
    /** 本回合可打出随从额度（默认 1） */
    minionLimit: number;
    /** 本回合已打出行动数 */
    actionsPlayed: number;
    /** 本回合可打出行动额度（默认 1） */
    actionLimit: number;
    /** 选择的派系 */
    factions: [FactionId, FactionId];
}

// ============================================================================
// 核心游戏状态
// ============================================================================

/** 常量 */
export const HAND_LIMIT = 10;
export const STARTING_HAND_SIZE = 5;
export const DRAW_PER_TURN = 2;
export const VP_TO_WIN = 15;
/** 疯狂牌库初始数量 */
export const MADNESS_DECK_SIZE = 30;
/** 疯狂卡 defId */
export const MADNESS_CARD_DEF_ID = 'special_madness';
/** 疯狂卡 faction */
export const MADNESS_FACTION = SMASHUP_FACTION_IDS.MADNESS;
/** 克苏鲁扩展派系（使用疯狂牌库的派系） */
export const CTHULHU_EXPANSION_FACTIONS = [
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
    SMASHUP_FACTION_IDS.ELDER_THINGS,
    SMASHUP_FACTION_IDS.INNSMOUTH,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
] as const;

export interface SmashUpCore {
    players: Record<PlayerId, PlayerState>;
    /** 玩家回合顺序 */
    turnOrder: PlayerId[];
    /** 当前玩家索引 */
    currentPlayerIndex: number;
    /** 场上基地 */
    bases: BaseInPlay[];
    /** 基地牌库（defId 列表） */
    baseDeck: string[];
    /** 回合数 */
    turnNumber: number;
    /** UID 自增计数器 */
    nextUid: number;
    /** 游戏结果 */
    gameResult?: GameOverResult;

    // === 新增字段 ===
    /** 派系选择阶段状态（选择完成后置为 undefined） */
    factionSelection?: FactionSelectionState;
    /** 疯狂牌库（克苏鲁扩展，defId 列表） */
    madnessDeck?: string[];
    /** 待处理的 Prompt 继续上下文（能力需要目标选择时写入，Prompt 解决后读取并清除） */
    pendingPromptContinuation?: PromptContinuationContext;
}

export interface FactionSelectionState {
    /** 已被选择的派系 */
    takenFactions: string[];
    /** 每位玩家已选的派系 */
    playerSelections: Record<PlayerId, string[]>;
    /** 选择完成的玩家 */
    completedPlayers: PlayerId[];
}

/**
 * Prompt 继续上下文
 * 
 * 当能力需要目标选择时，将继续执行所需的上下文存入 core 状态。
 * Prompt 解决后（SYS_PROMPT_RESOLVED），FlowHooks 读取此上下文并生成继续事件。
 */
export interface PromptContinuationContext {
    /** 能力来源 ID（如 'pirate_dinghy'） */
    abilityId: string;
    /** 发起 Prompt 的玩家 */
    playerId: PlayerId;
    /** 额外上下文数据（能力特定） */
    data?: Record<string, unknown>;
}

export interface PromptConfig {
    id: string;
    playerId: PlayerId;
    title: string;
    description?: string;
    options: PromptOption[];
    sourceId?: string;
}

export interface PromptOption {
    label: string;
    value: any;
    disabled?: boolean;
}

// ============================================================================
// 辅助函数
// ============================================================================

export function getCurrentPlayerId(state: SmashUpCore): PlayerId {
    return state.turnOrder[state.currentPlayerIndex];
}

export function getPlayerPowerOnBase(base: BaseInPlay, playerId: PlayerId): number {
    return base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => sum + m.basePower + m.powerModifier, 0);
}

export function getTotalPowerOnBase(base: BaseInPlay): number {
    return base.minions.reduce((sum, m) => sum + m.basePower + m.powerModifier, 0);
}

// ============================================================================
// 命令类型
// ============================================================================

export const SU_COMMANDS = {
    PLAY_MINION: 'su:play_minion',
    PLAY_ACTION: 'su:play_action',
    DISCARD_TO_LIMIT: 'su:discard_to_limit',
    // === 新增 ===
    SELECT_FACTION: 'su:select_faction',
    USE_TALENT: 'su:use_talent',
} as const;

/** 打出随从 */
export interface PlayMinionCommand extends Command<typeof SU_COMMANDS.PLAY_MINION> {
    payload: {
        cardUid: string;
        baseIndex: number;
    };
}

/** 打出行动卡 */
export interface PlayActionCommand extends Command<typeof SU_COMMANDS.PLAY_ACTION> {
    payload: {
        cardUid: string;
        targetBaseIndex?: number;
        targetMinionUid?: string;
    };
}

/** 弃牌至手牌上限 */
export interface DiscardToLimitCommand extends Command<typeof SU_COMMANDS.DISCARD_TO_LIMIT> {
    payload: {
        cardUids: string[];
    };
}

/** 选择派系 */
export interface SelectFactionCommand extends Command<typeof SU_COMMANDS.SELECT_FACTION> {
    payload: {
        factionId: string;
    };
}

/** 使用天赋 */
export interface UseTalentCommand extends Command<typeof SU_COMMANDS.USE_TALENT> {
    payload: {
        minionUid: string;
        baseIndex: number;
    };
}

export type SmashUpCommand =
    | PlayMinionCommand
    | PlayActionCommand
    | DiscardToLimitCommand
    | SelectFactionCommand
    | UseTalentCommand;

// ============================================================================
// 事件类型
// ============================================================================

export const SU_EVENTS = {
    MINION_PLAYED: 'su:minion_played',
    ACTION_PLAYED: 'su:action_played',
    BASE_SCORED: 'su:base_scored',
    VP_AWARDED: 'su:vp_awarded',
    CARDS_DRAWN: 'su:cards_drawn',
    CARDS_DISCARDED: 'su:cards_discarded',
    TURN_STARTED: 'su:turn_started',
    TURN_ENDED: 'su:turn_ended',
    BASE_REPLACED: 'su:base_replaced',
    DECK_RESHUFFLED: 'su:deck_reshuffled',
    MINION_RETURNED: 'su:minion_returned',
    LIMIT_MODIFIED: 'su:limit_modified',
    // === 新增 ===
    FACTION_SELECTED: 'su:faction_selected',
    ALL_FACTIONS_SELECTED: 'su:all_factions_selected',
    MINION_DESTROYED: 'su:minion_destroyed',
    MINION_MOVED: 'su:minion_moved',
    POWER_COUNTER_ADDED: 'su:power_counter_added',
    POWER_COUNTER_REMOVED: 'su:power_counter_removed',
    ONGOING_ATTACHED: 'su:ongoing_attached',
    ONGOING_DETACHED: 'su:ongoing_detached',
    TALENT_USED: 'su:talent_used',
    CARD_TO_DECK_BOTTOM: 'su:card_to_deck_bottom',
    CARD_RECOVERED_FROM_DISCARD: 'su:card_recovered_from_discard',
    HAND_SHUFFLED_INTO_DECK: 'su:hand_shuffled_into_deck',
    /** Prompt 继续：能力目标选择完成后的继续事件 */
    PROMPT_CONTINUATION: 'su:prompt_continuation',
    /** 疯狂卡抽取（从疯狂牌库到玩家手牌） */
    MADNESS_DRAWN: 'su:madness_drawn',
    /** 疯狂卡返回（从玩家手牌回疯狂牌库） */
    MADNESS_RETURNED: 'su:madness_returned',
} as const;

export interface MinionPlayedEvent extends GameEvent<typeof SU_EVENTS.MINION_PLAYED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
        power: number;
    };
}

export interface ActionPlayedEvent extends GameEvent<typeof SU_EVENTS.ACTION_PLAYED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
    };
}

export interface BaseScoredEvent extends GameEvent<typeof SU_EVENTS.BASE_SCORED> {
    payload: {
        baseIndex: number;
        baseDefId: string;
        /** 排名与 VP：按力量降序 */
        rankings: { playerId: PlayerId; power: number; vp: number }[];
    };
}

export interface VpAwardedEvent extends GameEvent<typeof SU_EVENTS.VP_AWARDED> {
    payload: {
        playerId: PlayerId;
        amount: number;
        reason: string;
    };
}

export interface CardsDrawnEvent extends GameEvent<typeof SU_EVENTS.CARDS_DRAWN> {
    payload: {
        playerId: PlayerId;
        count: number;
        cardUids: string[];
    };
}

export interface CardsDiscardedEvent extends GameEvent<typeof SU_EVENTS.CARDS_DISCARDED> {
    payload: {
        playerId: PlayerId;
        cardUids: string[];
    };
}

export interface TurnStartedEvent extends GameEvent<typeof SU_EVENTS.TURN_STARTED> {
    payload: {
        playerId: PlayerId;
        turnNumber: number;
    };
}

export interface TurnEndedEvent extends GameEvent<typeof SU_EVENTS.TURN_ENDED> {
    payload: {
        playerId: PlayerId;
        nextPlayerIndex: number;
    };
}

export interface BaseReplacedEvent extends GameEvent<typeof SU_EVENTS.BASE_REPLACED> {
    payload: {
        baseIndex: number;
        oldBaseDefId: string;
        newBaseDefId: string;
    };
}

export interface DeckReshuffledEvent extends GameEvent<typeof SU_EVENTS.DECK_RESHUFFLED> {
    payload: {
        playerId: PlayerId;
        deckUids: string[];
    };
}

/** 随从被收回手牌 */
export interface MinionReturnedEvent extends GameEvent<typeof SU_EVENTS.MINION_RETURNED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        /** 回到谁的手牌（所有者） */
        toPlayerId: PlayerId;
        /** 触发来源 */
        reason: string;
    };
}

/** 出牌额度修改 */
export interface LimitModifiedEvent extends GameEvent<typeof SU_EVENTS.LIMIT_MODIFIED> {
    payload: {
        playerId: PlayerId;
        limitType: 'minion' | 'action';
        delta: number;
        reason: string;
    };
}

export type SmashUpEvent =
    | MinionPlayedEvent
    | ActionPlayedEvent
    | BaseScoredEvent
    | VpAwardedEvent
    | CardsDrawnEvent
    | CardsDiscardedEvent
    | TurnStartedEvent
    | TurnEndedEvent
    | BaseReplacedEvent
    | DeckReshuffledEvent
    | MinionReturnedEvent
    | LimitModifiedEvent
    | FactionSelectedEvent
    | AllFactionsSelectedEvent
    | MinionDestroyedEvent
    | MinionMovedEvent
    | PowerCounterAddedEvent
    | PowerCounterRemovedEvent
    | OngoingAttachedEvent
    | OngoingDetachedEvent
    | TalentUsedEvent
    | CardToDeckBottomEvent
    | CardRecoveredFromDiscardEvent
    | HandShuffledIntoDeckEvent
    | PromptContinuationEvent
    | MadnessDrawnEvent
    | MadnessReturnedEvent;

// ============================================================================
// 新增事件接口
// ============================================================================

export interface FactionSelectedEvent extends GameEvent<typeof SU_EVENTS.FACTION_SELECTED> {
    payload: {
        playerId: PlayerId;
        factionId: string;
    };
}

export interface AllFactionsSelectedEvent extends GameEvent<typeof SU_EVENTS.ALL_FACTIONS_SELECTED> {
    payload: {
        readiedPlayers: Record<PlayerId, {
            deck: CardInstance[];
            hand: CardInstance[];
        }>;
        nextUid: number;
        /** 按派系筛选后的场上基地 */
        bases?: BaseInPlay[];
        /** 按派系筛选后的基地牌库 */
        baseDeck?: string[];
    };
}

// PromptCreatedEvent 和 PromptResolvedEvent 已移除
// 统一使用引擎层 PromptSystem 的 SYS_PROMPT_CREATED / SYS_PROMPT_RESOLVED

// ============================================================================
// 新增事件接口（能力系统）
// ============================================================================

export interface MinionDestroyedEvent extends GameEvent<typeof SU_EVENTS.MINION_DESTROYED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        ownerId: PlayerId;
        reason: string;
    };
}

export interface MinionMovedEvent extends GameEvent<typeof SU_EVENTS.MINION_MOVED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        reason: string;
    };
}

export interface PowerCounterAddedEvent extends GameEvent<typeof SU_EVENTS.POWER_COUNTER_ADDED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
    };
}

export interface PowerCounterRemovedEvent extends GameEvent<typeof SU_EVENTS.POWER_COUNTER_REMOVED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
    };
}

export interface OngoingAttachedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_ATTACHED> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        targetType: 'base' | 'minion';
        targetBaseIndex: number;
        targetMinionUid?: string;
    };
}

export interface OngoingDetachedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_DETACHED> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
    };
}

export interface TalentUsedEvent extends GameEvent<typeof SU_EVENTS.TALENT_USED> {
    payload: {
        playerId: PlayerId;
        minionUid: string;
        defId: string;
        baseIndex: number;
    };
}

/** 卡牌放入牌库底 */
export interface CardToDeckBottomEvent extends GameEvent<typeof SU_EVENTS.CARD_TO_DECK_BOTTOM> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
    };
}

/** 从弃牌堆取回卡牌到手牌 */
export interface CardRecoveredFromDiscardEvent extends GameEvent<typeof SU_EVENTS.CARD_RECOVERED_FROM_DISCARD> {
    payload: {
        playerId: PlayerId;
        cardUids: string[];
        reason: string;
    };
}

/** 手牌洗入牌库 */
export interface HandShuffledIntoDeckEvent extends GameEvent<typeof SU_EVENTS.HAND_SHUFFLED_INTO_DECK> {
    payload: {
        playerId: PlayerId;
        /** 洗入后的牌库 uid 列表（确定性） */
        newDeckUids: string[];
        reason: string;
    };
}

/** Prompt 继续事件：存储/清除 Prompt 继续上下文 */
export interface PromptContinuationEvent extends GameEvent<typeof SU_EVENTS.PROMPT_CONTINUATION> {
    payload: {
        /** 'set' 设置上下文，'clear' 清除上下文 */
        action: 'set' | 'clear';
        /** 继续上下文（action='set' 时必填） */
        continuation?: PromptContinuationContext;
        /** Prompt 解决后的选择值（action='clear' 时由继续逻辑填充） */
        resolvedValue?: unknown;
    };
}

/** 疯狂卡抽取事件 */
export interface MadnessDrawnEvent extends GameEvent<typeof SU_EVENTS.MADNESS_DRAWN> {
    payload: {
        playerId: PlayerId;
        /** 抽取数量 */
        count: number;
        /** 生成的疯狂卡实例 UID 列表 */
        cardUids: string[];
        reason: string;
    };
}

/** 疯狂卡返回事件 */
export interface MadnessReturnedEvent extends GameEvent<typeof SU_EVENTS.MADNESS_RETURNED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        reason: string;
    };
}
