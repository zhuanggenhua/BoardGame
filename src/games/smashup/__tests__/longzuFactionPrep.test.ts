import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getAllBaseDefs, getBaseDef, getBaseDefIdsForFactions, getFactionCards } from '../data/cards';
import { SMASHUP_ATLAS_DEFINITIONS } from '../domain/atlasCatalog';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';
import type { ActionCardDef, MinionCardDef } from '../domain/types';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

const LONGZU_CARD_WEBP = 'public/assets/i18n/zh-CN/smashup/cards/compressed/longzu.webp';
const LONGZU_BASE_PNG = 'public/assets/i18n/zh-CN/smashup/base/longzu.png';
const LONGZU_BASE_WEBP = 'public/assets/i18n/zh-CN/smashup/base/compressed/longzu.webp';

const LONGZU_CARD_SOURCE_PNG_SHA256 = '090bbb869f292a94906cb7c45db043482b5ec05438450a7daa290105ef71cf13';
const LONGZU_CARD_SOURCE_PNG_BYTES = 42040387;

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('SmashUp longzu 三派系接入合同', () => {
    it('longzu 卡图 atlas 已登记为三派系运行时入口', () => {
        expect(SMASHUP_ATLAS_DEFINITIONS).toEqual(expect.arrayContaining([
            {
                id: SMASHUP_ATLAS_IDS.CARDS12,
                kind: 'card',
                image: 'smashup/cards/longzu',
                grid: { rows: 5, cols: 8 },
            },
        ]));
    });

    it('cards/longzu 已进入根级与游戏级 manifest，base/longzu 不再保留在正式资源树', () => {
        const rootManifest = JSON.parse(readFileSync('public/assets/i18n/assets-manifest.json', 'utf8'));
        const gameManifest = JSON.parse(readFileSync('public/assets/i18n/zh-CN/smashup/assets-manifest.json', 'utf8'));

        expect(rootManifest.files['zh-CN/smashup/cards/longzu'].variants.png.sha256)
            .toBe(LONGZU_CARD_SOURCE_PNG_SHA256);
        expect(rootManifest.files['zh-CN/smashup/cards/longzu'].variants.png.bytes)
            .toBe(LONGZU_CARD_SOURCE_PNG_BYTES);
        expect(rootManifest.files['zh-CN/smashup/cards/compressed/longzu'].variants.webp.sha256)
            .toBe(sha256(LONGZU_CARD_WEBP));
        expect(gameManifest.files['cards/longzu'].variants.png.sha256)
            .toBe(LONGZU_CARD_SOURCE_PNG_SHA256);
        expect(gameManifest.files['cards/longzu'].variants.png.bytes)
            .toBe(LONGZU_CARD_SOURCE_PNG_BYTES);
        expect(gameManifest.files['cards/compressed/longzu'].variants.webp.sha256)
            .toBe(sha256(LONGZU_CARD_WEBP));

        expect(existsSync('public/assets/i18n/zh-CN/smashup/cards/longzu.png')).toBe(false);
        expect(rootManifest.files['zh-CN/smashup/base/longzu']).toBeUndefined();
        expect(rootManifest.files['zh-CN/smashup/base/compressed/longzu']).toBeUndefined();
        expect(gameManifest.files['base/longzu']).toBeUndefined();
        expect(gameManifest.files['base/compressed/longzu']).toBeUndefined();
        expect(existsSync(LONGZU_BASE_PNG)).toBe(false);
        expect(existsSync(LONGZU_BASE_WEBP)).toBe(false);
    });

    it('三派系卡牌静态数量、拷贝数与图集索引已登记', () => {
        const dragons = getFactionCards(SMASHUP_FACTION_IDS.DRAGONS);
        const superheroes = getFactionCards(SMASHUP_FACTION_IDS.SUPERHEROES);
        const geeks = getFactionCards(SMASHUP_FACTION_IDS.GEEKS);

        expect(dragons).toHaveLength(12);
        expect(dragons.reduce((sum, card) => sum + card.count, 0)).toBe(20);
        expect(superheroes).toHaveLength(13);
        expect(superheroes.reduce((sum, card) => sum + card.count, 0)).toBe(20);
        expect(geeks).toHaveLength(13);
        expect(geeks.reduce((sum, card) => sum + card.count, 0)).toBe(20);

        expect((dragons.find((card) => card.id === 'dragons_great_wyrm') as MinionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 0 });
        expect((dragons.find((card) => card.id === 'dragons_flank_attack') as ActionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 11 });
        expect((superheroes.find((card) => card.id === 'superheroes_awesome_guy') as MinionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 12 });
        expect((superheroes.find((card) => card.id === 'superheroes_my_only_weakness') as ActionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 24 });
        expect((geeks.find((card) => card.id === 'geeks_felicia_day') as MinionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 25 });
        expect((geeks.find((card) => card.id === 'geeks_min_maxing') as ActionCardDef | undefined)?.previewRef)
            .toEqual({ type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS12, index: 37 });
        expect((geeks.find((card) => card.id === 'geeks_fan') as MinionCardDef | undefined)?.activatableAbilities)
            .toEqual([{ kind: 'special', zone: 'hand', window: 'playCards' }]);
    });

    it('复用已录入 shayu 基地图中的六个基地，并按派系入池', () => {
        const expectedBases = {
            [SMASHUP_FACTION_IDS.DRAGONS]: [
                ['base_wyrms_desolation', 1],
                ['base_dragons_lair', 4],
            ],
            [SMASHUP_FACTION_IDS.SUPERHEROES]: [
                ['base_converted_cave', 7],
                ['base_crystal_fortress', 10],
            ],
            [SMASHUP_FACTION_IDS.GEEKS]: [
                ['base_tabletop', 0],
                ['base_the_con', 3],
            ],
        } as const;

        for (const [factionId, baseCases] of Object.entries(expectedBases)) {
            expect(getAllBaseDefs().filter((base) => base.faction === factionId)).toHaveLength(2);
            expect(getBaseDefIdsForFactions([factionId])).toEqual(baseCases.map(([baseId]) => baseId));

            for (const [baseId, index] of baseCases) {
                const base = getBaseDef(baseId);
                expect(base, `${baseId} 应已注册`).toBeDefined();
                expect(base?.faction).toBe(factionId);
                expect(base?.previewRef).toEqual({
                    type: 'atlas',
                    atlasId: SMASHUP_ATLAS_IDS.BASE7,
                    index,
                });
            }
        }
    });

    it('龙、超级英雄、极客已解除实施中门禁', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.DRAGONS)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.SUPERHEROES)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.GEEKS)).toBe(false);
    });
});
