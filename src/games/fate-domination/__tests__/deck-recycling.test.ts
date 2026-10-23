import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FATE_SITUATIONS } from '../data';
import { FATE_MASTERS, FATE_SERVANTS } from '../data/identities';
import { execute } from '../domain/reducer';
import type { RandomFn } from '../../../engine/types';
const random: RandomFn = { random: () => .5, d: () => 1, range: min => min, shuffle: cards => [...cards].reverse() };
it('牌堆用尽才洗弃牌补足，事件也回收，回放无再次随机', () => {
    const adapter = createReplayAdapter(FateDominationDomain, 'recycle');
    let state = adapter.setup(['0', '1', '2']);
    for (const [index, playerId] of ['0', '1', '2'].entries()) {
        const masterId = FATE_MASTERS[index].id;
        const servantId = FATE_SERVANTS[index].id;
        state = adapter.execute(state, { type: 'SELECT_MASTER', playerId, payload: { masterId } }).state;
        state = adapter.execute(state, { type: 'SELECT_SERVANT', playerId, payload: { servantId } }).state;
        state = adapter.execute(state, { type: 'ADVANCE_PHASE', playerId, payload: {} }).state;
        expect(state.core.players[playerId].hand).toHaveLength(3);
    }
    expect(state.core.phase).toBe('outpost');
    state.core.situationDeck=[FATE_SITUATIONS.find(s=>s.id==='sit4')!];
    state.core.phase = 'battle'; state.core.battleResolution = { frameId: 'test', round: 1, locationIds: ['miyama', 'shinto', 'recon'], resolvedLocationIds: ['miyama', 'shinto', 'recon'], step: 'awards' };
    const player = state.core.players['0'];
    const allIds = [...player.hand, ...player.deck].map(card => card.id).sort();
    player.discard = [...player.deck]; player.deck = []; player.activeAttackIds = player.hand.slice(0, 2).map(card => card.id);
    state.core.eventDiscard = [...state.core.eventDeck]; state.core.eventDeck = [];
    const allEvents = [...state.core.eventDiscard, ...state.core.currentEvents.miyama, ...state.core.currentEvents.shinto].map(card => card.id).sort();
    const events = execute(state, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, random);
    const next = events.reduce(FateDominationDomain.reduce, state.core);
    expect(next.players['0'].hand).toHaveLength(3);
    expect([...next.players['0'].hand, ...next.players['0'].deck, ...next.players['0'].discard].map(card => card.id).sort()).toEqual(allIds);
    expect(next.currentEvents.miyama).toHaveLength(1); expect(next.currentEvents.shinto).toHaveLength(1);
    expect([...next.eventDeck, ...next.eventDiscard, ...next.currentEvents.miyama, ...next.currentEvents.shinto].map(card => card.id).sort()).toEqual(allEvents);
    expect(events.reduce(FateDominationDomain.reduce, state.core)).toEqual(next);
});
it('三人确认身份前不洗牌；各自首次准备才洗牌并只发一次三张', () => {
    const withShuffle = (reverseOrder: boolean) => {
        const attackDeckShuffleCalls: string[][] = [];
        const controlled: RandomFn = { ...random, shuffle: <T,>(cards: T[]) => {
            if (cards.length === 12 && cards.every(card => Boolean(card && typeof card === 'object' && 'definitionId' in card))) {
                attackDeckShuffleCalls.push((cards as Array<{ id: string }>).map(card => card.id));
            }
            return reverseOrder ? [...cards].reverse() : [...cards];
        } };
        const ids = ['0', '1', '2'];
        let core = FateDominationDomain.setup(ids, controlled);
        expect(attackDeckShuffleCalls).toEqual([]);
        for (const [index, playerId] of ids.entries()) {
            const masterId = FATE_MASTERS[index].id;
            const servantId = index === 0 ? 'servant-archer' : FATE_SERVANTS[index].id;
            for (const command of [
                { type: 'SELECT_MASTER', playerId, payload: { masterId } },
                { type: 'SELECT_SERVANT', playerId, payload: { servantId } },
            ] as const) {
                core = execute({ core } as never, command, controlled).reduce(FateDominationDomain.reduce, core);
            }
            expect(core.players[playerId].hand).toEqual([]);
            const preparationEvents = execute({ core } as never, { type: 'ADVANCE_PHASE', playerId, payload: {} }, controlled);
            const deals = preparationEvents.filter(event => event.type === 'INITIAL_ATTACK_HAND_DEALT');
            expect(deals).toHaveLength(1);
            core = preparationEvents.reduce(FateDominationDomain.reduce, core);
            expect(core.players[playerId].hand).toHaveLength(3);
            expect(core.initialAttackHandDealtPlayerIds).toContain(playerId);
        }
        expect(core.phase).toBe('outpost');
        expect(core.initialAttackHandDealtPlayerIds).toEqual(ids);
        expect(attackDeckShuffleCalls).toHaveLength(3);
        expect(core.players['0'].hand.concat(core.players['0'].deck).map(card => card.definitionId).sort())
            .toEqual([...FATE_SERVANTS.find(servant => servant.id === 'servant-archer')!.deck].sort());
        const lateEvents = execute({ core } as never, { type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, controlled);
        expect(lateEvents.filter(event => event.type === 'INITIAL_ATTACK_HAND_DEALT')).toEqual([]);
        expect(attackDeckShuffleCalls).toHaveLength(3);
        return core.players['0'].hand.concat(core.players['0'].deck).map(card => card.id);
    };
    expect(withShuffle(false)).not.toEqual(withShuffle(true));
});
