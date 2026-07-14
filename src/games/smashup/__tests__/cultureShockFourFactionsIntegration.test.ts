import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { ANANSI_TALES_BASES, ANANSI_TALES_CARDS } from '../data/factions/anansi_tales';
import { GRIMMS_FAIRY_TALES_BASES, GRIMMS_FAIRY_TALES_CARDS } from '../data/factions/grimms_fairy_tales';
import { RUSSIAN_FAIRY_TALES_BASES, RUSSIAN_FAIRY_TALES_CARDS } from '../data/factions/russian_fairy_tales';
import { ANCIENT_INCAS_BASES, ANCIENT_INCAS_CARDS } from '../data/factions/ancient_incas';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { FACTION_METADATA } from '../ui/factionMeta';

const CULTURE_SHOCK_CARD_ATLAS_PATH = 'public/assets/i18n/zh-CN/smashup/cards/culture_shock/atlas.png';
const CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_PATH = 'public/assets/i18n/zh-CN/smashup/cards/culture_shock/compressed/atlas.webp';
const CULTURE_SHOCK_BASE_ATLAS_PATH = 'public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/atlas.png';
const CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_PATH = 'public/assets/i18n/zh-CN/smashup/base/polynesian_voyagers/compressed/atlas.webp';
const CULTURE_SHOCK_CARD_ATLAS_SHA256 = '5ca8838ed9c57f1a53c2c864837e56d2279ece101e1fe39e74be74828b61f08e';
const CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_SHA256 = 'd01093a8789e0f49a97071afe6ea8992308bc54ce679993191066612c6d97c7a';
const CULTURE_SHOCK_BASE_ATLAS_SHA256 = '253dda49b347392e8657fdb2cda21a7b6ea4cfa667421e44b821d38756c6e0be';
const CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_SHA256 = '31f4179b388ed1063b20c65f9cb6c5eeb95474b352321fac756939712fa468b0';

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function readJson(path: string): any {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('文化冲击四派系静态接入', () => {
    it('四派系注册为 20 张实体牌并保持唯一卡面数量', () => {
        expect(ANANSI_TALES_CARDS).toHaveLength(13);
        expect(GRIMMS_FAIRY_TALES_CARDS).toHaveLength(18);
        expect(RUSSIAN_FAIRY_TALES_CARDS).toHaveLength(16);
        expect(ANCIENT_INCAS_CARDS).toHaveLength(12);

        expect(physicalCardCount(ANANSI_TALES_CARDS)).toBe(20);
        expect(physicalCardCount(GRIMMS_FAIRY_TALES_CARDS)).toBe(20);
        expect(physicalCardCount(RUSSIAN_FAIRY_TALES_CARDS)).toBe(20);
        expect(physicalCardCount(ANCIENT_INCAS_CARDS)).toBe(20);

        expect(getFactionCards(SMASHUP_FACTION_IDS.ANANSI_TALES)).toHaveLength(13);
        expect(getFactionCards(SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES)).toHaveLength(18);
        expect(getFactionCards(SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES)).toHaveLength(16);
        expect(getFactionCards(SMASHUP_FACTION_IDS.ANCIENT_INCAS)).toHaveLength(12);
    });

    it('四派系卡图槽位覆盖文化冲击 atlas 的 0-58，且不注册标识格 59', () => {
        const slots = [
            ...ANANSI_TALES_CARDS,
            ...GRIMMS_FAIRY_TALES_CARDS,
            ...RUSSIAN_FAIRY_TALES_CARDS,
            ...ANCIENT_INCAS_CARDS,
        ]
            .map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1)
            .sort((left, right) => left - right);

        expect(slots).toEqual(Array.from({ length: 59 }, (_value, index) => index));
        expect(slots).not.toContain(59);
        expect(new Set(slots).size).toBe(59);
    });

    it('八张基地复用唯一文化冲击基地 atlas', () => {
        const baseIds = [
            ...ANANSI_TALES_BASES,
            ...GRIMMS_FAIRY_TALES_BASES,
            ...RUSSIAN_FAIRY_TALES_BASES,
            ...ANCIENT_INCAS_BASES,
        ].map(base => base.id).sort();

        expect(baseIds).toEqual([
            'base_anansis_web',
            'base_cuzcu',
            'base_giant_turnip',
            'base_gingerbread_house',
            'base_machu_picchu',
            'base_storytellers_hut',
            'base_transformation_spring',
            'base_woodland_cottage',
        ]);
        for (const factionId of [
            SMASHUP_FACTION_IDS.ANANSI_TALES,
            SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES,
            SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES,
            SMASHUP_FACTION_IDS.ANCIENT_INCAS,
        ]) {
            expect(getBaseDefIdsForFactions([factionId])).toHaveLength(2);
        }

        const atlasIds = new Set([
            ...ANANSI_TALES_BASES,
            ...GRIMMS_FAIRY_TALES_BASES,
            ...RUSSIAN_FAIRY_TALES_BASES,
            ...ANCIENT_INCAS_BASES,
        ].map(base => base.previewRef?.type === 'atlas' ? base.previewRef.atlasId : null));
        expect(atlasIds).toEqual(new Set([SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES]));
    });

    it('注册卡牌 atlas 与派系选择元数据', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.CULTURE_SHOCK_CARDS)).toBe('smashup/cards/culture_shock/atlas');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.POLYNESIAN_VOYAGERS_BASES)).toBe('smashup/base/polynesian_voyagers/atlas');

        const byId = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        expect(byId.get(SMASHUP_FACTION_IDS.ANANSI_TALES)?.nameKey).toBe('factions.anansi_tales.name');
        expect(byId.get(SMASHUP_FACTION_IDS.GRIMMS_FAIRY_TALES)?.nameKey).toBe('factions.grimms_fairy_tales.name');
        expect(byId.get(SMASHUP_FACTION_IDS.RUSSIAN_FAIRY_TALES)?.nameKey).toBe('factions.russian_fairy_tales.name');
        expect(byId.get(SMASHUP_FACTION_IDS.ANCIENT_INCAS)?.nameKey).toBe('factions.ancient_incas.name');
    });

    it('文化冲击卡牌与基地 atlas 已进入根级与游戏级资源清单', () => {
        expect(sha256(CULTURE_SHOCK_CARD_ATLAS_PATH)).toBe(CULTURE_SHOCK_CARD_ATLAS_SHA256);
        expect(sha256(CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_PATH)).toBe(CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_SHA256);
        expect(sha256(CULTURE_SHOCK_BASE_ATLAS_PATH)).toBe(CULTURE_SHOCK_BASE_ATLAS_SHA256);
        expect(sha256(CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_PATH)).toBe(CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_SHA256);

        const rootManifest = readJson('public/assets/i18n/assets-manifest.json');
        const gameManifest = readJson('public/assets/i18n/zh-CN/smashup/assets-manifest.json');

        expect(rootManifest.files['zh-CN/smashup/cards/culture_shock/atlas']?.variants?.png?.sha256).toBe(CULTURE_SHOCK_CARD_ATLAS_SHA256);
        expect(rootManifest.files['zh-CN/smashup/cards/culture_shock/compressed/atlas']?.variants?.webp?.sha256)
            .toBe(CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_SHA256);
        expect(rootManifest.files['zh-CN/smashup/base/polynesian_voyagers/atlas']?.variants?.png?.sha256).toBe(CULTURE_SHOCK_BASE_ATLAS_SHA256);
        expect(rootManifest.files['zh-CN/smashup/base/polynesian_voyagers/compressed/atlas']?.variants?.webp?.sha256)
            .toBe(CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_SHA256);
        expect(gameManifest.files['cards/culture_shock/atlas']?.variants?.png?.sha256).toBe(CULTURE_SHOCK_CARD_ATLAS_SHA256);
        expect(gameManifest.files['cards/culture_shock/compressed/atlas']?.variants?.webp?.sha256)
            .toBe(CULTURE_SHOCK_COMPRESSED_CARD_ATLAS_SHA256);
        expect(gameManifest.files['base/polynesian_voyagers/atlas']?.variants?.png?.sha256).toBe(CULTURE_SHOCK_BASE_ATLAS_SHA256);
        expect(gameManifest.files['base/polynesian_voyagers/compressed/atlas']?.variants?.webp?.sha256)
            .toBe(CULTURE_SHOCK_COMPRESSED_BASE_ATLAS_SHA256);
    });

    it('四派系新增卡牌、基地和派系名称均有定向双语 locale', () => {
        const localePaths = [
            'public/locales/en/game-smashup.json',
            'public/locales/zh-CN/game-smashup.json',
        ];
        const factions = [
            'anansi_tales',
            'grimms_fairy_tales',
            'russian_fairy_tales',
            'ancient_incas',
        ];
        const cardIds = [
            ...ANANSI_TALES_CARDS,
            ...GRIMMS_FAIRY_TALES_CARDS,
            ...RUSSIAN_FAIRY_TALES_CARDS,
            ...ANCIENT_INCAS_CARDS,
        ].map(card => card.id);
        const baseIds = [
            ...ANANSI_TALES_BASES,
            ...GRIMMS_FAIRY_TALES_BASES,
            ...RUSSIAN_FAIRY_TALES_BASES,
            ...ANCIENT_INCAS_BASES,
        ].map(base => base.id);

        for (const localePath of localePaths) {
            const locale = readJson(localePath);
            for (const factionId of factions) {
                expect(locale.factions?.[factionId]?.name, `${localePath} missing ${factionId}`).toEqual(expect.any(String));
            }
            for (const cardId of cardIds) {
                const entry = locale.cards?.[cardId];
                expect(entry?.name, `${localePath} missing ${cardId}.name`).toEqual(expect.any(String));
                expect(entry?.abilityText ?? entry?.effectText, `${localePath} missing ${cardId} text`).toEqual(expect.any(String));
            }
            for (const baseId of baseIds) {
                const entry = locale.cards?.[baseId];
                expect(entry?.name, `${localePath} missing ${baseId}.name`).toEqual(expect.any(String));
                expect(entry?.abilityText ?? entry?.effectText, `${localePath} missing ${baseId} text`).toEqual(expect.any(String));
            }
        }
    });
});
