/**
 * DiceThrone 领域类型定义
 * 包含核心状态、命令和事件类型
 */

import type { Command, GameEvent, PlayerId, ResponseWindowType } from '../../../engine/types';
import type { CardPreviewRef } from '../../../systems/CardSystem';
import type { AbilityDef, AbilityEffect } from '../../../systems/presets/combat';
import type { ResourcePool } from '../../../systems/ResourceSystem/types';
import type { TokenDef, TokenState } from '../../../systems/TokenSystem';
import type { PayToRemoveKnockdownCommandType } from './ids';

// ============================================================================
// 基础类型（从 types.ts 迁移）
// ============================================================================

export type TurnPhase =
    | 'setup'
    | 'upkeep'
    | 'income'
    | 'main1'
    | 'offensiveRoll'
    | 'defensiveRoll'
    | 'main2'
    | 'discard';

export type DieFace = 'fist' | 'palm' | 'taiji' | 'lotus' | 'sword' | 'heart' | 'strength';

// ============================================================================
// 角色编目
// ============================================================================

export type CharacterId = 'unselected' | 'monk' | 'barbarian' | 'pyromancer' | 'shadow_thief' | 'moon_elf' | 'paladin' | 'ninja' | 'treant' | 'vampire_lord' | 'cursed_pirate' | 'gunslinger' | 'samurai' | 'tactician' | 'huntress' | 'seraph';

export type SelectableCharacterId = Exclude<CharacterId, 'unselected'>;

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
    { id: 'ninja', nameKey: 'characters.ninja' },
    { id: 'treant', nameKey: 'characters.treant' },
    { id: 'vampire_lord', nameKey: 'characters.vampire_lord' },
    { id: 'cursed_pirate', nameKey: 'characters.cursed_pirate' },
    { id: 'gunslinger', nameKey: 'characters.gunslinger' },
    { id: 'samurai', nameKey: 'characters.samurai' },
    { id: 'tactician', nameKey: 'characters.tactician' },
    { id: 'huntress', nameKey: 'characters.huntress' },
    { id: 'seraph', nameKey: 'characters.seraph' },
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
}

// ============================================================================
// 卡牌交互系统类型
// ============================================================================

/** 交互类型 */
export type CardInteractionType =
    | 'selectDie'           // 选择骰子
    | 'modifyDie'           // 修改骰子数值
    | 'selectPlayer'        // 选择玩家
    | 'selectStatus'        // 选择状态效果
    | 'selectTargetStatus'; // 选择目标玩家的状态效果（转移用）

/** 待处理的卡牌交互 */
export interface PendingInteraction {
    /** 交互 ID */
    id: string;
    /** 执行交互的玩家 */
    playerId: PlayerId;
    /** 来源卡牌 ID */
    sourceCardId: string;
    /** 交互类型 */
    type: CardInteractionType;
    /** 提示文本 key */
    titleKey: string;
    /** 需要选择的数量 */
    selectCount: number;
    /** 已选择的项目 */
    selected: string[];
    /** 可选择的目标玩家 ID 列表（用于 selectPlayer/selectStatus） */
    targetPlayerIds?: PlayerId[];
    /** 骰子修改配置 */
    dieModifyConfig?: {
        /** 修改模式: set=设置为指定值, adjust=增减, copy=复制另一颗, any=任意修改 */
        mode: 'set' | 'adjust' | 'copy' | 'any';
        /** 设置的目标值（mode=set） */
        targetValue?: number;
        /** 调整范围（mode=adjust） */
        adjustRange?: { min: number; max: number };
    };
    /** 状态转移配置（用于 transfer） */
    transferConfig?: {
        /** 已选择的源玩家 */
        sourcePlayerId?: PlayerId;
        /** 已选择的状态 ID */
        statusId?: string;
    };
    /** 是否针对对手的骰子（card-give-hand） */
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
    sourceId: string;
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
}

export interface HeroState {
    id: string;
    characterId: CharacterId;
    /**
     * 选角阶段的“初始牌库顺序”（仅用于保证回放确定性）
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
    turnPhase: TurnPhase;
    activePlayerId: PlayerId;
    startingPlayerId: PlayerId;
    turnNumber: number;
    pendingAttack: PendingAttack | null;
    /** Token 定义（包含状态效果和可消耗道具） */
    tokenDefinitions: TokenDef[];
    activatingAbilityId?: string;
    lastEffectSourceByPlayerId?: Record<PlayerId, string | undefined>;
    lastSoldCardId?: string;
    /** 最后一次额外骰子投掷结果（用于 UI 展示） */
    lastBonusDieRoll?: {
        value: number;
        face: DieFace;
        playerId: PlayerId;
        /** 效果目标玩家（若与 playerId 不同，则双方都显示特写） */
        targetPlayerId?: PlayerId;
        timestamp: number;
        /** 可选的自定义效果描述 key */
        effectKey?: string;
        /** 效果描述的插值参数 */
        effectParams?: Record<string, string | number>;
    };
    /** 待处理的卡牌交互 */
    pendingInteraction?: PendingInteraction;
    /** 待处理的伤害（等待 Token 响应） */
    pendingDamage?: PendingDamage;
    /** 待结算的奖励骰（等待重掷交互） */
    pendingBonusDiceSettlement?: PendingBonusDiceSettlement;
    /** 待展示的卡牌特写（等待交互完成或确认无交互后触发） */
    pendingCardSpotlight?: {
        /** 卡牌 ID */
        cardId: string;
        /** 打出卡牌的玩家 ID */
        playerId: PlayerId;
        /** 卡牌预览引用（用于渲染） */
        previewRef?: CardPreviewRef;
        /** 时间戳（用于区分多次打出） */
        timestamp: number;
    };
    /** 最后一次打出的卡牌（用于其他玩家的特写展示） */
    lastPlayedCard?: {
        /** 卡牌 ID */
        cardId: string;
        /** 打出卡牌的玩家 ID */
        playerId: PlayerId;
        /** 卡牌预览引用（用于渲染） */
        previewRef?: CardPreviewRef;
        /** 触发时间戳 */
        timestamp: number;
    };
}
// 命令定义
// ============================================================================

/** 掷骰命令 */
export interface RollDiceCommand extends Command<'ROLL_DICE'> {
    payload: Record<string, never>;
}

/** 锁定/解锁骰子命令 */
export interface ToggleDieLockCommand extends Command<'TOGGLE_DIE_LOCK'> {
    payload: {
        dieId: number;
    };
}

/** 确认骰子结果命令 */
export interface ConfirmRollCommand extends Command<'CONFIRM_ROLL'> {
    payload: Record<string, never>;
}

/** 选择技能命令 */
export interface SelectAbilityCommand extends Command<'SELECT_ABILITY'> {
    payload: {
        abilityId: string;
    };
}

/** 抽牌命令 */
export interface DrawCardCommand extends Command<'DRAW_CARD'> {
    payload: Record<string, never>;
}

/** 弃牌命令 */
export interface DiscardCardCommand extends Command<'DISCARD_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 售卖卡牌命令 */
export interface SellCardCommand extends Command<'SELL_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 撤回售卖命令 */
export interface UndoSellCardCommand extends Command<'UNDO_SELL_CARD'> {
    payload: Record<string, never>;
}

/** 重排卡牌到末尾命令 */
export interface ReorderCardToEndCommand extends Command<'REORDER_CARD_TO_END'> {
    payload: {
        cardId: string;
    };
}

/** 打出卡牌命令 */
export interface PlayCardCommand extends Command<'PLAY_CARD'> {
    payload: {
        cardId: string;
    };
}

/** 打出升级卡命令 */
export interface PlayUpgradeCardCommand extends Command<'PLAY_UPGRADE_CARD'> {
    payload: {
        cardId: string;
        targetAbilityId: string;
    };
}

/** 解决选择命令 */
export interface ResolveChoiceCommand extends Command<'RESOLVE_CHOICE'> {
    payload: {
        statusId: string;
    };
}

/** 推进阶段命令 */
export interface AdvancePhaseCommand extends Command<'ADVANCE_PHASE'> {
    payload: Record<string, never>;
}

/** 选择角色命令 */
export interface SelectCharacterCommand extends Command<'SELECT_CHARACTER'> {
    payload: {
        characterId: SelectableCharacterId;
    };
}

/** 房主开始命令 */
export interface HostStartGameCommand extends Command<'HOST_START_GAME'> {
    payload: Record<string, never>;
}

/** 玩家准备命令 */
export interface PlayerReadyCommand extends Command<'PLAYER_READY'> {
    payload: Record<string, never>;
}

/** 跳过响应窗口命令 */
export interface ResponsePassCommand extends Command<'RESPONSE_PASS'> {
    payload: Record<string, never>;
}

/** 修改骰子命令 */
export interface ModifyDieCommand extends Command<'MODIFY_DIE'> {
    payload: {
        /** 骰子 ID */
        dieId: number;
        /** 新数值 */
        newValue: number;
    };
}

/** 重掷骰子命令 */
export interface RerollDieCommand extends Command<'REROLL_DIE'> {
    payload: {
        /** 骰子 ID */
        dieId: number;
    };
}

/** 移除状态效果命令 */
export interface RemoveStatusCommand extends Command<'REMOVE_STATUS'> {
    payload: {
        /** 目标玩家 ID */
        targetPlayerId: PlayerId;
        /** 状态 ID（可选，不提供则移除所有） */
        statusId?: string;
    };
}

/** 转移状态效果命令 */
export interface TransferStatusCommand extends Command<'TRANSFER_STATUS'> {
    payload: {
        /** 源玩家 ID */
        fromPlayerId: PlayerId;
        /** 目标玩家 ID */
        toPlayerId: PlayerId;
        /** 状态 ID */
        statusId: string;
    };
}

/** 确认交互命令 */
export interface ConfirmInteractionCommand extends Command<'CONFIRM_INTERACTION'> {
    payload: {
        /** 交互 ID */
        interactionId: string;
        /** 选中的骰子 ID 列表（用于 selectDie 类型交互的批量重掷） */
        selectedDiceIds?: number[];
    };
}

/** 取消交互命令 */
export interface CancelInteractionCommand extends Command<'CANCEL_INTERACTION'> {
    payload: Record<string, never>;
}

/** 使用 Token 命令 */
export interface UseTokenCommand extends Command<'USE_TOKEN'> {
    payload: {
        /** Token ID（taiji / evasive） */
        tokenId: string;
        /** 消耗数量（太极可选择数量，闪避固定为 1） */
        amount: number;
    };
}

/** 跳过 Token 响应命令 */
export interface SkipTokenResponseCommand extends Command<'SKIP_TOKEN_RESPONSE'> {
    payload: Record<string, never>;
}

/** 使用净化 Token 命令（独立于伤害流程） */
export interface UsePurifyCommand extends Command<'USE_PURIFY'> {
    payload: {
        /** 要移除的负面状态 ID */
        statusId: string;
    };
}

/** 花费 CP 移除击倒命令 */
export interface PayToRemoveKnockdownCommand extends Command<PayToRemoveKnockdownCommandType> {
    payload: Record<string, never>;
}

/** 重掷奖励骰命令 */
export interface RerollBonusDieCommand extends Command<'REROLL_BONUS_DIE'> {
    payload: {
        /** 要重掷的骰子索引（0-based） */
        dieIndex: number;
    };
}

/** 跳过奖励骰重掷命令 */
export interface SkipBonusDiceRerollCommand extends Command<'SKIP_BONUS_DICE_REROLL'> {
    payload: Record<string, never>;
}

/** 所有 DiceThrone 命令 */
export type DiceThroneCommand =
    | RollDiceCommand
    | ToggleDieLockCommand
    | ConfirmRollCommand
    | SelectAbilityCommand
    | DrawCardCommand
    | DiscardCardCommand
    | SellCardCommand
    | UndoSellCardCommand
    | ReorderCardToEndCommand
    | PlayCardCommand
    | PlayUpgradeCardCommand
    | ResolveChoiceCommand
    | AdvancePhaseCommand
    | SelectCharacterCommand
    | HostStartGameCommand
    | PlayerReadyCommand
    | ResponsePassCommand
    | ModifyDieCommand
    | RerollDieCommand
    | RemoveStatusCommand
    | TransferStatusCommand
    | ConfirmInteractionCommand
    | CancelInteractionCommand
    | UseTokenCommand
    | SkipTokenResponseCommand
    | UsePurifyCommand
    | PayToRemoveKnockdownCommand
    | RerollBonusDieCommand
    | SkipBonusDiceRerollCommand;

// ============================================================================
// 事件定义
// ============================================================================

/** 骰子结果事件 */
export interface DiceRolledEvent extends GameEvent<'DICE_ROLLED'> {
    payload: {
        results: number[];
        rollerId: PlayerId;
    };
}

/** 额外骰子结果事件 */
export interface BonusDieRolledEvent extends GameEvent<'BONUS_DIE_ROLLED'> {
    payload: {
        value: number;
        face: DieFace;
        playerId: PlayerId;
        /** 效果目标玩家（若与 playerId 不同，则双方都显示特写） */
        targetPlayerId?: PlayerId;
        /** 可选的自定义效果描述 key（i18n），用于非骰面效果的特写 */
        effectKey?: string;
        /** 效果描述的插值参数 */
        effectParams?: Record<string, string | number>;
    };
}

/** 骰子锁定事件 */
export interface DieLockToggledEvent extends GameEvent<'DIE_LOCK_TOGGLED'> {
    payload: {
        dieId: number;
        isKept: boolean;
    };
}

/** 骰子确认事件 */
export interface RollConfirmedEvent extends GameEvent<'ROLL_CONFIRMED'> {
    payload: {
        playerId: PlayerId;
    };
}

/** 角色选择事件 */
export interface CharacterSelectedEvent extends GameEvent<'CHARACTER_SELECTED'> {
    payload: {
        playerId: PlayerId;
        characterId: SelectableCharacterId;
        /** 初始牌库（已洗牌） */
        initialDeckCardIds: string[];
    };
}

/** 英雄初始化事件（选角结束进入游戏前） */
export interface HeroInitializedEvent extends GameEvent<'HERO_INITIALIZED'> {
    payload: {
        playerId: PlayerId;
        characterId: SelectableCharacterId;
    };
}

/** 房主开始事件 */
export interface HostStartedEvent extends GameEvent<'HOST_STARTED'> {
    payload: {
        playerId: PlayerId;
    };
}

/** 玩家准备事件 */
export interface PlayerReadyEvent extends GameEvent<'PLAYER_READY'> {
    payload: {
        playerId: PlayerId;
    };
}

// PhaseChangedEvent 已废弃，阶段切换现在由 FlowSystem 的 SYS_PHASE_CHANGED 统一处理
// 参见 src/engine/systems/FlowSystem.ts

/** 技能激活事件 */
export interface AbilityActivatedEvent extends GameEvent<'ABILITY_ACTIVATED'> {
    payload: {
        abilityId: string;
        playerId: PlayerId;
        isDefense?: boolean;
    };
}

/** 伤害事件 */
export interface DamageDealtEvent extends GameEvent<'DAMAGE_DEALT'> {
    payload: {
        targetId: PlayerId;
        amount: number;
        actualDamage: number;
        sourceAbilityId?: string;
    };
}

/** 治疗事件 */
export interface HealAppliedEvent extends GameEvent<'HEAL_APPLIED'> {
    payload: {
        targetId: PlayerId;
        amount: number;
        sourceAbilityId?: string;
    };
}

/** 状态施加事件 */
export interface StatusAppliedEvent extends GameEvent<'STATUS_APPLIED'> {
    payload: {
        targetId: PlayerId;
        statusId: string;
        stacks: number;
        newTotal: number;
        sourceAbilityId?: string;
    };
}

/** 状态移除事件 */
export interface StatusRemovedEvent extends GameEvent<'STATUS_REMOVED'> {
    payload: {
        targetId: PlayerId;
        statusId: string;
        stacks: number;
    };
}

/** Token 授予事件 */
export interface TokenGrantedEvent extends GameEvent<'TOKEN_GRANTED'> {
    payload: {
        targetId: PlayerId;
        tokenId: string;
        amount: number;
        newTotal: number;
        sourceAbilityId?: string;
    };
}

/** Token 消耗事件 */
export interface TokenConsumedEvent extends GameEvent<'TOKEN_CONSUMED'> {
    payload: {
        playerId: PlayerId;
        tokenId: string;
        amount: number;
        newTotal: number;
    };
}

/** Token 堆叠上限变化事件 */
export interface TokenLimitChangedEvent extends GameEvent<'TOKEN_LIMIT_CHANGED'> {
    payload: {
        playerId: PlayerId;
        tokenId: string;
        delta: number;
        newLimit: number;
        sourceAbilityId?: string;
    };
}

/** 护盾授予事件 */
export interface DamageShieldGrantedEvent extends GameEvent<'DAMAGE_SHIELD_GRANTED'> {
    payload: {
        targetId: PlayerId;
        value: number;
        sourceId: string;
    };
}

/** 伤害被护盾阻挡事件 */
export interface DamagePreventedEvent extends GameEvent<'DAMAGE_PREVENTED'> {
    payload: {
        targetId: PlayerId;
        /** 原始伤害 */
        originalDamage: number;
        /** 被护盾抵消的伤害 */
        preventedAmount: number;
        /** 消耗的护盾来源 */
        shieldSourceId: string;
    };
}

/** 抽牌事件 */
export interface CardDrawnEvent extends GameEvent<'CARD_DRAWN'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
    };
}

/** 弃牌事件 */
export interface CardDiscardedEvent extends GameEvent<'CARD_DISCARDED'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
    };
}

/** 售卖卡牌事件 */
export interface CardSoldEvent extends GameEvent<'CARD_SOLD'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
        cpGained: number;
    };
}

/** 撤回售卖事件 */
export interface SellUndoneEvent extends GameEvent<'SELL_UNDONE'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
    };
}

/** 打出卡牌事件 */
export interface CardPlayedEvent extends GameEvent<'CARD_PLAYED'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
        cpCost: number;
    };
}

/** 技能替换事件（升级卡使用） */
export interface AbilityReplacedEvent extends GameEvent<'ABILITY_REPLACED'> {
    payload: {
        playerId: PlayerId;
        /** 被替换的技能 ID（原技能 ID，不变） */
        oldAbilityId: string;
        /** 新技能定义（会在 reducer 中强制保持 oldAbilityId） */
        newAbilityDef: AbilityDef;
        /** 触发升级的卡牌 ID（用于从手牌移除） */
        cardId: string;
        /** 升级后的等级（用于 abilityLevels 追踪） */
        newLevel: number;
    };
}

/** CP 变化事件 */
export interface CpChangedEvent extends GameEvent<'CP_CHANGED'> {
    payload: {
        playerId: PlayerId;
        delta: number;
        newValue: number;
    };
}

/** 卡牌重排事件 */
export interface CardReorderedEvent extends GameEvent<'CARD_REORDERED'> {
    payload: {
        playerId: PlayerId;
        cardId: string;
    };
}

/** 牌库洗牌事件（从弃牌堆洗回牌库时触发） */
export interface DeckShuffledEvent extends GameEvent<'DECK_SHUFFLED'> {
    payload: {
        playerId: PlayerId;
        /** 洗牌后的牌库顺序（从顶到底） */
        deckCardIds: string[];
    };
}

/** 攻击发起事件 */
export interface AttackInitiatedEvent extends GameEvent<'ATTACK_INITIATED'> {
    payload: {
        attackerId: PlayerId;
        defenderId: PlayerId;
        sourceAbilityId: string;
        isDefendable: boolean;
        /** 是否为终极技能（不可被干扰） */
        isUltimate?: boolean;
    };
}

/** 进攻方前置防御结算事件 */
export interface AttackPreDefenseResolvedEvent extends GameEvent<'ATTACK_PRE_DEFENSE_RESOLVED'> {
    payload: {
        attackerId: PlayerId;
        defenderId: PlayerId;
        sourceAbilityId?: string;
    };
}

/** 攻击结算事件 */
export interface AttackResolvedEvent extends GameEvent<'ATTACK_RESOLVED'> {
    payload: {
        attackerId: PlayerId;
        defenderId: PlayerId;
        sourceAbilityId?: string;
        defenseAbilityId?: string;
        totalDamage: number;
    };
}

/** 选择请求事件 */
export interface ChoiceRequestedEvent extends GameEvent<'CHOICE_REQUESTED'> {
    payload: {
        playerId: PlayerId;
        sourceAbilityId: string;
        titleKey: string;
        options: Array<{
            /** 被动状态 ID（如 STATUS_IDS.KNOCKDOWN） */
            statusId?: string;
            /** Token ID（如 taiji/evasive/purify） */
            tokenId?: string;
            /** 数值（通常为 +1；也允许为负数表示消耗） */
            value: number;
            /** 自定义选择 ID（用于非 status/token 的选择，或区分不同语义） */
            customId?: string;
            /** 选项显示文案 key（i18n）。若不提供，将根据 statusId/tokenId 自动推导 */
            labelKey?: string;
        }>;
    };
}

/** 选择完成事件 */
export interface ChoiceResolvedEvent extends GameEvent<'CHOICE_RESOLVED'> {
    payload: {
        playerId: PlayerId;
        /** 状态 ID（被动状态如击倒） */
        statusId?: string;
        /** Token ID（太极、闪避、净化） */
        tokenId?: string;
        /** 数值（通常为 +1；也允许为负数表示消耗） */
        value: number;
        /** 自定义选择 ID（用于非 status/token 的选择，或区分不同语义） */
        customId?: string;
        sourceAbilityId?: string;
    };
}

/** 回合切换事件 */
export interface TurnChangedEvent extends GameEvent<'TURN_CHANGED'> {
    payload: {
        previousPlayerId: PlayerId;
        nextPlayerId: PlayerId;
        turnNumber: number;
    };
}

/** 响应窗口打开事件（多响应者队列） */
export interface ResponseWindowOpenedEvent extends GameEvent<'RESPONSE_WINDOW_OPENED'> {
    payload: {
        windowId: string;
        /** 响应者队列（按顺序轮询） */
        responderQueue: PlayerId[];
        windowType: ResponseWindowType;
        /** 来源卡牌/技能 ID */
        sourceId?: string;
    };
}

/** 响应窗口关闭事件 */
export interface ResponseWindowClosedEvent extends GameEvent<'RESPONSE_WINDOW_CLOSED'> {
    payload: {
        windowId: string;
        /** 所有人都跳过了 */
        allPassed?: boolean;
    };
}

/** 响应者变更事件（窗口内部轮询） */
export interface ResponseWindowResponderChangedEvent extends GameEvent<'RESPONSE_WINDOW_RESPONDER_CHANGED'> {
    payload: {
        windowId: string;
        previousResponderId: PlayerId;
        nextResponderId: PlayerId;
    };
}

/** 骰子修改事件 */
export interface DieModifiedEvent extends GameEvent<'DIE_MODIFIED'> {
    payload: {
        dieId: number;
        oldValue: number;
        newValue: number;
        /** 执行修改的玩家 ID */
        playerId: PlayerId;
        sourceCardId?: string;
    };
}

/** 骰子重掷事件 */
export interface DieRerolledEvent extends GameEvent<'DIE_REROLLED'> {
    payload: {
        dieId: number;
        oldValue: number;
        newValue: number;
        playerId: PlayerId;
        sourceCardId?: string;
    };
}

/** 投掷次数变化事件 */
export interface RollLimitChangedEvent extends GameEvent<'ROLL_LIMIT_CHANGED'> {
    payload: {
        playerId: PlayerId;
        delta: number;
        newLimit: number;
        sourceCardId?: string;
    };
}

/** 交互请求事件 */
export interface InteractionRequestedEvent extends GameEvent<'INTERACTION_REQUESTED'> {
    payload: {
        interaction: PendingInteraction;
    };
}

/** 交互完成事件 */
export interface InteractionCompletedEvent extends GameEvent<'INTERACTION_COMPLETED'> {
    payload: {
        interactionId: string;
        sourceCardId: string;
    };
}

/** 交互取消事件 */
export interface InteractionCancelledEvent extends GameEvent<'INTERACTION_CANCELLED'> {
    payload: {
        interactionId: string;
        /** 源卡牌 ID（用于还原卡牌） */
        sourceCardId: string;
        /** 源卡牌 CP 消耗（用于返还 CP） */
        cpCost: number;
        /** 执行交互的玩家 ID */
        playerId: PlayerId;
    };
}

// ============================================================================
// Token 响应窗口事件
// ============================================================================

/** Token 响应窗口打开事件 */
export interface TokenResponseRequestedEvent extends GameEvent<'TOKEN_RESPONSE_REQUESTED'> {
    payload: {
        /** 待处理的伤害信息 */
        pendingDamage: PendingDamage;
    };
}

/** Token 使用事件 */
export interface TokenUsedEvent extends GameEvent<'TOKEN_USED'> {
    payload: {
        playerId: PlayerId;
        tokenId: string;
        amount: number;
        /** 效果类型 */
        effectType: 'damageBoost' | 'damageReduction' | 'evasionAttempt';
        /** 伤害修改量（加伤/减伤） */
        damageModifier?: number;
        /** 闪避投骰结果（仅 evasionAttempt） */
        evasionRoll?: {
            value: number;
            success: boolean;
        };
    };
}

/** Token 响应窗口关闭事件 */
export interface TokenResponseClosedEvent extends GameEvent<'TOKEN_RESPONSE_CLOSED'> {
    payload: {
        pendingDamageId: string;
        /** 最终伤害值 */
        finalDamage: number;
        /** 是否完全闪避 */
        fullyEvaded: boolean;
    };
}

/** 技能重选事件（骰面被修改后触发） */
export interface AbilityReselectionRequiredEvent extends GameEvent<'ABILITY_RESELECTION_REQUIRED'> {
    payload: {
        playerId: PlayerId;
        /** 原来选择的技能 ID */
        previousAbilityId?: string;
        /** 触发原因 */
        reason: 'dieModified' | 'dieRerolled';
    };
}

// ============================================================================
// 奖励骰重掷事件
// ============================================================================

/** 奖励骰重掷请求事件（延后结算流程启动） */
export interface BonusDiceRerollRequestedEvent extends GameEvent<'BONUS_DICE_REROLL_REQUESTED'> {
    payload: {
        /** 待结算的奖励骰信息 */
        settlement: PendingBonusDiceSettlement;
    };
}

/** 奖励骰重掷事件（单颗重掷） */
export interface BonusDieRerolledEvent extends GameEvent<'BONUS_DIE_REROLLED'> {
    payload: {
        /** 重掷的骰子索引 */
        dieIndex: number;
        /** 旧点数 */
        oldValue: number;
        /** 新点数 */
        newValue: number;
        /** 新骰面符号 */
        newFace: DieFace;
        /** 消耗的 Token ID */
        costTokenId: string;
        /** 消耗的 Token 数量 */
        costAmount: number;
        /** 玩家 ID */
        playerId: PlayerId;
    };
}

/** 奖励骰结算事件（重掷交互结束，执行伤害结算） */
export interface BonusDiceSettledEvent extends GameEvent<'BONUS_DICE_SETTLED'> {
    payload: {
        /** 最终骰子结果 */
        finalDice: BonusDieInfo[];
        /** 总伤害 */
        totalDamage: number;
        /** 是否触发阈值效果 */
        thresholdTriggered: boolean;
        /** 攻击者玩家 ID */
        attackerId: PlayerId;
        /** 目标玩家 ID */
        targetId: PlayerId;
        /** 来源技能 ID */
        sourceAbilityId: string;
    };
}

/** 所有 DiceThrone 事件 */
export type DiceThroneEvent =
    | DiceRolledEvent
    | BonusDieRolledEvent
    | DieLockToggledEvent
    | RollConfirmedEvent
    | CharacterSelectedEvent
    | HeroInitializedEvent
    | HostStartedEvent
    | PlayerReadyEvent
    | AbilityActivatedEvent
    | DamageDealtEvent
    | HealAppliedEvent
    | StatusAppliedEvent
    | StatusRemovedEvent
    | TokenGrantedEvent
    | TokenConsumedEvent
    | TokenLimitChangedEvent
    | DamageShieldGrantedEvent
    | DamagePreventedEvent
    | CardDrawnEvent
    | CardDiscardedEvent
    | CardSoldEvent
    | SellUndoneEvent
    | CardPlayedEvent
    | CpChangedEvent
    | CardReorderedEvent
    | DeckShuffledEvent
    | AttackInitiatedEvent
    | AttackPreDefenseResolvedEvent
    | AttackResolvedEvent
    | ChoiceRequestedEvent
    | ChoiceResolvedEvent
    | TurnChangedEvent
    | AbilityReplacedEvent
    | ResponseWindowOpenedEvent
    | ResponseWindowClosedEvent
    | ResponseWindowResponderChangedEvent
    | DieModifiedEvent
    | DieRerolledEvent
    | RollLimitChangedEvent
    | InteractionRequestedEvent
    | InteractionCompletedEvent
    | InteractionCancelledEvent
    | TokenResponseRequestedEvent
    | TokenUsedEvent
    | TokenResponseClosedEvent
    | AbilityReselectionRequiredEvent
    | BonusDiceRerollRequestedEvent
    | BonusDieRerolledEvent
    | BonusDiceSettledEvent;

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
