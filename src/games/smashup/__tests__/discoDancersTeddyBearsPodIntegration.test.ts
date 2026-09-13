import { beforeAll, describe, expect, it } from 'vitest';
import enLocale from '../../../../public/locales/en/game-smashup.json';
import zhLocale from '../../../../public/locales/zh-CN/game-smashup.json';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getCardDef,
    getFactionCards,
    resolveCardName,
    resolveCardText,
} from '../data/cards';
import { DISCO_DANCERS_CARDS, TRUCKERS_CARDS } from '../data/factions/zhongguo';
import { DISCO_DANCERS_POD_CARDS } from '../data/factions/disco_dancers_pod';
import { TEDDY_BEARS_CARDS } from '../data/factions/what_were_we_thinking';
import { TEDDY_BEARS_POD_CARDS } from '../data/factions/teddy_bears_pod';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById, SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { getSmashUpVariantSurfaceRelation, type SmashUpVariantSurface } from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA, getVisibleFactionVariantGroups } from '../ui/factionMeta';

const SHARED_SURFACES: SmashUpVariantSurface[] = [
    'ability',
    'interaction',
    'ongoing',
    'baseAbility',
    'powerModifier',
];

const DISCO_POD_SLOTS: Record<string, number> = {
    disco_dancers_its_raining_men_pod: 0,
    disco_dancers_i_will_survive_pod: 1,
    disco_dancers_im_so_excited_pod: 2,
    disco_dancers_we_are_family_pod: 3,
    disco_dancers_get_down_tonight_pod: 4,
    disco_dancers_stayin_alive_pod: 5,
    disco_dancers_disco_inferno_pod: 6,
    disco_dancers_last_dance_pod: 7,
    disco_dancers_celebration_pod: 8,
    disco_dancers_turn_the_beat_around_pod: 9,
    disco_dancers_roller_pod: 10,
    disco_dancers_diva_pod: 14,
    disco_dancers_ul_disco_lou_pod: 17,
    disco_dancers_dancing_king_pod: 19,
};

const TEDDY_POD_SLOTS: Record<string, number> = {
    teddy_bears_tea_party_pod: 0,
    teddy_bears_cuddle_pod: 1,
    teddy_bears_care_package_pod: 3,
    teddy_bears_group_hug_pod: 5,
    teddy_bears_bear_picnic_pod: 6,
    teddy_bears_too_cute_pod: 7,
    teddy_bears_love_overload_pod: 8,
    teddy_bears_square_deal_pod: 9,
    teddy_bears_snuggly_bear_pod: 10,
    teddy_bears_lovey_bear_pod: 14,
    teddy_bears_fun_bear_pod: 17,
    teddy_bears_sir_squeezes_pod: 19,
};

let abilityInitError: Error | null = null;

beforeAll(() => {
    try {
        resetAbilityInit();
        initAllAbilities();
    } catch (error) {
        abilityInitError = error instanceof Error ? error : new Error(String(error));
    }
});

function requireAbilityRuntime(): void {
    if (abilityInitError) throw abilityInitError;
}

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function withoutVariantIdentity(card: unknown): Record<string, unknown> {
    const fields = { ...(card as Record<string, unknown>) };
    delete fields.id;
    delete fields.faction;
    delete fields.previewRef;
    return fields;
}

function withoutDiscoNameVariant(card: unknown): Record<string, unknown> {
    const fields = withoutVariantIdentity(card);
    delete fields.nameEn;
    delete fields.count;
    return fields;
}

function localeLookup(locale: unknown): (key: string) => string {
    return (key: string) => {
        const value = key.split('.').reduce<unknown>((current, segment) => (
            current && typeof current === 'object'
                ? (current as Record<string, unknown>)[segment]
                : undefined
        ), locale);
        return typeof value === 'string' ? value : key;
    };
}

function getCardSlots(cards: Array<{ id: string; previewRef?: { type?: string; index?: number } }>): Record<string, number> {
    return Object.fromEntries(cards.map(card => [
        card.id,
        card.previewRef?.type === 'atlas' && typeof card.previewRef.index === 'number'
            ? card.previewRef.index
            : -1,
    ]));
}

function expectAtlasRegistration(atlasId: string, image: string): void {
    expect(SMASHUP_ATLAS_DEFINITIONS.find(definition => definition.id === atlasId)).toEqual({
        id: atlasId,
        kind: 'card',
        image,
        grid: { rows: 4, cols: 5 },
    });
    expect(getSmashUpAtlasImageById(atlasId)).toBe(image);
}

describe('Disco Dancers and Teddy Bears POD integration', () => {
    it('registers both POD decks as distinct 20-card physical decks', () => {
        expect(DISCO_DANCERS_POD_CARDS).toHaveLength(14);
        expect(physicalCardCount(DISCO_DANCERS_POD_CARDS)).toBe(20);
        expect(TEDDY_BEARS_POD_CARDS).toHaveLength(12);
        expect(physicalCardCount(TEDDY_BEARS_POD_CARDS)).toBe(20);

        expect(getFactionCards(SMASHUP_FACTION_IDS.DISCO_DANCERS_POD)).toHaveLength(14);
        expect(getFactionCards(SMASHUP_FACTION_IDS.TEDDY_BEARS_POD)).toHaveLength(12);
        expect(new Set([
            ...DISCO_DANCERS_POD_CARDS,
            ...TEDDY_BEARS_POD_CARDS,
        ].map(card => card.id)).size).toBe(26);
    });

    it('uses the locked row-major 4x5 atlas slots from the POD images', () => {
        expect(getCardSlots(DISCO_DANCERS_POD_CARDS)).toEqual(DISCO_POD_SLOTS);
        expect(getCardSlots(TEDDY_BEARS_POD_CARDS)).toEqual(TEDDY_POD_SLOTS);

        expect(new Set(DISCO_DANCERS_POD_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.DISCO_DANCERS_POD_CARDS]));
        expect(new Set(TEDDY_BEARS_POD_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.TEDDY_BEARS_POD_CARDS]));
    });

    it('keeps shared gameplay fields while preserving documented POD differences', () => {
        for (const podCard of DISCO_DANCERS_POD_CARDS) {
            const sourceId = podCard.id === 'disco_dancers_turn_the_beat_around_pod'
                ? 'truckers_turn_the_beat_around'
                : podCard.id.replace(/_pod$/, '');
            const sourceCard = [
                ...DISCO_DANCERS_CARDS,
                ...TRUCKERS_CARDS,
            ].find(card => card.id === sourceId);

            expect(sourceCard, `${podCard.id} must have a locked source card`).toBeDefined();
            expect(withoutDiscoNameVariant(podCard)).toEqual(withoutDiscoNameVariant(sourceCard));
        }

        expect(getCardDef('disco_dancers_get_down_tonight_pod')?.count).toBe(1);
        expect(getCardDef('disco_dancers_ul_disco_lou_pod')?.nameEn).toBe('Disco Lou');

        for (const podCard of TEDDY_BEARS_POD_CARDS) {
            const sourceId = podCard.id.replace(/_pod$/, '');
            const sourceCard = TEDDY_BEARS_CARDS.find(card => card.id === sourceId);
            expect(sourceCard, `${podCard.id} must have a classic Teddy Bears source card`).toBeDefined();
            expect(withoutVariantIdentity(podCard)).toEqual(withoutVariantIdentity(sourceCard));
        }
    });

    it('registers card atlases, separate POD base identities, and critical preload paths', () => {
        expectAtlasRegistration(SMASHUP_ATLAS_IDS.DISCO_DANCERS_POD_CARDS, 'smashup/cards/disco_dancers_pod');
        expectAtlasRegistration(SMASHUP_ATLAS_IDS.TEDDY_BEARS_POD_CARDS, 'smashup/cards/teddy_bears_pod');

        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.DISCO_DANCERS_POD]).sort()).toEqual([
            'base_boogie_wonderland_pod',
            'base_funky_town_pod',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.TEDDY_BEARS_POD]).sort()).toEqual([
            'base_out_in_the_woods_pod',
            'base_under_the_bed_pod',
        ]);
        expect(getBaseDef('base_funky_town_pod')?.previewRef).toEqual(getBaseDef('base_funky_town')?.previewRef);
        expect(getBaseDef('base_under_the_bed_pod')?.previewRef).toEqual(getBaseDef('base_under_the_bed')?.previewRef);

        const resolved = smashUpCriticalImageResolver({
            sys: { phase: 'playCards' },
            core: {
                players: {
                    '0': {
                        factions: [
                            SMASHUP_FACTION_IDS.DISCO_DANCERS_POD,
                            SMASHUP_FACTION_IDS.TEDDY_BEARS_POD,
                        ],
                    },
                },
            },
        }, undefined, '0');
        expect(resolved.critical).toContain('smashup/cards/disco_dancers_pod');
        expect(resolved.critical).toContain('smashup/cards/teddy_bears_pod');
        expect(resolved.critical).toContain('smashup/base/zhongguo');
        expect(resolved.critical).toContain('smashup/base/what_were_we_thinking_bases');
    });

    it('declares shared runtime surfaces while keeping each POD base pool separate', () => {
        for (const surface of SHARED_SURFACES) {
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'disco_dancers_get_down_tonight',
                SMASHUP_FACTION_IDS.DISCO_DANCERS_POD,
            )).toBe('shared');
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'teddy_bears_tea_party',
                SMASHUP_FACTION_IDS.TEDDY_BEARS_POD,
            )).toBe('shared');
        }

        expect(getSmashUpVariantSurfaceRelation(
            'basePool',
            'disco_dancers',
            SMASHUP_FACTION_IDS.DISCO_DANCERS_POD,
        )).toBe('separate');
        expect(getSmashUpVariantSurfaceRelation(
            'basePool',
            'teddy_bears',
            SMASHUP_FACTION_IDS.TEDDY_BEARS_POD,
        )).toBe('separate');
    });

    it('exposes POD variants in all locales and has explicit bilingual POD card text', () => {
        const metadata = new Map(FACTION_METADATA.map(entry => [entry.id, entry]));
        expect(metadata.get(SMASHUP_FACTION_IDS.DISCO_DANCERS)?.locales).toEqual(['zh-CN']);
        expect(metadata.get(SMASHUP_FACTION_IDS.TEDDY_BEARS)?.locales).toEqual(['zh-CN']);
        expect(metadata.get(SMASHUP_FACTION_IDS.DISCO_DANCERS_POD)?.locales).toBeUndefined();
        expect(metadata.get(SMASHUP_FACTION_IDS.TEDDY_BEARS_POD)?.locales).toBeUndefined();

        const enGroupIds = getVisibleFactionVariantGroups('en').map(group => group.groupId);
        expect(enGroupIds).toContain(SMASHUP_FACTION_IDS.DISCO_DANCERS);
        expect(enGroupIds).toContain(SMASHUP_FACTION_IDS.TEDDY_BEARS);
        const discoZhGroup = getVisibleFactionVariantGroups('zh-CN')
            .find(group => group.groupId === SMASHUP_FACTION_IDS.DISCO_DANCERS);
        const teddyZhGroup = getVisibleFactionVariantGroups('zh-CN')
            .find(group => group.groupId === SMASHUP_FACTION_IDS.TEDDY_BEARS);
        expect(discoZhGroup?.variants.map(variant => variant.id)).toEqual([
            SMASHUP_FACTION_IDS.DISCO_DANCERS,
            SMASHUP_FACTION_IDS.DISCO_DANCERS_POD,
        ]);
        expect(teddyZhGroup?.variants.map(variant => variant.id)).toEqual([
            SMASHUP_FACTION_IDS.TEDDY_BEARS,
            SMASHUP_FACTION_IDS.TEDDY_BEARS_POD,
        ]);

        for (const locale of [enLocale, zhLocale] as const) {
            expect(locale.factions.disco_dancers_pod.name).toBeTruthy();
            expect(locale.factions.teddy_bears_pod.name).toBeTruthy();
            const cards = locale.cards as Record<string, unknown>;
            for (const card of [...DISCO_DANCERS_POD_CARDS, ...TEDDY_BEARS_POD_CARDS]) {
                expect(cards[card.id], `${card.id} locale`).toBeTruthy();
            }
        }

        expect(resolveCardName(getCardDef('disco_dancers_ul_disco_lou_pod'), localeLookup(enLocale))).toBe('Disco Lou');
        expect(resolveCardText(getCardDef('disco_dancers_turn_the_beat_around_pod'), localeLookup(zhLocale))).toBe(
            resolveCardText(getCardDef('truckers_turn_the_beat_around'), localeLookup(zhLocale)),
        );
        expect(resolveCardText(getBaseDef('base_under_the_bed_pod'), localeLookup(enLocale))).toBe(
            resolveCardText(getBaseDef('base_under_the_bed'), localeLookup(enLocale)),
        );
    });

    it('generates representative POD ability aliases and registers the Disco-specific POD special', () => {
        requireAbilityRuntime();
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('disco_dancers_get_down_tonight_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('disco_dancers_turn_the_beat_around_pod::special')).toBe(true);
        expect(abilityKeys.has('teddy_bears_sir_squeezes_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('teddy_bears_tea_party_pod::talent')).toBe(true);
    });
});
