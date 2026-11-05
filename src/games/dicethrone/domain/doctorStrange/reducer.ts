import type { DiceThroneCore, HeroState } from '../core-types';
import type { DiceThroneEvent } from '../events';
import { markPendingAttackPostDamageFollowUpResolved } from '../utils';

export function reduceDoctorStrangeEvent(state: DiceThroneCore, event: DiceThroneEvent): DiceThroneCore | undefined {
    const write = (playerId: string, player: HeroState): DiceThroneCore => ({ ...state, players: { ...state.players, [playerId]: player } });
    if (event.type === 'STRANGE_OPERATION_REQUESTED') return state;
    if (event.type === 'STRANGE_OPERATION_RESOLVED') {
        const pendingAttack = markPendingAttackPostDamageFollowUpResolved(
            state.pendingAttack,
            event.payload.sourceId,
        );
        return pendingAttack === state.pendingAttack ? state : { ...state, pendingAttack: pendingAttack ?? null };
    }
    if (event.type === 'STRANGE_BANDS_ACTIVATED') {
        const player = state.players[event.payload.playerId];
        return write(event.payload.playerId, { ...player, crimsonBandsActiveTurn: state.turnNumber });
    }
    if (event.type === 'STRANGE_CARD_MOVED') {
        const { playerId, cardId, from, to, position, passive } = event.payload;
        const player = state.players[playerId];
        const source = player[from] ?? [];
        const card = source.find(candidate => candidate.id === cardId);
        if (!card) throw new Error(`法术卡区事件缺少来源卡：${playerId}/${from}/${cardId}`);
        if (from === to) return state;
        const destination = player[to] ?? [];
        if (destination.some(candidate => candidate.id === cardId)) throw new Error(`法术卡牌重复归属：${cardId}`);
        return write(playerId, {
            ...player,
            [from]: source.filter(candidate => candidate.id !== cardId),
            [to]: to === 'deck' && position === 'top' ? [card, ...destination] : [...destination, card],
            ...(passive ? { spellPreparedTurn: state.turnNumber } : {}),
        });
    }
    if (event.type === 'STRANGE_DECK_ORDERED') {
        const { playerId, cardIds } = event.payload;
        const player = state.players[playerId];
        const selected = new Set(cardIds);
        if (selected.size !== cardIds.length || cardIds.some(id => !player.deck.some(card => card.id === id))) {
            throw new Error('法术牌库排序事件包含重复或不存在卡牌');
        }
        const cards = new Map(player.deck.map(card => [card.id, card]));
        return write(playerId, { ...player, deck: [...cardIds.map(id => cards.get(id)!), ...player.deck.filter(card => !selected.has(card.id))] });
    }
    return undefined;
}
