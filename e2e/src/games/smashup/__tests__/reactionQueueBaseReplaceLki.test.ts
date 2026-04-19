import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { makeMatchState, makeState, makeBase } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbility } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { reduce } from '../domain/reduce';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue: base replacement vs LKI', () => {
  it('queued base trigger still resolves even if base defId changes (uses lkiBase/baseIndex)', () => {
    // Arrange: base ability executor just emits feedback
    registerBaseAbility('base_old', 'afterScoring', (ctx) => ({
      events: [{
        type: SU_EVENTS.ABILITY_FEEDBACK,
        payload: { playerId: ctx.playerId, messageKey: 'old', tone: 'info' },
        timestamp: ctx.now,
      }] as any,
    }));

    const core0: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const t: TriggerInstance = {
      id: `afterScoring:base_old:1:0`,
      timing: 'afterScoring' as any,
      frameId: 'score-after:0:1',
      sourceEventId: 'score-after:0:1',
      sourceDefId: 'base_old',
      sourceBaseIndex: 0,
      ownerPlayerId: '0',
      mandatory: true,
      resolutionClass: 'mandatory',
      witnessRequirement: 'inPlayAtTriggerTime',
      witnessed: true,
      baseIndex: 0,
      rankings: [{ playerId: '0', power: 10, vp: 3 }],
      lkiBase: { baseIndex: 0, defId: 'base_old' },
    };

    // Simulate base replacement before trigger resolves (base defId changes)
    const core1 = reduce(core0, {
      type: SU_EVENTS.BASE_REPLACED,
      payload: { baseIndex: 0, oldBaseDefId: 'base_old', newBaseDefId: 'base_new' },
      timestamp: 1,
    } as any);

    const ms1 = makeMatchState({ ...core1, triggerQueue: [t] });
    // Even after the base is replaced, the queued trigger should still survive into the same reaction frame.
    const ms2 = makeMatchState({ ...core1, triggerQueue: [t, { ...t, id: `${t.id}:2` }] });
    const rq = maybeResolveReactionQueue(ms2 as any, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1)!;
    const current = rq.state.sys.interaction.current as any;
    expect(current).toBeDefined();
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.data.options.some((option: any) => String(option.label).includes('base_old'))).toBe(true);
  });
});

