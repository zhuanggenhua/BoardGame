import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { makeMatchState, makeState, makeBase } from './helpers';
import { clearBaseAbilityRegistry, registerExtended } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { collectExtendedBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

describe('Reaction queue: extended base timing onBaseRevealed', () => {
  it('optional onBaseRevealed triggers choose next by clockwise owner', () => {
    registerExtended('base_old', 'onBaseRevealed', () => ({ events: [] }), { mandatory: false });

    const core: SmashUpCore = makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      bases: [makeBase('base_old')],
    });

    const q = collectExtendedBaseAbilityTriggers({ core, timing: 'onBaseRevealed', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    // Force interaction path: multiple pending triggers -> choose-next prompt.
    const triggers: TriggerInstance[] = [
      ...(q as any).payload.triggers,
      { ...(q as any).payload.triggers[0], id: `${(q as any).payload.triggers[0].id}:2` },
    ];
    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0 as any, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1)!;
    const current = rq.state.sys.interaction.current as any;
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.playerId).toBe('1');
  });
});

