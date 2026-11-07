import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { applyPatches, type Operation } from '../../../engine/transport/patch';
import {
  broadcastProjectedMatchState,
  type TransportStateProjectionMatch,
} from '../../../engine/transport/stateProjection';
import { TransportStateSynchronizer } from '../../../engine/transport/transportStateSynchronizer';
import { BETRAYAL_COMMANDS } from '../commands';
import type { BetrayalCommand } from '../commandTypes';
import { EVENTS, type BetrayalEvent } from '../events';
import { engineConfig, type BetrayalCore } from '../game';
import { BETRAYAL_DISCOVERY_POOLS } from '../scenarioConfig';
import { BETRAYAL_FIXED_RANDOM, createStartedFirstScenarioCore } from '../testing/firstScenarioTestUtils';

// Card contract C2-C3: evidence/betrayal/betrayal-discovery-effect-audit-2026-07-02.md:164.
// Choosing not to draw an event must neither reveal it nor move it to the deck bottom.
const PRIVATE_EVENT = 'AUDIT_UNDRAWN_IDOL_CARD_704a';
const SECOND_EVENT = 'AUDIT_NEXT_IDOL_CARD_704a';
const routes = ['direct declaration', 'two-step choice'] as const;
type Route = typeof routes[number];

const run = (state: MatchState<BetrayalCore>, type: BetrayalCommand['type'], payload: Record<string, unknown>): MatchState<BetrayalCore> => {
  if (type === BETRAYAL_COMMANDS.EXPLORE_ROOM && !state.core.pendingRoomPlacement) {
    state = run(state, BETRAYAL_COMMANDS.REVEAL_ROOM, { roomId: payload.roomId });
  }
  const result = executePipeline(
    { domain: engineConfig.domain, systems: engineConfig.systems },
    state,
    { type, playerId: '0', payload, timestamp: 100 + state.sys.eventStream.nextId } as BetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    state.core.playerIds,
  );
  expect(result.success, `${type}: ${result.error ?? ''}`).toBe(true);
  return result.state;
};

const prepare = (emptyDeck = false): MatchState<BetrayalCore> => {
  const core = createStartedFirstScenarioCore();
  const kitchen = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'kitchen');
  expect(kitchen).toBeDefined();
  core.roomDiscoveryDeck = [{ floor: 'ground', room: structuredClone(kitchen!) }];
  core.roomDiscoveryOrderByFloor = { ground: [structuredClone(kitchen!)], upper: [], basement: [] };
  core.eventOrder = emptyDeck ? [] : [
    {
      name: PRIVATE_EVENT,
      description: 'Synthetic event whose name must remain hidden when no card is drawn.',
      effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
    },
    { name: SECOND_EVENT, effect: { mode: 'none', recommendedAction: 'endTurn' } },
  ];
  core.deckCounts.event = core.eventOrder.length;
  core.currentExplorer.inventory = [{ id: 'idol', name: '雕像', kind: 'omen' }];
  core.currentExplorerInventory = structuredClone(core.currentExplorer.inventory);
  core.turnStartInventoryCardIds = ['idol'];
  return run({
    core,
    sys: createInitialSystemState(core.playerIds, engineConfig.systems, 'idol-skip-acceptance'),
  }, BETRAYAL_COMMANDS.MOVE_TO_ROOM, { roomId: 'hallway' });
};

const skip = (state: MatchState<BetrayalCore>, route: Route) => {
  let next = run(state, BETRAYAL_COMMANDS.EXPLORE_ROOM, {
    roomId: 'ground-north',
    ...(route === 'direct declaration' ? { useIdol: true } : {}),
  });
  if (route === 'two-step choice') {
    expect(next.core.pendingEventChoice?.sourceKind).toBe('event-symbol-skip');
    next = run(next, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, { accept: true });
  }
  return next;
};

// Only Socket.IO is mocked. Command execution, public projection, synchronization
// and patch reconstruction all use their real engine implementations.
const transport = (initial: MatchState<BetrayalCore>) => {
  const views = new Map<string, MatchState<BetrayalCore>>();
  const packetTypes: string[] = [];
  const receive = (socketId: string, type: string, data: unknown) => {
    packetTypes.push(type);
    if (type === 'state:patch') {
      const patched = applyPatches(views.get(socketId), data as Operation[]);
      expect(patched.success, patched.error).toBe(true);
      views.set(socketId, patched.state as MatchState<BetrayalCore>);
    } else if (type === 'state:update' || type === 'state:sync') {
      views.set(socketId, data as MatchState<BetrayalCore>);
    }
  };
  const io = {
    of: () => ({ to: (socketId: string) => ({ emit: (type: string, _matchId: string, data: unknown) => {
      receive(socketId, type, data);
    } }) }),
  } as unknown as IOServer;
  const match: TransportStateProjectionMatch = {
    matchID: 'idol-skip-acceptance', engineConfig, state: initial,
    metadata: { gameName: 'betrayal', players: { '0': { name: 'Synthetic 0' }, '1': { name: 'Synthetic 1' }, '2': { name: 'Synthetic 2' } }, createdAt: 0, updatedAt: 0 },
    stateID: 0, randomSeed: 'synthetic', getRandomCursor: () => 0,
    connections: new Map([['0', new Set(['owner'])], ['1', new Set(['other'])]]),
    spectatorSockets: new Set(['spectator']), lastBroadcastedViews: new Map(), lastCommandPlayerId: '0',
  };
  return {
    views,
    packetTypes,
    send: (state: MatchState<BetrayalCore>, mode: 'sync' | 'broadcast') => {
      const authorityBefore = structuredClone(state);
      match.state = state;
      match.stateID += 1;
      if (mode === 'sync') {
        const synchronizer = new TransportStateSynchronizer(io);
        for (const [socketId, playerID] of [['owner', '0'], ['other', '1'], ['spectator', null]] as const) {
          synchronizer.syncSocket({
            socket: { emit: (type, ...args) => receive(socketId, type, args[1]) }, match, playerID,
          });
        }
      } else {
        broadcastProjectedMatchState({ io, match });
      }
      expect(state).toEqual(authorityBefore);
      expect([...views.keys()].sort()).toEqual(['other', 'owner', 'spectator']);
    },
  };
};

describe('雕像不抽事件合同：声明与两步选择保持同一结果', () => {
  it.each(routes)('%s 不移动牌堆、不弃牌、不结算效果', (route) => {
    const before = prepare();
    const after = skip(before, route);
    expect.soft(after.core.eventOrder).toEqual(before.core.eventOrder);
    expect(after.core.deckCounts.event).toBe(before.core.deckCounts.event);
    expect(after.core.discardCounts.event).toBe(before.core.discardCounts.event);
    expect(after.core.currentExplorer.traits).toEqual(before.core.currentExplorer.traits);
    expect(after.core.currentExplorer.inventory).toEqual(before.core.currentExplorer.inventory);
    expect(after.core.currentExplorer.roomId).toBe('ground-north');
    expect(after.core.pendingEventChoice).toBeNull();
    expect(after.core.pendingEventRollStart).toBeNull();
    expect(after.core.pendingEventRollResolution).toBeNull();
    expect(after.core.recentRoll).toBeNull();
  });

  it.each(routes)('%s 的 sync/update/patch 日志、发现反馈及预览不泄露未抽顶牌', (route) => {
    const before = prepare();
    const after = skip(before, route);
    for (const mode of ['sync', 'update', 'patch'] as const) {
      const wire = transport(before);
      if (mode === 'patch') wire.send(before, 'broadcast');
      const packetStart = wire.packetTypes.length;
      wire.send(after, mode === 'sync' ? 'sync' : 'broadcast');
      expect(wire.packetTypes.slice(packetStart)).toEqual(Array(3).fill(`state:${mode}`));
      for (const [role, view] of wire.views) {
        const publicFields = {
          actionLog: view.sys.actionLog, // Includes interactive card-preview payloads.
          eventStream: view.sys.eventStream,
          activityLog: view.core.activityLog,
          latestDiscovery: view.core.latestDiscovery,
          pendingCardResolutionQueue: view.core.pendingCardResolutionQueue,
        };
        for (const [field, value] of Object.entries(publicFields)) {
          const serialized = JSON.stringify(value);
          expect.soft(serialized, `${route}/${mode}/${role}/${field}`).not.toContain(PRIVATE_EVENT);
          expect.soft(serialized, `${route}/${mode}/${role}/${field}`).not.toContain(SECOND_EVENT);
        }
      }
    }
  });

  it.each([true, false])('事件堆为空时探索仍合法且不抽牌（useIdol=%s）', (useIdol) => {
    const before = run(prepare(true), BETRAYAL_COMMANDS.REVEAL_ROOM, { roomId: 'ground-north' });
    const command = {
      type: BETRAYAL_COMMANDS.EXPLORE_ROOM, playerId: '0', timestamp: 200,
      payload: { roomId: 'ground-north', ...(useIdol ? { useIdol: true } : {}) },
    } as BetrayalCommand;
    expect(engineConfig.domain.validate(before, command)).toMatchObject({ valid: true });
    const after = run(before, command.type, command.payload);
    expect(after.core.eventOrder).toEqual([]);
    expect(after.core.deckCounts.event).toBe(0);
    expect(after.core.discardCounts.event).toBe(before.core.discardCounts.event);
    expect(after.core.currentExplorer.traits).toEqual(before.core.currentExplorer.traits);
    expect(after.core.currentExplorer.roomId).toBe('ground-north');
    expect(after.core.pendingEventChoice).toBeNull();
    expect(after.core.pendingEventRollStart).toBeNull();
    expect(after.core.pendingEventRollResolution).toBeNull();
    expect(after.core.recentRoll).toBeNull();
  });

  it('两步选择拒绝跳过时正常抽牌、结算并公开该牌', () => {
    const before = prepare();
    const explored = run(before, BETRAYAL_COMMANDS.EXPLORE_ROOM, { roomId: 'ground-north' });
    const after = run(explored, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, { accept: false });
    expect(after.core.eventOrder.map((card) => card.name)).toEqual([SECOND_EVENT, PRIVATE_EVENT]);
    expect(after.core.currentExplorer.traits.might).toBe(before.core.currentExplorer.traits.might - 1);
    expect(after.core.latestDiscovery?.title).toBe(PRIVATE_EVENT);
  });

  it.each([
    { version: '旧的具名跳过事件', legacy: true, expectedOrder: [SECOND_EVENT, PRIVATE_EVENT] },
    { version: '新的空对象跳过事件', legacy: false, expectedOrder: [PRIVATE_EVENT, SECOND_EVENT] },
  ])('$version 重放保留对应版本的牌序语义', ({ legacy, expectedOrder }) => {
    const before = prepare();
    const after = skip(before, 'direct declaration');
    const generated = after.sys.eventStream.entries.findLast((entry) => entry.event.type === EVENTS.ROOM_EXPLORED)?.event;
    expect(generated).toBeDefined();
    const replayEvent = structuredClone(generated) as Extract<BetrayalEvent, { type: typeof EVENTS.ROOM_EXPLORED }>;
    expect(replayEvent.payload.skippedEventWithIdol).toEqual({});
    expect(JSON.stringify(replayEvent)).not.toContain(PRIVATE_EVENT);

    if (legacy) {
      // Persisted events from before the privacy fix carried the skipped card's
      // name in all three places. Replay must retain their historical rotation;
      // this does not authorize new commands to produce the old event shape.
      replayEvent.payload.skippedEventWithIdol = { name: PRIVATE_EVENT };
      replayEvent.payload.discovery.title = PRIVATE_EVENT;
      replayEvent.payload.logText = `探索到厨房，使用雕像跳过了事件：${PRIVATE_EVENT}`;
    }

    const beforeReplay = structuredClone(before.core);
    const eventBeforeReplay = structuredClone(replayEvent);
    const replayed = engineConfig.domain.reduce(before.core, replayEvent);
    expect(replayed.eventOrder.map((card) => card.name)).toEqual(expectedOrder);
    expect(replayed.deckCounts.event).toBe(before.core.deckCounts.event);
    expect(replayed.discardCounts.event).toBe(before.core.discardCounts.event);
    expect(replayed.currentExplorer.traits).toEqual(before.core.currentExplorer.traits);
    expect(replayed.currentExplorer.roomId).toBe('ground-north');
    expect(before.core).toEqual(beforeReplay);
    expect(replayEvent).toEqual(eventBeforeReplay);
  });
});
