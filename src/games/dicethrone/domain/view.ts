/**
 * DiceThrone 视图过滤
 * 实现隐藏信息逻辑（对手手牌不可见）
 */

import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore, HeroState, AbilityCard } from './types';

/**
 * 隐藏卡牌内容（只保留 id 用于数量统计）
 */
const hideCardContent = (card: AbilityCard): AbilityCard => ({
    ...card,
    name: '???',
    description: '???',
    atlasIndex: undefined,
});

/**
 * 过滤玩家状态视图
 */
const filterPlayerView = (
    player: HeroState,
    isOwner: boolean
): HeroState => {
    if (isOwner) {
        // 自己的状态完全可见
        return player;
    }

    // 对手：隐藏手牌内容、牌库内容
    return {
        ...player,
        hand: player.hand.map(hideCardContent),
        deck: player.deck.map(hideCardContent),
        // 弃牌堆公开可见
        discard: player.discard,
    };
};

/**
 * 生成玩家视图
 * 隐藏对手的手牌和牌库内容
 */
export const playerView = (
    state: DiceThroneCore,
    viewingPlayerId: PlayerId
): Partial<DiceThroneCore> => {
    const filteredPlayers: Record<PlayerId, HeroState> = {};

    for (const [playerId, player] of Object.entries(state.players)) {
        const isOwner = playerId === viewingPlayerId;
        filteredPlayers[playerId] = filterPlayerView(player, isOwner);
    }

    return {
        players: filteredPlayers,
    };
};
