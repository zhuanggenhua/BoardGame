import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import {
    ACTION_HEROES_CARDS,
    BACKTIMERS_CARDS,
    EXCELLENT_MOVIES_TEENS_BASES,
    EXCELLENT_MOVIES_TEENS_CARDS,
    EXTRAMORPHS_CARDS,
    TEENS_CARDS,
    WRAITHRUSTLERS_CARDS,
} from '../data/factions/excellent_movies_teens';
import { SMASHUP_ATLAS_DEFINITIONS, getSmashUpAtlasImageById } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import { FACTION_METADATA } from '../ui/factionMeta';

const CARD_PNG = 'public/assets/i18n/zh-CN/smashup/cards/excellent_movies_teens.png';
const CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/excellent_movies_teens.webp';

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

function physicalCardCount(cards: ReadonlyArray<{ count: number }>): number {
    return cards.reduce((total, card) => total + card.count, 0);
}

function slotRange(cards: ReadonlyArray<{ previewRef?: { type: string; index?: number } }>): [number, number] {
    const slots = cards.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index ?? -1 : -1);
    return [Math.min(...slots), Math.max(...slots)];
}

describe('Excellent Movies + Teens 五派系静态接入', () => {
    const factions = [
        { factionId: SMASHUP_FACTION_IDS.ACTION_HEROES, cards: ACTION_HEROES_CARDS, unique: 17, slots: [0, 16] },
        { factionId: SMASHUP_FACTION_IDS.BACKTIMERS, cards: BACKTIMERS_CARDS, unique: 12, slots: [17, 28] },
        { factionId: SMASHUP_FACTION_IDS.EXTRAMORPHS, cards: EXTRAMORPHS_CARDS, unique: 12, slots: [29, 40] },
        { factionId: SMASHUP_FACTION_IDS.TEENS, cards: TEENS_CARDS, unique: 13, slots: [41, 53] },
        { factionId: SMASHUP_FACTION_IDS.WRAITHRUSTLERS, cards: WRAITHRUSTLERS_CARDS, unique: 12, slots: [54, 65] },
    ] as const;

    it('注册一个 10 x 7 中文卡牌 atlas 并写入 manifest', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([{
            id: SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_CARDS,
            kind: 'card',
            image: 'smashup/cards/excellent_movies_teens',
            grid: { rows: 7, cols: 10 },
        }]));
        expect(getSmashUpAtlasImageById(SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_CARDS))
            .toBe('smashup/cards/excellent_movies_teens');

        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expect(rootManifest.files['zh-CN/smashup/cards/excellent_movies_teens'].variants.png.sha256)
            .toBe(sha256(CARD_PNG));
        expect(rootManifest.files['zh-CN/smashup/cards/compressed/excellent_movies_teens'].variants.webp.sha256)
            .toBe(sha256(CARD_WEBP));
        expect(gameManifest.files['cards/excellent_movies_teens'].variants.png.sha256)
            .toBe(sha256(CARD_PNG));
        expect(gameManifest.files['cards/compressed/excellent_movies_teens'].variants.webp.sha256)
            .toBe(sha256(CARD_WEBP));
    });

    it('五个派系各自注册 20 张实体牌，且只消费槽位 0-65', () => {
        expect(EXCELLENT_MOVIES_TEENS_CARDS).toHaveLength(66);
        expect(physicalCardCount(EXCELLENT_MOVIES_TEENS_CARDS)).toBe(100);

        for (const entry of factions) {
            const registered = getFactionCards(entry.factionId);
            expect(entry.cards, `${entry.factionId} unique cards`).toHaveLength(entry.unique);
            expect(registered.map(card => card.id).sort()).toEqual(entry.cards.map(card => card.id).sort());
            expect(physicalCardCount(entry.cards), `${entry.factionId} physical cards`).toBe(20);
            expect(new Set(entry.cards.map(card => card.id)).size, `${entry.factionId} unique ids`).toBe(entry.unique);
            expect(slotRange(entry.cards), `${entry.factionId} slots`).toEqual(entry.slots);
            expect(entry.cards.every(card => card.previewRef?.type === 'atlas'
                && card.previewRef.atlasId === SMASHUP_ATLAS_IDS.EXCELLENT_MOVIES_TEENS_CARDS), `${entry.factionId} atlas`).toBe(true);
        }

        const usedSlots = EXCELLENT_MOVIES_TEENS_CARDS.map(card => card.previewRef?.type === 'atlas' ? card.previewRef.index : -1);
        expect(new Set(usedSlots).size).toBe(66);
        expect(Math.min(...usedSlots)).toBe(0);
        expect(Math.max(...usedSlots)).toBe(65);
    });

    it('基地文字定义进入基地池，且美术槽位保持未锁状态', () => {
        const baseCases = [
            [SMASHUP_FACTION_IDS.ACTION_HEROES, ['base_building_rooftop', 'base_jungle_camp']],
            [SMASHUP_FACTION_IDS.BACKTIMERS, ['base_alternate_present', 'base_time_traveling_car']],
            [SMASHUP_FACTION_IDS.EXTRAMORPHS, ['base_ancient_crashed_ship', 'base_brood_hive']],
            [SMASHUP_FACTION_IDS.TEENS, ['base_cabin_in_the_woods', 'base_montridge_high']],
            [SMASHUP_FACTION_IDS.WRAITHRUSTLERS, ['base_rooftop_portal', 'base_wraithrustlers_hq']],
        ] as const;

        expect(EXCELLENT_MOVIES_TEENS_BASES).toHaveLength(10);
        for (const [factionId, baseIds] of baseCases) {
            expect(getBaseDefIdsForFactions([factionId]).sort()).toEqual([...baseIds].sort());
        }
        expect(EXCELLENT_MOVIES_TEENS_BASES.every(base => base.previewRef === undefined)).toBe(true);
    });

    it('派系选择 metadata 和双语 locale 已包含本批对象', () => {
        const zhCN = JSON.parse(readFileSync('public/locales/zh-CN/game-smashup.json', 'utf8'));
        const en = JSON.parse(readFileSync('public/locales/en/game-smashup.json', 'utf8'));
        const metaById = new Map(FACTION_METADATA.map(meta => [meta.id, meta]));

        for (const entry of factions) {
            const meta = metaById.get(entry.factionId);
            expect(meta?.nameKey).toBe(`factions.${entry.factionId}.name`);
            expect(meta?.implementationStatus).toBe('in_progress');
            expect(meta?.locales).toEqual(['zh-CN']);
            expect(typeof zhCN.factions?.[entry.factionId]?.name).toBe('string');
            expect(typeof en.factions?.[entry.factionId]?.name).toBe('string');
        }

        for (const card of EXCELLENT_MOVIES_TEENS_CARDS) {
            const zhCard = zhCN.cards?.[card.id];
            const enCard = en.cards?.[card.id];
            expect(typeof zhCard?.name, `${card.id} zh name`).toBe('string');
            expect(typeof enCard?.name, `${card.id} en name`).toBe('string');
            expect(typeof (zhCard?.abilityText ?? zhCard?.effectText), `${card.id} zh text`).toBe('string');
            expect(typeof (enCard?.abilityText ?? enCard?.effectText), `${card.id} en text`).toBe('string');
        }

        expect(en.cards.action_heroes_hostage_rescue.name).toBe('Hostage Rescue');
        expect(en.cards.backtimers_help_from_the_past.name).toBe('Help From the Past');
        expect(en.cards.teens_abe_frohman.name).toBe('Abe Frohman');
        expect(zhCN.cards.extramorphs_head_grabber.effectText).toContain('力量 3 或更低');

        for (const base of EXCELLENT_MOVIES_TEENS_BASES) {
            expect(typeof zhCN.cards?.[base.id]?.abilityText, `${base.id} zh ability`).toBe('string');
            expect(typeof en.cards?.[base.id]?.abilityText, `${base.id} en ability`).toBe('string');
        }
    });
});
