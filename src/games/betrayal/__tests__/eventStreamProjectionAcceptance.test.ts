import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { EventStreamEntry, GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { applyPatches, type Operation } from '../../../engine/transport/patch';
import {
  broadcastProjectedMatchState,
  type TransportStateProjectionMatch,
} from '../../../engine/transport/stateProjection';
import { TransportStateSynchronizer } from '../../../engine/transport/transportStateSynchronizer';
import { resolveFeedback } from '../../../lib/audio/audioRouting';
import { BETRAYAL_AUDIO_CONFIG } from '../audio.config';
import { BETRAYAL_COMMANDS } from '../commands';
import type { BetrayalCommand } from '../commandTypes';
import { EVENTS } from '../events';
import { projectBetrayalEventForPresentation } from '../eventStreamProjection';
import { engineConfig, type BetrayalCore } from '../game';
import { resolveInventoryEffectId } from '../possessionEffects';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import { resolveSceneMovementFacts } from '../sceneMovementModel';
import {
  BETRAYAL_FIXED_RANDOM,
  createBetrayalScriptedRandom,
  createFirstScenarioHauntCore,
  createStartedFirstScenarioCore,
  setScenarioTestTurnMovement,
} from '../testing/firstScenarioTestUtils';

const PRIVATE_MARKER = 'AUDIT_PRIVATE_EVENT_62bd';
const audioContext = { G: {}, ctx: {}, meta: {} };
const audioSamples = [
  { name: 'default', payload: {} },
  { name: 'success', payload: { hauntTriggered: true, deckKind: 'omen', cardId: 'holy-water-preview-3', choice: 'steal', success: true } },
  { name: 'failure', payload: { hauntTriggered: false, deckKind: 'event', cardId: 'omen-book', choice: 'damage', success: false } },
  { name: 'item', payload: { deckKind: 'item' } },
];
const audioCases = [...Object.values(EVENTS), 'AUDIT_UNKNOWN_EVENT'].flatMap((type) => (
  audioSamples.map((sample) => ({ ...sample, type }))
));

describe('山屋事件投影保持公开表现并移除隐藏内容', () => {
  it.each(audioCases)('$type / $name 的音效路由保持不变', ({ type, payload }) => {
    const event: GameEvent = {
      type,
      timestamp: 123,
      payload: {
        ...payload,
        arbitraryPrivateField: PRIVATE_MARKER,
        dustSetup: { secret: PRIVATE_MARKER },
        eventRerollHaunt: { secret: PRIVATE_MARKER },
      },
    };
    const before = structuredClone(event);
    const projected = projectBetrayalEventForPresentation(event);
    expect(JSON.stringify(projected)).not.toContain(PRIVATE_MARKER);
    expect(event).toEqual(before);
    expect(resolveFeedback(projected, audioContext, BETRAYAL_AUDIO_CONFIG))
      .toEqual(resolveFeedback(event, audioContext, BETRAYAL_AUDIO_CONFIG));
  });

  it.each([
    { type: EVENTS.EXPLORER_MOVED, payload: { playerId: '0', roomId: 'hallway' } },
    { type: EVENTS.EXPLORER_MOVED, payload: { playerId: '0', roomId: 'hallway', controlledToken: 'jack-spirit', usedActionId: 'teleport' } },
    { type: EVENTS.EXPLORER_MOVED, payload: { playerId: '0', roomId: 'hallway', controlledToken: 'feverish', skeletonKeyCardId: 'skeleton-key' } },
    { type: EVENTS.ROOM_EXPLORED, payload: { playerId: '0', roomId: 'hallway' } },
    { type: EVENTS.MONSTER_MOVED, payload: { monsterId: 'm', fromRoomId: 'entrance-hall', toRoomId: 'hallway', teleportMove: true } },
    { type: EVENTS.HELPING_HANDS_TROLL_HAND_MOVED, payload: { monsterId: 'm', fromRoomId: 'entrance-hall', toRoomId: 'hallway' } },
  ])('$type 的移动/受控实体/瞬移事实保持不变: $payload', ({ type, payload }) => {
    const core = createStartedFirstScenarioCore();
    const previousRooms = new Map([
      ['player:0', 'entrance-hall'],
      ['monster:m', 'entrance-hall'],
      ['monster:jack-spirit', 'entrance-hall'],
      ['monster:feverish-0', 'entrance-hall'],
    ]);
    const entry: EventStreamEntry = { id: 1, event: { type, payload, timestamp: 123 } };
    const raw = resolveSceneMovementFacts([entry], previousRooms, core.rooms);
    expect(raw).toHaveLength(1); // Do not accept a vacuous [] === [] comparison.
    expect(resolveSceneMovementFacts([
      { ...entry, event: projectBetrayalEventForPresentation(entry.event) },
    ], previousRooms, core.rooms)).toEqual(raw);
  });

  it('保留根级音效优先级，同时不透传未知根字段或嵌套 payload', () => {
    const event = {
      type: 'AUDIT_UNKNOWN_EVENT', timestamp: 123, sourceCommandType: 'AUDIT_COMMAND',
      sfxKey: 'public-fallback', audioKey: 'public-primary',
      payload: { private: PRIVATE_MARKER }, privateRoot: PRIVATE_MARKER,
    };
    const projected = projectBetrayalEventForPresentation(event);
    expect(projected).toEqual({
      type: event.type, timestamp: 123, sourceCommandType: 'AUDIT_COMMAND',
      sfxKey: 'public-fallback', audioKey: 'public-primary', payload: {},
    });
    expect(resolveFeedback(projected, audioContext, BETRAYAL_AUDIO_CONFIG)).toBe('public-primary');
    expect(resolveFeedback({ ...projected, audioKey: undefined }, audioContext, BETRAYAL_AUDIO_CONFIG))
      .toBe('public-fallback');
  });
});

const stateFromCore = (core: BetrayalCore): MatchState<BetrayalCore> => ({
  core,
  sys: createInitialSystemState(core.playerIds, engineConfig.systems, 'synthetic-event-projection'),
});

const run = (
  state: MatchState<BetrayalCore>,
  type: BetrayalCommand['type'],
  playerId: string,
  payload: Record<string, unknown> = {},
  random: RandomFn = BETRAYAL_FIXED_RANDOM,
): MatchState<BetrayalCore> => {
  if (type === BETRAYAL_COMMANDS.EXPLORE_ROOM && !state.core.pendingRoomPlacement) {
    state = run(state, BETRAYAL_COMMANDS.REVEAL_ROOM, playerId, { roomId: payload.roomId });
  }
  const result = executePipeline(
    { domain: engineConfig.domain, systems: engineConfig.systems },
    state,
    { type, playerId, payload, timestamp: 100 + state.sys.eventStream.nextId } as BetrayalCommand,
    random,
    state.core.playerIds,
  );
  expect(result.success, `${type}: ${result.error ?? ''}`).toBe(true);
  return result.state;
};

const prepareHauntChoice = (name: string): MatchState<BetrayalCore> => {
  const core = createStartedFirstScenarioCore();
  const kitchen = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'kitchen');
  const event = BETRAYAL_DISCOVERY_POOLS.events.find((candidate) => candidate.name === name);
  expect(kitchen).toBeDefined();
  expect(event).toBeDefined();
  core.eventOrder = [event!];
  core.roomDiscoveryDeck = [{ floor: 'ground', room: structuredClone(kitchen!) }];
  core.roomDiscoveryOrderByFloor = { ground: [structuredClone(kitchen!)], upper: [], basement: [] };
  core.currentExplorer.inventory = [
    { id: 'omen-book', name: '书本', kind: 'omen' },
    { id: 'dog', name: '狗', kind: 'omen' },
    { id: 'mask', name: '面具', kind: 'omen' },
    { id: 'rope', name: '兔脚', kind: 'item' },
  ];
  core.currentExplorerInventory = structuredClone(core.currentExplorer.inventory);
  core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
  let state = run(stateFromCore(core), BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
  state = run(state, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
  return state;
};

// Exercise the real broadcast projection and reconstruct incremental packets.
// Only the socket boundary is mocked; rules, reducers and projections are real.
const captureBroadcast = (initialState: MatchState<BetrayalCore>) => {
  const received = new Map<string, MatchState<BetrayalCore>>();
  const packetTypes: string[] = [];
  const receive = (socketId: string, type: string, data: unknown) => {
    packetTypes.push(type);
    if (type === 'state:update' || type === 'state:sync') {
      received.set(socketId, data as MatchState<BetrayalCore>);
    } else if (type === 'state:patch') {
      const patched = applyPatches(received.get(socketId), data as Operation[]);
      expect(patched.success, patched.error).toBe(true);
      received.set(socketId, patched.state as MatchState<BetrayalCore>);
    }
  };
  const io = {
    of: () => ({ to: (socketId: string) => ({ emit: (type: string, _matchId: string, data: unknown) => {
      receive(socketId, type, data);
    } }) }),
  } as unknown as IOServer;
  const match: TransportStateProjectionMatch = {
    matchID: 'synthetic-event-projection', engineConfig, state: initialState,
    metadata: { gameName: 'betrayal', players: { '0': { name: 'Synthetic 0' }, '1': { name: 'Synthetic 1' }, '2': { name: 'Synthetic 2' } }, createdAt: 0, updatedAt: 0 },
    stateID: 0, randomSeed: 'synthetic', getRandomCursor: () => 0,
    connections: new Map([['0', new Set(['owner'])], ['1', new Set(['other'])]]),
    spectatorSockets: new Set(['spectator']), lastBroadcastedViews: new Map(), lastCommandPlayerId: '0',
  };
  return {
    packetTypes,
    viewsBySocket: received,
    sync: (state: MatchState<BetrayalCore>) => {
      const authorityBefore = JSON.stringify(state);
      match.state = state;
      const synchronizer = new TransportStateSynchronizer(io);
      for (const [socketId, playerID] of [['owner', '0'], ['other', '1'], ['spectator', null]] as const) {
        synchronizer.syncSocket({
          socket: { emit: (type, ...args) => receive(socketId, type, args[1]) },
          match,
          playerID,
        });
      }
      expect(JSON.stringify(state)).toBe(authorityBefore);
    },
    publish: (state: MatchState<BetrayalCore>) => {
      const authorityBefore = JSON.stringify(state);
      match.state = state;
      match.stateID += 1;
      broadcastProjectedMatchState({ io, match });
      expect(JSON.stringify(state)).toBe(authorityBefore);
      expect([...received.keys()].sort()).toEqual(['other', 'owner', 'spectator']);
      for (const view of received.values()) {
        expect(view.sys.eventStream.nextId).toBe(state.sys.eventStream.nextId);
        expect(view.sys.eventStream.entries.map((entry) => entry.id))
          .toEqual(state.sys.eventStream.entries.map((entry) => entry.id));
      }
      return [...received.values()];
    },
  };
};

const eventPayload = (state: MatchState<BetrayalCore>, type: string) => {
  const event = state.sys.eventStream.entries.findLast((entry) => entry.event.type === type)?.event;
  expect(event, `expected ${type}`).toBeDefined();
  return event!.payload as Record<string, unknown>;
};

describe('山屋真实命令产生的秘密不进入网络事件流', () => {
  it('镜中 pending 秘密在 sync/update/patch 中仅揭示者可见，最终结算保持同一权限', () => {
    let state = run(prepareHauntChoice('怪异的镜子'), BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }, createBetrayalScriptedRandom(3, 3, 3));
    const setup = state.core.pendingEventRollResolution?.uponReflectionSetup;
    expect(setup?.revealerPlayerId).toBe('0');
    expect(setup?.secretCombination).toBeTruthy();
    expect(state.core.scenarioRuntime.uponReflection).toBeUndefined();
    const secret = structuredClone(setup!.secretCombination);

    const expectPendingVisibility = (views: Map<string, MatchState<BetrayalCore>>) => {
      expect([...views.keys()].sort()).toEqual(['other', 'owner', 'spectator']);
      for (const [socketId, view] of views) {
        const pending = view.core.pendingEventRollResolution;
        expect(pending?.rollId).toBe(state.core.pendingEventRollResolution!.rollId);
        expect(pending?.uponReflectionSetup?.revealerPlayerId).toBe('0');
        expect(pending?.uponReflectionSetup?.secretCombination)
          .toEqual(socketId === 'owner' ? secret : null);
        expect(eventPayload(view, EVENTS.EVENT_CHOICE_RESOLVED)).toEqual({ hauntTriggered: true });
        if (socketId !== 'owner') {
          // Check the whole transmitted view, including duplicate event/undo copies.
          expect(JSON.stringify(view)).not.toContain('"secretCombination":{');
        }
      }
      expect(state.core.pendingEventRollResolution?.uponReflectionSetup?.secretCombination).toEqual(secret);
    };

    const connected = captureBroadcast(state);
    connected.sync(state);
    expect(connected.packetTypes).toEqual(['state:sync', 'state:sync', 'state:sync']);
    expectPendingVisibility(connected.viewsBySocket);
    expect(connected.viewsBySocket.get('owner')!.core.pendingEventRollResolution!.uponReflectionSetup!.secretCombination)
      .not.toBe(setup!.secretCombination);

    const uncached = captureBroadcast(state);
    uncached.publish(state);
    expect(uncached.packetTypes).toEqual(['state:update', 'state:update', 'state:update']);
    expectPendingVisibility(uncached.viewsBySocket);

    for (const playerId of ['0', '1']) {
      state = run(state, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, playerId, { rollId: state.core.pendingEventRollResolution!.rollId });
      const beforePackets = connected.packetTypes.length;
      connected.publish(state);
      expect(connected.packetTypes.slice(beforePackets)).toEqual(['state:patch', 'state:patch', 'state:patch']);
      expectPendingVisibility(connected.viewsBySocket);
      for (const view of connected.viewsBySocket.values()) {
        expect(view.core.pendingEventRollResolution?.acknowledgedPlayerIds)
          .toEqual(state.core.pendingEventRollResolution!.acknowledgedPlayerIds);
      }
    }

    state = run(state, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, '2', { rollId: state.core.pendingEventRollResolution!.rollId });
    expect(state.core.pendingEventRollResolution).toBeNull();
    expect(state.core.scenarioRuntime.uponReflection?.secretCombination).toEqual(secret);
    connected.publish(state);
    for (const [socketId, view] of connected.viewsBySocket) {
      expect(view.core.pendingEventRollResolution).toBeNull();
      expect(view.core.scenarioRuntime.uponReflection?.secretCombination)
        .toEqual(socketId === 'owner' ? secret : null);
      if (socketId !== 'owner') expect(JSON.stringify(view)).not.toContain('"secretCombination":{');
    }
  });

  it.each([
    { name: '一瓶微尘', secretField: 'dustSetup' },
    { name: '怪异的镜子', secretField: 'uponReflectionSetup' },
  ])('$name 的初次触发与最终确认只发送公开事件', ({ name, secretField }) => {
    let state = run(prepareHauntChoice(name), BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }, createBetrayalScriptedRandom(3, 3, 3));
    expect(eventPayload(state, EVENTS.EVENT_CHOICE_RESOLVED)[secretField]).toBeDefined();
    const broadcast = captureBroadcast(state);
    for (const view of broadcast.publish(state)) {
      expect(eventPayload(view, EVENTS.EVENT_CHOICE_RESOLVED)).toEqual({ hauntTriggered: true });
      expect(JSON.stringify(view.sys.actionLog)).not.toMatch(/dustSetup|uponReflectionSetup|secretCombination|permanentTraitorPlayerIds/);
    }
    expect(broadcast.packetTypes).toEqual(['state:update', 'state:update', 'state:update']);
    for (const playerId of state.core.playerIds) {
      expect(state.core.pendingEventRollResolution).not.toBeNull();
      state = run(state, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, playerId, { rollId: state.core.pendingEventRollResolution!.rollId });
      expect(eventPayload(state, EVENTS.EVENT_ROLL_FINALIZED)[secretField]).toBeDefined();
      for (const view of broadcast.publish(state)) {
        expect(eventPayload(view, EVENTS.EVENT_ROLL_FINALIZED)).toEqual({});
        expect(eventPayload(view, EVENTS.EVENT_CHOICE_RESOLVED)).toEqual({ hauntTriggered: true });
      }
    }
    expect(state.core.phase).toBe('haunt');
    expect(state.core.pendingEventRollResolution).toBeNull();
    expect(broadcast.packetTypes).toContain('state:patch');
  });

  it.each([
    { name: '一瓶微尘', secretField: 'dustSetup' },
    { name: '怪异的镜子', secretField: 'uponReflectionSetup' },
  ])('$name 的兔脚失败转成功不会通过重投事件泄漏 setup', ({ name, secretField }) => {
    let state = run(prepareHauntChoice(name), BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }, createBetrayalScriptedRandom(3, 3, 1));
    expect(state.core.pendingEventRollResolution?.hauntTriggered).toBe(false);
    const broadcast = captureBroadcast(state);
    broadcast.publish(state);
    state = run(state, BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 2 }, createBetrayalScriptedRandom(3));
    const rawHaunt = eventPayload(state, EVENTS.RABBIT_FOOT_USED).eventRerollHaunt as Record<string, unknown>;
    expect(rawHaunt.hauntTriggered).toBe(true);
    expect(rawHaunt[secretField]).toBeDefined();
    for (const view of broadcast.publish(state)) {
      expect(eventPayload(view, EVENTS.RABBIT_FOOT_USED)).toEqual({});
    }
    for (const playerId of state.core.playerIds) {
      state = run(state, BETRAYAL_COMMANDS.FINALIZE_EVENT_ROLL, playerId, { rollId: state.core.pendingEventRollResolution!.rollId });
    }
    expect(state.core.phase).toBe('haunt');
    for (const view of broadcast.publish(state)) {
      expect(eventPayload(view, EVENTS.EVENT_ROLL_FINALIZED)).toEqual({});
      expect(eventPayload(view, EVENTS.RABBIT_FOOT_USED)).toEqual({});
    }
  });

  it('木乃伊英雄找到书本后，剩余预兆牌序不进入其他玩家或旁观者事件流', () => {
    const core = createFirstScenarioHauntCore();
    for (const explorer of [core.currentExplorer, ...core.otherExplorers]) {
      explorer.inventory = explorer.inventory.filter((card) => resolveInventoryEffectId(card.id) !== 'omen-book');
    }
    core.currentExplorerInventory = structuredClone(core.currentExplorer.inventory);
    core.scenarioRuntime.mummy!.mummyCarriedOmenIds = [];
    core.scenarioRuntime.mummy!.mummyCarriedCards = [];
    core.possessionOrderByKind.omen = [
      { id: 'omen-book', name: '书本', kind: 'omen' },
      { id: PRIVATE_MARKER, name: PRIVATE_MARKER, kind: 'omen' },
    ];
    core.deckCounts.omen = 2;
    const room = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((candidate) => (
      candidate.discoverySymbol === 'omen'
      && !core.rooms.some((discovered) => discovered.state === 'discovered' && discovered.visualId === candidate.visualId)
    ));
    expect(room).toBeDefined();
    core.roomDiscoveryDeck = [{ floor: 'upper', room: structuredClone(room!) }];
    core.roomDiscoveryOrderByFloor = { ground: [], upper: [structuredClone(room!)], basement: [] };
    core.turnEndedByDiscovery = false;
    setScenarioTestTurnMovement(core, 6);
    const state = run(stateFromCore(core), BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'frontier-upper-north-north' });
    const raw = eventPayload(state, EVENTS.ROOM_EXPLORED);
    expect(raw.drawnCard).toMatchObject({ name: '书本' });
    expect(JSON.stringify(raw.mummyForcedOmenSearch)).toContain(PRIVATE_MARKER);
    for (const view of captureBroadcast(state).publish(state)) {
      expect(eventPayload(view, EVENTS.ROOM_EXPLORED)).toEqual({ playerId: '0', roomId: 'frontier-upper-north-north', deckKind: 'omen', hauntTriggered: false });
      expect(JSON.stringify(view.sys.eventStream)).not.toContain(PRIVATE_MARKER);
      expect(JSON.stringify(view.sys.actionLog)).not.toContain(PRIVATE_MARKER);
    }
  });
});
