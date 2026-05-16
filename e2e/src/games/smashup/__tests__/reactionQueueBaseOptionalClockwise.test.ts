import { describe, it, expect, beforeEach } from 'vitest';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import {
  getPromptHandlerData,
  getPromptOption,
  getPromptOptions,
  getPromptPlayerId,
  getReactionPrompt,
  makeMatchState,
  makeState,
  makeBase,
  withoutCurrentPrompt,
} from './helpers';
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

describe('Reaction queue: optional base triggers resolve clockwise', () => {
  it('optional triggers use smashup reaction session and start with the first clockwise eligible player', () => {
    // Two optional base abilities, owned by different players.
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

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
    const current = getReactionPrompt(rq!.state);

    // Optional: current player 0 has no options, so the first eligible player clockwise is 1.
    expect(getPromptPlayerId(current)).toBe('1');
    expect(getPromptOptions(current).some((option: any) => String(option.id).includes('base_a'))).toBe(true);
    expect(getPromptOptions(current).some((option: any) => String(option.id).includes('base_b'))).toBe(false);
    expect(getPromptOptions(current).some((option: any) => option.id === 'pass')).toBe(true);
  });

  it('a player who passed may still act later in the same optional cycle', () => {
    registerBaseAbility('base_a', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });
    registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), {
      mandatory: false,
    });

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

    const current1 = getReactionPrompt(rq!.state);
    expect(getPromptPlayerId(current1)).toBe('1');

    const afterPass = handler!(
      withoutCurrentPrompt(rq!.state) as any,
      '1',
      { kind: 'pass' },
      getPromptHandlerData(current1),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      2,
    );
    expect(afterPass).toBeDefined();
    const current2 = getReactionPrompt(afterPass!.state);
    expect(getPromptPlayerId(current2)).toBe('2');
    expect(getPromptOptions(current2).some((option: any) => String(option.id).includes('base_b'))).toBe(true);

    const triggerB = getPromptOption(
      current2,
      (option: any) => String(option.id).includes('base_b'),
      'reaction option for base_b',
    );
    const afterPlayerTwoActs = handler!(
      withoutCurrentPrompt(afterPass!.state) as any,
      '2',
      triggerB.value,
      getPromptHandlerData(current2),
      { shuffle: (a: any[]) => a, random: () => 0.5, d: () => 1, range: (m: number) => m } as any,
      3,
    );
    expect(afterPlayerTwoActs).toBeDefined();

    const current3 = getReactionPrompt(afterPlayerTwoActs!.state);
    expect(getPromptPlayerId(current3)).toBe('1');
    expect(getPromptOptions(current3).filter((option: any) => String(option.id).includes('base_a')).length).toBe(2);
  });
});

