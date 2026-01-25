/**
 * CardSystem - 卡牌系统核心实现
 */

import type { RandomFn } from '../../engine/types';
import type {
    CardDefinition,
    Card,
    CardZone,
    CardMoveOperation,
    DrawConfig,
    ICardSystem,
    CardFactory,
} from './types';
import { generateCardInstanceId } from './types';

/**
 * 默认卡牌工厂
 */
const defaultCardFactory: CardFactory = (definition, instanceId) => ({
    instanceId,
    definitionId: definition.id,
    definition,
    faceUp: false,
});

/**
 * 卡牌系统实现
 */
class CardSystemImpl implements ICardSystem {
    private definitions: Map<string, CardDefinition> = new Map();

    /**
     * 注册卡牌定义
     */
    registerDefinition(definition: CardDefinition): void {
        this.definitions.set(definition.id, definition);
    }

    /**
     * 批量注册卡牌定义
     */
    registerDefinitions(definitions: CardDefinition[]): void {
        definitions.forEach(def => this.registerDefinition(def));
    }

    /**
     * 获取卡牌定义
     */
    getDefinition(id: string): CardDefinition | undefined {
        return this.definitions.get(id);
    }

    /**
     * 创建牌库
     */
    createDeck(
        definitions: CardDefinition[],
        random: RandomFn,
        options: { copies?: number; zoneId?: string; ownerId?: string } = {}
    ): CardZone {
        const copies = options.copies ?? 1;
        const cards: Card[] = [];

        // 为每个定义创建指定数量的副本
        let instanceIndex = 0;
        for (const def of definitions) {
            for (let i = 0; i < copies; i++) {
                const instanceId = generateCardInstanceId(def.id, instanceIndex++);
                cards.push(defaultCardFactory(def, instanceId));
            }
        }

        // 洗牌
        const shuffledCards = random.shuffle(cards);

        return {
            id: options.zoneId ?? 'deck',
            type: 'deck',
            ownerId: options.ownerId,
            cards: shuffledCards,
            isPublic: false,
        };
    }

    /**
     * 抽牌
     */
    draw(
        zones: CardZone[],
        config: DrawConfig,
        _random?: RandomFn
    ): { zones: CardZone[]; drawnCards: Card[] } {
        const fromZone = zones.find(z => z.id === config.fromZoneId);
        const toZone = zones.find(z => z.id === config.toZoneId);

        if (!fromZone || !toZone) {
            return { zones, drawnCards: [] };
        }

        const drawnCards: Card[] = [];
        const newFromCards = [...fromZone.cards];
        const newToCards = [...toZone.cards];

        const count = Math.min(config.count, newFromCards.length);
        for (let i = 0; i < count; i++) {
            const card = config.from === 'bottom'
                ? newFromCards.pop()
                : newFromCards.shift();
            if (card) {
                drawnCards.push(card);
                newToCards.push(card);
            }
        }

        const newZones = zones.map(z => {
            if (z.id === config.fromZoneId) {
                return { ...z, cards: newFromCards };
            }
            if (z.id === config.toZoneId) {
                return { ...z, cards: newToCards };
            }
            return z;
        });

        return { zones: newZones, drawnCards };
    }

    /**
     * 移动卡牌
     */
    moveCard(zones: CardZone[], operation: CardMoveOperation): CardZone[] {
        const fromZone = zones.find(z => z.id === operation.fromZoneId);
        const toZone = zones.find(z => z.id === operation.toZoneId);

        if (!fromZone || !toZone) {
            return zones;
        }

        const cardIndex = fromZone.cards.findIndex(c => c.instanceId === operation.cardId);
        if (cardIndex === -1) {
            return zones;
        }

        const newFromCards = [...fromZone.cards];
        const [card] = newFromCards.splice(cardIndex, 1);

        const newToCards = [...toZone.cards];
        if (operation.toIndex !== undefined) {
            newToCards.splice(operation.toIndex, 0, card);
        } else {
            newToCards.push(card);
        }

        return zones.map(z => {
            if (z.id === operation.fromZoneId) {
                return { ...z, cards: newFromCards };
            }
            if (z.id === operation.toZoneId) {
                return { ...z, cards: newToCards };
            }
            return z;
        });
    }

    /**
     * 洗牌
     */
    shuffle(zone: CardZone, random: RandomFn): CardZone {
        return {
            ...zone,
            cards: random.shuffle([...zone.cards]),
        };
    }

    /**
     * 查找卡牌所在区域
     */
    findCardZone(zones: CardZone[], cardId: string): CardZone | undefined {
        return zones.find(z => z.cards.some(c => c.instanceId === cardId));
    }

    /**
     * 将弃牌堆洗入牌库
     */
    reshuffleDiscard(
        zones: CardZone[],
        discardZoneId: string,
        deckZoneId: string,
        random: RandomFn
    ): CardZone[] {
        const discardZone = zones.find(z => z.id === discardZoneId);
        const deckZone = zones.find(z => z.id === deckZoneId);

        if (!discardZone || !deckZone) {
            return zones;
        }

        // 合并弃牌堆到牌库并洗牌
        const combinedCards = [...deckZone.cards, ...discardZone.cards];
        const shuffledCards = random.shuffle(combinedCards);

        return zones.map(z => {
            if (z.id === deckZoneId) {
                return { ...z, cards: shuffledCards };
            }
            if (z.id === discardZoneId) {
                return { ...z, cards: [] };
            }
            return z;
        });
    }

    /**
     * 创建空区域
     */
    createZone(
        id: string,
        type: CardZone['type'],
        options: { ownerId?: string; isPublic?: boolean; maxSize?: number } = {}
    ): CardZone {
        return {
            id,
            type,
            ownerId: options.ownerId,
            cards: [],
            isPublic: options.isPublic ?? (type === 'discard'),
            maxSize: options.maxSize,
        };
    }
}

/** 卡牌系统单例 */
export const cardSystem = new CardSystemImpl();
