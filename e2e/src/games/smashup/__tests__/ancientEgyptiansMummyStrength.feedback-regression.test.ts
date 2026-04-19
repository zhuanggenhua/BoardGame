import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { createActionLogSystem, createEventStreamSystem, createFlowSystem, createInteractionSystem, createRematchSystem, createResponseWindowSystem, createSimpleChoiceSystem, createTutorialSystem, createUndoSystem } from '../../../engine';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { EngineSystem } from '../../../engine/systems/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import type { MatchState, RandomFn } from '../../../engine/types';
import { SmashUpDomain, resolveAbility, smashUpFlowHooks } from '../domain';
import { createSmashUpEventSystem } from '../domain/systems';
import type { BaseInPlay, CardInstance, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';

const PLAYER_IDS = ['0', '1'];

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

function buildSystems(): EngineSystem<SmashUpCore>[] {
  return [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    createActionLogSystem<SmashUpCore>(),
    createUndoSystem<SmashUpCore>(),
    createInteractionSystem<SmashUpCore>(),
    createSimpleChoiceSystem<SmashUpCore>(),
    createRematchSystem<SmashUpCore>(),
    createResponseWindowSystem<SmashUpCore>({ allowedCommands: ['su:play_action'] }),
    createTutorialSystem<SmashUpCore>(),
    createEventStreamSystem<SmashUpCore>(),
    createSmashUpEventSystem(),
  ];
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
  const systems = buildSystems();
  const sys = createInitialSystemState(PLAYER_IDS, systems);
  return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function createRunner(customState: MatchState<SmashUpCore>) {
  return new GameTestRunner<SmashUpCore, any, SmashUpEvent>({
    domain: SmashUpDomain,
    systems: buildSystems(),
    playerIds: PLAYER_IDS,
    setup: () => customState,
    silent: true,
  });
}

function respond(state: MatchState<SmashUpCore>, playerId: string, optionId: string, name: string) {
  const runner = createRunner(state);
  return runner.run({
    name,
    commands: [{ type: INTERACTION_COMMANDS.RESPOND, playerId, payload: { optionId } }],
  });
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
    const executor = resolveAbility('ancient_egyptians_mummy_strength', 'onPlay');
    expect(executor).toBeDefined();

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

    const initial = executor!({
      state: core,
      matchState: makeMatchState(core),
      playerId: '0',
      cardUid: 'mummy-strength',
      defId: 'ancient_egyptians_mummy_strength',
      baseIndex: 0,
      random: dummyRandom,
      now: 11,
    });

    const targetPrompt = initial.matchState?.sys.interaction.current as any;
    expect(targetPrompt?.data?.sourceId).toBe('ancient_egyptians_mummy_strength_target');
    const targetMinions = targetPrompt?.data?.options.map((option: any) => option.value?.minionUid).filter(Boolean).sort();
    expect(targetMinions).toEqual(['empowered', 'other-base']);

    const empoweredOption = targetPrompt!.data.options.find((option: any) => option.value?.minionUid === 'empowered');
    expect(empoweredOption).toBeTruthy();

    const chooseMinion = respond(initial.matchState!, '0', empoweredOption!.id, 'mummy_strength: choose target');
    expect(chooseMinion.error).toBeUndefined();
    expect(chooseMinion.finalState.sys.interaction.current).toBeFalsy();

    const empoweredAfter = chooseMinion.finalState.core.bases[0].minions.find((minion: any) => minion.uid === 'empowered');
    expect(empoweredAfter).toBeTruthy();
    expect(empoweredAfter?.tempPowerModifier).toBe(4);
  });
});
