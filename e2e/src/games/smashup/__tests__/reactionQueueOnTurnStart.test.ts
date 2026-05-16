import { describe, it, expect, beforeEach } from 'vitest';
import { clearOngoingEffectRegistry, registerTrigger, collectTriggers } from '../domain/ongoingEffects';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { smashUpFlowHooks } from '../domain/index';
import { getSmashUpReactionSession } from '../domain/reactionSession';
import { getReactionPrompt, makeMatchState, makeState, makeBase, makeMinion } from './helpers';
import { SU_EVENTS } from '../domain/types';

beforeEach(() => {
  clearOngoingEffectRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('reaction queue: onTurnStart ordering', () => {
  it('multiple mandatory onTurnStart triggers open ordering interaction for current player', () => {
    registerTrigger('test_turn_start_a', 'onTurnStart', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'test_turn_start_a' },
      timestamp: ctx.now,
    }] as any));
    registerTrigger('test_turn_start_b', 'onTurnStart', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'test_turn_start_b' },
      timestamp: ctx.now,
    }] as any));

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
    expect(getReactionPrompt(rq!.state)).toBeDefined();
  });

  it('onTurnEnd uses the same smashup reaction session and halts phase advance until ordering is resolved', () => {
    registerTrigger('test_turn_end_a', 'onTurnEnd', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'test_turn_end_a' },
      timestamp: ctx.now,
    }] as any));
    registerTrigger('test_turn_end_b', 'onTurnEnd', (ctx) => ([{
      type: SU_EVENTS.LIMIT_MODIFIED,
      payload: { playerId: ctx.playerId, limitType: 'action', delta: 1, reason: 'test_turn_end_b' },
      timestamp: ctx.now,
    }] as any));

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
    expect(getReactionPrompt(exitResult.updatedState)).toBeDefined();
    expect(getSmashUpReactionSession(exitResult.updatedState)?.frameKind).toBe('turn-end');
  });
});

