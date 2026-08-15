import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SmashUpDomain } from '../domain';
import { getBaseDefIdsForFactions, getFactionCards, getFactionTitans } from '../data/cards';
import {
    EXPLORERS_CARDS,
    GRANNIES_CARDS,
    ROCK_STARS_CARDS,
    TEDDY_BEARS_CARDS,
    WHAT_WERE_WE_THINKING_BASES,
} from '../data/factions/what_were_we_thinking';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import {
    isSmashUpFactionImplementationInProgress,
    SMASHUP_ATLAS_IDS,
    SMASHUP_FACTION_IDS,
} from '../domain/ids';
import { SU_COMMANDS } from '../domain/types';
import { getVisibleFactionMetadata, isFactionImplementationInProgress } from '../ui/factionMeta';
import { makeMatchState } from './helpers';
import { runCommands } from './testRunner';

const CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/what_were_we_thinking.png';
const CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/what_were_we_thinking.webp';
const BASE_PNG = 'public/assets/i18n/zh-CN/smashup/base/what_were_we_thinking_bases.png';
const BASE_WEBP = 'public/assets/i18n/zh-CN/smashup/base/compressed/what_were_we_thinking_bases.webp';
const PLACEHOLDER_RULE_TEXT = /TODO|pending|Card rules pending|牌面规则|待补/i;

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

type ManifestVariant = {
    sha256?: string;
    bytes?: number;
    mime?: string;
};

type AssetManifest = {
    files?: Record<string, { variants?: Record<string, ManifestVariant> }>;
};

function physicalCardCount(cards: ReadonlyArray<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function slotMap(cards: ReadonlyArray<{ id: string; previewRef?: { type: string; index?: number } }>) {
    return Object.fromEntries(cards.map(card => [
        card.id,
        card.previewRef?.type === 'atlas' ? card.previewRef.index : -1,
    ]));
}

describe('《我们到底在想什么？》四派系静态接入', () => {
    const factions = [
        { factionId: SMASHUP_FACTION_IDS.ROCK_STARS, cards: ROCK_STARS_CARDS },
        { factionId: SMASHUP_FACTION_IDS.TEDDY_BEARS, cards: TEDDY_BEARS_CARDS },
        { factionId: SMASHUP_FACTION_IDS.GRANNIES, cards: GRANNIES_CARDS },
        { factionId: SMASHUP_FACTION_IDS.EXPLORERS, cards: EXPLORERS_CARDS },
    ] as const;

    it('四个派系各注册 12 个唯一卡面和 20 张实体牌', () => {
        for (const entry of factions) {
            expect(entry.cards, `${entry.factionId} unique cards`).toHaveLength(12);
            expect(physicalCardCount(entry.cards), `${entry.factionId} physical cards`).toBe(20);
            expect(new Set(entry.cards.map(card => card.id)).size, `${entry.factionId} unique ids`).toBe(12);

            const registered = getFactionCards(entry.factionId);
            expect(registered.map(card => card.id).sort()).toEqual(entry.cards.map(card => card.id).sort());
        }
    });

    it('卡牌槽位按 8 x 6 图集 row-major 映射到四个派系', () => {
        expect(slotMap(ROCK_STARS_CARDS)).toEqual({
            rock_stars_turn_up_to_11: 0,
            rock_stars_reunion_tour: 1,
            rock_stars_total_sellout: 2,
            rock_stars_rock_of_luuv: 3,
            rock_stars_guest_star: 4,
            rock_stars_tour_bus: 5,
            rock_stars_hot_venue: 6,
            rock_stars_power_ballad: 7,
            rock_stars_the_monarch: 8,
            rock_stars_classic_rocker: 9,
            rock_stars_rick_roll: 10,
            rock_stars_groupie: 11,
        });
        expect(slotMap(TEDDY_BEARS_CARDS)).toEqual({
            teddy_bears_square_deal: 12,
            teddy_bears_love_overload: 13,
            teddy_bears_group_hug: 14,
            teddy_bears_care_package: 15,
            teddy_bears_too_cute: 16,
            teddy_bears_bear_picnic: 17,
            teddy_bears_cuddle: 18,
            teddy_bears_tea_party: 19,
            teddy_bears_sir_squeezes: 20,
            teddy_bears_lovey_bear: 21,
            teddy_bears_fun_bear: 22,
            teddy_bears_snuggly_bear: 23,
        });
        expect(slotMap(GRANNIES_CARDS)).toEqual({
            grannies_chicken_soup: 24,
            grannies_grannys_purse: 25,
            grannies_always_room_at_grannys: 26,
            grannies_matriarch: 27,
            grannies_attic_treasures: 28,
            grannies_hush_my_stories_are_on: 29,
            grannies_family_reunion: 30,
            grannies_dont_mess_with_my_babies: 31,
            grannies_knitting_circle: 32,
            grannies_granny: 33,
            grannies_nana: 34,
            grannies_grandma: 35,
        });
        expect(slotMap(EXPLORERS_CARDS)).toEqual({
            explorers_idaho_smith: 36,
            explorers_lost_city: 37,
            explorers_you_call_this_archaeology: 38,
            explorers_fortune_and_glory: 39,
            explorers_guide: 40,
            explorers_forgotten_horrors: 41,
            explorers_crypt_looter: 42,
            explorers_glory_hound: 43,
            explorers_it_belongs_in_a_museum: 44,
            explorers_x_never_marks_the_spot: 45,
            explorers_i_said_no_camels: 46,
            explorers_dr_livingstone_i_presume: 47,
        });
    });

    it('基地槽位、断点、VP 和派系归属与 4 x 2 基地图集一致', () => {
        expect(WHAT_WERE_WE_THINKING_BASES.map(base => ({
            id: base.id,
            faction: base.faction,
            breakpoint: base.breakpoint,
            vpAwards: base.vpAwards,
            slot: base.previewRef?.type === 'atlas' ? base.previewRef.index : -1,
        }))).toEqual([
            { id: 'base_under_the_bed', faction: SMASHUP_FACTION_IDS.TEDDY_BEARS, breakpoint: 22, vpAwards: [4, 2, 1], slot: 0 },
            { id: 'base_out_in_the_woods', faction: SMASHUP_FACTION_IDS.TEDDY_BEARS, breakpoint: 18, vpAwards: [3, 2, 1], slot: 1 },
            { id: 'base_lake_minnetonka', faction: SMASHUP_FACTION_IDS.ROCK_STARS, breakpoint: 26, vpAwards: [5, 3, 2], slot: 2 },
            { id: 'base_palooza', faction: SMASHUP_FACTION_IDS.ROCK_STARS, breakpoint: 27, vpAwards: [6, 4, 3], slot: 3 },
            { id: 'base_grandmas_house', faction: SMASHUP_FACTION_IDS.GRANNIES, breakpoint: 25, vpAwards: [5, 3, 2], slot: 4 },
            { id: 'base_retirement_community', faction: SMASHUP_FACTION_IDS.GRANNIES, breakpoint: 20, vpAwards: [4, 2, 1], slot: 5 },
            { id: 'base_ancient_temple', faction: SMASHUP_FACTION_IDS.EXPLORERS, breakpoint: 20, vpAwards: [4, 2, 1], slot: 6 },
            { id: 'base_city_of_gold', faction: SMASHUP_FACTION_IDS.EXPLORERS, breakpoint: 16, vpAwards: [3, 1, 1], slot: 7 },
        ]);

        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.ROCK_STARS]).sort()).toEqual([
            'base_lake_minnetonka',
            'base_palooza',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.TEDDY_BEARS]).sort()).toEqual([
            'base_out_in_the_woods',
            'base_under_the_bed',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.GRANNIES]).sort()).toEqual([
            'base_grandmas_house',
            'base_retirement_community',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.EXPLORERS]).sort()).toEqual([
            'base_ancient_temple',
            'base_city_of_gold',
        ]);
    });

    it('注册正式图集路径并保留探险家泰坦兼容入口', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_CARDS)).toBe('smashup/cards/what_were_we_thinking');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.WHAT_WERE_WE_THINKING_BASES)).toBe('smashup/base/what_were_we_thinking_bases');
        expect(getFactionTitans(SMASHUP_FACTION_IDS.EXPLORERS).map(titan => titan.id)).toContain('explorers_very_large_boulder');
    });

    it('正式探险家派系选中后会把硕大圆石初始化为牌库旁泰坦', () => {
        const initial = makeMatchState(SmashUpDomain.setup(['0', '1'], {
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
            shuffle: <T>(items: T[]) => [...items],
        }));
        initial.sys.phase = 'factionSelect';

        const result = runCommands(initial, [
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.EXPLORERS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ALIENS } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
            { type: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.ROCK_STARS } },
        ]);

        expect(result.success, result.error).toBe(true);
        expect(result.finalState.core.players['0'].factions).toEqual([
            SMASHUP_FACTION_IDS.EXPLORERS,
            SMASHUP_FACTION_IDS.ROCK_STARS,
        ]);
        expect(result.finalState.core.titans).toContainEqual(expect.objectContaining({
            defId: 'explorers_very_large_boulder',
            faction: SMASHUP_FACTION_IDS.EXPLORERS,
            ownerId: '0',
            controllerId: '0',
            location: { zone: 'setaside' },
        }));
        expect(result.finalState.core.players['0'].deck.some(card => card.defId === 'explorers_very_large_boulder')).toBe(false);
        expect(result.finalState.core.players['0'].hand.some(card => card.defId === 'explorers_very_large_boulder')).toBe(false);
    });

    it('正式 atlas 已进入根级与游戏级 manifest', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8')) as AssetManifest;
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8')) as AssetManifest;

        const assertManifestPair = (
            rootKey: string,
            gameKey: string,
            variantKey: 'png' | 'webp',
            localPath: string,
        ) => {
            const rootVariant = rootManifest.files?.[rootKey]?.variants?.[variantKey];
            const gameVariant = gameManifest.files?.[gameKey]?.variants?.[variantKey];

            expect(rootVariant, `${rootKey}.${variantKey}`).toMatchObject({
                mime: variantKey === 'png' ? 'image/png' : 'image/webp',
            });
            expect(gameVariant, `${gameKey}.${variantKey}`).toEqual(rootVariant);
            expect(rootVariant?.sha256, `${rootKey}.${variantKey} sha256`).toMatch(/^[a-f0-9]{64}$/);
            expect(rootVariant?.bytes, `${rootKey}.${variantKey} bytes`).toBeGreaterThan(0);

            if (existsSync(localPath)) {
                expect(rootVariant?.sha256).toBe(sha256(localPath));
            }
        };

        assertManifestPair(
            'zh-CN/smashup/cards/what_were_we_thinking',
            'cards/what_were_we_thinking',
            'png',
            CARD_PNG,
        );
        assertManifestPair(
            'zh-CN/smashup/cards/compressed/what_were_we_thinking',
            'cards/compressed/what_were_we_thinking',
            'webp',
            CARD_WEBP,
        );
        assertManifestPair(
            'zh-CN/smashup/base/what_were_we_thinking_bases',
            'base/what_were_we_thinking_bases',
            'png',
            BASE_PNG,
        );
        assertManifestPair(
            'zh-CN/smashup/base/compressed/what_were_we_thinking_bases',
            'base/compressed/what_were_we_thinking_bases',
            'webp',
            BASE_WEBP,
        );
    });

    it('四个派系不再标记实施中，并进入默认可见发布口径', () => {
        const byId = new Map(getVisibleFactionMetadata('zh-CN').map(meta => [meta.id, meta]));
        for (const entry of factions) {
            const meta = byId.get(entry.factionId);
            expect(meta?.nameKey).toBe(`factions.${entry.factionId}.name`);
            expect(isSmashUpFactionImplementationInProgress(entry.factionId)).toBe(false);
            expect(isFactionImplementationInProgress(entry.factionId)).toBe(false);
            expect(meta?.locales).toEqual(['zh-CN']);
        }
    });

    it('本批派系、卡牌与基地 locale 在中英文中都有结构化键', () => {
        const zhCN = JSON.parse(readFileSync('public/locales/zh-CN/game-smashup.json', 'utf8'));
        const en = JSON.parse(readFileSync('public/locales/en/game-smashup.json', 'utf8'));

        for (const entry of factions) {
            expect(typeof zhCN.factions?.[entry.factionId]?.name).toBe('string');
            expect(typeof zhCN.factions?.[entry.factionId]?.description).toBe('string');
            expect(typeof en.factions?.[entry.factionId]?.name).toBe('string');
            expect(typeof en.factions?.[entry.factionId]?.description).toBe('string');
        }

        const cards = [
            ...ROCK_STARS_CARDS,
            ...TEDDY_BEARS_CARDS,
            ...GRANNIES_CARDS,
            ...EXPLORERS_CARDS,
        ];
        for (const card of cards) {
            expect(typeof zhCN.cards?.[card.id]?.name, `${card.id} zh name`).toBe('string');
            expect(typeof en.cards?.[card.id]?.name, `${card.id} en name`).toBe('string');
            const zhRuleText = card.type === 'action'
                ? zhCN.cards?.[card.id]?.effectText
                : zhCN.cards?.[card.id]?.abilityText;
            const enRuleText = card.type === 'action'
                ? en.cards?.[card.id]?.effectText
                : en.cards?.[card.id]?.abilityText;
            if (card.type === 'action') {
                expect(typeof zhCN.cards?.[card.id]?.effectText, `${card.id} zh effect`).toBe('string');
                expect(typeof en.cards?.[card.id]?.effectText, `${card.id} en effect`).toBe('string');
            } else {
                expect(typeof zhCN.cards?.[card.id]?.abilityText, `${card.id} zh ability`).toBe('string');
                expect(typeof en.cards?.[card.id]?.abilityText, `${card.id} en ability`).toBe('string');
            }
            expect(zhRuleText.trim(), `${card.id} zh rule text`).not.toMatch(PLACEHOLDER_RULE_TEXT);
            expect(enRuleText.trim(), `${card.id} en rule text`).not.toMatch(PLACEHOLDER_RULE_TEXT);
            expect(zhRuleText.trim().length, `${card.id} zh rule text length`).toBeGreaterThan(0);
            expect(enRuleText.trim().length, `${card.id} en rule text length`).toBeGreaterThan(0);
        }

        expect(zhCN.cards.teddy_bears_fun_bear.abilityText)
            .toBe('持续：另一位玩家打出或移动一个佣兵至本基地后，此佣兵获得 +1 战力标记。');
        expect(en.cards.teddy_bears_fun_bear.abilityText)
            .toBe('Ongoing: After another player plays or moves a minion to here, place a +1 power counter on this minion.');
        expect(zhCN.cards.grannies_attic_treasures.effectText)
            .toBe('将你的 3 张手牌以任意顺序置于牌库底。抓 3 张牌。');
        expect(en.cards.grannies_attic_treasures.effectText)
            .toBe('Place three cards from your hand on the bottom of your deck in any order. Draw three cards.');
        expect(zhCN.cards.explorers_glory_hound.abilityText)
            .toBe('查看基地牌库顶的两张牌。将其中一张置于牌库底，另一张置于牌库顶。');
        expect(en.cards.explorers_glory_hound.abilityText)
            .toBe('Look at the top two cards of the base deck. Place one on the bottom of the deck and the other on the top.');
        expect(zhCN.cards.explorers_x_never_marks_the_spot.effectText)
            .toBe('移动你的每一个佣兵。');
        expect(en.cards.explorers_x_never_marks_the_spot.effectText)
            .toBe('Move each of your minions.');

        for (const base of WHAT_WERE_WE_THINKING_BASES) {
            expect(typeof zhCN.cards?.[base.id]?.name, `${base.id} zh name`).toBe('string');
            expect(typeof zhCN.cards?.[base.id]?.abilityText, `${base.id} zh ability`).toBe('string');
            expect(typeof en.cards?.[base.id]?.name, `${base.id} en name`).toBe('string');
            expect(typeof en.cards?.[base.id]?.abilityText, `${base.id} en ability`).toBe('string');
            expect(zhCN.cards?.[base.id]?.abilityText.trim(), `${base.id} zh ability`).not.toMatch(PLACEHOLDER_RULE_TEXT);
            expect(en.cards?.[base.id]?.abilityText.trim(), `${base.id} en ability`).not.toMatch(PLACEHOLDER_RULE_TEXT);
        }
    });
});
