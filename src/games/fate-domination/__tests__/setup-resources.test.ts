import { fateSituationEventCounts } from '../domain/environmentRules';
import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { FATE_MASTER_BY_ID, FATE_EVENTS } from '../data';

const adapter = createReplayAdapter(FateDominationDomain, 'setup-resources');
it('首轮局势魔力在初始值之后发放，切换御主不会漏发或重复发放', () => {
    let state = adapter.setup(['0', '1', '2']);
    const bonus = state.core.situation.printedMana;
    const first = state.core.players['0'];
    expect(first.mana).toBe((FATE_MASTER_BY_ID[first.masterId].initMana ?? 4) + bonus);
    for (let i = 0; i < 2; i++) {
        const result = adapter.execute(state, { type: 'SELECT_MASTER', playerId: '0', payload: { masterId: 'm_zouken' } });
        expect(result.events.map(event => event.type)).toContain('MASTER_SELECTED');
        state = result.state;
        expect(state.core.players['0'].mana).toBe(Math.min(16, 10 + bonus));
        expect(state.core.players['0'].commandSpells).toBe(0);
    }
    const regular = FATE_MASTER_BY_ID[first.masterId];
    state = adapter.execute(state, { type: 'SELECT_MASTER', playerId: '0', payload: { masterId: regular.id } }).state;
    expect(state.core.players['0'].commandSpells).toBe(3);
    expect(state.core.players['0'].mana).toBe((regular.initMana ?? 4) + bonus);
});
it('后续准备和部署分别遵守脏砚 16 与普通御主 12 魔力上限', () => {
    let state = adapter.setup(['0', '1', '2']);
    state = adapter.execute(state, { type: 'SELECT_MASTER', playerId: '0', payload: { masterId: 'm_zouken' } }).state;
    state.core.players['0'].mana = 15;
    state.core.players['1'].mana = 11;
    state.core.situationDeck = [{ ...state.core.situationDeck![0], printedMana: 4 }, ...state.core.situationDeck!.slice(1)];
    const next = FateDominationDomain.reduce(state.core, { type: 'BATTLE_RESOLVED', payload: { nextRound: 2, result: { playerId: '0', totalVictoryPoints: 0 } }, timestamp: 1 } as never);
    expect(next.players['0'].mana).toBe(16);
    expect(next.players['1'].mana).toBe(12);
    state.core.phase = 'outpost';
    state = adapter.execute(state, { type: 'DEPLOY_MASTER', playerId: '0', payload: { locationId: 'workshop' } }).state;
    expect(state.core.players['0'].mana).toBe(16);
});
it('令咒回复不超过普通魔力上限', () => {
    const state = adapter.setup(['0', '1', '2']);
    state.core.phase = 'action'; state.core.players['0'].mana = 11;
    const result = adapter.execute(state, { type: 'USE_COMMAND_SPELL', playerId: '0', payload: { effect: 'mana' } });
    expect(result.events.map(event => event.type)).toContain('COMMAND_SPELL_USED');
    expect(result.state.core.players['0'].mana).toBe(12);
    expect(result.state.core.players['0'].commandSpells).toBe(2);
});
it('首轮基础与局势追加事件都从完整洗混牌库抽取，不固定或排除命运之战', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
        const core = createReplayAdapter(FateDominationDomain, `events-${seed}`).setup(['0', '1', '2']).core;
        const dealt = [...core.currentEvents.miyama, ...core.currentEvents.shinto];
        const counts=fateSituationEventCounts(core.situation);
        expect(dealt).toHaveLength(counts.miyama+counts.shinto);
        expect(core.battlefield.miyama.eventCards).toEqual(core.currentEvents.miyama);
        expect(core.battlefield.shinto.eventCards).toEqual(core.currentEvents.shinto);
        expect(core.eventDeckCount).toBe(FATE_EVENTS.length - dealt.length);
        expect([...dealt, ...core.eventDeck].map(card => card.id).sort()).toEqual(FATE_EVENTS.map(card => card.id).sort());
        seen.add(core.currentEvents.miyama[0].id);
    }
    expect(seen.size).toBeGreaterThan(1);
});
