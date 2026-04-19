import type { GameEvent } from '../../../engine/types';
import type { PlayerId } from '../../../engine/types';
import { defineEvents } from '../../../lib/audio/defineEvents';

/**
 * Cardia 事件定义（含音频策略）
 * 
 * 音频策略说明：
 * - immediate: 即时反馈音效，通过 EventStream 播放
 * - fx: 动画驱动音效，由 FX 系统负责播放
 * - silent: 无音效事件
 */
export const CARDIA_EVENTS = defineEvents({
    // === 即时反馈音效（immediate）===
    
    // 卡牌操作
    CARD_PLAYED: { 
        audio: 'immediate', 
        sound: 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001' 
    },
    CARD_DRAWN: { 
        audio: 'immediate', 
        sound: 'card.handling.decks_and_cards_sound_fx_pack.card_take_001' 
    },
    CARD_REPLACED: { 
        audio: 'immediate', 
        sound: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001' 
    },
    CARDS_DISCARDED: { 
        audio: 'immediate', 
        sound: 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001' 
    },
    DECK_SHUFFLED: { 
        audio: 'immediate', 
        sound: 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001' 
    },
    
    // 印戒相关
    SIGNET_GRANTED: { 
        audio: 'immediate', 
        sound: 'coins.decks_and_cards_sound_fx_pack.small_reward_001' 
    },
    
    // 修正标记（动态音效选择在 audio.config.ts 的 feedbackResolver 中处理）
    MODIFIER_TOKEN_PLACED: { 
        audio: 'immediate', 
        sound: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a'
    },
    MODIFIER_TOKEN_REMOVED: { 
        audio: 'immediate', 
        sound: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a' 
    },
    
    // 游戏胜利（音效通过 feedbackResolver 动态选择）
    GAME_WON: { 
        audio: 'immediate', 
        sound: 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win' 
    },
    
    // === 动画驱动音效（fx）===
    ENCOUNTER_RESOLVED: { audio: 'fx' },
    
    // 能力激活（即时音效）
    ABILITY_ACTIVATED: { 
        audio: 'immediate', 
        sound: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001' 
    },
    
    // === 无音效事件（silent）===
    ABILITY_SKIPPED: { audio: 'silent' },
    ABILITY_INTERACTION_REQUESTED: { audio: 'silent' },
    ABILITY_NO_VALID_TARGET: { audio: 'silent' },
    ABILITY_COPIED: { audio: 'silent' },
    ONGOING_ABILITY_PLACED: { audio: 'silent' },
    ONGOING_ABILITY_REMOVED: { audio: 'silent' },
    MODIFIER_ADDED: { audio: 'silent' },
    MODIFIER_REMOVED: { audio: 'silent' },
    CARD_INFLUENCE_MODIFIED: { audio: 'silent' },
    ENCOUNTER_RESULT_CHANGED: { audio: 'silent' },
    REVEAL_ORDER_CHANGED: { audio: 'silent' },
    SIGNET_MOVED: { audio: 'silent' },
    SIGNET_REMOVED: { audio: 'silent' },
    EXTRA_SIGNET_PLACED: { audio: 'silent' },
    FACTION_SELECTED: { audio: 'silent' },
    CARDS_DISCARDED_FROM_DECK: { audio: 'silent' },
    CARD_RECYCLED: { audio: 'silent' },
    DELAYED_EFFECT_REGISTERED: { audio: 'silent' },
    DELAYED_EFFECT_TRIGGERED: { audio: 'silent' },
    INVENTOR_PENDING_SET: { audio: 'silent' },
    INVENTOR_PENDING_CLEARED: { audio: 'silent' },
    TURN_ENDED: { audio: 'silent' },
    PHASE_CHANGED: { audio: 'silent' },
});

/**
 * 卡牌打出事件
 */
export interface CardPlayedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_PLAYED.type> {
    payload: {
        cardUid: string;
        playerId: PlayerId;
        slotIndex: number;
    };
}

/**
 * 卡牌抽取事件
 */
export interface CardDrawnEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_DRAWN.type> {
    payload: {
        playerId: PlayerId;
        count: number;
    };
}

/**
 * 遭遇结算事件
 */
export interface EncounterResolvedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESOLVED.type> {
    payload: {
        slotIndex: number;
        winner: PlayerId | 'tie';
        loser: PlayerId | null;
    };
}

/**
 * 能力激活事件
 */
export interface AbilityActivatedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_ACTIVATED.type> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        isInstant: boolean;
        isOngoing: boolean;
    };
}

/**
 * 能力跳过事件
 * 当玩家选择跳过能力时发射此事件
 */
export interface AbilitySkippedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_SKIPPED.type> {
    payload: {
        playerId: PlayerId;
        cardId?: string;  // 可选：跳过的卡牌ID
    };
}

/**
 * 能力交互请求事件
 * 当能力执行器返回交互时发射此事件
 */
export interface AbilityInteractionRequestedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED.type> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        interaction: any;  // CardiaInteraction type from interactionHandlers.ts
    };
}

/**
 * 能力无有效目标事件
 * 当能力无法找到有效目标时发射此事件（用于 UI 提示）
 */
export interface AbilityNoValidTargetEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_NO_VALID_TARGET.type> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        reason: string;  // 'no_markers' | 'no_cards' | 'no_units' 等
    };
}

/**
 * 能力复制事件
 */
export interface AbilityCopiedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_COPIED.type> {
    payload: {
        sourceCardId: string;
        targetCardId: string;
        copiedAbilityId: string;
        copyingPlayerId: PlayerId;
    };
}

/**
 * 持续能力放置事件
 */
export interface OngoingAbilityPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_PLACED.type> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: PlayerId;
        effectType: string;
        timestamp: number;
        encounterIndex?: number;  // 可选：影响的遭遇索引（调停者使用）
        conditional?: boolean;    // 可选：是否为条件性效果（机械精灵使用）
    };
}

/**
 * 持续能力移除事件
 */
export interface OngoingAbilityRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_REMOVED.type> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: string;
    };
}

/**
 * 修正标记放置事件
 */
export interface ModifierTokenPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type> {
    payload: {
        cardId: string;
        value: number;
        source: string;
        timestamp: number;
    };
}

/**
 * 修正标记移除事件
 */
export interface ModifierTokenRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED.type> {
    payload: {
        cardId: string;
        source?: string;  // 可选，移除特定来源的标记
    };
}

/**
 * 卡牌影响力修改事件
 */
export interface CardInfluenceModifiedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED.type> {
    payload: {
        cardId: string;
        oldInfluence: number;
        newInfluence: number;
    };
}

/**
 * 遭遇结果改变事件
 */
export interface EncounterResultChangedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED.type> {
    payload: {
        slotIndex: number;
        previousWinner: PlayerId | 'tie';
        newWinner: PlayerId | 'tie';
        reason: string;
    };
}

/**
 * 揭示顺序改变事件
 */
export interface RevealOrderChangedEvent extends GameEvent<typeof CARDIA_EVENTS.REVEAL_ORDER_CHANGED.type> {
    payload: {
        revealFirstPlayerId: PlayerId;
        sourceAbilityId: string;
    };
}

/**
 * 印戒移动事件
 */
export interface SignetMovedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_MOVED.type> {
    payload: {
        fromCardId: string;
        toCardId: string;
        slotIndex: number;
    };
}

/**
 * 印戒移除事件
 * 当遭遇结果从"有获胜方"变为"平局"时，移除获胜方卡牌上的印戒
 */
export interface SignetRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_REMOVED.type> {
    payload: {
        cardId: string;
        playerId: string;
    };
}

/**
 * 额外印戒放置事件
 */
export interface ExtraSignetPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.EXTRA_SIGNET_PLACED.type> {
    payload: {
        cardId: string;
        playerId: PlayerId;
        conditional?: boolean;  // 可选：是否为条件性效果（机械精灵使用）
    };
}

/**
 * 印戒授予事件
 */
export interface SignetGrantedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_GRANTED.type> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        newTotal?: number;  // 可选：新的印戒总数
    };
}

/**
 * 派系选择事件
 */
export interface FactionSelectedEvent extends GameEvent<typeof CARDIA_EVENTS.FACTION_SELECTED.type> {
    payload: {
        playerId: PlayerId;
        faction: string;  // FactionType
        abilityId: string;
    };
}

/**
 * 卡牌替换事件
 */
export interface CardReplacedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_REPLACED.type> {
    payload: {
        slotIndex: number;
        oldCardId: string;
        newCardId: string;
        replacedByAbility: boolean;
        playerId: PlayerId;           // 添加：被替换卡牌的拥有者
        encounterIndex?: number;      // 添加：遭遇索引
    };
}

/**
 * 卡牌弃掉事件
 */
export interface CardsDiscardedEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED.type> {
    payload: {
        playerId: PlayerId;
        cardIds: string[];
        from: 'hand' | 'field';
    };
}

/**
 * 从牌库弃牌事件
 */
export interface CardsDiscardedFromDeckEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK.type> {
    payload: {
        playerId: PlayerId;
        count: number;
    };
}

/**
 * 卡牌回收事件
 * 将场上卡牌回收到手牌
 */
export interface CardRecycledEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_RECYCLED.type> {
    payload: {
        playerId: PlayerId;
        cardId: string;
        from: 'field';  // 固定为 field，因为只能从场上回收
    };
}

/**
 * 牌库混洗事件
 */
export interface DeckShuffledEvent extends GameEvent<typeof CARDIA_EVENTS.DECK_SHUFFLED.type> {
    payload: {
        playerId: PlayerId;
    };
}

/**
 * 延迟效果注册事件
 */
export interface DelayedEffectRegisteredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED.type> {
    payload: {
        effectType: string;
        target: 'self' | 'opponent';
        value?: number;
        condition: string;
        sourceAbilityId: string;
        sourcePlayerId: PlayerId;
        timestamp: number;
    };
}

/**
 * 延迟效果触发事件
 */
export interface DelayedEffectTriggeredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED.type> {
    payload: {
        effectType: string;
        targetCardId: string;
    };
}

/**
 * 发明家待续标记设置事件
 */
export interface InventorPendingSetEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_SET.type> {
    payload: {
        playerId: PlayerId;
        timestamp: number;
        firstCardId: string;  // 第一次选择的卡牌 ID
    };
}

/**
 * 发明家待续标记清理事件
 */
export interface InventorPendingClearedEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_CLEARED.type> {
    payload: {
        playerId: PlayerId;
    };
}

/**
 * 游戏胜利事件
 */
export interface GameWonEvent extends GameEvent<typeof CARDIA_EVENTS.GAME_WON.type> {
    payload: {
        winnerId: PlayerId;
        reason: string;
    };
}

/**
 * 修正标记添加事件
 */
export interface ModifierAddedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_ADDED.type> {
    payload: {
        cardUid: string;
        value: number;
        playerId: PlayerId;
    };
}

/**
 * 修正标记移除事件
 */
export interface ModifierRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_REMOVED.type> {
    payload: {
        cardUid: string;
        modifierId: string;
        playerId: PlayerId;
    };
}

/**
 * 回合结束事件
 */
export interface TurnEndedEvent extends GameEvent<typeof CARDIA_EVENTS.TURN_ENDED.type> {
    payload: {
        playerId: PlayerId;
        turnNumber: number;
    };
}

/**
 * 阶段变更事件
 */
export interface PhaseChangedEvent extends GameEvent<typeof CARDIA_EVENTS.PHASE_CHANGED.type> {
    payload: {
        from: string;
        newPhase: string;
        playerId: PlayerId;
    };
}

/**
 * Cardia 事件联合类型
 */
export type CardiaEvent =
    | CardPlayedEvent
    | CardDrawnEvent
    | EncounterResolvedEvent
    | AbilityActivatedEvent
    | AbilitySkippedEvent
    | AbilityInteractionRequestedEvent
    | AbilityNoValidTargetEvent
    | AbilityCopiedEvent
    | OngoingAbilityPlacedEvent
    | OngoingAbilityRemovedEvent
    | ModifierTokenPlacedEvent
    | ModifierTokenRemovedEvent
    | ModifierAddedEvent
    | ModifierRemovedEvent
    | CardInfluenceModifiedEvent
    | EncounterResultChangedEvent
    | RevealOrderChangedEvent
    | SignetMovedEvent
    | SignetRemovedEvent
    | ExtraSignetPlacedEvent
    | SignetGrantedEvent
    | FactionSelectedEvent
    | CardReplacedEvent
    | CardsDiscardedEvent
    | CardsDiscardedFromDeckEvent
    | CardRecycledEvent
    | DeckShuffledEvent
    | DelayedEffectRegisteredEvent
    | DelayedEffectTriggeredEvent
    | InventorPendingSetEvent
    | InventorPendingClearedEvent
    | TurnEndedEvent
    | PhaseChangedEvent
    | GameWonEvent;
