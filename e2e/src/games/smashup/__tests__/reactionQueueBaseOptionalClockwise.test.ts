import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { makeMatchState, makeState, makeBase } from './helpers';
import { clearBaseAbilityRegistry, registerBaseAbility } from '../domain/baseAbilities';
import { registerReactionQueueInteractionHandlers } from '../domain/reactionQueueHandlers';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { collectBaseAbilityTriggers } from '../domain/baseAbilityQueue';

function core3p(overrides?: Partial<SmashUpCore>): SmashUpCore {
  return makeState({
    turnOrder: ['0', '1', '2'],
    currentPlayerIndex: 0,
    bases: [makeBase('base_a'), makeBase('base_b')],
    ...overrides,
  });
}

beforeEach(() => {
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  registerReactionQueueInteractionHandlers();
});

function withResolvedInteraction(ms: any) {
  return {
    ...ms,
    sys: {
      ...ms.sys,
      interaction: {
        current: undefined,
        queue: [],
      },
    },
  };
}

describe('Reaction queue: optional base triggers resolve clockwise', () => {
  it('optional triggers use smashup reaction session and start with the first clockwise eligible player', () => {
    // Two optional base abilities, owned by different players.
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), { mandatory: false });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), { mandatory: false });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const triggers: TriggerInstance[] = [
      ...(q1 as any).payload.triggers,
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const current = (rq!.state.sys.interaction.current as any);

    // Optional: current player 0 has no options, so the first eligible player clockwise is 1.
    expect(current.playerId).toBe('1');
    expect(current.data.sourceId).toBe('smashup_reaction_choose');
    expect(current.data.options.some((option: any) => String(option.id).includes('base_a'))).toBe(true);
    expect(current.data.options.some((option: any) => String(option.id).includes('base_b'))).toBe(false);
    expect(current.data.options.some((option: any) => option.id === 'pass')).toBe(true);
  });

  it('a player who passed may still act later in the same optional cycle', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), { mandatory: false });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), { mandatory: false });

    const core = core3p();
    const q1 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '1', baseIndex: 0, now: 1 })!;
    const q2 = collectBaseAbilityTriggers({ core, timing: 'onTurnStart', ownerPlayerId: '2', baseIndex: 1, now: 1 })!;
    const playerOneTrigger = (q1 as any).payload.triggers[0];
    const triggers: TriggerInstance[] = [
      playerOneTrigger,
      { ...playerOneTrigger, id: `${playerOneTrigger.id}:again` },
      ...(q2 as any).payload.triggers,
    ];

    const ms0 = makeMatchState({ ...core, triggerQueue: triggers });
    const rq = maybeResolveReactionQueue(ms0, { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any, 1);
    expect(rq).toBeDefined();
    const handler = getInteractionHandler('smashup_reaction_choose');
    expect(handler).toBeTruthy();

    const current1 = rq!.state.sys.interaction.current as any;
    expect(current1.playerId).toBe('1');

    const afterPass = handler!(
      withResolvedInteraction(rq!.state) as any,
      '1',
      { kind: 'pass' },
      current1.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );
    expect(afterPass).toBeDefined();
    const current2 = afterPass!.state.sys.interaction.current as any;
    expect(current2.playerId).toBe('2');
    expect(current2.data.options.some((option: any) => String(option.id).includes('base_b'))).toBe(true);

    const triggerB = current2.data.options.find((option: any) => String(option.id).includes('base_b'));
    expect(triggerB).toBeDefined();
    const afterPlayerTwoActs = handler!(
      withResolvedInteraction(afterPass!.state) as any,
      '2',
      triggerB.value,
      current2.data,
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      3,
    );
    expect(afterPlayerTwoActs).toBeDefined();

    const current3 = afterPlayerTwoActs!.state.sys.interaction.current as any;
    expect(current3.playerId).toBe('1');
    expect(current3.data.sourceId).toBe('smashup_reaction_choose');
    expect(current3.data.options.filter((option: any) => String(option.id).includes('base_a')).length).toBe(2);
  });
});

