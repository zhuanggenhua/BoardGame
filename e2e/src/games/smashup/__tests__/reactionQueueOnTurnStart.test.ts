import { describe, it, expect, beforeEach } from 'vitest';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { smashUpFlowHooks } from '../domain/index';
import { makeMatchState, makeState, makeBase, makeMinion } from './helpers';

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('reaction queue: onTurnStart ordering', () => {
  it('multiple mandatory onTurnStart triggers open ordering interaction for current player', () => {
    registerTrigger('test_turn_start_a', 'onTurnStart', () => []);
    registerTrigger('test_turn_start_b', 'onTurnStart', () => []);

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_turn_start_a', '0', 3),
          makeMinion('b1', 'test_turn_start_b', '0', 3),
        ]),
      ],
    });

    const queued = collectTriggers(core, 'onTurnStart', {
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
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

  it('onTurnEnd uses the same smashup reaction session and halts phase advance until ordering is resolved', () => {
    registerTrigger('test_turn_end_a', 'onTurnEnd', () => []);
    registerTrigger('test_turn_end_b', 'onTurnEnd', () => []);

    const core = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      turnNumber: 3,
      bases: [
        makeBase('test_base_1', [
          makeMinion('a1', 'test_turn_end_a', '0', 3),
          makeMinion('b1', 'test_turn_end_b', '0', 3),
        ]),
      ],
    });

    const state = makeMatchState(core);
    state.sys.phase = 'endTurn';

    const result = smashUpFlowHooks.onPhaseExit?.({
      state,
      from: 'endTurn',
      to: 'startTurn',
      command: { type: 'ADVANCE_PHASE', playerId: '0', timestamp: 1 } as any,
      random: { shuffle: (a: any[]) => a } as any,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(false);
    const exitResult = result as any;
    expect(exitResult.halt).toBe(true);
    const current = exitResult.updatedState?.sys.interaction.current as any;
    expect(current?.data?.sourceId).toBe('smashup_reaction_choose');
    expect(exitResult.updatedState?.sys.smashupReactionSession?.frameKind).toBe('turn-end');
  });
});

