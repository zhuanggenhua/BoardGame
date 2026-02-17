/**
 * DiceThrone 核心类型定义
 * 基础类型、状态接口和常量
 */

import type { PlayerId } from '../../../engine/types';
import type { CardPreviewRef } from '../../../core';
import type { AbilityDef, AbilityEffect } from './combat';
import type { ResourcePool } from './resourceSystem';
import type { TokenDef, TokenState } from './tokenTypes';
import type { PassiveAbilityDef } from './passiveAbility';

// ============================================================================
// 基础类型
// ============================================================================

/** DiceThrone 响应窗口类型（引擎层为通用 string，此处定义游戏特有值） */
export type DtResponseWindowType = 'afterRollConfirmed' | 'afterCardPlayed' | 'thenBreakpoint' | 'meFirst' | 'afterAttackResolved';

export type TurnPhase =
    | 'setup'
    | 'upkeep'
    | 'income'
    | 'main1'
    | 'offensiveRoll'
    | 'defensiveRoll'
    | 'main2'
    | 'discard';

export type DieFace =
    | 'fist'
    | 'palm'
    | 'taiji'
    | 'lotus'
    | 'sword'
    | 'helm'
    | 'heart'
    | 'pray'
    | 'strength'
    | 'fire'
    | 'fiery_soul'
    | 'magma'
    | 'meteor'
    | 'bow'
    | 'foot'
    | 'moon'
    | 'dagger'
    | 'bag'
    | 'card'
    | 'shadow';

// ============================================================================
// 角色编目
// ============================================================================

export const IMPLEMENTED_DICETHRONE_CHARACTER_IDS = [
    'monk',
    'barbarian',
    'pyromancer',
    'shadow_thief',
    'moon_elf',
    'paladin',
] as const;

export type SelectableCharacterId = (typeof IMPLEMENTED_DICETHRONE_CHARACTER_IDS)[number];
export type CharacterId = 'unselected' | SelectableCharacterId;

export interface CharacterDefinition {
    id: SelectableCharacterId;
    nameKey: string;
}

export const DICETHRONE_CHARACTER_CATALOG: CharacterDefinition[] = [
    { id: 'monk', nameKey: 'characters.monk' },
    { id: 'barbarian', nameKey: 'characters.barbarian' },
    { id: 'pyromancer', nameKey: 'characters.pyromancer' },
    { id: 'shadow_thief', nameKey: 'characters.shadow_thief' },
    { id: 'moon_elf', nameKey: 'characters.moon_elf' },
    { id: 'paladin', nameKey: 'characters.paladin' },
];

/**
 * 骰子实例
 * 扩展自引擎层 DiceSystem 的 Die 接口
 */
export interface Die {
    id: number;
    /** 骰子定义 ID（如 'monk-dice'） */
    definitionId: string;
    /** 当前点数 (1-6) */
    value: number;
    /** 当前主符号（从定义解析） */
    symbol: DieFace | null;
    /** 当前所有符号 */
    symbols: string[];
    /** 是否锁定（保留不重掷） */
    isKept: boolean;
}

/**
 * 卡牌打出条件
 * 用于限制卡牌在特定情况下才能打出
 */
export interface CardPlayCondition {
    /** 必须在指定阶段（更细粒度，区分进攻/防御） */
    phase?: 'offensiveRoll' | 'defensiveRoll';
    /** 必须是自己的回合（activePlayer） */
    requireOwnTurn?: boolean;
    /** 必须是对手的回合（非 activePlayer） */
    requireOpponentTurn?: boolean;
    /** 必须是当前投掷方（rollerId）——防御阶段为防御方，进攻阶段为进攻方 */
    requireIsRoller?: boolean;
    /** 必须不是当前投掷方（用于响应对手骰面确认，如"抬一手"） */
    requireIsNotRoller?: boolean;
    /** 必须已经投掷过（rollCount > 0） */
    requireHasRolled?: boolean;
    /** 必须有骰子结果可操作（dice.length > 0） */
    requireDiceExists?: boolean;
    /** 必须对手有骰子结果可操作（用于强制对手重掷） */
    requireOpponentDiceExists?: boolean;
    /** 必须骰面已确认（rollConfirmed = true），用于响应对手确认后的卡牌（如"抬一手"） */
    requireRollConfirmed?: boolean;
    /** 必须骰面未确认（rollConfirmed = false），用于增加投掷次数的卡牌 */
    requireNotRollConfirmed?: boolean;
    /** 必须有至少指定数量的骰子 */
    requireMinDiceCount?: number;
    /** 必须本回合已对对手造成至少指定伤害（检查 lastResolvedAttackDamage） */
    requireMinDamageDealt?: number;
}

/** 卡牌多语言文案 */
export interface CardI18n {
    name: string;
    description: string;
}

export interface AbilityCard {
    id: string;
    /** @deprecated 使用 i18n 字段代替，此字段由构建脚本自动生成 */
    name: string;
    type: 'upgrade' | 'action';
    cpCost: number;
    timing: 'main' | 'roll' | 'instant';
    /** 卡牌音效 key（用于卡牌级别音效） */
    sfxKey?: string;
    /** @deprecated 使用 i18n 字段代替，此字段由构建脚本自动生成 */
    description: string;
    previewRef?: CardPreviewRef;
    /** 卡牌效果列表（行动卡的即时效果，或升级卡的 replaceAbility 效果） */
    effects?: AbilityEffect[];
    /** 卡牌打出的额外条件 */
    playCondition?: CardPlayCondition;
    /** 多语言文案（单一数据源，支持任意语言 key） */
    i18n?: Record<string, CardI18n>;
}

export interface PendingAttack {
    attackerId: PlayerId;
    defenderId: PlayerId;
    isDefendable: boolean;
    damage?: number;
    sourceAbilityId?: string;
    defenseAbilityId?: string;
    isUltimate?: boolean;
    preDefenseResolved?: boolean;
    bonusDamage?: number;
    extraRoll?: {
        value?: number;
        resolved?: boolean;
    };
    /** 伤害是否已通过 Token 响应结算（避免重复结算） */
    damageResolved?: boolean;
    /** 本次攻击对防御方造成的净掉血累计值（用于 postDamage/onHit 与 lastResolvedAttackDamage） */
    resolvedDamage?: number;
    /** 攻击方骰面计数快照（用于 postDamage 阶段的连击判定，因为防御阶段会重置骰子） */
    attackDiceFaceCounts?: Record<string, number>;
    /** 攻击掷骰阶段结束时的 Token 选择是否已完成（暴击/精准） */
    offensiveRollEndTokenResolved?: boolean;
}

// ============================================================================
// 卡牌交互系统类型（已废弃 - 迁移到 InteractionSystem）
// ============================================================================
// 注意：以下类型已废弃，保留仅用于测试兼容性
// 新代码应使用 src/games/dicethrone/domain/interactions/ 中的工厂函数

/** 交互类型（已废弃） */
export type CardInteractionType =
    | 'selectDie'
    | 'modifyDie'
    | 'selectPlayer'
    | 'selectStatus'
    | 'selectTargetStatus';

/** 待处理的卡牌交互（已废弃） */
export interface PendingInteraction {
    id: string;
    playerId: PlayerId;
    sourceCardId: string;
    type: CardInteractionType;
    titleKey: string;
    selectCount: number;
    selected: string[];
    targetPlayerIds?: PlayerId[];
    dieModifyConfig?: {
        mode: 'set' | 'adjust' | 'copy' | 'any';
        targetValue?: number;
        adjustRange?: { min: number; max: number };
    };
    transferConfig?: {
        sourcePlayerId?: PlayerId;
        statusId?: string;
    };
    tokenGrantConfig?: {
        tokenId: string;
        amount: number;
    };
    tokenGrantConfigs?: Array<{
        tokenId: string;
        amount: number;
    }>;
    targetOpponentDice?: boolean;
}


/**
 * 伤害护盾
 * 可抵消即将受到的伤害，下次受伤后清空
 */
export interface DamageShield {
    /** 护盾值 */
    value: number;
    /** 来源（卡牌/技能 ID，用于 UI/日志） */
    sourceId?: string;
    /** 是否用于防止本次攻击的状态效果 */
    preventStatus?: boolean;
}

// ============================================================================
// Token 响应窗口类型
// ============================================================================

/**
 * 待处理的伤害（等待 Token 响应）
 */
export interface PendingDamage {
    /** 唯一 ID */
    id: string;
    /** 伤害来源玩家 */
    sourcePlayerId: PlayerId;
    /** 伤害目标玩家 */
    targetPlayerId: PlayerId;
    /** 原始伤害值 */
    originalDamage: number;
    /** 当前伤害值（经过 Token 修改后） */
    currentDamage: number;
    /** 来源技能 ID */
    sourceAbilityId?: string;
    /** 响应窗口类型 */
    responseType: 'beforeDamageDealt' | 'beforeDamageReceived';
    /** 当前响应者 ID */
    responderId: PlayerId;
    /** 是否已经完全闪避（伤害变为 0） */
    isFullyEvaded?: boolean;
    /** 最后一次闪避投骰结果（用于 UI 展示） */
    lastEvasionRoll?: {
        value: number;
        success: boolean;
    };
    /** 伤害修改记录（用于 ActionLog 展示） */
    modifiers?: Array<{
        type: 'defense' | 'token' | 'shield' | 'status';
        value: number;
        sourceId?: string;
        sourceName?: string;
    }>;
}

/**
 * Token 响应窗口阶段
 * - attackerBoost: 攻击方使用太极加伤
 * - defenderMitigation: 防御方使用太极减伤/闪避
 */
export type TokenResponsePhase = 'attackerBoost' | 'defenderMitigation';

// ============================================================================
// 奖励骰重掷系统类型
// ============================================================================

/**
 * 单颗奖励骰信息
 */
export interface BonusDieInfo {
    /** 骰子索引（0-based） */
    index: number;
    /** 当前点数 */
    value: number;
    /** 骰面符号 */
    face: DieFace;
    /** 效果描述 i18n key（用于 displayOnly 展示） */
    effectKey?: string;
}

/**
 * 待结算的奖励骰（等待重掷交互）
 * 用于雷霆万钧/风暴突袭的延后结算
 */
export interface PendingBonusDiceSettlement {
    /** 唯一 ID */
    id: string;
    /** 来源技能 ID */
    sourceAbilityId: string;
    /** 攻击者玩家 ID */
    attackerId: PlayerId;
    /** 目标玩家 ID */
    targetId: PlayerId;
    /** 奖励骰列表 */
    dice: BonusDieInfo[];
    /** 重掷消耗的 Token ID（如 'taiji'） */
    rerollCostTokenId: string;
    /** 每次重掷消耗的 Token 数量 */
    rerollCostAmount: number;
    /** 已用重掷次数（无上限，消耗 Token 即可） */
    rerollCount: number;
    /** 最大可重掷次数（不填表示无限制） */
    maxRerollCount?: number;
    /** 重掷特写文案 key（用于 UI） */
    rerollEffectKey?: string;
    /** 结算阈值（如 12，用于判断是否触发额外效果） */
    threshold?: number;
    /** 达到阈值时的额外效果（如施加倒地） */
    thresholdEffect?: 'knockdown';
    /** 是否已完成重掷交互（准备结算） */
    readyToSettle: boolean;
    /** 仅用于展示多骰结果（不触发伤害/状态结算） */
    displayOnly?: boolean;
    /** 是否显示总伤害（默认重投模式下为 true，displayOnly 下为 false） */
    showTotal?: boolean;
}

export interface HeroState {
    id: string;
    characterId: CharacterId;
    /**
     * 选角阶段的"初始牌库顺序"（仅用于保证回放确定性）
     * - 由 `SELECT_CHARACTER` 产生的 `CHARACTER_SELECTED.initialDeckCardIds` 写入
     * - `HERO_INITIALIZED` 时会消费该顺序来构建 `hand/deck`
     * - 完成初始化后会被清理（因为真实牌库已存入 deck/hand）
     */
    initialDeckCardIds?: string[];
    /** 资源池（hp, cp 等） */
    resources: ResourcePool;
    hand: AbilityCard[];
    deck: AbilityCard[];
    discard: AbilityCard[];
    /** 被动状态效果（如击倒） */
    statusEffects: Record<string, number>;
    /** 可消耗道具（太极、闪避、净化） */
    tokens: TokenState;
    /** Token 堆叠上限（可被技能永久提高，如莲花掌） */
    tokenStackLimits: Record<string, number>;
    /** 伤害护盾（下次受伤时消耗） */
    damageShields: DamageShield[];
    abilities: AbilityDef[];
    abilityLevels: Record<string, number>;
    /** 已覆盖在技能上的升级卡信息（用于 II->III 差价计算 / 未来 UI 展示） */
    upgradeCardByAbilityId: Record<string, { cardId: string; cpCost: number }>;
    /** 被动能力列表（如教皇税：花费 CP 重掷/抽牌） */
    passiveAbilities?: PassiveAbilityDef[];
}

// ============================================================================
// 核心状态
// ============================================================================

/**
 * DiceThrone 核心状态（领域层）
 */
export interface DiceThroneCore {
    players: Record<PlayerId, HeroState>;
    /** 玩家选角状态（未选时为 unselected） */
    selectedCharacters: Record<PlayerId, CharacterId>;
    /** 玩家准备状态（选角后点击准备） */
    readyPlayers: Record<PlayerId, boolean>;
    /** 房主玩家 ID（默认首位玩家） */
    hostPlayerId: PlayerId;
    /** 房主是否已点击开始 */
    hostStarted: boolean;
    dice: Die[];
    rollCount: number;
    rollLimit: number;
    rollDiceCount: number;
    rollConfirmed: boolean;
    activePlayerId: PlayerId;
    startingPlayerId: PlayerId;
    turnNumber: number;
    pendingAttack: PendingAttack | null;
    /** Token 定义（包含状态效果和可消耗道具） */
    tokenDefinitions: TokenDef[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    lastSoldCardId?: string;
    /** 待处理的伤害（等待 Token 响应） */
    pendingDamage?: PendingDamage;
    /** 待结算的奖励骰（等待重掷交互） */
    pendingBonusDiceSettlement?: PendingBonusDiceSettlement;
    /**
     * 最近一次攻击结算的实际伤害值
     * 由 ATTACK_RESOLVED 写入，TURN_CHANGED / ATTACK_INITIATED 时清除
     * 用于 card-dizzy 等需要"造成至少 N 伤害"条件的卡牌
     */
    lastResolvedAttackDamage?: number;
    /**
     * 额外攻击进行中标志（晕眩 daze 触发）
     * 当攻击方有 daze 时，攻击结算后对手获得一次额外攻击机会
     * 此标志在额外攻击的 offensiveRoll 开始时设置，在进入 main2 时清除并恢复原活跃玩家
     */
    extraAttackInProgress?: {
        /** 额外攻击的发起者（即原攻击的防御方） */
        attackerId: PlayerId;
        /** 原回合的活跃玩家（额外攻击结束后恢复） */
        originalActivePlayerId: PlayerId;
    };
    /**
     * 潜行获得回合追踪
     * key: playerId, value: 获得潜行时的 turnNumber
     * 用于"经过一个完整的自己回合后，回合末自动弃除"逻辑
     * TOKEN_GRANTED 时写入，TOKEN_CONSUMED/潜行自动弃除时清除
     */
    sneakGainedTurn?: Record<PlayerId, number>;
}

// ============================================================================
// 常量
// ============================================================================

export const INITIAL_HEALTH = 50;
export const INITIAL_CP = 2; // 规则：起始 CP 为 2（1v1）
export const CP_MAX = 15;
export const HAND_LIMIT = 6;

export const PHASE_ORDER: TurnPhase[] = [
    'setup',
    'upkeep',
    'income',
    'main1',
    'offensiveRoll',
    'defensiveRoll',
    'main2',
    'discard',
];
