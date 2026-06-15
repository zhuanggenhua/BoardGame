import { describe, expect, it } from 'vitest';
import { createModifierStack } from '../../../engine/primitives/modifier';
import cardiaFlowHooks from '../domain/flowHooks';
import type { CardiaCore, PlayerState, PlayedCard } from '../domain/core-types';
import { ABILITY_IDS } from '../domain/ids';

function makePlayedCard(uid: string, ownerId: '0' | '1', signets: number): PlayedCard {
  return {
    uid,
    defId: uid,
    ownerId,
    baseInfluence: 5,
    faction: 'swamp',
    abilityIds: [],
    difficulty: 1,
    modifiers: createModifierStack(),
    tags: { tags: {} } as any,
    signets,
    ongoingMarkers: [],
    encounterIndex: 1,
  };
}

function makePlayer(id: '0' | '1', overrides?: Partial<PlayerState>): PlayerState {
  return {
    id,
    name: `P${id}`,
    hand: [],
    deck: [],
    discard: [],
    playedCards: [],
    signets: 0,
    tags: { tags: {} } as any,
    hasPlayed: false,
    cardRevealed: false,
    ...overrides,
  };
}

function makeCore(overrides?: Partial<CardiaCore>): CardiaCore {
  return {
    players: {
      '0': makePlayer('0'),
      '1': makePlayer('1'),
    },
    playerOrder: ['0', '1'],
    currentPlayerId: '0',
    turnNumber: 2,
    phase: 'play',
    encounterHistory: [],
    ongoingAbilities: [],
    modifierTokens: [],
    delayedEffects: [],
    revealFirstNextEncounter: null,
    forcedPlayOrderNextEncounter: null,
    mechanicalSpiritActive: null,
    deckVariant: 'I',
    targetSignets: 5,
    ...overrides,
  };
}

describe('Cardia flow hooks effect host integration', () => {
  it('play 阶段入口会通过 effect host 识别顾问持续能力', () => {
    const previousEncounter = {
      player1Card: makePlayedCard('p0-prev', '0', 1),
      player2Card: makePlayedCard('p1-prev', '1', 0),
      player1Influence: 5,
      player2Influence: 2,
      winnerId: '0' as const,
      loserId: '1' as const,
    };

    const state = {
      core: makeCore({
        players: {
          '0': makePlayer('0', {
            currentCard: {
              uid: 'p0-current',
              defId: 'deck_ii_card_12',
              ownerId: '0',
              baseInfluence: 12,
              faction: 'guild',
              abilityIds: [ABILITY_IDS.ADVISOR],
              difficulty: 4,
              modifiers: createModifierStack(),
              tags: { tags: {} } as any,
              signets: 0,
              ongoingMarkers: [],
            },
          }),
          '1': makePlayer('1'),
        },
        previousEncounter,
        ongoingAbilities: [{
          abilityId: ABILITY_IDS.ADVISOR,
          cardId: 'advisor-card',
          playerId: '0',
          effectType: 'extraSignet',
          timestamp: 100,
        }],
      }),
      sys: {
        phase: 'play',
      },
    } as any;

    const events = cardiaFlowHooks.onPhaseEnter?.({ to: 'play', state }) ?? [];
    const signetEvent = events.find(event => event.type === 'SIGNET_GRANTED');

    expect(signetEvent).toBeDefined();
    expect(signetEvent?.payload).toMatchObject({
      playerId: '0',
      cardUid: 'p0-current',
      newTotal: 1,
    });
  });
});
