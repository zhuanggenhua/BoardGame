/**
 * DiceThrone 角色数据注册表
 * 用于解耦核心逻辑与具体角色数据
 */

import type { PlayerId, RandomFn } from '../../../engine/types';
import type { TokenDef } from '../../../systems/TokenSystem';
import type { AbilityCard, HeroState, SelectableCharacterId, Die, DieFace } from './types';
import { MONK_ABILITIES, MONK_TOKENS, MONK_INITIAL_TOKENS, getMonkStartingDeck } from '../monk';
import { BARBARIAN_ABILITIES, BARBARIAN_TOKENS, BARBARIAN_INITIAL_TOKENS, getBarbarianStartingDeck } from '../barbarian';
import { diceSystem } from '../../../systems/DiceSystem';
import { resourceSystem } from './resourceSystem';
import { RESOURCE_IDS } from './resources';
import { STATUS_IDS } from './ids';

export interface CharacterData {
    id: SelectableCharacterId;
    abilities: any[];
    tokens: TokenDef[];
    initialTokens: Record<string, number>;
    diceDefinitionId: string;
    getStartingDeck: (random: RandomFn) => AbilityCard[];
    initialAbilityLevels: Record<string, number>;
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
    },
    barbarian: BARBARIAN_DATA,
    pyromancer: { ...BARBARIAN_DATA, id: 'pyromancer' },
    shadow_thief: { ...BARBARIAN_DATA, id: 'shadow_thief' },
    moon_elf: { ...BARBARIAN_DATA, id: 'moon_elf' },
    paladin: { ...BARBARIAN_DATA, id: 'paladin' },
    ninja: { ...BARBARIAN_DATA, id: 'ninja' },
    treant: { ...BARBARIAN_DATA, id: 'treant' },
    vampire_lord: { ...BARBARIAN_DATA, id: 'vampire_lord' },
    cursed_pirate: { ...BARBARIAN_DATA, id: 'cursed_pirate' },
    gunslinger: { ...BARBARIAN_DATA, id: 'gunslinger' },
    samurai: { ...BARBARIAN_DATA, id: 'samurai' },
    tactician: { ...BARBARIAN_DATA, id: 'tactician' },
    huntress: { ...BARBARIAN_DATA, id: 'huntress' },
    seraph: { ...BARBARIAN_DATA, id: 'seraph' },
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
        const fullDeck = data.getStartingDeck({ shuffle: (arr) => arr }); // 不洗牌，获取原始定义
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
    };
}

/**
 * 为角色创建初始骰子
 */
export function createCharacterDice(characterId: SelectableCharacterId): Die[] {
    const data = CHARACTER_DATA_MAP[characterId];
    return Array.from({ length: 5 }, (_, index) => {
        const die = diceSystem.createDie(data.diceDefinitionId, { id: index, initialValue: 1 });
        return {
            ...die,
            symbol: die.symbol as DieFace | null,
        };
    });
}
