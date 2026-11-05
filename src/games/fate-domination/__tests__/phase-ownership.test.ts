import { expect, it } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { FateDominationDomain } from '../domain';
import type { FateDominationCommand } from '../domain';

const adapter = createReplayAdapter(FateDominationDomain, 'phase-ownership');
it('准备逐人确认，部署行动战斗沿同一顺位，全员结束战斗后才开始结算', () => {
    let state = adapter.setup(['0', '1', '2']);
    const apply = (command: FateDominationCommand) => {
        expect(FateDominationDomain.validate(state, command)).toEqual({ valid: true });
        state = adapter.execute(state, command).state;
    };
    for (const id of ['0', '1', '2']) {
        expect(state.core.phase).toBe('preparation');
        expect(state.core.currentPlayerId).toBe(id);
        apply({ type: 'ADVANCE_PHASE', playerId: id, payload: {} });
    }
    for (const id of ['0', '1', '2']) {
        apply({ type: 'DEPLOY_MASTER', playerId: id, payload: { locationId: 'workshop' } });
        apply({ type: 'ADVANCE_PHASE', playerId: id, payload: {} });
    }
    for (const id of ['0', '1', '2']) {
        // This contract isolates turn ownership, not attack legality.
        state.core.players[id].normalAttackPlayed = true;
        apply({ type: 'PASS_ACTION', playerId: id, payload: {} });
    }
    for (const id of ['0', '1', '2']) {
        expect(state.core.currentPlayerId).toBe(id);
        expect(state.core.battleResolution).toBeUndefined();
        expect(FateDominationDomain.validate(state, { type: 'RESOLVE_LOCATION', playerId: id, payload: { locationId: 'miyama' } }).valid).toBe(false);
        apply({ type: 'ADVANCE_PHASE', playerId: id, payload: {} });
    }
    expect(state.core.battleResolution?.step).toBe('locations');
});
it('下轮顺位按上一轮顺位旋转而非获胜者，部署沿该顺位', () => {
    let state = adapter.setup(['0', '1', '2']);
    state.core.turnOrder = ['2', '0', '1'];
    state.core = FateDominationDomain.reduce(state.core, { type: 'BATTLE_RESOLVED', timestamp: 1, payload: { nextRound: 2, result: { playerId: '0', locationId: 'workshop', power: 0, eventVictoryPoints: 0, competitionVictoryPoints: 0, totalVictoryPoints: 0, status: 'deferred' } } });
    expect(state.core.turnOrder).toEqual(['0', '1', '2']);
    expect(state.core.currentPlayerId).toBe('0');
});
it('正式提交中士郎首次免淘汰归零后获得新局势魔力，随后淘汰者不获下轮行动权',async()=>{
 const {createInitialSystemState,createSeededRandom,executePipeline}=await import('../../../engine');
 const {engineConfig}=await import('../game');
 const ids=['0','1','2','3','4'];
 for(const round of [8,9]){
  const state=adapter.setup(ids);state.core.round=round;state.core.phase='battle';
  state.core.battleResolution={frameId:'near-end',round,locationIds:['miyama','shinto','recon'],resolvedLocationIds:['miyama','shinto','recon'],step:'awards'};
  state.core.players['0'].masterId='m_shirou_emiya';state.core.players['0'].mana=9;state.core.players['0'].eliminationProtectionUsed=round===9;
  for(const id of ids)state.core.players[id].victoryPoints=id==='0'?0:10;
  state.core.turnOrder=['4','0','1','2','3'];state.core.currentPlayerId='4';
  state.sys=createInitialSystemState(ids,engineConfig.systems,'elimination-round');
  const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,{type:'ADVANCE_PHASE',playerId:'4',payload:{}},createSeededRandom('elimination-round'),ids);
  expect(result.success).toBe(true);
  if(round===8){expect(result.state.core.players['0'].eliminated).toBe(false);expect(result.state.core.players['0'].mana).toBe(4);expect(result.state.core.players['0'].eliminationProtectionUsed).toBe(true);}
  else {expect(result.state.core.players['0'].eliminated).toBe(true);expect(result.state.core.currentPlayerId).not.toBe('0');expect(result.state.core.currentTurnIndex).toBe(result.state.core.turnOrder.indexOf(result.state.core.currentPlayerId));}
 }
});
