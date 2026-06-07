import { describe, it, expect, beforeEach } from 'vitest';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { getReactionPrompt, getSimpleChoicePrompt, makeMatchState, makePlayer, respondToPromptOption } from './helpers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearRegistry, registerAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, registerBaseAbility } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { fireMinionPlayedTriggers } from '../domain/abilityHelpers';
import { postProcessSystemEvents } from '../domain';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';

beforeEach(() => {
  clearRegistry();
  clearBaseAbilityRegistry();
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

function core2p(): SmashUpCore {
  return {
    players: {
      '0': makePlayer('0'),
      '1': makePlayer('1'),
    },
    bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    baseDeck: [],
    nextUid: 1,
    turnNumber: 1,
    baseDiscard: [],
  } as any;
}

describe('reaction queue: onMinionPlayed ordering', () => {
  it('multiple mandatory onMinionPlayed triggers create ordering interaction for current player', () => {
    registerTrigger('test_on_play_a', 'onMinionPlayed', (ctx) => ([
      {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId: ctx.playerId, limitType: 'minion', delta: 1, reason: 'test_on_play_a' },
        timestamp: ctx.now,
      } as any,
    ]));
    registerTrigger('test_on_play_b', 'onMinionPlayed', (ctx) => ([
      {
        type: SU_EVENTS.LIMIT_MODIFIED,
        payload: { playerId: ctx.playerId, limitType: 'minion', delta: 1, reason: 'test_on_play_b' },
        timestamp: ctx.now,
      } as any,
    ]));

    const core = core2p();
    // make trigger sources active (in-play minions) and include played minion
    core.bases[0].minions.push({ uid: 's1', defId: 'test_on_play_a', owner: '0', controller: '0', basePower: 1, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] } as any);
    core.bases[0].minions.push({ uid: 's2', defId: 'test_on_play_b', owner: '0', controller: '0', basePower: 1, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] } as any);
    core.bases[0].minions.push({ uid: 'm1', defId: 'test_minion', owner: '0', controller: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] } as any);

    const queued = collectTriggers(core, 'onMinionPlayed', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'm1',
      triggerMinionDefId: 'test_minion',
      triggerMinion: core.bases[0].minions.find(m => m.uid === 'm1') as any,
      random: { shuffle: (a: any[]) => a } as any,
      now: 10,
    });
    expect(queued).toBeDefined();

    const triggers = (queued as any).payload.triggers;
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 10);
    expect(rq).toBeDefined();
    expect(getReactionPrompt(rq!.state)).toBeDefined();
  });

  it('fireMinionPlayedTriggers stamps queued reactions with a stable sourceEventId and frameId', () => {
    registerTrigger('test_on_play_frame', 'onMinionPlayed', () => [], {});

    const core = core2p();
    core.bases[0].minions.push({ uid: 's1', defId: 'test_on_play_frame', owner: '0', controller: '0', basePower: 1, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] } as any);
    core.bases[0].minions.push({ uid: 'm1', defId: 'test_minion', owner: '0', controller: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] } as any);

    const result = fireMinionPlayedTriggers({
      core,
      matchState: makeMatchState(core),
      playerId: '0',
      cardUid: 'm1',
      defId: 'test_minion',
      baseIndex: 0,
      power: 2,
      random: { shuffle: (a: any[]) => a } as any,
      now: 10,
      playedEvt: {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
          playerId: '0',
          cardUid: 'm1',
          defId: 'test_minion',
          baseIndex: 0,
          power: 2,
        },
        timestamp: 10,
      } as any,
    });

    const queued = result.events.find((event: any) => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
    expect(queued).toBeDefined();
    const trigger = queued.payload.triggers[0];
    expect(trigger.sourceEventId).toBe('minion-played:m1:0:10');
    expect(trigger.frameId).toBe('minion-played-frame:m1:0:10');
  });

  it('随从本体交互完成后，同一次进场触发的基地能力仍会继续结算', () => {
    registerAbility('alien_scout', 'onPlay', (ctx) => {
      const interaction = createSimpleChoice(
        'test_minion_onplay_prompt',
        ctx.playerId,
        '随从本体',
        [
          {
            id: 'resolve',
            label: '结算',
            value: { resolve: true },
            displayMode: 'button' as const,
          },
        ],
        { sourceId: 'test_minion_onplay_prompt', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });
    registerInteractionHandler('test_minion_onplay_prompt', (state, playerId, _value, _data, _random, timestamp) => ({
      state,
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId, messageKey: 'onplay_done', tone: 'info' },
        timestamp,
      } as any],
    }));
    registerBaseAbility('base_castle_blood', 'onMinionPlayed', (ctx) => {
      const interaction = createSimpleChoice(
        'test_base_on_minion_played_prompt',
        ctx.playerId,
        '基地能力',
        [
          {
            id: 'base-resolve',
            label: '结算基地能力',
            value: { resolve: true },
            displayMode: 'button' as const,
          },
        ],
        { sourceId: 'test_base_on_minion_played_prompt', targetType: 'button' },
      );
      return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }, {});

    const core = core2p();
    core.bases[0] = { ...core.bases[0], defId: 'base_castle_blood' };
    const matchState = makeMatchState(core);
    const processed = postProcessSystemEvents(core, [{
      type: SU_EVENTS.MINION_PLAYED,
      payload: {
        playerId: '0',
        cardUid: 'm1',
        defId: 'alien_scout',
        baseIndex: 0,
        power: 2,
      },
      timestamp: 10,
    } as any], { shuffle: (a: any[]) => a } as any, matchState);

    expect(getSimpleChoicePrompt(processed.matchState!, 'test_minion_onplay_prompt')).toBeDefined();
    expect(processed.matchState!.core.triggerQueue ?? []).toHaveLength(1);

    const resolved = respondToPromptOption(
      processed.matchState!,
      (option: any) => option.id === 'resolve',
      'resolve onPlay option',
      '0',
      { shuffle: (a: any[]) => a } as any,
    );

    expect(resolved.success).toBe(true);
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ABILITY_FEEDBACK,
      payload: expect.objectContaining({ messageKey: 'onplay_done' }),
    }));
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.TRIGGER_CONSUMED,
    }));
    expect(getSimpleChoicePrompt(resolved.finalState, 'test_base_on_minion_played_prompt')).toBeDefined();
    expect(resolved.finalState.core.triggerQueue ?? []).toHaveLength(0);
  });
});

