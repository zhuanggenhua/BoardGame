import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeMinion, makeState, makeBase } from './helpers';
import { buildSmashUpAiLegalActions } from '../ai';
import { scoreAiHints } from '../../../engine/ai';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { getInteractionHandler, clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { processAffectTriggers, processDeckInspectionTriggers, processMoveTriggers } from '../domain/reducer';
import '../domain/index';

// Minimal factories reused from other tests
function baseCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [makeBase('test_base_1'), makeBase('test_base_2')],
    ...overrides,
  });
}

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue ordering (Wiki-style)', () => {
  it('current player chooses order among mandatory simultaneous triggers', () => {
    // Arrange: two sources in play on base 1 (witnessed) and two triggers queued
    registerTrigger('test_source_a', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'a', tone: 'info' },
      timestamp: 1,
    }] as any);
    registerTrigger('test_source_b', 'onMinionMoved', (_ctx: any) => [{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'b', tone: 'info' },
      timestamp: 1,
    }] as any);

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('a1', 'test_source_a', '0', 3),
          makeMinion('b1', 'test_source_b', '0', 3),
        ]),
      ],
    });

    // Queue triggers via collectTriggers to ensure witness rules applied
    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers as TriggerInstance[];
    expect(triggers.length).toBe(2);

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    // Act: reaction queue should open an ordering interaction for current player (0)
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const ms1 = rq!.state;
    const current = ms1.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    // Choose trigger B first
    const optB = current.data.options.find((o: any) => (o.label as string).includes('test_source_b'));
    expect(optB).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose')!;
    const r2 = handler(ms1 as any, '0', optB.value, current.data, { shuffle: (a: any[]) => a } as any, 2);
    expect(r2).toBeDefined();
    const evts = r2!.events as SmashUpEvent[];
    expect(evts[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
    // And executor event is produced
    expect(evts.some(e => e.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
  });

  it('witness: onMinionMoved triggers only if source is on destination base at trigger time', () => {
    registerTrigger('test_source_a', 'onMinionMoved', () => []);
    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('a1', 'test_source_a', '0', 3)]),
        makeBase('test_base_2'),
      ],
    });
    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1, // destination is base 1, but source is on base 0
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeUndefined();
  });

  it('queued trigger execution re-enters post processing before reaction session continues', () => {
    registerTrigger('test_resolve_reveal', 'onMinionMoved', () => ([{
      type: SU_EVENTS.REVEAL_HAND,
      payload: {
        targetPlayerId: '1',
        viewerPlayerId: '0',
        sourcePlayerId: '0',
        cards: [{ uid: 'card-1', defId: 'test_action' }],
        reason: 'test_reveal',
      },
      timestamp: 2,
    }] as any));
    registerTrigger('test_inspection_optional', 'onDeckInspected', () => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: '0', messageKey: 'inspection', tone: 'info' },
      timestamp: 2,
    }] as any), { optional: true });

    const core = baseCore({
      bases: [
        makeBase('test_base_1'),
        makeBase('test_base_2', [
          makeMinion('r1', 'test_resolve_reveal', '0', 3),
          makeMinion('i1', 'test_inspection_optional', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionMoved', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 1,
      triggerMinionUid: 'moved1',
      triggerMinionDefId: 'any_minion',
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();

    const ms0 = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 2);
    expect(rq).toBeDefined();
    expect(rq!.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
    expect(rq!.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
  });

  it('processMoveTriggers stamps queued onMinionMoved reactions with explicit frame ids', () => {
    registerTrigger('test_move_watcher', 'onMinionMoved', () => []);

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('moved1', 'test_minion', '0', 2)]),
        makeBase('test_base_2', [makeMinion('watcher1', 'test_move_watcher', '0', 3)]),
      ],
    });

    const result = processMoveTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved1',
        minionDefId: 'test_minion',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_move',
      },
      timestamp: 7,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 7);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe('minion-moved:moved1:0:1:7');
    expect(trigger.frameId).toBe('minion-moved-frame:moved1:0:1:7');
    expect(trigger.moveFromBaseIndex).toBe(0);
    expect(trigger.moveToBaseIndex).toBe(1);
  });

  it('processAffectTriggers stamps queued onMinionAffected reactions with explicit frame ids', () => {
    registerTrigger('test_affect_watcher', 'onMinionAffected', () => []);

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('moved1', 'test_minion', '0', 2),
          makeMinion('watcher1', 'test_affect_watcher', '0', 3),
        ]),
        makeBase('test_base_2'),
      ],
    });

    const result = processAffectTriggers([{
      type: SU_EVENTS.MINION_MOVED,
      payload: {
        minionUid: 'moved1',
        minionDefId: 'test_minion',
        fromBaseIndex: 0,
        toBaseIndex: 1,
        reason: 'test_move',
      },
      timestamp: 9,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 9);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`minion-affected:${SU_EVENTS.MINION_MOVED}:moved1:move:0:0:0:9`);
    expect(trigger.frameId).toBe(`minion-affected-frame:${SU_EVENTS.MINION_MOVED}:moved1:move:0:0:0:9`);
  });

  it('processDeckInspectionTriggers stamps queued onDeckInspected reactions with explicit frame ids', () => {
    registerTrigger('test_inspect_watcher', 'onDeckInspected', () => []);

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [makeMinion('watcher1', 'test_inspect_watcher', '0', 3)]),
        makeBase('test_base_2'),
      ],
    });

    const result = processDeckInspectionTriggers([{
      type: SU_EVENTS.REVEAL_HAND,
      payload: {
        targetPlayerId: '1',
        viewerPlayerId: '0',
        sourcePlayerId: '0',
        cards: [{ uid: 'card-1', defId: 'test_action' }],
        reason: 'test_reveal',
      },
      timestamp: 11,
    } as any], makeMatchState(core), '0', { shuffle: (a: any[]) => a } as any, 11);

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe(`deck-inspected:${SU_EVENTS.REVEAL_HAND}:hand:1:0:11`);
    expect(trigger.frameId).toBe(`deck-inspected-frame:${SU_EVENTS.REVEAL_HAND}:hand:1:0:11`);
  });
});

