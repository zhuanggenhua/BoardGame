/**
 * SmashUp 专用作弊适配器
 *
 * 为 CheatSystem 提供 SmashUp 游戏状态的资源读写和 deck-only 发牌操作。
 * SmashUp 的调试面板只允许操作当前剩余牌库，不支持按完整卡池直接补牌。
 * 旧 atlas 相关接口仅为兼容占位，不提供完整卡池注入能力。
 */

import type { CheatResourceModifier } from '../../engine/systems/CheatSystem';
import type { PlayerId } from '../../engine/types';
import type { SmashUpCore } from './domain/types';
import { getBaseDef } from './data/cards';

export const SMASHUP_CHEAT_COMMANDS = {
    REFRESH_BASE: 'su:cheat_refresh_base',
    REFRESH_ALL_BASES: 'su:cheat_refresh_all_bases',
    FORCE_SCORE_BASES_WITH_MINIONS: 'su:cheat_force_score_bases_with_minions',
} as const;

export type SmashUpCheatResult = {
    core: SmashUpCore;
    events: Array<{ type: string; payload: unknown; timestamp: number }>;
};

/**
 * 刷新指定基地（从基地牌库抽取新基地替换）。
 */
export function refreshSmashUpBase(core: SmashUpCore, baseIndex: number): SmashUpCheatResult {
    if (baseIndex < 0 || baseIndex >= core.bases.length) {
        return { core, events: [] };
    }

    if (core.baseDeck.length === 0) {
        return { core, events: [] };
    }

    const newBaseDefId = core.baseDeck[0];
    const newBases = [...core.bases];
    newBases[baseIndex] = {
        defId: newBaseDefId,
        minions: [],
        ongoingActions: [],
    };

    return {
        core: {
            ...core,
            bases: newBases,
            baseDeck: core.baseDeck.slice(1),
        },
        events: [],
    };
}

/**
 * 刷新所有基地（从基地牌库抽取新基地替换所有场上基地）。
 * 如果基地牌库不足，则只刷新可用数量。
 */
export function refreshAllSmashUpBases(core: SmashUpCore): SmashUpCheatResult {
    const availableBasesCount = Math.min(core.bases.length, core.baseDeck.length);
    const newBases = core.baseDeck.slice(0, availableBasesCount).map(defId => ({
        defId,
        minions: [],
        ongoingActions: [],
    }));

    return {
        core: {
            ...core,
            bases: newBases,
            baseDeck: core.baseDeck.slice(availableBasesCount),
        },
        events: [],
    };
}

/**
 * 将所有有随从的基地分上限设为 0（触发立即结算）。
 */
export function forceScoreSmashUpBasesWithMinions(core: SmashUpCore): SmashUpCore {
    const newModifiers: Record<string, number> = { ...core.tempBreakpointModifiers };

    core.bases.forEach((base, index) => {
        if (base.minions.length === 0) return;
        const baseDef = getBaseDef(base.defId);
        if (!baseDef) return;
        newModifiers[String(index)] = -baseDef.breakpoint;
    });

    return {
        ...core,
        tempBreakpointModifiers: newModifiers,
    };
}

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

    customCommands: {
        [SMASHUP_CHEAT_COMMANDS.REFRESH_BASE]: ({ state, command }) => {
            const payload = command.payload as { baseIndex?: number } | undefined;
            const result = refreshSmashUpBase(state.core, payload?.baseIndex ?? -1);
            return {
                halt: true,
                state: { ...state, core: result.core },
                events: result.events,
            };
        },
        [SMASHUP_CHEAT_COMMANDS.REFRESH_ALL_BASES]: ({ state }) => {
            const result = refreshAllSmashUpBases(state.core);
            return {
                halt: true,
                state: { ...state, core: result.core },
                events: result.events,
            };
        },
        [SMASHUP_CHEAT_COMMANDS.FORCE_SCORE_BASES_WITH_MINIONS]: ({ state }) => ({
            halt: true,
            state: {
                ...state,
                core: forceScoreSmashUpBasesWithMinions(state.core),
            },
        }),
    },
};
