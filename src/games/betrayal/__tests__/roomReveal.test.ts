import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { engineConfig, type BetrayalCore } from '../game';
import type { BetrayalCommand } from '../commandTypes';
import { resolveExplorableRoomSlots } from '../roomDiscoveryModel';
import { BETRAYAL_FIXED_RANDOM, createStartedFirstScenarioCore } from '../testing/firstScenarioTestUtils';

function run(state: MatchState<BetrayalCore>, type: string, payload = {}, playerId = '0') {
  return executePipeline({ domain: engineConfig.domain, systems: engineConfig.systems }, state,
    { type, payload, playerId, timestamp: 100 } as BetrayalCommand, BETRAYAL_FIXED_RANDOM, state.core.playerIds);
}
function prepare() {
  const core = createStartedFirstScenarioCore();
  const state = { core, sys: createInitialSystemState(core.playerIds, engineConfig.systems) };
  const moved = run(state, 'MOVE_TO_ROOM', { roomId: 'hallway' });
  expect(moved.success).toBe(true);
  return moved.state;
}
describe('服务端房间揭示锁定', () => {
  it('不能绕过揭示直接放置', () => {
    const state = prepare();
    expect(run(state, 'EXPLORE_ROOM', { roomId: 'ground-north' }).success).toBe(false);
  });
  it('揭示不进入/扣移动，锁门且不得撤销或开始其它动作', () => {
    const state = prepare();
    expect(state.sys.undo.snapshots.length).toBeGreaterThan(0);
    const result = run(state, 'REVEAL_ROOM', { roomId: 'ground-north' });
    expect(result.success, result.error).toBe(true);
    const revealed = result.state;
    expect(revealed.core.activeRoomId).toBe(state.core.activeRoomId);
    expect(revealed.core.movesRemaining).toBe(state.core.movesRemaining);
    expect(revealed.core.pendingRoomPlacement?.roomId).toBe('ground-north');
    expect(revealed.sys.undo.snapshots).toEqual([]);
    expect(run(revealed, 'SYS_REQUEST_UNDO', { localAutoApprove: true }).success).toBe(false);
    expect(run(revealed, 'MOVE_TO_ROOM', { roomId: 'entrance-hall' }).success).toBe(false);
    expect(run(revealed, 'END_TURN').success).toBe(false);
    const other = resolveExplorableRoomSlots(revealed.core).find(room => room.id !== 'ground-north');
    expect(other).toBeDefined();
    expect(run(revealed, 'REVEAL_ROOM', { roomId: other!.id }).success).toBe(false);
    expect(run(revealed, 'EXPLORE_ROOM', { roomId: 'ground-north' }, '1').success).toBe(false);
    const placed = run(revealed, 'EXPLORE_ROOM', { roomId: 'ground-north' });
    expect(placed.success, placed.error).toBe(true);
    expect(placed.state.core.pendingRoomPlacement).toBeNull();
    expect(placed.state.core.activeRoomId).toBe('ground-north');
    expect(placed.state.sys.undo.snapshots).toEqual([]);
  });
});

import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import { groupRoomDiscoveryDeckByFloor, resolveRoomPlacementPreview } from '../roomDiscoveryModel';
import { createInitialPreviewState, resolveNextPreviewStateAfterCoreChange } from '../previewStateModel';

function fixedRooms(state: MatchState<BetrayalCore>) {
  const rooms = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground;
  state.core.roomDiscoveryDeck = rooms.slice(0, 3).map(room => ({ floor: 'ground' as const, room: structuredClone(room) }));
  state.core.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(state.core.roomDiscoveryDeck);
  return state;
}
describe('揭示的恢复与不可逆选择', () => {
  it('刷新重连只恢复已揭示板块，合法朝向由同一放置算法判定', () => {
    const state = fixedRooms(prepare());
    const revealed = run(state, 'REVEAL_ROOM', { roomId: 'ground-north' }).state;
    const preview = resolveRoomPlacementPreview(revealed.core, { roomId: 'ground-north' })!;
    const restored = createInitialPreviewState(revealed.core);
    expect(restored.pendingRoomPlacementSlotId).toBe('ground-north');
    expect(restored.interactionMode).toBe('explore');
    expect(resolveNextPreviewStateAfterCoreChange(revealed.core, { ...restored, interactionMode: 'move', pendingRoomPlacementSlotId: null }).pendingRoomPlacementSlotId).toBe('ground-north');
    expect(run(revealed, 'EXPLORE_ROOM', { roomId: 'ground-north', orientationTurns: 4 }).success).toBe(false);
    const placed = run(revealed, 'EXPLORE_ROOM', { roomId: 'ground-north', orientationTurns: preview.defaultOrientationTurns, roomTileAdjustment: preview.tileAdjustmentOptions[0] });
    expect(placed.success, placed.error).toBe(true);
    expect(placed.state.core.rooms.find(room => room.id === 'ground-north')?.name).toBe(preview.room.name);
    expect(placed.state.core.roomDiscoveryDeck).toEqual(revealed.core.roomDiscoveryDeck);
  });
  it('圣符只在看到第一张后替换，不能反转/重复/换门或提前结算第一张', () => {
    const state = fixedRooms(prepare());
    state.core.currentExplorer.inventory.push({ id: 'holy-symbol', name: '圣符', kind: 'omen' });
    state.core.turnStartInventoryCardIds.push('holy-symbol');
    expect(run(state, 'REVEAL_ROOM', { roomId: 'ground-north', useHolySymbol: true }).success).toBe(false);
    const first = run(state, 'REVEAL_ROOM', { roomId: 'ground-north' }).state;
    const firstRoom = first.core.pendingRoomPlacement!.draw.roomTemplate!;
    for (const invalid of ['true', 1, {}]) {
      expect(run(first, 'REVEAL_ROOM', { roomId: 'ground-north', useHolySymbol: invalid }).success).toBe(false);
    }
    const second = run(first, 'REVEAL_ROOM', { roomId: 'ground-north', useHolySymbol: true });
    expect(second.success, second.error).toBe(true);
    expect(second.state.core.pendingRoomPlacement!.draw.roomTemplate!.name).not.toBe(firstRoom.name);
    expect(second.state.core.pendingRoomPlacement!.usedHolySymbol).toBe(true);
    expect(second.state.core.roomDiscoveryDeck.at(-1)?.room.name).toBe(firstRoom.name);
    expect(second.state.core.movesRemaining).toBe(state.core.movesRemaining);
    expect(second.state.core.currentExplorer.traits).toEqual(state.core.currentExplorer.traits);
    expect(second.state.core.exploreIndex).toBe(state.core.exploreIndex);
    expect(run(second.state, 'REVEAL_ROOM', { roomId: 'ground-north' }).success).toBe(false);
    expect(run(second.state, 'REVEAL_ROOM', { roomId: 'ground-north', useHolySymbol: true }).success).toBe(false);
  });
  it('区域耗尽可返回移动，未消耗移动也未结束回合', () => {
    const state = prepare();
    state.core.roomDiscoveryDeck = [];
    state.core.roomDiscoveryOrderByFloor = { ground: [], upper: [], basement: [] };
    const result = run(state, 'REVEAL_ROOM', { roomId: 'ground-north' });
    expect(result.success, result.error).toBe(true);
    expect(result.state.core.pendingRoomPlacement).toBeNull();
    expect(result.state.core.latestRoomDrawResolution?.exhausted).toBe(true);
    expect(result.state.core.movesRemaining).toBe(state.core.movesRemaining);
    expect(result.state.core.turnEndedByDiscovery).toBe(false);
    expect(run(result.state, 'MOVE_TO_ROOM', { roomId: 'entrance-hall' }).success).toBe(true);
  });
});

import { betrayalAiRuntime } from '../game';
import { resolveNextLocalAiAction } from '../../../engine/ai/localRunner';
import { resolveRoomDraw, resolveRoomPlacementContext, resolveLegacyRoomDiscoveryEntries } from '../roomDiscoveryModel';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';

describe('公开视图 AI 与历史恢复消费者', () => {
  it('真实本地 AI 在隐藏牌堆视图先揭示再放置，耗尽时不重复请求', async () => {
    const state = fixedRooms(prepare());
    const decide = (state: MatchState<BetrayalCore>) => resolveNextLocalAiAction({ engineConfig, state, matchId: 'local:room-reveal-ai', seatControllers: { '0': { type: 'local-ai', minimumActionDelayMs: 0 }, '1': { type: 'human' }, '2': { type: 'human' } } });
    const first = await decide(state);
    expect(first?.action.commands[0].type).toBe('REVEAL_ROOM');
    const revealed = run(state, first!.action.commands[0].type, first!.action.commands[0].payload as object).state;
    const second = await decide(revealed);
    expect(second?.action.commands[0].type).toBe('EXPLORE_ROOM');
    expect(run(revealed, second!.action.commands[0].type, second!.action.commands[0].payload as object).success).toBe(true);
    state.core.roomDiscoveryDeck = [];
    state.core.roomDiscoveryOrderByFloor = { ground: [], upper: [], basement: [] };
    const view = { ...state, core: engineConfig.domain.playerView!(state.core, '0') as BetrayalCore };
    expect(betrayalAiRuntime.buildLegalActions({ state: view, playerId: '0' }).flatMap(action => action.commands).some(command => command.type === 'REVEAL_ROOM')).toBe(false);
    expect((await decide(state))?.action.commands[0].type).not.toBe('REVEAL_ROOM');
  });
  it.each(['empty', 'missing'])('旧存档楼层池迁移保留已发现数量的偏移（%s），不重新翻回第一张', (variant) => {
    const state = fixedRooms(prepare());
    state.core.roomDiscoveryDeck = []; // Legacy pools rather than a matching unified stack.
    if (variant === 'missing') delete (state.core as Partial<BetrayalCore>).roomDiscoveryDeck;
    state.core.roomDiscoveryOrderByFloor.upper = structuredClone(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper);
    state.core.rooms.push({ ...structuredClone(state.core.rooms.find(room => room.id === 'upper-landing')!), id: 'legacy-upper-placed', startingTile: false });
    const expectedUpper = resolveLegacyRoomDiscoveryEntries(state.core, 'upper').map(entry => entry.room);
    state.core.rooms.push({ ...structuredClone(state.core.rooms.find(room => room.id === 'hallway')!), id: 'legacy-placed', startingTile: false });
    const slot = resolveExplorableRoomSlots(state.core).find(room => room.id === 'ground-north')!;
    const expected = resolveRoomDraw(state.core, slot.floor, { placement: resolveRoomPlacementContext(state.core, slot) }).roomTemplate;
    const result = run(state, 'REVEAL_ROOM', { roomId: slot.id });
    expect(result.success).toBe(true);
    expect(result.state.core.pendingRoomPlacement?.draw.roomTemplate).toEqual(expected);
    expect(result.state.core.roomDiscoveryOrderByFloor.upper).toEqual(expectedUpper);
  });
  it('在线教程命令被拒，本地教程上一步/重启不能绕过揭示屏障', () => {
    let state = prepare();
    const manifest = { id: 'room-reveal-test', steps: [
      { id: 'reveal', content: 'reveal', allowedCommands: ['REVEAL_ROOM'], advanceOnEvents: [{ type: 'ROOM_REVEALED' }] },
      { id: 'place', content: 'place', allowedCommands: ['EXPLORE_ROOM'], advanceOnEvents: [{ type: 'ROOM_EXPLORED' }] },
      { id: 'after', content: 'after' },
    ] };
    const online = { ...state, sys: { ...state.sys, matchId: 'real-online-synthetic' } };
    expect(run(online, TUTORIAL_COMMANDS.START, { manifest }).success).toBe(false);
    state = run(state, TUTORIAL_COMMANDS.START, { manifest }).state;
    state = run(state, 'REVEAL_ROOM', { roomId: 'ground-north' }).state;
    expect(state.sys.tutorial.stepIndex).toBe(1);
    expect(run(state, TUTORIAL_COMMANDS.PREVIOUS).success).toBe(false);
    expect(run(state, TUTORIAL_COMMANDS.RESTART_STEP).state.core.pendingRoomPlacement).toEqual(state.core.pendingRoomPlacement);
    state = run(state, 'EXPLORE_ROOM', { roomId: 'ground-north' }).state;
    expect(run(state, TUTORIAL_COMMANDS.PREVIOUS).success).toBe(false);
    expect(engineConfig.transportView(state).sys.tutorial.checkpoints).toBeUndefined();
  });
});
