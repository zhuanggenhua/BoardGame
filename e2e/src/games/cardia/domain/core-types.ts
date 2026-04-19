import type { PlayerId } from '../../../engine/types';
import type { ModifierStack } from '../../../engine/primitives/modifier';
import type { TagContainer } from '../../../engine/primitives/tags';
import type { FactionId, PhaseId, DeckVariantId, AbilityId } from './ids';

/**
 * 游戏阶段定义
 */
export type GamePhase = PhaseId;

export const PHASE_ORDER: GamePhase[] = [
    'play',      // 阶段1：打出卡牌
    'ability',   // 阶段2：激活能力
    'end',       // 阶段3：回合结束
];

/**
 * 派系类型（四大派系）
 */
export type FactionType = FactionId;

/**
 * 卡牌实例
 */
export interface CardInstance {
    // 基础标识
    uid: string;              // 运行时唯一ID
    defId: string;            // 卡牌定义ID
    ownerId: PlayerId;        // 拥有者玩家ID
    
    // 卡牌属性
    baseInfluence: number;    // 基础影响力值 (1-16)
    faction: FactionType;     // 派系
    abilityIds: AbilityId[];  // 能力ID列表
    difficulty: number;       // 难度等级 (0-5)
    
    // 运行时状态
    modifiers: ModifierStack<CardiaContext>;  // 影响力修正栈
    tags: TagContainer;       // 状态标签
    signets: number;          // 印戒标记数量（放在这张牌上的印戒）
    ongoingMarkers: AbilityId[];  // 持续能力标记列表（🔄标记）
    
    // 元数据
    imageIndex?: number;      // 图集索引（已废弃，使用 imagePath）
    imagePath?: string;       // 图片路径（不含扩展名，不含 compressed/）
}

/**
 * 场上卡牌（遭遇序列中的卡牌）
 */
export interface PlayedCard {
    // 继承 CardInstance 的所有字段
    uid: string;
    defId: string;
    ownerId: PlayerId;
    baseInfluence: number;
    faction: FactionType;
    abilityIds: AbilityId[];
    difficulty: number;
    modifiers: ModifierStack<CardiaContext>;
    tags: TagContainer;
    signets: number;          // 这张牌上的印戒数量
    ongoingMarkers: AbilityId[];  // 持续能力标记列表
    imageIndex?: number;
    imagePath?: string;
    
    // PlayedCard 特有字段
    encounterIndex: number;   // 遭遇序号（第几次遭遇，从1开始）
}

/**
 * 遭遇战状态
 */
export interface EncounterState {
    // 当前遭遇
    player1Card: CardInstance;
    player2Card: CardInstance;
    
    // 影响力计算
    player1Influence: number;  // 最终影响力（含修正）
    player2Influence: number;
    
    // 结果
    winnerId?: PlayerId;       // 胜利者ID (undefined = 平局)
    loserId?: PlayerId;        // 失败者ID
}

/**
 * 玩家状态
 */
export interface PlayerState {
    id: PlayerId;
    name: string;
    
    // 区域
    hand: CardInstance[];
    deck: CardInstance[];
    discard: CardInstance[];
    playedCards: PlayedCard[];  // 场上卡牌（遭遇序列）
    
    // 游戏状态（已废弃，改为从 playedCards 计算）
    signets: number;          // 印戒数量 (0-5) - 已废弃，使用 getTotalSignets() 计算
    tags: TagContainer;       // 玩家状态标签
    
    // 当前回合状态
    currentCard?: CardInstance;  // 本回合打出的卡牌
    hasPlayed: boolean;       // 本回合是否已打出卡牌
    cardRevealed: boolean;    // 卡牌是否已翻开（暗牌机制）
}

/**
 * 修正标记
 */
export interface ModifierToken {
    cardId: string;         // 目标卡牌 ID
    value: number;          // 修正值（+1/-3/+5）
    source: string;         // 来源能力 ID
    timestamp: number;      // 放置时间戳
}

/**
 * 持续能力
 */
export interface OngoingAbility {
    abilityId: string;      // 能力 ID
    cardId: string;         // 卡牌 ID
    playerId: PlayerId;     // 拥有者
    effectType: string;     // 效果类型（从 abilityRegistry 获取）
    timestamp: number;      // 激活时间戳
    encounterIndex?: number; // 可选：影响的遭遇索引（调停者使用）
    targetCardId?: string;   // 可选：目标卡牌 ID（财务官使用）
    targetPlayerId?: PlayerId; // 可选：目标玩家 ID（财务官使用）
}

/**
 * 延迟效果
 */
export interface DelayedEffect {
    effectType: string;
    target: 'self' | 'opponent';
    value?: number;
    condition: string;      // 触发条件
    sourceAbilityId: string;
    sourcePlayerId: PlayerId;
    timestamp: number;
}

/**
 * 游戏核心状态
 */
export interface CardiaCore {
    // 玩家
    players: Record<PlayerId, PlayerState>;
    playerOrder: [PlayerId, PlayerId];  // [player1Id, player2Id]
    
    // 回合状态
    currentPlayerId: PlayerId;
    turnNumber: number;
    phase: GamePhase;
    
    // 遭遇战
    currentEncounter?: EncounterState;
    previousEncounter?: EncounterState;  // 上一次遭遇（用于顾问能力）
    encounterHistory: EncounterState[];  // 完整历史（用于空间关系查询）
    
    // 能力系统状态（影响规则判定，符合 Core 状态准入条件）
    ongoingAbilities: OngoingAbility[];     // 持续能力列表（影响遭遇结算）
    modifierTokens: ModifierToken[];        // 修正标记列表（影响影响力计算）
    delayedEffects: DelayedEffect[];        // 延迟效果列表（影响下次打牌）
    
    // 特殊状态标记（影响规则判定）
    revealFirstNextEncounter: PlayerId | null;  // 下次遭遇先揭示的玩家（占卜师能力）
    forcedPlayOrderNextEncounter: PlayerId | null;  // 下次遭遇强制先出牌的玩家（占卜师能力）
    mechanicalSpiritActive: {                   // 机械精灵状态（影响胜利条件）
        playerId: PlayerId;
        cardId: string;
    } | null;
    gameWonBy?: PlayerId;                       // 游戏胜利标记（精灵能力等直接获胜）
    inventorPending?: {                         // 发明家能力待续标记
        playerId: PlayerId;
        timestamp: number;
        firstCardId: string;                    // 第一次选择的卡牌 ID
        triggeringCardId?: string;              // ✅ 触发能力的卡牌 ID（女导师/发明家本身）
    };
    
    // 游戏设置
    deckVariant: DeckVariantId;  // 牌组变体
    targetSignets: number;       // 目标印戒数（默认5）
}

/**
 * Cardia 上下文（用于能力执行）
 */
export interface CardiaContext {
    core: CardiaCore;
    playerId: PlayerId;
    sourceCardUid?: string;
    // 其他上下文字段根据需要添加
}
