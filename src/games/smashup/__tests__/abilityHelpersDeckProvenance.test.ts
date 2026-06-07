import { describe, expect, it } from 'vitest';

import type { RandomFn } from '../../../../engine/types';
import { peekDeckTop } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardInstance, DeckReorderedEvent, PlayerState, SmashUpCore } from '../domain/types';

const identityRandom: RandomFn = {
    random: () => 0.5,
    shuffle: <T>(items: T[]) => [...items],
} as RandomFn;

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        factions: ['wizards', 'robots'],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        ...overrides,
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

describe('abilityHelpers deck provenance', () => {
    it('peekDeckTop 在牌库为空且弃牌堆含 borrowed 牌时，应按真实 owner 分别洗回各自牌库', () => {
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', {
                    deck: [],
                    discard: [
                        makeCard('own-discard', 'robot_microbot_guard', 'minion', '0'),
                        makeCard('borrowed-discard', 'wizard_enchantress', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-card', 'wizard_neophyte', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            turnNumber: 1,
            nextUid: 1000,
            bases: [],
            baseDeck: [],
            titans: [],
        };

        const result = peekDeckTop(state, identityRandom, '0', 'none', 'peek_deck_top_owner_split', 12345, '0');

        expect(result?.card.uid).toBe('own-discard');

        const reorderEvents = (result?.events ?? []).filter(
            (event): event is DeckReorderedEvent => event.type === SU_EVENTS.DECK_REORDERED,
        );

        expect(reorderEvents).toEqual([
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: '1',
                    sourcePlayerId: '0',
                    deckUids: ['owner-deck-card', 'borrowed-discard'],
                },
                timestamp: 12345,
            },
            {
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: '0',
                    deckUids: ['own-discard'],
                },
                timestamp: 12345,
            },
        ]);
    });
});
