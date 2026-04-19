import { describe, it, expect, beforeEach } from 'vitest';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { makeMatchState, makeState, makeBase, makeMinion } from './helpers';

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('reaction queue: onMinionDiscardedFromBase ordering', () => {
  it('multiple mandatory discarded-from-base triggers open ordering interaction', () => {
    registerTrigger('test_discard_a', 'onMinionDiscardedFromBase', () => []);
    registerTrigger('test_discard_b', 'onMinionDiscardedFromBase', () => []);

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_discard_a', '0', 3),
          makeMinion('b1', 'test_discard_b', '0', 3),
          makeMinion('m1', 'any_minion', '0', 2),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      baseIndex: 0,
      triggerMinionUid: 'm1',
      triggerMinionDefId: 'any_minion',
      triggerMinion: core.bases[0].minions.find(m => m.uid === 'm1') as any,
      random: { shuffle: (a: any[]) => a } as any,
      now: 1,
    });
    expect(queued).toBeDefined();
    const triggers = (queued as any).payload.triggers;
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });

    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a } as any, 1);
    expect(rq).toBeDefined();
    const current = rq!.state.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
  });
});

