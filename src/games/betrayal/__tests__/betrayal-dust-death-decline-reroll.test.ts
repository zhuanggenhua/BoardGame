import { describe, expect, it } from 'vitest';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import { applyBetrayalCommand, acknowledgeAnyPendingCardResolutions, acknowledgeRecentRollForAllPlayers, createBetrayalScriptedRandom, createDustHauntCore, setScenarioTestTurnMovement, BETRAYAL_COMMANDS, findTestExplorer, setNextDiscoverySymbolRoomsForAllFloors, setTestTraitTrack, placeActiveTestExplorerInRoom, setTestExplorerInventory } from './helpers/firstScenarioRuntimeHarness';

describe('dust death prevention declined', () => {
 it.each(['last hero', 'traitor'] as const)('%s finalizes death after public confirmation', (role) => {
  let core = createDustHauntCore();
  const actor = '1';
  placeActiveTestExplorerInRoom(core, actor, 'entrance-hall');
  setScenarioTestTurnMovement(core, 6);
  core.drawOrder = ['event'];
  setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
  core.eventOrder = [{name:'测试直接失去力量', text:'失去 1 点力量', effect:{mode:'trait',trait:'might',amount:-1,recommendedAction:'endTurn'}}];
  core.deckCounts.event = 1;
  setTestExplorerInventory(core, actor, [{id:'skull',name:'头骨',kind:'omen'}, {id:'rope',name:'兔脚',kind:'item'}, {id:'map',name:'地图',kind:'item'}]);
  core.scenarioRuntime.dust!.permanentTraitorPlayerIds = [role === 'traitor' ? actor : '0'];
  core.scenarioRuntime.deadExplorerPlayerIds = role === 'last hero' ? ['2'] : [];
  setTestTraitTrack(core, actor, 'might', [1], 0, 0);
  const roomId = resolveExplorableRoomSlots(core)[0]!.id;
  core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, actor, {roomId}, 100, createBetrayalScriptedRandom(1,2,2));
  expect(core.recentRoll?.kind).toBe('deathPrevention');
  expect(core.recentRoll?.latestLabel).toBe('正常死亡');
  expect(core.endgameResult).toBeNull();
  expect(findTestExplorer(core, actor).inventory.map(c => c.id)).toEqual(['skull','rope','map']);
  core = acknowledgeAnyPendingCardResolutions(core);
  core = acknowledgeRecentRollForAllPlayers(core);
  if (role === 'last hero') {
   expect(core.endgameResult).toMatchObject({hauntId:'the-dust',outcome:'traitor'});
  } else {
   expect(core.endgameResult).toBeNull();
   expect(core.scenarioRuntime.dust?.feverishPlayerIds).toContain(actor);
   expect(findTestExplorer(core, actor).inventory).toEqual([]);
  }
 });
});
