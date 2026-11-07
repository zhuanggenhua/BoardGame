import { describe, it, expect } from 'vitest';
import { GameTransportServer } from '../src/engine/transport/server';
import { createInitialSystemState } from '../src/engine/pipeline';
import { createMatchSetupState } from '../src/engine/transport/matchSetupStateFactory';
import { InMemoryStorage, MockIO, MockSocket, createEngineConfig, createMetadata, createStoredState } from '../src/engine/transport/__tests__/helpers/serverTestHarness';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import { engineConfig, type BetrayalCore } from '../src/games/betrayal/game';
import { createBetrayalScriptedRandom } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { createDustRuntimeState, createUponReflectionRuntimeState } from '../src/games/betrayal/hauntRuntimeSetupModel';

async function startBetrayal() {
 const io=new MockIO(), storage=new InMemoryStorage(), matchID='batch-privacy';
 const setup=createMatchSetupState({matchID,engineConfig:engineConfig as any,playerIds:['0','1','2'],seed:'private-seed'});
 const core=setup.state.core as BetrayalCore;
 core.eventOrder[0].name='PRIVATE_EVENT_MARKER'; core.possessionOrderByKind.item[0].name='PRIVATE_ITEM_MARKER'; core.possessionOrderByKind.omen[0].name='PRIVATE_OMEN_MARKER';
 const random=createBetrayalScriptedRandom(3,3,3); const dust=createDustRuntimeState(core,random); dust.sicknessTokensByPlayerId['1'][0].id='PRIVATE_DUST_MARKER'; dust.sicknessTokensByPlayerId['1'][0].value=123456; dust.permanentTraitorPlayerIds=['1'];
 const mirror=createUponReflectionRuntimeState(core,'1',random); mirror.secretCombination!.omenName='PRIVATE_MIRROR_MARKER';
 core.scenarioRuntime.dust=dust; core.scenarioRuntime.uponReflection=mirror;
 const metadata={...createMetadata('cred-0'), gameName:engineConfig.gameId, players:{'0':{name:'A',credentials:'cred-0'},'1':{name:'B',credentials:'cred-1'},'2':{name:'C',credentials:'cred-2'}}};
 await storage.createMatch(matchID,{initialState:{G:setup.state,_stateID:0,randomSeed:'private-seed',randomCursor:setup.randomCursor},metadata});
 const server=new GameTransportServer({io:io as any,storage,games:[engineConfig as any],authenticate:async (_m,p,c,m)=>m.players[p]?.credentials===c}); server.start();
 const socket=new MockSocket('batch-seat0'); io.gameNamespace.connectSocket(socket); await socket.clientEmit('sync',matchID,'0','cred-0');
 expect(socket.sent.some(x=>x.event==='state:sync')).toBe(true);
 return {socket,storage,matchID};
}
async function batch(f:Awaited<ReturnType<typeof startBetrayal>>,commands:any[]) {
 f.socket.sent.length=0; await f.socket.clientEmit('batch',f.matchID,'b1',commands,'cred-0',{expectedStateID:0});
 const msg=f.socket.sent.find(x=>x.event==='batch:confirmed'); expect(msg,JSON.stringify(f.socket.sent)).toBeTruthy(); return msg!.args[2] as any;
}
function checkView(view:any) {
 expect(view.core.eventOrder.length, 'hidden event deck is transmitted').toBe(0); expect(view.core.possessionOrderByKind.item.length).toBe(0); expect(view.core.possessionOrderByKind.omen.length).toBe(0);
 expect(view.core.scenarioRuntime.dust.sicknessTokensByPlayerId['0'][0].value).toEqual(expect.any(Number));
 expect(view.core.scenarioRuntime.dust.sicknessTokensByPlayerId['1'][0].value).toBeNull();
 expect(view.core.scenarioRuntime.dust.permanentTraitorPlayerIds).toEqual([]); expect(view.core.scenarioRuntime.uponReflection.secretCombination).toBeNull();
 expect(JSON.stringify(view)).not.toMatch(/PRIVATE_(EVENT|ITEM|OMEN|DUST|MIRROR)_MARKER/);
}
describe('batch confirmation privacy through actual socket router and coordinator',()=>{
 it('empty batch returns requesting seat view, without mutating authoritative state',async()=>{
  const f=await startBetrayal(); const before=JSON.stringify((await f.storage.fetch(f.matchID,{state:true})).state!.G);
  const view=await batch(f,[]); expect(JSON.stringify((await f.storage.fetch(f.matchID,{state:true})).state!.G)).toBe(before); checkView(view);
 });
 it('successful legal batch returns requesting seat view while authority retains secrets',async()=>{
  const f=await startBetrayal(); const view=await batch(f,[{type:BETRAYAL_COMMANDS.SELECT_EXPLORER,payload:{explorerId:'jaden-jones'}}]);
  const authority=(await f.storage.fetch(f.matchID,{state:true})).state!.G as any; expect(authority.core.selectedExplorerByPlayerId['0']).toBe('jaden-jones'); expect(JSON.stringify(authority)).toContain('PRIVATE_MIRROR_MARKER'); checkView(view);
 });
 it('game without transport/player policy retains existing batch reply',async()=>{
  const io=new MockIO(),storage=new InMemoryStorage(),matchID='batch-default'; const initial=createStoredState(); await storage.createMatch(matchID,{initialState:initial,metadata:createMetadata('cred-0')});
  const server=new GameTransportServer({io:io as any,storage,games:[createEngineConfig()],authenticate:async (_m,p,c,m)=>m.players[p]?.credentials===c});server.start(); const socket=new MockSocket('default');io.gameNamespace.connectSocket(socket);await socket.clientEmit('sync',matchID,'0','cred-0');socket.sent.length=0;
  await socket.clientEmit('batch',matchID,'b1',[],'cred-0',{expectedStateID:0}); const confirmed=socket.sent.find(x=>x.event==='batch:confirmed'); expect(confirmed).toBeTruthy(); expect((confirmed!.args[2] as any).core).toEqual(initial.G.core);
 });
});
