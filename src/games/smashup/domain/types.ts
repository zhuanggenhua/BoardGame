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
import type { CardPreviewRef } from '../../../core';
import { SMASHUP_FACTION_IDS } from './ids';
import { SU_EVENT_TYPES as SU_EVENTS } from './events';

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

/**
 * 卡牌打出约束（数据驱动）。
 * - 'requireOwnMinion'：目标基地上必须有自己的至少一个随从
 * - { type: 'requireOwnPower', minPower: N }：目标基地上己方力量必须 ≥ N
 * - 'onlyCardInHand'：本卡必须是手牌中的唯一一张
 */
export type PlayConstraint =
    | 'requireOwnMinion'
    | 'onlyCardInHand'
    | { type: 'requireOwnPower'; minPower: number };

/** 随从卡定义 */
export interface MinionCardDef {
    id: string;
    type: 'minion';
    name: string;
    /** @deprecated 历史英文名，已由 i18n 接管，待清理 */
    nameEn?: string;
    faction: FactionId;
    power: number;
    abilityTags?: AbilityTag[];
    /** 牌组中的数量 */
    count: number;
    previewRef?: CardPreviewRef;
    /** 打出约束（数据驱动），如修格斯只能打到己方≥6力量的基地 */
    playConstraint?: PlayConstraint;
    /**
     * special 能力限制组：同组的 special 能力共享"每基地每回合一次"限制。
     * 例如忍者派系所有 special 随从共享 'ninja_special' 组。
     */
    specialLimitGroup?: string;
    /**
     * 是否可在 Me First! 窗口中从手牌打出到即将计分的基地。
     * 如影舞者：基地计分前可从手牌打出到该基地。
     */
    beforeScoringPlayable?: boolean;
    /**
     * 打出时的音效 key（可选）。
     * 如果指定，优先使用此音效；否则 fallback 到派系默认音效池。
     */
    soundKey?: string;
}

/** 行动卡定义 */
export interface ActionCardDef {
    id: string;
    type: 'action';
    subtype: ActionSubtype;
    name: string;
    /** @deprecated 历史英文名，已由 i18n 接管，待清理 */
    nameEn?: string;
    faction: FactionId;
    abilityTags?: AbilityTag[];
    count: number;
    previewRef?: CardPreviewRef;
    /** ongoing 行动卡的附着目标：'base'（默认）或 'minion'（附着到随从上） */
    ongoingTarget?: 'base' | 'minion';
    /**
     * ongoing 行动卡的打出约束（数据驱动）。
     * @see PlayConstraint
     */
    playConstraint?: PlayConstraint;
    /** 特殊行动卡是否需要选择目标基地（Me First! 窗口中高亮可选基地） */
    specialNeedsBase?: boolean;
    /**
     * special 能力限制组：同组的 special 能力共享"每基地每回合一次"限制。
     * 仅对 subtype='special' 的行动卡有效。
     */
    specialLimitGroup?: string;
    /**
     * 打出时的音效 key（可选）。
     * 如果指定，优先使用此音效；否则 fallback 到派系默认音效池。
     */
    soundKey?: string;
}

/** 卡牌定义联合类型 */
export type CardDef = MinionCardDef | ActionCardDef;

/** 基地限制规则（数据驱动） */
export interface BaseRestriction {
    /** 限制类型 */
    type: 'play_minion' | 'play_action';
    /** 条件（可选，不填表示无条件禁止） */
    condition?: {
        /** 随从力量上限（包含），力量 <= maxPower 的随从被禁止 */
        maxPower?: number;
        /**
         * 额外出牌力量上限：仅在使用额外出牌机会（minionsPlayed >= 1）时生效，
         * 力量 > extraPlayMinionPowerMax 的随从被禁止。
         * 用于母星（The Homeworld）、神秘花园（Secret Garden）等基地。
         */
        extraPlayMinionPowerMax?: number;
        /**
         * 每回合每位玩家在此基地打出随从的上限。
         * 用于北极基地（North Pole）：每回合只能打出一个随从到这。
         */
        minionPlayLimitPerTurn?: number;
    };
}

/** 基地卡定义 */
export interface BaseCardDef {
    id: string;
    name: string;
    /** @deprecated 历史英文名，已由 i18n 接管，待清理 */
    nameEn?: string;
    breakpoint: number;
    /** VP 奖励：[1st, 2nd, 3rd] */
    vpAwards: [number, number, number];
    /** 关联派系 */
    faction?: FactionId;
    previewRef?: CardPreviewRef;
    /** 基地限制规则（如禁止打出随从/行动） */
    restrictions?: BaseRestriction[];
    /** 基地持续力量加成：在此基地上的所有随从获得该值的力量修正 */
    minionPowerBonus?: number;
    /** 设置期间翻到此基地时，替换它并重洗基地牌库 */
    replaceOnSetup?: boolean;
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
    /** +1 力量指示物数量（独立可追踪实体，可放置/移除/转移，仅指示物派系使用） */
    powerCounters: number;
    /** 永久力量修正（非指示物的永久加力量，如密斯卡托尼克"最好不知道的事"） */
    powerModifier: number;
    /** 临时力量修正（回合结束自动清零，用于嚎叫/增强等"直到回合结束"效果） */
    tempPowerModifier: number;
    /** 本回合是否已使用天赋 */
    talentUsed: boolean;
    /** 本回合是否为刚打出的随从（回合结束清零） */
    playedThisTurn?: boolean;
    /** 附着的行动卡列表（带 owner 追踪） */
    attachedActions: AttachedActionOnMinion[];
}

/** 随从上附着的行动卡 */
export interface AttachedActionOnMinion {
    uid: string;
    defId: string;
    ownerId: PlayerId;
    /** 本回合是否已使用天赋（ongoing+talent 行动卡，每回合一次） */
    talentUsed?: boolean;
}

/** 基地上附着的持续行动卡 */
export interface OngoingActionOnBase {
    uid: string;
    defId: string;
    ownerId: PlayerId;
    /** 本回合是否已使用天赋（ongoing 行动卡天赋，每回合一次） */
    talentUsed?: boolean;
    /** 额外元数据（如 block_the_path 存储被限制的派系） */
    metadata?: Record<string, unknown>;
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
    /** 本回合每个基地已打出随从数（baseIndex → count），用于北极基地等限制 */
    minionsPlayedPerBase?: Record<number, number>;
    /** 本回合已使用的弃牌堆出牌能力 sourceId 集合（用于每回合限制） */
    usedDiscardPlayAbilities?: string[];
    /** 基地限定额外随从额度（baseIndex → 额外额度），只能打到指定基地 */
    baseLimitedMinionQuota?: Record<number, number>;
    /** 基地限定额度是否要求同名（baseIndex → true），与 baseLimitedMinionQuota 配合 */
    baseLimitedSameNameRequired?: Record<number, boolean>;
    /** 额外出牌的力量上限（如家园给的额外出牌只能打力量≤2的随从），回合结束清零 */
    extraMinionPowerMax?: number;
    /** 同名额外随从约束：剩余额度数 */
    sameNameMinionRemaining?: number;
    /** 同名额外随从约束：已锁定的 defId（null = 尚未锁定，string = 已锁定） */
    sameNameMinionDefId?: string | null;
    /** 待消费的随从打出后效果队列（如 crack_of_dusk/its_alive 的打出后+1指示物） */
    pendingMinionPlayEffects?: Array<{ effect: 'addPowerCounter'; amount: number }>;
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

/** 计分后触发的 special 延迟记录（Me First! 窗口打出，afterScoring 时兑现） */
export interface PendingAfterScoringSpecial {
    sourceDefId: string;
    playerId: PlayerId;
    baseIndex: number;
}

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
    /** 本回合被消灭的随从记录（用于 cthulhu_furthering_the_cause 等能力的精确判定） */
    turnDestroyedMinions?: { defId: string; baseIndex: number; owner: string }[];
    /** 被沉睡印记标记的玩家（下回合不能打行动卡） */
    sleepMarkedPlayers?: PlayerId[];
    /** 本回合每位玩家移动随从到各基地的次数（用于牧场等"首次移动"触发） */
    minionsMovedToBaseThisTurn?: Record<string, Record<number, number>>;
    /** 临时临界点修正（回合结束自动清零，baseIndex → delta） */
    tempBreakpointModifiers?: Record<number, number>;
    /**
     * 本回合各限制组在各基地的 special 能力使用记录
     * key = limitGroup（如 'ninja_special'），value = 已使用的 baseIndex 列表
     * 用于"每个基地每回合只能使用一次 X 能力"类规则
     */
    specialLimitUsed?: Record<string, number[]>;
    /** 巨石阵：本回合已使用双才能的随从 UID（每回合只有一个随从可用才能两次） */
    standingStonesDoubleTalentMinionUid?: string;
    /** 计分后触发的 special 延迟记录（回合开始自动清空） */
    pendingAfterScoringSpecials?: PendingAfterScoringSpecial[];
    /**
     * 进入 scoreBases 阶段时锁定的 eligible 基地索引列表。
     * 规则：一旦基地在进入计分阶段时达到 breakpoint，即使 Me First! 响应窗口中
     * 力量被降低到 breakpoint 以下，该基地仍然必定计分。
     * @see https://smashup.fandom.com/wiki/Rules — Phase 3 Step 4
     */
    scoringEligibleBaseIndices?: number[];
}

export interface FactionSelectionState {
    /** 已被选择的派系 */
    takenFactions: string[];
    /** 每位玩家已选的派系 */
    playerSelections: Record<PlayerId, string[]>;
    /** 选择完成的玩家 */
    completedPlayers: PlayerId[];
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
        .reduce((sum, m) => sum + m.basePower + m.powerCounters + m.powerModifier, 0);
}

export function getTotalPowerOnBase(base: BaseInPlay): number {
    return base.minions.reduce((sum, m) => sum + m.basePower + m.powerCounters + m.powerModifier, 0);
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
    /** 激活场上随从的 special 能力（如忍者侍从回手+额外随从） */
    ACTIVATE_SPECIAL: 'su:activate_special',
} as const;

/** 打出随从 */
export interface PlayMinionCommand extends Command<typeof SU_COMMANDS.PLAY_MINION> {
    payload: {
        cardUid: string;
        baseIndex: number;
        /** 从弃牌堆打出（而非手牌）。由"它们为你而来"等持续效果启用 */
        fromDiscard?: boolean;
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

/** 使用天赋（随从天赋或 ongoing 行动卡天赋） */
export interface UseTalentCommand extends Command<typeof SU_COMMANDS.USE_TALENT> {
    payload: {
        /** 随从天赋时必填 */
        minionUid?: string;
        /** ongoing 行动卡天赋时必填 */
        ongoingCardUid?: string;
        baseIndex: number;
    };
}

/** 激活场上随从的 special 能力（如忍者侍从回手+额外随从） */
export interface ActivateSpecialCommand extends Command<typeof SU_COMMANDS.ACTIVATE_SPECIAL> {
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
    | UseTalentCommand
    | ActivateSpecialCommand;

// ============================================================================
// 事件类型
// ============================================================================

// 事件定义已迁移到 domain/events.ts，使用 defineEvents() 框架
// 导入 SU_EVENT_TYPES 以获取事件类型常量
export { SU_EVENTS };

export interface MinionPlayedEvent extends GameEvent<'su:minion_played'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
        /** 基地 defId（事件发生时的基地，用于日志显示）。可选，用于向后兼容测试代码。 */
        baseDefId?: string;
        power: number;
        /** 从弃牌堆打出（而非手牌） */
        fromDiscard?: boolean;
        /** 弃牌堆出牌来源能力 ID（用于每回合限制追踪） */
        discardPlaySourceId?: string;
        /** 是否消耗正常随从额度 */
        consumesNormalLimit?: boolean;
    };
    /** 来源命令类型（用于去重：只有来自 PLAY_MINION 命令的事件才在 pipeline 步骤 4.5 触发 onPlay） */
    sourceCommandType?: string;
}

export interface ActionPlayedEvent extends GameEvent<'su:action_played'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
    };
}

/** 单个随从的力量 breakdown（用于 ActionLog 展示） */
export interface MinionPowerBreakdown {
    /** 随从 defId */
    defId: string;
    /** 基础力量 */
    basePower: number;
    /** 最终力量 */
    finalPower: number;
    /** 非零修正列表（永久/临时/ongoing） */
    modifiers: { sourceDefId: string; sourceName: string; value: number }[];
}

export interface BaseScoredEvent extends GameEvent<'su:base_scored'> {
    payload: {
        baseIndex: number;
        baseDefId: string;
        /** 排名与 VP：按力量降序 */
        rankings: { playerId: PlayerId; power: number; vp: number }[];
        /** 每位玩家的随从力量 breakdown（可选，用于 ActionLog 展示） */
        minionBreakdowns?: Record<PlayerId, MinionPowerBreakdown[]>;
    };
}

export interface BaseClearedEvent extends GameEvent<'su:base_cleared'> {
    payload: {
        baseIndex: number;
        baseDefId: string;
    };
}

export interface VpAwardedEvent extends GameEvent<'su:vp_awarded'> {
    payload: {
        playerId: PlayerId;
        amount: number;
        reason: string;
    };
}

export interface CardsDrawnEvent extends GameEvent<'su:cards_drawn'> {
    payload: {
        playerId: PlayerId;
        count: number;
        cardUids: string[];
    };
}

export interface CardsDiscardedEvent extends GameEvent<'su:cards_discarded'> {
    payload: {
        playerId: PlayerId;
        cardUids: string[];
    };
}

export interface TurnStartedEvent extends GameEvent<'su:turn_started'> {
    payload: {
        playerId: PlayerId;
        turnNumber: number;
    };
}

export interface TurnEndedEvent extends GameEvent<'su:turn_ended'> {
    payload: {
        playerId: PlayerId;
        nextPlayerIndex: number;
    };
}

export interface BaseReplacedEvent extends GameEvent<'su:base_replaced'> {
    payload: {
        baseIndex: number;
        oldBaseDefId: string;
        newBaseDefId: string;
        /** 为 true 时保留基地上的随从和 ongoing，仅替换 defId（如 terraform） */
        keepCards?: boolean;
    };
}

export interface DeckReshuffledEvent extends GameEvent<'su:deck_reshuffled'> {
    payload: {
        playerId: PlayerId;
        deckUids: string[];
    };
}

/** 玩家牌库重排事件（仅重排牌库中的卡，不碰弃牌堆） */
export interface DeckReorderedEvent extends GameEvent<'su:deck_reordered'> {
    payload: {
        playerId: PlayerId;
        /** 重排后的牌库 UID 顺序 */
        deckUids: string[];
    };
}

/** 随从被收回手牌 */
export interface MinionReturnedEvent extends GameEvent<'su:minion_returned'> {
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
export interface LimitModifiedEvent extends GameEvent<'su:limit_modified'> {
    payload: {
        playerId: PlayerId;
        limitType: 'minion' | 'action';
        delta: number;
        reason: string;
        /** 限定额度只能用于指定基地（不设则为全局额度） */
        restrictToBase?: number;
        /** 额外出牌的力量上限（如家园：力量≤2），不设则无限制 */
        powerMax?: number;
        /** 同名限制：这些额度只能用于打出同一 defId 的随从（第一个打出时锁定） */
        sameNameOnly?: boolean;
        /** 预锁定的 defId（与 sameNameOnly 配合使用，跳过首次锁定直接限定） */
        sameNameDefId?: string;
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
    | DeckReorderedEvent
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
    | CardToDeckTopEvent
    | CardToDeckBottomEvent
    | CardTransferredEvent
    | CardRecoveredFromDiscardEvent
    | HandShuffledIntoDeckEvent
    | MadnessDrawnEvent
    | MadnessReturnedEvent
    | BaseDeckReorderedEvent
    | RevealHandEvent
    | RevealDeckTopEvent
    | TempPowerAddedEvent
    | PermanentPowerAddedEvent
    | BreakpointModifiedEvent
    | BaseDeckShuffledEvent
    | SpecialLimitUsedEvent
    | SpecialAfterScoringArmedEvent
    | SpecialAfterScoringConsumedEvent
    | AbilityFeedbackEvent
    | AbilityTriggeredEvent
    | BaseClearedEvent;

// ============================================================================
// 新增事件接口
// ============================================================================

export interface FactionSelectedEvent extends GameEvent<'su:faction_selected'> {
    payload: {
        playerId: PlayerId;
        factionId: string;
    };
}

export interface AllFactionsSelectedEvent extends GameEvent<'su:all_factions_selected'> {
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
        /** 触发了自动重抽 (mulligan) 的玩家列表（规则：若无随从可重抽一次） */
        mulliganPlayers?: PlayerId[];
    };
}

// PromptCreatedEvent 和 PromptResolvedEvent 已移除
// 统一使用引擎层 InteractionSystem 的 SYS_INTERACTION_* 事件

// ============================================================================
// 新增事件接口（能力系统）
// ============================================================================

export interface MinionDestroyedEvent extends GameEvent<typeof SU_EVENTS.MINION_DESTROYED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        ownerId: PlayerId;
        destroyerId?: PlayerId;  // 消灭者（可选，如果没有则默认为 ownerId）
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
        /** 额外元数据（如 block_the_path 存储被限制的派系） */
        metadata?: Record<string, unknown>;
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

/** ongoing 卡上的力量指示物变化（如 vampire_summon_wolves） */
export interface OngoingCardCounterChangedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED> {
    payload: {
        cardUid: string;
        baseIndex: number;
        delta: number;
        reason: string;
    };
}

export interface TalentUsedEvent extends GameEvent<typeof SU_EVENTS.TALENT_USED> {
    payload: {
        playerId: PlayerId;
        /** 随从天赋时为随从 uid，ongoing 行动卡天赋时为 undefined */
        minionUid?: string;
        /** ongoing 行动卡天赋时为卡牌 uid */
        ongoingCardUid?: string;
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

/** 卡牌放入牌库顶 */
export interface CardToDeckTopEvent extends GameEvent<typeof SU_EVENTS.CARD_TO_DECK_TOP> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
    };
}

/** 卡牌在玩家之间转移（通常从对手牌库/手牌到自己手牌） */
export interface CardTransferredEvent extends GameEvent<typeof SU_EVENTS.CARD_TRANSFERRED> {
    payload: {
        cardUid: string;
        defId: string;
        fromPlayerId: PlayerId;
        toPlayerId: PlayerId;
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

/** 基地牌库重排事件（巫师学院等能力） */
export interface BaseDeckReorderedEvent extends GameEvent<typeof SU_EVENTS.BASE_DECK_REORDERED> {
    payload: {
        /** 重排后的基地牌库顶部 defId 列表（按顺序） */
        topDefIds: string[];
        reason: string;
    };
}

/** 展示手牌事件（外星人 Probe / 密大 Book of Iter 等能力） */
export interface RevealHandEvent extends GameEvent<typeof SU_EVENTS.REVEAL_HAND> {
    payload: {
        /** 被查看的玩家（单人或多人） */
        targetPlayerId: string | string[];
        /** 查看者 */
        viewerPlayerId: string;
        /** 被展示的卡牌列表 */
        cards: { uid: string; defId: string }[];
        /** 触发展示的玩家（viewerPlayerId='all' 时由此玩家关闭展示） */
        sourcePlayerId?: string;
        /** 触发原因 */
        reason: string;
    };
}

/** 展示牌库顶事件（外星人 Scout Ship 等能力） */
export interface RevealDeckTopEvent extends GameEvent<typeof SU_EVENTS.REVEAL_DECK_TOP> {
    payload: {
        /** 牌库所有者（单人或多人） */
        targetPlayerId: string | string[];
        /** 查看者 */
        viewerPlayerId: string;
        /** 牌库顶卡牌 */
        cards: { uid: string; defId: string }[];
        /** 展示数量 */
        count: number;
        /** 触发展示的玩家（viewerPlayerId='all' 时由此玩家关闭展示） */
        sourcePlayerId?: string;
        /** 触发原因 */
        reason: string;
    };
}

/** 临时力量修正事件（回合结束自动清零） */
export interface TempPowerAddedEvent extends GameEvent<typeof SU_EVENTS.TEMP_POWER_ADDED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
    };
}

/** 永久力量修正事件（非指示物，不可移动/转移） */
export interface PermanentPowerAddedEvent extends GameEvent<typeof SU_EVENTS.PERMANENT_POWER_ADDED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
    };
}

/** 临界点临时修正事件（回合结束自动清零） */
export interface BreakpointModifiedEvent extends GameEvent<typeof SU_EVENTS.BREAKPOINT_MODIFIED> {
    payload: {
        baseIndex: number;
        delta: number;
        reason: string;
    };
}

/** 基地牌库洗混事件 */
export interface BaseDeckShuffledEvent extends GameEvent<typeof SU_EVENTS.BASE_DECK_SHUFFLED> {
    payload: {
        /** 洗混后的基地牌库 defId 列表（确定性） */
        newBaseDeckDefIds: string[];
        reason: string;
    };
}

/** special 能力限制组使用记录事件 */
export interface SpecialLimitUsedEvent extends GameEvent<typeof SU_EVENTS.SPECIAL_LIMIT_USED> {
    payload: {
        playerId: PlayerId;
        baseIndex: number;
        /** 限制组标识（如 'ninja_special'） */
        limitGroup: string;
        /** 触发的能力 defId */
        abilityDefId: string;
    };
}

/** 标记：某张 special 需要在本回合该基地计分后触发 */
export interface SpecialAfterScoringArmedEvent extends GameEvent<typeof SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED> {
    payload: {
        sourceDefId: string;
        playerId: PlayerId;
        baseIndex: number;
    };
}

/** 清理：某条计分后 special 标记已消费 */
export interface SpecialAfterScoringConsumedEvent extends GameEvent<typeof SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED> {
    payload: {
        sourceDefId: string;
        playerId: PlayerId;
        baseIndex: number;
    };
}

/** 能力执行反馈事件（纯 UI 提示，reducer 不处理） */
export interface AbilityFeedbackEvent extends GameEvent<typeof SU_EVENTS.ABILITY_FEEDBACK> {
    payload: {
        playerId: PlayerId;
        /** i18n key（在 game-smashup namespace 下） */
        messageKey: string;
        /** i18n 插值参数 */
        messageParams?: Record<string, string | number>;
        /** 提示级别 */
        tone?: 'info' | 'warning';
    };
}

/** 持续效果/触发器激活事件（纯 FX 动画，reducer 不处理） */
export interface AbilityTriggeredEvent extends GameEvent<typeof SU_EVENTS.ABILITY_TRIGGERED> {
    payload: {
        /** 触发源卡牌 defId */
        sourceDefId: string;
        /** 触发时机 */
        timing: string;
        /** 触发发生的基地索引（可选） */
        baseIndex?: number;
    };
}
