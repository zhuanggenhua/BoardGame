import type { CardInstance, PlayerState } from './types';

/** Zone membership is derived from authoritative selection/activation, never a second hand state. */
export function projectFateHand(player: Pick<PlayerState, 'hand' | 'selectedAttackIds' | 'activeAttackIds'>) {
    const active = new Set(player.activeAttackIds);
    const selected = new Set(player.selectedAttackIds);
    const byId = new Map(player.hand.map(card => [card.id, card]));
    const orderedCards = (ids: readonly string[]) => ids.flatMap(id => { const card = byId.get(id); return card ? [card] : []; });
    const inPlay = (card: CardInstance) => active.has(card.id) || selected.has(card.id);
    return {
        available: player.hand.filter(card => !inPlay(card)),
        staged: orderedCards(player.selectedAttackIds).filter(card => !active.has(card.id)),
        active: orderedCards(player.activeAttackIds),
    };
}
