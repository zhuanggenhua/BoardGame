/**
 * DiceThrone 事件类型定义
 */

import { defineEvents } from '../../../lib/audio/defineEvents';
import type { GameEvent, PlayerId } from '../../../engine/types';
import type { DtResponseWindowType } from './core-types';
import type {
    DieFace,
    SelectableCharacterId,
    InteractionDescriptor,
    PendingDamage,
    PendingBonusDiceSettlement,
    BonusDieInfo,
} from './core-types';
import type { AbilityDef } from './combat';

// ============================================================================
// 音频事件常量（面向百游戏 + 适宜 AI）
// ============================================================================

// 音效 key 常量
const DICE_ROLL_SINGLE_KEY = 'dice.general.tabletop_audio_dice.plastic_dice.plastic_dice_roll_01';
const DICE_LOCK_KEY = 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001';
const ROLL_CONFIRM_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const DIE_MODIFY_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';

const CARD_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const CARD_SELL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const CARD_REORDER_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';
const DECK_SHUFFLE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001';

const TURN_CHANGE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const CHOICE_REQUEST_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';
const CHOICE_RESOLVE_KEY = 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001';

const RESPONSE_WINDOW_OPEN_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';
const RESPONSE_WINDOW_CLOSE_KEY = 'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_close_001';

const ATTACK_INITIATE_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
const ATTACK_PRE_DEFENSE_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1';
const ATTACK_UNDEFENDABLE_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_001';

const SHIELD_GRANT_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const DAMAGE_PREVENT_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';

const BONUS_DICE_SETTLE_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const EXTRA_ATTACK_KEY = 'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1';
const ABILITY_RESELECT_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';

/**
 * DiceThrone 事件音频配置
 * 
 * 规则：
 * - 'ui': 本地 UI 交互音（选择角色/准备/开始），只在本地播放
 * - 'immediate': 即时游戏反馈音（投骰子/出牌/阶段切换），走 EventStream
 * - 'fx': 动画驱动音效（伤害/治疗/状态/Token），走 FX 系统
 * - 'silent': 静默事件（状态同步/内部更新），无音效
 */
export const DT_EVENTS = defineEvents({
  // ========== UI 交互（本地播放）==========
  CHARACTER_SELECTED: 'ui',      // 选择角色（UI 层播放）
  PLAYER_READY: 'ui',            // 玩家准备（UI 层播放）
  HOST_STARTED: 'ui',            // 房主开始（UI 层播放）

  // ========== 即时反馈（EventStream）==========
  DICE_ROLLED: { audio: 'immediate', sound: DICE_ROLL_SINGLE_KEY },
  BONUS_DIE_ROLLED: { audio: 'immediate', sound: DICE_ROLL_SINGLE_KEY },
  DIE_LOCK_TOGGLED: { audio: 'immediate', sound: DICE_LOCK_KEY },
  ROLL_CONFIRMED: { audio: 'immediate', sound: ROLL_CONFIRM_KEY },
  DIE_MODIFIED: { audio: 'immediate', sound: DIE_MODIFY_KEY },
  DIE_REROLLED: { audio: 'immediate', sound: DICE_ROLL_SINGLE_KEY },
  BONUS_DIE_REROLLED: { audio: 'immediate', sound: DICE_ROLL_SINGLE_KEY },
  
  CARD_PLAYED: { audio: 'immediate', sound: CARD_PLAY_KEY },
  CARD_DRAWN: { audio: 'immediate', sound: CARD_DRAW_KEY },
  CARD_DISCARDED: { audio: 'immediate', sound: CARD_DISCARD_KEY },
  CARD_SOLD: { audio: 'immediate', sound: CARD_SELL_KEY },
  SELL_UNDONE: { audio: 'immediate', sound: CARD_DRAW_KEY },
  CARD_REORDERED: { audio: 'immediate', sound: CARD_REORDER_KEY },
  DECK_SHUFFLED: { audio: 'immediate', sound: DECK_SHUFFLE_KEY },
  
  TURN_CHANGED: { audio: 'immediate', sound: TURN_CHANGE_KEY },
  ROLL_LIMIT_CHANGED: { audio: 'immediate', sound: CHOICE_RESOLVE_KEY },
  
  CHOICE_REQUESTED: { audio: 'immediate', sound: CHOICE_REQUEST_KEY },
  CHOICE_RESOLVED: { audio: 'immediate', sound: CHOICE_RESOLVE_KEY },
  
  RESPONSE_WINDOW_OPENED: { audio: 'immediate', sound: RESPONSE_WINDOW_OPEN_KEY },
  RESPONSE_WINDOW_CLOSED: { audio: 'immediate', sound: RESPONSE_WINDOW_CLOSE_KEY },
  TOKEN_RESPONSE_REQUESTED: { audio: 'immediate', sound: RESPONSE_WINDOW_OPEN_KEY },
  TOKEN_RESPONSE_CLOSED: { audio: 'immediate', sound: RESPONSE_WINDOW_CLOSE_KEY },
  
  ATTACK_INITIATED: { audio: 'immediate', sound: ATTACK_INITIATE_KEY },
  ATTACK_PRE_DEFENSE_RESOLVED: { audio: 'immediate', sound: ATTACK_PRE_DEFENSE_KEY },
  ATTACK_MADE_UNDEFENDABLE: { audio: 'immediate', sound: ATTACK_UNDEFENDABLE_KEY },
  
  DAMAGE_SHIELD_GRANTED: { audio: 'immediate', sound: SHIELD_GRANT_KEY },
  DAMAGE_PREVENTED: { audio: 'immediate', sound: DAMAGE_PREVENT_KEY },
  
  BONUS_DICE_REROLL_REQUESTED: { audio: 'immediate', sound: RESPONSE_WINDOW_OPEN_KEY },
  BONUS_DICE_SETTLED: { audio: 'immediate', sound: BONUS_DICE_SETTLE_KEY },
  EXTRA_ATTACK_TRIGGERED: { audio: 'immediate', sound: EXTRA_ATTACK_KEY },
  ABILITY_RESELECTION_REQUIRED: { audio: 'immediate', sound: ABILITY_RESELECT_KEY },

  // ========== 动画驱动（FX 系统）==========
  DAMAGE_DEALT: 'fx',            // 伤害（飞行动画 onImpact）
  HEAL_APPLIED: 'fx',            // 治疗（飞行动画 onImpact）
  STATUS_APPLIED: 'fx',          // 状态施加（飞行动画 onImpact）
  STATUS_REMOVED: 'fx',          // 状态移除（飞行动画 onImpact）
  TOKEN_GRANTED: 'fx',           // Token 授予（飞行动画 onImpact）
  TOKEN_CONSUMED: 'fx',          // Token 消耗（飞行动画 onImpact）
  TOKEN_USED: 'fx',              // Token 使用（飞行动画 onImpact）
  TOKEN_LIMIT_CHANGED: 'fx',     // Token 上限变化（飞行动画 onImpact）
  CP_CHANGED: 'fx',              // CP 变化（飞行动画 onImpact）
  PREVENT_DAMAGE: 'fx',          // 伤害减免（飞行动画 onImpact）
  
  ABILITY_ACTIVATED: 'fx',       // 技能激活（技能自带音效）
  ATTACK_RESOLVED: 'fx',         // 攻击结算（技能自带音效）
  ABILITY_REPLACED: 'fx',        // 技能替换（升级卡音效）

  // ========== 静默事件 ==========
  HERO_INITIALIZED: 'silent',    // 英雄初始化（内部状态）
  RESPONSE_WINDOW_RESPONDER_CHANGED: 'silent', // 响应者变更（内部状态）
});

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
        /** 额外伤害加成（如伏击掷骰值加到 pendingDamage） */
        pendingDamageBonus?: number;
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

/** 伤害修改器（用于 ActionLog 展示） */
export interface DamageModifier {
    /** 修改来源类型 */
    type: 'defense' | 'token' | 'shield' | 'status';
    /** 修改量（正数为增伤，负数为减伤） */
    value: number;
    /** 来源 ID（技能 ID、Token ID 等） */
    sourceId?: string;
    /** 来源名称（用于显示，可选） */
    sourceName?: string;
}

/** 伤害明细步骤（新管线格式） */
export interface DamageBreakdownStep {
    /** 修正类型 */
    type: string;
    /** 修正值 */
    value: number;
    /** 来源 ID */
    sourceId: string;
    /** 来源名称（i18n key 或显示文本） */
    sourceName?: string;
    /** 是否为 i18n key */
    sourceNameIsI18n?: boolean;
    /** 应用后的累计值 */
    runningTotal: number;
}

/** 伤害明细（新管线格式） */
export interface DamageBreakdown {
    /** 基础伤害 */
    base: {
        value: number;
        sourceId: string;
        sourceName?: string;
        sourceNameIsI18n?: boolean;
    };
    /** 修正步骤列表 */
    steps: DamageBreakdownStep[];
}

/** 伤害事件 */
export interface DamageDealtEvent extends GameEvent<'DAMAGE_DEALT'> {
    payload: {
        targetId: PlayerId;
        amount: number;
        actualDamage: number;
        sourceAbilityId?: string;
        /** 造成伤害的玩家 ID（用于 Token 响应窗口关闭后的 ActionLog actorId 推断） */
        sourcePlayerId?: PlayerId;
        /** 伤害修改记录（用于 ActionLog 展示完整的伤害计算过程）【旧格式，向后兼容】 */
        modifiers?: DamageModifier[];
        /** 伤害计算明细（新管线格式，优先使用）*/
        breakdown?: DamageBreakdown;
        /** 跳过护盾消耗（用于 HP 重置类效果，如神圣祝福将 HP 设为 1） */
        bypassShields?: boolean;
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
        sourceId?: string;
        /** 是否用于防止本次攻击的状态效果 */
        preventStatus?: boolean;
    };
}

/** 伤害减免事件（用于提前抵消即将到来的伤害） */
export interface PreventDamageEvent extends GameEvent<'PREVENT_DAMAGE'> {
    payload: {
        targetId: PlayerId;
        /** 要减免的伤害值 */
        amount: number;
        sourceAbilityId?: string;
        /** 是否仅用于当前伤害结算（无 pendingDamage 时不转为护盾） */
        applyImmediately?: boolean;
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
        /** 来源技能 ID（用于 action log 标注来源） */
        sourceAbilityId?: string;
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
        /** 来源技能 ID（用于 action log 标注来源） */
        sourceAbilityId?: string;
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

/** 攻击变为不可防御事件 */
export interface AttackMadeUndefendableEvent extends GameEvent<'ATTACK_MADE_UNDEFENDABLE'> {
    payload: {
        attackerId: PlayerId;
        tokenId?: string;
    };
}

/** 选择请求事件 */
export interface ChoiceRequestedEvent extends GameEvent<'CHOICE_REQUESTED'> {
    payload: {
        playerId: PlayerId;
        sourceAbilityId: string;
        titleKey: string;
        /**
         * slider 模式配置（连续数值选择）。
         * 约定：options[0] = 确认选项（value=max），options[last] = 跳过选项（value=0）。
         * - confirmLabelKey: 确认按钮文案 i18n key，支持 {{count}} 插值
         * - hintKey: 滑动条下方提示文案 i18n key，支持 {{value}} 插值
         * - skipLabelKey: 跳过按钮文案 i18n key（可选，默认用 skip option 的 labelKey）
         */
        slider?: {
            confirmLabelKey: string;
            hintKey?: string;
            skipLabelKey?: string;
        };
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
        windowType: DtResponseWindowType;
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

/** 交互请求事件（已废弃 - 迁移到 InteractionSystem 的 INTERACTION_REQUESTED） */
export interface InteractionRequestedEvent extends GameEvent<'INTERACTION_REQUESTED'> {
    payload: {
        interaction: InteractionDescriptor;
    };
}

/** 交互完成事件（已废弃 — 不再生成，交互完成由 systems.ts 直接调用 resolveInteraction） */
export interface InteractionCompletedEvent extends GameEvent<'INTERACTION_COMPLETED'> {
    payload: {
        interactionId: string;
        sourceCardId: string;
    };
}

/** 交互取消事件 */
export interface InteractionCancelledEvent extends GameEvent<'INTERACTION_CANCELLED'> {
    payload: {
        playerId: PlayerId;
        sourceCardId: string;
        cpCost: number;
        /** 原始交互 ID，用于 ResponseWindowSystem 解锁 interactionLock */
        interactionId?: string;
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
        effectType: 'damageBoost' | 'damageReduction' | 'evasionAttempt' | 'removeDebuff';
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
        /** 效果目标玩家（UI 展示用） */
        targetPlayerId?: PlayerId;
        /** 重掷特写文案 key（UI 展示用） */
        effectKey?: string;
        /** 重掷特写参数（UI 展示用） */
        effectParams?: Record<string, string | number>;
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

/** 额外攻击触发事件（晕眩 daze 触发：攻击结算后对手获得一次额外攻击） */
export interface ExtraAttackTriggeredEvent extends GameEvent<'EXTRA_ATTACK_TRIGGERED'> {
    payload: {
        /** 额外攻击的发起者（原攻击的防御方） */
        attackerId: PlayerId;
        /** 额外攻击的目标（原攻击方，即被 daze 的玩家） */
        targetId: PlayerId;
        /** 触发来源（状态效果 ID） */
        sourceStatusId: string;
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
    | PreventDamageEvent
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
    | AttackMadeUndefendableEvent
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
    | InteractionRequestedEvent    // dt:card-interaction 创建
    | InteractionCompletedEvent    // 已废弃 — 不再生成，保留类型定义用于向后兼容
    | InteractionCancelledEvent    // 仍需要 - 用于清理 dt:card-interaction（返还卡牌/CP）
    | TokenResponseRequestedEvent
    | TokenUsedEvent
    | TokenResponseClosedEvent
    | AbilityReselectionRequiredEvent
    | BonusDiceRerollRequestedEvent
    | BonusDieRerolledEvent
    | BonusDiceSettledEvent
    | ExtraAttackTriggeredEvent;
