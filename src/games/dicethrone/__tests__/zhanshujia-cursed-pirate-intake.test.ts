import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../domain';
import { DICETHRONE_CHARACTER_CATALOG } from '../domain/types';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import {
    CURSED_PIRATE_DICE_FACE_IDS,
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    STATUS_IDS,
    TOKEN_IDS,
    ZHANSHUJIA_DICE_FACE_IDS,
} from '../domain/ids';
import { TREANT_NINJA_COMMON_ATLAS_INDEX } from '../domain/commonCards';
import { ZHANSHUJIA_CARDS } from '../heroes/zhanshujia/cards';
import { CURSED_PIRATE_CARDS } from '../heroes/cursed_pirate/cards';
import { _testExports as criticalImages } from '../criticalImageResolver';

const assetRoot = (...parts: string[]) => join(
    process.cwd(),
    'public',
    'assets',
    'i18n',
    'zh-CN',
    'dicethrone',
    'images',
    ...parts,
);

const loadStatusFrameIds = (heroDir: 'zhanshujia' | 'cursed') => {
    const jsonPath = assetRoot(heroDir, 'status-icons-atlas.json');
    const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as { frames?: Record<string, unknown> };
    return new Set(Object.keys(data.frames ?? {}));
};

describe('DiceThrone 战术家 / 咒缚海盗新英雄接入', () => {
    it('两个新英雄进入角色数据链路，并注册专属骰子定义', () => {
        expect(CHARACTER_DATA_MAP.zhanshujia.diceDefinitionId).toBe('zhanshujia-dice');
        expect(CHARACTER_DATA_MAP.cursed_pirate.diceDefinitionId).toBe('cursed_pirate-dice');

        expect(getDiceDefinition('zhanshujia-dice')?.faces.map(face => face.symbols[0])).toEqual([
            ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
        ]);

        expect(getDiceDefinition('cursed_pirate-dice')?.faces.map(face => face.symbols[0])).toEqual([
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            CURSED_PIRATE_DICE_FACE_IDS.SKULL,
        ]);
    });

    it('实施中徽标存在，避免把 L1 接入误报为完成态', () => {
        const zhanshujia = DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'zhanshujia');
        const cursedPirate = DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'cursed_pirate');

        expect(zhanshujia?.badges?.some(badge => badge.id === 'implementation_in_progress')).toBe(true);
        expect(cursedPirate?.badges?.some(badge => badge.id === 'implementation_in_progress')).toBe(true);
    });

    it('卡牌预览走各自 ability-cards atlas，通用牌映射沿用新规格合同', () => {
        expect(Object.keys(TREANT_NINJA_COMMON_ATLAS_INDEX)).toHaveLength(18);
        expect(TREANT_NINJA_COMMON_ATLAS_INDEX['card-unexpected']).toBe(37);

        for (const card of ZHANSHUJIA_CARDS) {
            expect(card.previewRef, `${card.id} 缺少战术家 previewRef`).toMatchObject({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.ZHANSHUJIA,
            });
        }

        for (const card of CURSED_PIRATE_CARDS) {
            expect(card.previewRef, `${card.id} 缺少咒缚海盗 previewRef`).toMatchObject({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE,
            });
        }
    });

    it('两名新英雄专属手牌已按单卡裁图完整录入 L1，并锁定专属通用牌索引', () => {
        expect(ZHANSHUJIA_CARDS).toHaveLength(33);
        expect(CURSED_PIRATE_CARDS).toHaveLength(34);

        const zhanshujiaCustomCards = ZHANSHUJIA_CARDS.filter(card => card.sourceAtlasIndex !== undefined);
        expect(zhanshujiaCustomCards.map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]);
        expect(zhanshujiaCustomCards.map(card => card.id)).toEqual([
            'card-zhanshujia-gain-the-upper-hand',
            'card-zhanshujia-ambush',
            'card-zhanshujia-disengage',
            'card-zhanshujia-tactical-retreat',
            'card-zhanshujia-war-room',
            'card-zhanshujia-strategic-defense',
            'upgrade-zhanshujia-countermeasures-3',
            'upgrade-zhanshujia-countermeasures-2',
            'upgrade-zhanshujia-strategic-shift-2',
            'upgrade-zhanshujia-expand-battlefield-2',
            'upgrade-zhanshujia-flanking-2',
            'upgrade-zhanshujia-drum-movement-2',
            'upgrade-zhanshujia-carpet-bombing-2',
            'upgrade-zhanshujia-war-monger-2',
            'upgrade-zhanshujia-sabre-thrust-2',
        ]);

        const cursedCustomCards = CURSED_PIRATE_CARDS.filter(card => card.sourceAtlasIndex !== undefined);
        expect(cursedCustomCards.map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
        ]);
        expect(cursedCustomCards.map(card => card.id)).toEqual([
            'card-cursed-pirate-weigh-anchor',
            'card-cursed-pirate-curse-card',
            'card-cursed-pirate-batten-down',
            'card-cursed-pirate-shark-bait',
            'card-cursed-pirate-flay',
            'card-cursed-pirate-ransom',
            'card-cursed-pirate-bluster',
            'card-cursed-pirate-scurvy',
            'card-cursed-pirate-pillage',
            'card-cursed-pirate-parley',
            'card-cursed-pirate-crows-nest',
            'card-cursed-pirate-hefty',
            'card-cursed-pirate-pirates-life',
            'card-cursed-pirate-go-fish',
            'card-cursed-pirate-give-me-some',
            'card-cursed-pirate-sip',
        ]);

        expect(ZHANSHUJIA_CARDS.find(card => card.id === 'card-unexpected')?.previewRef).toMatchObject({
            atlasId: DICETHRONE_CARD_ATLAS_IDS.ZHANSHUJIA,
            index: 32,
        });
        expect(CURSED_PIRATE_CARDS.find(card => card.id === 'card-unexpected')?.previewRef).toMatchObject({
            atlasId: DICETHRONE_CARD_ATLAS_IDS.CURSED_PIRATE,
            index: 33,
        });
    });

    it('状态图集 JSON 覆盖新增 frameId，并复用既有锁定/守护 ID', () => {
        expect(CHARACTER_DATA_MAP.zhanshujia.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA);
        expect(CHARACTER_DATA_MAP.cursed_pirate.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE);

        const zhanshujiaFrames = loadStatusFrameIds('zhanshujia');
        expect(zhanshujiaFrames.has(TOKEN_IDS.TACTICAL_ADVANTAGE)).toBe(true);
        expect(zhanshujiaFrames.has(STATUS_IDS.BIND)).toBe(true);
        expect(TOKEN_IDS.PROTECT).toBe('protect');
        expect(STATUS_IDS.TARGETED).toBe('targeted');

        const cursedFrames = loadStatusFrameIds('cursed');
        for (const frameId of [STATUS_IDS.WITHER, STATUS_IDS.PARLEY, STATUS_IDS.POWDER_KEG, STATUS_IDS.CURSED_COIN]) {
            expect(cursedFrames.has(frameId), `咒缚海盗缺少 ${frameId}`).toBe(true);
        }
    });

    it('关键图片解析对咒缚海盗使用 cursed 素材目录，且正式压缩资源存在', () => {
        expect(criticalImages.getCharAssetPath('zhanshujia', 'player-board')).toBe('dicethrone/images/zhanshujia/player-board');
        expect(criticalImages.getCharAssetPath('cursed_pirate', 'player-board')).toBe('dicethrone/images/cursed/player-board');

        for (const [heroDir, files] of Object.entries({
            zhanshujia: ['player-board.webp', 'tip.webp', 'ability-cards.webp', 'dice.webp', 'status-icons-atlas.webp'],
            cursed: ['player-board.webp', 'tip.webp', 'ability-cards.webp', 'dice.webp', 'status-icons-atlas.webp'],
        })) {
            for (const file of files) {
                expect(existsSync(assetRoot(heroDir, 'compressed', file)), `${heroDir} 缺少 ${file}`).toBe(true);
            }
        }
    });
});
