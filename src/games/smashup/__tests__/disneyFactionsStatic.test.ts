import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { ALADDIN_BASES, ALADDIN_CARDS } from '../data/factions/aladdin';
import { BEAUTY_AND_THE_BEAST_BASES, BEAUTY_AND_THE_BEAST_CARDS } from '../data/factions/beauty_and_the_beast';
import { NIGHTMARE_BEFORE_CHRISTMAS_BASES, NIGHTMARE_BEFORE_CHRISTMAS_CARDS } from '../data/factions/nightmare_before_christmas';
import { WRECK_IT_RALPH_BASES, WRECK_IT_RALPH_CARDS } from '../data/factions/wreck_it_ralph';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { FACTION_METADATA } from '../ui/factionMeta';
import { expectManifestAssetHash } from './helpers/assetManifestTestUtils';

const CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/disney.png';
const CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/disney.webp';
const BASE_JPG = 'public/assets/i18n/zh-CN/smashup/base/disney_bases.jpg';
const BASE_WEBP = 'public/assets/i18n/zh-CN/smashup/base/compressed/disney_bases.webp';
const PLACEHOLDER_RULE_TEXT = /TODO|pending|Card rules pending|牌面规则|待补/i;

function physicalCardCount(cards: ReadonlyArray<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function slotMap(cards: ReadonlyArray<{ id: string; previewRef?: { type: string; index?: number } }>) {
    return Object.fromEntries(cards.map(card => [
        card.id,
        card.previewRef?.type === 'atlas' ? card.previewRef.index : -1,
    ]));
}

describe('Disney Edition 四派系静态接入', () => {
    const factions = [
        { factionId: SMASHUP_FACTION_IDS.ALADDIN, cards: ALADDIN_CARDS, bases: ALADDIN_BASES, uniqueCards: 14 },
        { factionId: SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST, cards: BEAUTY_AND_THE_BEAST_CARDS, bases: BEAUTY_AND_THE_BEAST_BASES, uniqueCards: 13 },
        { factionId: SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS, cards: NIGHTMARE_BEFORE_CHRISTMAS_CARDS, bases: NIGHTMARE_BEFORE_CHRISTMAS_BASES, uniqueCards: 15 },
        { factionId: SMASHUP_FACTION_IDS.WRECK_IT_RALPH, cards: WRECK_IT_RALPH_CARDS, bases: WRECK_IT_RALPH_BASES, uniqueCards: 13 },
    ] as const;

    it('四个派系各注册 20 张实体牌，且总卡面数覆盖 55 个 Disney 图集槽位', () => {
        expect(factions.reduce((total, entry) => total + entry.cards.length, 0)).toBe(55);

        for (const entry of factions) {
            expect(entry.cards, `${entry.factionId} unique cards`).toHaveLength(entry.uniqueCards);
            expect(physicalCardCount(entry.cards), `${entry.factionId} physical cards`).toBe(20);
            expect(new Set(entry.cards.map(card => card.id)).size, `${entry.factionId} unique ids`).toBe(entry.uniqueCards);

            const registered = getFactionCards(entry.factionId);
            expect(registered.map(card => card.id).sort()).toEqual(entry.cards.map(card => card.id).sort());
        }
    });

    it('卡牌槽位按 10 x 6 图集 row-major 映射到四个派系', () => {
        expect(slotMap(ALADDIN_CARDS)).toEqual({
            aladdin_carpet: 0,
            aladdin_palace_guard: 1,
            aladdin_abu: 2,
            aladdin_genie: 3,
            aladdin_rajah: 4,
            aladdin_jasmine: 5,
            aladdin_aladdin: 6,
            aladdin_a_friend_like_me: 7,
            aladdin_cave_of_wonders: 8,
            aladdin_jafar: 9,
            aladdin_magic_carpet_ride: 10,
            aladdin_street_rat: 11,
            aladdin_the_lamp: 12,
            aladdin_wish: 13,
        });
        expect(slotMap(BEAUTY_AND_THE_BEAST_CARDS)).toEqual({
            beauty_and_the_beast_enchanted_objects: 14,
            beauty_and_the_beast_cogsworth: 15,
            beauty_and_the_beast_lumiere: 16,
            beauty_and_the_beast_mrs_potts_and_chip: 17,
            beauty_and_the_beast_beast: 18,
            beauty_and_the_beast_belle: 19,
            beauty_and_the_beast_be_our_guest: 20,
            beauty_and_the_beast_break_the_curse: 21,
            beauty_and_the_beast_discover_the_library: 22,
            beauty_and_the_beast_ever_a_surprise: 23,
            beauty_and_the_beast_gaston: 24,
            beauty_and_the_beast_petals_of_the_rose: 25,
            beauty_and_the_beast_this_provincial_town: 26,
        });
        expect(slotMap(NIGHTMARE_BEFORE_CHRISTMAS_CARDS)).toEqual({
            nightmare_before_christmas_jack_skellington: 27,
            nightmare_before_christmas_halloween_town_folks: 28,
            nightmare_before_christmas_lock_shock_and_barrel: 29,
            nightmare_before_christmas_the_mayor_of_halloween_town: 30,
            nightmare_before_christmas_dr_finkelstein: 31,
            nightmare_before_christmas_sally: 32,
            nightmare_before_christmas_zero: 33,
            nightmare_before_christmas_christmas_will_be_ours: 34,
            nightmare_before_christmas_ghostly_presents: 35,
            nightmare_before_christmas_jack_o_lantern_in_the_box: 36,
            nightmare_before_christmas_monster_garland: 37,
            nightmare_before_christmas_oogie_boogie: 38,
            nightmare_before_christmas_sandy_claws_costume: 39,
            nightmare_before_christmas_winter_surprise: 40,
            nightmare_before_christmas_zombie_duck_toy: 41,
        });
        expect(slotMap(WRECK_IT_RALPH_CARDS)).toEqual({
            wreck_it_ralph_sugar_rush_racer: 42,
            wreck_it_ralph_sergeant_calhoun: 43,
            wreck_it_ralph_vanellope_von_schweetz: 44,
            wreck_it_ralph_fix_it_felix_jr: 45,
            wreck_it_ralph_wreck_it_ralph: 46,
            wreck_it_ralph_cy_bug_infestation: 47,
            wreck_it_ralph_escape_pod: 48,
            wreck_it_ralph_i_m_gonna_wreck_it: 49,
            wreck_it_ralph_kart_bakery: 50,
            wreck_it_ralph_king_candy: 51,
            wreck_it_ralph_mints_eruption: 52,
            wreck_it_ralph_research_lab_beacon: 53,
            wreck_it_ralph_sugar_rush: 54,
        });
    });

    it('基地槽位、断点、VP 和派系归属与 4 x 4 Disney 基地图集一致', () => {
        expect([
            ...WRECK_IT_RALPH_BASES,
            ...ALADDIN_BASES,
            ...BEAUTY_AND_THE_BEAST_BASES,
            ...NIGHTMARE_BEFORE_CHRISTMAS_BASES,
        ].map(base => ({
            id: base.id,
            faction: base.faction,
            breakpoint: base.breakpoint,
            vpAwards: base.vpAwards,
            slot: base.previewRef?.type === 'atlas' ? base.previewRef.index : -1,
        }))).toEqual([
            { id: 'base_the_dump', faction: SMASHUP_FACTION_IDS.WRECK_IT_RALPH, breakpoint: 20, vpAwards: [4, 2, 2], slot: 0 },
            { id: 'base_the_power_strip', faction: SMASHUP_FACTION_IDS.WRECK_IT_RALPH, breakpoint: 22, vpAwards: [4, 2, 1], slot: 4 },
            { id: 'base_agrabah_bazaar', faction: SMASHUP_FACTION_IDS.ALADDIN, breakpoint: 22, vpAwards: [4, 2, 1], slot: 5 },
            { id: 'base_sultans_palace', faction: SMASHUP_FACTION_IDS.ALADDIN, breakpoint: 18, vpAwards: [3, 2, 1], slot: 1 },
            { id: 'base_enchanted_castle', faction: SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST, breakpoint: 23, vpAwards: [4, 3, 2], slot: 3 },
            { id: 'base_gastons_tavern', faction: SMASHUP_FACTION_IDS.BEAUTY_AND_THE_BEAST, breakpoint: 26, vpAwards: [5, 3, 2], slot: 7 },
            { id: 'base_halloween_town', faction: SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS, breakpoint: 25, vpAwards: [5, 3, 2], slot: 10 },
            { id: 'base_spiral_hill', faction: SMASHUP_FACTION_IDS.NIGHTMARE_BEFORE_CHRISTMAS, breakpoint: 23, vpAwards: [4, 2, 1], slot: 14 },
        ]);

        for (const entry of factions) {
            expect(getBaseDefIdsForFactions([entry.factionId]).sort())
                .toEqual(entry.bases.map(base => base.id).sort());
        }
    });

    it('正式 atlas 路径、manifest 和素材 hash 已登记', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DISNEY_CARDS)).toBe('smashup/cards/disney');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DISNEY_BASES)).toBe('smashup/base/disney_bases');

        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/disney',
            gameKey: 'cards/disney',
            variant: 'png',
            localPath: CARD_PNG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/cards/compressed/disney',
            gameKey: 'cards/compressed/disney',
            variant: 'webp',
            localPath: CARD_WEBP,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/base/disney_bases',
            gameKey: 'base/disney_bases',
            variant: 'jpg',
            localPath: BASE_JPG,
        });
        expectManifestAssetHash({
            rootManifest,
            gameManifest,
            rootKey: 'zh-CN/smashup/base/compressed/disney_bases',
            gameKey: 'base/compressed/disney_bases',
            variant: 'webp',
            localPath: BASE_WEBP,
        });
    });

    it('四个派系进入派系选择 metadata，且 locale 已覆盖所有卡牌与基地', () => {
        const byId = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));
        const zhCN = JSON.parse(readFileSync('public/locales/zh-CN/game-smashup.json', 'utf8'));
        const en = JSON.parse(readFileSync('public/locales/en/game-smashup.json', 'utf8'));

        for (const entry of factions) {
            const meta = byId.get(entry.factionId);
            expect(meta?.nameKey).toBe(`factions.${entry.factionId}.name`);
            expect(meta?.descriptionKey).toBe(`factions.${entry.factionId}.description`);
            expect(meta?.locales).toEqual(['zh-CN']);
            expect(typeof zhCN.factions?.[entry.factionId]?.name).toBe('string');
            expect(typeof zhCN.factions?.[entry.factionId]?.description).toBe('string');
            expect(typeof en.factions?.[entry.factionId]?.name).toBe('string');
            expect(typeof en.factions?.[entry.factionId]?.description).toBe('string');

            for (const card of entry.cards) {
                expect(typeof zhCN.cards?.[card.id]?.name, `${card.id} zh name`).toBe('string');
                expect(typeof en.cards?.[card.id]?.name, `${card.id} en name`).toBe('string');
                const zhRuleText = card.type === 'action'
                    ? zhCN.cards?.[card.id]?.effectText
                    : zhCN.cards?.[card.id]?.abilityText;
                const enRuleText = card.type === 'action'
                    ? en.cards?.[card.id]?.effectText
                    : en.cards?.[card.id]?.abilityText;
                expect(zhRuleText?.trim(), `${card.id} zh rule text`).not.toMatch(PLACEHOLDER_RULE_TEXT);
                expect(enRuleText?.trim(), `${card.id} en rule text`).not.toMatch(PLACEHOLDER_RULE_TEXT);
                expect(zhRuleText?.trim().length, `${card.id} zh rule text length`).toBeGreaterThan(0);
                expect(enRuleText?.trim().length, `${card.id} en rule text length`).toBeGreaterThan(0);
            }

            for (const base of entry.bases) {
                expect(typeof zhCN.cards?.[base.id]?.name, `${base.id} zh name`).toBe('string');
                expect(typeof en.cards?.[base.id]?.name, `${base.id} en name`).toBe('string');
                expect(zhCN.cards?.[base.id]?.abilityText?.trim().length, `${base.id} zh ability`).toBeGreaterThan(0);
                expect(en.cards?.[base.id]?.abilityText?.trim().length, `${base.id} en ability`).toBeGreaterThan(0);
            }
        }
    });
});
