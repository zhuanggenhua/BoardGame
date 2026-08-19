import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
    ADOLESCENT_EPIC_GECKOS_CARDS,
    GI_GERALD_CARDS,
    HALF_THE_BATTLE_BASES,
    HALF_THE_BATTLE_CARDS,
    PEARL_AND_THE_IMAGES_CARDS,
    RULERS_OF_THE_COSMOS_CARDS,
} from '../data/factions/half_the_battle';
import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
} from '../data/cards';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import {
    isSmashUpFactionImplementationInProgress,
    SMASHUP_ATLAS_IDS,
    SMASHUP_FACTION_IDS,
} from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { getVisibleFactionMetadata, isFactionImplementationInProgress } from '../ui/factionMeta';

const CARD_ASSETS = [
    'half_the_battle_geckos',
    'half_the_battle_gerald',
    'half_the_battle_cosmos',
    'half_the_battle_pearl_images',
] as const;
const BASE_ASSET = 'half_the_battle_bases';
const CARD_ATLAS_DIMENSIONS = { width: 4320, height: 4864 };
const BASE_ATLAS_DIMENSIONS = { width: 4864, height: 1728 };
const ENGLISH_GECKOS_ASSET = 'half_the_battle_geckos';
const ENGLISH_GECKOS_ATLAS_DIMENSIONS = { width: 1876, height: 2100 };
const ENGLISH_GECKOS_PNG_SHA256 = '071489bdcf5675347c52354acf3cf0eb00eac8c170ef2dba458e85a51fcbd19e';
const ENGLISH_GECKOS_WEBP_SHA256 = '2e7b19c01ae4ad5f30fcb40ce571ad6930221f3457b09c1147541d1efaea9edd';

type HalfTheBattleFactionCase = {
    factionId: string;
    cards: readonly CardDef[];
    expectedUniqueCards: number;
    expectedAtlasId: string;
    expectedCardIndexes: Record<string, number>;
    expectedBases: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }>;
};

const HALF_THE_BATTLE_FACTIONS: HalfTheBattleFactionCase[] = [
    {
        factionId: SMASHUP_FACTION_IDS.ADOLESCENT_EPIC_GECKOS,
        cards: ADOLESCENT_EPIC_GECKOS_CARDS,
        expectedUniqueCards: 14,
        expectedAtlasId: SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GECKOS_CARDS,
        expectedCardIndexes: {
            geckos_hokusai: 0,
            geckos_kandinsky: 1,
            geckos_monet: 2,
            geckos_van_gogh: 3,
            geckos_june: 4,
            geckos_breaking_news: 8,
            geckos_flip_kick: 9,
            geckos_gecko_blimp: 10,
            geckos_gecko_power: 11,
            geckos_gecko_rap: 12,
            geckos_lasagna_party: 13,
            geckos_now_you_know_bullying: 15,
            geckos_masters_teachings: 16,
            geckos_kc_smith: 18,
        },
        expectedBases: {
            base_sewer_hideout: { index: 0, breakpoint: 21, vpAwards: [4, 2, 1] },
            base_technoball: { index: 1, breakpoint: 22, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.GI_GERALD,
        cards: GI_GERALD_CARDS,
        expectedUniqueCards: 12,
        expectedAtlasId: SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GERALD_CARDS,
        expectedCardIndexes: {
            gi_gerald_viscount: 0,
            gi_gerald_go_gerald: 1,
            gi_gerald_now_you_know_home_safety: 2,
            gi_gerald_mowat: 3,
            gi_gerald_obstruction: 4,
            gi_gerald_sawbones: 5,
            gi_gerald_ski_lift: 6,
            gi_gerald_can_do: 7,
            gi_gerald_mabel_lean: 9,
            gi_gerald_shellback: 11,
            gi_gerald_dice_ninja: 13,
            gi_gerald_rosie: 16,
        },
        expectedBases: {
            base_gi_geralds_base: { index: 2, breakpoint: 22, vpAwards: [5, 3, 2] },
            base_uss_banner: { index: 3, breakpoint: 20, vpAwards: [4, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.RULERS_OF_THE_COSMOS,
        cards: RULERS_OF_THE_COSMOS_CARDS,
        expectedUniqueCards: 15,
        expectedAtlasId: SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_COSMOS_CARDS,
        expectedCardIndexes: {
            rulers_cosmos_gal_woman: 0,
            rulers_cosmos_guy_man: 1,
            rulers_cosmos_andko: 2,
            rulers_cosmos_man_with_arms: 4,
            rulers_cosmos_frogga: 6,
            rulers_cosmos_young_noble: 8,
            rulers_cosmos_armor_of_battle: 10,
            rulers_cosmos_dolts_halfwits_fools_morons: 11,
            rulers_cosmos_fearless_friend: 12,
            rulers_cosmos_magic_weapon: 14,
            rulers_cosmos_myaaah: 15,
            rulers_cosmos_mystic_transference: 16,
            rulers_cosmos_now_you_know_toxic_waste: 17,
            rulers_cosmos_powerful_sword: 18,
            rulers_cosmos_sword_thats_powerful: 19,
        },
        expectedBases: {
            base_power_castle: { index: 4, breakpoint: 20, vpAwards: [4, 2, 1] },
            base_slime_pool: { index: 5, breakpoint: 20, vpAwards: [3, 2, 1] },
        },
    },
    {
        factionId: SMASHUP_FACTION_IDS.PEARL_AND_THE_IMAGES,
        cards: PEARL_AND_THE_IMAGES_CARDS,
        expectedUniqueCards: 12,
        expectedAtlasId: SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_PEARL_IMAGES_CARDS,
        expectedCardIndexes: {
            pearl_images_pearl: 0,
            pearl_images_crystal: 1,
            pearl_images_ruby: 3,
            pearl_images_topaz: 6,
            pearl_images_alls_right_with_the_world: 10,
            pearl_images_dressing_room: 11,
            pearl_images_jam_all_night_long: 12,
            pearl_images_love_unites_us: 14,
            pearl_images_now_you_know_bike_safety: 15,
            pearl_images_shes_got_the_power: 16,
            pearl_images_truly_outstanding: 18,
            pearl_images_were_up_youre_down: 19,
        },
        expectedBases: {
            base_concert_venue: { index: 6, breakpoint: 20, vpAwards: [3, 1, 1] },
            base_recording_studio: { index: 7, breakpoint: 23, vpAwards: [4, 2, 1] },
        },
    },
];

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const physicalCardCount = (cards: readonly { count: number }[]) =>
    cards.reduce((total, card) => total + card.count, 0);
const imageDimensions = async (path: string) => {
    const metadata = await sharp(path).metadata();
    return { width: metadata.width, height: metadata.height };
};

function cardAtlasIndex(card: CardDef): number {
    return card.previewRef?.type === 'atlas' ? card.previewRef.index : -1;
}

function assertBasePreview(
    def: BaseCardDef,
    expected: { index: number; breakpoint: number; vpAwards: [number, number, number] },
): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_BASES,
        index: expected.index,
    });
    expect(def.breakpoint).toBe(expected.breakpoint);
    expect(def.vpAwards).toEqual(expected.vpAwards);
}

describe('半场战争扩四派系 intake 静态合同', () => {
    it.each(HALF_THE_BATTLE_FACTIONS)('$factionId 卡牌数量、拷贝数与卡图索引正确', (fixture) => {
        const registered = getFactionCards(fixture.factionId);

        expect(fixture.cards).toHaveLength(fixture.expectedUniqueCards);
        expect(registered.map(card => card.id).sort()).toEqual(fixture.cards.map(card => card.id).sort());
        expect(physicalCardCount(fixture.cards), `${fixture.factionId} physical cards`).toBe(20);

        for (const [defId, index] of Object.entries(fixture.expectedCardIndexes)) {
            const def = fixture.cards.find(card => card.id === defId);
            expect(def, `${defId} 应已注册`).toBeDefined();
            expect(def?.previewRef).toEqual({
                type: 'atlas',
                atlasId: fixture.expectedAtlasId,
                index,
            });
            expect(cardAtlasIndex(def as CardDef), `${defId} atlas index`).toBe(index);
        }
    });

    it.each(HALF_THE_BATTLE_FACTIONS)('$factionId 基地数量、数值与半场战争基地图集索引正确', (fixture) => {
        expect(getBaseDefIdsForFactions([fixture.factionId]).sort())
            .toEqual(Object.keys(fixture.expectedBases).sort());

        for (const [baseId, expected] of Object.entries(fixture.expectedBases)) {
            const def = getBaseDef(baseId);
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(fixture.factionId);
            assertBasePreview(def as BaseCardDef, expected);
        }
    });

    it('四个派系 atlas 路径与共享 base atlas 已注册', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GECKOS_CARDS))
            .toBe('smashup/cards/half_the_battle_geckos');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GERALD_CARDS))
            .toBe('smashup/cards/half_the_battle_gerald');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_COSMOS_CARDS))
            .toBe('smashup/cards/half_the_battle_cosmos');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_PEARL_IMAGES_CARDS))
            .toBe('smashup/cards/half_the_battle_pearl_images');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_BASES))
            .toBe('smashup/base/half_the_battle_bases');
    });

    it('四个派系可见，但因 L3/L4 与远端资源 evidence 未完整保持实施中', () => {
        const visibleIds = new Set(getVisibleFactionMetadata('zh-CN').map(meta => meta.id));

        for (const fixture of HALF_THE_BATTLE_FACTIONS) {
            expect(visibleIds.has(fixture.factionId), `${fixture.factionId} 应在 zh-CN 可见`).toBe(true);
            expect(isSmashUpFactionImplementationInProgress(fixture.factionId)).toBe(true);
            expect(isFactionImplementationInProgress(fixture.factionId)).toBe(true);
        }
    });

    it('中英文 locale 已覆盖新增派系、卡牌与基地', () => {
        const zhCN = JSON.parse(readFileSync('public/locales/zh-CN/game-smashup.json', 'utf8'));
        const en = JSON.parse(readFileSync('public/locales/en/game-smashup.json', 'utf8'));

        for (const fixture of HALF_THE_BATTLE_FACTIONS) {
            expect(typeof zhCN.factions?.[fixture.factionId]?.name, `${fixture.factionId} zh name`).toBe('string');
            expect(typeof zhCN.factions?.[fixture.factionId]?.description, `${fixture.factionId} zh desc`).toBe('string');
            expect(typeof en.factions?.[fixture.factionId]?.name, `${fixture.factionId} en name`).toBe('string');
            expect(typeof en.factions?.[fixture.factionId]?.description, `${fixture.factionId} en desc`).toBe('string');
        }

        for (const card of HALF_THE_BATTLE_CARDS) {
            expect(typeof zhCN.cards?.[card.id]?.name, `${card.id} zh name`).toBe('string');
            expect(typeof en.cards?.[card.id]?.name, `${card.id} en name`).toBe('string');
            const textKey = card.type === 'action' ? 'effectText' : 'abilityText';
            expect(typeof zhCN.cards?.[card.id]?.[textKey], `${card.id} zh text`).toBe('string');
            expect(typeof en.cards?.[card.id]?.[textKey], `${card.id} en text`).toBe('string');
            expect(zhCN.cards[card.id][textKey].trim().length, `${card.id} zh text length`).toBeGreaterThan(0);
            expect(en.cards[card.id][textKey].trim().length, `${card.id} en text length`).toBeGreaterThan(0);
            expect(zhCN.cards[card.id][textKey]).not.toMatch(/TODO|待补|pending/i);
            expect(en.cards[card.id][textKey]).not.toMatch(/TODO|待补|pending/i);
        }

        for (const base of HALF_THE_BATTLE_BASES) {
            expect(typeof zhCN.cards?.[base.id]?.name, `${base.id} zh name`).toBe('string');
            expect(typeof zhCN.cards?.[base.id]?.abilityText, `${base.id} zh ability`).toBe('string');
            expect(typeof en.cards?.[base.id]?.name, `${base.id} en name`).toBe('string');
            expect(typeof en.cards?.[base.id]?.abilityText, `${base.id} en ability`).toBe('string');
        }

        expect(en.cards.geckos_monet.abilityText)
            .toBe('Draw a card. Ongoing: Any time you can play an action, you may instead draw a card and trigger all abilities as though you had played an action.');
        expect(zhCN.cards.base_uss_banner.abilityText)
            .toBe('在你的回合，你可以在这里额外打出一个战力 2 或以下的随从。如果回合结束时你控制它，将其置于你的牌库顶。');
    });

    it('半场战争扩 runtime WebP 已进入 manifest，但源 PNG 缺失仍保持实施中', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expect(rootManifest.basePrefix).toBe('official/i18n/');
        expect(gameManifest.basePrefix).toBe('official/i18n/zh-CN/smashup/');

        for (const asset of CARD_ASSETS) {
            const pngPath = `public/assets/i18n/zh-CN/smashup/cards/${asset}.png`;
            const webpPath = `public/assets/i18n/zh-CN/smashup/cards/compressed/${asset}.webp`;

            expect(rootManifest.files[`zh-CN/smashup/cards/compressed/${asset}`].variants.webp.sha256)
                .toBe(sha256(webpPath));
            expect(gameManifest.files[`cards/compressed/${asset}`].variants.webp.sha256)
                .toBe(sha256(webpPath));
            expect(rootManifest.files[`zh-CN/smashup/cards/${asset}`].variants.png.sha256)
                .toBeTypeOf('string');
            expect(gameManifest.files[`cards/${asset}`].variants.png.sha256)
                .toBeTypeOf('string');
            expect(existsSync(pngPath), `${asset}.png 仍缺本地源图`).toBe(false);
        }

        const basePngPath = `public/assets/i18n/zh-CN/smashup/base/${BASE_ASSET}.png`;
        const baseWebpPath = `public/assets/i18n/zh-CN/smashup/base/compressed/${BASE_ASSET}.webp`;

        expect(rootManifest.files[`zh-CN/smashup/base/compressed/${BASE_ASSET}`].variants.webp.sha256)
            .toBe(sha256(baseWebpPath));
        expect(gameManifest.files[`base/compressed/${BASE_ASSET}`].variants.webp.sha256)
            .toBe(sha256(baseWebpPath));
        expect(rootManifest.files[`zh-CN/smashup/base/${BASE_ASSET}`].variants.png.sha256)
            .toBeTypeOf('string');
        expect(gameManifest.files[`base/${BASE_ASSET}`].variants.png.sha256)
            .toBeTypeOf('string');
        expect(existsSync(basePngPath), `${BASE_ASSET}.png 仍缺本地源图`).toBe(false);

        for (const fixture of HALF_THE_BATTLE_FACTIONS) {
            expect(isSmashUpFactionImplementationInProgress(fixture.factionId)).toBe(true);
        }
    });

    it('Geckos POD 英文源图与 runtime 图集已进入 en 资源合同', async () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/en/smashup/assets-manifest.json', 'utf8'));
        const pngPath = `public/assets/i18n/en/smashup/cards/${ENGLISH_GECKOS_ASSET}.png`;
        const webpPath = `public/assets/i18n/en/smashup/cards/compressed/${ENGLISH_GECKOS_ASSET}.webp`;

        expect(rootManifest.basePrefix).toBe('official/i18n/');
        expect(gameManifest.basePrefix).toBe('official/i18n/en/smashup/');
        expect(sha256(pngPath)).toBe(ENGLISH_GECKOS_PNG_SHA256);
        expect(sha256(webpPath)).toBe(ENGLISH_GECKOS_WEBP_SHA256);
        expect(rootManifest.files[`en/smashup/cards/${ENGLISH_GECKOS_ASSET}`].variants.png.sha256)
            .toBe(ENGLISH_GECKOS_PNG_SHA256);
        expect(rootManifest.files[`en/smashup/cards/compressed/${ENGLISH_GECKOS_ASSET}`].variants.webp.sha256)
            .toBe(ENGLISH_GECKOS_WEBP_SHA256);
        expect(gameManifest.files[`cards/${ENGLISH_GECKOS_ASSET}`].variants.png.sha256)
            .toBe(ENGLISH_GECKOS_PNG_SHA256);
        expect(gameManifest.files[`cards/compressed/${ENGLISH_GECKOS_ASSET}`].variants.webp.sha256)
            .toBe(ENGLISH_GECKOS_WEBP_SHA256);
        expect(await imageDimensions(pngPath)).toEqual(ENGLISH_GECKOS_ATLAS_DIMENSIONS);
        expect(await imageDimensions(webpPath)).toEqual(ENGLISH_GECKOS_ATLAS_DIMENSIONS);
    });

    it('半场战争扩 runtime WebP 保持目标尺寸，源 PNG 仍是待补图件', async () => {
        for (const asset of CARD_ASSETS) {
            const pngPath = `public/assets/i18n/zh-CN/smashup/cards/${asset}.png`;
            const webpPath = `public/assets/i18n/zh-CN/smashup/cards/compressed/${asset}.webp`;

            expect(existsSync(pngPath), `${asset}.png 仍缺本地源图`).toBe(false);
            expect(await imageDimensions(webpPath), `${asset}.webp dimensions`).toEqual(CARD_ATLAS_DIMENSIONS);
        }

        const basePngPath = `public/assets/i18n/zh-CN/smashup/base/${BASE_ASSET}.png`;
        const baseWebpPath = `public/assets/i18n/zh-CN/smashup/base/compressed/${BASE_ASSET}.webp`;

        expect(existsSync(basePngPath), `${BASE_ASSET}.png 仍缺本地源图`).toBe(false);
        expect(await imageDimensions(baseWebpPath), `${BASE_ASSET}.webp dimensions`).toEqual(BASE_ATLAS_DIMENSIONS);
    });
});
