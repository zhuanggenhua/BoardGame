import { describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import { createInitialSystemState, executePipeline } from '../src/engine/pipeline';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import { BETRAYAL_DISCOVERY_POOLS } from '../src/games/betrayal/scenarioConfig';
import { createDustRuntimeState, createUponReflectionRuntimeState } from '../src/games/betrayal/hauntRuntimeSetupModel';
import { engineConfig } from '../src/games/betrayal/game';
import { createStartedFirstScenarioCore, createBetrayalScriptedRandom } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { createSyntheticMatch, SYNTHETIC_PLAYER_IDS } from './transportCapture';

function fixture() {
 const match = createSyntheticMatch(); const core = createStartedFirstScenarioCore(SYNTHETIC_PLAYER_IDS);
 const card = BETRAYAL_DISCOVERY_POOLS.events.find(x => x.name === '一瓶微尘')!;
 core.currentExplorer.inventory = ['a','b','c'].map(id => ({id, name:id, kind:'omen' as const}));
 core.currentExplorerInventory = core.currentExplorer.inventory;
 core.pendingEventChoice = {id:'test', playerId:'0', sourceTitle:card.name, eventDescription:card.text, effect:card.effect!};
 const result = executePipeline(engineConfig, {core,sys:createInitialSystemState(SYNTHETIC_PLAYER_IDS,engineConfig.systems,match.matchID)}, {type:BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,playerId:'0',payload:{accept:true},timestamp:100}, createBetrayalScriptedRandom(3,3,3), SYNTHETIC_PLAYER_IDS);
 expect(result.success).toBe(true); const authority = result.state.core;
 const random = createBetrayalScriptedRandom(3,3,3);
 const dust = createDustRuntimeState(authority, random); const mirror = createUponReflectionRuntimeState(authority, '0', random);
 dust.permanentTraitorPlayerIds=['0']; mirror.secretCombination!.omenName='PRIVATE_MIRROR_MARKER';
 authority.scenarioRuntime.dust=structuredClone(dust); authority.scenarioRuntime.uponReflection=structuredClone(mirror);
 expect(authority.pendingEventRollResolution?.dustSetup).toBeTruthy();
 authority.pendingEventRollResolution!.dustSetup=structuredClone(dust); authority.pendingEventRollResolution!.uponReflectionSetup=structuredClone(mirror);
 authority.recentRoll = { id:'test', kind:'deathPrevention', playerId:'0', sourceTitle:'test', dice:[0], passiveBonus:0, latestLabel:'test', consumedRabbitFootCardIds:[], deathPrevention: {traitsBeforeDamage:{...authority.currentExplorer.traits}, scenarioRuntimeBeforeDefeat:structuredClone(authority.scenarioRuntime), monstersBeforeDefeat:[]} } as any;
 match.state=result.state; match.connections.clear(); match.spectatorSockets.add('watcher');
 return {match, authority};
}
function check(core:any) {
 const containers=[core.scenarioRuntime, core.pendingEventRollResolution, core.recentRoll.deathPrevention.scenarioRuntimeBeforeDefeat];
 for (const c of containers) {
  const dust=c.dust ?? c.dustSetup; const mirror=c.uponReflection ?? c.uponReflectionSetup;
  expect(Object.values(dust.sicknessTokensByPlayerId).flat().every((x:any)=>x.value===null)).toBe(true);
  expect(dust.permanentTraitorPlayerIds).toEqual([]); expect(mirror.secretCombination).toBeNull();
 }
}
describe('spectator privacy at actual transport boundary',()=>{
 it('masks runtime, pending, and rollback copies on sync and updates without mutating authority',()=>{
  const {match,authority}=fixture(); const before=JSON.stringify(authority); const calls:any[]=[];
  const io={of:()=>({to:()=>({emit:(...args:any[])=>calls.push(args)})})} as unknown as Server;
  const sync=new TransportStateSynchronizer(io); sync.syncSocket({match,playerID:null,socket:{emit:(...args:any[])=>calls.push(args)}});
  expect(calls[0][0]).toBe('state:sync'); check(calls[0][2].core); expect(JSON.stringify(calls[0])).not.toContain('PRIVATE_MIRROR_MARKER');
  sync.clearAllBaselines(match); sync.broadcast(match); expect(calls[1][0]).toBe('state:update'); check(calls[1][2].core); expect(JSON.stringify(calls[1])).not.toContain('PRIVATE_MIRROR_MARKER');
  authority.turnNumber += 1;
  authority.scenarioRuntime.dust!.sicknessTokensByPlayerId['0'][0].value=99;
  authority.scenarioRuntime.uponReflection!.secretCombination!.omenName='PRIVATE_AFTER_PATCH';
  sync.broadcast(match); const after=calls.slice(2); expect(after.length).toBe(1); expect(after[0][0]).toBe('state:patch'); expect(JSON.stringify(after)).not.toContain('PRIVATE_AFTER_PATCH'); expect(JSON.stringify(after)).not.toContain('99');
  authority.turnNumber -= 1;
  authority.scenarioRuntime.dust!.sicknessTokensByPlayerId['0'][0].value=JSON.parse(before).scenarioRuntime.dust.sicknessTokensByPlayerId['0'][0].value;
  authority.scenarioRuntime.uponReflection!.secretCombination!.omenName='PRIVATE_MIRROR_MARKER'; expect(JSON.stringify(authority)).toBe(before);
 });
});
