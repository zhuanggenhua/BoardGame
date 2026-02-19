/**
 * DiceThrone 卡牌相关事件处理器
 * 从 reducer.ts 提取
 */

import type { DiceThroneCore, DiceThroneEvent } from './types';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { removeCard } from './utils';

type EventHandler<E extends DiceThroneEvent> = (
    state: DiceThroneCore,
    event: E
) => DiceThroneCore;

/**
 * 处理抽牌事件
 */
export const handleCardDrawn: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_DRAWN' }>> = (
    state,
    event
) => {
    const { playerId, cardId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const [card, newDeck] = removeCard(player.deck, cardId);
    if (!card) return state;

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, deck: newDeck, hand: [...player.hand, card] },
        },
    };
};

/**
 * 处理弃牌事件
 */
export const handleCardDiscarded: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_DISCARDED' }>> = (
    state,
    event
) => {
    const { playerId, cardId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const [card, newHand] = removeCard(player.hand, cardId);
    if (!card) return state;

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, hand: newHand, discard: [...player.discard, card] },
        },
    };
};

/**
 * 处理售卖卡牌事件
 */
export const handleCardSold: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_SOLD' }>> = (
    state,
    event
) => {
    const { playerId, cardId, cpGained } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const [card, newHand] = removeCard(player.hand, cardId);
    if (!card) return state;

    const result = resourceSystem.modify(player.resources, RESOURCE_IDS.CP, cpGained);
    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, hand: newHand, discard: [...player.discard, card], resources: result.pool },
        },
        lastSoldCardId: cardId,
    };
};

/**
 * 处理撤回售卖事件
 */
export const handleSellUndone: EventHandler<Extract<DiceThroneEvent, { type: 'SELL_UNDONE' }>> = (
    state,
    event
) => {
    const { playerId, cardId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const [card, newDiscard] = removeCard(player.discard, cardId);
    if (!card) return state;

    const result = resourceSystem.modify(player.resources, RESOURCE_IDS.CP, -1);
    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, hand: [...player.hand, card], discard: newDiscard, resources: result.pool },
        },
        lastSoldCardId: undefined,
    };
};

/**
 * 处理打出卡牌事件
 */
export const handleCardPlayed: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_PLAYED' }>> = (
    state,
    event
) => {
    const { playerId, cardId, cpCost } = event.payload;

    const player = state.players[playerId];
    if (!player) return { ...state, lastSoldCardId: undefined };

    const [card, newHand] = removeCard(player.hand, cardId);
    if (!card) return { ...state, lastSoldCardId: undefined };

    const newResources = resourceSystem.pay(player.resources, { [RESOURCE_IDS.CP]: cpCost });

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, hand: newHand, discard: [...player.discard, card], resources: newResources },
        },
        lastSoldCardId: undefined,
    };
};

/**
 * 处理 CP 变化事件
 */
export const handleCpChanged: EventHandler<Extract<DiceThroneEvent, { type: 'CP_CHANGED' }>> = (
    state,
    event
) => {
    const { playerId, newValue } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const result = resourceSystem.setValue(player.resources, RESOURCE_IDS.CP, newValue);
    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, resources: result.pool },
        },
    };
};

/**
 * 处理卡牌重排事件
 */
export const handleCardReordered: EventHandler<Extract<DiceThroneEvent, { type: 'CARD_REORDERED' }>> = (
    state,
    event
) => {
    const { playerId, cardId } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1 || cardIndex >= player.hand.length - 1) return state;

    const card = player.hand[cardIndex];
    const newHand = [...player.hand.slice(0, cardIndex), ...player.hand.slice(cardIndex + 1), card];
    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, hand: newHand },
        },
    };
};

/**
 * 处理牌库洗牌事件（弃牌堆洗回牌库）
 */
export const handleDeckShuffled: EventHandler<Extract<DiceThroneEvent, { type: 'DECK_SHUFFLED' }>> = (
    state,
    event
) => {
    const { playerId, deckCardIds } = event.payload;
    const player = state.players[playerId];
    if (!player) return state;

    const idSet = new Set(deckCardIds);
    const discardMap = new Map(player.discard.map(card => [card.id, card] as const));

    const newDeck = deckCardIds
        .map((id) => discardMap.get(id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card));
    const newDiscard = player.discard.filter(card => !idSet.has(card.id));

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, deck: newDeck, discard: newDiscard },
        },
    };
};

/**
 * 处理技能替换事件（升级卡使用，同时支持普通技能和被动技能）
 */
export const handleAbilityReplaced: EventHandler<Extract<DiceThroneEvent, { type: 'ABILITY_REPLACED' }>> = (
    state,
    event
) => {
    const { playerId, oldAbilityId, newAbilityDef, cardId, newLevel } = event.payload;
    const player = state.players[playerId];
    if (!player) return { ...state, lastSoldCardId: undefined };

    // 1) 替换技能定义（普通技能或被动技能）
    const isPassive = player.passiveAbilities?.some(p => p.id === oldAbilityId);
    const newAbilities = isPassive
        ? player.abilities
        : player.abilities.map(a =>
            a.id === oldAbilityId ? { ...newAbilityDef, id: oldAbilityId } : a);
    const newPassiveAbilities = isPassive && player.passiveAbilities
        ? player.passiveAbilities.map(p =>
            p.id === oldAbilityId ? { ...newAbilityDef, id: oldAbilityId } as unknown as typeof p : p)
        : player.passiveAbilities;

    // 2) 更新技能等级
    const newAbilityLevels = { ...player.abilityLevels, [oldAbilityId]: newLevel };

    // 3) 记录升级卡信息
    const upgradeCardByAbilityId = { ...(player.upgradeCardByAbilityId || {}) };
    const cardInHandIndex = player.hand.findIndex(c => c.id === cardId);
    let newHand = player.hand;
    let newDiscard = player.discard;

    if (cardInHandIndex !== -1) {
        const card = player.hand[cardInHandIndex];
        newHand = [...player.hand.slice(0, cardInHandIndex), ...player.hand.slice(cardInHandIndex + 1)];
        newDiscard = [...player.discard, card];
        upgradeCardByAbilityId[oldAbilityId] = { cardId: card.id, cpCost: card.cpCost };
    } else {
        const cardInDiscard = player.discard.find(c => c.id === cardId);
        if (cardInDiscard) {
            upgradeCardByAbilityId[oldAbilityId] = { cardId: cardInDiscard.id, cpCost: cardInDiscard.cpCost };
        }
    }

    return {
        ...state,
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                abilities: newAbilities,
                passiveAbilities: newPassiveAbilities,
                abilityLevels: newAbilityLevels,
                upgradeCardByAbilityId,
                hand: newHand,
                discard: newDiscard,
            },
        },
        lastSoldCardId: undefined,
    };
};
