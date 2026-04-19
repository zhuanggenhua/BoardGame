import { describe, it, expect } from 'vitest';
import { CardiaDomain } from '../domain';
import { CARDIA_EVENTS, type CardiaEvent } from '../domain/events';
import { ABILITY_IDS } from '../domain/ids';
import { recalculateEncounterState } from '../domain/execute';
import { reduce } from '../domain/reduce';
import type { CardiaCore, CardInstance, EncounterState, PlayedCard } from '../domain/core-types';

function createCard(
    uid: string,
    ownerId: '0' | '1',
    defId: string,
    baseInfluence: number,
    faction: 'guild' | 'swamp',
    abilityIds: string[]
): CardInstance {
    return {
        uid,
        defId,
        ownerId,
        baseInfluence,
        faction,
        abilityIds,
        difficulty: 1,
        modifiers: { entries: [], nextOrder: 0 },
        tags: { tags: {} },
        signets: 0,
        ongoingMarkers: [],
        imagePath: `cardia/cards/deck1/${baseInfluence}`,
    };
}

describe('遭遇影响力回溯修复', () => {
    it('宫廷卫士 + 外科医生时应按 modifierTokens 单次计入，不应重复叠加 +7', () => {
        const baseCore = CardiaDomain.setup(['0', '1'], { random: () => 0.5 });

        const p1Card = createCard(
            'p1_card07',
            '0',
            'deck_i_card_07',
            7,
            'guild',
            [ABILITY_IDS.COURT_GUARD]
        );
        const p2Card = createCard(
            'p2_card09',
            '1',
            'deck_i_card_09',
            9,
            'swamp',
            ['ability_i_ambusher']
        );

        const p1Played: PlayedCard = { ...p1Card, encounterIndex: 2 };
        const p2Played: PlayedCard = { ...p2Card, encounterIndex: 2 };

        const encounter: EncounterState = {
            player1Card: p1Card,
            player2Card: p2Card,
            player1Influence: 2, // 7 - 5
            player2Influence: 9,
            winnerId: '1',
            loserId: '0',
        };

        let core: CardiaCore = {
            ...baseCore,
            turnNumber: 2,
            phase: 'ability',
            players: {
                ...baseCore.players,
                '0': {
                    ...baseCore.players['0'],
                    playedCards: [p1Played],
                    currentCard: undefined,
                    hasPlayed: false,
                },
                '1': {
                    ...baseCore.players['1'],
                    playedCards: [p2Played],
                    currentCard: undefined,
                    hasPlayed: false,
                },
            },
            currentEncounter: encounter,
            encounterHistory: [encounter],
            modifierTokens: [
                {
                    cardId: 'p1_card07',
                    value: -5,
                    source: ABILITY_IDS.SURGEON,
                    timestamp: 1,
                },
            ],
        };

        const placeModifierEvent: CardiaEvent = {
            type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED.type,
            timestamp: 2,
            payload: {
                cardId: 'p1_card07',
                value: 7,
                source: ABILITY_IDS.COURT_GUARD,
                timestamp: 2,
            },
        };
        core = reduce(core, placeModifierEvent);

        const recalcEvents = recalculateEncounterState(core, 'p1_card07');
        const influenceEvent = recalcEvents.find(
            e => e.type === CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED.type
        ) as Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.CARD_INFLUENCE_MODIFIED }> | undefined;
        expect(influenceEvent?.payload.newInfluence).toBe(9);

        for (const event of recalcEvents) {
            core = reduce(core, event);
        }

        expect(core.encounterHistory[0].player1Influence).toBe(9);
        expect(core.encounterHistory[0].player2Influence).toBe(9);
        expect(core.encounterHistory[0].winnerId).toBeUndefined();
        expect(core.encounterHistory[0].loserId).toBeUndefined();
    });
});
