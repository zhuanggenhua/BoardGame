import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../domain';
import { DICETHRONE_CHARACTER_CATALOG } from '../domain/types';
import { CHARACTER_DATA_MAP, initHeroState } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import {
    ARTIFICER_DICE_FACE_IDS,
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    STATUS_IDS,
    TOKEN_IDS,
} from '../domain/ids';
import { ARTIFICER_CARDS } from '../heroes/artificer/cards';
import { _testExports as criticalImages } from '../criticalImageResolver';
import { ASSETS } from '../ui/assets';
import { fixedRandom } from './test-utils';

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

const loadStatusFrameIds = () => {
    const jsonPath = assetRoot('artificial', 'status-icons-atlas.json');
    const data = JSON.parse(readFileSync(jsonPath, 'utf8')) as { frames?: Record<string, unknown> };
    return new Set(Object.keys(data.frames ?? {}));
};

const findArtificerCard = (cardId: string) => {
    const card = ARTIFICER_CARDS.find(entry => entry.id === cardId);
    expect(card, `未找到工匠卡牌 ${cardId}`).toBeDefined();
    return card!;
};

const isImplementationInProgress = (character: { badges?: Array<{ id: string }> }) => (
    character.badges?.some((badge) => badge.id === 'implementation_in_progress') ?? false
);

describe('DiceThrone 工匠接入与完成态', () => {
    it('角色目录已切到完成态，且 AI 等价选择列表会纳入工匠', () => {
        const artificer = DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'artificer');
        expect(artificer).toBeDefined();
        expect(artificer?.nameKey).toBe('characters.artificer');
        expect(artificer?.badges?.some((badge) => badge.id === 'implementation_in_progress') ?? false).toBe(false);

        const aiSelectableIds = DICETHRONE_CHARACTER_CATALOG
            .filter((character) => !isImplementationInProgress(character))
            .map((character) => character.id);
        expect(aiSelectableIds).toContain('artificer');
        expect(aiSelectableIds).toContain('cursed_pirate');
    });

    it('工匠进入静态角色数据链路，并注册专属骰面定义', () => {
        expect(CHARACTER_DATA_MAP.artificer.diceDefinitionId).toBe('artificer-dice');
        expect(CHARACTER_DATA_MAP.artificer.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER);
        expect(CHARACTER_DATA_MAP.artificer.statusAtlasPath).toBe('dicethrone/images/artificial/status-icons-atlas.json');

        expect(getDiceDefinition('artificer-dice')?.faces.map(face => face.symbols[0])).toEqual([
            ARTIFICER_DICE_FACE_IDS.WRENCH,
            ARTIFICER_DICE_FACE_IDS.WRENCH,
            ARTIFICER_DICE_FACE_IDS.WRENCH,
            ARTIFICER_DICE_FACE_IDS.GEAR,
            ARTIFICER_DICE_FACE_IDS.GEAR,
            ARTIFICER_DICE_FACE_IDS.ELECTRICITY,
        ]);
    });

    it('工匠实际初始化状态开局自带 3 个合成器，并预置三类机器人独立状态', () => {
        const player = initHeroState('0', 'artificer', fixedRandom);

        expect(player.tokens[TOKEN_IDS.SYNTH]).toBe(3);
        expect(player.tokens[TOKEN_IDS.NANOBOT]).toBe(0);
        expect(player.tokens[TOKEN_IDS.SHOCK_BOT]).toBe(0);
        expect(player.tokens[TOKEN_IDS.HEAL_BOT]).toBe(0);
        expect(player.artificerBotState).toEqual({
            [TOKEN_IDS.NANOBOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
            [TOKEN_IDS.SHOCK_BOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
            [TOKEN_IDS.HEAL_BOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
        });
    });

    it('卡牌预览全部走工匠 ability-cards atlas，并锁定专属 slot 与意不意外索引', () => {
        expect(ARTIFICER_CARDS).toHaveLength(33);

        for (const card of ARTIFICER_CARDS) {
            expect(card.previewRef, `${card.id} 缺少 previewRef`).toMatchObject({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.ARTIFICER,
            });
        }

        const customCards = ARTIFICER_CARDS.filter(card => card.sourceAtlasIndex !== undefined);
        expect(customCards.map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]);
        expect(customCards.map(card => card.id)).toEqual([
            'card-artificer-masterpiece',
            'card-artificer-mechanical-strike',
            'upgrade-artificer-shock-bot-2',
            'upgrade-artificer-tinker-2',
            'upgrade-artificer-overclock-2',
            'upgrade-artificer-shock-bot-3',
            'upgrade-artificer-activate-bots-2',
            'upgrade-artificer-eureka-2',
            'upgrade-artificer-schematics-2',
            'upgrade-artificer-wrench-strike-2',
            'upgrade-artificer-collect-parts-2',
            'card-artificer-voltage',
            'card-artificer-nano-attack',
            'card-artificer-overdrive',
            'card-artificer-perfectly-calibrated',
        ]);

        expect(findArtificerCard('card-unexpected').previewRef).toMatchObject({
            atlasId: DICETHRONE_CARD_ATLAS_IDS.ARTIFICER,
            index: 32,
        });
    });

    it('电弧盾暂不伪装成可结算升级牌', () => {
        const card = findArtificerCard('upgrade-artificer-shock-bot-2');
        expect(card.type).toBe('upgrade');
        expect(card.effects?.some(effect => effect.action?.type === 'replaceAbility') ?? false).toBe(false);
    });

    it('状态图集 JSON 覆盖工匠五个状态和机器人 frameId', () => {
        const frames = loadStatusFrameIds();
        for (const frameId of [
            TOKEN_IDS.SYNTH,
            STATUS_IDS.NANOBOMB,
            TOKEN_IDS.NANOBOT,
            TOKEN_IDS.SHOCK_BOT,
            TOKEN_IDS.HEAL_BOT,
        ]) {
            expect(frames.has(frameId), `工匠缺少 ${frameId}`).toBe(true);
        }
    });

    it('关键图片和 UI 资源入口使用 artificial 正式资源目录', () => {
        expect(criticalImages.getCharAssetPath('artificer', 'player-board')).toBe('dicethrone/images/artificial/player-board');
        expect(criticalImages.getCharAssetPath('artificer', 'ability-cards')).toBe('dicethrone/images/artificial/ability-cards');
        expect(ASSETS.PLAYER_BOARD('artificer')).toBe('dicethrone/images/artificial/player-board');
        expect(ASSETS.TIP_BOARD('artificer')).toBe('dicethrone/images/artificial/tip');
        expect(ASSETS.CARDS_ATLAS('artificer')).toBe('dicethrone/images/artificial/ability-cards');
        expect(ASSETS.DICE_SPRITE('artificer')).toBe('dicethrone/images/artificial/dice');
        expect(ASSETS.EFFECT_ICONS('artificer')).toBe('dicethrone/images/artificial/status-icons-atlas');

        for (const file of ['player-board.webp', 'tip.webp', 'ability-cards.webp', 'dice.webp', 'status-icons-atlas.webp']) {
            expect(existsSync(assetRoot('artificial', 'compressed', file)), `artificial 缺少 ${file}`).toBe(true);
        }
    });
});
