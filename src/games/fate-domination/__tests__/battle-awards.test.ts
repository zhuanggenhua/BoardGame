import { describe, expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import { execute } from '../domain/reducer';
import type { RandomFn } from '../../../engine/types';

const random: RandomFn = { random: () => .5, d: () => 1, range: min => min, shuffle: cards => [...cards] };
const fixture = (ids = ['0']) => {
    const state = createReplayAdapter(FateDominationDomain, 'battle-awards').setup(['0', '1', '2']);
    state.core.phase = 'battle';
    state.core.currentPlayerId = '0';
    for (const id of state.core.playerIds) Object.assign(state.core.players[id], { locationId: ids.includes(id) ? 'miyama' : 'workshop', deploymentSlot: null, activeAttackIds: [], activeSkills: [], victoryPoints: 0 });
    state.core.battlefield.miyama.playerIds = ids;
    state.core.battlefield.miyama.eventCards = [{ ...state.core.currentEvents.miyama[0], victoryPoints: 5 }];
    return state;
};
const resolve = (state: ReturnType<typeof fixture>, locationId: 'miyama' | 'recon' = 'miyama') => execute(state, { type: 'RESOLVE_LOCATION', playerId: '0', payload: { locationId } }, random);

describe('CHM 战果和圣杯终局', () => {
    it('无人争夺只得事件分，不得竞争分', () => {
        const event = resolve(fixture()).find(e => e.type === 'LOCATION_RESOLVED')!;
        expect(event.payload.results[0]).toMatchObject({ eventVictoryPoints: 5, competitionVictoryPoints: 0, totalVictoryPoints: 5 });
    });
    it('并列胜者平分事件加竞争的总和并向上取整', () => {
        const event = resolve(fixture(['0', '1'])).find(e => e.type === 'LOCATION_RESOLVED')!;
        expect(event.payload.results.map(r => r.totalVictoryPoints)).toEqual([4, 4]);
    });
    it('侦察获得固定两分', () => {
        const state = fixture([]);
        state.core.players['0'].locationId = 'recon';
        state.core.battlefield.recon.playerIds = ['0'];
        state.core.players['0'].defeatMarkers = [{ id: 'defeat', sourceId: 'test' } as never];
        const event = resolve(state, 'recon').find(e => e.type === 'LOCATION_RESOLVED')!;
        expect(event.payload.results[0]).toMatchObject({ status: 'recon', totalVictoryPoints: 2 });
    });
    it('最终平分由深山町唯一获胜者破平，否则全员失败', () => {
        const state = fixture(['1']);
        state.core.round = 11;
        state.core.players['0'].victoryPoints = 5;
        state.core.resolvedLocations = ['shinto', 'recon'];
        const result = resolve(state).find(e => e.type === 'BATTLE_RESOLVED')!;
        expect(result.payload.gameResult?.winner).toBe('1');
        state.core.players['0'].victoryPoints = 0;
        state.core.battlefield.miyama.playerIds = ['0', '1'];
        state.core.players['0'].locationId = 'miyama';
        const tied = resolve(state).find(e => e.type === 'BATTLE_RESOLVED')!;
        expect(tied.payload.gameResult).toMatchObject({ winners: [], draw: false });
        expect(tied.payload.gameResult?.winner).toBeUndefined();
    });
});

it('空战不能重复发放上一轮的战果', () => {
    const state = fixture([]);
    state.core.battleResolution = { frameId: 'empty', round: 1, locationIds: ['miyama','shinto','recon'], resolvedLocationIds: ['miyama','shinto','recon'], step: 'awards' };
    state.core.battleResult = { playerId:'0', locationId:'miyama', power:9, eventVictoryPoints:5, competitionVictoryPoints:2, totalVictoryPoints:7, status:'representative-win' };
    const events=execute(state,{type:'ADVANCE_PHASE',playerId:'0',payload:{}},random);
    const next=events.reduce(FateDominationDomain.reduce,state.core);
    expect(next.players['0'].victoryPoints).toBe(0);
});
it('运行中的命运之战战果按CHM锁定值两分，不沿用demo三分',async()=>{
 const {FATE_EVENTS}=await import('../data');expect(FATE_EVENTS.find(event=>event.id==='fuyuki_E6')?.victoryPoints).toBe(2);
});
