import { describe, expect, it } from 'vitest';
import type { Server as IOServer } from 'socket.io';
import { createInitialSystemState, executePipeline } from '../src/engine/pipeline';
import type { MatchState } from '../src/engine/types';
import { applyPatches, type Operation } from '../src/engine/transport/patch';
import { broadcastProjectedMatchState, type TransportStateProjectionMatch } from '../src/engine/transport/stateProjection';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { engineConfig, betrayalAiRuntime, type BetrayalCore } from '../src/games/betrayal/game';
import { BETRAYAL_COMMANDS } from '../src/games/betrayal/commands';
import type { BetrayalCommand } from '../src/games/betrayal/commandTypes';
import { createDustHauntCore, seedDustControlImpulsesTokens } from '../src/games/betrayal/__tests__/helpers/firstScenarioRuntimeHarness';
import { BETRAYAL_FIXED_RANDOM } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { resolveBetrayalHauntTokenInstances } from '../src/games/betrayal/hauntTokenModel';
import { resolveBetrayalExplorerTargetSelectionAction } from '../src/games/betrayal/explorerTargetSelectionReadModel';

// Synthetic fixtures only. Exercise actual command rules/reducers and network
// projection; replace only Socket.IO delivery. No production file is changed.
const viewers = ['0', '1', '2', null] as const;
const key = (id: string | null) => id ?? 'spectator';
function prepare() {
  const core = createDustHauntCore(['0', '1', '2']);
  seedDustControlImpulsesTokens(core);
  return { core, sys: createInitialSystemState(core.playerIds, engineConfig.systems, 'synthetic-token-audit') };
}
function run(state: MatchState<BetrayalCore>, type: BetrayalCommand['type'], playerId: string, payload: Record<string, unknown>) {
  const result = executePipeline(engineConfig, state, { type, playerId, payload, timestamp: 100 + state.sys.eventStream.nextId } as BetrayalCommand, BETRAYAL_FIXED_RANDOM, state.core.playerIds);
  expect(result.success, result.error).toBe(true);
  return result.state;
}
function capture(initial: MatchState<BetrayalCore>) {
  const received = new Map<string, MatchState<BetrayalCore>>();
  const packetTypes: string[] = [];
  const receive = (id: string, type: string, data: unknown) => {
    packetTypes.push(type);
    if (type === 'state:patch') {
      const result = applyPatches(received.get(id), data as Operation[]);
      expect(result.success).toBe(true);
      received.set(id, result.state as MatchState<BetrayalCore>);
    } else if (type === 'state:update' || type === 'state:sync') {
      received.set(id, data as MatchState<BetrayalCore>);
    }
  };
  const io = { of: () => ({ to: (id: string) => ({ emit: (type: string, _matchId: string, data: unknown) => receive(id, type, data) }) }) } as unknown as IOServer;
  const match: TransportStateProjectionMatch = {
    engineConfig, state: initial, matchID: 'synthetic-token-audit', stateID: 0,
    metadata: { gameName: 'betrayal', players: Object.fromEntries(['0', '1', '2'].map(id => [id, { name: `Synthetic ${id}` }])), createdAt: 0, updatedAt: 0 },
    randomSeed: 'synthetic-unused', getRandomCursor: () => 0,
    connections: new Map(['0', '1', '2'].map(id => [id, new Set([id])])),
    spectatorSockets: new Set(['spectator']), lastBroadcastedViews: new Map(), lastCommandPlayerId: '1',
  };
  return {
    packetTypes,
    send: (state: MatchState<BetrayalCore>, mode: 'sync' | 'broadcast') => {
      const authorityBefore = JSON.stringify(state);
      match.state = state; match.stateID++;
      if (mode === 'sync') {
        const synchronizer = new TransportStateSynchronizer(io);
        for (const id of viewers) synchronizer.syncSocket({ match, playerID: id, socket: { emit: (type, ...args) => receive(key(id), type, args[1]) } });
      } else broadcastProjectedMatchState({ io, match });
      expect(JSON.stringify(state)).toBe(authorityBefore);
      expect(received.size).toBe(4);
      return structuredClone(received);
    },
  };
}
const tokens = (state: MatchState<BetrayalCore>, owner: string) => state.core.scenarioRuntime.dust!.sicknessTokensByPlayerId[owner]!;
const ids = (state: MatchState<BetrayalCore>, owner: string) => tokens(state, owner).map(t => t.id);
function exchanged(mode: 'sync' | 'broadcast') {
  let state = prepare();
  const net = capture(state);
  const before = net.send(state, mode);
  state = run(state, BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE, '1', { targetPlayerId: '0' });
  net.send(state, mode);
  state = run(state, BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE, '0', { accept: true });
  const after = net.send(state, mode);
  return { state, before, after, packetTypes: net.packetTypes };
}
describe('Dust network token identity privacy: current candidate acceptance', () => {
  it.each(['sync', 'broadcast'] as const)('%s: real exchange, owner values, other/spectator masks and immutable authority', mode => {
    const { state, after, packetTypes } = exchanged(mode);
    expect(tokens(state, '1')[0].value).toBe(1);
    expect(state.core.scenarioRuntime.dust!.permanentTraitorPlayerIds).toContain('1');
    for (const viewer of viewers) {
      const view = after.get(key(viewer))!;
      for (const owner of ['0', '1', '2']) {
        expect(tokens(view, owner).map(t => t.value)).toEqual(owner === viewer ? tokens(state, owner).map(t => t.value) : [null, null, null]);
      }
    }
    expect(packetTypes).toContain(mode === 'sync' ? 'state:sync' : 'state:update');
    if (mode === 'broadcast') expect(packetTypes).toContain('state:patch');
  });
  it.each(['sync', 'broadcast'] as const)('%s RED: all viewer token IDs, including own, must not expose authoritative IDs', mode => {
    const state = prepare();
    const views = capture(state).send(state, mode);
    const authorityIds = new Set(['0', '1', '2'].flatMap(owner => ids(state, owner)));
    const leaks = [...views.values()].some(view => [...authorityIds].some(id => JSON.stringify(view).includes(id)));
    expect(leaks).toBe(false);
  });
  it.each(['sync', 'broadcast'] as const)('%s RED: previously known own token cannot be linked to another holder after exchange', mode => {
    const { before, after } = exchanged(mode);
    const rememberedOwnId = ids(before.get('0')!, '0')[0];
    const linkedByFormerOwner = ids(after.get('0')!, '1').includes(rememberedOwnId);
    const linkedBySpectator = ids(before.get('spectator')!, '0').some(id => ids(after.get('spectator')!, '1').includes(id));
    expect({ linkedByFormerOwner, linkedBySpectator }).toEqual({ linkedByFormerOwner: false, linkedBySpectator: false });
  });
  it.each(['sync', 'broadcast'] as const)('%s RED: every viewer sees stable current-holder slots, not moving token identities', mode => {
    const { before, after } = exchanged(mode);
    const holderSlotsStable = viewers.every(viewer => ['0', '1', '2'].every(owner => (
      JSON.stringify(ids(before.get(key(viewer))!, owner)) === JSON.stringify(ids(after.get(key(viewer))!, owner))
    )));
    const ownAndOthersUseSameSlotContract = viewers.every(viewer => ['0', '1', '2'].every(owner => (
      JSON.stringify(ids(after.get(key(viewer))!, owner)) === JSON.stringify(ids(after.get('spectator')!, owner))
    )));
    expect({ holderSlotsStable, ownAndOthersUseSameSlotContract }).toEqual({ holderSlotsStable: true, ownAndOthersUseSameSlotContract: true });
  });
});

// Candidate-shape experiment only: do NOT install this in production. These
// deterministic IDs denote current holder slots, never persistent tokens.
function slotAliasFixture(state: MatchState<BetrayalCore>) {
  const clone = structuredClone(state);
  for (const [owner, list] of Object.entries(clone.core.scenarioRuntime.dust!.sicknessTokensByPlayerId)) {
    list.forEach((token, index) => { token.id = `visible-slot-${owner}-${index}`; });
  }
  return clone;
}
describe('Current consumers under holder-slot aliases (compatibility experiment)', () => {
  it('AI request/accept commands are identical and never require a token ID', () => {
    let state = prepare();
    for (const phase of ['request', 'accept']) {
      const playerId = phase === 'request' ? '1' : '0';
      const view = capture(state).send(state, 'sync').get(playerId)!;
      const actions = betrayalAiRuntime.buildLegalActions({ playerId, state: view });
      const aliasedActions = betrayalAiRuntime.buildLegalActions({ playerId, state: slotAliasFixture(view) });
      expect(aliasedActions).toEqual(actions);
      const type = phase === 'request' ? BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE : BETRAYAL_COMMANDS.RESOLVE_SICKNESS_EXCHANGE;
      const exchange = actions.flatMap(action => action.commands).find(command => command.type === type);
      expect(exchange).toBeDefined();
      expect(exchange!.payload).toEqual(phase === 'request' ? { targetPlayerId: '0' } : { accept: true });
      if (phase === 'request') state = run(state, BETRAYAL_COMMANDS.REQUEST_SICKNESS_EXCHANGE, '1', { targetPlayerId: '0' });
    }
  });
  it('UI token presentation retains values/count/visibility and unique keys under slot aliases', () => {
    const state = prepare();
    for (const view of capture(state).send(state, 'sync').values()) {
      const normal = resolveBetrayalHauntTokenInstances(view.core).filter(t => t.kind === 'sickness');
      const aliased = resolveBetrayalHauntTokenInstances(slotAliasFixture(view).core).filter(t => t.kind === 'sickness');
      expect(aliased).toHaveLength(9);
      expect(new Set(aliased.map(t => t.id)).size).toBe(9);
      const omitId = ({ id: _id, ...rest }: typeof normal[number]) => rest;
      expect(aliased.map(omitId)).toEqual(normal.map(omitId));
    }
  });
  it('UI target-selection command carries only target player, not sickness token ID', () => {
    const core = prepare().core;
    const explorer = [core.currentExplorer, ...core.otherExplorers].find(e => e.playerId === '0')!;
    const empty = new Set<string>();
    expect(resolveBetrayalExplorerTargetSelectionAction({
      explorer, traitorPlayerId: null, isMonsterAttackMode: false, selectedMonsterAttackEntry: null,
      selectedMonsterAttackTargetPlayerIds: empty, activeHauntTargetGuide: null, hauntActionKind: null,
      magicCameraPhotoTargetPlayerIds: empty, helpingHandsTrollHandAttackTargetPlayerIds: empty,
      isHeroAttackTargetingMode: false, heroAttackTargetPlayerIds: empty, isDustSicknessExchangeMode: true,
      dustTargetPlayerIds: new Set(['0']), isDustAttackTargetingMode: false,
      isTradeOrLootTargetSelectionActive: false, activeTradeTargets: [], corpseLootTargets: [],
      selectedInventoryUseEffectMode: null, healTargetExplorers: [], maskTargetTokens: [],
    })).toEqual({ kind: 'requestSicknessExchange', payload: { targetPlayerId: '0' } });
  });
});
