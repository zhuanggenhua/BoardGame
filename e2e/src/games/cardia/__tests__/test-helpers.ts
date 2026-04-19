/**
 * 测试辅助函数
 * 
 * 提供创建模拟数据的工具函数，确保数据结构正确
 */

import { createModifierStack } from '../../../engine/primitives/modifier';
import { createTagContainer } from '../../../engine/primitives/tags';
import type { CardInstance, CardiaCore, PlayerState } from '../domain/core-types';
import type { CardiaAbilityContext } from '../domain/abilityExecutor';
import type { PlayerId } from '../../../engine/types';
import type { FactionType } from '../domain/ids';
import { createFixedRandom } from './helpers/testRandom';

/**
 * 创建模拟卡牌实例
 */
export function createMockCard(overrides: Partial<CardInstance> = {}): CardInstance {
    return {
        uid: 'test_card_uid',
        defId: 'test_card_def',
        ownerId: 'player1',
        baseInfluence: 5,
        faction: 'swamp',
        abilityIds: [],
        difficulty: 1,
        modifiers: createModifierStack(),
        tags: createTagContainer(),
        signets: 0,
        ongoingMarkers: [],
        ...overrides,
    };
}

/**
 * 创建模拟玩家状态
 */
export function createMockPlayer(playerId: PlayerId, overrides: Partial<PlayerState> = {}): PlayerState {
    return {
        id: playerId,
        name: `Player ${playerId}`,
        hand: [],
        deck: [],
        discard: [],
        playedCards: [],
        signets: 0,
        tags: createTagContainer(),
        hasPlayed: false,
        cardRevealed: false,
        ...overrides,
    };
}

/**
 * 创建模拟游戏核心状态
 */
export function createMockCore(overrides: Partial<CardiaCore> = {}): CardiaCore {
    return {
        players: {
            'player1': createMockPlayer('player1'),
            'player2': createMockPlayer('player2'),
        },
        playerOrder: ['player1', 'player2'],
        currentPlayerId: 'player1',
        turnNumber: 1,
        phase: 'ability',
        encounterHistory: [],
        ongoingAbilities: [],
        modifierTokens: [],
        delayedEffects: [],
        revealFirstNextEncounter: null,
        mechanicalSpiritActive: null,
        deckVariant: 'deck_i',
        targetSignets: 5,
        ...overrides,
    };
}

/**
 * 创建模拟能力执行上下文
 */
export function createMockContext(overrides: Partial<CardiaAbilityContext> = {}): CardiaAbilityContext {
    const core = overrides.core || createMockCore();
    const playerId = overrides.playerId || 'player1';
    const opponentId = overrides.opponentId || 'player2';
    
    return {
        core,
        abilityId: 'test_ability',
        cardId: 'test_card',
        playerId,
        opponentId,
        sourceId: 'test_source',
        ownerId: playerId,
        timestamp: Date.now(),
        random: createFixedRandom(0.5),
        ...overrides,
    };
}

/**
 * 创建带有指定手牌的玩家
 */
export function createPlayerWithHand(
    playerId: PlayerId,
    handCards: Array<{ defId: string; baseInfluence: number; faction: FactionType }>
): PlayerState {
    return createMockPlayer(playerId, {
        hand: handCards.map((card, index) => createMockCard({
            uid: `${playerId}_card${index + 1}`,
            defId: card.defId,
            ownerId: playerId,
            baseInfluence: card.baseInfluence,
            faction: card.faction,
        })),
    });
}

/**
 * 创建带有指定牌库的玩家
 */
export function createPlayerWithDeck(
    playerId: PlayerId,
    deckCards: Array<{ defId: string; baseInfluence: number; faction: FactionType }>
): PlayerState {
    return createMockPlayer(playerId, {
        deck: deckCards.map((card, index) => createMockCard({
            uid: `${playerId}_deck${index + 1}`,
            defId: card.defId,
            ownerId: playerId,
            baseInfluence: card.baseInfluence,
            faction: card.faction,
        })),
    });
}

/**
 * 创建标准的测试上下文（用于大多数测试）
 */
export function createStandardTestContext(): CardiaAbilityContext {
    const mockCore = createMockCore({
        players: {
            'player1': createPlayerWithHand('player1', [
                { defId: 'test_card_1', baseInfluence: 5, faction: 'swamp' },
                { defId: 'test_card_2', baseInfluence: 3, faction: 'academy' },
            ]),
            'player2': createPlayerWithHand('player2', [
                { defId: 'test_card_3', baseInfluence: 7, faction: 'swamp' },
                { defId: 'test_card_4', baseInfluence: 2, faction: 'academy' },
                { defId: 'test_card_5', baseInfluence: 8, faction: 'guild' },
            ]),
        },
    });

    // 添加牌库
    mockCore.players['player1'].deck = [
        ...createPlayerWithDeck('player1', [
            { defId: 'test_deck_1', baseInfluence: 4, faction: 'guild' },
            { defId: 'test_deck_2', baseInfluence: 6, faction: 'dynasty' },
        ]).deck,
    ];

    mockCore.players['player2'].deck = [
        ...createPlayerWithDeck('player2', [
            { defId: 'test_deck_3', baseInfluence: 5, faction: 'dynasty' },
            { defId: 'test_deck_4', baseInfluence: 3, faction: 'swamp' },
            { defId: 'test_deck_5', baseInfluence: 4, faction: 'academy' },
        ]).deck,
    ];

    return createMockContext({ core: mockCore });
}

/**
 * 创建测试用卡牌实例（简化版，用于集成测试）
 * 
 * 支持两种调用方式：
 * 1. createTestCard('defId', { overrides }) - 传统方式
 * 2. createTestCard({ uid, owner, baseInfluence, ... }) - 对象方式（用于集成测试）
 */
export function createTestCard(defIdOrProps: string | Partial<CardInstance>, overrides?: Partial<CardInstance>): CardInstance {
    // 如果第一个参数是对象，使用对象方式
    if (typeof defIdOrProps === 'object') {
        const props = defIdOrProps;
        return {
            uid: props.uid || `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            defId: props.defId || 'test_card',
            ownerId: props.owner || 'player1',
            baseInfluence: props.baseInfluence ?? 5,
            faction: props.faction || 'swamp',
            abilityIds: props.abilityIds || [],
            difficulty: props.difficulty ?? 1,
            modifiers: props.modifiers || createModifierStack(),
            tags: props.tags || createTagContainer(),
            signets: props.signets ?? 0,
            ongoingMarkers: props.ongoingMarkers || [],
            ...props,
        };
    }
    
    // 传统方式：defId + overrides
    const defId = defIdOrProps;
    return {
        uid: `${defId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        defId,
        ownerId: 'player1',
        baseInfluence: 5,
        faction: 'swamp',
        abilityIds: [],
        difficulty: 1,
        modifiers: createModifierStack(),
        tags: createTagContainer(),
        signets: 0,
        ongoingMarkers: [],
        ...overrides,
    };
}

/**
 * 创建测试用场上卡牌（PlayedCard）
 * 
 * 支持两种调用方式：
 * 1. createTestPlayedCard('defId', encounterIndex, { overrides }) - 传统方式
 * 2. createTestPlayedCard({ uid, owner, baseInfluence, encounterIndex, ... }) - 对象方式（用于集成测试）
 */
export function createTestPlayedCard(
    defIdOrProps: string | (Partial<CardInstance> & { encounterIndex?: number }),
    encounterIndexOrOverrides?: number | Partial<CardInstance>,
    overrides?: Partial<CardInstance>
): CardInstance & { encounterIndex: number } {
    // 如果第一个参数是对象，使用对象方式
    if (typeof defIdOrProps === 'object') {
        const props = defIdOrProps;
        const card = createTestCard(props);
        return {
            ...card,
            encounterIndex: props.encounterIndex ?? 0,
        };
    }
    
    // 传统方式：defId + encounterIndex + overrides
    const defId = defIdOrProps;
    const encounterIndex = encounterIndexOrOverrides as number;
    return {
        ...createTestCard(defId, overrides),
        encounterIndex,
    };
}

/**
 * 常用测试卡牌 ID 常量
 */
export const TEST_CARDS = {
    // 组 1: 资源操作能力
    SABOTEUR: 'deck_i_card_05',
    REVOLUTIONARY: 'deck_ii_card_05',
    HEIR: 'deck_i_card_16',
    
    // 组 2: 影响力修正能力
    MERCENARY_SWORDSMAN: 'deck_i_card_01',
    SURGEON: 'deck_i_card_03',
    TAX_COLLECTOR: 'deck_ii_card_04',
    GENIUS: 'deck_ii_card_07',
    EMISSARY: 'deck_ii_card_04',
    INVENTOR: 'deck_i_card_15',
    CLOCKMAKER: 'deck_i_card_11',
    COURT_GUARD: 'deck_i_card_07',
    POISONER: 'deck_ii_card_01',
    LIBRARIAN: 'deck_ii_card_06',
    ENGINEER: 'deck_ii_card_11',
    TELEKINETIC_MAGE: 'deck_ii_card_02',
    MESSENGER: 'deck_ii_card_03',
    
    // 组 3: 持续能力
    MEDIATOR: 'deck_i_card_04',
    MAGISTRATE: 'deck_i_card_08',
    TREASURER: 'deck_i_card_12',
    ADVISOR: 'deck_ii_card_12',
    MECHANICAL_SPIRIT: 'deck_ii_card_15',
    
    // 组 4: 卡牌操作能力
    SWAMP_GUARD: 'deck_i_card_13',
    VOID_MAGE: 'deck_i_card_02',
    
    // 组 5: 能力复制能力
    GOVERNESS: 'deck_i_card_14',
    ILLUSIONIST: 'deck_ii_card_10',
    ELEMENTALIST: 'deck_ii_card_14',
    
    // 组 6: 特殊机制能力
    DIVINER: 'deck_i_card_06',
    PUPPETEER: 'deck_i_card_10',
    ARISTOCRAT: 'deck_ii_card_08',
    EXTORTIONIST: 'deck_ii_card_09',
    ELF: 'deck_i_card_16',
    
    // 组 7: 派系相关能力
    AMBUSHER: 'deck_i_card_09',
    WITCH_KING: 'deck_ii_card_13',
};

/**
 * 执行命令并自动解决所有交互
 * 
 * 用于测试中自动处理交互链，避免手动循环解决交互
 * 
 * @param state 当前状态
 * @param command 要执行的命令
 * @param random 随机函数
 * @param domain 游戏领域对象
 * @param autoConfirm 自动确认交互（默认 true）
 * @returns 最终状态
 */
export function executeAndResolveInteraction<TCore, TCommand>(
    state: any,
    command: TCommand,
    random: any,
    domain: any,
    autoConfirm: boolean = true
): any {
    // 执行命令
    let events = domain.execute(state, command, random);
    for (const event of events) {
        state = { ...state, core: domain.reduce(state.core, event) };
    }
    
    // 自动解决所有交互
    while (state.sys.interaction.current) {
        const interaction = state.sys.interaction.current;
        
        // 构造解决交互的命令
        const resolveCommand: any = {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: interaction.playerId,
            payload: {
                interactionId: interaction.id,
                response: autoConfirm ? { confirmed: true } : { confirmed: false }
            }
        };
        
        events = domain.execute(state, resolveCommand, random);
        for (const event of events) {
            state = { ...state, core: domain.reduce(state.core, event) };
        }
    }
    
    return state;
}
