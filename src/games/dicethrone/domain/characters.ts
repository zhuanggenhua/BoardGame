/**
 * DiceThrone 角色数据注册表
 * 用于解耦核心逻辑与具体角色数据
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { TokenDef } from './tokenTypes';
import type { AbilityCard, HeroState, SelectableCharacterId, Die, DieFace } from './types';
import type { PassiveAbilityDef } from './passiveAbility';
import type { AbilityDef } from './combat';
import { MONK_ABILITIES, MONK_TOKENS, MONK_INITIAL_TOKENS, getMonkStartingDeck } from '../heroes/monk';
import { BARBARIAN_ABILITIES, BARBARIAN_TOKENS, BARBARIAN_INITIAL_TOKENS, getBarbarianStartingDeck } from '../heroes/barbarian';
import { PYROMANCER_ABILITIES, PYROMANCER_TOKENS, PYROMANCER_INITIAL_TOKENS, getPyromancerStartingDeck } from '../heroes/pyromancer';
import { MOON_ELF_ABILITIES, MOON_ELF_TOKENS, MOON_ELF_INITIAL_TOKENS, getMoonElfStartingDeck } from '../heroes/moon_elf';
import { SHADOW_THIEF_ABILITIES, SHADOW_THIEF_TOKENS, SHADOW_THIEF_INITIAL_TOKENS, getShadowThiefStartingDeck } from '../heroes/shadow_thief';
import { PALADIN_ABILITIES, PALADIN_TOKENS, PALADIN_INITIAL_TOKENS, getPaladinStartingDeck } from '../heroes/paladin';
import { PALADIN_TITHES_BASE } from '../heroes/paladin/abilities';
import { GUNSLINGER_ABILITIES, GUNSLINGER_TOKENS, GUNSLINGER_INITIAL_TOKENS, getGunslingerStartingDeck } from '../heroes/gunslinger';
import { SAMURAI_ABILITIES, SAMURAI_TOKENS, SAMURAI_INITIAL_TOKENS, getSamuraiStartingDeck } from '../heroes/samurai';
import { TREANT_ABILITIES, TREANT_TOKENS, TREANT_INITIAL_TOKENS, TREANT_PASSIVE_ABILITIES, getTreantStartingDeck } from '../heroes/treant';
import { NINJA_ABILITIES, NINJA_TOKENS, NINJA_INITIAL_TOKENS, getNinjaStartingDeck } from '../heroes/ninja';
import { ZHANSHUJIA_ABILITIES, ZHANSHUJIA_TOKENS, ZHANSHUJIA_INITIAL_TOKENS, ZHANSHUJIA_PASSIVE_ABILITIES, getZhanshujiaStartingDeck } from '../heroes/zhanshujia';
import { CURSED_PIRATE_ABILITIES, CURSED_PIRATE_TOKENS, CURSED_PIRATE_INITIAL_TOKENS, getCursedPirateStartingDeck, getCursedPirateAbilitiesForFace } from '../heroes/cursed_pirate';
import { ARTIFICER_ABILITIES, ARTIFICER_TOKENS, ARTIFICER_INITIAL_TOKENS, ARTIFICER_PASSIVE_ABILITIES, getArtificerStartingDeck } from '../heroes/artificer';
import { TIANSHI_ABILITIES, TIANSHI_TOKENS, TIANSHI_INITIAL_TOKENS, TIANSHI_INITIAL_STATUS_EFFECTS, getTianshiStartingDeck } from '../heroes/tianshi';
import { createDie } from '../../../engine/primitives';
import { getDiceDefinition } from './diceRegistry';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { STATUS_IDS, TOKEN_IDS, DICETHRONE_STATUS_ATLAS_IDS } from './ids';


export interface CharacterData {
    id: SelectableCharacterId;
    abilities: any[];
    getAbilitiesForFace?: (playerBoardFace?: HeroState['playerBoardFace']) => any[];
    tokens: TokenDef[];
    initialTokens: Record<string, number>;
    initialStatusEffects?: Record<string, number>;
    initialPlayerBoardFace?: HeroState['playerBoardFace'];
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

const CARD_LOOKUP_RANDOM = {
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => arr,
} as const;

const CHARACTER_UPGRADE_DEF_CACHE = new Map<SelectableCharacterId, Map<string, Map<number, AbilityDef>>>();

function cloneAbilityDefs<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function getCharacterUpgradeDefs(characterId: SelectableCharacterId): Map<string, Map<number, AbilityDef>> {
    const cached = CHARACTER_UPGRADE_DEF_CACHE.get(characterId);
    if (cached) {
        return cached;
    }

    const data = CHARACTER_DATA_MAP[characterId];
    const byAbilityId = new Map<string, Map<number, AbilityDef>>();

    for (const card of data.getStartingDeck(CARD_LOOKUP_RANDOM as any)) {
        for (const effect of card.effects ?? []) {
            const action = effect.action;
            if (
                action?.type !== 'replaceAbility'
                || !action.targetAbilityId
                || !action.newAbilityDef
                || typeof action.newAbilityLevel !== 'number'
            ) {
                continue;
            }

            const level = Math.trunc(action.newAbilityLevel);
            if (level <= 1) continue;

            const existing = byAbilityId.get(action.targetAbilityId) ?? new Map<number, AbilityDef>();
            existing.set(level, action.newAbilityDef as AbilityDef);
            byAbilityId.set(action.targetAbilityId, existing);
        }
    }

    CHARACTER_UPGRADE_DEF_CACHE.set(characterId, byAbilityId);
    return byAbilityId;
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
        'rage': 1,
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
    gunslinger: {
        id: 'gunslinger',
        abilities: GUNSLINGER_ABILITIES,
        tokens: GUNSLINGER_TOKENS,
        initialTokens: GUNSLINGER_INITIAL_TOKENS,
        diceDefinitionId: 'gunslinger-dice',
        getStartingDeck: getGunslingerStartingDeck,
        initialAbilityLevels: {
            'revolver': 1,
            'bounty-hunter': 1,
            'quick-draw': 1,
            'take-cover': 1,
            'showdown': 1,
            'deadeye': 1,
            'fan-the-hammer': 1,
            'duel': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.GUNSLINGER,
        statusAtlasPath: 'dicethrone/images/gunslinger/status-icons-atlas.json',
    },
    samurai: {
        id: 'samurai',
        abilities: SAMURAI_ABILITIES,
        tokens: SAMURAI_TOKENS,
        initialTokens: SAMURAI_INITIAL_TOKENS,
        diceDefinitionId: 'samurai-dice',
        getStartingDeck: getSamuraiStartingDeck,
        initialAbilityLevels: {
            'katana-slice': 1,
            'wakizashi': 1,
            'bushido': 1,
            'solemnity': 1,
            'budo': 1,
            'samurai-slot-06': 1,
            'masamune': 1,
            'stand-tall': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.SAMURAI,
        statusAtlasPath: 'dicethrone/images/samurai/status-icons-atlas.json',
    },
    treant: {
        id: 'treant',
        abilities: TREANT_ABILITIES,
        tokens: TREANT_TOKENS,
        initialTokens: TREANT_INITIAL_TOKENS,
        diceDefinitionId: 'treant-dice',
        getStartingDeck: getTreantStartingDeck,
        initialAbilityLevels: {
            'shattering-fist': 1,
            'tend-care': 1,
            'vengeful-vines': 1,
            'nature-touch': 1,
            'quiet-cultivation': 1,
            'wild-growth': 1,
            'wild-roar': 1,
            'rooted': 1,
            'forest-awakens': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.TREANT,
        statusAtlasPath: 'dicethrone/images/treant/status-icons-atlas.json',
        passiveAbilities: TREANT_PASSIVE_ABILITIES,
    },
    ninja: {
        id: 'ninja',
        abilities: NINJA_ABILITIES,
        tokens: NINJA_TOKENS,
        initialTokens: NINJA_INITIAL_TOKENS,
        diceDefinitionId: 'ninja-dice',
        getStartingDeck: getNinjaStartingDeck,
        initialAbilityLevels: {
            'slash': 1,
            'going-forward': 1,
            'poison-blade': 1,
            'shadow-step': 1,
            'death-blossom': 1,
            'smoke-screen': 1,
            'shadow-fang': 1,
            'blink': 1,
            'ninja-assassinate': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.NINJA,
        statusAtlasPath: 'dicethrone/images/ninja/status-icons-atlas.json',
    },
    zhanshujia: {
        id: 'zhanshujia',
        abilities: ZHANSHUJIA_ABILITIES,
        tokens: ZHANSHUJIA_TOKENS,
        initialTokens: ZHANSHUJIA_INITIAL_TOKENS,
        diceDefinitionId: 'zhanshujia-dice',
        getStartingDeck: getZhanshujiaStartingDeck,
        initialAbilityLevels: {
            'sabre-thrust': 1,
            'carpet-bombing': 1,
            'war-monger': 1,
            'drum-movement': 1,
            'flanking': 1,
            'expand-battlefield': 1,
            'strategic-shift': 1,
            'countermeasures': 1,
            'high-ground': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.ZHANSHUJIA,
        statusAtlasPath: 'dicethrone/images/zhanshujia/status-icons-atlas.json',
        passiveAbilities: ZHANSHUJIA_PASSIVE_ABILITIES,
    },
    cursed_pirate: {
        id: 'cursed_pirate',
        abilities: CURSED_PIRATE_ABILITIES,
        getAbilitiesForFace: getCursedPirateAbilitiesForFace,
        tokens: CURSED_PIRATE_TOKENS,
        initialTokens: CURSED_PIRATE_INITIAL_TOKENS,
        initialStatusEffects: {
            [STATUS_IDS.CURSED_COIN]: 3,
        },
        initialPlayerBoardFace: 'normal',
        diceDefinitionId: 'cursed_pirate-dice',
        getStartingDeck: getCursedPirateStartingDeck,
        initialAbilityLevels: {
            'soul-stab': 1,
            'marked-for-death': 1,
            'cursed': 1,
            'deep-sea-dive': 1,
            'breath-of-death': 1,
            'soul-command': 1,
            'undead-claw': 1,
            'still-wet-behind-ears': 1,
            'merciless-curse': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.CURSED_PIRATE,
        statusAtlasPath: 'dicethrone/images/cursed/status-icons-atlas.json',
    },
    artificer: {
        id: 'artificer',
        abilities: ARTIFICER_ABILITIES,
        tokens: ARTIFICER_TOKENS,
        initialTokens: ARTIFICER_INITIAL_TOKENS,
        diceDefinitionId: 'artificer-dice',
        getStartingDeck: getArtificerStartingDeck,
        initialAbilityLevels: {
            'wrench-strike': 1,
            'schematics': 1,
            'collect-parts': 1,
            'eureka': 1,
            'activate-bots': 1,
            'overclock': 1,
            'shock-bot': 1,
            'tinker': 1,
            'maximum-power': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.ARTIFICER,
        statusAtlasPath: 'dicethrone/images/artificial/status-icons-atlas.json',
        passiveAbilities: ARTIFICER_PASSIVE_ABILITIES,
    },
    tianshi: {
        id: 'tianshi',
        abilities: TIANSHI_ABILITIES,
        tokens: TIANSHI_TOKENS,
        initialTokens: TIANSHI_INITIAL_TOKENS,
        initialStatusEffects: TIANSHI_INITIAL_STATUS_EFFECTS,
        diceDefinitionId: 'tianshi-dice',
        getStartingDeck: getTianshiStartingDeck,
        initialAbilityLevels: {
            'holy-blade': 1,
            'holy-radiance': 1,
            'divine-purification': 1,
            'divine-punishment': 1,
            'triumphant-return': 1,
            'supreme-power': 1,
            'archangel-resolve': 1,
            'angelic-cloak': 1,
            'heavenly-severing': 1,
        },
        statusAtlasId: DICETHRONE_STATUS_ATLAS_IDS.TIANSHI,
        statusAtlasPath: 'dicethrone/images/tianshi/status-icons-atlas.json',
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
        playerBoardFace: data.initialPlayerBoardFace,
        // initialDeckCardIds 不包含在返回值中（已消费完毕，避免状态膨胀）
        resources,
        hand: startingHand,
        deck,
        discard: [],
        statusEffects: {
            [STATUS_IDS.KNOCKDOWN]: 0,
            ...(data.initialStatusEffects ?? {}),
        },
        tokens: { ...data.initialTokens },
        tokenStackLimits: Object.fromEntries(data.tokens.map(t => [t.id, t.stackLimit])),
        artificerBotState: characterId === 'artificer'
            ? {
                [TOKEN_IDS.NANOBOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
                [TOKEN_IDS.SHOCK_BOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
                [TOKEN_IDS.HEAL_BOT]: { built: false, upgraded: false, activationsUsedThisTurn: 0 },
            }
            : undefined,
        damageShields: [],
        abilityLevels: { ...data.initialAbilityLevels },
        abilities: buildHeroAbilitiesForFace(
            characterId,
            data.initialPlayerBoardFace,
            data.initialAbilityLevels,
        ),
        upgradeCardByAbilityId: {},
        passiveAbilities: data.passiveAbilities ? JSON.parse(JSON.stringify(data.passiveAbilities)) : undefined,
    };
}

export function getCharacterAbilitiesForFace(
    characterId: SelectableCharacterId,
    playerBoardFace?: HeroState['playerBoardFace'],
) {
    const data = CHARACTER_DATA_MAP[characterId];
    if (!data) {
        throw new Error(`[DiceThrone] Unknown characterId: ${characterId}`);
    }
    return data.getAbilitiesForFace
        ? data.getAbilitiesForFace(playerBoardFace)
        : data.abilities;
}

export function buildHeroAbilitiesForFace(
    characterId: SelectableCharacterId,
    playerBoardFace?: HeroState['playerBoardFace'],
    abilityLevels?: Record<string, number>,
): AbilityDef[] {
    const baseAbilities = cloneAbilityDefs(getCharacterAbilitiesForFace(characterId, playerBoardFace));
    if (!abilityLevels) {
        return baseAbilities;
    }

    const upgradeDefs = getCharacterUpgradeDefs(characterId);
    return baseAbilities.map((ability) => {
        const desiredLevel = Math.trunc(abilityLevels[ability.id] ?? 1);
        if (desiredLevel <= 1) {
            return ability;
        }

        const upgradedDef = upgradeDefs.get(ability.id)?.get(desiredLevel);
        if (!upgradedDef) {
            return ability;
        }

        return {
            ...cloneAbilityDefs(upgradedDef),
            id: ability.id,
        };
    });
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
