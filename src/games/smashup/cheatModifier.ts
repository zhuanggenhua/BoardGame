/**
 * SmashUp 专用作弊适配器
 *
 * 为 CheatSystem 提供 SmashUp 游戏状态的资源读写和发牌操作。
 * SmashUp 的 CardInstance 使用 defId 而非 spriteIndex，
 * 因此 dealCardByAtlasIndex / dealCardToDiscard 按 defId 匹配。
 */

import type { CheatResourceModifier } from '../../engine/systems/CheatSystem';
import type { PlayerId } from '../../engine/types';
import type { SmashUpCore } from './domain/types';

export const smashUpCheatModifier: CheatResourceModifier<SmashUpCore> = {
    getResource: (core: SmashUpCore, playerId: PlayerId, resourceId: string): number | undefined => {
        if (resourceId === 'vp') {
            return core.players[playerId]?.vp;
        }
        return undefined;
    },

    setResource: (core: SmashUpCore, playerId: PlayerId, resourceId: string, value: number): SmashUpCore => {
        if (resourceId === 'vp') {
            const player = core.players[playerId];
            if (!player) return core;
            return {
                ...core,
                players: {
                    ...core.players,
                    [playerId]: { ...player, vp: value },
                },
            };
        }
        return core;
    },

    dealCardByIndex: (core: SmashUpCore, playerId: PlayerId, deckIndex: number): SmashUpCore => {
        const player = core.players[playerId];
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) {
            return core;
        }
        
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);
        
        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    deck: newDeck,
                    hand: [...player.hand, card],
                },
            },
        };
    },

    dealCardByAtlasIndex: (core: SmashUpCore, playerId: PlayerId, _atlasIndex: number): SmashUpCore => {
        // SmashUp 使用 defId 而非 spriteIndex，atlasIndex 参数在此语境下
        // 作为 defId 的数字映射不适用。按 defId 查找需要字符串，
        // 此方法保留接口兼容但直接按牌库索引回退处理。
        const player = core.players[playerId];
        if (!player) return core;
        // SmashUp 没有 spriteIndex，无法按图集索引匹配，返回原状态
        return core;
    },

    dealCardToDiscard: (core: SmashUpCore, playerId: PlayerId, _atlasIndex: number): SmashUpCore => {
        // 同上，SmashUp 没有 spriteIndex/atlasIndex 概念
        const player = core.players[playerId];
        if (!player) return core;
        return core;
    },

    /**
     * 刷新指定基地（从基地牌库抽取新基地替换）
     * @param core 游戏状态
     * @param baseIndex 要刷新的基地索引
     * @returns 更新后的状态（不生成事件，直接替换状态）
     */
    refreshBase: (core: SmashUpCore, baseIndex: number): { core: SmashUpCore; events: Array<{ type: string; payload: unknown; timestamp: number }> } => {
        // 验证基地索引
        if (baseIndex < 0 || baseIndex >= core.bases.length) {
            return { core, events: [] };
        }

        // 验证基地牌库是否有牌
        if (core.baseDeck.length === 0) {
            return { core, events: [] };
        }

        const oldBase = core.bases[baseIndex];
        const newBaseDefId = core.baseDeck[0];

        // 直接替换基地（不使用事件，避免与 BASE_SCORED 的插入逻辑冲突）
        const newBaseDeck = core.baseDeck.slice(1);
        const newBase = {
            defId: newBaseDefId,
            minions: [],
            ongoingActions: [],
        };
        const newBases = [...core.bases];
        newBases[baseIndex] = newBase; // 直接替换

        const newCore = {
            ...core,
            bases: newBases,
            baseDeck: newBaseDeck,
        };

        return { core: newCore, events: [] };
    },

    /**
     * 刷新所有基地（从基地牌库抽取新基地替换所有场上基地）
     * 如果基地牌库不足，则只刷新部分基地，剩余基地清空
     */
    refreshAllBases: (core: SmashUpCore): { core: SmashUpCore; events: Array<{ type: string; payload: unknown; timestamp: number }> } => {
        const basesCount = core.bases.length;
        const availableBasesCount = Math.min(basesCount, core.baseDeck.length);
        
        // 从基地牌库抽取可用的基地
        const newBases = core.baseDeck.slice(0, availableBasesCount).map(defId => ({
            defId,
            minions: [],
            ongoingActions: [],
        }));
        const newBaseDeck = core.baseDeck.slice(availableBasesCount);

        const newCore = {
            ...core,
            bases: newBases,
            baseDeck: newBaseDeck,
        };

        return { core: newCore, events: [] };
    },

    /**
     * 删除手牌（按 uid 从手牌移入弃牌堆）
     */
    removeHandCard: (core: SmashUpCore, playerId: PlayerId, cardUid: string): SmashUpCore => {
        const player = core.players[playerId];
        if (!player) return core;

        const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
        if (cardIndex === -1) return core;

        const card = player.hand[cardIndex];
        const newHand = [...player.hand];
        newHand.splice(cardIndex, 1);

        return {
            ...core,
            players: {
                ...core.players,
                [playerId]: {
                    ...player,
                    hand: newHand,
                    discard: [...player.discard, card],
                },
            },
        };
    },
};
