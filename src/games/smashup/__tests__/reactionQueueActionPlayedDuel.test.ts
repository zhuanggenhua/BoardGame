import { beforeAll, describe, expect, it } from 'vitest';
import { SU_EVENTS } from '../domain/types';
import { startDuel } from '../domain/duel';
import { initAllAbilities } from '../abilities';
import {
  findInteractionOption,
  makeBase,
  makeCard,
  makeMatchState,
  makeMinion,
  makePlayer,
  makeState,
  resolveInteractionChain,
} from './helpers';

const FIXED_RANDOM = {
  random: () => 0.5,
  d: () => 1,
  range: (min: number) => min,
  shuffle: <T>(items: T[]) => [...items],
};

beforeAll(() => {
  initAllAbilities();
});

describe('Reaction queue: ACTION_PLAYED duel routes', () => {
  it('决斗中打出附着到随从的行动时，应保留目标基地上下文并触发基地 onActionPlayed', () => {
    const started = startDuel(
      makeMatchState(makeState({
        players: {
          '0': makePlayer('0', {
            hand: [makeCard('duel-action', 'cyborg_apes_juiced_up', 'action', '0')],
            deck: [makeCard('drawn-1', 'cyborg_apes_cyberback', 'minion', '0')],
          }),
          '1': makePlayer('1'),
        },
        bases: [
          makeBase('base_enchanted_glade', [
            makeMinion('challenger-1', 'cyborg_apes_cyberback', '0', 3),
            makeMinion('challenged-1', 'sharks_mako', '1', 2),
          ]),
          makeBase('base_faceless_city'),
        ],
      })),
      {
        sourceId: 'test_duel',
        sourcePlayerId: '0',
        challengerMinionUid: 'challenger-1',
        challengedMinionUid: 'challenged-1',
        outcome: 'destroy_loser',
      },
      1,
    );

    const resolved = resolveInteractionChain(started, (prompt) => {
      const sourceId = prompt?.data?.sourceId;
      if (sourceId === 'smashup_duel_pinkerton') {
        const option = findInteractionOption(prompt, entry => entry?.value?.amount === 0);
        expect(option).toBeDefined();
        return { optionId: option.id };
      }
      if (sourceId === 'smashup_duel_card') {
        const action = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'duel-action');
        const skip = findInteractionOption(prompt, entry => entry?.value?.skip === true);
        const option = action ?? skip;
        expect(option).toBeDefined();
        return { optionId: option.id };
      }
      if (sourceId === 'smashup_duel_action_target_minion') {
        const target = findInteractionOption(prompt, entry => entry?.value?.minionUid === 'challenger-1');
        expect(target).toBeDefined();
        return { optionId: target.id };
      }
      if (sourceId === 'smashup_duel_deputy_card') {
        const skip = findInteractionOption(prompt, entry => entry?.value?.skip === true);
        expect(skip).toBeDefined();
        return { optionId: skip.id };
      }
      throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    }, FIXED_RANDOM as any);

    const actionPlayed = resolved.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
    expect(actionPlayed?.payload).toEqual(expect.objectContaining({
      targetBaseIndex: 0,
      targetType: 'minion',
      targetMinionUid: 'challenger-1',
    }));
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.CARDS_DRAWN,
      payload: expect.objectContaining({
        playerId: '0',
        cardUids: ['drawn-1'],
      }),
    }));
  });

  it('决斗中打出被他人拥有的 ongoing 行动时，应保留真实 owner 并附着到目标上', () => {
    const started = startDuel(
      makeMatchState(makeState({
        players: {
          '0': makePlayer('0', {
            hand: [makeCard('borrowed-duel-action', 'cyborg_apes_juiced_up', 'action', '1')],
          }),
          '1': makePlayer('1'),
        },
        bases: [
          makeBase('base_portal_room', [
            makeMinion('challenger-1', 'cyborg_apes_cyberback', '0', 3),
            makeMinion('challenged-1', 'sharks_mako', '1', 2),
          ]),
        ],
      })),
      {
        sourceId: 'test_duel',
        sourcePlayerId: '0',
        challengerMinionUid: 'challenger-1',
        challengedMinionUid: 'challenged-1',
        outcome: 'destroy_loser',
      },
      1,
    );

    const resolved = resolveInteractionChain(started, (prompt) => {
      const sourceId = prompt?.data?.sourceId;
      if (sourceId === 'smashup_duel_pinkerton') {
        const option = findInteractionOption(prompt, entry => entry?.value?.amount === 0);
        expect(option).toBeDefined();
        return { optionId: option.id };
      }
      if (sourceId === 'smashup_duel_card') {
        const action = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'borrowed-duel-action');
        const skip = findInteractionOption(prompt, entry => entry?.value?.skip === true);
        const option = action ?? skip;
        expect(option).toBeDefined();
        return { optionId: option.id };
      }
      if (sourceId === 'smashup_duel_action_target_minion') {
        const target = findInteractionOption(prompt, entry => entry?.value?.minionUid === 'challenger-1');
        expect(target).toBeDefined();
        return { optionId: target.id };
      }
      if (sourceId === 'smashup_duel_deputy_card') {
        const skip = findInteractionOption(prompt, entry => entry?.value?.skip === true);
        expect(skip).toBeDefined();
        return { optionId: skip.id };
      }
      throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    }, FIXED_RANDOM as any);

    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ACTION_PLAYED,
      payload: expect.objectContaining({
        cardUid: 'borrowed-duel-action',
        ownerId: '1',
        targetBaseIndex: 0,
        targetType: 'minion',
        targetMinionUid: 'challenger-1',
      }),
    }));
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: SU_EVENTS.ONGOING_ATTACHED,
      payload: expect.objectContaining({
        cardUid: 'borrowed-duel-action',
        ownerId: '1',
        targetType: 'minion',
        targetMinionUid: 'challenger-1',
      }),
    }));

    const host = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'challenger-1');
    expect(host?.attachedActions).toContainEqual(expect.objectContaining({
      uid: 'borrowed-duel-action',
      ownerId: '1',
    }));
    expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'borrowed-duel-action')).toBe(false);
  });
});
