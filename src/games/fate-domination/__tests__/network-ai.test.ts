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
import {getCurrentInteractionSummary} from '../../../engine/testing/interactionTestFacade';
import type {Command,MatchState,RandomFn} from '../../../engine/types';
import {FateDominationDomain,createFateAttackDeck,type FateDominationCore} from '../domain';
import {engineConfig} from '../game';
import {buildFateAiLegalActions,chooseFateAiAction} from '../ai';
import type {AiDecisionContext,AiSeatController} from '../../../engine/ai';
import {FATE_EVENTS,FATE_MASTERS,FATE_SERVANTS,FATE_SITUATIONS} from '../data';
import {fateAbilityUsageKey} from '../domain/abilitySource';
import {fateDeploymentTerrain} from '../domain/deployment';
import type {AttacksConfirmedEvent, BattleResolvedEvent, FateAbilityUsedEvent, FateBattleScoreAdjustedEvent, FateDefeatDeclaredEvent, FateDominationEvent, FateRidingCardsPlayedEvent, PlayerMovedEvent} from '../domain/types';
import { prepareSaberDayTen, type SaberDayTenCase } from './fixtures/saberDayTen';

type State=MatchState<FateDominationCore>;
type NetworkFateMatch = {
    read: () => Promise<State>;
    stateId: () => Promise<number>;
    send: (type: string, payload?: unknown) => Promise<void>;
    client: GameTransportClient;
};
const ids=['0','1','2'];
async function networkAi(seed:string,controllers:Record<string,AiSeatController>,prepare:((state:State,random:RandomFn)=>State)|undefined,run:(args:NetworkFateMatch)=>Promise<void>,{humanId='0',useLobbySetup=false}={}){
 const http=createServer();const io=new Server(http,{parser:msgpackParser});const storage=new InMemoryStorage();
 const server=new GameTransportServer({io,storage,games:[engineConfig],onlineAiRecoveryTickMs:25,
  authenticate:async(_match,id,credential,metadata)=>metadata.players[id]?.credentials===credential});
 const matchId=`fate-real-ai-${seed}`;
 const setupData={enableAi:true,seatControllers:controllers};
 const initial=await server.setupMatch(matchId,'fate-domination',ids,seed,useLobbySetup?setupData:undefined);expect(initial).toBeTruthy();
 const rng=createTrackedRandom(seed,initial!.randomCursor);
 const state=prepare?prepare(initial!.state as State,rng.random):initial!.state as State;
 await storage.createMatch(matchId,{initialState:{G:state,_stateID:0,randomSeed:seed,randomCursor:rng.getCursor()},metadata:{gameName:'fate-domination',createdAt:Date.now(),updatedAt:Date.now(),
  players:Object.fromEntries(ids.map(id=>[id,{name:`玩家${id}`,credentials:`test-only-${id}`} ])),setupData}});
 server.start();await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
 const errors:string[]=[];
 const client=new GameTransportClient({server:`http://127.0.0.1:${(http.address() as AddressInfo).port}`,matchID:matchId,playerID:humanId,credentials:`test-only-${humanId}`,onError:error=>errors.push(error)});
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

it.each([
    { card: undefined, result: '独胜', scores: { '0': 0, '1': 4, '2': 0 } },
    { card: 'cardB1', result: '并列获胜', scores: { '0': 1, '1': 3, '2': 0 } },
    { card: 'cardB4', result: '落后', scores: { '0': 2, '1': 0, '2': 0 } },
])('在线 AI 远隔操作按$result决定发动，正式终局计入个人奖励', async ({ card, result, scores }) => {
    await networkAi(`battle-win-reward-${result}`, controllers, state => {
        const { core } = state;
        core.phase = 'battle';
        core.round = 11;
        core.situation = FATE_SITUATIONS.find(situation => situation.id === 'sit13')!;
        core.currentEvents = { miyama: [], shinto: [] };
        core.battlefield.miyama.playerIds = ['0', '1'];
        for (const location of Object.values(core.battlefield)) location.eventCards = [];

        for (const [id, servantId, definition] of [['0', 'servant-saber', card], ['1', 'servant-medusa', 'cardPreparation']] as const) {
            const deck = createFateAttackDeck(id, servantId);
            const played = definition ? [deck.find(instance => instance.definitionId === definition)!] : [];
            Object.assign(core.players[id], {
                servantId, skills: [], isRevealed: false, locationId: 'miyama', deploymentSlot: null,
                hand: played, deck: deck.filter(instance => !played.includes(instance)), activeAttackIds: played.map(instance => instance.id),
            });
        }
        core.players['2'].eliminated = true;
        return state;
    }, async ({ read, send, client }) => {
        const abilityId = (await read()).core.players['1'].activeAttackIds[0];
        await send('ADVANCE_PHASE');
        await expect.poll(() => (client.latestState as State | undefined)?.core.phase, { timeout: 15_000 }).toBe('complete');
        const { core, sys } = await read();
        const uses = sys.eventStream.entries.filter(({ event }) => event.type === 'FATE_ABILITY_USED'
            && (event as FateAbilityUsedEvent).payload.skillId === abilityId);
        expect(uses).toHaveLength(scores['1'] > 0 ? 1 : 0);
        expect(core.gameResult?.scores).toEqual(scores);
        expect((client.latestState as State).core.gameResult?.scores).toEqual(scores);
    });
}, 30_000);

async function finishNetworkFateMatch({ read, stateId, send, client }: NetworkFateMatch, clientId: string, observe?: (state: State) => void) {
    for (let humanCommands = 0; humanCommands < 200; humanCommands++) {
        await expect.poll(async () => {
            const state = await read();
            observe?.(state);
            return Boolean(state.sys.gameover) || (getCurrentInteractionSummary(state).playerId ?? state.core.currentPlayerId) === clientId;
        }, { timeout: 20_000 }).toBe(true);
        const state = await read();
        observe?.(state);
        if (state.sys.gameover) return state;
        await expect.poll(() => client.lastReceivedStateID, { timeout: 10_000 }).toBe(await stateId());
        const visibleState = client.latestState as State;
        const legalActions = buildFateAiLegalActions({ state: visibleState, playerId: clientId });
        const context = { gameId: 'fate-domination', matchId: 'network', playerId: clientId, visibleState, legalActions } as AiDecisionContext;
        const decision = chooseFateAiAction(context);
        const selected = legalActions.find(candidate => candidate.actionId === decision?.actionId);
        expect(selected).toBeDefined();
        const [command] = selected!.commands;
        await send(command.type, command.payload);
    }
    throw new Error('在线测试在 200 次玩家指令内未达到终局');
}

it.each([false, true])('正式在线房从完整目录为 AI 分配身份，锁定后不重复且暗置从者保密（真人抢先选择同一身份=%s）', async collision => {
    await networkAi('fate-ai-full-roster-181', controllers, undefined, async ({ read, stateId, send, client }) => {
        const initial = (await read()).core;
        expect([initial.players['1'].servantId, initial.players['2'].servantId]).toEqual(['servant-medusa', 'servant-cu-chulainn']);
        const owner = collision ? initial.players['1'] : initial.players['0'];
        const identities = { masterId: owner.masterId, servantId: owner.servantId };
        await send('ADVANCE_PHASE', { identities });
        await expect.poll(async () => (await read()).core.phase, { timeout: 15_000 }).toBe('outpost');
        const prepared = (await read()).core;
        for (const field of ['masterId', 'servantId'] as const) {
            expect(new Set(ids.map(id => prepared.players[id][field])).size).toBe(ids.length);
        }
        expect(prepared.players['0']).toMatchObject(identities);
        expect(prepared.players['2'].servantId).toBe('servant-cu-chulainn');
        if (!collision) expect(prepared.players['1'].servantId).toBe('servant-medusa');
        for (const id of ids) {
            const player = prepared.players[id];
            expect(player.hand).toHaveLength(3);
            expect([...player.hand, ...player.deck].map(card => card.definitionId).sort())
                .toEqual([...FATE_SERVANTS.find(servant => servant.id === player.servantId)!.deck!].sort());
        }
        await expect.poll(() => client.lastReceivedStateID).toBe(await stateId());
        const visible = client.latestState as State;
        for (const id of ['1', '2']) {
            expect(visible.core.players[id]).toMatchObject({ masterId: prepared.players[id].masterId, servantId: '', hand: [], skills: [] });
        }
        if (collision) {
            const projectedSelection = visible.sys.eventStream.entries.find(({ event }) => event.type === 'SERVANT_SELECTED'
                && (event.payload as { playerId: string }).playerId === '1');
            expect(projectedSelection?.event.payload).toEqual({ playerId: '1' });
        }
    }, { useLobbySetup: true });
}, 30_000);

it('真实Socket.IO中两个服务端AI与真人席自然多轮至终局，不替真人作答',async()=>{
 await networkAi('natural-provider',controllers,undefined,async match=>{
  const rounds=new Set<number>();
  const terminal=await finishNetworkFateMatch(match,'0',state=>{rounds.add(state.core.round);});
  expect(terminal.sys.gameover).toBeTruthy();expect(rounds.size).toBeGreaterThan(1);
 });
},60000);

it.each([
    { seed: 'fate-ai-full-roster-168', medusaAbility: 'sc_medusa_np' },
    { seed: 'fate-ai-full-roster-160', medusaAbility: 'sc_medusa_2' },
])('美杜莎与库·丘林从在线建房自动分配走到终局，实际发动 $medusaAbility 和枪兵宝具', async ({ seed, medusaAbility }) => {
    await networkAi(seed, controllers, undefined, async match => {
        const setup = (await match.read()).core;
        expect([setup.players['1'].servantId, setup.players['2'].servantId]).toEqual(['servant-medusa', 'servant-cu-chulainn']);
        const events = new Map<number, FateDominationEvent>();
        const turns = new Set<number>();
        let occupiedBothTerrainSlots = false;
        const terminal = await finishNetworkFateMatch(match, '0', state => {
            turns.add(state.core.round);
            for (const entry of state.sys.eventStream.entries) events.set(entry.id, entry.event as FateDominationEvent);
            const medusa = state.core.players['1'];
            occupiedBothTerrainSlots ||= medusa.locationId === 'shinto' && medusa.deploymentSlot === 0 && medusa.secondaryDeploymentSlot === 1;
        });
        expect(terminal.core.round).toBe(11);
        expect([...turns]).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
        const committed = [...events.values()];
        const activated = committed.filter((event): event is FateAbilityUsedEvent => event.type === 'FATE_ABILITY_USED');
        expect(activated.some(({ payload }) => payload.playerId === '1' && payload.skillId.startsWith(`${medusaAbility}:`))).toBe(true);
        expect(activated.some(({ payload }) => payload.playerId === '2' && payload.skillId.startsWith('sc_cu_np:'))).toBe(true);
        const scoreChanges = committed.filter((event): event is FateBattleScoreAdjustedEvent => event.type === 'FATE_BATTLE_SCORE_ADJUSTED');
        expect(scoreChanges.some(({ payload }) => payload.sourceId.startsWith('sc_cu_np:')
            && payload.changes.some(change => change.playerId === '2' && change.amount > 0))).toBe(true);
        if (medusaAbility === 'sc_medusa_np') {
            const moves = committed.filter((event): event is PlayerMovedEvent => event.type === 'PLAYER_MOVED');
            expect(moves.map(event => event.payload)).toContainEqual(expect.objectContaining({
                playerId: '1', claimBattlefieldTerrain: true, to: 'shinto', manaSpent: 0,
            }));
            expect(occupiedBothTerrainSlots).toBe(true);
            expect(activated.some(({ payload }) => payload.playerId === '2' && payload.skillId.startsWith('sc_cu_1:'))).toBe(true);
        } else {
            const defeats = committed.filter((event): event is FateDefeatDeclaredEvent => event.type === 'FATE_DEFEAT_DECLARED');
            expect(defeats.some(({ payload }) => payload.playerId === '0' && payload.sourceId.startsWith('sc_medusa_2:'))).toBe(true);
            const rides = committed.filter((event): event is FateRidingCardsPlayedEvent => event.type === 'FATE_RIDING_CARDS_PLAYED');
            const paid = rides.find(({ payload }) => payload.playerId === '1' && payload.skillId.startsWith('sc_medusa_1:'));
            const rush = setup.players['1'].deck.find(card => card.definitionId === 'cardSurveil')!;
            expect(paid?.payload).toMatchObject({ manaSpent: 1, cardIds: expect.arrayContaining([rush.id]) });
            expect(paid?.payload.cardIds).toHaveLength(3);
        }
    }, { useLobbySetup: true });
}, 60_000);

it('库·丘林从正式在线开局付费打出战斗续行，在同一行动阶段免额外费用移至新都', async () => {
    await networkAi('fate-ai-full-roster-536', controllers, undefined, async match => {
        const lancer = (await match.read()).core.players['1'];
        expect(lancer.servantId).toBe('servant-cu-chulainn');
        const skillId = lancer.skills.find(skill => skill.id.startsWith('sc_cu_2:'))!.id;
        const rushIds = [...lancer.hand, ...lancer.deck].filter(card => card.definitionId === 'cardSurveil').map(card => card.id);
        const events = new Map<number, FateDominationEvent>();
        const terminal = await finishNetworkFateMatch(match, '0', state => {
            if (state.core.round !== 4) return;
            for (const entry of state.sys.eventStream.entries) events.set(entry.id, entry.event as FateDominationEvent);
        });
        const committed = [...events.entries()].sort(([first], [second]) => first - second).map(([, event]) => event);
        const confirmation = committed.findIndex(event => event.type === 'ATTACKS_CONFIRMED' && event.payload.cardIds.includes(skillId));
        const activation = committed.findIndex(event => event.type === 'FATE_ABILITY_USED' && event.payload.skillId === skillId);
        const movement = committed.findIndex(event => event.type === 'PLAYER_MOVED' && event.sourceCommandType === 'PLAY_SKILL'
            && event.payload.playerId === lancer.id && event.payload.from === 'miyama' && event.payload.to === 'shinto');
        expect(confirmation).toBeGreaterThanOrEqual(0);
        expect(activation).toBeGreaterThan(confirmation);
        expect(movement).toBe(activation + 1);
        const attack = committed[confirmation] as AttacksConfirmedEvent;
        expect(rushIds).toContain(attack.payload.cardIds.find(cardId => cardId !== skillId));
        expect(committed[confirmation]).toMatchObject({ payload: { playerId: lancer.id, manaSpent: 4, faceDownIds: [] } });
        expect(committed[activation]).toMatchObject({ payload: { playerId: lancer.id, manaSpent: 0 } });
        expect(committed[movement]).toMatchObject({ payload: { manaSpent: 0, mode: 'effect' } });
        expect(terminal.core.round).toBe(11);
        expect(terminal.core.gameResult?.winner).toBe(lancer.id);
    }, { useLobbySetup: true });
}, 60_000);

it.each([
    { seed: 'natural-provider', funding: 'available' },
    { seed: 'natural-saber-sweep-5', funding: 'seal' },
])('阿尔托莉雅由服务端从自然开局操作，第十一回合实付并发动誓约胜利之剑（$funding）', async ({ seed, funding }) => {
    const saberId = '0';
    const clientId = '1';
    await networkAi(seed, {
        [saberId]: controllers['1'], [clientId]: controllers['0'], '2': controllers['2'],
    }, undefined, async match => {
        const initial = await match.read();
        const saber = initial.core.players[saberId];
        expect(saber.servantId).toBe('servant-saber');
        const excalibur = saber.skills.find(skill => skill.id.startsWith('sc_saber_np:'))!;
        const played: Array<{ round: number; cost: number }> = [];
        const activated: number[] = [];
        const manaRecovered: number[] = [];
        const stateTrace: Array<{ round: number; mana: number; seals: number }> = [];
        const lateEvents: Array<{ round: number; type: string; payload: unknown }> = [];
        let currentRound = 1;
        let cursor = -1;
        const observe = (state: State) => {
            for (const { id, event } of state.sys.eventStream.entries) {
                if (id <= cursor) continue;
                cursor = id;
                if (event.type === 'BATTLE_RESOLVED') currentRound = Math.min(11, (event as BattleResolvedEvent).payload.nextRound);
                if (currentRound >= 10 && (event.payload as { playerId?: string } | undefined)?.playerId === saberId
                    && ['MASTER_DEPLOYED','PLAYER_MOVED','ATTACKS_CONFIRMED','COMMAND_SPELL_USED','FATE_ABILITY_USED','FATE_MANA_GAINED','FATE_ELIMINATION_PREVENTED'].includes(event.type)) {
                    lateEvents.push({ round: currentRound, type: event.type, payload: event.payload });
                }
                if (event.type === 'ATTACKS_CONFIRMED') {
                    const { playerId, cardIds, manaSpent } = (event as AttacksConfirmedEvent).payload;
                    if (playerId === saberId && cardIds.includes(excalibur.id)) played.push({ round: currentRound, cost: manaSpent });
                }
                if (event.type === 'FATE_ABILITY_USED') {
                    const { playerId, skillId } = (event as FateAbilityUsedEvent).payload;
                    if (playerId === saberId && skillId === excalibur.id) activated.push(currentRound);
                }
                if (event.type === 'COMMAND_SPELL_USED') {
                    const { playerId, effect } = event.payload as { playerId: string; effect: string };
                    if (playerId === saberId && effect === 'mana') manaRecovered.push(currentRound);
                }
            }
            if (state.core.phase === 'preparation') {
                const { round } = state.core;
                const { mana, commandSpells } = state.core.players[saberId];
                if (!stateTrace.some(entry => entry.round === round)) stateTrace.push({ round, mana, seals: commandSpells });
            }
        };

        const terminal = await finishNetworkFateMatch(match, clientId, observe);
        const trace = JSON.stringify({ seed, played, activated, manaRecovered, preparation: stateTrace, lateEvents, final: terminal.core.gameResult, saberEliminated: terminal.core.players[saberId].eliminated });
        expect(terminal.sys.gameover).toBeTruthy();
        expect(terminal.core.round).toBe(11);
        if (funding === 'seal') {
            expect(stateTrace.find(entry => entry.round === 11), trace).toEqual({ round: 11, mana: 6, seals: 1 });
            expect(manaRecovered, trace).toContain(11);
        }
        expect(activated, trace).toContain(11);
        expect(played.find(play => play.round === 11)?.cost, trace).toBeGreaterThanOrEqual(8);
        expect(terminal.core.gameResult).toMatchObject({ winner: saberId, victoryCondition: 'excalibur' });
    }, { humanId: clientId });
}, 60_000);

it.each([
    { scenario: 'safe', paid: 0, nextMana: 12, effect: undefined },
    { scenario: 'counter', paid: 2, nextMana: 12, effect: 'sc_saber_2' },
    { scenario: 'pressure', paid: 8, nextMana: 6, effect: 'sc_saber_np' },
    { scenario: 'refill', paid: 8, nextMana: 8, effect: 'sc_saber_np' },
] satisfies { scenario: SaberDayTenCase; paid: number; nextMana: number; effect?: string }[])('在线 AI 第十天在深山町决定是否留魔力并推进至收官（$scenario）', async ({ scenario, paid, nextMana, effect }) => {
    const saberId = '1';
    await networkAi(`saber-day-ten-${scenario}`, controllers, state => {
        prepareSaberDayTen(state.core, scenario, { saberId, rivalId: '2', workshopId: '0', firstId: '0' });
        return state;
    }, async match => {
        const events = new Map<number, { round: number; event: FateDominationEvent }>();
        let observedId = -1;
        let round = 10;
        let finalPreparationMana: number | undefined;
        const terminal = await finishNetworkFateMatch(match, '0', snapshot => {
            for (const entry of snapshot.sys.eventStream.entries) {
                if (entry.id <= observedId) continue;
                observedId = entry.id;
                const event = entry.event as FateDominationEvent;
                events.set(entry.id, { round, event });
                if (event.type === 'BATTLE_RESOLVED') round = Math.min(11, event.payload.nextRound);
            }
            if (snapshot.core.round === 11 && snapshot.core.phase === 'preparation') {
                finalPreparationMana ??= snapshot.core.players[saberId].mana;
            }
        });
        const confirmed = [...events.values()].flatMap(({ round, event }) => event.type === 'ATTACKS_CONFIRMED'
            && event.payload.playerId === saberId ? [{ round, ...event.payload }] : []);
        const used = [...events.values()].flatMap(({ round, event }) => event.type === 'FATE_ABILITY_USED'
            && event.payload.playerId === saberId ? [{ round, skill: event.payload.skillId.split(':')[0] }] : []);
        const ledger = JSON.stringify({ confirmed, used, finalPreparationMana, result: terminal.core.gameResult });
        expect(confirmed.find(play => play.round === 10)?.manaSpent, ledger).toBe(paid);
        if (effect) expect(used, ledger).toContainEqual({ round: 10, skill: effect });
        else expect(used.filter(use => use.round === 10), ledger).toEqual([]);
        expect(finalPreparationMana, ledger).toBe(nextMana);
        expect(terminal.sys.gameover).toBeTruthy();
        expect(terminal.core.players[saberId].eliminated).toBe(false);
        if (nextMana < 8) {
            expect(used, ledger).not.toContainEqual({ round: 11, skill: 'sc_saber_np' });
        } else {
            expect(confirmed.find(play => play.round === 11)?.cardIds.some(id => id.startsWith('sc_saber_np:')), ledger).toBe(true);
            expect(used, ledger).toContainEqual({ round: 11, skill: 'sc_saber_np' });
        }
    });
}, 35_000);

it.each([
 { servantId:'servant-rider',masterId:'m_waver',skillId:'sc_iskandar_1',blocked:false },
 { servantId:'servant-medusa',masterId:'m_shinji',skillId:'sc_medusa_1',blocked:false },
 { servantId:'servant-rider',masterId:'m_waver',skillId:'sc_iskandar_1',blocked:true },
])('真实联网 AI 以 $servantId 判断能否骑乘追加急行后从工房入场（固有结界=$blocked）',async({servantId,masterId,skillId,blocked})=>{
 await networkAi(`paid-riding-provider-${servantId}-${blocked}`,{'0':{type:'human'},'1':controllers['1'],'2':{type:'human'}},(state)=>{
  const master=FATE_MASTERS.find(item=>item.id===masterId)!;const servant=FATE_SERVANTS.find(item=>item.id===servantId)!;
  const deck=createFateAttackDeck('1',servant.id);const paid=deck.find(card=>card.definitionId==='cardSurveil')!;const active=deck.find(card=>card.definitionId==='cardB4')!;
  const skills=[...(master.skills??[]),...(servant.skillCards??[])].map((skill,index)=>({...skill,id:`${skill.id}:${index}`}));
  state.core.phase='action';state.core.round=4;state.core.currentPlayerId='0';state.core.players['0'].normalAttackPlayed=true;
  state.core.situation=FATE_SITUATIONS.find(situation=>situation.id==='sit1')!;
  const events=blocked?[FATE_EVENTS.find(event=>event.id==='fuyuki_E16')!]:[];
  state.core.currentEvents={miyama:events,shinto:[]};
  state.core.battlefield.miyama.eventCards=events;
  state.core.battlefield.shinto.eventCards=[];
  state.core.players['1']={...state.core.players['1'],masterId:master.id,servantId:servant.id,skills,hand:[active,paid],deck:deck.filter(card=>![active.id,paid.id].includes(card.id)),discard:[],locationId:'workshop',deploymentSlot:0,mana:6,commandSpells:0,
   normalAttackPlayed:true,activeAttackIds:[active.id],activeSkills:[skills.find(skill=>skill.id.startsWith(`${skillId}:`))!.id],usedAbilityIds:[],selectedAttackIds:[],selectedFaceDownIds:[]};
  state.core.players['0'].locationId='miyama';state.core.players['0'].deploymentSlot=0;
  state.core.players['2'].locationId='shinto';state.core.players['2'].deploymentSlot=0;
  state.core.battlefield.miyama.playerIds=['0'];state.core.battlefield.shinto.playerIds=['2'];state.core.battlefield.workshop.playerIds=['1'];return state;
 },async({read,send})=>{
  await send('PASS_ACTION');
  await expect.poll(async()=>(await read()).core.currentPlayerId,{timeout:15000}).toBe('2');
  const state=await read();const played=state.sys.eventStream.entries.filter(entry=>entry.event.type==='FATE_RIDING_CARDS_PLAYED');
  expect(state.core.players['1'].selectedAttackIds).toEqual([]);expect(state.core.players['1'].normalAttackPlayed).toBe(true);expect(getCurrentInteractionSummary(state).id).toBeUndefined();
  if (blocked) {
   expect(played).toHaveLength(0);
   expect(state.core.players['1']).toMatchObject({ locationId: 'workshop', mana: 6 });
   return;
  }
  expect(played).toHaveLength(1);const payload=played[0].event.payload as {manaSpent:number;cardIds:string[]};
  expect(payload.manaSpent).toBe(1);expect(payload.cardIds).toHaveLength(1);expect(state.core.players['1'].mana).toBe(5);
  const movements = state.sys.eventStream.entries.map(({ event }) => event).filter(event => event.type === 'PLAYER_MOVED');
  expect(movements).toContainEqual(expect.objectContaining({
   sourceCommandType: 'PLAY_SKILL', payload: expect.objectContaining({ playerId: '1', from: 'workshop', to: 'miyama', manaSpent: 0 }),
  }));
  expect(state.core.players['1'].locationId).toBe('miyama');
 });
},30000);

it.each([
    { servant: 'servant-saber', skill: 'sc_saber_np', result: 'excalibur' },
    { servant: 'servant-saber', skill: 'sc_saber_1', result: 'suppress', power: 5 },
    { servant: 'servant-saber', skill: 'sc_saber_2', result: 'suppress', power: 6 },
    { servant: 'servant-saber', skill: 'sc_saber_1', result: 'skip-hidden-magic' },
    { servant: 'servant-cu-chulainn', skill: 'sc_cu_1', result: 'defeat' },
    { servant: 'servant-cu-chulainn', skill: 'sc_cu_np', result: 'score' },
    { servant: 'servant-cu-chulainn', skill: 'sc_cu_2', result: 'move' },
    { servant: 'servant-medusa', skill: 'sc_medusa_2', result: 'defeat' },
    { servant: 'servant-medusa', skill: 'sc_medusa_np', result: 'claim' },
] as const)('服务端 AI 通过正式命令处理 $skill：$result', async scenario => {
    const { servant, skill, result } = scenario;
    const isLastRound = result === 'excalibur' || result === 'score';
    const isMovement = result === 'move' || result === 'claim';
    const isAction = skill === 'sc_medusa_2' || isMovement;
    const phase = isAction ? 'action' : 'battle';
    const opponent = servant === 'servant-medusa' ? 'servant-saber' : 'servant-medusa';
    const order = isAction && !isMovement ? ['2', '0', '1'] : ids;
    const sourceSkill = `${skill}:active`;
    await networkAi(`animated-servant-${skill}-${result}`, { '0': { type: 'human' }, '1': controllers['1'], '2': { type: 'human' } }, state => {
        const { core } = state;
        core.phase = phase;
        core.round = isLastRound ? 11 : 4;
        core.currentPlayerId = '0';
        core.turnOrder = order;
        core.currentTurnIndex = order.indexOf('0');
        core.situation = FATE_SITUATIONS.find(card => card.id === (isLastRound ? 'sit13' : 'sit1'))!;
        core.currentEvents = { miyama: [], shinto: [] };
        core.battlefield.miyama = { ...core.battlefield.miyama, playerIds: ['0', '1'], eventCards: [] };
        core.battlefield.shinto.eventCards = [];
        core.battlefield.workshop.playerIds = isLastRound || isMovement ? [] : ['2'];
        core.battlefield.shinto.playerIds = isMovement ? ['2'] : [];
        const defender = core.players['0'];
        const deck = createFateAttackDeck(defender.id, opponent);
        const hand = deck.filter(card => card.definitionId === 'cardB1' || card.definitionId === 'cardA2').slice(0, 2);
        Object.assign(defender, {
            servantId: opponent, locationId: 'miyama', deploymentSlot: 0, mana: 0,
            hand, deck: deck.filter(card => !hand.includes(card)), activeAttackIds: hand.map(card => card.id),
            faceDownAttackIds: result === 'skip-hidden-magic' ? [hand.find(card => card.definitionId === 'cardA2')!.id] : [],
            normalAttackPlayed: true, commandSpells: 0, victoryPoints: isLastRound ? 27 : 0,
        });
        const actor = core.players['1'];
        const identity = FATE_SERVANTS.find(item => item.id === servant)!;
        const printed = identity.skillCards!.find(item => item.id === skill)!;
        const ownDeck = createFateAttackDeck(actor.id, servant);
        const basic = ownDeck.find(card => card.definitionId === 'cardB1')!;
        Object.assign(actor, {
            servantId: servant, isRevealed: true, locationId: 'miyama', deploymentSlot: 1,
            hand: [basic], deck: ownDeck.filter(card => card.id !== basic.id), activeAttackIds: [basic.id],
            skills: [{ ...printed, id: sourceSkill }], activeSkills: [sourceSkill],
            mana: 0, commandSpells: 0, normalAttackPlayed: true,
        });
        Object.assign(core.players['2'], {
            servantId: 'servant-rider', locationId: isLastRound ? null : isMovement ? 'shinto' : 'workshop',
            deploymentSlot: isMovement ? 0 : null, eliminated: isLastRound, hasPassedAction: isAction && !isMovement,
        });
        return state;
    }, async ({ read, send, client }) => {
        await send(isAction ? 'PASS_ACTION' : 'ADVANCE_PHASE');
        if (isLastRound) {
            await expect.poll(async () => (await read()).core.phase, { timeout: 15000 }).toBe('complete');
        } else {
            await expect.poll(async () => (await read()).core.currentPlayerId, { timeout: 15000 }).toBe('2');
        }
        const { core, sys } = await read();
        const activations = sys.eventStream.entries.filter(({ event }) => event.type === 'FATE_ABILITY_USED'
            && (event as FateAbilityUsedEvent).payload.skillId === sourceSkill);
        if (result === 'skip-hidden-magic') {
            expect(activations).toHaveLength(0);
            expect(core.phase).toBe('battle');
            return;
        }
        expect(activations).toHaveLength(1);
        expect((activations[0].event as FateAbilityUsedEvent).payload.playerId).toBe('1');
        if (result === 'excalibur') {
            expect(core.gameResult?.victoryCondition).toBe('excalibur');
            expect(core.gameResult?.winner).toBe('1');
            expect(core.gameResult?.scores?.['1']).toBeLessThan(core.gameResult?.scores?.['0'] ?? 0);
        } else if (result === 'score') {
            const adjustment = sys.eventStream.entries.find(({event}) => event.type === 'FATE_BATTLE_SCORE_ADJUSTED')?.event as FateBattleScoreAdjustedEvent | undefined;
            expect(adjustment?.payload).toEqual({ sourceId: sourceSkill, changes: [{ playerId: '1', amount: 1 }, { playerId: '0', amount: -1 }] });
            expect(core.gameResult?.scores?.['0']).toBe(26);
        } else if (isMovement) {
            const move = sys.eventStream.entries.find(({event}) => event.type === 'PLAYER_MOVED' && (event as PlayerMovedEvent).payload.playerId === '1')?.event;
            expect(move?.payload).toMatchObject({ from: 'miyama', to: 'shinto', mode: 'effect', manaSpent: 0 });
            expect(core.phase).toBe('action');
            expect(core.players['1'].locationId).toBe('shinto');
            expect(core.battlefield.shinto.playerIds).toEqual(['2', '1']);
            expect(['1', '2'].map(id => fateDeploymentTerrain(core.players[id]))).toEqual(result === 'claim' ? [4, 0] : [0, 3]);
        } else if (result === 'defeat') {
            expect(core.phase).toBe('battle');
            expect(core.players['1'].usedAbilityIds).toContain(fateAbilityUsageKey(sourceSkill, phase));
            expect(core.players['0'].defeatMarkers).toEqual([expect.objectContaining({ sourceId: sourceSkill })]);
        } else if (result === 'suppress') {
            await expect.poll(() => (client.latestState as State).core.players['0'].publicView?.power).toBe(scenario.power);
        }
    });
}, 30000);

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
