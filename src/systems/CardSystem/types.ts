/**
 * CardSystem - 通用卡牌系统类型定义
 * 
 * 支持各类桌游卡牌机制：
 * - 手牌管理（DiceThrone、UNO）
 * - 牌库/弃牌堆（大部分卡牌游戏）
 * - 卡牌效果（与 AbilitySystem 集成）
 */

import type { RandomFn } from '../../engine/types';

// ============================================================================
// 卡牌定义（模板）
// ============================================================================

/**
 * 卡牌定义基础接口
 * 游戏可扩展此接口添加特定字段
 */
export interface CardDefinition {
    /** 唯一标识 */
    id: string;
    /** 显示名称（或 i18n key） */
    name: string;
    /** 描述（或 i18n key） */
    description?: string;
    /** 分类标签（用于筛选） */
    tags?: string[];
    /** 视觉资源 */
    assets?: {
        /** 图片路径 */
        image?: string;
        /** 图集索引 */
        atlasIndex?: number;
    };
}

/**
 * 可打出的卡牌定义
 */
export interface PlayableCardDefinition extends CardDefinition {
    /** 费用（资源消耗） */
    cost?: Record<string, number>;
    /** 打出时机 */
    timing?: string;
    /** 卡牌类型 */
    type?: string;
}

// ============================================================================
// 卡牌实例（运行时）
// ============================================================================

/**
 * 卡牌实例
 * 从定义创建，包含运行时状态
 */
export interface Card<TDef extends CardDefinition = CardDefinition> {
    /** 实例 ID（同一局游戏内唯一） */
    instanceId: string;
    /** 卡牌定义 ID */
    definitionId: string;
    /** 定义数据（内联，方便访问） */
    definition: TDef;
    /** 是否可见（对其他玩家） */
    faceUp?: boolean;
}

// ============================================================================
// 卡牌区域
// ============================================================================

/**
 * 卡牌区域类型
 */
export type CardZoneType =
    | 'deck'      // 牌库（面朝下）
    | 'hand'      // 手牌（私有）
    | 'discard'   // 弃牌堆（公开）
    | 'exile'     // 移除游戏（不可恢复）
    | 'play'      // 打出区（临时）
    | 'revealed'; // 展示区（临时公开）

/**
 * 卡牌区域
 */
export interface CardZone<TCard extends Card = Card> {
    /** 区域 ID */
    id: string;
    /** 区域类型 */
    type: CardZoneType;
    /** 所属玩家 ID（undefined = 公共） */
    ownerId?: string;
    /** 卡牌列表 */
    cards: TCard[];
    /** 是否对所有人可见 */
    isPublic: boolean;
    /** 最大容量（undefined = 无限） */
    maxSize?: number;
}

// ============================================================================
// 卡牌操作
// ============================================================================

/**
 * 卡牌移动操作
 */
export interface CardMoveOperation {
    /** 卡牌实例 ID */
    cardId: string;
    /** 来源区域 ID */
    fromZoneId: string;
    /** 目标区域 ID */
    toZoneId: string;
    /** 目标位置（undefined = 末尾） */
    toIndex?: number;
}

/**
 * 抽牌配置
 */
export interface DrawConfig {
    /** 抽牌数量 */
    count: number;
    /** 来源区域 ID */
    fromZoneId: string;
    /** 目标区域 ID */
    toZoneId: string;
    /** 从顶部还是底部抽取 */
    from?: 'top' | 'bottom';
}

// ============================================================================
// CardSystem 接口
// ============================================================================

/**
 * 卡牌系统接口
 */
export interface ICardSystem<TCard extends Card = Card> {
    /** 创建牌库（洗牌） */
    createDeck(
        definitions: CardDefinition[],
        random: RandomFn,
        options?: { copies?: number; zoneId?: string; ownerId?: string }
    ): CardZone<TCard>;

    /** 抽牌 */
    draw(
        zones: CardZone<TCard>[],
        config: DrawConfig,
        random?: RandomFn
    ): { zones: CardZone<TCard>[]; drawnCards: TCard[] };

    /** 移动卡牌 */
    moveCard(
        zones: CardZone<TCard>[],
        operation: CardMoveOperation
    ): CardZone<TCard>[];

    /** 洗牌 */
    shuffle(zone: CardZone<TCard>, random: RandomFn): CardZone<TCard>;

    /** 查找卡牌所在区域 */
    findCardZone(zones: CardZone<TCard>[], cardId: string): CardZone<TCard> | undefined;
}

// ============================================================================
// 辅助函数类型
// ============================================================================

/**
 * 创建卡牌实例的工厂函数类型
 */
export type CardFactory<TDef extends CardDefinition = CardDefinition, TCard extends Card<TDef> = Card<TDef>> = (
    definition: TDef,
    instanceId: string
) => TCard;

/**
 * 生成唯一实例 ID
 */
export const generateCardInstanceId = (definitionId: string, index: number): string => {
    return `${definitionId}-${index}-${Date.now()}`;
};
