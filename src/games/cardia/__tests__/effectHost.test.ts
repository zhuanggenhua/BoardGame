import { describe, expect, it } from 'vitest';
import { createModifierStack } from '../../../engine/primitives/modifier';
import type { CardiaCore, PlayerState, PlayedCard } from '../domain/core-types';
import { ABILITY_IDS } from '../domain/ids';
import {
  createCardiaPlayerEffectHost,
  getCardiaStoredOngoingAbilityCardIds,
  getCardiaActiveOngoingAbilities,
  getCardiaActiveOngoingAbilitiesByAbilityId,
  getCardiaPlayerActiveOngoingAbilitiesByAbilityId,
  hasCardiaPlayerOngoingAbilityTag,
  hasCardiaPlayerOngoingEffectTag,
  resolveCardiaEncounterOutcome,
} from '../domain/effectHost';
import { recalculateEncounterResult } from '../domain/utils';

function makePlayedCard(uid: string, ownerId: '0' | '1', baseInfluence: number): PlayedCard {
  return {
    uid,
    defId: uid,
    ownerId,
    baseInfluence,
    faction: 'swamp',
    abilityIds: [],
    difficulty: 1,
    modifiers: createModifierStack(),
    tags: { tags: {} } as any,
    signets: 0,
    ongoingMarkers: [],
    encounterIndex: 0,
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
    turnNumber: 1,
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

describe('Cardia effect host adapter', () => {
  it('会把 legacy player.tags 与 ongoingAbilities 组装成真实的 effect host', () => {
    const core = makeCore({
      players: {
        '0': makePlayer('0', {
          tags: {
            tags: {
              'Player.Blessed': { stacks: 1, source: 'test' },
            },
          } as any,
        }),
        '1': makePlayer('1'),
      },
      ongoingAbilities: [{
        abilityId: ABILITY_IDS.MAGISTRATE,
        cardId: 'judge-card',
        playerId: '0',
        effectType: 'winTies',
        timestamp: 100,
      }],
    });

    const host = createCardiaPlayerEffectHost(core, '0');
    expect(host.runtime.targetTags['Player.Blessed']).toMatchObject({ stacks: 1, source: 'test' });
    expect(host.runtime.targetTags['Cardia.Ongoing.winTies']).toMatchObject({ source: ABILITY_IDS.MAGISTRATE });
    expect(host.runtime.targetTags[`Cardia.Ongoing.Ability.${ABILITY_IDS.MAGISTRATE}`]).toBeDefined();
    expect(hasCardiaPlayerOngoingAbilityTag(core, '0', ABILITY_IDS.MAGISTRATE)).toBe(true);
  });

  it('forceTie 只会在匹配的遭遇上下文里激活', () => {
    const core = makeCore({
      ongoingAbilities: [{
        abilityId: ABILITY_IDS.MEDIATOR,
        cardId: 'mediator-card',
        playerId: '0',
        effectType: 'forceTie',
        timestamp: 100,
        encounterIndex: 2,
      }],
    });

    expect(hasCardiaPlayerOngoingEffectTag(core, '0', 'forceTie', { encounterIndex: 1 })).toBe(false);
    expect(hasCardiaPlayerOngoingEffectTag(core, '0', 'forceTie', { encounterIndex: 2 })).toBe(true);
    expect(getCardiaActiveOngoingAbilities(core, 'forceTie', { encounterIndex: 1 })).toHaveLength(0);
    expect(getCardiaActiveOngoingAbilities(core, 'forceTie', { encounterIndex: 2 })).toHaveLength(1);
    expect(getCardiaPlayerActiveOngoingAbilitiesByAbilityId(core, '0', ABILITY_IDS.MEDIATOR, { encounterIndex: 1 })).toHaveLength(0);
    expect(getCardiaPlayerActiveOngoingAbilitiesByAbilityId(core, '0', ABILITY_IDS.MEDIATOR, { encounterIndex: 2 })).toHaveLength(1);
    expect(getCardiaActiveOngoingAbilitiesByAbilityId(core, ABILITY_IDS.MEDIATOR, { encounterIndex: 1 })).toHaveLength(0);
    expect(getCardiaActiveOngoingAbilitiesByAbilityId(core, ABILITY_IDS.MEDIATOR, { encounterIndex: 2 })).toHaveLength(1);
  });

  it('会为持续效果存储层提供去重后的 cardId 查询入口', () => {
    const core = makeCore({
      ongoingAbilities: [
        {
          abilityId: ABILITY_IDS.MEDIATOR,
          cardId: 'shared-card',
          playerId: '0',
          effectType: 'forceTie',
          timestamp: 100,
          encounterIndex: 2,
        },
        {
          abilityId: ABILITY_IDS.MAGISTRATE,
          cardId: 'shared-card',
          playerId: '0',
          effectType: 'winTies',
          timestamp: 101,
        },
        {
          abilityId: ABILITY_IDS.TREASURER,
          cardId: 'other-card',
          playerId: '1',
          effectType: 'extraSignet',
          timestamp: 102,
        },
      ],
    });

    expect(getCardiaStoredOngoingAbilityCardIds(core)).toEqual(['shared-card', 'other-card']);
  });

  it('resolveCardiaEncounterOutcome 会统一应用 forceTie 与 winTies 的优先级', () => {
    const core = makeCore({
      ongoingAbilities: [
        {
          abilityId: ABILITY_IDS.MEDIATOR,
          cardId: 'mediator-card',
          playerId: '1',
          effectType: 'forceTie',
          timestamp: 100,
          encounterIndex: 3,
        },
        {
          abilityId: ABILITY_IDS.MAGISTRATE,
          cardId: 'magistrate-card',
          playerId: '0',
          effectType: 'winTies',
          timestamp: 101,
        },
      ],
    });

    expect(resolveCardiaEncounterOutcome(core, {
      player1Id: '0',
      player1Influence: 4,
      player2Id: '1',
      player2Influence: 9,
      encounterIndex: 3,
    })).toMatchObject({
      baseWinner: '1',
      baseLoser: '0',
      winner: '0',
      loser: '1',
    });
  });

  it('recalculateEncounterResult 会通过 effect host 识别审判官的平局获胜效果', () => {
    const core = makeCore({
      players: {
        '0': makePlayer('0', {
          playedCards: [makePlayedCard('p0-card', '0', 5)],
        }),
        '1': makePlayer('1', {
          playedCards: [makePlayedCard('p1-card', '1', 5)],
        }),
      },
      ongoingAbilities: [{
        abilityId: ABILITY_IDS.MAGISTRATE,
        cardId: 'judge-card',
        playerId: '0',
        effectType: 'winTies',
        timestamp: 100,
      }],
    });

    expect(recalculateEncounterResult(core, 0)).toBe('0');
  });

  it('recalculateEncounterResult 会按遭遇索引识别调停者的当前遭遇强制平局', () => {
    const core = makeCore({
      players: {
        '0': makePlayer('0', {
          playedCards: [makePlayedCard('p0-card', '0', 7)],
        }),
        '1': makePlayer('1', {
          playedCards: [makePlayedCard('p1-card', '1', 3)],
        }),
      },
      ongoingAbilities: [{
        abilityId: ABILITY_IDS.MEDIATOR,
        cardId: 'mediator-card',
        playerId: '1',
        effectType: 'forceTie',
        timestamp: 100,
        encounterIndex: 1,
      }],
    });

    expect(recalculateEncounterResult(core, 0)).toBe('tie');
  });
});
