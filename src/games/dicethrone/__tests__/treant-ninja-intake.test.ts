import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../domain';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import {
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    NINJA_DICE_FACE_IDS,
    TOKEN_IDS,
    TREANT_DICE_FACE_IDS,
} from '../domain/ids';
import { TREANT_NINJA_COMMON_ATLAS_INDEX } from '../domain/commonCards';
import { TREANT_CARDS } from '../heroes/treant/cards';
import { NINJA_CARDS } from '../heroes/ninja/cards';

const loadStatusFrameIds = (heroId: 'treant' | 'ninja') => {
    const jsonPath = join(
        process.cwd(),
        'public',
        'assets',
        'i18n',
        'zh-CN',
        'dicethrone',
        'images',
        heroId,
        'status-icons-atlas.json',
    );
    const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as { frames?: Record<string, unknown> };
    return new Set(Object.keys(data.frames ?? {}));
};

describe('DiceThrone Treant / Ninja 新英雄接入', () => {
    it('树精和忍者进入角色数据链路，并注册专属骰子定义', () => {
        expect(CHARACTER_DATA_MAP.treant.diceDefinitionId).toBe('treant-dice');
        expect(CHARACTER_DATA_MAP.ninja.diceDefinitionId).toBe('ninja-dice');

        expect(getDiceDefinition('treant-dice')?.faces.map(face => face.symbols[0])).toEqual([
            TREANT_DICE_FACE_IDS.BRANCH,
            TREANT_DICE_FACE_IDS.BRANCH,
            TREANT_DICE_FACE_IDS.BRANCH,
            TREANT_DICE_FACE_IDS.LEAF,
            TREANT_DICE_FACE_IDS.LEAF,
            TREANT_DICE_FACE_IDS.SPIRIT,
        ]);
        expect(getDiceDefinition('ninja-dice')?.faces.map(face => face.symbols[0])).toEqual([
            NINJA_DICE_FACE_IDS.KATANA,
            NINJA_DICE_FACE_IDS.KATANA,
            NINJA_DICE_FACE_IDS.KATANA,
            NINJA_DICE_FACE_IDS.SHURIKEN,
            NINJA_DICE_FACE_IDS.SHURIKEN,
            NINJA_DICE_FACE_IDS.MASK,
        ]);
    });

    it('卡牌预览全部走各自 ability-cards atlas，不回退 hand atlas 或单卡图', () => {
        const assertCards = (cards: typeof TREANT_CARDS, atlasId: string) => {
            for (const card of cards) {
                expect(card.previewRef, `${card.id} 缺少 previewRef`).toMatchObject({
                    type: 'atlas',
                    atlasId,
                });
                expect(card.previewRef?.type).toBe('atlas');
            }
        };

        assertCards(TREANT_CARDS, DICETHRONE_CARD_ATLAS_IDS.TREANT);
        assertCards(NINJA_CARDS, DICETHRONE_CARD_ATLAS_IDS.NINJA);
    });

    it('新规格通用卡映射覆盖 18 张通用牌，且意不意外位于末行 slot-32', () => {
        expect(Object.keys(TREANT_NINJA_COMMON_ATLAS_INDEX)).toHaveLength(18);
        expect(TREANT_NINJA_COMMON_ATLAS_INDEX['card-unexpected']).toBe(32);
        expect(TREANT_NINJA_COMMON_ATLAS_INDEX['card-next-time']).toBe(0);
    });

    it('忍者雾隐和道场必须指向真实存在的专属卡槽位', () => {
        expect(NINJA_CARDS.find(card => card.id === 'ninja-card-vanish')?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: DICETHRONE_CARD_ATLAS_IDS.NINJA,
            index: 30,
        });
        expect(NINJA_CARDS.find(card => card.id === 'ninja-card-vanish')?.sourceAtlasIndex).toBe(30);

        expect(NINJA_CARDS.find(card => card.id === 'ninja-card-dojo')?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: DICETHRONE_CARD_ATLAS_IDS.NINJA,
            index: 31,
        });
        expect(NINJA_CARDS.find(card => card.id === 'ninja-card-dojo')?.sourceAtlasIndex).toBe(31);
    });

    it('状态图集 JSON 覆盖所有新 token frameId', () => {
        expect(CHARACTER_DATA_MAP.treant.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.TREANT);
        expect(CHARACTER_DATA_MAP.ninja.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.NINJA);

        const treantFrames = loadStatusFrameIds('treant');
        for (const frameId of ['treant_seedling', 'treant_sapling', 'treant_divine', 'life_sap', 'thorn']) {
            expect(treantFrames.has(frameId), `treant 缺少 ${frameId}`).toBe(true);
        }

        const ninjaFrames = loadStatusFrameIds('ninja');
        for (const frameId of [TOKEN_IDS.DELAYED_POISON, TOKEN_IDS.NINJUTSU, TOKEN_IDS.SMOKE_BOMB]) {
            expect(ninjaFrames.has(frameId), `ninja 缺少 ${frameId}`).toBe(true);
        }
    });
});
