/**
 * 大杀四方 (Smash Up) - 领域类型定义
 *
 * 核心概念：
 * - 每位玩家选 2 个派系混搭成 40 张牌库
 * - 回合制：出牌 → 基地记分 → 抽牌
 * - 基地力量达到临界点时记分，前三名获 VP
 * - 默认先到 15 VP 胜出；可选 2v2 模式下按团队 25 VP 胜出
 */

import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';
import type { CardPreviewRef } from '../../../core';
import { SMASHUP_FACTION_IDS } from './ids';
// ✅ 重要：这里将 SU_EVENT_TYPES 重命名为 SU_EVENTS 导入
// 原因：历史代码中所有地方都使用 SU_EVENTS.XXX 访问事件类型常量
// 实际上访问的是 SU_EVENT_TYPES.XXX（字符串常量，如 'su:faction_selected'）
// 而不是 SU_EVENTS['su:faction_selected']（对象，包含 type/audio/sound）
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

export type SmashUpTeamMode = 'ffa' | '2v2';
export type SmashUpTeamId = 'team_13' | 'team_24';

// ============================================================================
// 卡牌定义（静态数据）
// ============================================================================

/** 卡牌类别 */
export type CardType = 'minion' | 'action' | 'fusion' | 'titan';

/** 行动卡子类型 */
export type ActionSubtype = 'standard' | 'ongoing' | 'special';

/** 派系 ID */
export type FactionId = string;

/** 能力标签 */
export type AbilityTag = 'onPlay' | 'ongoing' | 'special' | 'talent' | 'extra' | 'onDestroy' | 'onUncover' | 'ongoingActivation';

export type SmashUpActivationKind = 'special' | 'talent' | 'ongoing';
export type SmashUpActivationZone = 'board' | 'discard' | 'setaside' | 'hand';
export type SmashUpActivationWindow = 'playCards' | 'beforeScoring' | 'afterScoring';
export type SmashUpActivationSourceScope = 'scoringBase' | 'anyBase';

export interface SmashUpActivatableAbility {
    kind: SmashUpActivationKind;
    zone: SmashUpActivationZone;
    window?: SmashUpActivationWindow;
    /** 计分窗口中，承载此能力的对象必须位于计分基地，还是可以位于任意基地。 */
    sourceScope?: SmashUpActivationSourceScope;
}

/**
 * 卡牌打出约束（数据驱动）。
 * - 'requireOwnMinion'：目标基地上必须有自己的至少一个随从
 * - 'requireNoCharacters'：目标基地上不能有任何角色
 * - { type: 'requireOwnPower', minPower: N }：目标基地上己方力量必须 ≥ N
 * - 'onlyCardInHand'：本卡必须是手牌中的唯一一张
 */
export type PlayConstraint =
    | 'requireOwnMinion'
    | 'requireNoCharacters'
    | 'onlyCardInHand'
    | { type: 'requireOwnPower'; minPower: number };

export type PlayTargetMinionController = 'self' | 'opponent' | 'any';

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
    /** 显式声明可手动发动的能力入口。 */
    activatableAbilities?: SmashUpActivatableAbility[];
    /**
     * 是否可在 Me First! 窗口中从手牌打出到即将计分的基地。
     * 如影舞者：基地计分前可从手牌打出到该基地。
     */
    beforeScoringPlayable?: boolean;
    /** 是否可以替代本回合的普通行动额度打出这张随从牌。 */
    playAsAction?: boolean;
    /**
     * 打出时的音效 key（可选）。
     * 如果指定，优先使用此音效；否则 fallback 到派系默认音效池。
     */
    soundKey?: string;
}

/** 融合卡打出模式 */
export type FusionPlayAs = 'minion' | 'action';

/** 融合卡定义（在牌库/手牌中同时视为随从与战术；打出时声明一种类型） */
export interface FusionCardDef {
    id: string;
    type: 'fusion';
    name: string;
    /** @deprecated 历史英文名，已由 i18n 接管，待清理 */
    nameEn?: string;
    faction: FactionId;
    /** 牌组中的数量 */
    count: number;
    previewRef?: CardPreviewRef;

    // --- 作为随从打出 ---
    minionPower: number;
    minionAbilityTags?: AbilityTag[];
    minionPlayConstraint?: PlayConstraint;
    minionSpecialLimitGroup?: string;
    minionActivatableAbilities?: SmashUpActivatableAbility[];
    minionBeforeScoringPlayable?: boolean;

    // --- 作为战术打出 ---
    actionSubtype: ActionSubtype;
    actionAbilityTags?: AbilityTag[];
    actionOngoingTarget?: 'base' | 'minion';
    actionPlayConstraint?: PlayConstraint;
    actionActivatableAbilities?: SmashUpActivatableAbility[];
    /** action 面在正常打出时是否需要显式选择目标基地 */
    actionPlayNeedsBase?: boolean;
    /** action 面在正常打出时是否需要显式选择目标随从（并隐含需要目标基地） */
    actionPlayNeedsMinion?: boolean;
    /** action 面显式选择随从时，该目标随从的控制者约束 */
    actionPlayTargetMinionController?: PlayTargetMinionController;
    actionSpecialNeedsBase?: boolean;
    actionSpecialLimitGroup?: string;
    actionSpecialTiming?: SpecialTiming;
    /**
     * 非 special 的行动面是否也可在响应窗口中打出。
     */
    actionResponseWindowTiming?: SpecialTiming;
    /**
     * 当通过 actionResponseWindowTiming 在响应窗口中打出时，是否需要选择基地。
     */
    actionResponseWindowNeedsBase?: boolean;
}

/** 泰坦打出模式 */
export type TitanSummonMode =
    | 'explicit'
    | 'insteadOfRegularMinion'
    | 'insteadOfRegularAction'
    | 'insteadOfRegularMinionAndAction';
export type TitanPlayAsKind = 'minion' | 'action';

export interface CardOrTitanChoiceValue {
    cardUid?: string;
    titanUid?: string;
    defId: string;
    playKind?: TitanPlayAsKind;
    skip?: boolean;
}

/** 泰坦卡定义 */
export interface TitanCardDef {
    id: string;
    type: 'titan';
    name: string;
    faction: FactionId;
    abilityTags?: AbilityTag[];
    /** 显式声明哪些能力会作为玩家可点击入口暴露在 UI 上。 */
    activatableAbilities?: SmashUpActivatableAbility[];
    /** @deprecated 使用 activatableAbilities 代替 */
    activatableAbilityKinds?: SmashUpActivationKind[];
    previewRef?: CardPreviewRef;
    summonMode: TitanSummonMode;
    /** 仅影响“作为哪种牌被打出/选择”的语义，不改变真实牌种 */
    playAsKinds?: TitanPlayAsKind[];
}

/** Special 技能触发时机 */
export type SpecialTiming = 'beforeScoring' | 'afterScoring' | 'triggered';

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
    /** 正常打出时是否需要显式选择目标基地 */
    playNeedsBase?: boolean;
    /** 正常打出时是否需要显式选择目标随从（并隐含需要目标基地） */
    playNeedsMinion?: boolean;
    /** 正常打出时显式选择随从的控制者约束 */
    playTargetMinionController?: PlayTargetMinionController;
    /** 特殊行动卡是否需要选择目标基地（Me First! 窗口中高亮可选基地） */
    specialNeedsBase?: boolean;
    /**
     * special 能力限制组：同组的 special 能力共享"每基地每回合一次"限制。
     * 仅对 subtype='special' 的行动卡有效。
     */
    specialLimitGroup?: string;
    /** 显式声明可手动发动的能力入口。 */
    activatableAbilities?: SmashUpActivatableAbility[];
    /**
     * special 技能的显式触发时机（仅对 subtype='special' 有效）：
     * - 'beforeScoring': 在 Me First! 窗口打出时立即执行
     * - 'afterScoring': 生成 ARMED 事件，延迟到基地计分后执行
     * - 'triggered': 不能进入通用计分响应窗口，只允许由特定 trigger / provider 驱动
     */
    specialTiming?: SpecialTiming;
    /**
     * 非 special 行动卡是否也可在响应窗口中打出。
     */
    responseWindowTiming?: SpecialTiming;
    /**
     * 当通过 responseWindowTiming 在响应窗口中打出时，是否需要选择基地。
     */
    responseWindowNeedsBase?: boolean;
    /**
     * 打出时的音效 key（可选）。
     * 如果指定，优先使用此音效；否则 fallback 到派系默认音效池。
     */
    soundKey?: string;
}

/** 卡牌定义联合类型 */
export type CardDef = MinionCardDef | ActionCardDef | FusionCardDef | TitanCardDef;

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
        /** 禁止把与此基地已有仆从同名的随从打到此基地。 */
        sameNameAlreadyAtBase?: boolean;
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
    podFactions?: FactionId[];
    previewRef?: CardPreviewRef;
    /** 基地限制规则（如禁止打出随从/行动） */
    restrictions?: BaseRestriction[];
    /** 基地持续力量加成：在此基地上的所有随从获得该值的力量修正 */
    minionPowerBonus?: number;
    /** 设置期间翻到此基地时，替换它并重洗基地牌库 */
    replaceOnSetup?: boolean;
    /** 显式允许多个泰坦共存（如未来 Kaiju Island） */
    allowMultipleTitans?: boolean;
}

// ============================================================================
// 运行时卡牌实例
// ============================================================================

/** 卡牌实例（运行时唯一） */
export interface SmashUpCardZoneDestination {
    zone: 'discard';
    playerId: PlayerId;
}

export interface SmashUpCardProvenanceSnapshot {
    ownerId: PlayerId;
    defaultDestination: SmashUpCardZoneDestination;
    sourceControllerId?: PlayerId;
}

export interface SmashUpCardObjectRef {
    uid: string;
    defId: string;
    type?: CardType;
    provenance: SmashUpCardProvenanceSnapshot;
}

export interface CardInstance {
    uid: string;
    defId: string;
    type: CardType;
    owner: PlayerId;
    provenance?: SmashUpCardProvenanceSnapshot;
}

/** 被其他卡牌/机制暂存的卡牌（如踢拳兄弟、返时者停滞区）。 */
export interface StoredCardInstance extends CardInstance {
    storedByPlayerId: PlayerId;
    storedUnderUid?: string;
    storedUnderDefId?: string;
    counters?: number;
    /** 当前回合内移除了最后一个停滞指示物，用于返时者后续天赋/特殊能力判断。 */
    lastStasisCounterRemovedTurn?: number;
    reason: string;
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
    /** 额外元数据（用于 POD 等复杂状态追踪） */
    metadata?: Record<string, unknown>;
}

/** 随从上附着的行动卡 */
export interface AttachedActionOnMinion {
    uid: string;
    defId: string;
    ownerId: PlayerId;
    /** 本回合是否已使用天赋（ongoing+talent 行动卡，每回合一次） */
    talentUsed?: boolean;
    metadata?: Record<string, unknown>;
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

/** 埋葬在基地旁的面朝下卡牌（在场上但不可用） */
export interface BuriedCardOnBase {
    uid: string;
    /** 真正的卡牌 defId（对非控制者应隐藏） */
    defId: string;
    /** 真正所有者（用于基地离场时弃置到正确弃牌堆） */
    trueOwnerId: PlayerId;
    /** 控制者：埋葬该卡的玩家 */
    controllerId: PlayerId;
    /** 来源：用于规则/日志调试 */
    buriedFrom: 'hand' | 'discard' | 'play' | 'deck';
}

/** 场上的基地 */
export interface BaseInPlay {
    /** 运行时基地实例身份；槽位编号只表示当前位置，不表示长期身份。 */
    instanceId?: string;
    defId: string;
    minions: MinionOnBase[];
    /** 持续行动卡列表 */
    ongoingActions: OngoingActionOnBase[];
    /** 埋葬卡列表（面朝下） */
    buriedCards?: BuriedCardOnBase[];
}

export type TitanLocation =
    | { zone: 'setaside' }
    | { zone: 'base'; baseIndex: number; enteredAt: number };

export interface TitanState {
    uid: string;
    defId: string;
    faction: FactionId;
    ownerId: PlayerId;
    controllerId: PlayerId;
    powerCounters: number;
    talentUsed: boolean;
    location: TitanLocation;
    metadata?: Record<string, unknown>;
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
    /** 被特定来源暂存、仍可由规则重新打出的卡牌。 */
    storedCards?: StoredCardInstance[];
    /** 移出游戏（放入盒中）的卡牌 */
    removedFromGame?: CardInstance[];
    /** 本回合已打出随从数 */
    minionsPlayed: number;
    /** 本回合可打出随从额度（默认 1） */
    minionLimit: number;
    /** 本回合已打出行动数 */
    actionsPlayed: number;
    /** 本回合可打出行动额度（默认 1） */
    actionLimit: number;
    /** 本回合作为“额外牌”打出的牌总数（Eliza 等效果使用） */
    extraCardsPlayedThisTurn?: number;
    /** 起手无随从时“可”重抽一次；用于防止重复重抽 */
    startingHandMulliganUsed?: boolean;
    /** 本回合每个基地已打出随从数（baseIndex → count），用于北极基地等限制 */
    minionsPlayedPerBase?: Record<number, number>;
    /** 本回合已使用的弃牌堆出牌能力 sourceId 集合（用于每回合限制） */
    usedDiscardPlayAbilities?: string[];
    /** 基地限定额外随从额度（baseIndex → 额外额度），只能打到指定基地 */
    baseLimitedMinionQuota?: Record<number, number>;
    /** 基地限定且带力量上限的额外随从额度集合（baseIndex → 每个元素代表 1 次受限额度） */
    baseLimitedMinionPowerCaps?: Record<number, number[]>;
    /** 基地限定额度是否要求同名（baseIndex → true），与 baseLimitedMinionQuota 配合 */
    baseLimitedSameNameRequired?: Record<number, boolean>;
    /** 基地限定额度的同名 defId（baseIndex → defId），与 baseLimitedSameNameRequired 配合 */
    baseLimitedSameNameDefId?: Record<number, string>;
    /** 额外出牌的力量上限（如家园给的额外出牌只能打力量≤2的随从），回合结束清零 */
    extraMinionPowerMax?: number;
    /** 带力量上限的全局额外随从额度集合（每个元素代表 1 次受限额度），回合结束清零 */
    extraMinionPowerCaps?: number[];
    /** 同名额外随从约束：剩余额度数 */
    sameNameMinionRemaining?: number;
    /** 同名额外随从约束：已锁定的 defId（null = 尚未锁定，string = 已锁定） */
    sameNameMinionDefId?: string | null;
    /** 待消费的随从打出后效果队列（如 crack_of_dusk/its_alive 的打出后+1指示物） */
    pendingMinionPlayEffects?: Array<{ effect: 'addPowerCounter' | 'addTempPower' | 'grantExtraActionForPlayedMinion'; amount: number; reason?: string }>;
    /** 本回合已消耗的“额外第二次 talent”次数（如 Great Wolf Spirit） */
    extraTalentUsesConsumed?: number;
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
export const TEAM_VP_TO_WIN_2V2 = 25;
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
    /** 卡牌 UID（用于后续执行时的上下文） */
    cardUid: string;
    // 随从快照（可选）：用于计分后随从已离场的场景（如 giant_ant_we_are_the_champions）
    minionSnapshots?: Array<{
        uid: string;
        defId: string;
        baseIndex: number;
        counterAmount: number;
    }>;
}

/**
 * 计分后需要等基地清场/替换完成后再执行的动作。
 * 典型场景：效果目标是“替换后的基地”而不是已计分的旧基地。
 */
export type PendingPostScoringAction =
    | {
        kind: 'playMinionOnReplacementBase';
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        ownerId?: PlayerId;
        /** 默认从牌库打出；少数计分后效果会从手牌预约到替换基地。 */
        fromZone?: 'deck' | 'hand';
        baseIndex: number;
        targetBaseDefId: string;
        power: number;
    }
    | {
        kind: 'moveMinionToReplacementBase';
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        targetBaseDefId: string;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
    }
    | {
        kind: 'playTitanOnReplacementBase';
        titanUid: string;
        defId: string;
        ownerId: PlayerId;
        controllerId: PlayerId;
        baseIndex: number;
        targetBaseDefId: string;
        reason: string;
    };

// ============================================================================
// Trigger queue (Wiki reaction ordering / witness / LKI)
// ============================================================================

export type WitnessRequirement = 'inPlayAtTriggerTime' | 'inPlayAtResolveTime';

export interface MinionLkiSnapshot {
    uid: string;
    defId: string;
    owner: PlayerId;
    controller: PlayerId;
    baseIndex: number;
    basePower: number;
    powerCounters: number;
    powerModifier: number;
    tempPowerModifier: number;
    attachedActionDefIds?: string[];
    attachedActions?: Array<{
        uid: string;
        defId: string;
        ownerId: PlayerId;
        metadata?: Record<string, unknown>;
    }>;
    metadata?: Record<string, unknown>;
}

export interface BaseLkiSnapshot {
    baseIndex: number;
    defId: string;
}

export type SmashUpReactionResourceRef =
    | { kind: 'minion'; uid: string }
    | { kind: 'base'; index: number }
    | { kind: 'cardInstance'; uid: string }
    | { kind: 'sourceInstance'; uid: string }
    | { kind: 'titan'; uid: string }
    | { kind: 'playerHand'; playerId: PlayerId }
    | { kind: 'playerDeck'; playerId: PlayerId }
    | { kind: 'playerDiscard'; playerId: PlayerId }
    | { kind: 'playerRemoved'; playerId: PlayerId }
    | { kind: 'playerPlayLimit'; playerId: PlayerId }
    | { kind: 'playerVp'; playerId: PlayerId }
    | { kind: 'playerControl'; playerId: PlayerId }
    | { kind: 'turnFlag'; key: string; playerId?: PlayerId }
    | { kind: 'baseDeck' }
    | { kind: 'madnessDeck' }
    | { kind: 'scoring'; baseIndex?: number }
    | { kind: 'targetAvailability'; baseIndex?: number }
    | { kind: 'global'; key: string };

export interface SmashUpReactionResourceFootprint {
    reads: SmashUpReactionResourceRef[];
    writes: SmashUpReactionResourceRef[];
    opensInteraction?: boolean;
    fallbackReason?: string;
}

/**
 * 历史命名兼容：旧调用方把显式 reaction 资源合同称为 TriggerEffectContract。
 * 语义上等同于显式的 reaction resource footprint。
 */
export type TriggerEffectContract = SmashUpReactionResourceFootprint;

export interface TriggerInstance {
    /** stable id for interaction selection */
    id: string;
    timing: import('./ongoingEffects').TitanAwareTriggerTiming;
    /** queued trigger 回放时用于恢复 ctx.playerId 的语义来源 */
    playerContext?: 'eventPlayer' | 'sourceController' | 'sourceHostController';
    /** defId of the triggering source (minion/action/base) */
    sourceDefId: string;
    /** concrete source card uid when the trigger comes from an in-play card instance */
    sourceCardUid?: string;
    /** who controls the source at trigger time (best-effort) */
    sourceControllerId?: PlayerId;
    /** true owner of the source at trigger time when it differs from controller */
    sourceOwnerPlayerId?: PlayerId;
    /** base index where source is located at trigger time (best-effort) */
    sourceBaseIndex?: number;

    /** Wiki ordering */
    mandatory: boolean;
    resolutionClass: 'mandatory' | 'optional';
    /** 同一张牌/同一时点产生的反应 frame */
    frameId?: string;
    /** 触发源事件快照 id */
    sourceEventId?: string;
    /** who decides / is credited */
    ownerPlayerId: PlayerId;
    /** 原始触发事件关联玩家；queued trigger 执行时用于恢复 ctx.playerId 语义 */
    eventPlayerId?: PlayerId;
    witnessRequirement: WitnessRequirement;
    witnessed: boolean;

    /** minimal context */
    baseIndex?: number;
    moveFromBaseIndex?: number;
    moveToBaseIndex?: number;
    simultaneousMoveBatchMinionUids?: string[];
    duel?: ActiveDuel;
    duelSourceId?: string;
    duelOutcome?: DuelOutcomeKind;
    duelChallenger?: MinionOnBase;
    duelChallenged?: MinionOnBase;
    duelWinner?: MinionOnBase;
    duelLoser?: MinionOnBase;
    duelTie?: boolean;
    triggerMinionUid?: string;
    triggerMinionDefId?: string;
    triggerMinionPower?: number;
    triggerCardUid?: string;
    triggerCardDefId?: string;
    triggerCardOwnerId?: PlayerId;
    triggerCardKind?: 'ongoing' | 'attached_action';
    transferredCardUid?: string;
    transferredCardDefId?: string;
    transferredCardOwnerId?: PlayerId;
    transferredFromPlayerId?: PlayerId;
    transferredToPlayerId?: PlayerId;
    discardedCards?: Array<{ uid: string; defId: string; ownerId: PlayerId }>;
    discardedFromZone?: 'hand' | 'deck';
    /** destroyer (for onMinionDestroyed "after you destroy" checks) */
    destroyerId?: PlayerId;
    /** 被影响/被消灭随从的控制者等事件控制者上下文 */
    controllerId?: PlayerId;
    reason?: string;
    affectType?: import('./ongoingEffects').AffectType;
    counterChangeKind?: 'added' | 'removed';
    counterDelta?: number;
    affectEvent?: SmashUpEvent;
    affectBatchTargets?: Array<{ minionUid: string; baseIndex: number; controllerId: PlayerId }>;
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    triggerBaseControllersAtTrigger?: PlayerId[];
    actionTargetBaseIndex?: number;
    actionTargetType?: 'base' | 'minion';
    actionTargetMinionUid?: string;
    buriedCardUid?: string;
    buriedCardDefId?: string;
    buriedCardControllerId?: PlayerId;
    buriedFrom?: 'hand' | 'discard' | 'play' | 'deck';
    inspectionCards?: Array<{ uid: string; defId: string }>;
    inspectionZone?: 'deck' | 'hand';
    inspectionTargetPlayerIds?: PlayerId[];
    inspectionCausePlayerId?: PlayerId;
    /**
     * Explicit, auditable fallback used only when runtime artifact probing cannot
     * derive a concrete resource footprint. Normal ordering must come from
     * emitted events / structured interactions instead of this field.
     */
    fallbackFootprint?: SmashUpReactionResourceFootprint & { fallbackReason: string };
    derivedFootprint?: SmashUpReactionResourceFootprint;

    /** LKI snapshots captured at queue time */
    lkiMinion?: MinionLkiSnapshot;
    lkiBase?: BaseLkiSnapshot;
}

export type SmashUpReactionPhase = 'mandatory' | 'optional';

export type SmashUpReactionFrameKind =
    | 'generic'
    | 'turn-start'
    | 'turn-end'
    | 'score-before'
    | 'score-when'
    | 'score-after';

export interface SmashUpReactionSession {
    frameId: string;
    frameKind: SmashUpReactionFrameKind;
    phase: SmashUpReactionPhase;
    activePlayerId: PlayerId;
    currentPlayerId: PlayerId;
    consecutivePasses: number;
    passedPlayerIds?: PlayerId[];
    sourceBaseIndex?: number;
    responseWindowType?: 'meFirst' | 'afterScoring';
    consumedSpecialCardUids?: string[];
}

export type DuelOutcomeKind =
    | 'destroy_loser'
    | 'vp_to_winner'
    | 'draw2_to_winner'
    | 'high_noon'
    | 'run_em_off';

export interface ActiveDuel {
    id: string;
    baseIndex: number;
    sourceId: string;
    sourcePlayerId: PlayerId;
    challengerPlayerId: PlayerId;
    challengerMinionUid: string;
    challengedPlayerId: PlayerId;
    challengedMinionUid: string;
    outcome: DuelOutcomeKind;
    destroyReason?: string;
}

export interface SmashUpCore {
    players: Record<PlayerId, PlayerState>;
    /** 固定座位顺序（不随先手/轮转变化），用于 2v2 队伍推导。 */
    seatOrder?: PlayerId[];
    /** 玩家回合顺序 */
    turnOrder: PlayerId[];
    /** 当前玩家索引 */
    currentPlayerIndex: number;
    /** 对局规则模式 */
    teamMode?: SmashUpTeamMode;
    /** 场上基地 */
    bases: BaseInPlay[];
    /** 全局泰坦状态（牌库旁 / 在场） */
    titans?: TitanState[];
    /** 房间创建时启用的扩展集合 */
    enabledExpansions?: string[];
    /** 是否允许查看牌库剩余牌详情 */
    deckQueryEnabled?: boolean;
    /** 基地牌库（defId 列表） */
    baseDeck: string[];
    /** 基地弃牌堆（defId 列表）。当基地牌库用尽时，会将弃牌堆洗回牌库继续补充。 */
    baseDiscard: string[];
    /** 回合数 */
    turnNumber: number;
    /** 最近一次通过 SYS_PHASE_CHANGED 同步到 core 的阶段。 */
    turnPhase?: string;
    /** UID 自增计数器 */
    nextUid: number;
    /** 运行时基地实例 id 自增计数器。 */
    nextBaseInstanceId?: number;
    /** 游戏结果 */
    gameResult?: GameOverResult;

    // === 新增字段 ===
    /** 派系选择阶段状态（选择完成后置为 undefined） */
    factionSelection?: FactionSelectionState;
    /** 疯狂牌库（克苏鲁扩展，defId 列表） */
    madnessDeck?: string[];
    cardsPlayedThisTurn?: number;
    powerCountersPlacedOnMinionsThisTurn?: number;
    /** 本回合被消灭的随从记录（用于 cthulhu_furthering_the_cause 等能力判定，并阻止过期移动把它们从弃牌堆拉回场上） */
    turnDestroyedMinions?: { uid: string; defId: string; baseIndex: number; owner: string; controller?: string }[];
    /** 本回合曾“消灭过随从”的玩家列表（用于 Nightstalker POD 等判定）。TURN_STARTED 时清空。 */
    destroyedMinionByPlayersThisTurn?: PlayerId[];
    /**
     * 本回合各基地上“玩家力量减少”的记录（baseIndex → playerIds[]）。
     * 主要用于 Stakeout POD 的判定。TURN_STARTED 时清空。
     */
    basePowerDecreasedPlayersThisTurn?: Record<number, PlayerId[]>;
    /**
     * Stakeout POD 的临时限制：其他玩家不能在指定基地打出力量≥3的随从，直到 ownerId 的下回合开始。
     */
    stakeoutPodBlocks?: Array<{ baseIndex: number; ownerId: PlayerId; expiresOnTurnNumber: number }>;
    /**
     * 持续到未来某个 TURN_STARTED 才回退的永久力量修正。
     * 例如 The Count POD 天赋的“直到你的下回合开始时 -1 力量”。
     */
    timedPowerModifiers?: Array<{
        minionUid: string;
        amount: number;
        expiresOnTurnNumber: number;
        expiresOnPlayerId?: PlayerId;
        reason: string;
    }>;
    /**
     * 本回合暂时失去持续能力的泰坦 UID 列表。
     * 用于 Mergacon 这类“移动后直到回合结束失去 ongoing”效果。
     */
    titanOngoingSuppressedUntilTurnEnd?: string[];
    /**
     * 彩虹鸟本轮“首次低战力随从进场”触发记录。
     * key = titanUid, value = 触发时的 turnNumber。
     */
    rainborocTriggeredTurnByTitan?: Record<string, number>;
    /**
     * 硕大圆石本轮“随从移离后触发”记录。
     * key = titanUid, value = 触发时的 turnNumber。
     */
    veryLargeBoulderTriggeredTurnByTitan?: Record<string, number>;
    /**
     * 三号空间站本轮“首次查看/展示/检索牌库”触发记录。
     * key = titanUid, value = 触发时的 turnNumber。
     */
    moonZeroThreeTriggeredTurnByTitan?: Record<string, number>;
    /**
     * 泰坦最近一次移动发生的 turnNumber。
     * 用于“若此泰坦本回合未移动过”类判定。
     */
    titanMovedTurnByTitanUid?: Record<string, number>;
    // （保留扩展字段位于此处）
    /** 被沉睡印记标记的玩家（下回合不能打行动卡） */
    sleepMarkedPlayers?: PlayerId[];
    /**
     * 持续到施加者下个回合开始的玩家限制（如睡眠印记 POD）
     *
     * - play_action: 目标玩家在效果持续期间不能打出战术/行动卡
     * - move_minion: 目标玩家在效果持续期间不能移动随从
     */
    playerRestrictionsUntilTurnStart?: PlayerTurnRestriction[];
    /** 本回合每位玩家移动随从到各基地的次数（用于牧场等"首次移动"触发） */
    minionsMovedToBaseThisTurn?: Record<string, Record<number, number>>;
    /** 本回合每个基地被移动到/离开的随从总次数（Category 5 等按基地累计移动数计算） */
    minionMoveEventsByBaseThisTurn?: Record<number, number>;
    /** 本回合各玩家发起的随从移动总次数（用于 Category 5 的进场条件） */
    minionMovesThisTurnByPlayer?: Record<PlayerId, number>;
    /**
     * 本回合禁止某玩家再次打出的行动 defId。
     *
     * 用于蜘蛛阿南西：“你本回合不能再打出该行动的任意复制”。
     * 生命周期：任意 TURN_STARTED 时清空，因为规则限定为当前玩家回合。
     */
    blockedActionDefIdsThisTurn?: Record<PlayerId, string[]>;
    /**
     * 本回合各玩家是否曾把对手随从移动到各基地（你们已经完蛋 POD）
     * key1 = baseIndex, key2 = playerId, value = true
     *
     * 生命周期：在 TURN_STARTED 时清空
     */
    movedToBasesThisTurn?: Record<number, Record<PlayerId, boolean>>;
    /** 海盗 POD：私掠者每回合一次触发追踪（minionUid 列表） */
    buccaneerPodUsedUids?: string[];
    /** 临时临界点修正（回合结束自动清零，旧存档兼容：baseIndex → delta） */
    tempBreakpointModifiers?: Record<number, number>;
    /** 临时临界点修正（运行时基地实例 id → delta） */
    tempBreakpointModifiersByBaseId?: Record<string, number>;
    /** 临时玩家-基地总力量修正（回合开始自动清零，旧存档兼容：baseIndex → playerId → delta） */
    tempBasePowerModifiers?: Record<number, Record<PlayerId, number>>;
    /** 临时玩家-基地总力量修正（运行时基地实例 id → playerId → delta） */
    tempBasePowerModifiersByBaseId?: Record<string, Record<PlayerId, number>>;
    /**
     * 本回合各限制组在各基地的 special 能力使用记录
     * key = limitGroup（如 'ninja_special'），value = 已使用的 baseIndex 列表
     * 用于"每个基地每回合只能使用一次 X 能力"类规则
     */
    specialLimitUsed?: Record<string, number[]>;
    /** 巨石阵：本回合已使用双才能的随从 UID（每回合只有一个随从可用才能两次） */
    standingStonesDoubleTalentMinionUid?: string;
    greatWolfSpiritDoubleTalentCardUids?: string[];
    /** 计分后触发的 special 延迟记录（回合开始自动清空） */
    pendingAfterScoringSpecials?: PendingAfterScoringSpecial[];
    /**
     * 进入 scoreBases 阶段时锁定的 eligible 基地索引列表。
     * 规则：一旦基地在进入计分阶段时达到 breakpoint，即使 Me First! 响应窗口中
     * 力量被降低到 breakpoint 以下，该基地仍然必定计分。
     * @see https://smashup.fandom.com/wiki/Rules — Phase 3 Step 4
     */
    scoringEligibleBaseIndices?: number[];
    /**
     * 本次计分阶段中已触发过 beforeScoring 的基地索引列表。
     * 用于防止交互解决后重新进入 scoreBase 时重复触发 beforeScoring。
     * 在 scoreBases 阶段结束时清空。
     */
    beforeScoringTriggeredBases?: number[];
    /**
     * 本次计分阶段中已触发过 whenScoring 的基地索引列表。
     * 用于防止交互解决后重新进入 scoreBase 时重复触发 whenScoring。
     * 在 scoreBases 阶段结束时清空。
     */
    whenScoringTriggeredBases?: number[];
    /**
     * 本次计分阶段中已触发过 afterScoring 的基地索引列表。
     * 用于防止交互解决后重新进入 scoreBase 时重复触发 afterScoring。
     * 在 scoreBases 阶段结束时清空。
     */
    afterScoringTriggeredBases?: number[];

    /**
     * 临时基地能力压制（直到压制者的下个回合开始）
     *
     * 用于实现类似“渗透 POD 天赋”这种“即使牌已离场，压制仍持续到下回合开始”的规则。
     */
    suppressedBasesUntilTurnStart?: Array<{ baseIndex: number; suppressorPlayerId: PlayerId }>;
    /** 临时卡牌能力压制（直到压制者的下个回合开始） */
    suppressedCardsUntilTurnStart?: Array<{
        cardUid: string;
        baseIndex: number;
        suppressorPlayerId: PlayerId;
        cardType: 'minion' | 'ongoing' | 'attached' | 'titan';
    }>;

    /**
     * 本回合已触发过“每回合一次”的持续行动卡 UID 列表。
     *
     * 用于实现类似 Altar to Cthulhu POD 等“每回合一次触发”的效果。
     * 生命周期：在 TURN_STARTED 时清空。
     */
    turnUsedOngoingUids?: string[];
    /**
     * 本回合已使用过的主动基地能力。
     *
     * 用于实现“During your turn, once each turn”类基地能力。
     * 生命周期：在对应玩家的 TURN_STARTED 时清空该玩家记录。
     */
    usedBaseAbilitiesThisTurn?: Array<{
        playerId: PlayerId;
        baseIndex: number;
        baseDefId: string;
    }>;
    /** 等待插入的额外回合队列。 */
    pendingExtraTurns?: Array<{
        playerId: PlayerId;
        returnToPlayerIndex: number;
        reason: string;
    }>;
    /** 当前正在执行的额外回合；该回合结束后回到 returnToPlayerIndex。 */
    activeExtraTurn?: {
        playerId: PlayerId;
        returnToPlayerIndex: number;
        reason: string;
    };

    /** 全局触发队列：用于按 Wiki 规则统一“同时触发”的反应排序与 witness/LKI */
    triggerQueue?: TriggerInstance[];
    /** 当前进行中的决斗。用于官方 Oops duel 流程期间的全局门控与 UI 展示。 */
    activeDuel?: ActiveDuel;
}

export interface FactionSelectionState {
    /** 已被选择的派系 */
    takenFactions: string[];
    /** 每位玩家已选的派系 */
    playerSelections: Record<PlayerId, string[]>;
    /** 选择完成的玩家 */
    completedPlayers: PlayerId[];
}

export type PlayerTurnRestrictionType = 'play_action' | 'move_minion';

export interface PlayerTurnRestriction {
    targetPlayerId: PlayerId;
    sourcePlayerId: PlayerId;
    sourceDefId?: string;
    restrictionType: PlayerTurnRestrictionType;
}


// ============================================================================
// 辅助函数
// ============================================================================

export function getCurrentPlayerId(state: SmashUpCore): PlayerId {
    return state.turnOrder[state.currentPlayerIndex];
}

export function getPlayerPowerOnBase(
    base: BaseInPlay,
    playerId: PlayerId,
    state?: SmashUpCore,
    baseIndex?: number
): number {
    // 随从级别的力量总和（不包含 ongoing 修正）
    const minionPower = base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => sum + m.basePower + m.powerCounters + m.powerModifier, 0);
    
    return minionPower;
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
    DESELECT_FACTION: 'su:deselect_faction',
    SWAP_SEAT: 'su:swap_seat',
    USE_BASE_ABILITY: 'su:use_base_ability',
    USE_TALENT: 'su:use_talent',
    /** 激活场上随从的 special 能力（如忍者侍从回手+额外随从） */
    ACTIVATE_SPECIAL: 'su:activate_special',
    /** 激活在场泰坦的主动 ongoing 能力 */
    ACTIVATE_TITAN_ONGOING: 'su:activate_titan_ongoing',
} as const;

/** 打出随从 */
export interface PlayMinionCommand extends Command<typeof SU_COMMANDS.PLAY_MINION> {
    payload: {
        cardUid: string;
        baseIndex: number;
        /** 从弃牌堆打出（而非手牌）。由"它们为你而来"等持续效果启用 */
        fromDiscard?: boolean;
        /** 从暂存区打出（如返时者停滞区）。 */
        fromStored?: boolean;
        /** 替代普通行动额度打出这张随从牌，不消耗普通随从额度。 */
        playAsAction?: boolean;
    };
}

/** 打出行动卡 */
export interface PlayActionCommand extends Command<typeof SU_COMMANDS.PLAY_ACTION> {
    payload: {
        cardUid: string;
        targetBaseIndex?: number;
        targetMinionUid?: string;
        /** 从弃牌堆打出行动卡（如 Cyberback 允许打到自己身上） */
        fromDiscard?: boolean;
        /** 从暂存区打出行动卡（如踢拳兄弟储存的行动）。 */
        fromStored?: boolean;
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

/** 取消已选派系 */
export interface DeselectFactionCommand extends Command<typeof SU_COMMANDS.DESELECT_FACTION> {
    payload: {
        factionId: string;
    };
}

/** 调整选秀阶段座位顺序（影响先后手） */
export interface SwapSeatCommand extends Command<typeof SU_COMMANDS.SWAP_SEAT> {
    payload: {
        targetPlayerId: PlayerId;
    };
}

/** 使用基地的主动能力 */
export interface UseBaseAbilityCommand extends Command<typeof SU_COMMANDS.USE_BASE_ABILITY> {
    payload: {
        baseIndex: number;
    };
}

/** 使用天赋（随从天赋或 ongoing 行动卡天赋） */
export interface UseTalentCommand extends Command<typeof SU_COMMANDS.USE_TALENT> {
    payload: {
        /** 随从天赋时必填 */
        minionUid?: string;
        /** ongoing 行动卡天赋时必填 */
        ongoingCardUid?: string;
        titanUid?: string;
        baseIndex: number;
    };
}

/** 激活场上随从的 special 能力（如忍者侍从回手+额外随从） */
export interface ActivateSpecialCommand extends Command<typeof SU_COMMANDS.ACTIVATE_SPECIAL> {
    payload: {
        minionUid?: string;
        titanUid?: string;
        discardCardUid?: string;
        handCardUid?: string;
        baseIndex: number;
        targetMinionUid?: string;
    };
}

/** 激活在场泰坦的主动 ongoing 能力 */
export interface ActivateTitanOngoingCommand extends Command<typeof SU_COMMANDS.ACTIVATE_TITAN_ONGOING> {
    payload: {
        titanUid: string;
        baseIndex: number;
    };
}

export type SmashUpCommand =
    | PlayMinionCommand
    | PlayActionCommand
    | DiscardToLimitCommand
    | SelectFactionCommand
    | DeselectFactionCommand
    | SwapSeatCommand
    | UseBaseAbilityCommand
    | UseTalentCommand
    | ActivateSpecialCommand
    | ActivateTitanOngoingCommand;

// ============================================================================
// 事件类型
// ============================================================================

// 事件定义已迁移到 domain/events.ts，使用 defineEvents() 框架
// 
// ⚠️ 命名说明：
// - SU_EVENTS：在本文件顶部通过 `import { SU_EVENT_TYPES as SU_EVENTS }` 导入
//   实际上是 SU_EVENT_TYPES 的别名，用于访问事件类型字符串常量
//   例如：SU_EVENTS.FACTION_SELECTED = 'su:faction_selected'
// 
// - SU_EVENT_TYPES：从 events.ts 导出的原始常量对象
//   包含所有事件类型的字符串常量（FACTION_SELECTED, MINION_PLAYED 等）
// 
// ❌ 不要导出原始的 SU_EVENTS 对象（defineEvents 返回值）
//   那是包含 { type, audio, sound } 的对象，不是字符串常量
//   会导致 SU_EVENTS.FACTION_SELECTED 变成 undefined
// 
// ✅ 为了向后兼容，重新导出 SU_EVENTS 作为 SU_EVENT_TYPES 的别名
export { SU_EVENT_TYPES, SU_EVENT_TYPES as SU_EVENTS } from './events';

export interface MinionPlayedEvent extends GameEvent<'su:minion_played'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
        ownerId?: PlayerId;
        /** 基地 defId（事件发生时的基地，用于日志显示）。可选，用于向后兼容测试代码。 */
        baseDefId?: string;
        power: number;
        /** 从弃牌堆打出（而非手牌） */
        fromDiscard?: boolean;
        /** 从牌库打出（而非手牌） */
        fromDeck?: boolean;
        /** 从埋葬区打出（揭开时使用） */
        fromBuried?: boolean;
        /** 从暂存区打出（如返时者停滞区）。 */
        fromStored?: boolean;
        targetBaseIndex?: number;
        targetType?: 'base' | 'minion';
        targetMinionUid?: string;
        /** 弃牌堆出牌来源能力 ID（用于每回合限制追踪） */
        discardPlaySourceId?: string;
        /** 是否消耗正常随从额度 */
        consumesNormalLimit?: boolean;
        /** 是否替代普通行动额度打出 */
        playAsAction?: boolean;
        /** 允许隐式来源：跳过卡牌位置检查（用于动态牌源如"亡者崛起"的临时牌源） */
        allowImplicitSource?: boolean;
        /** 强制打出但不触发 onPlay（如最后的歌声） */
        skipOnPlayAbility?: boolean;
    };
    /** 来源命令类型（用于去重：只有来自 PLAY_MINION 命令的事件才在 pipeline 步骤 4.5 触发 onPlay） */
    sourceCommandType?: string;
}

export interface ActionPlayedEvent extends GameEvent<'su:action_played'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        ownerId?: PlayerId;
        /** 是否为额外行动（不消耗行动次数） */
        isExtraAction?: boolean;
        /** 从埋葬区打出（揭开时使用） */
        fromBuried?: boolean;
        /** 从弃牌堆打出 */
        fromDiscard?: boolean;
        /** 从暂存区打出 */
        fromStored?: boolean;
    };
}

export interface TitanPlayedEvent extends GameEvent<typeof SU_EVENTS.TITAN_PLAYED> {
    payload: {
        titanUid: string;
        defId: string;
        ownerId: PlayerId;
        controllerId: PlayerId;
        baseIndex: number;
        /** 基地 defId（事件发生时的基地） */
        baseDefId?: string;
        /** 本次打出是否消耗常规随从/行动额度；仅用于额度结算，不改变泰坦真实牌种 */
        consumesRegularPlayKind?: TitanPlayAsKind;
        /** 同时消耗多个常规额度（如 Spirit of the Forest） */
        consumesRegularPlayKinds?: TitanPlayAsKind[];
        reason: string;
    };
}

export interface TitanMovedEvent extends GameEvent<typeof SU_EVENTS.TITAN_MOVED> {
    payload: {
        titanUid: string;
        defId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        /** 目标基地 defId（可选） */
        toBaseDefId?: string;
        metadata?: Record<string, unknown>;
        reason: string;
    };
}

export interface TitanRemovedFromPlayEvent extends GameEvent<typeof SU_EVENTS.TITAN_REMOVED_FROM_PLAY> {
    payload: {
        titanUid: string;
        defId: string;
        ownerId: PlayerId;
        controllerId: PlayerId;
        reason: string;
        fromBaseIndex?: number;
    };
}

export interface TitanPowerCounterAddedEvent extends GameEvent<typeof SU_EVENTS.TITAN_POWER_COUNTER_ADDED> {
    payload: {
        titanUid: string;
        amount: number;
        reason: string;
    };
}

export interface TitanPowerCounterRemovedEvent extends GameEvent<typeof SU_EVENTS.TITAN_POWER_COUNTER_REMOVED> {
    payload: {
        titanUid: string;
        amount: number;
        reason: string;
    };
}

export interface TitanOngoingSuppressedEvent extends GameEvent<typeof SU_EVENTS.TITAN_ONGOING_SUPPRESSED> {
    payload: {
        titanUid: string;
        reason: string;
    };
}

/** 埋葬卡事件：将一张卡面朝下放到基地旁 */
export interface CardBuriedEvent extends GameEvent<typeof SU_EVENTS.CARD_BURIED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
        /** 真正所有者（用于基地离场清算） */
        trueOwnerId: PlayerId;
        buriedFrom: 'hand' | 'discard' | 'play' | 'deck';
        reason: string;
    };
}

/** 揭开埋葬卡事件：从埋葬区移除并立即“打出为额外卡” */
export interface BuriedCardUncoveredEvent extends GameEvent<typeof SU_EVENTS.BURIED_CARD_UNCOVERED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        baseIndex: number;
        reason: string;
        discardWithoutPlay?: boolean;
    };
}

export interface BuriedCardReturnedToHandEvent extends GameEvent<typeof SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        baseIndex: number;
        baseDefId: string;
        source: 'sphinx-start-turn' | 'sphinx-after-scoring';
    };
}

/** 基地离场时丢弃其上的所有埋葬卡（翻开弃置，不触发能力） */
export interface BuriedCardsDiscardedWithBaseEvent extends GameEvent<typeof SU_EVENTS.BURIED_CARDS_DISCARDED_WITH_BASE> {
    payload: { baseIndex: number; reason: string };
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
        /** 计分当下的总力量（含非随从来源的力量） */
        totalPower?: number;
        /** 基地原始破坏点（卡面值） */
        baseBreakpoint?: number;
        /** 计分当下有效破坏点（含持续/临时修正） */
        effectiveBreakpoint?: number;
        /**
         * 是否属于“锁定计分”：
         * 进入 scoreBases 阶段时已达标，后续窗口中被移走/减力后仍按规则计分。
         */
        scoredByLockedEligibility?: boolean;
    };
}

export interface BaseClearedEvent extends GameEvent<'su:base_cleared'> {
    payload: {
        baseIndex: number;
        baseDefId: string;
        baseInstanceId?: string;
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

/**
 * 从牌库“磨牌/弃牌”（mill）：将指定 uid 的牌从 deck 移入 discard。
 *
 * 语义区分：
 * - CARDS_DISCARDED：只允许从手牌弃置
 * - CARDS_MILLED：只允许从牌库移入弃牌堆
 */
export interface CardsMilledEvent extends GameEvent<'su:cards_milled'> {
    payload: {
        playerId: PlayerId;
        cardUids: string[];
        /** 触发来源（可选，用于 actionLog/FX 识别） */
        reason?: string;
    };
}

/** 入队一个或多个 TriggerInstance（silent / deterministic) */
export interface TriggerQueuedEvent extends GameEvent<'su:trigger_queued'> {
    payload: {
        triggers: TriggerInstance[];
    };
}

/** 消费（执行）了一个 TriggerInstance */
export interface TriggerConsumedEvent extends GameEvent<'su:trigger_consumed'> {
    payload: {
        triggerId: string;
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
        extraTurnPlayerId?: PlayerId;
        extraTurnReturnToPlayerIndex?: number;
        extraTurnReason?: string;
        completedExtraTurn?: boolean;
    };
}

export interface ExtraTurnQueuedEvent extends GameEvent<typeof SU_EVENTS.EXTRA_TURN_QUEUED> {
    payload: {
        playerId: PlayerId;
        returnToPlayerIndex: number;
        reason: string;
    };
}

export interface BaseReplacedEvent extends GameEvent<'su:base_replaced'> {
    payload: {
        baseIndex: number;
        oldBaseDefId: string;
        newBaseDefId: string;
        oldBaseInstanceId?: string;
        newBaseInstanceId?: string;
        /** 为 true 时保留基地上的随从和 ongoing，仅替换 defId（如 terraform） */
        keepCards?: boolean;
        /** 某些效果会在后续事件里显式重写 baseDeck/baseDiscard，允许跳过 newBaseDefId 不在 baseDeck 的告警。 */
        allowMissingFromBaseDeck?: boolean;
    };
}

export interface ActionCounteredEvent extends GameEvent<'su:action_countered'> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        counteredByPlayerId: PlayerId;
        counteredByDefId: string;
        reason: string;
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
        /** 若与 playerId 不同，表示被重排进牌库的卡当前来源于另一位玩家的牌区 */
        sourcePlayerId?: PlayerId;
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
        /** 效果来源玩家（可选，用于保护检查） */
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        /** Internal guard used when an optional return replacement is declined. */
        skipReturnReplacement?: boolean;
    };
}

/** 出牌额度修改 */
export interface LimitModifiedEvent extends GameEvent<'su:limit_modified'> {
    payload: {
        playerId: PlayerId;
        limitType: 'minion' | 'action';
        delta: number;
        reason: string;
        /** 额外出牌时机：banked=可在当前出牌阶段暂存；immediate=必须立刻打出或放弃 */
        playTiming?: 'banked' | 'immediate';
        /** 限定额度只能用于指定基地（不设则为全局额度） */
        restrictToBase?: number;
        /** 仅 immediate 额外行动：限定只能打到指定随从上。 */
        restrictToMinionUid?: string;
        /** 仅 immediate 额外行动：按计分窗口特殊行动处理，用于保留基地限定和计分窗口限制。 */
        specialActionWindow?: 'meFirst' | 'afterScoring';
        /** 立即额外行动限定只能打出指定卡牌实例 */
        restrictToCardUid?: string;
        /** 立即额外行动限定只能打出指定卡牌定义 */
        restrictToCardDefId?: string;
        /** 额外出牌的力量上限（如家园：力量≤2），不设则无限制 */
        powerMax?: number;
        /** 同名限制：这些额度只能用于打出同一 defId 的随从（第一个打出时锁定） */
        sameNameOnly?: boolean;
        /** 预锁定的 defId（与 sameNameOnly 配合使用，跳过首次锁定直接限定） */
        sameNameDefId?: string;
        /** 仅 immediate 额外随从：限定只能打出指定的手牌 uid。 */
        specificCardUid?: string;
        /**
         * 仅 immediate 额外随从：若玩家选择“放弃这次额外随从”，是否需要消费掉 pendingMinionPlayEffects 的队列首项。
         * 用于避免“本应绑定本次额外随从的效果”泄漏到后续普通随从。
         */
        consumePendingMinionPlayEffectOnSkip?: boolean;
    };
}

export type SmashUpEvent =
    | MinionPlayedEvent
    | ActionPlayedEvent
    | ActionCounteredEvent
    | TitanPlayedEvent
    | TitanMovedEvent
    | TitanRemovedFromPlayEvent
    | TitanPowerCounterAddedEvent
    | TitanPowerCounterRemovedEvent
    | TitanOngoingSuppressedEvent
    | CardBuriedEvent
    | BuriedCardUncoveredEvent
    | BuriedCardReturnedToHandEvent
    | BuriedCardsDiscardedWithBaseEvent
    | BaseScoredEvent
    | VpAwardedEvent
    | CardsDrawnEvent
    | CardsDiscardedEvent
    | CardsMilledEvent
    | TriggerQueuedEvent
    | TriggerConsumedEvent
    | TurnStartedEvent
    | TurnEndedEvent
    | ExtraTurnQueuedEvent
    | BaseReplacedEvent
    | DeckReshuffledEvent
    | DeckReorderedEvent
    | MinionReturnedEvent
    | LimitModifiedEvent
    | FactionSelectedEvent
    | FactionDeselectedEvent
    | SeatSwappedEvent
    | AllFactionsSelectedEvent
    | MinionDestroyedEvent
    | MinionMovedEvent
    | MinionControlChangedEvent
    | MinionMetadataUpdatedEvent
    | BaseMetadataUpdatedEvent
    | ActionDefBlockedThisTurnEvent
    | PowerCounterAddedEvent
    | PowerCounterRemovedEvent
    | OngoingAttachedEvent
    | OngoingDetachedEvent
    | TalentUsedEvent
    | DiscardAbilityUsedEvent
    | TitanMetadataUpdatedEvent
    | CardRemovedFromDeckEvent
    | CardRemovedFromGameEvent
    | CardBoxedEvent
    | StakeoutPodBlockAddedEvent
    | CardToDeckTopEvent
    | CardToDeckBottomEvent
    | CardTransferredEvent
    | CardRecoveredFromDiscardEvent
    | CardStoredEvent
    | StoredCardCounterChangedEvent
    | StoredCardReleasedEvent
    | HandShuffledIntoDeckEvent
    | StartingHandMulliganUsedEvent
    | MadnessDrawnEvent
    | MadnessReturnedEvent
    | BaseDeckReorderedEvent
    | RevealHandEvent
    | RevealDeckTopEvent
    | DeckInspectedEvent
    | TempPowerAddedEvent
    | TempBasePowerModifiedEvent
    | PermanentPowerAddedEvent
    | BreakpointModifiedEvent
    | BaseDeckShuffledEvent
    | SpecialLimitUsedEvent
    | SpecialAfterScoringArmedEvent
    | SpecialAfterScoringConsumedEvent
    | ActionReturnToHandOptionArmedEvent
    | AbilityFeedbackEvent
    | AbilityTriggeredEvent
    | BaseAbilitySuppressedEvent
    | CardSuppressedEvent
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

export interface FactionDeselectedEvent extends GameEvent<'su:faction_deselected'> {
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
        /** 场上基地初始化后下一个运行时基地实例序号 */
        nextBaseInstanceId?: number;
        /** 起手无随从的玩家列表（规则：若无随从“可”重抽一次） */
        mulliganPlayers?: PlayerId[];
    };
}

export interface SeatSwappedEvent extends GameEvent<'su:seat_swapped'> {
    payload: {
        requesterId: PlayerId;
        targetPlayerId: PlayerId;
    };
}

export interface StartingHandMulliganUsedEvent extends GameEvent<typeof SU_EVENTS.STARTING_HAND_MULLIGAN_USED> {
    payload: { playerId: PlayerId; used: boolean };
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
        controllerId?: PlayerId; // 被消灭随从的控制者；live minion 缺失时供 reducer/ledger 继续保留 controller provenance
        destroyerId?: PlayerId;  // 消灭者（可选；缺失时按“无明确消灭者”或由事件流程回退推断处理）
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        sourceKind?: 'action' | 'nonAction';
        reason: string;
    };
}

export interface MinionMovedEvent extends GameEvent<typeof SU_EVENTS.MINION_MOVED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        /** 目标基地 defId（可选）。存在时 reducer 优先按活体基地定位目标索引。 */
        toBaseDefId?: string;
        /** 效果来源玩家（可选，用于保护检查与语义归因） */
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        /** 同批移动标记；同一批内的随从不应互相见证彼此的移动。 */
        batchId?: string;
        reason: string;
    };
}

export interface MinionControlChangedEvent extends GameEvent<typeof SU_EVENTS.MINION_CONTROL_CHANGED> {
    payload: {
        minionUid: string;
        minionDefId: string;
        baseIndex: number;
        ownerId: PlayerId;
        fromControllerId: PlayerId;
        toControllerId: PlayerId;
        sourcePlayerId: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
        reason: string;
    };
}

/** 随从元数据更新事件（用于 POD 等复杂状态追踪） */
export interface MinionMetadataUpdatedEvent extends GameEvent<typeof SU_EVENTS.MINION_METADATA_UPDATED> {
    payload: {
        minionUid: string;
        /** 方便定位的基地索引（可选，reducer 会回退全场扫描） */
        baseIndex?: number;
        metadataUpdate: Record<string, unknown>;
        reason: string;
    };
}

/** 基地运行时 metadata 更新事件 */
export interface BaseMetadataUpdatedEvent extends GameEvent<typeof SU_EVENTS.BASE_METADATA_UPDATED> {
    payload: {
        baseIndex: number;
        baseInstanceId?: string;
        metadataUpdate: Record<string, unknown>;
        reason: string;
    };
}

export interface PowerCounterAddedEvent extends GameEvent<typeof SU_EVENTS.POWER_COUNTER_ADDED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

export interface PowerCounterRemovedEvent extends GameEvent<typeof SU_EVENTS.POWER_COUNTER_REMOVED> {
    payload: {
        minionUid: string;
        baseIndex: number;
        amount: number;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

export interface OngoingAttachedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_ATTACHED> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        sourcePlayerId?: PlayerId;
        targetType: 'base' | 'minion';
        targetBaseIndex: number;
        targetMinionUid?: string;
        /** 为 true 时，会先从 owner 的手牌/牌库/弃牌堆移除该卡，再执行附着（用于持续行动转移） */
        removeFromDiscard?: boolean;
        /** 额外元数据（如 block_the_path 存储被限制的派系） */
        metadata?: Record<string, unknown>;
        /** 某些“发动天赋后立即转移自身”的持续行动需要保留本回合已用状态 */
        talentUsed?: boolean;
    };
}

export interface OngoingDetachedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_DETACHED> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
        /** Clyde 2.0 replacement choice: true = put into Clyde controller's hand, false/absent = normal discard. */
        clydeReturnToHand?: boolean;
        destination?: 'discard' | 'hand';
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** ongoing 卡上的力量指示物变化（如 vampire_summon_wolves） */
export interface OngoingCardCounterChangedEvent extends GameEvent<typeof SU_EVENTS.ONGOING_CARD_COUNTER_CHANGED> {
    payload: {
        cardUid: string;
        baseIndex: number;
        delta: number;
        reason: string;
        metadataUpdate?: Record<string, unknown>;
        replaceMode?: boolean;
    };
}

export interface TitanMetadataUpdatedEvent extends GameEvent<typeof SU_EVENTS.TITAN_METADATA_UPDATED> {
    payload: {
        titanUid: string;
        metadataUpdate: Record<string, unknown>;
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
        titanUid?: string;
        defId: string;
        baseIndex: number;
    };
}

/** 卡牌放入牌库底 */
export interface CardRemovedFromDeckEvent extends GameEvent<typeof SU_EVENTS.CARD_REMOVED_FROM_DECK> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        reason: string;
    };
}

/** 卡牌移出游戏（放入盒中） */
export interface CardRemovedFromGameEvent extends GameEvent<typeof SU_EVENTS.CARD_REMOVED_FROM_GAME> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        reason: string;
    };
}

/** Stakeout POD：添加临时基地打随从限制 */
export interface CardBoxedEvent extends GameEvent<typeof SU_EVENTS.CARD_BOXED> {
    payload: {
        /** Source player whose zone currently contains the card. */
        playerId: PlayerId;
        /** True owner whose removed-from-game zone receives the card. Defaults to playerId for old events. */
        ownerId?: PlayerId;
        cardUid: string;
        defId: string;
        from: 'hand' | 'deck' | 'discard';
        reason: string;
    };
}

export interface StakeoutPodBlockAddedEvent extends GameEvent<typeof SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED> {
    payload: {
        baseIndex: number;
        ownerId: PlayerId;
        expiresOnTurnNumber: number;
        reason: string;
    };
}

export interface CardToDeckBottomEvent extends GameEvent<typeof SU_EVENTS.CARD_TO_DECK_BOTTOM> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 卡牌放入牌库顶 */
export interface CardToDeckTopEvent extends GameEvent<typeof SU_EVENTS.CARD_TO_DECK_TOP> {
    payload: {
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 卡牌在玩家之间转移（通常从对手牌库/手牌到自己手牌） */
export interface CardTransferredEvent extends GameEvent<typeof SU_EVENTS.CARD_TRANSFERRED> {
    payload: {
        cardUid: string;
        defId: string;
        fromPlayerId: PlayerId;
        toPlayerId: PlayerId;
        ownerId?: PlayerId;
        objectRef?: SmashUpCardObjectRef;
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

/** 将卡牌暂存到某个来源之下/旁边。 */
export interface CardStoredEvent extends GameEvent<typeof SU_EVENTS.CARD_STORED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        from: 'hand' | 'deck' | 'discard';
        storedUnderUid?: string;
        storedUnderDefId?: string;
        counters?: number;
        reason: string;
    };
}

/** 调整暂存牌上的计数器。返时者用它表达停滞指示物增减。 */
export interface StoredCardCounterChangedEvent extends GameEvent<typeof SU_EVENTS.STORED_CARD_COUNTER_CHANGED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        delta: number;
        reason: string;
    };
}

/** 从暂存区释放一张卡牌，通常紧接着被打出。 */
export interface StoredCardReleasedEvent extends GameEvent<typeof SU_EVENTS.STORED_CARD_RELEASED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
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
        /** 查看者（'all' = 所有人，PlayerId = 指定玩家） */
        viewerPlayerId: string | 'all';
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

/** 见证牌库被查看 / 展示 / 检索事件（用于“每回合第一次检查牌库”类能力） */
export interface DeckInspectedEvent extends GameEvent<typeof SU_EVENTS.DECK_INSPECTED> {
    payload: {
        /** 被查看的牌库拥有者 */
        targetPlayerId: string | string[];
        /** 实际进行查看/检索的玩家 */
        inspectorPlayerId: PlayerId;
        /** 本次见证到的牌数 */
        count: number;
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
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 临时玩家-基地总力量修正事件（回合开始自动清零） */
export interface TempBasePowerModifiedEvent extends GameEvent<typeof SU_EVENTS.TEMP_BASE_POWER_MODIFIED> {
    payload: {
        playerId: PlayerId;
        baseIndex: number;
        baseInstanceId?: string;
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
        expiresOnTurnNumber?: number;
        expiresOnPlayerId?: PlayerId;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 临界点临时修正事件（回合结束自动清零） */
export interface BreakpointModifiedEvent extends GameEvent<typeof SU_EVENTS.BREAKPOINT_MODIFIED> {
    payload: {
        baseIndex: number;
        baseInstanceId?: string;
        delta: number;
        reason: string;
    };
}

/** 基地运行时 metadata 更新事件 */
export interface BaseMetadataUpdatedEvent extends GameEvent<typeof SU_EVENTS.BASE_METADATA_UPDATED> {
    payload: {
        baseIndex: number;
        baseInstanceId?: string;
        metadataUpdate: Record<string, unknown>;
        reason: string;
    };
}

/** 本回合禁止某玩家再次打出某个行动 defId */
export interface ActionDefBlockedThisTurnEvent extends GameEvent<typeof SU_EVENTS.ACTION_DEF_BLOCKED_THIS_TURN> {
    payload: {
        playerId: PlayerId;
        defId: string;
        reason: string;
    };
}

/** 基地能力压制事件（直到压制者的下个回合开始） */
export interface BaseAbilitySuppressedEvent extends GameEvent<typeof SU_EVENTS.BASE_ABILITY_SUPPRESSED> {
    payload: {
        baseIndex: number;
        suppressorPlayerId: PlayerId;
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 主动基地能力已使用事件 */
export interface BaseAbilityUsedEvent extends GameEvent<typeof SU_EVENTS.BASE_ABILITY_USED> {
    payload: {
        playerId: PlayerId;
        baseIndex: number;
        baseDefId: string;
    };
}

/** 卡牌能力压制事件（直到压制者的下个回合开始） */
export interface CardSuppressedEvent extends GameEvent<typeof SU_EVENTS.CARD_SUPPRESSED> {
    payload: {
        cardUid: string;
        baseIndex: number;
        suppressorPlayerId: PlayerId;
        cardType: 'minion' | 'ongoing' | 'attached' | 'titan';
        reason: string;
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    };
}

/** 基地牌库洗混事件 */
export interface BaseDeckShuffledEvent extends GameEvent<typeof SU_EVENTS.BASE_DECK_SHUFFLED> {
    payload: {
        /** 洗混后的基地牌库 defId 列表（确定性） */
        newBaseDeckDefIds: string[];
        reason: string;
        /** 显式指定新的基地弃牌堆内容；用于非计分换基地等需要同步修正 discard 的场景 */
        newBaseDiscardDefIds?: string[];
        /**
         * 是否将 baseDiscard 一并清空。
         * 用于“基地牌库见底 → 将弃牌堆洗回牌库”的确定性归约。
         */
        clearBaseDiscard?: boolean;
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

export interface DiscardAbilityUsedEvent extends GameEvent<typeof SU_EVENTS.DISCARD_ABILITY_USED> {
    payload: {
        playerId: PlayerId;
        sourceId: string;
    };
}

/** 标记：某张 special 需要在本回合该基地计分后触发 */
export interface SpecialAfterScoringArmedEvent extends GameEvent<typeof SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED> {
    payload: {
        sourceDefId: string;
        playerId: PlayerId;
        baseIndex: number;
        /** 卡牌 UID（用于后续执行时的上下文） */
        cardUid: string;
        // 随从快照（可选）：用于计分后随从已离场的场景（如 giant_ant_we_are_the_champions）
        minionSnapshots?: Array<{
            uid: string;
            defId: string;
            baseIndex: number;
            counterAmount: number;
        }>;
    };
}

/** 清理：某条计分后 special 标记已消费 */
export interface SpecialAfterScoringConsumedEvent extends GameEvent<typeof SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED> {
    payload: {
        sourceDefId: string;
        playerId: PlayerId;
        baseIndex: number;
        cardUid?: string;
    };
}

export interface ActionReturnToHandOptionArmedEvent extends GameEvent<typeof SU_EVENTS.ACTION_RETURN_TO_HAND_OPTION_ARMED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        defId: string;
        ownerId: PlayerId;
        reason: string;
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
