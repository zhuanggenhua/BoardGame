import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { AVENGERS_CARDS } from '../data/factions/avengers';
import { AVENGERS_POD_CARDS } from '../data/factions/avengers_pod';
import { HYDRA_CARDS } from '../data/factions/hydra';
import { HYDRA_POD_CARDS } from '../data/factions/hydra_pod';
import { KREE_CARDS } from '../data/factions/kree';
import { KREE_POD_CARDS } from '../data/factions/kree_pod';
import { MASTERS_OF_EVIL_CARDS } from '../data/factions/masters_of_evil';
import { MASTERS_OF_EVIL_POD_CARDS } from '../data/factions/masters_of_evil_pod';
import { SHIELD_CARDS } from '../data/factions/shield';
import { SHIELD_POD_CARDS } from '../data/factions/shield_pod';
import { SINISTER_SIX_CARDS } from '../data/factions/sinister_six';
import { SINISTER_SIX_POD_CARDS } from '../data/factions/sinister_six_pod';
import { SPIDER_VERSE_CARDS } from '../data/factions/spider_verse';
import { SPIDER_VERSE_POD_CARDS } from '../data/factions/spider_verse_pod';
import { ULTIMATES_CARDS } from '../data/factions/ultimates';
import { ULTIMATES_POD_CARDS } from '../data/factions/ultimates_pod';
import { SMASHUP_ATLAS_DEFINITIONS, getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { getSmashUpVariantSurfaceRelation } from '../domain/variantBindings';
import type { CardDef } from '../domain/types';
import { FACTION_METADATA } from '../ui/factionMeta';

const MARVEL_WAVE_ONE_POD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/marvel_wave_one_pod.png';
const MARVEL_WAVE_ONE_POD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_wave_one_pod.webp';
const MARVEL_VILLAINS_POD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/marvel_villains_pod.png';
const MARVEL_VILLAINS_POD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/marvel_villains_pod.webp';

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

const POD_CASES = [
    {
        baseFactionId: SMASHUP_FACTION_IDS.AVENGERS,
        factionId: SMASHUP_FACTION_IDS.AVENGERS_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS,
        image: 'smashup/cards/marvel_wave_one_pod',
        uniqueCount: 18,
        firstIndex: 0,
        lastIndex: 17,
        baseCards: AVENGERS_CARDS,
        podCards: AVENGERS_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.SHIELD,
        factionId: SMASHUP_FACTION_IDS.SHIELD_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS,
        image: 'smashup/cards/marvel_wave_one_pod',
        uniqueCount: 12,
        firstIndex: 18,
        lastIndex: 29,
        baseCards: SHIELD_CARDS,
        podCards: SHIELD_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.SPIDER_VERSE,
        factionId: SMASHUP_FACTION_IDS.SPIDER_VERSE_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS,
        image: 'smashup/cards/marvel_wave_one_pod',
        uniqueCount: 12,
        firstIndex: 30,
        lastIndex: 41,
        baseCards: SPIDER_VERSE_CARDS,
        podCards: SPIDER_VERSE_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.ULTIMATES,
        factionId: SMASHUP_FACTION_IDS.ULTIMATES_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS,
        image: 'smashup/cards/marvel_wave_one_pod',
        uniqueCount: 12,
        firstIndex: 42,
        lastIndex: 53,
        baseCards: ULTIMATES_CARDS,
        podCards: ULTIMATES_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.HYDRA,
        factionId: SMASHUP_FACTION_IDS.HYDRA_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS,
        image: 'smashup/cards/marvel_villains_pod',
        uniqueCount: 11,
        firstIndex: 0,
        lastIndex: 10,
        baseCards: HYDRA_CARDS,
        podCards: HYDRA_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.KREE,
        factionId: SMASHUP_FACTION_IDS.KREE_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS,
        image: 'smashup/cards/marvel_villains_pod',
        uniqueCount: 12,
        firstIndex: 11,
        lastIndex: 22,
        baseCards: KREE_CARDS,
        podCards: KREE_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.MASTERS_OF_EVIL,
        factionId: SMASHUP_FACTION_IDS.MASTERS_OF_EVIL_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS,
        image: 'smashup/cards/marvel_villains_pod',
        uniqueCount: 12,
        firstIndex: 23,
        lastIndex: 34,
        baseCards: MASTERS_OF_EVIL_CARDS,
        podCards: MASTERS_OF_EVIL_POD_CARDS,
    },
    {
        baseFactionId: SMASHUP_FACTION_IDS.SINISTER_SIX,
        factionId: SMASHUP_FACTION_IDS.SINISTER_SIX_POD,
        atlasId: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS,
        image: 'smashup/cards/marvel_villains_pod',
        uniqueCount: 14,
        firstIndex: 35,
        lastIndex: 48,
        baseCards: SINISTER_SIX_CARDS,
        podCards: SINISTER_SIX_POD_CARDS,
    },
] as const;

const stripPodIdentity = (card: CardDef): Omit<CardDef, 'id' | 'faction' | 'previewRef'> => {
    const { id: _id, faction: _faction, previewRef: _previewRef, ...rest } = card;
    return rest;
};

describe('SmashUp 漫威 POD 资源合同', () => {
    it('两张 Marvel POD 卡图 atlas 已登记为 9 x 6 运行时入口', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS,
                kind: 'card',
                image: 'smashup/cards/marvel_wave_one_pod',
                grid: { rows: 6, cols: 9 },
            },
            {
                id: SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS,
                kind: 'card',
                image: 'smashup/cards/marvel_villains_pod',
                grid: { rows: 6, cols: 9 },
            },
        ]));
    });

    it('两张 Marvel POD 卡图已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expect(rootManifest.files['zh-CN/smashup/cards/marvel_wave_one_pod'].variants.png.sha256)
            .toBe(sha256(MARVEL_WAVE_ONE_POD_PNG));
        expect(rootManifest.files['zh-CN/smashup/cards/compressed/marvel_wave_one_pod'].variants.webp.sha256)
            .toBe(sha256(MARVEL_WAVE_ONE_POD_WEBP));
        expect(rootManifest.files['zh-CN/smashup/cards/marvel_villains_pod'].variants.png.sha256)
            .toBe(sha256(MARVEL_VILLAINS_POD_PNG));
        expect(rootManifest.files['zh-CN/smashup/cards/compressed/marvel_villains_pod'].variants.webp.sha256)
            .toBe(sha256(MARVEL_VILLAINS_POD_WEBP));

        expect(gameManifest.files['cards/marvel_wave_one_pod'].variants.png.sha256)
            .toBe(sha256(MARVEL_WAVE_ONE_POD_PNG));
        expect(gameManifest.files['cards/compressed/marvel_wave_one_pod'].variants.webp.sha256)
            .toBe(sha256(MARVEL_WAVE_ONE_POD_WEBP));
        expect(gameManifest.files['cards/marvel_villains_pod'].variants.png.sha256)
            .toBe(sha256(MARVEL_VILLAINS_POD_PNG));
        expect(gameManifest.files['cards/compressed/marvel_villains_pod'].variants.webp.sha256)
            .toBe(sha256(MARVEL_VILLAINS_POD_WEBP));
    });

    it('八个 Marvel POD 派系独立牌身份，玩法字段与经典版一致', () => {
        for (const entry of POD_CASES) {
            const cards = getFactionCards(entry.factionId);
            expect(cards, entry.factionId + ' unique cards').toHaveLength(entry.uniqueCount);
            expect(cards.reduce((sum, card) => sum + card.count, 0), entry.factionId + ' deck count').toBe(20);
            expect(cards[0]?.previewRef).toEqual({
                type: 'atlas',
                atlasId: entry.atlasId,
                index: entry.firstIndex,
            });
            expect(cards.at(-1)?.previewRef).toEqual({
                type: 'atlas',
                atlasId: entry.atlasId,
                index: entry.lastIndex,
            });
            expect(cards.every(card => card.id.endsWith('_pod'))).toBe(true);
            expect(cards.every(card => card.faction === entry.factionId)).toBe(true);
            expect(cards.map(stripPodIdentity)).toEqual(entry.baseCards.map(stripPodIdentity));
            expect(entry.podCards.map(stripPodIdentity)).toEqual(entry.baseCards.map(stripPodIdentity));
        }
    });

    it('八个 Marvel POD 派系共享玩法表面，并沿用经典 Marvel 当前基地池口径', () => {
        const surfaces = ['ability', 'interaction', 'ongoing', 'baseAbility', 'powerModifier'] as const;
        for (const entry of POD_CASES) {
            for (const surface of surfaces) {
                expect(getSmashUpVariantSurfaceRelation(surface, entry.baseFactionId, entry.factionId)).toBe('shared');
            }
            expect(getSmashUpVariantSurfaceRelation('basePool', entry.baseFactionId, entry.factionId)).toBe('shared');
            expect(getBaseDefIdsForFactions([entry.factionId]).sort()).toEqual(
                getBaseDefIdsForFactions([entry.baseFactionId]).sort(),
            );
        }
    });

    it('POD 图集进入目录和关键图片预加载', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.MARVEL_WAVE_ONE_POD_CARDS))
            .toBe('smashup/cards/marvel_wave_one_pod');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.MARVEL_VILLAINS_POD_CARDS))
            .toBe('smashup/cards/marvel_villains_pod');

        const resolved = smashUpCriticalImageResolver({
            sys: { phase: 'playCards' },
            core: {
                players: {
                    '0': { factions: [SMASHUP_FACTION_IDS.AVENGERS_POD, SMASHUP_FACTION_IDS.HYDRA_POD] },
                    '1': { factions: [SMASHUP_FACTION_IDS.SPIDER_VERSE_POD, SMASHUP_FACTION_IDS.SINISTER_SIX_POD] },
                },
            },
        }, undefined, '0');

        expect(resolved.critical).toContain('smashup/cards/marvel_wave_one_pod');
        expect(resolved.critical).toContain('smashup/cards/marvel_villains_pod');
    });

    it('经典漫威版本仅中文显示，POD 版本面向全部语言', () => {
        const metadataById = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        for (const entry of POD_CASES) {
            expect(metadataById.get(entry.baseFactionId)?.locales).toEqual(['zh-CN']);
            expect(metadataById.get(entry.factionId)?.locales).toBeUndefined();
        }
    });
});
