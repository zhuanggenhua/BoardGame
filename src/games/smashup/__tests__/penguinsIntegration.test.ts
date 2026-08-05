import { describe, expect, it } from 'vitest';

import i18nManifest from '../../../../public/assets/i18n/assets-manifest.json';
import smashupManifest from '../../../../public/assets/i18n/zh-CN/smashup/assets-manifest.json';
import enLocale from '../../../../public/locales/en/game-smashup.json';
import zhLocale from '../../../../public/locales/zh-CN/game-smashup.json';
import {
    getBaseDef,
    getBaseDefIdsForFactions,
    getFactionCards,
    getFactionTitans,
} from '../data/cards';
import { PENGUINS_BASES, PENGUINS_CARDS } from '../data/factions/penguins';
import { FACTION_DISPLAY_NAMES, SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { BaseCardDef, CardDef } from '../domain/types';
import { smashUpRuntimeCriticalImageResolver } from '../runtimeCriticalImageResolver';
import { FACTION_METADATA, isFactionImplementationInProgress } from '../ui/factionMeta';

const FACTION = SMASHUP_FACTION_IDS.PENGUINS;

const CARD_IDS = [
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
] as const;

const BASES: Record<string, { index: number; breakpoint: number; vpAwards: [number, number, number] }> = {
    base_ice_floe: { index: 0, breakpoint: 20, vpAwards: [3, 2, 1] },
    base_the_colony: { index: 2, breakpoint: 24, vpAwards: [4, 2, 1] },
};

function physicalCardCount(cards: Array<{ count: number }>): number {
    return cards.reduce((sum, card) => sum + card.count, 0);
}

function expectCardAtlasPreview(def: CardDef, index: number): void {
    expect(def.previewRef).toEqual({
        type: 'atlas',
        atlasId: SMASHUP_ATLAS_IDS.PENGUINS_CARDS,
        index,
    });
}

describe('SmashUp 企鹅派系静态与资源接入', () => {
    it('注册 15 个唯一卡面、20 张实体牌，并且不把派系封面格注册成手牌', () => {
        const cards = getFactionCards(FACTION);

        expect(PENGUINS_CARDS).toHaveLength(15);
        expect(cards).toHaveLength(15);
        expect(physicalCardCount(PENGUINS_CARDS)).toBe(20);
        expect(physicalCardCount(cards)).toBe(20);

        CARD_IDS.forEach((cardId, index) => {
            const def = cards.find(card => card.id === cardId);
            expect(def, `${cardId} 应已注册`).toBeDefined();
            expectCardAtlasPreview(def as CardDef, index);
        });
        expect(cards.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1)).not.toContain(15);
    });

    it('两张企鹅基地已注册到基地池并使用企鹅基地 atlas 槽位', () => {
        expect(PENGUINS_BASES).toHaveLength(2);
        expect(getBaseDefIdsForFactions([FACTION]).sort()).toEqual(Object.keys(BASES).sort());

        for (const [baseId, expected] of Object.entries(BASES)) {
            const def = getBaseDef(baseId) as BaseCardDef | undefined;
            expect(def, `${baseId} 应已注册`).toBeDefined();
            expect(def?.faction).toBe(FACTION);
            expect(def?.breakpoint).toBe(expected.breakpoint);
            expect(def?.vpAwards).toEqual(expected.vpAwards);
            expect(def?.previewRef).toEqual({
                type: 'atlas',
                atlasId: SMASHUP_ATLAS_IDS.PENGUINS_BASES,
                index: expected.index,
            });
        }
    });

    it('派系元数据、双语文案和企鹅帝皇泰坦关联已闭合', () => {
        expect(FACTION_DISPLAY_NAMES[FACTION]).toBe('企鹅');
        expect(isFactionImplementationInProgress(FACTION)).toBe(false);

        const meta = FACTION_METADATA.find(candidate => candidate.id === FACTION);
        expect(meta?.nameKey).toBe('factions.penguins.name');
        expect(meta?.descriptionKey).toBe('factions.penguins.description');
        expect(meta?.locales).toContain('zh-CN');

        expect(zhLocale.factions.penguins.name).toBe('企鹅');
        expect(enLocale.factions.penguins.name).toBe('Penguins');
        expect(getFactionTitans(FACTION).map(titan => titan.id)).toEqual(['penguins_emperor_penguin']);

        for (const locale of [zhLocale, enLocale]) {
            for (const cardId of CARD_IDS) {
                const entry = locale.cards[cardId];
                expect(entry?.name, `${cardId} 应有 name`).toEqual(expect.any(String));
                expect(entry?.abilityText ?? entry?.effectText, `${cardId} 应有规则文本`).toEqual(expect.any(String));
            }
            for (const baseId of Object.keys(BASES)) {
                const entry = locale.cards[baseId];
                expect(entry?.name, `${baseId} 应有 name`).toEqual(expect.any(String));
                expect(entry?.abilityText ?? entry?.effectText, `${baseId} 应有规则文本`).toEqual(expect.any(String));
            }
        }
    });

    it('企鹅卡牌与基地资源进入游戏级和根级 manifest，并会被运行时预加载', () => {
        expect(smashupManifest.files['cards/penguins']).toBeDefined();
        expect(smashupManifest.files['cards/compressed/penguins']).toBeDefined();
        expect(smashupManifest.files['base/penguins']).toBeDefined();
        expect(smashupManifest.files['base/compressed/penguins']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/cards/penguins']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/cards/compressed/penguins']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/base/penguins']).toBeDefined();
        expect(i18nManifest.files['zh-CN/smashup/base/compressed/penguins']).toBeDefined();

        const resolved = smashUpRuntimeCriticalImageResolver({
            core: {
                players: {
                    p1: { factions: [FACTION] },
                },
            },
            sys: { phase: 'playCards' },
        }, 'zh-CN', 'p1');

        expect(resolved.critical).toContain('smashup/cards/penguins');
        expect(resolved.critical).toContain('smashup/base/penguins');
    });
});
