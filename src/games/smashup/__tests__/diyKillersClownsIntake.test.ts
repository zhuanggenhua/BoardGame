import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { smashUpCriticalImageResolver } from '../criticalImageResolver';
import { getBaseDef, getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

function readSmashUpLocale(locale: 'en' | 'zh-CN') {
    return JSON.parse(
        readFileSync(resolve(__dirname, '../../../../public/locales/' + locale + '/game-smashup.json'), 'utf-8'),
    );
}

function makePlayingState(factions: Record<string, [string, string]>) {
    return {
        sys: { phase: 'playCards' },
        core: {
            players: Object.fromEntries(
                Object.entries(factions).map(([pid, picked]) => [pid, { factions: picked }]),
            ),
        },
    };
}

describe('SmashUp DIY 杀人狂 / 小丑 intake', () => {
    const zhCN = readSmashUpLocale('zh-CN');
    const en = readSmashUpLocale('en');

    it('杀人狂实体牌、张数与 atlas slot 已注册', () => {
        const defs = getFactionCards(SMASHUP_FACTION_IDS.DIY_KILLERS);

        expect(defs).toHaveLength(18);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(20);

        expect(Object.fromEntries(defs.map(def => [def.id, def.previewRef]))).toMatchObject({
            diy_killers_leatherface: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS, index: 0 },
            diy_killers_pinhead: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS, index: 4 },
            diy_killers_origin_story: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS, index: 15 },
            diy_killers_hell_puzzle_box: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS, index: 17 },
            diy_killers_is_it_over: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS, index: 18 },
        });

        expect(defs.find(def => def.id === 'diy_killers_origin_story')?.count).toBe(2);
        expect(defs.find(def => def.id === 'diy_killers_is_it_over')?.count).toBe(2);
    });

    it('小丑实体牌、张数与 atlas slot 已注册', () => {
        const defs = getFactionCards(SMASHUP_FACTION_IDS.DIY_CLOWNS);

        expect(defs).toHaveLength(14);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(20);

        expect(Object.fromEntries(defs.map(def => [def.id, def.previewRef]))).toMatchObject({
            diy_clowns_slapstick_clown: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS, index: 0 },
            diy_clowns_silent_clown: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS, index: 4 },
            diy_clowns_clown_girl: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS, index: 6 },
            diy_clowns_colorful_scarf: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS, index: 14 },
            diy_clowns_pie_in_the_face: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS, index: 18 },
        });

        expect(defs.find(def => def.id === 'diy_clowns_silent_clown')?.count).toBe(2);
        expect(defs.find(def => def.id === 'diy_clowns_clown_girl')?.count).toBe(4);
        expect(defs.find(def => def.id === 'diy_clowns_colorful_scarf')?.count).toBe(2);
        expect(defs.find(def => def.id === 'diy_clowns_pie_in_the_face')?.count).toBe(2);
    });

    it('两个 DIY 派系各自带 2 张基地并接到独立基地图集', () => {
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.DIY_KILLERS]).sort()).toEqual([
            'base_diy_killers_camp_crystal_lake',
            'base_diy_killers_nightmare_world',
        ]);
        expect(getBaseDefIdsForFactions([SMASHUP_FACTION_IDS.DIY_CLOWNS]).sort()).toEqual([
            'base_diy_clowns_circus_tent',
            'base_diy_clowns_clown_academy',
        ]);

        expect(getBaseDef('base_diy_killers_camp_crystal_lake')).toMatchObject({
            breakpoint: 20,
            vpAwards: [4, 3, 1],
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_KILLERS_BASES, index: 0 },
        });
        expect(getBaseDef('base_diy_clowns_circus_tent')).toMatchObject({
            breakpoint: 21,
            vpAwards: [4, 2, 1],
            previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.DIY_CLOWNS_BASES, index: 1 },
        });
    });

    it('atlas catalog、critical resolver 与 UI metadata 已接线', () => {
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DIY_KILLERS_CARDS)).toBe('smashup/cards/diy_killers');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DIY_KILLERS_BASES)).toBe('smashup/base/diy_killers_bases');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DIY_CLOWNS_CARDS)).toBe('smashup/cards/diy_clowns');
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.DIY_CLOWNS_BASES)).toBe('smashup/base/diy_clowns_bases');

        const result = smashUpCriticalImageResolver(
            makePlayingState({
                '0': [SMASHUP_FACTION_IDS.DIY_KILLERS, SMASHUP_FACTION_IDS.DIY_CLOWNS],
                '1': [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
            }),
            undefined,
            '0',
        );

        expect(result.critical).toContain('smashup/cards/diy_killers');
        expect(result.critical).toContain('smashup/base/diy_killers_bases');
        expect(result.critical).toContain('smashup/cards/diy_clowns');
        expect(result.critical).toContain('smashup/base/diy_clowns_bases');
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.DIY_KILLERS)).toBe(true);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.DIY_CLOWNS)).toBe(true);
    });

    it('中英文 locale 覆盖派系、卡牌与基地文本', () => {
        for (const factionId of [SMASHUP_FACTION_IDS.DIY_KILLERS, SMASHUP_FACTION_IDS.DIY_CLOWNS]) {
            expect(zhCN.factions?.[factionId]?.name).toBeTruthy();
            expect(en.factions?.[factionId]?.name).toBeTruthy();
        }

        for (const def of [
            ...getFactionCards(SMASHUP_FACTION_IDS.DIY_KILLERS),
            ...getFactionCards(SMASHUP_FACTION_IDS.DIY_CLOWNS),
        ]) {
            const zhEntry = zhCN.cards?.[def.id];
            const enEntry = en.cards?.[def.id];
            expect(zhEntry?.name, 'zh-CN cards.' + def.id + '.name').toBeTruthy();
            expect(enEntry?.name, 'en cards.' + def.id + '.name').toBeTruthy();
            expect(
                def.type === 'action' ? zhEntry?.effectText : zhEntry?.abilityText,
                'zh-CN cards.' + def.id + ' text',
            ).toBeTruthy();
            expect(
                def.type === 'action' ? enEntry?.effectText : enEntry?.abilityText,
                'en cards.' + def.id + ' text',
            ).toBeTruthy();
        }

        for (const baseId of [
            'base_diy_killers_camp_crystal_lake',
            'base_diy_killers_nightmare_world',
            'base_diy_clowns_clown_academy',
            'base_diy_clowns_circus_tent',
        ]) {
            expect(zhCN.cards?.[baseId]?.name, 'zh-CN cards.' + baseId + '.name').toBeTruthy();
            expect(en.cards?.[baseId]?.name, 'en cards.' + baseId + '.name').toBeTruthy();
            expect(zhCN.cards?.[baseId]?.abilityText, 'zh-CN cards.' + baseId + '.abilityText').toBeTruthy();
            expect(en.cards?.[baseId]?.abilityText, 'en cards.' + baseId + '.abilityText').toBeTruthy();
        }
    });
});
