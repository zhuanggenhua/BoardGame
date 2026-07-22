import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../domain';
import { DICETHRONE_CHARACTER_CATALOG } from '../domain/types';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getCharacterAbilitiesForFace, initHeroState } from '../domain/characters';
import { getDiceDefinition } from '../domain/diceRegistry';
import { getCustomActionMeta, getRegisteredCustomActionIds } from '../domain/effects';
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
import {
    CARPET_BOMBING_2,
    COUNTERMEASURES_2,
    COUNTERMEASURES_3,
    DRUM_MOVEMENT_2,
    EXPAND_BATTLEFIELD_2,
    FLANKING_2,
    SABRE_THRUST_2,
    STRATEGIC_SHIFT_2,
    WAR_MONGER_2,
    ZHANSHUJIA_ABILITIES,
} from '../heroes/zhanshujia/abilities';
import { CURSED_PIRATE_ABILITIES, CURSED_PIRATE_HUMAN_ABILITIES } from '../heroes/cursed_pirate/abilities';
import { _testExports as criticalImages } from '../criticalImageResolver';
import { getAbilitySlotIdForCharacter } from '../ui/abilitySlotMapping';
import { HERO_CARDS_MAP, getSlotAbilityId } from '../ui/abilityOverlayHelpers';
import { getPlayerBoardLayoutVersion } from '../ui/abilitySlotLayout';
import { ASSETS } from '../ui/assets';

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

const CURSED_PIRATE_ALL_ABILITIES = [
    ...CURSED_PIRATE_ABILITIES,
    ...CURSED_PIRATE_HUMAN_ABILITIES,
];

const ZHANSHUJIA_ALL_ABILITIES = [
    ...ZHANSHUJIA_ABILITIES,
    SABRE_THRUST_2,
    CARPET_BOMBING_2,
    WAR_MONGER_2,
    DRUM_MOVEMENT_2,
    FLANKING_2,
    EXPAND_BATTLEFIELD_2,
    STRATEGIC_SHIFT_2,
    COUNTERMEASURES_2,
    COUNTERMEASURES_3,
];

type EffectLike = {
    action?: unknown;
};

type EffectOwner = {
    id: string;
    effects?: EffectLike[];
    variants?: Array<{
        id: string;
        effects?: EffectLike[];
    }>;
};

const asActionRecord = (effect: EffectLike): Record<string, unknown> =>
    (effect.action ?? {}) as Record<string, unknown>;

const findAbility = (abilityId: string) => {
    const ability = CURSED_PIRATE_ALL_ABILITIES.find(entry => entry.id === abilityId);
    expect(ability, `未找到能力 ${abilityId}`).toBeDefined();
    return ability!;
};

const findCard = (cardId: string) => {
    const card = CURSED_PIRATE_CARDS.find(entry => entry.id === cardId);
    expect(card, `未找到卡牌 ${cardId}`).toBeDefined();
    return card!;
};

const findZhanshujiaCard = (cardId: string) => {
    const card = ZHANSHUJIA_CARDS.find(entry => entry.id === cardId);
    expect(card, `未找到战术家卡牌 ${cardId}`).toBeDefined();
    return card!;
};

const findZhanshujiaAbility = (abilityId: string, name?: string) => {
    const candidates = ZHANSHUJIA_ALL_ABILITIES.filter(entry => entry.id === abilityId);
    const ability = name
        ? candidates.find(entry => entry.name === name)
        : candidates[0];
    expect(ability, `未找到战术家能力 ${abilityId}${name ? ` / ${name}` : ''}`).toBeDefined();
    return ability!;
};

const findVariant = (abilityId: string, variantId: string) => {
    const ability = findAbility(abilityId);
    const variant = ability.variants?.find(entry => entry.id === variantId);
    expect(variant, `未找到变体 ${variantId}`).toBeDefined();
    return variant!;
};

const findZhanshujiaVariant = (abilityId: string, variantId: string, name?: string) => {
    const ability = findZhanshujiaAbility(abilityId, name);
    const variant = ability.variants?.find(entry => entry.id === variantId);
    expect(variant, `未找到战术家变体 ${variantId}`).toBeDefined();
    return variant!;
};

const getCustomActionIds = (owner: EffectOwner): string[] =>
    (owner.effects ?? [])
        .map(effect => asActionRecord(effect))
        .filter(action => action.type === 'custom')
        .map(action => String(action.customActionId));

const getRollDieAction = (owner: EffectOwner) => {
    const action = (owner.effects ?? [])
        .map(effect => asActionRecord(effect))
        .find(entry => entry.type === 'rollDie');
    expect(action, `${owner.id} 缺少 rollDie action`).toBeDefined();
    return action!;
};

const getConditionalFaces = (action: Record<string, unknown>): string[] =>
    ((action.conditionalEffects ?? []) as Array<Record<string, unknown>>).map(effect => String(effect.face));

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

    it('角色目录已切到完成态，不再保留 implementation_in_progress 徽标', () => {
        const zhanshujia = DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'zhanshujia');
        const cursedPirate = DICETHRONE_CHARACTER_CATALOG.find(character => character.id === 'cursed_pirate');

        expect(zhanshujia?.badges?.some(badge => badge.id === 'implementation_in_progress') ?? false).toBe(false);
        expect(cursedPirate?.badges?.some(badge => badge.id === 'implementation_in_progress') ?? false).toBe(false);
    });

    it('卡牌预览走各自 ability-cards atlas，通用牌映射沿用新规格合同', () => {
        expect(Object.keys(TREANT_NINJA_COMMON_ATLAS_INDEX)).toHaveLength(18);
        expect(TREANT_NINJA_COMMON_ATLAS_INDEX['card-unexpected']).toBe(32);

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

    it('玩家板技能槽映射覆盖两名新英雄，保证面板能力可作为真实 UI 入口', () => {
        expect(getPlayerBoardLayoutVersion('zhanshujia')).toBe('v2');
        expect(getPlayerBoardLayoutVersion('cursed_pirate')).toBe('v2');
        expect(HERO_CARDS_MAP.zhanshujia).toBe(ZHANSHUJIA_CARDS);
        expect(HERO_CARDS_MAP.cursed_pirate).toBe(CURSED_PIRATE_CARDS);

        expect({
            fist: getSlotAbilityId('zhanshujia', 'fist'),
            chi: getSlotAbilityId('zhanshujia', 'chi'),
            sky: getSlotAbilityId('zhanshujia', 'sky'),
            lotus: getSlotAbilityId('zhanshujia', 'lotus'),
            combo: getSlotAbilityId('zhanshujia', 'combo'),
            lightning: getSlotAbilityId('zhanshujia', 'lightning'),
            calm: getSlotAbilityId('zhanshujia', 'calm'),
            meditate: getSlotAbilityId('zhanshujia', 'meditate'),
            ultimate: getSlotAbilityId('zhanshujia', 'ultimate'),
        }).toEqual({
            fist: 'sabre-thrust',
            chi: 'carpet-bombing',
            sky: 'war-monger',
            lotus: 'drum-movement',
            combo: 'flanking',
            lightning: 'strategic-shift',
            calm: 'expand-battlefield',
            meditate: 'countermeasures',
            ultimate: 'high-ground',
        });

        expect({
            fist: getSlotAbilityId('cursed_pirate', 'fist'),
            chi: getSlotAbilityId('cursed_pirate', 'chi'),
            sky: getSlotAbilityId('cursed_pirate', 'sky'),
            lotus: getSlotAbilityId('cursed_pirate', 'lotus'),
            combo: getSlotAbilityId('cursed_pirate', 'combo'),
            lightning: getSlotAbilityId('cursed_pirate', 'lightning'),
            calm: getSlotAbilityId('cursed_pirate', 'calm'),
            meditate: getSlotAbilityId('cursed_pirate', 'meditate'),
            ultimate: getSlotAbilityId('cursed_pirate', 'ultimate'),
        }).toEqual({
            fist: 'soul-stab',
            chi: 'marked-for-death',
            sky: 'cursed',
            lotus: 'deep-sea-dive',
            combo: 'breath-of-death',
            lightning: 'soul-command',
            calm: 'undead-claw',
            meditate: 'still-wet-behind-ears',
            ultimate: 'merciless-curse',
        });

        expect({
            fist: getSlotAbilityId('cursed_pirate', 'fist', 'normal'),
            chi: getSlotAbilityId('cursed_pirate', 'chi', 'normal'),
            sky: getSlotAbilityId('cursed_pirate', 'sky', 'normal'),
            lotus: getSlotAbilityId('cursed_pirate', 'lotus', 'normal'),
            combo: getSlotAbilityId('cursed_pirate', 'combo', 'normal'),
            lightning: getSlotAbilityId('cursed_pirate', 'lightning', 'normal'),
            calm: getSlotAbilityId('cursed_pirate', 'calm', 'normal'),
            meditate: getSlotAbilityId('cursed_pirate', 'meditate', 'normal'),
            ultimate: getSlotAbilityId('cursed_pirate', 'ultimate', 'normal'),
        }).toEqual({
            fist: 'cutlass-stab',
            chi: 'make-your-mark',
            sky: 'human-cursed',
            lotus: 'walk-the-plank',
            combo: 'light-the-fuse',
            lightning: 'verdict-command',
            calm: 'astonishing',
            meditate: 'human-still-wet-behind-ears',
            ultimate: 'merciless-plunder',
        });

        expect(getAbilitySlotIdForCharacter('zhanshujia', 'carpet-bombing-2-main')).toBe('chi');
        expect(getAbilitySlotIdForCharacter('cursed_pirate', 'deep-sea-dive')).toBe('lotus');
    });

    it('咒缚海盗初始化能力集跟随玩家板朝向选择，并按真实开局进入 human 面', () => {
        const cursedState = initHeroState('0', 'cursed_pirate', {
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
            shuffle: <T>(arr: T[]) => [...arr],
        });
        expect(cursedState.playerBoardFace).toBe('normal');
        expect(cursedState.statusEffects[STATUS_IDS.CURSED_COIN]).toBe(3);
        expect(cursedState.abilities.some(ability => ability.id === 'soul-stab')).toBe(false);
        expect(cursedState.abilities.some(ability => ability.id === 'cutlass-stab')).toBe(true);

        const normalAbilities = getCharacterAbilitiesForFace('cursed_pirate', 'normal');
        expect(normalAbilities.map(ability => ability.id)).toEqual([
            'cutlass-stab',
            'make-your-mark',
            'human-cursed',
            'walk-the-plank',
            'light-the-fuse',
            'verdict-command',
            'astonishing',
            'human-still-wet-behind-ears',
            'merciless-plunder',
        ]);

        const cursedAbilities = getCharacterAbilitiesForFace('cursed_pirate', 'cursed');
        expect(cursedAbilities.map(ability => ability.id)).toEqual([
            'soul-stab',
            'marked-for-death',
            'cursed',
            'deep-sea-dive',
            'breath-of-death',
            'soul-command',
            'undead-claw',
            'still-wet-behind-ears',
            'merciless-curse',
        ]);

        const zhanshujiaAbilities = getCharacterAbilitiesForFace('zhanshujia');
        expect(zhanshujiaAbilities.map(ability => ability.id)).toEqual([
            'sabre-thrust',
            'carpet-bombing',
            'war-monger',
            'drum-movement',
            'flanking',
            'expand-battlefield',
            'strategic-shift',
            'countermeasures',
            'high-ground',
        ]);
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
        expect(ASSETS.PLAYER_BOARD('cursed_pirate', 'cursed')).toBe('dicethrone/images/cursed/player-board');
        expect(ASSETS.PLAYER_BOARD('cursed_pirate', 'normal')).toBe('dicethrone/images/cursed/human-player-board');
        expect(existsSync(assetRoot('cursed', 'human-player-board.png')), 'cursed 缺少 human-player-board.png').toBe(true);
        expect(existsSync(assetRoot('cursed', 'compressed', 'human-player-board.webp')), 'cursed 缺少 human-player-board.webp').toBe(true);

        for (const [heroDir, files] of Object.entries({
            zhanshujia: ['player-board.webp', 'tip.webp', 'ability-cards.webp', 'dice.webp', 'status-icons-atlas.webp'],
            cursed: ['player-board.webp', 'tip.webp', 'ability-cards.webp', 'dice.webp', 'status-icons-atlas.webp'],
        })) {
            for (const file of files) {
                expect(existsSync(assetRoot(heroDir, 'compressed', file)), `${heroDir} 缺少 ${file}`).toBe(true);
            }
        }
    });

    it('战术家升级 family 的共享 replace shell 与主要子 seam 保持固定', () => {
        const upgradeCards = ZHANSHUJIA_CARDS.filter(card => card.type === 'upgrade' && card.id.startsWith('upgrade-zhanshujia-'));
        expect(upgradeCards).toHaveLength(9);
        expect(upgradeCards.map(card => {
            const action = asActionRecord(card.effects[0]!);
            return {
                id: card.id,
                actionType: String(action.type),
                targetAbilityId: String(action.targetAbilityId),
                newAbilityLevel: Number(action.newAbilityLevel),
            };
        })).toEqual([
            { id: 'upgrade-zhanshujia-countermeasures-3', actionType: 'replaceAbility', targetAbilityId: 'countermeasures', newAbilityLevel: 3 },
            { id: 'upgrade-zhanshujia-countermeasures-2', actionType: 'replaceAbility', targetAbilityId: 'countermeasures', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-strategic-shift-2', actionType: 'replaceAbility', targetAbilityId: 'strategic-shift', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-expand-battlefield-2', actionType: 'replaceAbility', targetAbilityId: 'expand-battlefield', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-flanking-2', actionType: 'replaceAbility', targetAbilityId: 'flanking', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-drum-movement-2', actionType: 'replaceAbility', targetAbilityId: 'drum-movement', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-carpet-bombing-2', actionType: 'replaceAbility', targetAbilityId: 'carpet-bombing', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-war-monger-2', actionType: 'replaceAbility', targetAbilityId: 'war-monger', newAbilityLevel: 2 },
            { id: 'upgrade-zhanshujia-sabre-thrust-2', actionType: 'replaceAbility', targetAbilityId: 'sabre-thrust', newAbilityLevel: 2 },
        ]);

        const countermeasures2 = findZhanshujiaAbility('countermeasures', COUNTERMEASURES_2.name);
        const countermeasures3 = findZhanshujiaAbility('countermeasures', COUNTERMEASURES_3.name);
        expect(countermeasures2.effects?.[0]).toBeDefined();
        expect(countermeasures3.effects?.[0]).toBeDefined();
        const countermeasures2Action = asActionRecord(countermeasures2.effects?.[0]);
        const countermeasures3Action = asActionRecord(countermeasures3.effects?.[0]);
        expect(countermeasures2.trigger).toMatchObject({ type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 });
        expect(countermeasures3.trigger).toMatchObject({ type: 'phase', phaseId: 'defensiveRoll', diceCount: 5 });
        expect(countermeasures2Action.customActionId).toBe('zhanshujia-countermeasures-defense');
        expect(countermeasures3Action.customActionId).toBe('zhanshujia-countermeasures-defense');
        expect(countermeasures2Action.params).toMatchObject({ sabrePairDamage: 1 });
        expect(countermeasures3Action.params).toMatchObject({ sabrePairDamage: 2 });

        const flanking2Effects = findZhanshujiaAbility('flanking', FLANKING_2.name).effects ?? [];
        expect(flanking2Effects.map(effect => asActionRecord(effect).type)).toEqual(['grantToken', 'damage']);
        expect((asActionRecord(flanking2Effects[0]!).value)).toBe(2);
        expect((asActionRecord(flanking2Effects[1]!).value)).toBe(6);

        const sabreThrust2VariantIds = ['sabre-thrust-2-3', 'sabre-thrust-2-4', 'sabre-thrust-2-5']
            .map(variantId => getCustomActionIds(findZhanshujiaVariant('sabre-thrust', variantId, SABRE_THRUST_2.name)));
        expect(sabreThrust2VariantIds).toEqual([
            ['zhanshujia-bind-if-three-kind'],
            ['zhanshujia-bind-if-three-kind'],
            ['zhanshujia-bind-if-three-kind'],
        ]);

        expect(getCustomActionIds(findZhanshujiaAbility('war-monger', WAR_MONGER_2.name))).toEqual([
            'zhanshujia-war-monger-2-roll',
            'zhanshujia-war-monger-attack-damage',
        ]);
        expect(getCustomActionMeta('zhanshujia-war-monger-2-roll')?.categories).toEqual(['damage', 'token', 'card', 'other']);
    });

    it('战术家复合升级分支的 variant seam 保持固定', () => {
        const strategicShift2 = findZhanshujiaAbility('strategic-shift', STRATEGIC_SHIFT_2.name);
        expect(strategicShift2.variants?.map(variant => variant.id)).toEqual(['strategic-shift-2-main', 'strategic-shift-2-recon']);
        expect(findZhanshujiaVariant('strategic-shift', 'strategic-shift-2-main', STRATEGIC_SHIFT_2.name).tags).toEqual(['unblockable']);
        expect(findZhanshujiaVariant('strategic-shift', 'strategic-shift-2-recon', STRATEGIC_SHIFT_2.name).effects?.map(effect => asActionRecord(effect).type)).toEqual(['grantToken']);

        const drumMovement2 = findZhanshujiaAbility('drum-movement', DRUM_MOVEMENT_2.name);
        expect(drumMovement2.variants?.map(variant => variant.id)).toEqual(['drum-movement-2-main', 'drum-movement-2-indirect']);
        expect(findZhanshujiaVariant('drum-movement', 'drum-movement-2-indirect', DRUM_MOVEMENT_2.name).tags).toEqual(['unblockable']);
        expect(findZhanshujiaVariant('drum-movement', 'drum-movement-2-indirect', DRUM_MOVEMENT_2.name).effects?.map(effect => asActionRecord(effect).type)).toEqual(['grantToken', 'damage']);

        const expandBattlefield2 = findZhanshujiaAbility('expand-battlefield', EXPAND_BATTLEFIELD_2.name);
        expect(expandBattlefield2.variants?.map(variant => variant.id)).toEqual(['expand-battlefield-2-large-straight', 'expand-battlefield-2-lockdown']);
        expect(findZhanshujiaVariant('expand-battlefield', 'expand-battlefield-2-lockdown', EXPAND_BATTLEFIELD_2.name).effects?.map(effect => asActionRecord(effect).type)).toEqual(['drawCard', 'grantStatus']);

        const carpetBombing2 = findZhanshujiaAbility('carpet-bombing', CARPET_BOMBING_2.name);
        expect(carpetBombing2.variants?.map(variant => variant.id)).toEqual(['carpet-bombing-2-main', 'carpet-bombing-2-strategy']);
        expect(getCustomActionIds(findZhanshujiaVariant('carpet-bombing', 'carpet-bombing-2-main', CARPET_BOMBING_2.name))).toEqual(['zhanshujia-carpet-bombing-targets']);
        expect(findZhanshujiaVariant('carpet-bombing', 'carpet-bombing-2-strategy', CARPET_BOMBING_2.name).effects?.map(effect => asActionRecord(effect).type)).toEqual(['grantToken', 'drawCard']);
    });

    it('战术家奖励骰 family 的主阶段、防御与额外进攻 seam 保持固定', () => {
        const gainUpperHandRoll = getRollDieAction(findZhanshujiaCard('card-zhanshujia-gain-the-upper-hand'));
        expect(gainUpperHandRoll.diceCount).toBe(1);
        expect(getConditionalFaces(gainUpperHandRoll)).toEqual([ZHANSHUJIA_DICE_FACE_IDS.MEDAL]);
        expect(gainUpperHandRoll.defaultEffect).toBeDefined();

        expect(getCustomActionIds(findZhanshujiaCard('card-zhanshujia-war-room'))).toEqual(['zhanshujia-war-room-roll']);
        expect(getCustomActionMeta('zhanshujia-war-room-roll')?.categories).toEqual(['dice', 'token', 'card']);

        const warMonger = findZhanshujiaAbility('war-monger');
        expect(getCustomActionIds(warMonger)).toEqual([
            'zhanshujia-war-monger-roll',
            'zhanshujia-war-monger-attack-damage',
        ]);
        expect(getCustomActionMeta('zhanshujia-war-monger-roll')?.categories).toEqual(['damage', 'token', 'card', 'other']);
        expect(getCustomActionMeta('zhanshujia-war-monger-attack-damage')?.categories).toEqual(['damage']);

        const disengageRoll = getRollDieAction(findZhanshujiaCard('card-zhanshujia-disengage'));
        expect(disengageRoll.diceCount).toBe(1);
        expect(getConditionalFaces(disengageRoll)).toEqual([
            ZHANSHUJIA_DICE_FACE_IDS.SABRE,
            ZHANSHUJIA_DICE_FACE_IDS.BANNER,
            ZHANSHUJIA_DICE_FACE_IDS.MEDAL,
        ]);

        expect(getCustomActionIds(findZhanshujiaAbility('war-monger', WAR_MONGER_2.name))).toEqual([
            'zhanshujia-war-monger-2-roll',
            'zhanshujia-war-monger-attack-damage',
        ]);
        expect(getCustomActionMeta('zhanshujia-war-monger-2-roll')?.categories).toEqual(['damage', 'token', 'card', 'other']);
    });

    it('咒缚海盗奖励骰 family 的五类 dispatch seam 保持固定', () => {
        const registered = getRegisteredCustomActionIds();

        const weighAnchorRoll = getRollDieAction(findCard('card-cursed-pirate-weigh-anchor'));
        expect(weighAnchorRoll.diceCount).toBe(1);
        expect(getConditionalFaces(weighAnchorRoll)).toEqual([CURSED_PIRATE_DICE_FACE_IDS.SKULL]);
        expect(weighAnchorRoll.defaultEffect).toBeDefined();

        const blusterRoll = getRollDieAction(findCard('card-cursed-pirate-bluster'));
        expect(blusterRoll.diceCount).toBe(1);
        expect(getConditionalFaces(blusterRoll)).toEqual([
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            CURSED_PIRATE_DICE_FACE_IDS.SKULL,
        ]);

        const crowsNestActionIds = getCustomActionIds(findCard('card-cursed-pirate-crows-nest'));
        expect(crowsNestActionIds).toEqual(['cursed-pirate-crows-nest-roll']);
        expect(registered.has('cursed-pirate-crows-nest-roll')).toBe(true);
        expect(getCustomActionMeta('cursed-pirate-crows-nest-roll')?.categories).toEqual(['dice', 'card', 'choice']);

        const heftyActionIds = getCustomActionIds(findCard('card-cursed-pirate-hefty'));
        expect(heftyActionIds).toEqual(['cursed-pirate-hefty-roll']);
        expect(registered.has('cursed-pirate-hefty-roll')).toBe(true);
        expect(getCustomActionMeta('cursed-pirate-hefty-roll')?.categories).toEqual(['dice', 'card', 'resource']);

        const markedForDeathRoll = getRollDieAction(findAbility('marked-for-death'));
        expect(markedForDeathRoll.diceCount).toBe(4);
        expect(getConditionalFaces(markedForDeathRoll)).toEqual([
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            CURSED_PIRATE_DICE_FACE_IDS.SKULL,
        ]);
        const flayActionIds = getCustomActionIds(findCard('card-cursed-pirate-flay'));
        expect(flayActionIds).toEqual(['cursed-pirate-flay-roll']);
        expect(registered.has('cursed-pirate-flay-roll')).toBe(true);
        expect(getCustomActionMeta('cursed-pirate-flay-roll')?.categories).toEqual(['dice', 'damage', 'status']);

        const sipActionIds = getCustomActionIds(findCard('card-cursed-pirate-sip'));
        expect(sipActionIds).toEqual(['cursed-pirate-sip-choice']);
        expect(registered.has('cursed-pirate-sip-choice')).toBe(true);
        expect(getCustomActionMeta('cursed-pirate-sip-choice')?.categories).toEqual(['choice', 'status', 'dice']);
    });

    it('咒缚海盗诅咒金币的 direct writer、continuation 与双面差异 seam 已锁定到当前合同', () => {
        const registered = getRegisteredCustomActionIds();

        const markedForDeathRoll = getRollDieAction(findAbility('marked-for-death'));
        expect(getConditionalFaces(markedForDeathRoll)).toContain(CURSED_PIRATE_DICE_FACE_IDS.SKULL);

        const makeYourMarkRoll = getRollDieAction(findAbility('make-your-mark'));
        expect(makeYourMarkRoll.diceCount).toBe(3);
        expect(getConditionalFaces(makeYourMarkRoll)).toEqual([
            CURSED_PIRATE_DICE_FACE_IDS.CUTLASS,
            CURSED_PIRATE_DICE_FACE_IDS.LOOT,
            CURSED_PIRATE_DICE_FACE_IDS.SKULL,
        ]);

        const mercilessCurse = findAbility('merciless-curse');
        const mercilessCurseGrantIds = (mercilessCurse.effects ?? [])
            .map(effect => asActionRecord(effect))
            .filter(action => action.type === 'grantStatus')
            .map(action => String(action.statusId));
        expect(mercilessCurseGrantIds).toContain(STATUS_IDS.CURSED_COIN);

        expect(getCustomActionIds(findAbility('verdict-command'))).toEqual(['cursed-pirate-human-verdict-command']);
        expect(getCustomActionIds(findAbility('merciless-plunder'))).toEqual(['cursed-pirate-human-merciless-plunder']);
        expect(getCustomActionIds(findAbility('human-cursed'))).toEqual(['cursed-pirate-human-cursed-end-turn']);
        expect(getCustomActionIds(findAbility('astonishing'))).toEqual(['cursed-pirate-human-remove-cursed-coins-choice']);
        expect(getCustomActionIds(findCard('card-cursed-pirate-pirates-life'))).toEqual(['cursed-pirate-pirates-life']);

        for (const actionId of [
            'cursed-pirate-human-verdict-command',
            'cursed-pirate-human-merciless-plunder',
            'cursed-pirate-human-cursed-end-turn',
            'cursed-pirate-human-remove-cursed-coins-choice',
            'cursed-pirate-pirates-life',
            'cursed-pirate-still-wet-behind-ears-defense',
            'cursed-pirate-human-defense',
        ]) {
            expect(registered.has(actionId), `${actionId} 未注册`).toBe(true);
            expect(getCustomActionMeta(actionId)?.categories).toContain('status');
        }
    });

    it('咒缚海盗火药桶 family 的 writer seam 分层保持固定', () => {
        const registered = getRegisteredCustomActionIds();

        const soulStabVariantIds = ['soul-stab-3', 'soul-stab-4', 'soul-stab-5']
            .map(variantId => getCustomActionIds(findVariant('soul-stab', variantId)));
        expect(soulStabVariantIds).toEqual([
            ['cursed-pirate-powder-keg-if-three-kind'],
            ['cursed-pirate-powder-keg-if-three-kind'],
            ['cursed-pirate-powder-keg-if-three-kind'],
        ]);

        const cutlassStabVariantIds = ['cutlass-stab-3', 'cutlass-stab-4', 'cutlass-stab-5']
            .map(variantId => getCustomActionIds(findVariant('cutlass-stab', variantId)));
        expect(cutlassStabVariantIds).toEqual([
            ['cursed-pirate-human-powder-keg-if-four-kind'],
            ['cursed-pirate-human-powder-keg-if-four-kind'],
            ['cursed-pirate-human-powder-keg-if-four-kind'],
        ]);

        const lightTheFusePowderKeg = (findVariant('light-the-fuse', 'light-the-fuse-small').effects ?? [])
            .map(effect => asActionRecord(effect))
            .filter(action => action.type === 'grantStatus')
            .map(action => String(action.statusId));
        expect(lightTheFusePowderKeg).toEqual([STATUS_IDS.POWDER_KEG]);

        const breathOfDeathPowderKeg = (findVariant('breath-of-death', 'breath-of-death-small').effects ?? [])
            .map(effect => asActionRecord(effect))
            .filter(action => action.type === 'grantStatus')
            .map(action => String(action.statusId));
        expect(breathOfDeathPowderKeg).toContain(STATUS_IDS.POWDER_KEG);

        expect(getCustomActionIds(findAbility('merciless-curse'))).toContain('cursed-pirate-merciless-curse-powder-keg-targets');
        expect(getCustomActionIds(findCard('card-cursed-pirate-go-fish'))).toEqual(['cursed-pirate-go-fish-powder-keg-targets']);
        expect(getCustomActionIds(findCard('card-cursed-pirate-sip'))).toEqual(['cursed-pirate-sip-choice']);
        expect(getCustomActionIds(findCard('card-cursed-pirate-flay'))).toEqual(['cursed-pirate-flay-roll']);

        for (const actionId of [
            'cursed-pirate-powder-keg-if-three-kind',
            'cursed-pirate-human-powder-keg-if-four-kind',
            'cursed-pirate-merciless-curse-powder-keg-targets',
            'cursed-pirate-go-fish-powder-keg-targets',
            'cursed-pirate-sip-choice',
        ]) {
            expect(registered.has(actionId), `${actionId} 未注册`).toBe(true);
            expect(getCustomActionMeta(actionId)?.categories).toContain('status');
        }
    });
});
