import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import '../domain';
import { DICETHRONE_CHARACTER_CATALOG } from '../domain/types';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import {
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    TIANSHI_DICE_FACE_IDS,
    STATUS_IDS,
    TOKEN_IDS,
} from '../domain/ids';
import { TIANSHI_ABILITIES } from '../heroes/tianshi/abilities';
import { TIANSHI_CARDS } from '../heroes/tianshi/cards';
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

const TIANSHi_I18N_KEYS = [
    'characters.tianshi',
    'hero.tianshi',
    'config.dice.tianshi.name',
    'dice.face.blade',
    'dice.face.wing',
    'dice.face.cross',
    'dice.face.shield',
    'tokens.flight.name',
    'tokens.flight.description',
    'tokens.divine_arrival.name',
    'tokens.divine_arrival.description',
    'tokens.dazzle.name',
    'tokens.dazzle.description',
    'statusEffects.dazzle.name',
    'statusEffects.dazzle.description',
    'choices.tianshi.player',
    'choices.tianshi.divinePurification.title',
    'choices.tianshi.gospelArrival.title',
    'choices.tianshi.divineCommand.title',
    'choices.tianshi.divineProtection.title',
    'choices.tianshi.takeoff.title',
    'choices.tianshi.divineArbitrationDazzle.title',
    'choices.tianshi.divineArbitrationFlight.title',
    'choices.tianshi.divineArbitrationPurify.title',
    'choices.tianshi.ascension.title',
    'bonusDie.effect.tianshi.flight',
    'bonusDie.effect.tianshi.dazzle',
    'bonusDie.effect.tianshi.triumphantReturn',
    'bonusDie.effect.tianshi.angelicCloak',
    'bonusDie.effect.tianshi.holyStrike',
    'bonusDie.effect.tianshi.angelicTactics',
    'bonusDie.effect.tianshi.supremeHoliness',
];

describe('DiceThrone 炽天使录入与资源合同', () => {
    it('角色目录、骰面、角色板九槽和专属卡牌图集合同完整', () => {
        const character = DICETHRONE_CHARACTER_CATALOG.find(entry => entry.id === 'tianshi');
        expect(character?.nameKey).toBe('characters.tianshi');
        expect(CHARACTER_DATA_MAP.tianshi.diceDefinitionId).toBe('tianshi-dice');
        expect(CHARACTER_DATA_MAP.tianshi.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.TIANSHI);
        expect(CHARACTER_DATA_MAP.tianshi.statusAtlasPath).toBe('dicethrone/images/tianshi/status-icons-atlas.json');

        expect(getDiceDefinition('tianshi-dice')?.faces.map(face => face.symbols[0])).toEqual([
            TIANSHI_DICE_FACE_IDS.BLADE,
            TIANSHI_DICE_FACE_IDS.BLADE,
            TIANSHI_DICE_FACE_IDS.BLADE,
            TIANSHI_DICE_FACE_IDS.WING,
            TIANSHI_DICE_FACE_IDS.CROSS,
            TIANSHI_DICE_FACE_IDS.SHIELD,
        ]);

        expect(TIANSHI_ABILITIES).toHaveLength(9);
        expect(TIANSHI_ABILITIES.map(ability => ability.id)).toEqual([
            'holy-blade',
            'holy-radiance',
            'divine-purification',
            'divine-punishment',
            'triumphant-return',
            'supreme-power',
            'archangel-resolve',
            'angelic-cloak',
            'heavenly-severing',
        ]);
        expect(Object.fromEntries([
            ['fist', 'holy-blade'],
            ['chi', 'holy-radiance'],
            ['sky', 'divine-purification'],
            ['lotus', 'divine-punishment'],
            ['combo', 'triumphant-return'],
            ['lightning', 'supreme-power'],
            ['calm', 'archangel-resolve'],
            ['meditate', 'angelic-cloak'],
            ['ultimate', 'heavenly-severing'],
        ].map(([slot]) => [slot, getSlotAbilityId('tianshi', slot)]))).toEqual({
            fist: 'holy-blade',
            chi: 'holy-radiance',
            sky: 'divine-purification',
            lotus: 'divine-punishment',
            combo: 'triumphant-return',
            lightning: 'supreme-power',
            calm: 'archangel-resolve',
            meditate: 'angelic-cloak',
            ultimate: 'heavenly-severing',
        });
        expect(HERO_CARDS_MAP.tianshi).toBe(TIANSHI_CARDS);
        expect(TIANSHI_CARDS).toHaveLength(33);
        expect(TIANSHI_CARDS.filter(card => card.sourceAtlasIndex !== undefined).map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]);
        expect(TIANSHI_CARDS.every(card => card.previewRef?.type === 'atlas')).toBe(true);
        expect(TIANSHI_CARDS.every(card => card.previewRef?.type !== 'atlas' || card.previewRef.atlasId === DICETHRONE_CARD_ATLAS_IDS.TIANSHI)).toBe(true);
        expect(TIANSHI_CARDS.find(card => card.id === 'card-unexpected')?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: DICETHRONE_CARD_ATLAS_IDS.TIANSHI,
            index: 32,
        });
        for (const abilityId of [
            'holy-blade',
            'holy-radiance',
            'divine-purification',
            'divine-punishment',
            'triumphant-return',
            'supreme-power',
            'archangel-resolve',
            'angelic-cloak',
            'heavenly-severing',
        ]) {
            expect(getAbilitySlotIdForCharacter('tianshi', abilityId)).not.toBeNull();
        }
    });

    it('正式压缩媒体、状态 atlas 和 5×7 卡牌 atlas 配置存在', () => {
        for (const file of ['player-board.webp', 'tip.webp', 'dice.webp', 'ability-cards.webp', 'status-icons-atlas.webp']) {
            expect(existsSync(assetRoot('tianshi', 'compressed', file)), `炽天使缺少 ${file}`).toBe(true);
        }

        const statusAtlas = readJson<{ frames?: Record<string, unknown> }>(assetRoot('tianshi', 'status-icons-atlas.json'));
        for (const frameId of [TOKEN_IDS.FLIGHT, STATUS_IDS.DAZZLE, TOKEN_IDS.DIVINE_ARRIVAL, 'guardian-angel']) {
            expect(statusAtlas.frames?.[frameId], `炽天使状态 atlas 缺少 ${frameId}`).toBeDefined();
        }

        const atlasConfig = readJson<{ rows: number; cols: number; rowStarts: number[]; colStarts: number[] }>(
            join(process.cwd(), 'src', 'assets', 'atlas-configs', 'dicethrone', 'ability-cards-tianshi.atlas.json'),
        );
        expect(atlasConfig.rows).toBe(7);
        expect(atlasConfig.cols).toBe(5);
        expect(atlasConfig.rowStarts).toHaveLength(7);
        expect(atlasConfig.colStarts).toHaveLength(5);
    });

    it('角色资源预加载路径、三份 manifest 和中英文关键文本都覆盖炽天使', () => {
        expect(ASSETS.PLAYER_BOARD('tianshi')).toBe('dicethrone/images/tianshi/player-board');
        expect(ASSETS.TIP_BOARD('tianshi')).toBe('dicethrone/images/tianshi/tip');
        expect(ASSETS.CARDS_ATLAS('tianshi')).toBe('dicethrone/images/tianshi/ability-cards');
        expect(ASSETS.DICE_SPRITE('tianshi')).toBe('dicethrone/images/tianshi/dice');
        expect(ASSETS.EFFECT_ICONS('tianshi')).toBe('dicethrone/images/tianshi/status-icons-atlas');
        expect(criticalImages.getCharAssetsByTag('tianshi', 'gameplay')).toEqual(expect.arrayContaining([
            'dicethrone/images/tianshi/player-board',
            'dicethrone/images/tianshi/tip',
            'dicethrone/images/tianshi/ability-cards',
            'dicethrone/images/tianshi/dice',
            'dicethrone/images/tianshi/status-icons-atlas',
        ]));

        const dicethroneManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'zh-CN', 'dicethrone', 'assets-manifest.json');
        const rootAssetManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'assets-manifest.json');
        const atlasManifest = join(process.cwd(), 'public', 'assets', 'atlas-configs', 'assets-manifest.json');
        for (const assetPath of [
            'images/tianshi/compressed/player-board',
            'images/tianshi/compressed/tip',
            'images/tianshi/compressed/dice',
            'images/tianshi/compressed/ability-cards',
            'images/tianshi/compressed/status-icons-atlas',
            'images/tianshi/status-icons-atlas',
        ]) {
            expect(manifestHas(dicethroneManifest, assetPath), `DiceThrone manifest 缺少 ${assetPath}`).toBe(true);
        }
        for (const assetPath of [
            'zh-CN/dicethrone/images/tianshi/compressed/player-board',
            'zh-CN/dicethrone/images/tianshi/compressed/tip',
            'zh-CN/dicethrone/images/tianshi/compressed/dice',
            'zh-CN/dicethrone/images/tianshi/compressed/ability-cards',
            'zh-CN/dicethrone/images/tianshi/compressed/status-icons-atlas',
        ]) {
            expect(manifestHas(rootAssetManifest, assetPath), `根级资源 manifest 缺少 ${assetPath}`).toBe(true);
        }
        expect(manifestHas(atlasManifest, 'dicethrone/ability-cards-tianshi.atlas')).toBe(true);

        for (const locale of ['zh-CN', 'en']) {
            const data = readJson<Record<string, unknown>>(join(process.cwd(), 'public', 'locales', locale, 'game-dicethrone.json'));
            for (const key of TIANSHi_I18N_KEYS) {
                expect(hasI18nKey(data, key), `${locale} 缺少 ${key}`).toBe(true);
            }
        }
    });
});
