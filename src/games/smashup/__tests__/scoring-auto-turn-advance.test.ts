import {beforeEach,expect,it} from 'vitest';
import {initAllAbilities,resetAbilityInit} from '../abilities';
import {makeBase,makeCard,makeMatchState,makeMinion,makePlayer,makeState,getSimpleChoicePrompt,getPromptOptions,respondToPrompt} from './helpers';
import {runCommand} from './testRunner';
beforeEach(()=>{resetAbilityInit();initAllAbilities();});
it('两个基地计分后自动开始下一玩家回合',()=>{
 const locals=Array.from({length:9},(_,i)=>makeMinion(`local-${i}`,'innsmouth_the_locals','0',2,{tempPowerModifier:1}));
 const shield=['shield_phil_coulson','shield_agent','shield_phil_coulson','shield_agent'].map((id,i)=>makeMinion(`shield-${i}`,id,'0',i%2?2:3,{tempPowerModifier:i===0?7:1}));
 const core=makeState({players:{'0':makePlayer('0',{deck:[makeCard('draw1','robot_zapbot','minion','0'),makeCard('draw2','robot_zapbot','minion','0')]}),'1':makePlayer('1')},bases:[makeBase({defId:'base_ritual_site',minions:locals,ongoingActions:[{uid:'slimy',defId:'wraithrustlers_slimy',ownerId:'0'}]}),makeBase({defId:'base_the_mothership',minions:shield}),makeBase({defId:'base_egg_chamber_pod',minions:[]})],baseDeck:['base_the_jungle','base_juice_bar','base_central_brain']});
 const state=makeMatchState(core);state.sys.phase='playCards';
 const advance=runCommand(state,{type:'ADVANCE_PHASE',playerId:'0'} as any);expect(advance.success,advance.error).toBe(true);
 const prompt=getSimpleChoicePrompt(advance.finalState,'multi_base_scoring');
 const result=respondToPrompt(advance.finalState,getPromptOptions(prompt)[0].id,'0');expect(result.success,result.error).toBe(true);
 expect(result.events.filter(e=>e.type==='su:base_scored')).toHaveLength(2);
 expect(result.finalState.sys.phase).toBe('playCards');expect(result.finalState.core.currentPlayerIndex).toBe(1);
});
