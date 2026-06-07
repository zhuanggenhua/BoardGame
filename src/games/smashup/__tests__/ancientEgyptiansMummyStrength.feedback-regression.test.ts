import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import type { BaseInPlay, CardInstance, MinionOnBase, SmashUpCore } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { expectNoPrompt, getFirstPrompt, getPromptOptions, getPromptSourceId, makeMatchState, respondToPromptOption } from './helpers';
import { runCommand } from './testRunner';

const dummyRandom: RandomFn = {
  random: () => 0.5,
  shuffle: <T>(arr: T[]) => [...arr],
  d: () => 1,
  range: (min: number) => min,
};

function makeMinion(uid: string, defId: string, controller: string, power: number, overrides: Partial<MinionOnBase> = {}): MinionOnBase {
  return {
    uid,
    defId,
    controller,
    owner: controller,
    basePower: power,
    powerCounters: 0,
    powerModifier: 0,
    tempPowerModifier: 0,
    talentUsed: false,
    attachedActions: [],
    ...overrides,
  };
}

function makeCard(uid: string, defId: string, owner: string, type: 'minion' | 'action' = 'action'): CardInstance {
  return { uid, defId, owner, type };
}

function makeBase(defId: string, minions: MinionOnBase[] = [], overrides: Partial<BaseInPlay> = {}): BaseInPlay {
  return { defId, minions, ongoingActions: [], ...overrides };
}

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    vp: 0,
    hand: [] as CardInstance[],
    deck: [] as CardInstance[],
    discard: [] as CardInstance[],
    minionsPlayed: 0,
    minionLimit: 1,
    actionsPlayed: 0,
    actionLimit: 1,
    factions: ['ancient_egyptians', 'ghosts'] as [string, string],
    ...overrides,
  };
}

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
  return {
    players: { '0': makePlayer('0'), '1': makePlayer('1') },
    turnOrder: ['0', '1'],
    currentPlayerIndex: 0,
    bases: [makeBase('base_pyramids'), makeBase('test_base_2'), makeBase('test_base_3')],
    baseDeck: [],
    turnNumber: 1,
    nextUid: 100,
    ...overrides,
  };
}

beforeAll(() => {
  clearRegistry();
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  clearPowerModifierRegistry();
  clearOngoingEffectRegistry();
  resetAbilityInit();
  initAllAbilities();
});

describe('feedback regression: ancient_egyptians_mummy_strength', () => {
  it('walks the real RESPOND chain with target-first selection without throwing a command exception', () => {
    const empowered = makeMinion('empowered', 'ancient_egyptians_priest_of_anubis', '0', 2);
    const allyNoBuriedBase = makeMinion('other-base', 'ghost_apparition', '0', 3);
    const enemy = makeMinion('enemy', 'ghost_spectre', '1', 3);
    const core = makeState({
      players: {
        '0': makePlayer('0', {
          hand: [makeCard('mummy-strength', 'ancient_egyptians_mummy_strength', '0', 'action')],
        }),
        '1': makePlayer('1'),
      },
      bases: [
        makeBase('base_pyramids', [empowered, enemy], {
          buriedCards: [{ uid: 'buried-1', defId: 'ancient_egyptians_lost_knowledge', ownerId: '0', controllerId: '0', buriedFrom: 'discard' } as any],
        }),
        makeBase('test_base_2', [allyNoBuriedBase]),
        makeBase('test_base_3'),
      ],
    });

    const initial = runCommand(
      makeMatchState(core),
      {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: '0',
        payload: { cardUid: 'mummy-strength' },
      } as any,
      dummyRandom,
    );
    expect(initial.success, initial.error).toBe(true);

    const targetPrompt = getFirstPrompt(initial.finalState);
    expect(getPromptSourceId(targetPrompt)).toBe('ancient_egyptians_mummy_strength_target');
    const targetMinions = getPromptOptions(targetPrompt).map((option: any) => option.value?.minionUid).filter(Boolean).sort();
    expect(targetMinions).toEqual(['empowered', 'other-base']);

    const chooseMinion = respondToPromptOption(
      initial.finalState,
      option => option.value?.minionUid === 'empowered',
      'mummy strength target option',
      '0',
      dummyRandom,
    );
    expect(chooseMinion.success, chooseMinion.error).toBe(true);
    expectNoPrompt(chooseMinion.finalState);

    const empoweredAfter = chooseMinion.finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'empowered');
    expect(empoweredAfter).toBeTruthy();
    expect(empoweredAfter?.tempPowerModifier).toBe(4);
  });
});
