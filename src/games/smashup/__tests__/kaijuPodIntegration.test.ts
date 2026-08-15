import { beforeAll, describe, expect, it } from 'vitest';
import enLocale from '../../../../public/locales/en/game-smashup.json';
import zhLocale from '../../../../public/locales/zh-CN/game-smashup.json';
import rootAssetManifest from '../../../../public/assets/i18n/assets-manifest.json';
import smashUpAssetManifest from '../../../../public/assets/i18n/zh-CN/smashup/assets-manifest.json';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getCardDef,
    getFactionCards,
    getFactionTitans,
    resolveCardName,
    resolveCardText,
} from '../data/cards';
import { KAIJU_CARDS } from '../data/factions/kaiju';
import { KAIJU_POD_CARDS } from '../data/factions/kaiju_pod';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById, SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { getSmashUpVariantSurfaceRelation, type SmashUpVariantSurface } from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA } from '../ui/factionMeta';

const SHARED_SURFACES: SmashUpVariantSurface[] = [
    'ability',
    'interaction',
    'ongoing',
    'baseAbility',
    'powerModifier',
];

const EXPECTED_SLOTS: Record<string, number> = {
    kaiju_stomp_pod: 0,
    kaiju_radioactive_breath_pod: 2,
    kaiju_tail_smash_pod: 5,
    kaiju_wade_through_the_buildings_pod: 6,
    kaiju_oh_no_pod: 7,
    kaiju_pick_up_a_bus_pod: 8,
    kaiju_the_folly_of_men_pod: 10,
    kaiju_kaiju_conflict_pod: 11,
    kaiju_there_goes_tokyo_pod: 13,
    kaiju_they_say_hes_got_to_go_pod: 14,
    kaiju_kaiju_alliance_pod: 15,
    kaiju_johnny_pod: 17,
    kaiju_tiny_priestesses_pod: 18,
    kaiju_kaijookey_pod: 19,
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

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function withoutVariantIdentity(card: Record<string, unknown>): Record<string, unknown> {
    const { id: _id, faction: _faction, previewRef: _previewRef, ...shared } = card;
    return shared;
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

describe('Kaiju POD integration', () => {
    it('registers 14 unique definitions representing all 20 physical cards', () => {
        expect(KAIJU_POD_CARDS).toHaveLength(14);
        expect(physicalCardCount(KAIJU_POD_CARDS)).toBe(20);
        expect(getFactionCards(SMASHUP_FACTION_IDS.KAIJU_POD)).toHaveLength(14);
        expect(new Set(KAIJU_POD_CARDS.map(card => card.id)).size).toBe(14);
        expect(KAIJU_POD_CARDS.every(card => card.id.endsWith('_pod'))).toBe(true);
        expect(KAIJU_POD_CARDS.every(card => card.faction === SMASHUP_FACTION_IDS.KAIJU_POD)).toBe(true);
    });

    it('maps every runtime object to the locked 4x5 atlas slot', () => {
        expect(Object.fromEntries(KAIJU_POD_CARDS.map(card => [
            card.id,
            card.previewRef?.type === 'atlas' ? card.previewRef.index : -1,
        ]))).toEqual(EXPECTED_SLOTS);

        expect(new Set(KAIJU_POD_CARDS.map(card => (
            card.previewRef?.type === 'atlas' ? card.previewRef.atlasId : null
        )))).toEqual(new Set([SMASHUP_ATLAS_IDS.KAIJU_POD_CARDS]));

        const atlas = SMASHUP_ATLAS_DEFINITIONS.find(definition => definition.id === SMASHUP_ATLAS_IDS.KAIJU_POD_CARDS);
        expect(atlas).toEqual({
            id: SMASHUP_ATLAS_IDS.KAIJU_POD_CARDS,
            kind: 'card',
            image: 'smashup/cards/kaiju_pod',
            grid: { rows: 4, cols: 5 },
        });
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.KAIJU_POD_CARDS)).toBe('smashup/cards/kaiju_pod');
    });

    it('keeps ordinary Kaiju static gameplay fields unchanged and equivalent', () => {
        for (const podCard of KAIJU_POD_CARDS) {
            const ordinaryId = podCard.id.replace(/_pod$/, '');
            const ordinaryCard = KAIJU_CARDS.find(card => card.id === ordinaryId);
            expect(ordinaryCard, `${podCard.id} must have an ordinary Kaiju source`).toBeDefined();
            expect(withoutVariantIdentity(podCard as unknown as Record<string, unknown>)).toEqual(
                withoutVariantIdentity(ordinaryCard as unknown as Record<string, unknown>),
            );
        }
    });

    it('shares every gameplay surface while keeping the POD base pool separate', () => {
        for (const surface of SHARED_SURFACES) {
            expect(getSmashUpVariantSurfaceRelation(
                surface,
                'kaiju_stomp',
                SMASHUP_FACTION_IDS.KAIJU_POD,
            )).toBe('shared');
        }
        expect(getSmashUpVariantSurfaceRelation(
            'basePool',
            'kaiju',
            SMASHUP_FACTION_IDS.KAIJU_POD,
        )).toBe('separate');

        if (abilityInitError) throw abilityInitError;
        const abilityKeys = getRegisteredAbilityKeys();
        expect(abilityKeys.has('kaiju_stomp_pod::onPlay')).toBe(true);
        expect(abilityKeys.has('kaiju_johnny_pod::onPlay')).toBe(true);
    });

    it('uses POD base skeleton IDs with ordinary art and reuses Gorgodzolla', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.KAIJU_POD]).sort()).toEqual([
            'base_kaiju_island_pod',
            'base_tokyo_pod',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.KAIJU]).sort()).toEqual([
            'base_kaiju_island',
            'base_tokyo',
        ]);

        expect(getBaseDef('base_tokyo_pod')?.previewRef).toEqual(getBaseDef('base_tokyo')?.previewRef);
        expect(getBaseDef('base_kaiju_island_pod')?.previewRef).toEqual(getBaseDef('base_kaiju_island')?.previewRef);
        expect(getFactionTitans(SMASHUP_FACTION_IDS.KAIJU_POD).map(titan => titan.id)).toEqual([
            'kaiju_gorgodzolla',
        ]);
    });

    it('exposes faction locale and falls back from POD card/base IDs in both languages', () => {
        const metadata = new Map(FACTION_METADATA.map(entry => [entry.id, entry]));
        expect(metadata.get(SMASHUP_FACTION_IDS.KAIJU_POD)?.nameKey).toBe('factions.kaiju_pod.name');
        expect(metadata.get(SMASHUP_FACTION_IDS.KAIJU_POD)?.locales).toBeUndefined();

        const podCard = getCardDef('kaiju_stomp_pod');
        const podBase = getBaseDef('base_tokyo_pod');
        expect(resolveCardName(podCard, localeLookup(enLocale))).toBe('Stomp');
        expect(resolveCardText(podCard, localeLookup(enLocale))).toBe(resolveCardText(getCardDef('kaiju_stomp'), localeLookup(enLocale)));
        expect(resolveCardName(podCard, localeLookup(zhLocale))).toBe('践踏');
        expect(resolveCardText(podBase, localeLookup(zhLocale))).toBe(resolveCardText(getBaseDef('base_tokyo'), localeLookup(zhLocale)));
    });

    it('includes the Kaiju POD atlas in selection and active-match critical images', () => {
        const setup = smashUpCriticalImageResolver({ sys: { phase: 'factionSelection' }, core: {} }, undefined, '0');
        expect(setup.critical).toContain('smashup/cards/kaiju_pod');

        const playing = smashUpCriticalImageResolver({
            sys: { phase: 'playCards' },
            core: {
                players: {
                    '0': { factions: [SMASHUP_FACTION_IDS.KAIJU_POD, SMASHUP_FACTION_IDS.ALIENS] },
                },
            },
        }, undefined, '0');
        expect(playing.critical).toContain('smashup/cards/kaiju_pod');
        expect(playing.critical).toContain('smashup/base/baokemeng');
    });

    it('records the source and compressed atlas in both asset manifests', () => {
        const smashUpFiles = smashUpAssetManifest.files as Record<string, { variants: Record<string, { sha256: string; bytes: number }> }>;
        const rootFiles = rootAssetManifest.files as Record<string, { variants: Record<string, { sha256: string; bytes: number }> }>;

        expect(smashUpFiles['cards/kaiju_pod'].variants.png).toMatchObject({
            sha256: '887f27dde9579b9ba77e1c67653f9f29a2da33f76899cbbc479419ad52c901e3',
            bytes: 5928968,
        });
        expect(smashUpFiles['cards/compressed/kaiju_pod'].variants.webp).toMatchObject({
            sha256: 'f178424b2bb49012fb67ffa743fdad657e18cf1c3967b0965c7abe0e6a839df1',
            bytes: 1393084,
        });
        expect(rootFiles['zh-CN/smashup/cards/kaiju_pod'].variants.png).toEqual(
            smashUpFiles['cards/kaiju_pod'].variants.png,
        );
        expect(rootFiles['zh-CN/smashup/cards/compressed/kaiju_pod'].variants.webp).toEqual(
            smashUpFiles['cards/compressed/kaiju_pod'].variants.webp,
        );
    });
});
