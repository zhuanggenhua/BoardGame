import { describe, expect, it } from 'vitest';
import { resolveRecentRollAcknowledgementPresentation } from '../recentRollPresentation';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import { applyBetrayalCommand, acknowledgeAnyPendingCardResolutions, acknowledgeRecentRollForAllPlayers, createBetrayalCommand, BetrayalDomain, createBetrayalScriptedRandom, createFirstScenarioHauntCore, setScenarioTestTurnMovement, BETRAYAL_COMMANDS, BETRAYAL_DISCOVERY_POOLS, findTestExplorer, activateTestExplorer, setNextDiscoverySymbolRoomsForAllFloors, setTestTraitTrack, placeActiveTestExplorerInRoom, setTestExplorerInventory } from './helpers/firstScenarioRuntimeHarness';

describe('mummy direct event death', () => {
 it('last hero loses might to event and traitor wins', () => {
  let core = createFirstScenarioHauntCore();
  const traitor = core.scenarioRuntime.traitorPlayerId!;
  const [hero, other] = core.playerIds.filter(id => id !== traitor);
  core.scenarioRuntime.deadExplorerPlayerIds = [other];
  placeActiveTestExplorerInRoom(core, hero, 'entrance-hall');
  setScenarioTestTurnMovement(core, 6);
  core.drawOrder = ['event'];
  setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
  core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find(e => e.name === '一种怪异的感觉')!];
  core.deckCounts.event = 1;
  setTestExplorerInventory(core, hero, []);
  setTestTraitTrack(core, hero, 'might', [1], 0, 0);
  const roomId = resolveExplorableRoomSlots(core)[0]!.id;
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, hero, {roomId}, 100, createBetrayalScriptedRandom(1,1,2,2,2));
  expect(core.latestDiscovery?.detail).toContain('失去 1 点力量');
  expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(hero);
  expect(core.phase).toBe('endgame');
  expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage', outcome:'traitor'});
 });
 it.each(['none', 'save', 'fail', 'decline'] as const)('choice event death and skull reroll: %s', (mode) => {
  let core = createFirstScenarioHauntCore();
  const traitor = core.scenarioRuntime.traitorPlayerId!;
  const [hero, other] = core.playerIds.filter(id => id !== traitor);
  core.scenarioRuntime.deadExplorerPlayerIds = [other];
  placeActiveTestExplorerInRoom(core, hero, 'entrance-hall');
  setScenarioTestTurnMovement(core, 6);
  core.drawOrder = ['event'];
  setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
  core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find(e => e.name === '一瓶微尘')!];
  core.deckCounts.event = 1;
  setTestExplorerInventory(core, hero, mode === 'none' ? [] : [
   {id: 'skull', name: '头骨', kind: 'omen'}, {id: 'rope', name: '兔脚', kind: 'item'},
  ]);
  setTestTraitTrack(core, hero, 'might', [1], 0, 0);
  setTestTraitTrack(core, hero, 'sanity', [1,2], 0, 0);
  const roomId = resolveExplorableRoomSlots(core)[0]!.id;
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, hero, {roomId});
  expect(core.pendingEventChoice?.sourceTitle).toBe('一瓶微尘');
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, hero, {accept:false}, 101, createBetrayalScriptedRandom(1,2,2));
  expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(hero);
  if (mode === 'none') {
   expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage', outcome:'traitor'});
   return;
  }
  expect(core.recentRoll?.kind).toBe('deathPrevention');
  expect(core.endgameResult).toBeNull();
  if (mode === 'decline') {
   core = acknowledgeAnyPendingCardResolutions(core);
   expect(resolveRecentRollAcknowledgementPresentation(core, hero).canViewerAcknowledge).toBe(true);
   core = acknowledgeRecentRollForAllPlayers(core);
  } else {
   expect(BetrayalDomain.validate({core, sys:{} as never}, createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope', dieIndex:0})).valid).toBe(true);
   core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope', dieIndex:0}, 102, createBetrayalScriptedRandom(mode === 'save' ? 3 : 1));
  }
  if (mode === 'save') {
   expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(hero);
   expect(core.endgameResult).toBeNull();
  } else expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage', outcome:'traitor'});
 });
 it.each(['save','decline'] as const)('mummy attack non-current hero can respond to death roll: %s', (mode) => {
  let core = createFirstScenarioHauntCore();
  const traitor = core.scenarioRuntime.traitorPlayerId!;
  const [hero, other] = core.playerIds.filter(id => id !== traitor);
  const mummy = core.scenarioRuntime.mummy!.mummyMonsterId;
  const room = core.monsters.find(m => m.id === mummy)!.roomId;
  activateTestExplorer(core, traitor);
  findTestExplorer(core, hero).roomId = room;
  core.scenarioRuntime.deadExplorerPlayerIds = [other];
  setTestTraitTrack(core, hero, 'speed', [1,1,1,1], 2, 2);
  setTestTraitTrack(core, hero, 'might', [1,1,1,1], 2, 2);
  setTestExplorerInventory(core, hero, [{id:'skull',name:'头骨',kind:'omen'}, {id:'rope',name:'兔脚',kind:'item'}]);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, traitor, {monsterId:mummy,targetPlayerId:hero}, 100, createBetrayalScriptedRandom(2,2,2,2,2,2,1,1,1));
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, traitor, {choice:'damage'});
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, hero, {traits:core.pendingDamageAllocation!.forcedTraitSequence!}, 101, createBetrayalScriptedRandom(1,2,2));
  expect(core.recentRoll?.kind).toBe('deathPrevention');
  expect(core.endgameResult).toBeNull();
  expect(BetrayalDomain.validate({core,sys:{} as never}, createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope',dieIndex:0})).valid).toBe(true);
  if (mode === 'save') {
   core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope',dieIndex:0}, 102, createBetrayalScriptedRandom(3));
   expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(hero);
   expect(core.endgameResult).toBeNull();
  } else {
   expect(resolveRecentRollAcknowledgementPresentation(core, hero).canViewerAcknowledge).toBe(true);
   core = acknowledgeRecentRollForAllPlayers(core);
   expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage',outcome:'traitor'});
  }
 });
 it.each(['save','fail','decline'] as const)('hero attack backfire allows death reroll: %s', (mode) => {
  let core = createFirstScenarioHauntCore();
  const traitor = core.scenarioRuntime.traitorPlayerId!;
  const [hero, other] = core.playerIds.filter(id => id !== traitor);
  activateTestExplorer(core, hero);
  findTestExplorer(core, traitor).roomId = core.currentExplorer.roomId;
  core.scenarioRuntime.deadExplorerPlayerIds = [other];
  setTestTraitTrack(core, hero, 'might', [1], 0, 0);
  setTestTraitTrack(core, hero, 'speed', [1], 0, 0);
  setTestTraitTrack(core, traitor, 'might', [4], 0, 0);
  setTestExplorerInventory(core, hero, [{id:'skull',name:'头骨',kind:'omen'}, {id:'rope',name:'兔脚',kind:'item'}]);
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.HAUNT_ATTACK, hero, {target:'traitor'}, 100, createBetrayalScriptedRandom(1,3,3,3,3,1,2,2));
  expect(core.recentRoll?.kind).toBe('deathPrevention');
  expect(core.recentRoll?.latestLabel).toBe('正常死亡');
  expect(core.endgameResult).toBeNull();
  expect(BetrayalDomain.validate({core,sys:{} as never}, createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope',dieIndex:0})).valid).toBe(true);
  if (mode === 'decline') core = acknowledgeRecentRollForAllPlayers(core);
  else core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_RABBIT_FOOT, hero, {cardId:'rope',dieIndex:0}, 101, createBetrayalScriptedRandom(mode === 'save' ? 3 : 1));
  if (mode === 'save') {
   expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(hero);
   expect(core.currentPlayer).toBe(hero);
   expect(core.endgameResult).toBeNull();
  } else expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage',outcome:'traitor'});
 });
 it('no rabbit foot: final death immediately ends game while death roll remains in state', () => {
  let core = createFirstScenarioHauntCore();
  const traitor = core.scenarioRuntime.traitorPlayerId!;
  const [hero, other] = core.playerIds.filter(id => id !== traitor);
  core.scenarioRuntime.deadExplorerPlayerIds = [other];
  placeActiveTestExplorerInRoom(core, hero, 'entrance-hall');
  setScenarioTestTurnMovement(core, 6);
  core.drawOrder = ['event'];
  setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
  core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find(e => e.name === '一种怪异的感觉')!];
  core.deckCounts.event = 1;
  setTestExplorerInventory(core, hero, [{id:'skull',name:'头骨',kind:'omen'}]);
  setTestTraitTrack(core, hero, 'might', [1], 0, 0);
  const roomId = resolveExplorableRoomSlots(core)[0]!.id;
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, hero, {roomId}, 100, createBetrayalScriptedRandom(1,1,2,2,2));
  expect(core.phase).toBe('endgame');
  expect(core.recentRoll).toMatchObject({kind:'deathPrevention',latestLabel:'正常死亡'});
  expect(core.endgameResult).toMatchObject({hauntId:'mummy-rampage',outcome:'traitor'});
 });
});
