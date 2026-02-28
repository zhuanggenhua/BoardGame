/**
 * DiceThrone 角色数据注册表
 * 用于解耦核心逻辑与具体角色数据
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { TokenDef } from './tokenTypes';
import type { AbilityCard, HeroState, SelectableCharacterId, Die, DieFace } from './types';
import type { PassiveAbilityDef } from './passiveAbility';
import { MONK_ABILITIES, MONK_TOKENS, MONK_INITIAL_TOKENS, getMonkStartingDeck } from '../heroes/monk';
import { BARBARIAN_ABILITIES, BARBARIAN_TOKENS, BARBARIAN_INITIAL_TOKENS, getBarbarianStartingDeck } from '../heroes/barbarian';
import { PYROMANCER_ABILITIES, PYROMANCER_TOKENS, PYROMANCER_INITIAL_TOKENS, getPyromancerStartingDeck } from '../heroes/pyromancer';
import { MOON_ELF_ABILITIES, MOON_ELF_TOKENS, MOON_ELF_INITIAL_TOKENS, getMoonElfStartingDeck } from '../heroes/moon_elf';
import { SHADOW_THIEF_ABILITIES, SHADOW_THIEF_TOKENS, SHADOW_THIEF_INITIAL_TOKENS, getShadowThiefStartingDeck } from '../heroes/shadow_thief';
import { PALADIN_ABILITIES, PALADIN_TOKENS, PALADIN_INITIAL_TOKENS, getPaladinStartingDeck } from '../heroes/paladin';
import { PALADIN_TITHES_BASE } from '../heroes/paladin/abilities';
import { createDie } from '../../../engine/primitives';
import { getDiceDefinition } from './diceRegistry';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from './ids';


export interface CharacterData {
    id: SelectableCharacterId;
    abilities: any[];
    tokens: TokenDef[];
    initialTokens: Record<string, number>;
    diceDefinitionId: string;
    getStartingDeck: (random: RandomFn) => AbilityCard[];
    initialAbilityLevels: Record<string, number>;
    /** 状态图集 ID（用于 VisualResolver） */
    statusAtlasId: string;
    /** 状态图集 JSON 路径 */
    statusAtlasPath: string;
    /** 被动能力定义（可选，如圣骑士教皇税） */
    passiveAbilities?: PassiveAbilityDef[];
}

const BARBARIAN_DATA: CharacterData = {
    id: 'barbarian',
    abilities: BARBARIAN_ABILITIES,
    tokens: BARBARIAN_TOKENS,
    initialTokens: BARBARIAN_INITIAL_TOKENS,
    diceDefinitionId: 'barbarian-dice',
    getStartingDeck: getBarbarianStartingDeck,
    initialAbilityLevels: {
        'slap': 1,
        'all-out-strike': 1,
        'powerful-strike': 1,
        'violent-assault': 1,
        'steadfast': 1,
        'suppress': 1,
        'reckless-strike': 1,
        'thick-skin': 1,
    },
    statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.BARBARIAN,
    statusAtlasPath: 'dicethrone/images/barbarian/status-icons-atlas.json',
};

export const CHARACTER_DATA_MAP: Record<SelectableCharacterId, CharacterData> = {
    monk: {
        id: 'monk',
        abilities: MONK_ABILITIES,
        tokens: MONK_TOKENS,
        initialTokens: MONK_INITIAL_TOKENS,
        diceDefinitionId: 'monk-dice',
        getStartingDeck: getMonkStartingDeck,
        initialAbilityLevels: {
            'fist-technique': 1,
            'zen-forget': 1,
            'harmony': 1,
            'lotus-palm': 1,
            'taiji-combo': 1,
            'thunder-strike': 1,
            'calm-water': 1,
            'meditation': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK,
        statusAtlasPath: 'dicethrone/images/monk/status-icons-atlas.json',
    },
    barbarian: BARBARIAN_DATA,
    pyromancer: {
        id: 'pyromancer',
        abilities: PYROMANCER_ABILITIES,
        tokens: PYROMANCER_TOKENS,
        initialTokens: PYROMANCER_INITIAL_TOKENS,
        diceDefinitionId: 'pyromancer-dice',
        getStartingDeck: getPyromancerStartingDeck,
        initialAbilityLevels: {
            'fireball': 1,
            'soul-burn': 1,
            'fiery-combo': 1,
            'meteor': 1,
            'pyro-blast': 1,
            'burn-down': 1,
            'ignite': 1,
            'magma-armor': 1,
            'ultimate-inferno': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.PYROMANCER,
        statusAtlasPath: 'dicethrone/images/pyromancer/status-icons-atlas.json',
    },
    shadow_thief: {
        id: 'shadow_thief',
        abilities: SHADOW_THIEF_ABILITIES,
        tokens: SHADOW_THIEF_TOKENS,
        initialTokens: SHADOW_THIEF_INITIAL_TOKENS,
        diceDefinitionId: 'shadow_thief-dice',
        getStartingDeck: getShadowThiefStartingDeck,
        initialAbilityLevels: {
            'dagger-strike': 1,
            'pickpocket': 1,
            'steal': 1,
            'kidney-shot': 1,
            'shadow-dance': 1,
            'cornucopia': 1,
            'shadow-shank': 1,
            'shadow-defense': 1,
            'fearless-riposte': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.SHADOW_THIEF,
        statusAtlasPath: 'dicethrone/images/shadow_thief/status-icons-atlas.json',
    },
    moon_elf: {
        id: 'moon_elf',
        abilities: MOON_ELF_ABILITIES,
        tokens: MOON_ELF_TOKENS,
        initialTokens: MOON_ELF_INITIAL_TOKENS,
        diceDefinitionId: 'moon_elf-dice',
        getStartingDeck: getMoonElfStartingDeck,
        initialAbilityLevels: {
            'longbow': 1,
            'covert-fire': 1,
            'covering-fire': 1,
            'exploding-arrow': 1,
            'entangling-shot': 1,
            'eclipse': 1,
            'blinding-shot': 1,
            'lunar-eclipse': 1,
            'elusive-step': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.MOON_ELF,
        statusAtlasPath: 'dicethrone/images/moon_elf/status-icons-atlas.json',
    },
    paladin: {
        id: 'paladin',
        abilities: PALADIN_ABILITIES,
        tokens: PALADIN_TOKENS,
        initialTokens: PALADIN_INITIAL_TOKENS,
        diceDefinitionId: 'paladin-dice',
        getStartingDeck: getPaladinStartingDeck,
        initialAbilityLevels: {
            'righteous-combat': 1,
            'blessing-of-might': 1,
            'holy-strike': 1,
            'holy-light': 1,
            'vengeance': 1,
            'righteous-prayer': 1,
            'holy-defense': 1,
            'unyielding-faith': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.PALADIN,
        statusAtlasPath: 'dicethrone/images/paladin/status-icons-atlas.json',
        passiveAbilities: [PALADIN_TITHES_BASE],
    },
};

/**
 * DiceThrone 全量 Token 定义（按 id 去重）
 */
export const ALL_TOKEN_DEFINITIONS: TokenDef[] = (() => {
    const tokens: TokenDef[] = [];
    const seen = new Set<string>();
    Object.values(CHARACTER_DATA_MAP).forEach(data => {
        data.tokens.forEach(token => {
            if (seen.has(token.id)) return;
            seen.add(token.id);
            tokens.push(token);
        });
    });
    return tokens;
})();

/**
 * 根据角色 ID 初始化玩家状态
 * 
 * @param playerId 玩家 ID
 * @param characterId 角色 ID
 * @param random 随机函数（用于洗牌）
 * @param initialDeckCardIds 可选的初始牌库顺序（来自 CHARACTER_SELECTED 事件）
 *                           如果提供，将使用该顺序而非重新洗牌（确保事件数据驱动）
 */
export function initHeroState(
    playerId: PlayerId,
    characterId: SelectableCharacterId,
    random: RandomFn,
    initialDeckCardIds?: string[]
): HeroState {
    const data = CHARACTER_DATA_MAP[characterId];
    if (!data) {
        throw new Error(`[DiceThrone] Unknown characterId: ${characterId}`);
    }

    let deck: AbilityCard[];

    // 如果提供了初始牌库顺序（来自 CHARACTER_SELECTED 事件），使用该顺序
    if (initialDeckCardIds && initialDeckCardIds.length > 0) {
        // 从卡牌定义中查找对应的完整卡牌对象
        const fullDeck = data.getStartingDeck({
            shuffle: <T>(arr: T[]) => arr,
            random: () => 0.5,
            d: (_n: number) => 1,
            range: (min: number, _max: number) => min
        } as any); // 不洗牌，获取原始定义
        const cardMap = new Map(fullDeck.map(card => [card.id, card]));

        // 按 initialDeckCardIds 的顺序重建牌库
        deck = initialDeckCardIds
            .map(id => cardMap.get(id))
            .filter((card): card is AbilityCard => card !== undefined);

        // 安全检查：如果顺序不完整，回退到重新洗牌
        if (deck.length !== fullDeck.length) {
            console.warn(`[DiceThrone] initialDeckCardIds 不完整 (${deck.length}/${fullDeck.length})，回退到重新洗牌`);
            deck = data.getStartingDeck(random);
        }
    } else {
        // 没有提供顺序，使用随机洗牌（向后兼容）
        deck = data.getStartingDeck(random);
    }

    const startingHand = deck.splice(0, 4);

    // 创建初始资源池
    const resources = resourceSystem.createPool([RESOURCE_IDS.CP, RESOURCE_IDS.HP]);

    return {
        id: `player-${playerId}`,
        characterId,
        // initialDeckCardIds 不包含在返回值中（已消费完毕，避免状态膨胀）
        resources,
        hand: startingHand,
        deck,
        discard: [],
        statusEffects: {
            [STATUS_IDS.KNOCKDOWN]: 0,
        },
        tokens: { ...data.initialTokens },
        tokenStackLimits: Object.fromEntries(data.tokens.map(t => [t.id, t.stackLimit])),
        damageShields: [],
        abilities: data.abilities,
        abilityLevels: { ...data.initialAbilityLevels },
        upgradeCardByAbilityId: {},
        passiveAbilities: data.passiveAbilities ? [...data.passiveAbilities] : undefined,
    };
}

/**
 * 为角色创建初始骰子
 */
export function createCharacterDice(characterId: SelectableCharacterId): Die[] {
    const data = CHARACTER_DATA_MAP[characterId];
    const definition = getDiceDefinition(data.diceDefinitionId);
    if (!definition) {
        throw new Error(`[DiceThrone] 未注册骰子定义: ${data.diceDefinitionId}`);
    }
    return Array.from({ length: 5 }, (_, index) => {
        const die = createDie(definition, index, { initialValue: 1 });
        return {
            ...die,
            symbol: die.symbol as DieFace | null,
        };
    });
}
