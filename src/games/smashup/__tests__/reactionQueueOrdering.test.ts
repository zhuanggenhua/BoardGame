import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeMinion, makeState, makeBase } from './helpers';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { getInteractionHandler, clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { reduce } from '../domain/reduce';

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
    expect(current?.data?.sourceId).toBe('reaction_queue_choose_next');

    // Choose trigger B first
    const optB = current.data.options.find((o: any) => (o.label as string).includes('test_source_b'));
    expect(optB).toBeDefined();
    const handler = getInteractionHandler('reaction_queue_choose_next')!;
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

  it('重复入队同一 triggerId 时只保留一份', () => {
    const core = baseCore();
    const trigger = {
      id: 'afterScoring:pirate_first_mate_pod:0:1',
      timing: 'afterScoring',
      sourceDefId: 'pirate_first_mate_pod',
      sourceControllerId: '0',
      sourceBaseIndex: 0,
      mandatory: true,
      ownerPlayerId: '1',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
      baseIndex: 0,
      rankings: [
        { playerId: '0', power: 9, vp: 3 },
        { playerId: '1', power: 9, vp: 3 },
      ],
    } as TriggerInstance;

    const queuedEvent = {
      type: SU_EVENTS.TRIGGER_QUEUED,
      payload: { triggers: [trigger, trigger] },
      timestamp: 0,
    } as SmashUpEvent;

    const next = reduce(core, queuedEvent);
    expect(next.triggerQueue).toHaveLength(1);
    expect(next.triggerQueue?.[0].id).toBe(trigger.id);
  });
  it('perInstance afterScoring 会为同名来源的每个实例单独入队', () => {
    registerTrigger('test_source_a', 'afterScoring', () => [], {
      perInstance: true,
      sourceScope: 'triggerBase',
    });

    const core = baseCore({
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_source_a', '0', 3),
          makeMinion('a2', 'test_source_a', '1', 3),
        ]),
        makeBase('test_base_2', [makeMinion('a3', 'test_source_a', '0', 3)]),
      ],
    });

    const queued = collectTriggers(core, 'afterScoring', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      rankings: [{ playerId: '0', power: 6, vp: 1 }],
      random: { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      now: 1,
    });

    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers as TriggerInstance[];
    expect(triggers).toHaveLength(2);
    expect(triggers.map(t => t.sourceCardUid)).toEqual(['a1', 'a2']);
    expect(new Set(triggers.map(t => t.id)).size).toBe(2);
    expect(triggers.every(t => t.sourceBaseIndex === 0)).toBe(true);
  });
});

