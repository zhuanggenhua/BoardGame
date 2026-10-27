// @vitest-environment node
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {Server} from 'socket.io';
import msgpackParser from 'socket.io-msgpack-parser';
import {expect,it} from 'vitest';
import {GameTransportServer} from '../../../engine/transport/server';
import {GameTransportClient} from '../../../engine/transport/client';
import {InMemoryStorage} from '../../../engine/transport/__tests__/helpers/serverTestHarness';
import {createTrackedRandom} from '../../../engine/transport/trackedRandom';
import {executePipeline} from '../../../engine';
import type {Command,MatchState,RandomFn} from '../../../engine/types';
import {FateDominationDomain,createFateAttackDeck,type FateDominationCore} from '../domain';
import {engineConfig} from '../game';
import {buildFateAiLegalActions,chooseFateAiAction} from '../ai';
import type {AiDecisionContext,AiSeatController} from '../../../engine/ai';
import {FATE_EVENTS,FATE_MASTERS,FATE_SERVANTS} from '../data';

type State=MatchState<FateDominationCore>;
const ids=['0','1','2'];
async function networkAi(seed:string,controllers:Record<string,AiSeatController>,prepare:((state:State,random:RandomFn)=>State)|undefined,run:(args:{read:()=>Promise<State>;stateId:()=>Promise<number>;send:(type:string,payload?:unknown)=>Promise<void>;client:GameTransportClient})=>Promise<void>){
 const http=createServer();const io=new Server(http,{parser:msgpackParser});const storage=new InMemoryStorage();
 const server=new GameTransportServer({io,storage,games:[engineConfig],onlineAiRecoveryTickMs:25,
  authenticate:async(_match,id,credential,metadata)=>metadata.players[id]?.credentials===credential});
 const matchId=`fate-real-ai-${seed}`;
 const initial=await server.setupMatch(matchId,'fate-domination',ids,seed);expect(initial).toBeTruthy();
 const rng=createTrackedRandom(seed,initial!.randomCursor);
 const state=prepare?prepare(initial!.state as State,rng.random):initial!.state as State;
 await storage.createMatch(matchId,{initialState:{G:state,_stateID:0,randomSeed:seed,randomCursor:rng.getCursor()},metadata:{gameName:'fate-domination',createdAt:Date.now(),updatedAt:Date.now(),
  players:Object.fromEntries(ids.map(id=>[id,{name:`玩家${id}`,credentials:`test-only-${id}`} ])),setupData:{enableAi:true,seatControllers:controllers}}});
 server.start();await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
 const errors:string[]=[];
 const client=new GameTransportClient({server:`http://127.0.0.1:${(http.address() as AddressInfo).port}`,matchID:matchId,playerID:'0',credentials:'test-only-0',onError:error=>errors.push(error)});
 const read=async()=>(await storage.fetch(matchId,{state:true})).state!.G as State;
 try{
  client.connect();await expect.poll(()=>client.isConnected&&Boolean(client.latestState),{timeout:10000}).toBe(true);
  const send=async(type:string,payload:unknown={})=>{const before=(await storage.fetch(matchId,{state:true})).state!._stateID;expect(client.sendCommand(type,payload)).toBe(true);await expect.poll(async()=>(await storage.fetch(matchId,{state:true})).state!._stateID,{timeout:10000}).toBeGreaterThan(before);};
  await run({read,stateId:async()=>(await storage.fetch(matchId,{state:true})).state!._stateID,send,client});expect(errors).toEqual([]);
 }finally{
  client.disconnect();
  // 服务当前无dispose API；仅清除此测试实例的已知定时器，避免污染后续用例。
  const timer=(server as unknown as {onlineAiRecoveryTimer:ReturnType<typeof setInterval>|null}).onlineAiRecoveryTimer;
  if(timer)clearInterval(timer);
  await new Promise<void>(resolve=>io.close(()=>resolve()));
 }
}
const controllers:Record<string,AiSeatController>={'0':{type:'human'},'1':{type:'local-ai',minimumActionDelayMs:0},'2':{type:'local-ai',minimumActionDelayMs:0}};

it('真实Socket.IO中两个服务端AI与真人席自然多轮至终局，不替真人作答',async()=>{
 await networkAi('natural-provider',controllers,undefined,async({read,stateId,send,client})=>{
  let commands=0;const rounds=new Set<number>();
  while(!(await read()).sys.gameover&&commands++<200){
   await expect.poll(async()=>{const s=await read();return Boolean(s.sys.gameover)||(s.sys.interaction.current?.playerId??s.core.currentPlayerId)==='0';},{timeout:20000}).toBe(true);
   const authoritative=await read();if(authoritative.sys.gameover)break;
   rounds.add(authoritative.core.round);
   await expect.poll(()=>client.lastReceivedStateID,{timeout:10000}).toBe((await stateId()));
   const visible=client.latestState as State;
   const actions=buildFateAiLegalActions({state:visible,playerId:'0'});
   const context={gameId:'fate-domination',matchId:'network',playerId:'0',visibleState:visible,legalActions:actions} as AiDecisionContext;
   const selected=actions.find(action=>action.actionId===chooseFateAiAction(context)?.actionId);expect(selected).toBeTruthy();
   await send(selected!.commands[0].type,selected!.commands[0].payload);
  }
  const terminal=await read();expect(terminal.sys.gameover).toBeTruthy();expect(rounds.size).toBeGreaterThan(1);expect(commands).toBeLessThan(200);
 });
},60000);

it('真实联网AI从骑乘正式入口支付正费用后交还真人，普通草稿保持隔离（合法实例代表态）',async()=>{
 await networkAi('paid-riding-provider',{'0':{type:'human'},'1':controllers['1'],'2':{type:'human'}},(state)=>{
  const master=FATE_MASTERS.find(item=>item.id==='m_waver')!;const servant=FATE_SERVANTS.find(item=>item.id==='servant-rider')!;
  const deck=createFateAttackDeck('1',servant.id);const paid=deck.find(card=>card.definitionId==='cardSurveil')!;const active=deck.find(card=>card.definitionId==='cardB4')!;
  const skills=[...(master.skills??[]),...(servant.skillCards??[])].map((skill,index)=>({...skill,id:`${skill.id}:${index}`}));
  state.core.phase='action';state.core.round=4;state.core.currentPlayerId='0';state.core.players['0'].normalAttackPlayed=true;
  state.core.players['1']={...state.core.players['1'],masterId:master.id,servantId:servant.id,skills,hand:[active,paid],deck:deck.filter(card=>![active.id,paid.id].includes(card.id)),discard:[],locationId:'workshop',deploymentSlot:0,mana:6,commandSpells:0,
   normalAttackPlayed:true,activeAttackIds:[active.id],activeSkills:[skills.find(skill=>skill.id.startsWith('sc_iskandar_1'))!.id],usedAbilityIds:[],selectedAttackIds:[],selectedFaceDownIds:[]};
  state.core.players['0'].locationId='miyama';state.core.players['0'].deploymentSlot=0;
  state.core.players['2'].locationId='shinto';state.core.players['2'].deploymentSlot=0;
  state.core.battlefield.miyama.playerIds=['0'];state.core.battlefield.shinto.playerIds=['2'];state.core.battlefield.workshop.playerIds=['1'];return state;
 },async({read,send})=>{
  await send('PASS_ACTION');
  await expect.poll(async()=>(await read()).core.currentPlayerId,{timeout:15000}).toBe('2');
  const state=await read();const played=state.sys.eventStream.entries.filter(entry=>entry.event.type==='FATE_RIDING_CARDS_PLAYED');
  expect(played).toHaveLength(1);const payload=played[0].event.payload as {manaSpent:number;cardIds:string[]};
  expect(payload.manaSpent).toBe(1);expect(payload.cardIds).toHaveLength(1);expect(state.core.players['1'].mana).toBe(5);
  expect(state.core.players['1'].selectedAttackIds).toEqual([]);expect(state.core.players['1'].normalAttackPlayed).toBe(true);expect(state.sys.interaction.current).toBeUndefined();
 });
},30000);

it('真实联网E12先等待真人，再由AI选择自己选项，全部完成才换轮（正式frame代表态）',async()=>{
 await networkAi('post-battle-provider',{'0':{type:'human'},'1':controllers['1'],'2':{type:'human'}},(initial,random)=>{
  let state=initial;state.core.phase='battle';state.core.initialAttackHandDealtPlayerIds=[...ids];
  for(const player of Object.values(state.core.players)){player.hand=player.deck.splice(0,3);player.locationId=player.id==='2'?'workshop':'miyama';player.deploymentSlot=null;player.mana=0;player.commandSpells=2;}
  const objective=FATE_EVENTS.find(card=>card.id==='fuyuki_E12')!;const other=FATE_EVENTS.find(card=>card.id==='fuyuki_E5')!;
  state.core.currentEvents={miyama:[objective],shinto:[other]};state.core.miyamaEvent=objective;state.core.shintoEvent=other;
  for(const [id,field] of Object.entries(state.core.battlefield)){field.playerIds=ids.filter(pid=>state.core.players[pid].locationId===id);field.eventCards=id==='miyama'?[objective]:id==='shinto'?[other]:[];}
  state.core.eventDeck=FATE_EVENTS.filter(card=>![objective.id,other.id].includes(card.id));state.core.eventDiscard=[];state.core.eventDeckCount=state.core.eventDeck.length;
  const apply=(command:Command)=>{const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids);expect(result.success,result.error).toBe(true);state=result.state;};
  for(const playerId of ids)apply({type:'ADVANCE_PHASE',playerId,payload:{}});
  for(const locationId of ['miyama','shinto','recon'])apply({type:'RESOLVE_LOCATION',playerId:state.core.currentPlayerId,payload:{locationId}});
  return state;
 },async({read,send})=>{
  const before=await read();expect(before.sys.interaction.current?.playerId).toBe('0');
  await new Promise(resolve=>setTimeout(resolve,150));
  expect((await read()).sys.interaction.current?.id).toBe(before.sys.interaction.current?.id);
  await send('SYS_INTERACTION_RESPOND',{interactionId:before.sys.interaction.current!.id,optionId:'restore'});
  await expect.poll(async()=>(await read()).core.round,{timeout:10000}).toBe(2);
  const after=await read();expect(after.core.players['0'].commandSpells).toBe(3);expect(after.core.players['1'].commandSpells).toBe(3);expect(after.sys.interaction.current).toBeUndefined();
 });
},30000);
