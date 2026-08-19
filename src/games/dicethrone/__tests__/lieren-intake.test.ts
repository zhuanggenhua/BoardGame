import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import '../domain';
import { DICETHRONE_CHARACTER_CATALOG, hasDiceThroneTipBoard } from '../domain/types';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import { getCustomActionHandler, getCustomActionMeta } from '../domain/effects';
import {
    DICETHRONE_CARD_ATLAS_IDS,
    DICETHRONE_STATUS_ATLAS_IDS,
    LIEREN_DICE_FACE_IDS,
    STATUS_IDS,
    TOKEN_IDS,
} from '../domain/ids';
import { LIEREN_ABILITIES } from '../heroes/lieren/abilities';
import { LIEREN_CARDS } from '../heroes/lieren/cards';
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

const LIEREN_I18N_KEYS = [
    'characters.lieren',
    'hero.lieren',
    'config.dice.lieren.name',
    'dice.face.spear',
    'dice.face.claw',
    'dice.face.nyras_bond',
    'dice.face.sabertooth',
    'tokens.nyras_bond.name',
    'tokens.nyras_bond.description',
    'statusEffects.bleed.name',
    'statusEffects.bleed.description',
    'bonusDie.effect.lieren.savageForce.spear',
    'bonusDie.effect.lieren.savageForce.claw',
    'bonusDie.effect.lieren.savageForce.nyrasBond',
    'bonusDie.effect.lieren.savageForce.sabertooth',
    'bonusDie.effect.lieren.primitiveRoar.sabertooth',
    'bonusDie.effect.lieren.primitiveRoar.default',
    'bonusDie.effect.lieren.opportunisticStrike.spear',
    'bonusDie.effect.lieren.opportunisticStrike.claw',
    'bonusDie.effect.lieren.opportunisticStrike.nyrasBond',
    'bonusDie.effect.lieren.opportunisticStrike.sabertooth',
    'bonusDie.effect.lieren.pounce.spear',
    'bonusDie.effect.lieren.pounce.claw',
    'bonusDie.effect.lieren.savageClaw.bigBleed',
    'bonusDie.effect.lieren.savageClaw.bleed',
    'abilities.wild-force.name',
    'abilities.savage-force.name',
    'abilities.brutal-strike.name',
    'abilities.beast-force.name',
    'abilities.life-revival.name',
    'abilities.beast-instinct.name',
    'abilities.hunt-ambush.name',
    'abilities.kindred-bond.name',
    'abilities.jungle-fury.name',
    'cards.card-lieren-primitive-roar.name',
    'cards.card-lieren-regroup.name',
    'cards.card-lieren-opportunistic-strike.name',
    'cards.card-lieren-pounce.name',
    'cards.card-lieren-savage-claw.name',
    'cards.card-lieren-bloodline.name',
    'cards.upgrade-lieren-kindred-bond-3.name',
    'cards.upgrade-lieren-kindred-bond-2.name',
    'cards.upgrade-lieren-beast-force-2.name',
    'cards.upgrade-lieren-brutal-strike-2.name',
    'cards.upgrade-lieren-hunt-ambush-2.name',
    'cards.upgrade-lieren-beast-instinct-2.name',
    'cards.upgrade-lieren-life-revival-2.name',
    'cards.upgrade-lieren-savage-force-2.name',
    'cards.upgrade-lieren-wild-force-2.name',
];

describe('DiceThrone 女猎手录入与资源合同', () => {
    it('角色目录、骰面、角色板九槽和妮拉运行时入口已接入', () => {
        const character = DICETHRONE_CHARACTER_CATALOG.find(entry => entry.id === 'lieren');
        expect(character?.nameKey).toBe('characters.lieren');
        expect(hasDiceThroneTipBoard('lieren')).toBe(false);
        expect(CHARACTER_DATA_MAP.lieren.diceDefinitionId).toBe('lieren-dice');
        expect(CHARACTER_DATA_MAP.lieren.statusAtlasId).toBe(DICETHRONE_STATUS_ATLAS_IDS.LIEREN);
        expect(CHARACTER_DATA_MAP.lieren.statusAtlasPath).toBe('dicethrone/images/lieren/status-icons-atlas.json');
        expect(CHARACTER_DATA_MAP.lieren.initialTokens).toEqual({ [TOKEN_IDS.NYRAS_BOND]: 0 });
        expect(CHARACTER_DATA_MAP.lieren.initialStatusEffects).toEqual({ [STATUS_IDS.BLEED]: 0 });

        expect(getDiceDefinition('lieren-dice')?.faces.map(face => face.symbols[0])).toEqual([
            LIEREN_DICE_FACE_IDS.SPEAR,
            LIEREN_DICE_FACE_IDS.SPEAR,
            LIEREN_DICE_FACE_IDS.CLAW,
            LIEREN_DICE_FACE_IDS.CLAW,
            LIEREN_DICE_FACE_IDS.NYRAS_BOND,
            LIEREN_DICE_FACE_IDS.SABERTOOTH,
        ]);

        expect(LIEREN_ABILITIES).toHaveLength(9);
        expect(LIEREN_ABILITIES.map(ability => ability.id)).toEqual([
            'wild-force',
            'savage-force',
            'brutal-strike',
            'beast-force',
            'life-revival',
            'beast-instinct',
            'hunt-ambush',
            'kindred-bond',
            'jungle-fury',
        ]);
        expect(Object.fromEntries([
            ['fist', 'wild-force'],
            ['chi', 'savage-force'],
            ['sky', 'brutal-strike'],
            ['lotus', 'beast-force'],
            ['combo', 'life-revival'],
            ['lightning', 'beast-instinct'],
            ['calm', 'hunt-ambush'],
            ['meditate', 'kindred-bond'],
            ['ultimate', 'jungle-fury'],
        ].map(([slot]) => [slot, getSlotAbilityId('lieren', slot)]))).toEqual({
            fist: 'wild-force',
            chi: 'savage-force',
            sky: 'brutal-strike',
            lotus: 'beast-force',
            combo: 'life-revival',
            lightning: 'beast-instinct',
            calm: 'hunt-ambush',
            meditate: 'kindred-bond',
            ultimate: 'jungle-fury',
        });
        for (const abilityId of [
            'wild-force',
            'savage-force',
            'brutal-strike',
            'beast-force',
            'life-revival',
            'beast-instinct',
            'hunt-ambush',
            'kindred-bond',
            'jungle-fury',
        ]) {
            expect(getAbilitySlotIdForCharacter('lieren', abilityId)).not.toBeNull();
        }

        expect(getCustomActionHandler('lieren-nyra-effect')).toBeDefined();
        expect(getCustomActionMeta('lieren-nyra-effect')?.categories).toEqual(['token', 'resource']);
        expect(getCustomActionHandler('lieren-kindred-bond')).toBeDefined();
        expect(getCustomActionMeta('lieren-kindred-bond')?.categories).toEqual(['defense', 'damage', 'resource']);
    });

    it('女猎手卡牌全部走专属 ability-cards atlas，公共卡 slot-32 复用既有公共卡 ID', () => {
        expect(HERO_CARDS_MAP.lieren).toBe(LIEREN_CARDS);
        expect(LIEREN_CARDS).toHaveLength(33);
        expect(LIEREN_CARDS.filter(card => card.sourceAtlasIndex !== undefined).map(card => card.sourceAtlasIndex)).toEqual([
            17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
        ]);
        expect(LIEREN_CARDS.every(card => card.previewRef?.type === 'atlas')).toBe(true);
        expect(LIEREN_CARDS.every(card => card.previewRef?.type !== 'atlas' || card.previewRef.atlasId === DICETHRONE_CARD_ATLAS_IDS.LIEREN)).toBe(true);
        expect(LIEREN_CARDS.find(card => card.id === 'card-unexpected')?.previewRef).toMatchObject({
            type: 'atlas',
            atlasId: DICETHRONE_CARD_ATLAS_IDS.LIEREN,
            index: 32,
        });
        expect(LIEREN_CARDS.find(card => card.id === 'upgrade-lieren-beast-force-2')?.effects?.[0]?.action).toMatchObject({
            type: 'replaceAbility',
            targetAbilityId: 'beast-force',
            newAbilityLevel: 2,
        });
        const upgradeTargets = Object.fromEntries(
            LIEREN_CARDS
                .filter(card => card.type === 'upgrade')
                .map((card) => {
                    const action = card.effects?.find(effect => effect.action?.type === 'replaceAbility')?.action;
                    expect(action, `${card.id} 必须是替换基础技能的升级牌`).toMatchObject({ type: 'replaceAbility' });
                    return [card.id, action?.type === 'replaceAbility' ? action.targetAbilityId : null];
                }),
        );
        expect(upgradeTargets).toEqual({
            'upgrade-lieren-kindred-bond-3': 'kindred-bond',
            'upgrade-lieren-kindred-bond-2': 'kindred-bond',
            'upgrade-lieren-beast-force-2': 'beast-force',
            'upgrade-lieren-brutal-strike-2': 'brutal-strike',
            'upgrade-lieren-hunt-ambush-2': 'hunt-ambush',
            'upgrade-lieren-beast-instinct-2': 'beast-instinct',
            'upgrade-lieren-life-revival-2': 'life-revival',
            'upgrade-lieren-savage-force-2': 'savage-force',
            'upgrade-lieren-wild-force-2': 'wild-force',
        });
    });

    it('正式媒体、状态 atlas 和 33 格卡牌 atlas 配置存在', () => {
        for (const file of [
            'player-board.webp',
            'dice.webp',
            'ability-cards.webp',
            'status-icons-atlas.webp',
            'nyras-bond.webp',
            'bleed.webp',
        ]) {
            expect(existsSync(assetRoot('lieren', 'compressed', file)), `女猎手缺少 ${file}`).toBe(true);
        }

        const statusAtlas = readJson<{ frames?: Record<string, unknown> }>(assetRoot('lieren', 'status-icons-atlas.json'));
        for (const frameId of [TOKEN_IDS.NYRAS_BOND, STATUS_IDS.BLEED]) {
            expect(statusAtlas.frames?.[frameId], `女猎手状态 atlas 缺少 ${frameId}`).toBeDefined();
        }

        const atlasConfig = readJson<{ imageW: number; imageH: number; frames: unknown[] }>(
            join(process.cwd(), 'src', 'assets', 'atlas-configs', 'dicethrone', 'ability-cards-lieren.atlas.json'),
        );
        expect([atlasConfig.imageW, atlasConfig.imageH]).toEqual([900, 2048]);
        expect(atlasConfig.frames).toHaveLength(33);
    });

    it('资源预加载、两层 manifest 和中英文关键文本覆盖女猎手', () => {
        expect(ASSETS.PLAYER_BOARD('lieren')).toBe('dicethrone/images/lieren/player-board');
        expect(ASSETS.CARDS_ATLAS('lieren')).toBe('dicethrone/images/lieren/ability-cards');
        expect(ASSETS.DICE_SPRITE('lieren')).toBe('dicethrone/images/lieren/dice');
        expect(ASSETS.EFFECT_ICONS('lieren')).toBe('dicethrone/images/lieren/status-icons-atlas');
        expect(criticalImages.getCharAssetsByTag('lieren', 'gameplay')).toEqual(expect.arrayContaining([
            'dicethrone/images/lieren/player-board',
            'dicethrone/images/lieren/ability-cards',
            'dicethrone/images/lieren/dice',
            'dicethrone/images/lieren/status-icons-atlas',
        ]));
        expect(criticalImages.getCharAssetsByTag('lieren', 'selection')).not.toContain('dicethrone/images/lieren/tip');
        expect(criticalImages.getCharAssetsByTag('lieren', 'gameplay')).not.toContain('dicethrone/images/lieren/tip');

        const dicethroneManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'zh-CN', 'dicethrone', 'assets-manifest.json');
        const rootAssetManifest = join(process.cwd(), 'public', 'assets', 'i18n', 'assets-manifest.json');
        for (const assetPath of [
            'images/lieren/compressed/player-board',
            'images/lieren/compressed/dice',
            'images/lieren/compressed/ability-cards',
            'images/lieren/compressed/status-icons-atlas',
            'images/lieren/compressed/nyras-bond',
            'images/lieren/compressed/bleed',
            'images/lieren/status-icons-atlas',
        ]) {
            expect(manifestHas(dicethroneManifest, assetPath), `DiceThrone manifest 缺少 ${assetPath}`).toBe(true);
        }
        for (const assetPath of [
            'zh-CN/dicethrone/images/lieren/compressed/player-board',
            'zh-CN/dicethrone/images/lieren/compressed/dice',
            'zh-CN/dicethrone/images/lieren/compressed/ability-cards',
            'zh-CN/dicethrone/images/lieren/compressed/status-icons-atlas',
            'zh-CN/dicethrone/images/lieren/compressed/nyras-bond',
            'zh-CN/dicethrone/images/lieren/compressed/bleed',
        ]) {
            expect(manifestHas(rootAssetManifest, assetPath), `根级资源 manifest 缺少 ${assetPath}`).toBe(true);
        }

        for (const locale of ['zh-CN', 'en']) {
            const data = readJson<Record<string, unknown>>(join(process.cwd(), 'public', 'locales', locale, 'game-dicethrone.json'));
            for (const key of LIEREN_I18N_KEYS) {
                expect(hasI18nKey(data, key), `${locale} 缺少 ${key}`).toBe(true);
            }
        }
    });
});
