import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getAllCardDefs } from '../data/cards';
import { getCardDefActivatableAbilities } from '../domain/activationMetadata';
import type { CardDef } from '../domain/types';
import { getHandSpecialPlayableBaseIndices, shouldOfferHandSpecialActionChoice } from '../ui/handSpecialSelection';
import {
    getMinionReplacementPlayableBaseIndices,
    getRegularMinionPlayableBaseIndices,
    shouldOfferMinionReplacementActionChoice,
} from '../ui/resolveMinionUiPlayPlan';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';

function hasHandPlayCardsSpecial(def: CardDef): boolean {
    return getCardDefActivatableAbilities(def).some(ability =>
        ability.kind === 'special'
        && ability.zone === 'hand'
        && ability.window === 'playCards'
    );
}

function getHandPlayCardsSpecialMinionIds(): string[] {
    return getAllCardDefs()
        .filter(def => def.type === 'minion' && hasHandPlayCardsSpecial(def))
        .map(def => def.id)
        .sort();
}

describe('SmashUp 手牌动作仲裁审计', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('所有手牌出牌阶段 special 随从必须被分类，不能只审单张粉丝', () => {
        expect(getHandPlayCardsSpecialMinionIds()).toEqual([
            'all_stars_fan',
            'geeks_fan',
            'penguins_dancing_penguin',
        ]);

        const handPlayCardsSpecialFusions = getAllCardDefs()
            .filter(def => def.type === 'fusion')
            .filter(def =>
                getCardDefActivatableAbilities(def, { face: 'minion' }).some(ability =>
                    ability.kind === 'special'
                    && ability.zone === 'hand'
                    && ability.window === 'playCards'
                )
                || getCardDefActivatableAbilities(def, { face: 'action' }).some(ability =>
                    ability.kind === 'special'
                    && ability.zone === 'hand'
                    && ability.window === 'playCards'
                )
            )
            .map(def => def.id)
            .sort();
        const handPlayCardsSpecialActions = getAllCardDefs()
            .filter(def => def.type === 'action' && hasHandPlayCardsSpecial(def))
            .map(def => def.id)
            .sort();

        expect(handPlayCardsSpecialFusions).toEqual([]);
        expect(handPlayCardsSpecialActions).toEqual([]);
    });

    it('普通打出和自身手牌能力同时合法时，必须进入动作仲裁', () => {
        for (const defId of ['all_stars_fan', 'geeks_fan']) {
            const matchState = makeMatchState(makeState({
                currentPlayerIndex: 0,
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard(`${defId}-card`, defId, 'minion', '0')],
                        minionsPlayed: 0,
                        minionLimit: 1,
                    }),
                    '1': makePlayer('1'),
                },
                bases: [makeBase('base_a')],
            }));
            const card = matchState.core.players['0'].hand[0];
            const regularBases = getRegularMinionPlayableBaseIndices(matchState, '0', card.uid);

            expect(Array.from(regularBases), `${defId} 普通打出应合法`).toEqual([0]);
            expect(Array.from(getHandSpecialPlayableBaseIndices(matchState, '0', card.uid)), `${defId} 手牌能力应合法`).toEqual([0]);
            expect(shouldOfferHandSpecialActionChoice({
                matchState,
                playerId: '0',
                card,
                normalPlayableBaseIndices: regularBases,
            }), `${defId} 应进入动作仲裁`).toBe(true);
        }
    });

    it('跳舞企鹅是替代其他随从打出的仲裁，不是点自己时的 hand-special 仲裁', () => {
        const matchState = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('original-card', 'penguins_surfing_penguin', 'minion', '0'),
                        makeCard('dancing-card', 'penguins_dancing_penguin', 'minion', '0'),
                    ],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe')],
        }));
        const [originalCard, dancingCard] = matchState.core.players['0'].hand;
        const regularBases = getRegularMinionPlayableBaseIndices(matchState, '0', originalCard.uid);

        expect(Array.from(getHandSpecialPlayableBaseIndices(matchState, '0', dancingCard.uid))).toEqual([]);
        expect(Array.from(getMinionReplacementPlayableBaseIndices(matchState, '0', originalCard))).toEqual([0]);
        expect(shouldOfferMinionReplacementActionChoice({
            matchState,
            playerId: '0',
            card: originalCard,
            regularPlayableBaseIndices: regularBases,
        })).toBe(true);
    });
});
