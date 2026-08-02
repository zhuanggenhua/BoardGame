import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getBaseDefIdsForFactions, getFactionCards } from '../../data/cards';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';
import { SMASHUP_ATLAS_DEFINITIONS } from '../../domain/atlasCatalog';
import { SU_EVENTS } from '../../domain/types';
import { FACTION_METADATA, isFactionImplementationInProgress } from '../../ui/factionMeta';
import {
    applyEvents,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('企鹅派系实装', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组、基地和图集槽位可注册', () => {
        const cards = getFactionCards(SMASHUP_FACTION_IDS.PENGUINS);
        expect(cards.map(card => card.id)).toEqual([
            'penguins_surfing_penguin',
            'penguins_dancing_penguin',
            'penguins_snazzy_penguin',
            'penguins_command_penguin',
            'penguins_disguise_penguin',
            'penguins_secret_mission',
            'penguins_the_hatching',
            'penguins_regurgitating_penguin',
            'penguins_baby_penguin',
            'penguins_a_wish_for_wings_that_work',
            'penguins_leaping_aboard',
            'penguins_i_cant_tell_them_apart',
            'penguins_pebble_gift',
            'penguins_under_the_ice',
            'penguins_ice_slide',
        ]);
        expect(cards.reduce((sum, card) => sum + (card.count ?? 1), 0)).toBe(20);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.PENGUINS])).toEqual(['base_ice_floe', 'base_the_colony']);
        expect(SMASHUP_ATLAS_DEFINITIONS.find(atlas => atlas.id === SMASHUP_ATLAS_IDS.PENGUINS_CARDS)?.grid).toEqual({ rows: 4, cols: 4 });
        expect(SMASHUP_ATLAS_DEFINITIONS.find(atlas => atlas.id === SMASHUP_ATLAS_IDS.PENGUINS_BASES)?.grid).toEqual({ rows: 2, cols: 2 });
        expect(FACTION_METADATA.find(meta => meta.id === SMASHUP_FACTION_IDS.PENGUINS)?.nameKey).toBe('factions.penguins.name');
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.PENGUINS)).toBe(false);
    });

    it('破壳而出会翻过行动牌并把第一个随从作为 fromDeck 额外随从打出', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('secret', 'penguins_secret_mission', 'action', '0'),
                        makeCard('baby', 'penguins_baby_penguin', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.PENGUINS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe')],
        });

        const result = invokeRegisteredAbilityContract('penguins_the_hatching', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'hatching',
            defId: 'penguins_the_hatching',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        const finalCore = applyEvents(core, result.events);

        expect(result.events.map(event => event.type)).toContain(SU_EVENTS.REVEAL_DECK_TOP);
        expect(finalCore.bases[0].minions).toContainEqual(expect.objectContaining({
            uid: 'baby',
            defId: 'penguins_baby_penguin',
            metadata: { playedFrom: 'deck' },
        }));
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['secret']);
    });

    it('时髦企鹅从牌库顶打出时抽两张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'penguins_secret_mission', 'action', '0'),
                        makeCard('draw-2', 'penguins_the_hatching', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.PENGUINS, SMASHUP_FACTION_IDS.PIRATES],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_ice_floe', [
                makeMinion('snazzy', 'penguins_snazzy_penguin', '0', 3, { metadata: { playedFrom: 'deck' } }),
            ])],
        });

        const result = invokeRegisteredAbilityContract('penguins_snazzy_penguin', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'snazzy',
            defId: 'penguins_snazzy_penguin',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const finalCore = applyEvents(core, result.events);

        expect(finalCore.players['0'].hand.map(card => card.uid)).toEqual(['draw-1', 'draw-2']);
        expect(finalCore.players['0'].deck).toEqual([]);
    });
});
