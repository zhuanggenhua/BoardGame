import { beforeAll, describe, expect, it } from 'vitest';
import { postProcessSystemEvents, SmashUpDomain } from '../domain';
import { initAllAbilities } from '../abilities';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../domain/abilityRuntime';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { SU_EVENTS } from '../domain/types';
import { findInteractionOption, getInteractionsFromMS, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import { defaultTestRandom } from './testRunner';

beforeAll(() => {
  initAllAbilities();
});

function resumeContinuationAfterCommittedEvents(
  stateBeforeEvents: any,
  result: { state?: any; events?: any[] } | undefined,
) {
  const events = result?.events ?? [];
  const continuation = events.find(event => isAbilityRuntimeContinuationEvent(event as any));
  expect(continuation).toBeDefined();

  const committedEvents = events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
  const committedCore = committedEvents.reduce(
    (core, event) => SmashUpDomain.reduce(core, event),
    stateBeforeEvents.core,
  );

  return resumeAbilityRuntimeContinuationEvent(
    {
      ...(result?.state ?? stateBeforeEvents),
      core: committedCore,
    },
    continuation as any,
    defaultTestRandom as any,
  );
}

describe('Reaction queue: external discard ACTION_PLAYED routes', () => {
  it('Cream Puff Man 从弃牌堆额外打出需要基地目标的标准行动时，应保留目标上下文', () => {
    const state = makeMatchState(makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makePlayer('0', {
          hand: [makeCard('cream-cost', 'ghost_ghost', 'minion', '0')],
          discard: [makeCard('bananas-discard', 'cyborg_apes_going_bananas', 'action', '0')],
        }),
        '1': makePlayer('1'),
      },
      bases: [
        { defId: 'base_portal_room', minions: [], ongoingActions: [] },
        {
          defId: 'base_monkey_lab',
          minions: [],
          ongoingActions: [{
            uid: 'enemy-ongoing',
            defId: 'time_travelers_stasis_field',
            ownerId: '1',
          } as any],
        },
      ],
      titans: [{
        uid: 'cream-titan',
        defId: 'ghosts_creampuff_man',
        ownerId: '0',
        controllerId: '0',
        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        powerCounters: 0,
        talentUsed: false,
      } as any],
    }));

    const discardHandler = getInteractionHandler('titan_ghosts_creampuff_man_discard');
    expect(discardHandler).toBeDefined();
    const discardResolved = discardHandler!(
      state,
      '0',
      { cardUid: 'cream-cost' },
      { sourceId: 'titan_ghosts_creampuff_man_discard' },
      defaultTestRandom as any,
      10,
    );

    const coreAfterDiscard = (discardResolved?.events ?? []).reduce(
      (core, event) => SmashUpDomain.reduce(core, event),
      state.core,
    );
    const playPrompt = getInteractionsFromMS(discardResolved!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_play',
    ) as any;
    expect(playPrompt).toBeDefined();
    expect(findInteractionOption(playPrompt, option => option?.value?.cardUid === 'bananas-discard')).toBeDefined();

    const stateAfterDiscard = {
      ...discardResolved!.state,
      core: coreAfterDiscard,
      sys: {
        ...discardResolved!.state.sys,
        interaction: {
          ...discardResolved!.state.sys.interaction,
          current: playPrompt,
          queue: [],
        },
      },
    };
    const playHandler = getInteractionHandler('titan_ghosts_creampuff_man_play');
    expect(playHandler).toBeDefined();
    const targetQueued = playHandler!(
      stateAfterDiscard,
      '0',
      { cardUid: 'bananas-discard', defId: 'cyborg_apes_going_bananas' },
      playPrompt.data,
      defaultTestRandom as any,
      11,
    );

    const targetPrompt = getInteractionsFromMS(targetQueued!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_action_target',
    ) as any;
    expect(targetPrompt).toBeDefined();
    const targetBase = findInteractionOption(targetPrompt, option => option?.value?.targetBaseIndex === 1);
    expect(targetBase).toBeDefined();

    const stateWithTargetPrompt = {
      ...targetQueued!.state,
      sys: {
        ...targetQueued!.state.sys,
        interaction: {
          ...targetQueued!.state.sys.interaction,
          current: targetPrompt,
          queue: [],
        },
      },
    };
    const targetHandler = getInteractionHandler('titan_ghosts_creampuff_man_action_target');
    expect(targetHandler).toBeDefined();
    const resolved = targetHandler!(
      stateWithTargetPrompt,
      '0',
      targetBase!.value,
      targetPrompt.data,
      defaultTestRandom as any,
      12,
    );

    const actionPlayed = resolved?.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
    expect(actionPlayed?.payload).toMatchObject({
      playerId: '0',
      cardUid: 'bananas-discard',
      defId: 'cyborg_apes_going_bananas',
      isExtraAction: true,
      targetBaseIndex: 1,
      targetType: 'base',
    });
    const resumed = resumeContinuationAfterCommittedEvents(stateWithTargetPrompt, resolved);
    expect(resumed?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ONGOING_DETACHED,
      payload: expect.objectContaining({
        cardUid: 'enemy-ongoing',
        reason: 'cyborg_apes_going_bananas',
      }),
    }));
    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
      payload: expect.objectContaining({
        cardUid: 'bananas-discard',
        reason: 'ghosts_creampuff_man_talent',
      }),
    }));
  });

  it('Cream Puff Man 从弃牌堆额外打出需要随从目标的标准行动时，应保留目标上下文并触发 base_enchanted_glade', () => {
    const state = makeMatchState(makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makePlayer('0', {
          hand: [makeCard('cream-cost', 'ghost_ghost', 'minion', '0')],
          deck: [makeCard('draw-a', 'robot_microbot_alpha', 'minion', '0')],
          discard: [makeCard('beam-discard', 'alien_beam_up', 'action', '0')],
        }),
        '1': makePlayer('1'),
      },
      bases: [
        {
          defId: 'base_enchanted_glade',
          minions: [
            {
              ...makeCard('enemy-target', 'robot_microbot_beta', 'minion', '1'),
              controller: '1',
              owner: '1',
              basePower: 3,
              powerCounters: 0,
              powerModifier: 0,
              tempPowerModifier: 0,
              talentUsed: false,
              playedThisTurn: false,
              attachedActions: [],
            } as any,
          ],
          ongoingActions: [],
        },
      ],
      titans: [{
        uid: 'cream-titan',
        defId: 'ghosts_creampuff_man',
        ownerId: '0',
        controllerId: '0',
        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        powerCounters: 0,
        talentUsed: false,
      } as any],
    }));

    const discardHandler = getInteractionHandler('titan_ghosts_creampuff_man_discard');
    expect(discardHandler).toBeDefined();
    const discardResolved = discardHandler!(
      state,
      '0',
      { cardUid: 'cream-cost' },
      { sourceId: 'titan_ghosts_creampuff_man_discard' },
      defaultTestRandom as any,
      20,
    );

    const coreAfterDiscard = (discardResolved?.events ?? []).reduce(
      (core, event) => SmashUpDomain.reduce(core, event),
      state.core,
    );
    const playPrompt = getInteractionsFromMS(discardResolved!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_play',
    ) as any;
    expect(playPrompt).toBeDefined();
    expect(findInteractionOption(playPrompt, option => option?.value?.cardUid === 'beam-discard')).toBeDefined();

    const stateAfterDiscard = {
      ...discardResolved!.state,
      core: coreAfterDiscard,
      sys: {
        ...discardResolved!.state.sys,
        interaction: {
          ...discardResolved!.state.sys.interaction,
          current: playPrompt,
          queue: [],
        },
      },
    };
    const playHandler = getInteractionHandler('titan_ghosts_creampuff_man_play');
    expect(playHandler).toBeDefined();
    const targetQueued = playHandler!(
      stateAfterDiscard,
      '0',
      { cardUid: 'beam-discard', defId: 'alien_beam_up' },
      playPrompt.data,
      defaultTestRandom as any,
      21,
    );

    const targetPrompt = getInteractionsFromMS(targetQueued!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_action_target',
    ) as any;
    expect(targetPrompt).toBeDefined();
    const targetMinion = findInteractionOption(targetPrompt, option =>
      option?.value?.targetBaseIndex === 0 && option?.value?.targetMinionUid === 'enemy-target',
    );
    expect(targetMinion).toBeDefined();

    const stateWithTargetPrompt = {
      ...targetQueued!.state,
      sys: {
        ...targetQueued!.state.sys,
        interaction: {
          ...targetQueued!.state.sys.interaction,
          current: targetPrompt,
          queue: [],
        },
      },
    };
    const targetHandler = getInteractionHandler('titan_ghosts_creampuff_man_action_target');
    expect(targetHandler).toBeDefined();
    const resolved = targetHandler!(
      stateWithTargetPrompt,
      '0',
      targetMinion!.value,
      targetPrompt.data,
      defaultTestRandom as any,
      22,
    );

    const actionPlayed = resolved?.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
    expect(actionPlayed?.payload).toMatchObject({
      playerId: '0',
      cardUid: 'beam-discard',
      defId: 'alien_beam_up',
      isExtraAction: true,
      targetBaseIndex: 0,
      targetType: 'minion',
      targetMinionUid: 'enemy-target',
    });
    const resumed = resumeContinuationAfterCommittedEvents(stateWithTargetPrompt, resolved);
    expect(resumed?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.MINION_RETURNED,
      payload: expect.objectContaining({
        minionUid: 'enemy-target',
        fromBaseIndex: 0,
        toPlayerId: '1',
        reason: 'alien_beam_up',
      }),
    }));
    const postProcessed = postProcessSystemEvents(
      stateWithTargetPrompt.core,
      [...(resolved?.events ?? []), ...(resumed?.events ?? [])],
      defaultTestRandom as any,
      {
        ...(resolved?.state ?? stateWithTargetPrompt),
        sys: {
          ...(resolved?.state?.sys ?? stateWithTargetPrompt.sys),
          interaction: {
            ...((resolved?.state?.sys.interaction ?? stateWithTargetPrompt.sys.interaction) as any),
            current: undefined,
            queue: [],
          },
        },
      },
    );
    expect(postProcessed.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARDS_DRAWN,
      payload: expect.objectContaining({
        playerId: '0',
        cardUids: ['draw-a'],
      }),
    }));
    expect(resolved?.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
      payload: expect.objectContaining({
        cardUid: 'beam-discard',
        reason: 'ghosts_creampuff_man_talent',
      }),
    }));
  });

  it('Cream Puff Man 从弃牌堆额外打出被他人拥有的标准行动后，仍应沉回其拥有者牌库底', () => {
    const state = makeMatchState(makeState({
      turnOrder: ['0', '1'],
      currentPlayerIndex: 0,
      players: {
        '0': makePlayer('0', {
          hand: [makeCard('cream-cost', 'ghost_ghost', 'minion', '0')],
          discard: [makeCard('borrowed-bananas', 'cyborg_apes_going_bananas', 'action', '1')],
        }),
        '1': makePlayer('1', {
          deck: [makeCard('owner-deck-a', 'robot_microbot_alpha', 'minion', '1')],
        }),
      },
      bases: [
        { defId: 'base_portal_room', minions: [], ongoingActions: [] },
        {
          defId: 'base_monkey_lab',
          minions: [],
          ongoingActions: [{
            uid: 'enemy-ongoing',
            defId: 'time_travelers_stasis_field',
            ownerId: '1',
          } as any],
        },
      ],
      titans: [{
        uid: 'cream-titan',
        defId: 'ghosts_creampuff_man',
        ownerId: '0',
        controllerId: '0',
        location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
        powerCounters: 0,
        talentUsed: false,
      } as any],
    }));

    const discardHandler = getInteractionHandler('titan_ghosts_creampuff_man_discard');
    expect(discardHandler).toBeDefined();
    const discardResolved = discardHandler!(
      state,
      '0',
      { cardUid: 'cream-cost' },
      { sourceId: 'titan_ghosts_creampuff_man_discard' },
      defaultTestRandom as any,
      30,
    );

    const coreAfterDiscard = (discardResolved?.events ?? []).reduce(
      (core, event) => SmashUpDomain.reduce(core, event),
      state.core,
    );
    const playPrompt = getInteractionsFromMS(discardResolved!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_play',
    ) as any;
    expect(playPrompt).toBeDefined();
    expect(findInteractionOption(playPrompt, option => option?.value?.cardUid === 'borrowed-bananas')).toBeDefined();

    const stateAfterDiscard = {
      ...discardResolved!.state,
      core: coreAfterDiscard,
      sys: {
        ...discardResolved!.state.sys,
        interaction: {
          ...discardResolved!.state.sys.interaction,
          current: playPrompt,
          queue: [],
        },
      },
    };
    const playHandler = getInteractionHandler('titan_ghosts_creampuff_man_play');
    expect(playHandler).toBeDefined();
    const targetQueued = playHandler!(
      stateAfterDiscard,
      '0',
      { cardUid: 'borrowed-bananas', defId: 'cyborg_apes_going_bananas' },
      playPrompt.data,
      defaultTestRandom as any,
      31,
    );

    const targetPrompt = getInteractionsFromMS(targetQueued!.state).find(
      prompt => prompt?.data?.sourceId === 'titan_ghosts_creampuff_man_action_target',
    ) as any;
    expect(targetPrompt).toBeDefined();
    const targetBase = findInteractionOption(targetPrompt, option => option?.value?.targetBaseIndex === 1);
    expect(targetBase).toBeDefined();

    const stateWithTargetPrompt = {
      ...targetQueued!.state,
      sys: {
        ...targetQueued!.state.sys,
        interaction: {
          ...targetQueued!.state.sys.interaction,
          current: targetPrompt,
          queue: [],
        },
      },
    };
    const targetHandler = getInteractionHandler('titan_ghosts_creampuff_man_action_target');
    expect(targetHandler).toBeDefined();
    const resolved = targetHandler!(
      stateWithTargetPrompt,
      '0',
      targetBase!.value,
      targetPrompt.data,
      defaultTestRandom as any,
      32,
    );

    const actionPlayed = resolved.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
    expect(actionPlayed?.payload?.ownerId).toBe('1');
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
      payload: expect.objectContaining({
        cardUid: 'borrowed-bananas',
        defId: 'cyborg_apes_going_bananas',
        ownerId: '1',
        sourcePlayerId: '0',
        reason: 'ghosts_creampuff_man_talent',
      }),
    }));

    const finalCore = resolved.events.reduce(
      (core, event) => SmashUpDomain.reduce(core, event),
      stateWithTargetPrompt.core,
    );
    expect(finalCore.players['1'].deck.map(card => card.uid)).toEqual(['owner-deck-a', 'borrowed-bananas']);
    expect(finalCore.players['0'].deck.map(card => card.uid)).not.toContain('borrowed-bananas');
    expect(finalCore.players['0'].discard.map(card => card.uid)).not.toContain('borrowed-bananas');
  });
});
