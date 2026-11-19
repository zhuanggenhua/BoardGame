import { beforeEach, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import { runCommand } from './testRunner';

beforeEach(() => { resetAbilityInit(); initAllAbilities(); });
it('凯西琼斯作为行动打出时获得额外随从额度', () => {
 const core = makeState({players:{'0':makePlayer('0',{minionsPlayed:1,hand:[{uid:'kc',defId:'geckos_kc_smith',type:'fusion',owner:'0'} as any, makeCard('robot','robot_zapbot','minion','0')]}),'1':makePlayer('1')},bases:[makeBase('base_juice_bar',[])]});
 const result = runCommand(makeMatchState(core),{type:SU_COMMANDS.PLAY_ACTION,playerId:'0',payload:{cardUid:'kc'}} as any);
 expect(result.success, result.error).toBe(true);
 expect(result.events).toContainEqual(expect.objectContaining({type:SU_EVENTS.LIMIT_MODIFIED,payload:expect.objectContaining({reason:'geckos_kc_smith',limitType:'minion'})}));
 const extra = runCommand(result.finalState,{type:SU_COMMANDS.PLAY_MINION,playerId:'0',payload:{cardUid:'robot',baseIndex:0}} as any);
 expect(extra.success, extra.error).toBe(true);
 expect(extra.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('robot');
});
it('凯西琼斯作为随从打出时获得额外行动额度', () => {
 const core = makeState({players:{'0':makePlayer('0',{hand:[{uid:'kc',defId:'geckos_kc_smith',type:'fusion',owner:'0'} as any]}),'1':makePlayer('1')},bases:[makeBase('base_juice_bar',[])]});
 const result = runCommand(makeMatchState(core),{type:SU_COMMANDS.PLAY_MINION,playerId:'0',payload:{cardUid:'kc',baseIndex:0}} as any);
 expect(result.success, result.error).toBe(true);
 expect(result.events).toContainEqual(expect.objectContaining({type:SU_EVENTS.LIMIT_MODIFIED,payload:expect.objectContaining({reason:'geckos_kc_smith',limitType:'action'})}));
});
