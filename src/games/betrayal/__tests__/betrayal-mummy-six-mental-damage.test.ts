import { expect, it } from 'vitest';
import { resolveBetrayalTraitDeltas } from '../activityPresentation';
import { applyBetrayalCommand, createBetrayalCommand, createFirstScenarioHauntCore, BETRAYAL_COMMANDS, BetrayalDomain, findTestExplorer, activateTestExplorer, setTestTraitTrack } from './helpers/firstScenarioRuntimeHarness';

it('six mental damage moves two traits three track steps each although values fall by four each', () => {
 let core = createFirstScenarioHauntCore();
 const traitor = core.scenarioRuntime.traitorPlayerId!;
 const [hero, other] = core.playerIds.filter(id => id !== traitor);
 activateTestExplorer(core, traitor);
 core.scenarioRuntime.deadExplorerPlayerIds = [other];
 setTestTraitTrack(core, hero, 'knowledge', [2,3,4], 2, 2);
 setTestTraitTrack(core, hero, 'sanity', [2,3,4], 2, 2);
 const target = findTestExplorer(core, hero);
 const before = {...target.traits};
 core.pendingDamageAllocation = {
  id:'ring-six', playerId:hero, sourceTitle:'攻击', damageKind:'mental', amount:6, originalAmount:6,
  allowedTraits:['knowledge','sanity'], allowSkull:true, traitsBeforeDamage:{...before},
 };
 core.activePlayerId=hero;
 const traits = ['knowledge','knowledge','knowledge','sanity','sanity','sanity'] as const;
 expect(BetrayalDomain.validate({core,sys:{} as never}, createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, hero, {traits:[...traits]})).valid).toBe(true);
 expect(BetrayalDomain.validate({core,sys:{} as never}, createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, hero, {traits:[...traits,'sanity']})).valid).toBe(false);
 core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, hero, {traits:[...traits]});
 const after=findTestExplorer(core,hero);
 expect(after.traitTracks.knowledge.position).toBe(-1);
 expect(after.traitTracks.sanity.position).toBe(-1);
 expect(resolveBetrayalTraitDeltas(before,after.traits)).toEqual([{trait:'knowledge',amount:-4},{trait:'sanity',amount:-4}]);
 expect(core.phase).toBe('endgame');
 expect(core.pendingDamageAllocation).toBeNull();
 expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(hero);
 expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage',outcome:'traitor',traitorPlayerId:traitor});
 expect(core.activityLog.filter(log => log.text.includes('6 点伤害分配到'))).toHaveLength(1);
});

it('nonterminal damage records the allocation once and remains in haunt', () => {
 let core = createFirstScenarioHauntCore();
 const traitor = core.scenarioRuntime.traitorPlayerId!;
 const hero = core.playerIds.find(id => id !== traitor)!;
 activateTestExplorer(core, traitor);
 setTestTraitTrack(core, hero, 'knowledge', [2,3,4], 2, 2);
 setTestTraitTrack(core, hero, 'sanity', [2,3,4], 2, 2);
 const before = {...findTestExplorer(core,hero).traits};
 core.pendingDamageAllocation = {
  id:'ring-two', playerId:hero, sourceTitle:'攻击', damageKind:'mental', amount:2, originalAmount:2,
  allowedTraits:['knowledge','sanity'], allowSkull:true, traitsBeforeDamage:before,
 };
 core.activePlayerId=hero;
 core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, hero, {traits:['knowledge','sanity']});
 expect(core.phase).toBe('haunt');
 expect(core.endgameResult).toBeNull();
 expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(hero);
 expect(core.pendingDamageAllocation).toBeNull();
 expect(core.activityLog.filter(log => log.text.includes('2 点伤害分配到'))).toHaveLength(1);
});
