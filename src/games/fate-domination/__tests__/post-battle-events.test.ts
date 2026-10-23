import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FATE_EVENTS } from '../data';

it('地脉战后给每名在场者魔力，包括单人败北，不提前影响其他战场', () => {
    const adapter = createReplayAdapter(FateDominationDomain, 'leyline-reward');
    let state = adapter.setup(['0', '1', '2']);
    state.core.phase = 'battle';
    state.core.battleResolution = { frameId: 'battle', round: 1, locationIds: ['miyama', 'shinto', 'recon'], resolvedLocationIds: [], step: 'locations' };
    for (const player of Object.values(state.core.players)) { player.mana = 1; player.locationId = null; }
    state.core.players['0'].locationId = 'miyama';
    state.core.players['0'].defeatMarkers = [{ id: 'defeated', direct: true, duration: 'round-end' }];
    state.core.battlefield.miyama.playerIds = ['0'];
    state.core.battlefield.miyama.eventCards = [FATE_EVENTS.find(card => card.id === 'fuyuki_E18')!];
    state.core.battlefield.shinto.eventCards = [];
    state.core.currentEvents = { miyama: state.core.battlefield.miyama.eventCards, shinto: [] };
    const first = adapter.execute(state, { type: 'RESOLVE_LOCATION', playerId: '0', payload: { locationId: 'miyama' } });
    state = first.state;
    expect(state.core.players['0'].mana).toBe(1);
    state = adapter.execute(state, { type: 'RESOLVE_LOCATION', playerId: '0', payload: { locationId: 'shinto' } }).state;
    const last = adapter.execute(state, { type: 'RESOLVE_LOCATION', playerId: '0', payload: { locationId: 'recon' } });
    const gains = last.events.filter(event => event.type === 'FATE_MANA_GAINED');
    expect(gains.map(event => event.payload)).toEqual([{ playerId: '0', amount: 2, sourceId: 'fuyuki_E18' }]);
    expect(last.state.core.players['0'].mana - last.state.core.players['1'].mana).toBe(2);
});
