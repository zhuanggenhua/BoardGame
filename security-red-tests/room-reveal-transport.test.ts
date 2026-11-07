import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import { createInitialSystemState, executePipeline } from '../src/engine/pipeline';
import { applyPatches, type Operation } from '../src/engine/transport/patch';
import { broadcastProjectedMatchState } from '../src/engine/transport/stateProjection';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { engineConfig, type BetrayalCore } from '../src/games/betrayal/game';
import type { BetrayalCommand } from '../src/games/betrayal/commandTypes';
import type { MatchState } from '../src/engine/types';
import { createStartedFirstScenarioCore, BETRAYAL_FIXED_RANDOM } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { createInitialPreviewState } from '../src/games/betrayal/previewStateModel';
import { groupRoomDiscoveryDeckByFloor } from '../src/games/betrayal/roomDiscoveryModel';
import { BETRAYAL_DISCOVERY_POOLS } from '../src/games/betrayal/scenarioConfig';
import { createSyntheticMatch } from './transportCapture';

describe('房间牌堆在真实同步/增量/重连路径保密', () => {
  it('所有座位和观战只接收已翻板块，areaMismatch 正面与未来牌不进入任何包', () => {
    const core = createStartedFirstScenarioCore();
    const upper = structuredClone(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper[0]);
    const future = structuredClone(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground[2]);
    upper.name = 'PRIVATE_BACK_ONLY_7a'; future.name = 'PRIVATE_FUTURE_7b';
    core.roomDiscoveryDeck = [{ floor: 'upper', room: upper }, ...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.slice(0, 2).map(room => ({ floor: 'ground' as const, room: structuredClone(room) })), { floor: 'ground', room: future }];
    core.roomDiscoveryOrderByFloor = groupRoomDiscoveryDeckByFloor(core.roomDiscoveryDeck);
    let state = { core, sys: createInitialSystemState(core.playerIds, engineConfig.systems) };
    const run = (type: string, payload: object) => {
      const result = executePipeline({ domain: engineConfig.domain, systems: engineConfig.systems }, state, { type, payload, playerId: '0', timestamp: 100 } as BetrayalCommand, BETRAYAL_FIXED_RANDOM, core.playerIds);
      expect(result.success, result.error).toBe(true); state = result.state;
    };
    run('MOVE_TO_ROOM', { roomId: 'hallway' });
    run('SYS_TUTORIAL_START', { manifest: { id: 'transport-reveal', steps: [
      { id: 'reveal', content: 'reveal', advanceOnEvents: [{ type: 'ROOM_REVEALED' }] },
      { id: 'place', content: 'place', advanceOnEvents: [{ type: 'ROOM_EXPLORED' }] },
      { id: 'after', content: 'after' },
    ] } });
    const match = createSyntheticMatch();
    match.connections = new Map([['0', new Set(['owner'])], ['1', new Set(['other'])]]);
    match.spectatorSockets = new Set(['spectator']);
    const received = new Map<string, MatchState<BetrayalCore>>();
    const packets: string[] = [];
    const receive = (id: string, event: string, payload: unknown) => {
      expect(JSON.stringify(payload)).not.toMatch(/PRIVATE_BACK_ONLY_7a|PRIVATE_FUTURE_7b/);
      packets.push(event);
      if (event === 'state:patch') {
        const result = applyPatches(received.get(id), payload as Operation[]);
        expect(result.success).toBe(true); received.set(id, result.state as MatchState<BetrayalCore>);
      } else received.set(id, payload as MatchState<BetrayalCore>);
    };
    const io = { of: () => ({ to: (id: string) => ({ emit: (event: string, _matchID: string, payload: unknown) => receive(id, event, payload) }) }) } as unknown as IOServer;
    const publish = () => {
      const before = JSON.stringify(state); match.state = state; match.stateID++;
      broadcastProjectedMatchState({ io, match }); expect(JSON.stringify(state)).toBe(before);
    };
    publish();
    run('REVEAL_ROOM', { roomId: 'ground-north' }); publish();
    expect(packets).toContain('state:update'); expect(packets).toContain('state:patch');
    const selected = state.core.pendingRoomPlacement!.draw.roomTemplate!.name;
    for (const view of received.values()) {
      expect(view.sys.tutorial.checkpoints).toBeUndefined();
      expect(view.core.roomDiscoveryDeck).toEqual([]);
      expect(view.core.roomDiscoveryOrderByFloor).toEqual({ ground: [], upper: [], basement: [] });
      expect(view.core.pendingRoomPlacement?.draw.roomTemplate?.name).toBe(selected);
      expect(view.core.pendingRoomPlacement?.draw.resolution.buriedRoomTiles.some(room => room.reason === 'areaMismatch')).toBe(false);
    }
    // Reconnect uses the actual sync owner, no local pending selection retained.
    new TransportStateSynchronizer(io).syncSocket({ match, playerID: '0', socket: { emit: (event, ...args) => receive('reconnected', event, args[1]) } });
    expect(createInitialPreviewState(received.get('reconnected')!.core).pendingRoomPlacementSlotId).toBe('ground-north');
    run('EXPLORE_ROOM', { roomId: 'ground-north' }); publish();
    expect(state.core.roomDiscoveryDeck.some(entry => entry.room.name === 'PRIVATE_FUTURE_7b')).toBe(true);
    expect(JSON.stringify([...received.values()])).not.toMatch(/PRIVATE_BACK_ONLY_7a|PRIVATE_FUTURE_7b/);
  });
});

import { vi } from 'vitest';
import { registerGameSocketRoutes, type GameSocketRouteConfig } from '../src/engine/transport/transportSocketRouter';
import { TUTORIAL_COMMANDS } from '../src/engine/systems/TutorialSystem';

it('正式 Socket 命令路由拒绝普通在线座位的全部教程命令', async () => {
  const match = createSyntheticMatch();
  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const emit = vi.fn();
  const handleCommand = vi.fn();
  const socket = { id: 'verified-human', on: (name: string, handler: (...args: unknown[]) => Promise<void>) => handlers.set(name, handler), emit };
  const config = {
    namespace: { on: (_event: string, connect: (socket: unknown) => void) => connect(socket) },
    hooks: {
      getSocketInfo: () => ({ matchID: match.matchID, playerID: '0', credentials: 'synthetic' }),
      getMatch: () => match,
      validateCommandAuth: async () => true,
      // Same predicate wired by GameTransportServer, using real engine systems.
      isAdminDebugCommand: (_match: unknown, command: string) => engineConfig.systems.some(system => system.adminDebugCommandTypes?.includes(command)),
      resolveOnlineAiSeatControllerType: () => 'human',
      handleCommand,
    },
  } as unknown as GameSocketRouteConfig<typeof match>;
  registerGameSocketRoutes(config);
  for (const command of Object.values(TUTORIAL_COMMANDS)) {
    await handlers.get('command')!(match.matchID, command, { manifest: { id: 'untrusted', steps: [] } }, 'synthetic');
    expect(emit).toHaveBeenLastCalledWith('error', match.matchID, 'admin_debug_channel_required');
  }
  expect(handleCommand).not.toHaveBeenCalled();
});
