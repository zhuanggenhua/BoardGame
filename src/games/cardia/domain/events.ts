import type { GameEvent } from '../../../engine/types';
import type { PlayerId } from '../../../engine/types';

/**
 * 事件常量表
 */
export const CARDIA_EVENTS = {
    CARD_PLAYED: 'cardia:card_played',
    CARD_DRAWN: 'cardia:card_drawn',
    ENCOUNTER_RESOLVED: 'cardia:encounter_resolved',
    ABILITY_ACTIVATED: 'cardia:ability_activated',
    ABILITY_SKIPPED: 'cardia:ability_skipped',
    ABILITY_INTERACTION_REQUESTED: 'cardia:ability_interaction_requested',
    ABILITY_NO_VALID_TARGET: 'cardia:ability_no_valid_target',
    ABILITY_COPIED: 'cardia:ability_copied',
    ONGOING_ABILITY_PLACED: 'cardia:ongoing_ability_placed',
    ONGOING_ABILITY_REMOVED: 'cardia:ongoing_ability_removed',
    MODIFIER_TOKEN_PLACED: 'cardia:modifier_token_placed',
    MODIFIER_TOKEN_REMOVED: 'cardia:modifier_token_removed',
    MODIFIER_ADDED: 'cardia:modifier_added',
    MODIFIER_REMOVED: 'cardia:modifier_removed',
    CARD_INFLUENCE_MODIFIED: 'cardia:card_influence_modified',
    ENCOUNTER_RESULT_CHANGED: 'cardia:encounter_result_changed',
    REVEAL_ORDER_CHANGED: 'cardia:reveal_order_changed',
    SIGNET_MOVED: 'cardia:signet_moved',
    SIGNET_REMOVED: 'cardia:signet_removed',
    EXTRA_SIGNET_PLACED: 'cardia:extra_signet_placed',
    SIGNET_GRANTED: 'cardia:signet_granted',
    FACTION_SELECTED: 'cardia:faction_selected',
    CARD_REPLACED: 'cardia:card_replaced',
    CARDS_DISCARDED: 'cardia:cards_discarded',
    CARDS_DISCARDED_FROM_DECK: 'cardia:cards_discarded_from_deck',
    CARD_RECYCLED: 'cardia:card_recycled',
    DECK_SHUFFLED: 'cardia:deck_shuffled',
    DELAYED_EFFECT_REGISTERED: 'cardia:delayed_effect_registered',
    DELAYED_EFFECT_TRIGGERED: 'cardia:delayed_effect_triggered',
    INVENTOR_PENDING_SET: 'cardia:inventor_pending_set',
    INVENTOR_PENDING_CLEARED: 'cardia:inventor_pending_cleared',
    TURN_ENDED: 'cardia:turn_ended',
    PHASE_CHANGED: 'cardia:phase_changed',
    GAME_WON: 'cardia:game_won',
} as const;

/**
 * 卡牌打出事件
 */
export interface CardPlayedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_PLAYED> {
    payload: {
        cardUid: string;
        playerId: PlayerId;
        slotIndex: number;
    };
}

/**
 * 卡牌抽取事件
 */
export interface CardDrawnEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_DRAWN> {
    payload: {
        playerId: PlayerId;
        count: number;
    };
}

/**
 * 遭遇结算事件
 */
export interface EncounterResolvedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESOLVED> {
    payload: {
        slotIndex: number;
        winner: PlayerId | 'tie';
        loser: PlayerId | null;
    };
}

/**
 * 能力激活事件
 */
export interface AbilityActivatedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_ACTIVATED> {
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
export interface AbilitySkippedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_SKIPPED> {
    payload: {
        playerId: PlayerId;
        cardId?: string;  // 可选：跳过的卡牌ID
    };
}

/**
 * 能力交互请求事件
 * 当能力执行器返回交互时发射此事件
 */
export interface AbilityInteractionRequestedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_INTERACTION_REQUESTED> {
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
export interface AbilityNoValidTargetEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_NO_VALID_TARGET> {
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
export interface AbilityCopiedEvent extends GameEvent<typeof CARDIA_EVENTS.ABILITY_COPIED> {
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
export interface OngoingAbilityPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_PLACED> {
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
export interface OngoingAbilityRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.ONGOING_ABILITY_REMOVED> {
    payload: {
        abilityId: string;
        cardId: string;
        playerId: string;
    };
}

/**
 * 修正标记放置事件
 */
export interface ModifierTokenPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED> {
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
export interface ModifierTokenRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_TOKEN_REMOVED> {
    payload: {
        cardId: string;
        source?: string;  // 可选，移除特定来源的标记
    };
}

/**
 * 卡牌影响力修改事件
 */
export interface CardInfluenceModifiedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED> {
    payload: {
        cardId: string;
        oldInfluence: number;
        newInfluence: number;
    };
}

/**
 * 遭遇结果改变事件
 */
export interface EncounterResultChangedEvent extends GameEvent<typeof CARDIA_EVENTS.ENCOUNTER_RESULT_CHANGED> {
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
export interface RevealOrderChangedEvent extends GameEvent<typeof CARDIA_EVENTS.REVEAL_ORDER_CHANGED> {
    payload: {
        revealFirstPlayerId: PlayerId;
        sourceAbilityId: string;
    };
}

/**
 * 印戒移动事件
 */
export interface SignetMovedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_MOVED> {
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
export interface SignetRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_REMOVED> {
    payload: {
        cardId: string;
        playerId: string;
    };
}

/**
 * 额外印戒放置事件
 */
export interface ExtraSignetPlacedEvent extends GameEvent<typeof CARDIA_EVENTS.EXTRA_SIGNET_PLACED> {
    payload: {
        cardId: string;
        playerId: PlayerId;
        conditional?: boolean;  // 可选：是否为条件性效果（机械精灵使用）
    };
}

/**
 * 印戒授予事件
 */
export interface SignetGrantedEvent extends GameEvent<typeof CARDIA_EVENTS.SIGNET_GRANTED> {
    payload: {
        playerId: PlayerId;
        cardUid: string;
        newTotal?: number;  // 可选：新的印戒总数
    };
}

/**
 * 派系选择事件
 */
export interface FactionSelectedEvent extends GameEvent<typeof CARDIA_EVENTS.FACTION_SELECTED> {
    payload: {
        playerId: PlayerId;
        faction: string;  // FactionType
        abilityId: string;
    };
}

/**
 * 卡牌替换事件
 */
export interface CardReplacedEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_REPLACED> {
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
export interface CardsDiscardedEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED> {
    payload: {
        playerId: PlayerId;
        cardIds: string[];
        from: 'hand' | 'field';
    };
}

/**
 * 从牌库弃牌事件
 */
export interface CardsDiscardedFromDeckEvent extends GameEvent<typeof CARDIA_EVENTS.CARDS_DISCARDED_FROM_DECK> {
    payload: {
        playerId: PlayerId;
        count: number;
    };
}

/**
 * 卡牌回收事件
 * 将场上卡牌回收到手牌
 */
export interface CardRecycledEvent extends GameEvent<typeof CARDIA_EVENTS.CARD_RECYCLED> {
    payload: {
        playerId: PlayerId;
        cardId: string;
        from: 'field';  // 固定为 field，因为只能从场上回收
    };
}

/**
 * 牌库混洗事件
 */
export interface DeckShuffledEvent extends GameEvent<typeof CARDIA_EVENTS.DECK_SHUFFLED> {
    payload: {
        playerId: PlayerId;
    };
}

/**
 * 延迟效果注册事件
 */
export interface DelayedEffectRegisteredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_REGISTERED> {
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
export interface DelayedEffectTriggeredEvent extends GameEvent<typeof CARDIA_EVENTS.DELAYED_EFFECT_TRIGGERED> {
    payload: {
        effectType: string;
        targetCardId: string;
    };
}

/**
 * 发明家待续标记设置事件
 */
export interface InventorPendingSetEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_SET> {
    payload: {
        playerId: PlayerId;
        timestamp: number;
        firstCardId: string;  // 第一次选择的卡牌 ID
    };
}

/**
 * 发明家待续标记清理事件
 */
export interface InventorPendingClearedEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_CLEARED> {
    payload: {
        playerId: PlayerId;
    };
}

/**
 * 游戏胜利事件
 */
export interface GameWonEvent extends GameEvent<typeof CARDIA_EVENTS.GAME_WON> {
    payload: {
        winnerId: PlayerId;
        reason: string;
    };
}

/**
 * 修正标记添加事件
 */
export interface ModifierAddedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_ADDED> {
    payload: {
        cardUid: string;
        value: number;
        playerId: PlayerId;
    };
}

/**
 * 修正标记移除事件
 */
export interface ModifierRemovedEvent extends GameEvent<typeof CARDIA_EVENTS.MODIFIER_REMOVED> {
    payload: {
        cardUid: string;
        modifierId: string;
        playerId: PlayerId;
    };
}

/**
 * 回合结束事件
 */
export interface TurnEndedEvent extends GameEvent<typeof CARDIA_EVENTS.TURN_ENDED> {
    payload: {
        playerId: PlayerId;
        turnNumber: number;
    };
}

/**
 * 阶段变更事件
 */
export interface PhaseChangedEvent extends GameEvent<typeof CARDIA_EVENTS.PHASE_CHANGED> {
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
