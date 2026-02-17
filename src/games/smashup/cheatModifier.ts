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
            console.log('[CheatModifier] dealCardByIndex 参数无效:', {
                playerId,
                deckIndex,
                playerExists: !!player,
                deckLength: player?.deck.length ?? 0,
            });
            return core;
        }
        
        const deckSnapshot = player.deck.map((c, i) => ({ idx: i, defId: c.defId, uid: c.uid }));
        console.log('[CheatModifier] dealCardByIndex 调用:', {
            playerId,
            deckIndex,
            playerExists: !!player,
            deckLength: player.deck.length,
            deckSnapshot,
        });
        
        const newDeck = [...player.deck];
        const [card] = newDeck.splice(deckIndex, 1);
        
        console.log('[CheatModifier] dealCardByIndex 执行:', {
            removedCard: { defId: card.defId, uid: card.uid },
            deckLengthBefore: player.deck.length,
            deckLengthAfter: newDeck.length,
            handLengthBefore: player.hand.length,
            handLengthAfter: player.hand.length + 1,
        });
        
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
     * @returns 更新后的状态和事件
     */
    refreshBase: (core: SmashUpCore, baseIndex: number): { core: SmashUpCore; events: Array<{ type: string; payload: unknown; timestamp: number }> } => {
        // 验证基地索引
        if (baseIndex < 0 || baseIndex >= core.bases.length) {
            console.warn('[CheatModifier] refreshBase 基地索引无效:', { baseIndex, basesLength: core.bases.length });
            return { core, events: [] };
        }

        // 验证基地牌库是否有牌
        if (core.baseDeck.length === 0) {
            console.warn('[CheatModifier] refreshBase 基地牌库为空，无法刷新');
            return { core, events: [] };
        }

        const oldBase = core.bases[baseIndex];
        const newBaseDefId = core.baseDeck[0];

        console.log('[CheatModifier] refreshBase 执行:', {
            baseIndex,
            oldBaseDefId: oldBase.defId,
            newBaseDefId,
            baseDeckLength: core.baseDeck.length,
        });

        // 生成 BASE_REPLACED 事件（keepCards=false，清空随从和行动卡）
        const event = {
            type: 'su:base_replaced' as const,
            payload: {
                baseIndex,
                oldBaseDefId: oldBase.defId,
                newBaseDefId,
                keepCards: false,
            },
            timestamp: Date.now(),
        };

        // 更新状态：移除旧基地，插入新基地，更新基地牌库
        const newBaseDeck = core.baseDeck.filter(id => id !== newBaseDefId);
        const newBase = {
            defId: newBaseDefId,
            minions: [],
            ongoingActions: [],
        };
        const newBases = [...core.bases];
        newBases.splice(baseIndex, 1, newBase);

        const newCore = {
            ...core,
            bases: newBases,
            baseDeck: newBaseDeck,
        };

        return { core: newCore, events: [event] };
    },

    /**
     * 刷新所有基地（从基地牌库抽取新基地替换所有场上基地）
     * @param core 游戏状态
     * @returns 更新后的状态和事件
     */
    refreshAllBases: (core: SmashUpCore): { core: SmashUpCore; events: Array<{ type: string; payload: unknown; timestamp: number }> } => {
        const basesCount = core.bases.length;
        
        // 验证基地牌库是否有足够的牌
        if (core.baseDeck.length < basesCount) {
            console.warn('[CheatModifier] refreshAllBases 基地牌库不足:', { 
                basesCount, 
                baseDeckLength: core.baseDeck.length 
            });
            return { core, events: [] };
        }

        console.log('[CheatModifier] refreshAllBases 执行:', {
            basesCount,
            oldBases: core.bases.map(b => b.defId),
            newBases: core.baseDeck.slice(0, basesCount),
            baseDeckLength: core.baseDeck.length,
        });

        const events: Array<{ type: string; payload: unknown; timestamp: number }> = [];
        let updatedCore = core;

        // 依次刷新每个基地
        for (let i = 0; i < basesCount; i++) {
            const oldBase = updatedCore.bases[i];
            const newBaseDefId = updatedCore.baseDeck[0];

            // 生成 BASE_REPLACED 事件
            const event = {
                type: 'su:base_replaced' as const,
                payload: {
                    baseIndex: i,
                    oldBaseDefId: oldBase.defId,
                    newBaseDefId,
                    keepCards: false,
                },
                timestamp: Date.now(),
            };
            events.push(event);

            // 更新状态
            const newBaseDeck = updatedCore.baseDeck.filter(id => id !== newBaseDefId);
            const newBase = {
                defId: newBaseDefId,
                minions: [],
                ongoingActions: [],
            };
            const newBases = [...updatedCore.bases];
            newBases.splice(i, 1, newBase);

            updatedCore = {
                ...updatedCore,
                bases: newBases,
                baseDeck: newBaseDeck,
            };
        }

        return { core: updatedCore, events };
    },
};
