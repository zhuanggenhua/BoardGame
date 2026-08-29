import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import '../domain';
import {
    DICETHRONE_CHARACTER_CATALOG,
    DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG,
    hasDiceThroneTipBoard,
} from '../domain/types';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import {
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    STATUS_IDS,
    TOKEN_IDS,
    VAMPIRE_LORD_DICE_FACE_IDS,
} from '../domain/ids';
import { VAMPIRE_LORD_ABILITIES } from '../heroes/vampire_lord/abilities';
import { VAMPIRE_LORD_CARDS } from '../heroes/vampire_lord/cards';
import { ASSETS } from '../ui/assets';
import { HERO_CARDS_MAP, getSlotAbilityId } from '../ui/abilityOverlayHelpers';
import { getAbilitySlotIdForCharacter } from '../ui/abilitySlotMapping';
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

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const hasI18nKey = (data: Record<string, unknown>, key: string): boolean => {
    const parts = key.split('.');
    let current: unknown = data;
    for (let index = 0; index < parts.length; index += 1) {
        if (!current || typeof current !== 'object') return false;
        const record = current as Record<string, unknown>;
        const remaining = parts.slice(index).join('.');
        if (Object.prototype.hasOwnProperty.call(record, remaining)) return true;
        current = record[parts[index]];
    }
    return current !== undefined;
};

const manifestHas = (path: string, assetPath: string): boolean => {
    const manifest = readJson<{ files?: Record<string, unknown> }>(path);
    return Object.prototype.hasOwnProperty.call(manifest.files ?? {}, assetPath);
};

const VAMPIRE_LORD_I18N_KEYS = [
    'characters.vampire_lord',
    'hero.vampire_lord',
    'config.dice.vampire_lord.name',
    'dice.face.claw',
    'dice.face.mesmerize',
    'dice.face.blood_drop',
    'abilityChoice.faceLabel.mesmerize',
    'abilityChoice.faceLabel.blood_drop',
    'tokens.blood_power.name',
    'tokens.blood_power.description',
    'tokens.mesmerize.name',
    'tokens.mesmerize.description',
    'statusEffects.bleed.name',
    'statusEffects.bleed.description',
    'abilities.bloodthirsty-claws.name',
    'abilities.mesmerize-power.name',
    'abilities.blood-feast.name',
    'abilities.rend-claws.name',
    'abilities.blood-possessed.name',
    'abilities.blood-thirst.name',
    'abilities.blood-magic.name',
    'abilities.undying.name',
    'abilities.bloody-slaughter.name',
    'abilities.mesmerize-power-2-soul-gaze.name',
    'abilities.blood-feast-2-dressed-to-kill.name',
    'abilities.blood-possessed-2-blood-addiction.name',
    'abilities.blood-thirst-2-blood-river.name',
    'abilities.blood-magic-2-flayed.name',
    'choices.vampireLordBloodPossessed.title',
    'choices.vampireLordBloodPossessed.inflictBleed',
    'choices.vampireLordBloodPossessed.gainMesmerize',
    'cards.card-vampire-lord-blood-surge.name',
    'cards.card-vampire-lord-blood-from-above.name',
    'cards.card-vampire-lord-total-demise.name',
    'cards.card-vampire-lord-boiling-blood.name',
    'cards.card-vampire-lord-gushing-blood.name',
    'cards.upgrade-vampire-lord-undying-2.name',
    'cards.upgrade-vampire-lord-blood-thirst-2-blood-river.name',
    'cards.upgrade-vampire-lord-blood-magic-2-flayed.name',
    'cards.upgrade-vampire-lord-blood-possessed-2-blood-addiction.name',
    'cards.upgrade-vampire-lord-rend-claws-2.name',
    'cards.upgrade-vampire-lord-blood-feast-2-dressed-to-kill.name',
    'cards.upgrade-vampire-lord-mesmerize-power-2-soul-gaze.name',
    'cards.upgrade-vampire-lord-bloodthirsty-claws-3.name',
    'cards.upgrade-vampire-lord-bloodthirsty-claws-2.name',
    'cards.card-vampire-lord-drink-up.name',
    'cards.card-vampire-lord-bloodstone.name',
];

describe('DiceThrone 吸血鬼领主录入与资源合同', () => {
    it('角色目录实施中、骰面、状态标记和角色板九槽已接入', () => {
        const character = DICETHRONE_CHARACTER_CATALOG.find(entry => entry.id === 'vampire_lord');
        expect(character?.nameKey).toBe('characters.vampire_lord');
        expect(character?.setupOptionStatus).toBe('in_progress');
        expect(character?.setupOptionStatusReason).toContain('当前范围实施与审计');
        expect(character?.badges?.some(badge => badge.id === 'implementation_in_progress') ?? false).toBe(true);
        expect(DICETHRONE_PLAYER_VISIBLE_CHARACTER_CATALOG.map(entry => entry.id)).toContain('vampire_lord');
        expect(hasDiceThroneTipBoard('vampire_lord')).toBe(true);

        expect(CHARACTER_DATA_MAP.vampire_lord.diceDefinitionId).toBe('vampire_lord-dice');
        expect(CHARACTER_DATA_MAP.vampire_lord.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.VAMPIRE_LORD);
        expect(CHARACTER_DATA_MAP.vampire_lord.statusAtlasPath).toBe('dicethrone/images/xixuegui/status-icons-atlas.json');
        expect(CHARACTER_DATA_MAP.vampire_lord.initialTokens).toEqual({
            [TOKEN_IDS.BLOOD_POWER]: 0,
            [TOKEN_IDS.MESMERIZE]: 0,
        });
        expect(CHARACTER_DATA_MAP.vampire_lord.initialStatusEffects).toEqual({ [STATUS_IDS.BLEED]: 0 });

        expect(getDiceDefinition('vampire_lord-dice')?.faces.map(face => face.symbols[0])).toEqual([
            VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            VAMPIRE_LORD_DICE_FACE_IDS.CLAW,
            VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
            VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE,
            VAMPIRE_LORD_DICE_FACE_IDS.BLOOD_DROP,
        ]);

        expect(VAMPIRE_LORD_ABILITIES).toHaveLength(9);
        expect(VAMPIRE_LORD_ABILITIES.map(ability => ability.id)).toEqual([
            'bloodthirsty-claws',
            'mesmerize-power',
            'blood-feast',
            'rend-claws',
            'blood-possessed',
            'blood-thirst',
            'blood-magic',
            'undying',
            'bloody-slaughter',
        ]);
        expect(Object.fromEntries([
            ['fist', 'bloodthirsty-claws'],
            ['chi', 'mesmerize-power'],
            ['sky', 'blood-feast'],
            ['lotus', 'rend-claws'],
            ['combo', 'blood-possessed'],
            ['lightning', 'blood-thirst'],
            ['calm', 'blood-magic'],
            ['meditate', 'undying'],
            ['ultimate', 'bloody-slaughter'],
        ].map(([slot]) => [slot, getSlotAbilityId('vampire_lord', slot)]))).toEqual({
            fist: 'bloodthirsty-claws',
            chi: 'mesmerize-power',
            sky: 'blood-feast',
            lotus: 'rend-claws',
            combo: 'blood-possessed',
            lightning: 'blood-thirst',
            calm: 'blood-magic',
            meditate: 'undying',
            ultimate: 'bloody-slaughter',
        });
        for (const abilityId of [
            'bloodthirsty-claws',
            'mesmerize-power',
            'blood-feast',
            'rend-claws',
            'blood-possessed',
            'blood-thirst',
            'blood-magic',
            'undying',
            'bloody-slaughter',
        ]) {
            expect(getAbilitySlotIdForCharacter('vampire_lord', abilityId)).not.toBeNull();
        }
    });

    it('吸血鬼专属卡牌使用 xixuegui ability-cards atlas，并解决 slot-32 公共牌预览冲突', () => {
        expect(HERO_CARDS_MAP.vampire_lord).toBe(VAMPIRE_LORD_CARDS);
        expect(VAMPIRE_LORD_CARDS).toHaveLength(34);
        expect(VAMPIRE_LORD_CARDS.filter(card => card.sourceAtlasIndex !== undefined).map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
        ]);
        expect(VAMPIRE_LORD_CARDS.filter(card => card.id !== 'card-unexpected').every(card => card.previewRef?.type === 'atlas')).toBe(true);
        expect(VAMPIRE_LORD_CARDS.filter(card => card.id !== 'card-unexpected').every(card => (
            card.previewRef?.type !== 'atlas' || card.previewRef.atlasId === DICETHRONE_CARD_ATLAS_IDS.VAMPIRE_LORD
        ))).toBe(true);
        expect(VAMPIRE_LORD_CARDS.find(card => card.id === 'card-vampire-lord-bloodstone')?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: DICETHRONE_CARD_ATLAS_IDS.VAMPIRE_LORD,
            index: 32,
        });
        expect(VAMPIRE_LORD_CARDS.find(card => card.id === 'card-unexpected')?.previewRef).toBeUndefined();

        const upgradeTargets = Object.fromEntries(
            VAMPIRE_LORD_CARDS
                .filter(card => card.type === 'upgrade')
                .map((card) => {
                    const action = card.effects?.find(effect => effect.action?.type === 'replaceAbility')?.action;
                    expect(action, `${card.id} 必须是替换基础技能的升级牌`).toMatchObject({ type: 'replaceAbility' });
                    return [card.id, action?.type === 'replaceAbility' ? action.targetAbilityId : null];
                }),
        );
        expect(upgradeTargets).toEqual({
            'upgrade-vampire-lord-undying-2': 'undying',
            'upgrade-vampire-lord-blood-thirst-2-blood-river': 'blood-thirst',
            'upgrade-vampire-lord-blood-magic-2-flayed': 'blood-magic',
            'upgrade-vampire-lord-blood-possessed-2-blood-addiction': 'blood-possessed',
            'upgrade-vampire-lord-rend-claws-2': 'rend-claws',
            'upgrade-vampire-lord-blood-feast-2-dressed-to-kill': 'blood-feast',
            'upgrade-vampire-lord-mesmerize-power-2-soul-gaze': 'mesmerize-power',
            'upgrade-vampire-lord-bloodthirsty-claws-3': 'bloodthirsty-claws',
            'upgrade-vampire-lord-bloodthirsty-claws-2': 'bloodthirsty-claws',
        });

        const upgradeVariantIds = Object.fromEntries(
            VAMPIRE_LORD_CARDS
                .filter(card => card.type === 'upgrade')
                .map((card) => {
                    const action = card.effects?.find(effect => effect.action?.type === 'replaceAbility')?.action;
                    const newAbilityDef = action?.type === 'replaceAbility'
                        ? action.newAbilityDef as { variants?: Array<{ id: string }> }
                        : undefined;
                    return [card.id, newAbilityDef?.variants?.map(variant => variant.id) ?? []];
                }),
        );
        expect(upgradeVariantIds['upgrade-vampire-lord-blood-thirst-2-blood-river']).toEqual([
            'blood-thirst-2-main',
            'blood-thirst-2-blood-river',
        ]);
        expect(upgradeVariantIds['upgrade-vampire-lord-blood-magic-2-flayed']).toEqual([
            'blood-magic-2-main',
            'blood-magic-2-flayed',
        ]);
        expect(upgradeVariantIds['upgrade-vampire-lord-blood-possessed-2-blood-addiction']).toEqual([
            'blood-possessed-2-main',
            'blood-possessed-2-blood-addiction',
        ]);
        expect(upgradeVariantIds['upgrade-vampire-lord-blood-feast-2-dressed-to-kill']).toEqual([
            'blood-feast-2-main',
            'blood-feast-2-dressed-to-kill',
        ]);
        expect(upgradeVariantIds['upgrade-vampire-lord-mesmerize-power-2-soul-gaze']).toEqual([
            'mesmerize-power-2-main',
            'mesmerize-power-2-soul-gaze',
        ]);
    });

    it('正式媒体、状态 atlas 和 5x7 卡牌 atlas 配置存在', () => {
        for (const file of ['player-board.webp', 'tip.webp', 'dice.webp', 'ability-cards.webp', 'status-icons-atlas.webp']) {
            expect(existsSync(assetRoot('xixuegui', 'compressed', file)), `吸血鬼领主缺少 ${file}`).toBe(true);
        }

        const statusAtlas = readJson<{ frames?: Record<string, unknown> }>(assetRoot('xixuegui', 'status-icons-atlas.json'));
        for (const frameId of [TOKEN_IDS.BLOOD_POWER, TOKEN_IDS.MESMERIZE, STATUS_IDS.BLEED]) {
            expect(statusAtlas.frames?.[frameId], `吸血鬼领主状态 atlas 缺少 ${frameId}`).toBeDefined();
        }

        const atlasConfig = readJson<{ imageW: number; imageH: number; rows: number; cols: number; rowStarts: number[]; colStarts: number[] }>(
            join(process.cwd(), 'src', 'assets', 'atlas-configs', 'dicethrone', 'ability-cards-vampire_lord.atlas.json'),
        );
        expect([atlasConfig.imageW, atlasConfig.imageH]).toEqual([900, 2048]);
        expect(atlasConfig.rows).toBe(7);
        expect(atlasConfig.cols).toBe(5);
        expect(atlasConfig.rowStarts).toHaveLength(7);
        expect(atlasConfig.colStarts).toHaveLength(5);
    });

    it('资源预加载、manifest 和中英文关键文本覆盖吸血鬼领主', () => {
        expect(ASSETS.PLAYER_BOARD('vampire_lord')).toBe('dicethrone/images/xixuegui/player-board');
        expect(ASSETS.TIP_BOARD('vampire_lord')).toBe('dicethrone/images/xixuegui/tip');
        expect(ASSETS.CARDS_ATLAS('vampire_lord')).toBe('dicethrone/images/xixuegui/ability-cards');
        expect(ASSETS.DICE_SPRITE('vampire_lord')).toBe('dicethrone/images/xixuegui/dice');
        expect(ASSETS.EFFECT_ICONS('vampire_lord')).toBe('dicethrone/images/xixuegui/status-icons-atlas');
        expect(criticalImages.getCharAssetsByTag('vampire_lord', 'gameplay')).toEqual(expect.arrayContaining([
            'dicethrone/images/xixuegui/player-board',
            'dicethrone/images/xixuegui/tip',
            'dicethrone/images/xixuegui/ability-cards',
            'dicethrone/images/xixuegui/dice',
            'dicethrone/images/xixuegui/status-icons-atlas',
        ]));

        const dicethroneManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'zh-CN', 'dicethrone', 'assets-manifest.json');
        const rootAssetManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'assets-manifest.json');
        const atlasManifest = join(process.cwd(), 'public', 'assets', 'atlas-configs', 'assets-manifest.json');
        for (const assetPath of [
            'images/xixuegui/compressed/player-board',
            'images/xixuegui/compressed/tip',
            'images/xixuegui/compressed/dice',
            'images/xixuegui/compressed/ability-cards',
            'images/xixuegui/compressed/status-icons-atlas',
            'images/xixuegui/status-icons-atlas',
        ]) {
            expect(manifestHas(dicethroneManifest, assetPath), `DiceThrone manifest 缺少 ${assetPath}`).toBe(true);
        }
        for (const assetPath of [
            'zh-CN/dicethrone/images/xixuegui/compressed/player-board',
            'zh-CN/dicethrone/images/xixuegui/compressed/tip',
            'zh-CN/dicethrone/images/xixuegui/compressed/dice',
            'zh-CN/dicethrone/images/xixuegui/compressed/ability-cards',
            'zh-CN/dicethrone/images/xixuegui/compressed/status-icons-atlas',
        ]) {
            expect(manifestHas(rootAssetManifest, assetPath), `根级资源 manifest 缺少 ${assetPath}`).toBe(true);
        }
        expect(manifestHas(atlasManifest, 'dicethrone/ability-cards-vampire_lord.atlas')).toBe(true);

        for (const locale of ['zh-CN', 'en']) {
            const data = readJson<Record<string, unknown>>(join(process.cwd(), 'public', 'locales', locale, 'game-dicethrone.json'));
            for (const key of VAMPIRE_LORD_I18N_KEYS) {
                expect(hasI18nKey(data, key), `${locale} 缺少 ${key}`).toBe(true);
            }
        }
    });
});
