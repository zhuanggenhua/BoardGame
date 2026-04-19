import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, SmashUpEvent, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeState, makeBase, makeMinion } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbility } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { collectBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { clearOngoingEffectRegistry, registerTrigger } from '../domain/ongoingEffects';
import { postProcessSystemEvents } from '../domain';

function core2b(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [makeBase('base_a'), makeBase('base_b')],
    ...overrides,
  });
}

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue: base abilities', () => {
  it('two base abilities same timing -> ordering prompt for current player', () => {
    // Arrange: register two base abilities that emit different feedback
    registerBaseAbility('base_a', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'a', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }));
    registerBaseAbility('base_b', 'onTurnStart', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'b', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }));

    const core = core2b();

    const qA = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 0, now: 1 })!;
    const qB = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '0', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(qA as any).payload.triggers,
      ...(qB as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    // Act: multiple mandatory triggers -> choose-next interaction
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const ms1 = rq!.state;
    const current = ms1.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');

    // Pick base_b first
    const optB = current.data.options.find((o: any) => (o.label as string).includes('base_b'));
    expect(optB).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose')!;
    const r2 = handler(ms1 as any, '0', optB.value, current.data, { shuffle: (a: any[]) => a } as any, 2);
    expect(r2).toBeDefined();
    const evts = r2!.events as SmashUpEvent[];
    expect(evts[0].type).toBe(SU_EVENTS.TRIGGER_CONSUMED);
    expect(evts.some(e => e.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
  });

  it('onActionPlayed base ability is queued and resolved via smashup reaction session', () => {
    registerBaseAbility('base_a', 'onActionPlayed', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'base-action', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }));

    const core = core2b();
    const matchState = makeMatchState(core);
    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 0,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a } as any, matchState);

    expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_QUEUED)).toBe(true);
    expect(result.events.some(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toBe(true);
    expect(result.events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
    expect(result.matchState?.sys.interaction?.current).toBeUndefined();
  });

  it('ACTION_PLAYED with multiple mandatory reactions opens one unified ordering interaction', () => {
    registerBaseAbility('base_a', 'onActionPlayed', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'base-action', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }));
    registerTrigger('test_action_watcher', 'onActionPlayed', (ctx) => ([{
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: { playerId: ctx.playerId, messageKey: 'minion-action', tone: 'info' },
      timestamp: ctx.now,
    }] as any));

    const core = core2b({
      bases: [
        makeBase('base_a', [makeMinion('watcher-1', 'test_action_watcher', '0', 3)]),
        makeBase('base_b'),
      ],
    });
    const matchState = makeMatchState(core);
    const result = postProcessSystemEvents(core, [{
      type: SU_EVENTS.ACTION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'action-1',
        defId: 'test_action',
        targetBaseIndex: 0,
        targetType: 'base',
      },
      timestamp: 1,
    } as any], { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, matchState);

    const current = result.matchState?.sys.interaction?.current as any;
    expect(current).toBeDefined();
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.data.options.some((option: any) => String(option.label).includes('base_a'))).toBe(true);
    expect(current.data.options.some((option: any) => String(option.label).includes('test_action_watcher'))).toBe(true);
  });
});

