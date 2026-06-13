import type { PlayerId } from '../../../engine/types';
import type { TableCard } from '../foundation';
import { getFantasyRealmsDiscardEndThreshold } from '../foundation';
import type { FantasyRealmsCore, FantasyRealmsPlayerState } from './types';

const HIDDEN_HAND_CARD_ID_PREFIX = '__fantasyrealms_hidden_hand__';
const HIDDEN_DRAW_CARD_ID_PREFIX = '__fantasyrealms_hidden_draw__';

function createHiddenCard(id: string): TableCard {
    return {
        id,
        suit: '野牌',
        toneClass: 'fr-tone-hidden',
        name: 'Hidden Card',
        displayNameZh: '隐藏卡牌',
        score: 0,
        text: '',
        textZh: '',
    };
}

function shouldRevealAllHands(state: FantasyRealmsCore): boolean {
    if (state.playerIds.length === 2) {
        const allHandsFull = state.playerIds.every((playerId) => (state.players[playerId]?.hand.length ?? 0) >= 7);
        return allHandsFull
            && state.discardPile.length >= getFantasyRealmsDiscardEndThreshold(state.playerIds.length);
    }
    return state.discardPile.length >= getFantasyRealmsDiscardEndThreshold(state.playerIds.length);
}

function maskPlayerHand(
    player: FantasyRealmsPlayerState,
    viewingPlayerId: PlayerId,
    revealAllHands: boolean,
): FantasyRealmsPlayerState {
    if (revealAllHands || player.id === viewingPlayerId) {
        return {
            ...player,
            hand: player.hand.map((card) => ({ ...card })),
            scoreBreakdown: player.scoreBreakdown.map((line) => ({ ...line })),
        };
    }

    return {
        ...player,
        hand: player.hand.map((_, index) => createHiddenCard(`${HIDDEN_HAND_CARD_ID_PREFIX}:${player.id}:${index}`)),
        score: 0,
        scoreBreakdown: [],
    };
}

export function playerView(state: FantasyRealmsCore, viewingPlayerId: PlayerId): Partial<FantasyRealmsCore> {
    const revealAllHands = shouldRevealAllHands(state);
    const players = Object.fromEntries(
        Object.entries(state.players).map(([playerId, player]) => [
            playerId,
            maskPlayerHand(player, viewingPlayerId, revealAllHands),
        ]),
    ) as Record<PlayerId, FantasyRealmsPlayerState>;
    const hiddenFocusCard = !revealAllHands
        && Boolean(state.focusCardId)
        && Object.entries(state.players).some(([playerId, player]) => (
            playerId !== viewingPlayerId && player.hand.some((card) => card.id === state.focusCardId)
        ));

    return {
        drawPile: state.drawPile.map((_, index) => createHiddenCard(`${HIDDEN_DRAW_CARD_ID_PREFIX}:${index}`)),
        players,
        focusCardId: hiddenFocusCard ? null : state.focusCardId,
        hiddenFocusCard,
    };
}
