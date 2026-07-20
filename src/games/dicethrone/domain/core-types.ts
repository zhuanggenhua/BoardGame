/**
 * DiceThrone 核心类型定义
 * 基础类型、状态接口和常量
 */

import type { PlayerId } from '../../../engine/types';
import type { AiSeatController } from '../../../engine/ai/types';
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
    | 'targetingRoll'
    | 'defensiveRoll'
    | 'main2'
    | 'discard';

export type DieFace =
    | 'fist'
    | 'palm'
    | 'taiji'
    | 'lotus'
    | 'katana'
    | 'sword'
    | 'helm'
    | 'heart'
    | 'pray'
    | 'rising_sun'
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
    | 'shadow'
    | 'bullet'
    | 'dash'
    | 'bullseye'
    | 'branch'
    | 'leaf'
    | 'spirit'
    | 'ninja_katana'
    | 'shuriken'
    | 'mask'
    | 'sabre'
    | 'banner'
    | 'medal'
    | 'cutlass'
    | 'loot'
    | 'skull'
    | 'wrench'
    | 'gear'
    | 'electricity';

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
    'gunslinger',
    'samurai',
    'treant',
    'ninja',
    'zhanshujia',
    'cursed_pirate',
    'artificer',
] as const;

export type SelectableCharacterId = (typeof IMPLEMENTED_DICETHRONE_CHARACTER_IDS)[number];
export type CharacterId = 'unselected' | SelectableCharacterId;
export type TeamId = 'A' | 'B';

export interface CharacterDefinition {
    id: SelectableCharacterId;
    nameKey: string;
    badges?: import('../../../core/ui').CharacterBadgeDef[];
}

export const DICETHRONE_CHARACTER_CATALOG: CharacterDefinition[] = [
    { id: 'monk', nameKey: 'characters.monk' },
    { id: 'barbarian', nameKey: 'characters.barbarian' },
    { id: 'pyromancer', nameKey: 'characters.pyromancer' },
    { id: 'shadow_thief', nameKey: 'characters.shadow_thief' },
    { id: 'moon_elf', nameKey: 'characters.moon_elf' },
    { id: 'paladin', nameKey: 'characters.paladin' },
    { id: 'gunslinger', nameKey: 'characters.gunslinger' },
    { id: 'samurai', nameKey: 'characters.samurai' },
    { id: 'treant', nameKey: 'characters.treant' },
    { id: 'ninja', nameKey: 'characters.ninja' },
    { id: 'zhanshujia', nameKey: 'characters.zhanshujia' },
    { id: 'cursed_pirate', nameKey: 'characters.cursed_pirate' },
    { id: 'artificer', nameKey: 'characters.artificer' },
];

const DICETHRONE_CHARACTER_NAME_KEY_MAP: Record<SelectableCharacterId, string> = Object.fromEntries(
    DICETHRONE_CHARACTER_CATALOG.map((character) => [character.id, character.nameKey]),
) as Record<SelectableCharacterId, string>;

export function getDiceThroneCharacterNameKey(
    characterId: CharacterId | SelectableCharacterId | null | undefined,
): string | null {
    if (!characterId || characterId === 'unselected') {
        return null;
    }
    return DICETHRONE_CHARACTER_NAME_KEY_MAP[characterId] ?? null;
}

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
    /** 当前骰子的归属玩家。常规骰池不填；特殊对掷骰用于 UI 与交互区分双方骰子。 */
    ownerId?: PlayerId;
    /** 只用于展示，不参与当前玩家可重掷/锁定的普通投掷池。 */
    displayOnly?: boolean;
}

/**
 * 卡牌打出条件
 * 用于限制卡牌在特定情况下才能打出
 */
export interface CardPlayCondition {
    /** 必须在指定阶段（更细粒度，区分进攻/防御） */
    phase?: 'offensiveRoll' | 'targetingRoll' | 'defensiveRoll';
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
    /** 必须消耗装填指示物（Loaded） */
    requireLoaded?: boolean;
    /** 场上任意玩家必须有至少 1 个状态效果或 token（用于状态移除/转移类卡牌） */
    requireAnyStatusOnBoard?: boolean;
    /** 必须存在待结算伤害，并满足指定的伤害响应角色/时机 */
    pendingDamage?: {
        role?: 'source' | 'target' | 'responder';
        responseType?: 'beforeDamageDealt' | 'beforeDamageReceived';
    };
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
    /** 源图中的 slot/index，仅用于调试、审计和作弊发牌；不等于正式运行时预览资源。 */
    sourceAtlasIndex?: number;
    /** 卡牌效果列表（行动卡的即时效果，或升级卡的 replaceAbility 效果） */
    effects?: AbilityEffect[];
    /** 卡牌打出的额外条件 */
    playCondition?: CardPlayCondition;
    /** 多语言文案（单一数据源，支持任意语言 key） */
    i18n?: Record<string, CardI18n>;
    /** 是否为攻击修正卡（投掷阶段打出，修改攻击伤害的卡）。UI 用此标记显示"已激活修正"指示器 */
    isAttackModifier?: boolean;
}

export type PendingAttackSettlementStage =
    | 'targeting'
    | 'preDamage'
    | 'withDamageChoicePending'
    | 'postDamagePending'
    | 'readyToResolve';

export interface PendingAttack {
    attackerId: PlayerId;
    defenderId?: PlayerId;
    /**
     * 共享攻击结算的单一阶段真相源。
     * 旧布尔位保留为兼容迁移字段，但共享 flow 应优先依据该阶段推进。
     */
    settlementStage?: PendingAttackSettlementStage;
    /** 2v2 目标掷骰 5/6 分支等待玩家确认目标时为 true */
    targetingSelectionPending?: boolean;
    targetingSelectionResolved?: boolean;
    isDefendable: boolean;
    damage?: number;
    sourceAbilityId?: string;
    defenseAbilityId?: string;
    isUltimate?: boolean;
    preDefenseResolved?: boolean;
    defenseResolved?: boolean;
    bonusDamage?: number;
    /** 仅来自攻击修正卡的额外伤害，用于右上角攻击修正 UI，避免混入暴击等其他来源 */
    attackModifierBonusDamage?: number;
    /**
     * 在 2v2 targetingRoll 的手选目标窗口内提前打出的攻击修正卡。
     * 这些卡会在主攻击 defenderId 最终确定后按出牌顺序补结算，避免额外弹出二次选人交互。
     */
    deferredAttackModifierCardIds?: string[];
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
    /** 攻击方骰子点数快照（用于 2/3/4/5-of-a-kind 的“相同数字”判定） */
    attackDiceValues?: number[];
    /** 枪手“对决”中攻击方那颗对掷骰，防御方确认前先展示在右侧骰盘。 */
    duelAttackerDieValue?: number;
    /** 攻击掷骰阶段结束时的 Token 选择是否已完成（暴击/精准） */
    offensiveRollEndTokenResolved?: boolean;
    /** 攻击掷骰阶段结束时已经使用过的 Token，允许暴击和精准在同一次攻击中连续使用。 */
    offensiveRollEndTokenIdsUsed?: string[];
    /** 致盲判定是否已确认，避免奖励骰确认后自动续跑时重复掷致盲骰。 */
    blindedCheckResolved?: boolean;
    /** 致盲判定最终是否让攻击失败。 */
    blindedCheckMissed?: boolean;
    /** 攻击链内的后续选择结果（例如工匠扳手攻击的追加分支），用于交互后恢复同一条攻击。 */
    followUpChoiceBySourceAbilityId?: Record<string, string>;
    /** 树精神圣防止即将受到的负面状态的可选响应决定。 */
    treantDivinePreventDebuffChoice?: 'prevent' | 'skip';
    /** 等本次伤害响应窗口消耗指定 token 后再授予的 token。 */
    deferredTokenGrants?: PendingDamage['deferredTokenGrants'];
    /**
     * Loaded 奖励骰的临时加成（由攻击修正卡在本次攻击内挂载）
     * 例：Wild West 在你花费 Loaded 时允许重掷一次，并在奖励骰收口后追加 +1。
     */
    loadedBonusDieBoost?: {
        allowReroll?: boolean;
        postSettleBonusDamageAdds?: Array<{ amount: number; sourceCardId?: string }>;
    };
    /** 奖励骰是否已通过 BONUS_DICE_SETTLED 结算（避免 autoContinue 重入时重复执行 resolveAttack） */
    bonusDiceResolved?: boolean;
    /**
     * withDamage 中的非伤害选择已完成。
     * 例：武僧“连段冲拳②”奖励骰掷出莲花后先选净化/闪避，再继续结算同一技能的基础伤害。
     */
    withDamageChoiceResolved?: boolean;
    /**
     * 主伤害已在攻击中途落地，且 postDamage/withDamage 内挂起的后续选择也已完成。
     * 后续只需要生成 ATTACK_RESOLVED 收口，不应再次重放整段攻击或二次造成伤害。
     */
    postDamageFollowUpResolved?: boolean;
}

// ============================================================================
// 卡牌交互系统类型
// ============================================================================
// 注意：这些类型用于 DiceThrone 的自定义交互系统（直接点击交互）
// 不同于引擎层的 InteractionSystem（选择 + 确认按钮交互）

/** 交互类型 */
export type CardInteractionType =
    | 'selectDie'
    | 'modifyDie'
    | 'selectPlayer'
    | 'selectStatus'
    | 'selectTargetStatus'
    | 'selectHandCard';

/** 待处理的卡牌交互 */
export interface InteractionDescriptor {
    id: string;
    playerId: PlayerId;
    sourceCardId: string;
    type: CardInteractionType;
    titleKey: string;
    selectCount: number;
    /** 最少需要选择的数量；未设置时表示至少 1 个目标即可确认。 */
    minSelectCount?: number;
    selected: string[];
    /** 为 true 时，重掷骰子不触发技能重选（用于保留已选攻击） */
    skipAbilityReselection?: boolean;
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
    statusGrantConfig?: {
        statusId: string;
        amount: number;
    };
    statusGrantConfigs?: Array<{
        statusId: string;
        amount: number;
    }>;
    /** 选定玩家后继续执行的 custom action（用于 2v2 下的定向卡牌效果） */
    resolveCustomActionId?: string;
    /** 当前被操作的骰池归属玩家 */
    diceOwnerId?: PlayerId;
    targetOpponentDice?: boolean;
    /** multistep 骰子交互允许操作的骰子 ID 列表 */
    allowedDieIds?: number[];
    /** multistep 骰子交互已完成的骰子 ID（用于去重与校验） */
    completedDieIds?: number[];
    /** 为 true 时，UI 只允许选择已有状态效果/token 的玩家（如"移除所有状态"） */
    requiresTargetWithStatus?: boolean;
    /**
     * 攻击结算中途挂起的交互完成后，应恢复当前攻击收口。
     * 只用于技能效果链内的后续交互（如回血后清状态），不得用于选择攻击目标或防御选择。
     */
    resumeAttackSettlementOnComplete?: {
        stage: PendingAttackSettlementStage;
    };
}

/** @deprecated 使用 InteractionDescriptor 代替 */
export type PendingInteraction = InteractionDescriptor;

export interface DefenderChoiceOption {
    playerId: PlayerId;
    customId: string;
    disabled?: boolean;
}

/**
 * 4 人 / 2v2 targetingRoll 的专用受击者选择。
 * 仅表达“为当前 pendingAttack 选 defender”，不复用 simple-choice/selectPlayer 语义。
 */
export interface PendingDefenderChoice {
    attackerId: PlayerId;
    chooserPlayerId: PlayerId;
    sourceAbilityId: string;
    titleKey: string;
    targetRollValue: number;
    options: DefenderChoiceOption[];
    allowedCommands?: string[];
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
    /** 百分比减伤（0-100），与固定值护盾互斥） */
    reductionPercent?: number;
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
    /** 伤害范围（attack=攻击伤害，direct=直接伤害） */
    damageScope?: 'attack' | 'direct';
    /** 是否为不可防御伤害（只跳过防御技能；终极伤害另行封锁降低/回避） */
    unblockable?: boolean;
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
    /** 当前响应窗口内各 token 已累计消耗的数量 */
    tokenUsageTotals?: Record<string, number>;
    /** 需要等响应窗口收口后再发出的附加伤害（如武士反击） */
    deferredDamageEvents?: Array<{
        targetId: PlayerId;
        amount: number;
        actualDamage: number;
        sourceAbilityId?: string;
        sourcePlayerId?: PlayerId;
        damageScope?: 'attack' | 'direct';
        unblockable?: boolean;
        sourceCommandType?: string;
    }>;
    /** 需要等本响应窗口消耗指定 token 后再授予的 token。 */
    deferredTokenGrants?: Array<{
        triggerTokenId: string;
        targetId: PlayerId;
        tokenId: string;
        amount: number;
        sourceAbilityId?: string;
        sourceCommandType?: string;
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
    /** 效果描述参数（例如 {{value}}） */
    effectParams?: Record<string, string | number>;
    /** 展示语义：默认是真实投骰；choice 表示玩家固定选择的结果，不播放投骰误导 */
    presentationKind?: 'roll' | 'choice';
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
    /** 最近一次被重掷的奖励骰索引，用于记录本次结算的最后一次重掷目标 */
    lastRerolledDieIndex?: number;
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
    /** displayOnly 多骰时的汇总说明 key */
    summaryEffectKey?: string;
    /** displayOnly 多骰时的汇总说明参数 */
    summaryEffectParams?: Record<string, string | number>;
    /** 结算模式：默认直接造成伤害；attackBonus 表示把结果加入当前攻击的 bonusDamage */
    resolutionMode?: 'damage' | 'attackBonus' | 'none';
    /** attackBonus 模式下的换算规则 */
    attackBonusScale?: 'raw' | 'halfUp';
    /**
     * attackBonus 结算写入 bonusDamage 时，是否同时计入“攻击修正卡加伤汇总”。
     * - 不填：只写入 pendingAttack.bonusDamage，不计入 attackModifierBonusDamage（适用于 token 触发的奖励骰，如装填 Loaded）
     * - 填入 cardId：除写入 pendingAttack.bonusDamage 外，也计入 attackModifierBonusDamage（适用于攻击修正卡本体）
     */
    attackBonusSourceCardId?: string;
    /**
     * 结算收口后需要追加的 bonus damage 事件（用于“先掷骰/可重掷 → 然后额外加伤”的两段式卡牌）。
     * 例：Wild West（荒野西部）在 Loaded 奖励骰确定后再额外 +1。
     */
    postSettleBonusDamageAdds?: Array<{ amount: number; sourceCardId?: string }>;
    /** 自定义奖励骰收口处理器 ID（用于非“点数总和即伤害”的特殊结算） */
    customResolutionId?: string;
    /** 允许普通改骰牌修改这组奖励骰，并在确认结算时读取改后的结果 */
    allowDiceModification?: boolean;
    /**
     * 当前奖励骰结果是否应打开 afterRollConfirmed 响应窗口。
     * 仅用于“投出特定结果才触发效果”的奖励骰；像一掷千金这种任意结果都会结算数值的奖励骰不打开响应窗口。
     */
    opensAfterRollConfirmedResponseWindow?: boolean;
}

export interface HeroState {
    id: string;
    characterId: CharacterId;
    /**
     * 部分英雄存在双面玩家板。咒缚海盗运行时已接入 normal / cursed 两张底图，
     * 当前已用于主棋盘选图、攻击特写裁切、能力集切换，以及“海盗的一生”等按面板分支的效果。
     */
    playerBoardFace?: 'normal' | 'cursed';
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
    /** Token 堆叠上限（可被技能永久提高，如花开见佛） */
    tokenStackLimits: Record<string, number>;
    /**
     * 工匠机器人状态。
     * built: 是否已建造该机器人
     * upgraded: 是否已升级为高级
     * activationsUsedThisTurn: 本回合已激活次数
     */
    artificerBotState?: Partial<Record<string, {
        built: boolean;
        upgraded: boolean;
        activationsUsedThisTurn: number;
    }>>;
    /** 伤害护盾（下次受伤时消耗） */
    damageShields: DamageShield[];
    abilities: AbilityDef[];
    abilityLevels: Record<string, number>;
    /** 已覆盖在技能上的升级卡信息（用于 II->III 差价计算 / 未来 UI 展示） */
    upgradeCardByAbilityId: Record<string, { cardId: string; cpCost: number }>;
    /** 被动能力列表（如教皇税：花费 CP 重掷/抽牌） */
    passiveAbilities?: PassiveAbilityDef[];
    /** 待处理的攻击修正卡伤害（在 pendingAttack 创建前累积，创建时转移到 pendingAttack.attackModifierBonusDamage） */
    pendingBonusDamage?: number;
}

export type SeatControllerKind = AiSeatController;

export interface PendingSeatSwapRequest {
    requesterId: PlayerId;
    targetPlayerId: PlayerId;
}

// ============================================================================
// 核心状态
// ============================================================================

/**
 * DiceThrone 核心状态（领域层）
 */
export interface DiceThroneCore {
    players: Record<PlayerId, HeroState>;
    /** 2v2 模式下的环桌座位顺序，用于分队与回合顺序推导 */
    seatingOrder?: PlayerId[];
    /** 座位控制信息：仅区分真人 / AI，用于准备阶段换位流程 */
    seatControllers?: Record<PlayerId, SeatControllerKind>;
    /** 待处理的换位申请（仅真人目标需要审批） */
    seatSwapRequest?: PendingSeatSwapRequest;
    /** 2v2 模式下按座位推导后的队伍归属 */
    teamIdByPlayerId?: Record<PlayerId, TeamId>;
    /** 2v2 模式下的共享体力；同队成员 HP 需要与该值保持同步 */
    teamHealth?: Record<TeamId, number>;
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
    currentChoiceSourceAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    lastSoldCardId?: string;
    /** 待处理的伤害（等待 Token 响应） */
    pendingDamage?: PendingDamage;
    /** 待结算的奖励骰（等待重掷交互） */
    pendingBonusDiceSettlement?: PendingBonusDiceSettlement;
    /**
     * 骰面确认序号（自增）
     * 用于 afterRollConfirmed 响应窗口源头级去重，避免 CLOSED 后在同一确认源上立刻 reopen。
     */
    rollConfirmedSequence?: number;
    /**
     * 已处理 afterRollConfirmed 响应窗口的确认序号
     * 等于 rollConfirmedSequence 时表示本次确认源已处理。
     */
    afterRollResponseWindowSequence?: number;
    /**
     * 最近一次已处理的 afterRollConfirmed 骰面签名
     * 当确认骰面反复进入相同骰面时，用于防止重复打开响应窗口。
     */
    afterRollResponseWindowSignature?: string;
    /**
     * 打牌序号（自增）
     * 用于 afterCardPlayed 响应窗口源头级去重，避免 CLOSED 后在同一打牌源上立刻 reopen。
     */
    cardPlayedSequence?: number;
    /**
     * 已处理 afterCardPlayed 响应窗口的打牌序号
     * 等于 cardPlayedSequence 时表示本次打牌源已处理。
     */
    afterCardResponseWindowSequence?: number;
    /**
     * 最近一次攻击结算的实际伤害值
     * 由 ATTACK_RESOLVED 写入，TURN_CHANGED / ATTACK_INITIATED 时清除
     * 用于 card-dizzy 等需要"造成至少 N 伤害"条件的卡牌
     */
    lastResolvedAttackDamage?: number;
    /**
     * 攻击结算序号（自增）
     * 用于 afterAttackResolved 响应窗口去重，避免 autoContinue 重入反复弹窗
     */
    attackResolvedSequence?: number;
    /**
     * 已处理 afterAttackResolved 响应窗口的攻击序号
     * 等于 attackResolvedSequence 时表示该次攻击的响应窗口已处理
     */
    afterAttackResponseWindowSequence?: number;
    /**
     * 额外攻击进行中标志（晕眩 daze 触发）
     * 当防御方带有 daze 时，攻击结算后当前攻击者立即再次攻击
     * 此标志在额外攻击的 offensiveRoll 开始时设置，在进入 main2 时清除并恢复原活跃玩家
     */
    extraAttackInProgress?: {
        /** 额外攻击的发起者（即原攻击的攻击方） */
        attackerId: PlayerId;
        /** 原回合的活跃玩家（额外攻击结束后恢复） */
        originalActivePlayerId: PlayerId;
        /** 是否已经真正进入过额外攻击的 offensiveRoll 阶段 */
        phaseEntered?: boolean;
    };
    /**
     * 潜行获得回合追踪
     * key: playerId, value: 获得潜行时的 turnNumber
     * 用于"经过一个完整的自己回合后，回合末自动弃除"逻辑
     * TOKEN_GRANTED 时写入，TOKEN_CONSUMED/潜行自动弃除时清除
     */
    sneakGainedTurn?: Record<PlayerId, number>;
    /**
     * 太极本回合获得量追踪
     * key: playerId, value: 本回合获得的太极数量
     * 用于限制"本回合获得的太极不能在攻击方加伤时使用"
     * TOKEN_GRANTED 时累加（仅 TAIJI），TURN_CHANGED 时清除
     */
    taijiGainedThisTurn?: Record<PlayerId, number>;
    /**
     * 当前回合常规 offensiveRoll 阶段的实际掷骰次数快照。
     * 仅记录从 main1 进入的那次 offensiveRoll，用于武士道（Bushido）在回合末判定。
     * 额外攻击产生的 offensiveRoll 不覆盖该值。
     */
    offensiveRollAttemptsThisTurn?: number;
    /**
     * 本回合哪些玩家已在 offensiveRoll 发起过攻击。
     * 用于咒缚海盗“对手未造成一次攻击则施加火药桶”的阶段末判定。
     */
    offensiveRollAttackMadeThisTurn?: Record<PlayerId, true>;
    /**
     * 树精树灵主动效果每回合每种限用一次。
     * key: playerId -> tokenId -> true。
     */
    treantSpiritSpentThisTurn?: Record<PlayerId, Record<string, true>>;
}

// ============================================================================
// 常量
// ============================================================================

export const INITIAL_HEALTH = 50;
export const MAX_HEALTH = 60; // 规则：玩家可以治疗到超过初始生命值最多 10 点
export const INITIAL_CP = 2; // 规则：起始 CP 为 2（1v1）
export const CP_MAX = 15;
export const HAND_LIMIT = 6;

export const PHASE_ORDER: TurnPhase[] = [
    'setup',
    'upkeep',
    'income',
    'main1',
    'offensiveRoll',
    'targetingRoll',
    'defensiveRoll',
    'main2',
    'discard',
];
