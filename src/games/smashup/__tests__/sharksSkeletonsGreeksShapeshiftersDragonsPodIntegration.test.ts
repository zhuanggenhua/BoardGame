import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getBaseDefIdsForFactions, getFactionCards, getFactionTitans } from '../data/cards';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
import { DRAGONS_POD_CARDS } from '../data/factions/dragons_pod';
import { MYTHIC_GREEKS_POD_CARDS } from '../data/factions/mythic_greeks_pod';
import { SHAPESHIFTERS_POD_CARDS } from '../data/factions/shapeshifters_pod';
import { SHARKS_POD_CARDS } from '../data/factions/sharks_pod';
import { SKELETONS_POD_CARDS } from '../data/factions/skeletons_pod';
import { getRegisteredAbilityKeys } from '../domain/abilityRegistry';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    getSmashUpVariantSurfaceRelation,
    type SmashUpVariantSurface,
} from '../domain/variantBindings';
import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { FACTION_METADATA } from '../ui/factionMeta';

const sharedSurfaces: SmashUpVariantSurface[] = [
    'ability',
    'interaction',
    'ongoing',
    'baseAbility',
    'powerModifier',
];

const POD_CASES = [
    {
        factionId: SMASHUP_FACTION_IDS.SHARKS_POD,
        baseFactionId: SMASHUP_FACTION_IDS.SHARKS,
        atlasId: SMASHUP_ATLAS_IDS.SHARKS_POD_CARDS,
        image: 'smashup/cards/sharks_pod',
        cards: SHARKS_POD_CARDS,
        logicalCount: 12,
        representativeFamilyId: 'sharks_torn_apart',
        abilityKey: 'sharks_torn_apart_pod::onPlay',
        baseIds: ['base_shark_reef_pod', 'base_the_deep_pod'],
    },
    {
        factionId: SMASHUP_FACTION_IDS.SKELETONS_POD,
        baseFactionId: SMASHUP_FACTION_IDS.SKELETONS,
        atlasId: SMASHUP_ATLAS_IDS.SKELETONS_POD_CARDS,
        image: 'smashup/cards/skeletons_pod',
        cards: SKELETONS_POD_CARDS,
        logicalCount: 12,
        representativeFamilyId: 'skeletons_returned_one',
        abilityKey: 'skeletons_returned_one_pod::onPlay',
        baseIds: ['base_boneyard_pod', 'base_ossuary_pod'],
    },
    {
        factionId: SMASHUP_FACTION_IDS.MYTHIC_GREEKS_POD,
        baseFactionId: SMASHUP_FACTION_IDS.MYTHIC_GREEKS,
        atlasId: SMASHUP_ATLAS_IDS.MYTHIC_GREEKS_POD_CARDS,
        image: 'smashup/cards/mythic_greeks_pod',
        cards: MYTHIC_GREEKS_POD_CARDS,
        logicalCount: 15,
        representativeFamilyId: 'mythic_greeks_favor_of_hades',
        abilityKey: 'mythic_greeks_favor_of_hades_pod::onPlay',
        baseIds: ['base_oracle_at_delphi_pod', 'base_wooden_horse_pod'],
    },
    {
        factionId: SMASHUP_FACTION_IDS.SHAPESHIFTERS_POD,
        baseFactionId: SMASHUP_FACTION_IDS.SHAPESHIFTERS,
        atlasId: SMASHUP_ATLAS_IDS.SHAPESHIFTERS_POD_CARDS,
        image: 'smashup/cards/shapeshifters_pod',
        cards: SHAPESHIFTERS_POD_CARDS,
        logicalCount: 12,
        representativeFamilyId: 'shapeshifters_transmogrify',
        abilityKey: 'shapeshifters_transmogrify_pod::onPlay',
        baseIds: ['base_faceless_city_pod', 'base_the_vats_pod'],
    },
    {
        factionId: SMASHUP_FACTION_IDS.DRAGONS_POD,
        baseFactionId: SMASHUP_FACTION_IDS.DRAGONS,
        atlasId: SMASHUP_ATLAS_IDS.DRAGONS_POD_CARDS,
        image: 'smashup/cards/dragons_pod',
        cards: DRAGONS_POD_CARDS,
        logicalCount: 12,
        representativeFamilyId: 'dragons_burn_it_down',
        abilityKey: 'dragons_burn_it_down_pod::onPlay',
        baseIds: ['base_dragons_lair_pod', 'base_wyrms_desolation_pod'],
    },
] as const;

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

function physicalCardCount(cards: ReadonlyArray<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function slotMap(cards: ReadonlyArray<{ id: string; previewRef?: { type: string; index?: number } }>) {
    return Object.fromEntries(cards.map(card => [
        card.id,
        card.previewRef?.type === 'atlas' ? card.previewRef.index : -1,
    ]));
}

describe('鲨鱼、骷髅、希腊神话、变形者与龙 POD 接入', () => {
    it('五个 POD 派系均注册为独立的 20 张物理牌组', () => {
        for (const entry of POD_CASES) {
            expect(entry.cards).toHaveLength(entry.logicalCount);
            expect(physicalCardCount(entry.cards)).toBe(20);
            expect(getFactionCards(entry.factionId)).toHaveLength(entry.logicalCount);
        }
    });

    it('按用户提供的 4x5 卡图锁定关键槽位', () => {
        expect(slotMap(SHARKS_POD_CARDS)).toMatchObject({
            sharks_blood_in_the_water_pod: 0,
            sharks_torn_apart_pod: 2,
            sharks_mako_pod: 10,
            sharks_megalodon_pod: 19,
        });
        expect(slotMap(SKELETONS_POD_CARDS)).toMatchObject({
            skeletons_spooky_scary_pod: 0,
            skeletons_place_em_down_pod: 4,
            skeletons_returned_one_pod: 10,
            skeletons_lord_of_bones_pod: 19,
        });
        expect(slotMap(MYTHIC_GREEKS_POD_CARDS)).toMatchObject({
            mythic_greeks_favor_of_hades_pod: 0,
            mythic_greeks_favor_of_poseidon_pod: 9,
            mythic_greeks_argonaut_pod: 10,
            mythic_greeks_odysseus_pod: 19,
        });
        expect(slotMap(SHAPESHIFTERS_POD_CARDS)).toMatchObject({
            shapeshifters_transmogrify_pod: 0,
            shapeshifters_bacta_the_future_pod: 9,
            shapeshifters_copycat_pod: 10,
            shapeshifters_doppelganger_pod: 19,
        });
        expect(slotMap(DRAGONS_POD_CARDS)).toMatchObject({
            dragons_burn_it_down_pod: 0,
            dragons_bring_down_the_walls_pod: 8,
            dragons_hatchling_pod: 10,
            dragons_great_wyrm_pod: 19,
        });
    });

    it('使用独立 POD 基地身份并复用基础版基地图片', () => {
        for (const entry of POD_CASES) {
            expect(getBaseDefIdsForFactions([entry.factionId]).sort()).toEqual([...entry.baseIds].sort());
        }

        const englishMap = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;
        expect(englishMap.base_boneyard_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE6, index: 2 });
        expect(englishMap.base_shark_reef_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE7, index: 2 });
        expect(englishMap.base_oracle_at_delphi_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE7, index: 5 });
        expect(englishMap.base_the_vats_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE9, index: 4 });
        expect(englishMap.base_dragons_lair_pod).toEqual({ atlasId: SMASHUP_ATLAS_IDS.BASE7, index: 4 });
    });

    it('显式共享能力表面并生成 POD 能力注册键', () => {
        for (const entry of POD_CASES) {
            for (const surface of sharedSurfaces) {
                expect(getSmashUpVariantSurfaceRelation(
                    surface,
                    entry.representativeFamilyId,
                    entry.factionId,
                )).toBe('shared');
            }
            expect(getSmashUpVariantSurfaceRelation(
                'basePool',
                entry.representativeFamilyId,
                entry.factionId,
            )).toBe('separate');
        }

        const abilityKeys = getRegisteredAbilityKeys();
        for (const entry of POD_CASES) {
            expect(abilityKeys.has(entry.abilityKey)).toBe(true);
        }
    });

    it('五张 POD 图集进入图集目录和关键图片预加载', () => {
        for (const entry of POD_CASES) {
            expect(getSmashUpAtlasImageById(entry.atlasId)).toBe(entry.image);
        }

        const resolved = smashUpCriticalImageResolver({
            sys: { phase: 'playCards' },
            core: {
                players: {
                    '0': { factions: [SMASHUP_FACTION_IDS.SHARKS_POD, SMASHUP_FACTION_IDS.SKELETONS_POD] },
                    '1': { factions: [SMASHUP_FACTION_IDS.MYTHIC_GREEKS_POD, SMASHUP_FACTION_IDS.SHAPESHIFTERS_POD] },
                    '2': { factions: [SMASHUP_FACTION_IDS.DRAGONS_POD, SMASHUP_FACTION_IDS.SHARKS_POD] },
                },
            },
        }, undefined, '0');

        for (const entry of POD_CASES) {
            expect(resolved.critical).toContain(entry.image);
        }
    });

    it('经典版本仅中文显示，POD 版本面向全部语言', () => {
        const metadataById = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        for (const entry of POD_CASES) {
            expect(metadataById.get(entry.baseFactionId)?.locales).toEqual(['zh-CN']);
            expect(metadataById.get(entry.factionId)?.locales).toBeUndefined();
        }
    });

    it('鲨鱼 POD 复用旋齿鲨泰坦而不复制对象', () => {
        expect(getFactionTitans(SMASHUP_FACTION_IDS.SHARKS_POD).map(titan => titan.id)).toEqual([
            'sharks_helicoprion',
        ]);
    });
});
