import { beforeEach, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
import { getFirstPrompt, getPromptOptions, getPromptSourceId, makeBase, makeMatchState, makeMinion, makeState, respondToPromptOption } from './helpers';
import { runCommand } from './testRunner';
const heads = {shuffle:<T>(a:T[])=>[...a],random:()=>0.9,d:()=>1,range:(min:number)=>min};
beforeEach(()=>{resetAbilityInit();initAllAbilities();});
it('爆弹哥布林正面结算后同回合不能再次使用',()=>{
 const core=makeState({turnNumber:14,scoringEligibleBaseIndices:[0],bases:[makeBase({defId:'base_goblin_town',minions:[makeMinion('blaster','goblins_blaster','0',3)],ongoingActions:[]}),makeBase({defId:'base_round_table',minions:[],ongoingActions:[]})]});
 const state=makeMatchState(core);state.sys.phase='scoreBases';
 const first=runCommand(state,{type:SU_COMMANDS.ACTIVATE_SPECIAL,playerId:'0',payload:{minionUid:'blaster',baseIndex:0}} as any,heads);
 expect(first.success,first.error).toBe(true);
 const resolved=respondToPromptOption(first.finalState,o=>o.value?.confirm===true,'确认力量','0',heads);
 expect(resolved.success,resolved.error).toBe(true);
 expect(resolved.events.filter(e => e.type === 'su:temp_power_added')).toHaveLength(1);
 expect(getPromptSourceId(getFirstPrompt(resolved.finalState))).not.toBe('goblins_blaster');
});
it('计分响应窗口中的爆弹哥布林结算一次后不再出现',()=>{
 const core=makeState({turnNumber:14,bases:[makeBase({defId:'base_the_mothership',minions:[makeMinion('blaster','goblins_blaster','1',3),makeMinion('large','robot_zapbot','0',20)],ongoingActions:[]}),makeBase({defId:'base_round_table',minions:[],ongoingActions:[]})]});
 const state=makeMatchState(core);state.sys.phase='playCards';
 const advance=runCommand(state,{type:'ADVANCE_PHASE',playerId:'0'} as any,heads);
 expect(advance.success,advance.error).toBe(true);
 let current=advance.finalState;
 let prompt=getFirstPrompt(current);
 expect(getPromptSourceId(prompt)).toBe('smashup_reaction_choose');
 const special=respondToPromptOption(current,o=>o.value?.kind==='activate_special' && o.value?.minionUid==='blaster','爆弹哥布林',prompt.playerId,heads);
 expect(special.success,special.error).toBe(true);current=special.finalState;
 prompt=getFirstPrompt(current);expect(getPromptSourceId(prompt)).toBe('goblins_blaster');
 const confirmed=respondToPromptOption(current,o=>o.value?.confirm===true,'确认力量',prompt.playerId,heads);
 expect(confirmed.success,confirmed.error).toBe(true);current=confirmed.finalState;
 const after=getFirstPrompt(current);
 expect(getPromptSourceId(after)).not.toBe('goblins_blaster');
 if(getPromptSourceId(after)==='smashup_reaction_choose') expect(getPromptOptions(after).some(o=>o.value?.minionUid==='blaster')).toBe(false);
 expect(confirmed.events.filter(e => e.type === 'su:temp_power_added')).toHaveLength(1);
});


it('仪式祭坛上爆弹哥布林与冰雪随从并存时，正面加成不会反复进入计分响应', () => {
 const core = makeState({ turnNumber: 4, bases: [
  makeBase({ defId: 'base_ritual_site', minions: [
   makeMinion('local', 'innsmouth_the_locals', '0', 2),
   makeMinion('elsa', 'frozen_elsa', '1', 5, { powerCounters: 3 }),
   makeMinion('blaster', 'goblins_blaster', '1', 3),
   makeMinion('kristoff', 'frozen_kristoff', '1', 3),
   makeMinion('anna', 'frozen_anna', '1', 4),
  ], ongoingActions: [] }),
  makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
 ] });
 const state = makeMatchState(core); state.sys.phase = 'playCards';
 const advance = runCommand(state, { type: 'ADVANCE_PHASE', playerId: '0' } as any, heads);
 expect(advance.success, advance.error).toBe(true);
 let current = advance.finalState;
 let prompt = getFirstPrompt(current);
 expect(getPromptSourceId(prompt)).toBe('smashup_reaction_choose');
 const special = respondToPromptOption(current, o => o.value?.kind === 'activate_special' && o.value?.minionUid === 'blaster', '爆弹哥布林', prompt.playerId, heads);
 expect(special.success, special.error).toBe(true); current = special.finalState;
 prompt = getFirstPrompt(current);
 expect(getPromptSourceId(prompt)).toBe('goblins_blaster');
 const confirmed = respondToPromptOption(current, o => o.value?.confirm === true, '确认力量', prompt.playerId, heads);
 expect(confirmed.success, confirmed.error).toBe(true); current = confirmed.finalState;
 const after = getFirstPrompt(current);
 expect(getPromptSourceId(after)).not.toBe('goblins_blaster');
 if (getPromptSourceId(after) === 'smashup_reaction_choose') expect(getPromptOptions(after).some(o => o.value?.minionUid === 'blaster')).toBe(false);
 expect(confirmed.events.filter(e => e.type === 'su:temp_power_added')).toHaveLength(1);
});

it.each(['confirm', 'skip'])('爆弹哥布林正面选择 %s 后结束该次掷币', choice => {
 const core = makeState({ turnNumber: 14, scoringEligibleBaseIndices: [0], bases: [
  makeBase({ defId: 'base_goblin_town', minions: [makeMinion('blaster', 'goblins_blaster', '0', 3)], ongoingActions: [] }),
  makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
 ] });
 const state = makeMatchState(core); state.sys.phase = 'scoreBases';
 const first = runCommand(state, { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { minionUid: 'blaster', baseIndex: 0 } } as any, heads);
 expect(first.success, first.error).toBe(true);
 const result = respondToPromptOption(first.finalState, o => choice === 'confirm' ? o.value?.confirm === true : o.value?.skip === true, choice, '0', heads);
 expect(result.success, result.error).toBe(true);
 expect(result.events.filter(e => e.type === 'su:temp_power_added')).toHaveLength(choice === 'confirm' ? 1 : 0);
 expect(getPromptSourceId(getFirstPrompt(result.finalState))).not.toBe('goblins_blaster');
});
it('爆弹哥布林反面选择移动后不重复询问目的地', () => {
 const core = makeState({ turnNumber: 14, scoringEligibleBaseIndices: [0], bases: [
  makeBase({ defId: 'base_goblin_town', minions: [makeMinion('blaster', 'goblins_blaster', '0', 3)], ongoingActions: [] }),
  makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
 ] });
 const state = makeMatchState(core); state.sys.phase = 'scoreBases';
 const tails = { ...heads, random: () => 0.1 };
 const first = runCommand(state, { type: SU_COMMANDS.ACTIVATE_SPECIAL, playerId: '0', payload: { minionUid: 'blaster', baseIndex: 0 } } as any, tails);
 expect(first.success, first.error).toBe(true);
 const result = respondToPromptOption(first.finalState, o => o.value?.baseIndex === 1, '目的基地', '0', tails);
 expect(result.success, result.error).toBe(true);
 expect(result.events.filter(e => e.type === 'su:minion_moved')).toHaveLength(1);
 expect(getPromptSourceId(getFirstPrompt(result.finalState))).not.toBe('goblins_blaster');
});
