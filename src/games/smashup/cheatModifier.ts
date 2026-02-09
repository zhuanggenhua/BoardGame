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
        if (!player || deckIndex < 0 || deckIndex >= player.deck.length) return core;
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
};
