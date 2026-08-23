/**
 * Cardia AI Runtime
 * 
 * 实现基于策略标签的 AI 决策系统，复用引擎层 AI 框架。
 * 支持打牌阶段决策、能力激活决策和交互选择决策。
 */

import type { MatchState, PlayerId } from '../../engine/types';
import type {
    AiLegalAction,
    AiStrategyProfile,
    BuildGameAiLegalActionsArgs,
    GameAiRuntime,
    LocalAiPolicy,
    LocalAiActionScorer,
} from '../../engine/ai';
import {
    buildAiOwnedBlockingInteractionFallbackActions,
    createAiLegalActionId,
    createScoredLocalAiPolicy,
    withAiActionStrategyTags,
    createProfileAwareActionScorer,
} from '../../engine/ai';
import type { CardiaCore, CardInstance } from './domain/types';
import { CARDIA_COMMANDS } from './domain/commands';
import { abilityRegistry } from './domain/abilityRegistry';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';

/**
 * Cardia 策略标签
 */
export type CardiaStrategyTag =
    | 'aggro'        // 进攻型：打出高影响力卡牌，争夺印戒
    | 'control'      // 控制型：使用修正标记和控制能力
    | 'economy'      // 经济型：抽牌、回收资源
    | 'tempo'        // 节奏型：激活即时能力
    | 'value';       // 价值型：激活持续能力

/**
 * 策略配置文件
 */
export interface CardiaStrategyProfile extends AiStrategyProfile<CardiaStrategyTag> {
    tags: CardiaStrategyTag[];
    tagWeights: Partial<Record<CardiaStrategyTag, number>>;
    summary: string[];
}

/**
 * 动作元数据
 */
export interface CardiaActionMetadata {
    // 打牌动作
    cardUid?: string;
    cardInfluence?: number;
    cardFaction?: string;
    cardAbilityCount?: number;
    
    // 能力动作
    abilityId?: string;
    abilityType?: 'instant' | 'ongoing';
    expectedSignetChange?: number;
    expectedInfluenceChange?: number;
    
    // 交互选择
    targetCardUid?: string;
    targetFaction?: string;
    modifierValue?: number;
    
    // 策略标签
    strategyTags?: CardiaStrategyTag[];
}

/**
 * 卡牌价值评估参数
 */
const CARD_VALUE_WEIGHTS = {
    INFLUENCE_BASE: 10,      // 基础影响力权重
    INFLUENCE_HIGH: 15,      // 高影响力(≥12)额外权重
    ABILITY_COUNT: 20,       // 每个能力的权重
    FACTION_BONUS: 5,        // 派系匹配奖励
};

/**
 * 能力价值评估参数
 */
const ABILITY_VALUE_WEIGHTS = {
    INSTANT_BASE: 30,        // 即时能力基础价值
    ONGOING_BASE: 50,        // 持续能力基础价值
    SIGNET_CHANGE: 100,      // 印戒变化权重
    INFLUENCE_CHANGE: 15,    // 影响力变化权重
    DRAW_CARD: 25,           // 抽牌价值
    RECYCLE_CARD: 20,        // 回收卡牌价值
};

/**
 * 游戏状态评估参数
 */
const STATE_EVAL_WEIGHTS = {
    SIGNET_DIFF: 200,        // 印戒差距权重
    HAND_SIZE_DIFF: 15,      // 手牌数量差距权重
    FIELD_CARD_DIFF: 30,     // 场上卡牌数量差距权重
    ONGOING_ABILITY_DIFF: 40, // 持续能力数量差距权重
};

/**
 * 预设策略配置
 */
const STRATEGY_PROFILES: Record<string, CardiaStrategyProfile> = {
    // 进攻型：优先打出高影响力卡牌，争夺印戒
    aggro: {
        tags: ['aggro', 'tempo'],
        tagWeights: {
            aggro: 2.0,
            tempo: 1.5,
            value: 0.5,
            control: 0.3,
            economy: 0.2,
        },
        summary: ['优先打出高影响力卡牌', '争夺印戒', '激活即时能力'],
    },
    
    // 防守型：优先使用修正标记和控制能力
    control: {
        tags: ['control', 'value'],
        tagWeights: {
            control: 2.0,
            value: 1.5,
            economy: 1.0,
            tempo: 0.5,
            aggro: 0.3,
        },
        summary: ['使用修正标记', '激活控制能力', '保持资源优势'],
    },
    
    // 平衡型：均衡考虑各类动作
    balanced: {
        tags: ['aggro', 'control', 'value'],
        tagWeights: {
            aggro: 1.0,
            control: 1.0,
            value: 1.0,
            tempo: 0.8,
            economy: 0.8,
        },
        summary: ['均衡考虑影响力和能力', '根据场面调整策略'],
    },
};

const CARDIA_AI_INTERACTION_ADAPTER_KINDS = ['simple-choice'];

/**
 * 构建合法动作
 */
function buildCardiaAiLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[] {
    const { state, playerId } = args;
    
    try {
        const core = state.core as CardiaCore;
        const interactionActions = buildInteractionActions(state as MatchState<CardiaCore>, playerId);
        if (interactionActions !== null) {
            return interactionActions;
        }

        switch (core.phase) {
            case 'play':
                return buildPlayCardActions(core, playerId);
            case 'ability':
                return buildAbilityActions(core, playerId);
            case 'end':
                return buildEndTurnActions(core, playerId);
            default:
                return [];
        }
    } catch (error) {
        const fallbackActions = buildAiOwnedBlockingInteractionFallbackActions({
            playerId,
            state: state as MatchState<unknown>,
            legalActions: [],
            adapterInteractionKinds: CARDIA_AI_INTERACTION_ADAPTER_KINDS,
        });
        if (fallbackActions.length > 0) return fallbackActions;
        void error;
        return [];
    }
}

/**
 * 生成打牌动作
 */
function buildPlayCardActions(
    core: CardiaCore,
    playerId: PlayerId,
): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    const player = core.players[playerId];
    
    if (!player) {
        return actions;
    }

    if (player.hasPlayed) {
        return actions;
    }

    const forcedPlayer = core.forcedPlayOrderNextEncounter;
    if (forcedPlayer) {
        const forcedPlayerState = core.players[forcedPlayer];
        if (forcedPlayerState && !forcedPlayerState.hasPlayed && playerId !== forcedPlayer) {
            return actions;
        }
    }
    
    // 枚举手牌中所有卡牌
    for (const card of player.hand) {
        const influence = card.baseInfluence;
        const abilityCount = card.abilityIds.length;
        
        // 确定策略标签
        const strategyTags: CardiaStrategyTag[] = [];
        if (influence >= 12) {
            strategyTags.push('aggro');
        }
        if (abilityCount > 0) {
            strategyTags.push('value');
        }
        
        actions.push({
            actionId: createAiLegalActionId('play-card', card.uid),
            kind: 'play-card',
            label: `打出卡牌 ${card.defId}`,
            commands: [{
                type: CARDIA_COMMANDS.PLAY_CARD,
                payload: { cardUid: card.uid, slotIndex: 0 },
            }],
            metadata: withAiActionStrategyTags({
                cardUid: card.uid,
                cardInfluence: influence,
                cardFaction: card.faction,
                cardAbilityCount: abilityCount,
            }, strategyTags),
        });
    }
    
    return actions;
}

/**
 * 生成能力动作
 */
function buildAbilityActions(
    core: CardiaCore,
    playerId: PlayerId,
): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    
    // 检查是否有输掉的卡牌可以激活能力
    const loserCard = getLoserCard(core, playerId);
    if (!loserCard) {
        return [];
    }
    
    // 生成激活能力动作
    for (const abilityId of loserCard.abilityIds) {
        const abilityDef = abilityRegistry.get(abilityId);
        if (!abilityDef) continue;
        
        const strategyTags: CardiaStrategyTag[] = [];
        if (abilityDef.isInstant) {
            strategyTags.push('tempo');
        }
        if (abilityDef.isOngoing) {
            strategyTags.push('value');
        }
        
        actions.push({
            actionId: createAiLegalActionId('activate-ability', abilityId),
            kind: 'activate-ability',
            label: `激活能力 ${abilityId}`,
            commands: [{
                type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
                payload: { abilityId, sourceCardUid: loserCard.uid },
            }],
            metadata: withAiActionStrategyTags({
                abilityId,
                abilityType: abilityDef.isOngoing ? 'ongoing' : 'instant',
            }, strategyTags),
        });
    }
    
    // 生成跳过能力动作
    actions.push({
        actionId: createAiLegalActionId('skip-ability'),
        kind: 'skip-ability',
        label: '跳过能力',
        commands: [{
            type: CARDIA_COMMANDS.SKIP_ABILITY,
            payload: { playerId },
        }],
        metadata: withAiActionStrategyTags({}, ['economy']), // 跳过能力保留资源
    });
    
    return actions;
}

function buildEndTurnActions(
    core: CardiaCore,
    playerId: PlayerId,
): AiLegalAction[] {
    if (core.currentPlayerId !== playerId) {
        return [];
    }

    return [{
        actionId: createAiLegalActionId('end-turn'),
        kind: 'end-turn',
        label: '结束回合',
        commands: [{
            type: CARDIA_COMMANDS.END_TURN,
            payload: {},
        }],
        metadata: withAiActionStrategyTags({}, ['economy']),
    }];
}

/**
 * 获取输掉遭遇战的卡牌
 */
function getLoserCard(_core: CardiaCore, _playerId: PlayerId): CardInstance | null {
    const encounter = _core.currentEncounter;
    if (!encounter || encounter.loserId !== _playerId) {
        return null;
    }
    
    // 返回失败者的卡牌
    return encounter.loserId === _core.playerOrder[0]
        ? encounter.player1Card
        : encounter.player2Card;
}

/**
 * 生成交互动作
 */
function buildInteractionActions(
    state: MatchState<CardiaCore>,
    playerId: PlayerId,
): AiLegalAction[] | null {
    const current = state.sys.interaction?.current;
    if (!current) return null;
    if (current.playerId !== playerId) return [];

    switch (current.kind) {
        case 'simple-choice': {
            const actions = buildSimpleChoiceActions(state, current);
            return actions.length > 0
                ? actions
                : buildAiOwnedBlockingInteractionFallbackActions({
                    playerId,
                    state: state as MatchState<unknown>,
                    legalActions: actions,
                    adapterInteractionKinds: CARDIA_AI_INTERACTION_ADAPTER_KINDS,
                });
        }
        default:
            return buildAiOwnedBlockingInteractionFallbackActions({
                playerId,
                state: state as MatchState<unknown>,
                legalActions: [],
                adapterInteractionKinds: CARDIA_AI_INTERACTION_ADAPTER_KINDS,
            });
    }
}

/**
 * 构建 simple-choice 交互的 payload
 * 将 option.value 展开到 payload 中，确保服务器端能够正确处理
 * 
 * @param optionIds - 选项 ID 列表
 * @param multi - 多选配置
 * @param mergedValue - 选项的 value 字段（需要展开到 payload 中）
 * @returns payload 对象
 */
function buildSimpleChoicePayload(
    interactionId: string | undefined,
    optionIds: string[],
    multi: { min?: number; max?: number } | undefined,
    mergedValue?: unknown,
): unknown {
    if (multi) {
        return { 
            ...(interactionId ? { interactionId } : {}),
            optionIds,
        };
    }
    return { 
        ...(interactionId ? { interactionId } : {}),
        optionId: optionIds[0], 
        ...(mergedValue && typeof mergedValue === 'object' ? mergedValue : {}) 
    };
}

/**
 * 生成 simple-choice 交互动作
 */
function buildSimpleChoiceActions(
    state: MatchState<CardiaCore>,
    interaction: unknown,
): AiLegalAction[] {
    const actions: AiLegalAction[] = [];
    
    // Extract data from interaction
    const interactionObj = interaction as { 
        id?: string;
        data?: {
            options?: Array<{ 
                id?: string; 
                label?: string; 
                disabled?: boolean;
                value?: unknown;  // 选项的值对象（需要展开到 payload 中）
            }>;
            multi?: { min?: number; max?: number };
        };
    };
    
    const data = interactionObj.data ?? {};

    const availableOptions = (data.options ?? []).filter((option): option is { 
        id: string; 
        label?: string;
        value?: unknown;
    } => {
        const hasId = typeof option.id === 'string';
        const notDisabled = option.disabled !== true;
        return hasId && notDisabled;
    });

    // 单选模式
    if (!data.multi) {
        return availableOptions.map((option, index) => ({
            actionId: createAiLegalActionId('interaction', String(interactionObj.id ?? ''), option.id),
            kind: 'interaction-choice',
            label: option.label ?? `选择 ${index + 1}`,
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: buildSimpleChoicePayload(interactionObj.id, [option.id], data.multi, option.value),
            }],
            metadata: {
                interactionId: interactionObj.id,
                optionId: option.id,
            },
        }));
    }
    
    const minCount = data.multi.min ?? 1;
    const maxCount = data.multi.max ?? minCount;
    const selectionCount = Math.min(Math.max(minCount, 1), maxCount, availableOptions.length);
    if (selectionCount < minCount) {
        return actions;
    }
    const selectedOptions = availableOptions.slice(0, selectionCount);
    const optionIds = selectedOptions.map((option) => option.id);

    actions.push({
        actionId: createAiLegalActionId('interaction', String(interactionObj.id ?? ''), optionIds.join('+')),
        kind: 'interaction-choice',
        label: selectedOptions.map((option, index) => option.label ?? `选择 ${index + 1}`).join(' + '),
        commands: [{
            type: INTERACTION_COMMANDS.RESPOND,
            payload: buildSimpleChoicePayload(interactionObj.id, optionIds, data.multi),
        }],
        metadata: {
            interactionId: interactionObj.id,
            optionIds,
        },
    });
    
    return actions;
}

/**
 * 获取玩家总印戒数
 */
function getTotalSignets(core: CardiaCore, playerId: PlayerId): number {
    const player = core.players[playerId];
    if (!player) return 0;
    
    return player.playedCards.reduce((sum, card) => sum + card.signets, 0);
}

/**
 * 获取对手玩家ID
 */
function getOpponentId(core: CardiaCore, playerId: PlayerId): PlayerId {
    return core.playerOrder.find((id) => id !== playerId) ?? core.playerOrder[0];
}

/**
 * 评估卡牌价值
 */
function evaluateCardValue(
    card: CardInstance,
    core: CardiaCore,
    playerId: PlayerId,
): number {
    const player = core.players[playerId];
    if (!player) return 0;
    
    let score = 0;
    
    // 基础影响力价值
    score += card.baseInfluence * CARD_VALUE_WEIGHTS.INFLUENCE_BASE;
    
    // 高影响力奖励
    if (card.baseInfluence >= 12) {
        score += CARD_VALUE_WEIGHTS.INFLUENCE_HIGH;
    }
    
    // 能力数量价值
    score += card.abilityIds.length * CARD_VALUE_WEIGHTS.ABILITY_COUNT;
    
    // 派系匹配奖励（场上已有同派系卡牌）
    const hasSameFaction = player.playedCards.some((playedCard) => playedCard.faction === card.faction);
    if (hasSameFaction) {
        score += CARD_VALUE_WEIGHTS.FACTION_BONUS;
    }
    
    return score;
}

/**
 * 评估能力价值
 */
function evaluateAbilityValue(
    abilityId: string,
    _core: CardiaCore,
    _playerId: PlayerId,
): number {
    const abilityDef = abilityRegistry.get(abilityId);
    if (!abilityDef) return 0;
    
    let score = 0;
    
    // 基础价值（即时 vs 持续）
    if (abilityDef.isOngoing) {
        score += ABILITY_VALUE_WEIGHTS.ONGOING_BASE;
    } else {
        score += ABILITY_VALUE_WEIGHTS.INSTANT_BASE;
    }
    
    // 根据效果类型评估价值
    for (const effect of abilityDef.effects) {
        switch (effect.type) {
            case 'extraSignet':
                // 印戒变化（最高价值）
                score += ABILITY_VALUE_WEIGHTS.SIGNET_CHANGE;
                break;
            case 'modifyInfluence':
                // 影响力修改
                score += Math.abs(effect.modifierValue ?? 0) * ABILITY_VALUE_WEIGHTS.INFLUENCE_CHANGE;
                break;
            case 'draw':
                // 抽牌
                score += (effect.value ?? 1) * ABILITY_VALUE_WEIGHTS.DRAW_CARD;
                break;
            case 'recycleCard':
                // 回收卡牌
                score += ABILITY_VALUE_WEIGHTS.RECYCLE_CARD;
                break;
            case 'win':
                // 直接胜利（最高价值）
                score += 1000;
                break;
            case 'forceTie':
            case 'winTies':
                // 控制平局
                score += 60;
                break;
            case 'discardBothCards':
            case 'discardByFaction':
            case 'discardFromDeck':
                // 弃牌效果
                score += 40;
                break;
            case 'removeAllMarkers':
                // 移除标记
                score += 35;
                break;
            default:
                // 其他效果默认价值
                score += 20;
                break;
        }
    }
    
    return score;
}

/**
 * 评估游戏状态
 */
function evaluateGameState(
    core: CardiaCore,
    playerId: PlayerId,
): number {
    const player = core.players[playerId];
    const opponentId = getOpponentId(core, playerId);
    const opponent = core.players[opponentId];
    
    if (!player || !opponent) return 0;
    
    let score = 0;
    
    // 印戒差距（最重要）
    const signetDiff = getTotalSignets(core, playerId) - getTotalSignets(core, opponentId);
    score += signetDiff * STATE_EVAL_WEIGHTS.SIGNET_DIFF;
    
    // 手牌数量差距
    const handSizeDiff = player.hand.length - opponent.hand.length;
    score += handSizeDiff * STATE_EVAL_WEIGHTS.HAND_SIZE_DIFF;
    
    // 场上卡牌数量差距
    const fieldCardDiff = player.playedCards.length - opponent.playedCards.length;
    score += fieldCardDiff * STATE_EVAL_WEIGHTS.FIELD_CARD_DIFF;
    
    // 持续能力数量差距
    const ongoingAbilityDiff = core.ongoingAbilities.filter((ability) => ability.playerId === playerId).length
        - core.ongoingAbilities.filter((ability) => ability.playerId === opponentId).length;
    score += ongoingAbilityDiff * STATE_EVAL_WEIGHTS.ONGOING_ABILITY_DIFF;
    
    return score;
}

/**
 * 打牌动作评分
 */
function scorePlayCardAction(
    action: AiLegalAction,
    core: CardiaCore,
    playerId: PlayerId,
): number {
    const cardUid = typeof action.metadata?.cardUid === 'string' ? action.metadata.cardUid : null;
    if (!cardUid) return 0;
    
    const player = core.players[playerId];
    if (!player) return 0;
    
    const card = player.hand.find((c) => c.uid === cardUid);
    if (!card) return 0;
    
    // 基础卡牌价值
    let score = evaluateCardValue(card, core, playerId);
    
    // 考虑当前场面状态
    const stateScore = evaluateGameState(core, playerId);
    score += stateScore * 0.1; // 场面状态影响权重较小
    
    return score;
}

/**
 * 能力动作评分
 */
function scoreAbilityAction(
    action: AiLegalAction,
    core: CardiaCore,
    playerId: PlayerId,
): number {
    if (action.kind === 'skip-ability') {
        // 跳过能力的基础分数较低
        return 10;
    }
    
    const abilityId = typeof action.metadata?.abilityId === 'string' ? action.metadata.abilityId : null;
    if (!abilityId) return 0;
    
    // 基础能力价值
    let score = evaluateAbilityValue(abilityId, core, playerId);
    
    // 考虑当前游戏状态
    const stateScore = evaluateGameState(core, playerId);
    score += stateScore * 0.05; // 状态影响权重更小
    
    return score;
}

/**
 * 交互选择评分
 */
function scoreInteractionChoice(
    _action: AiLegalAction,
    _core: CardiaCore,
    _playerId: PlayerId,
): number {
    // 基础分数
    const score = 50;
    
    // TODO: 根据交互类型实现具体启发式
    // - 修正标记：优先接近平局
    // - 印戒移除：优先对手最多
    // - 派系选择：优先场上最多
    
    return score;
}

/**
 * 动作类型基础评分器
 */
const cardiaKindScorer: LocalAiActionScorer = {
    id: 'cardia-kind',
    score(_context, action) {
        // 为不同动作类型提供基础分数
        switch (action.kind) {
            case 'play-card':
                return 100; // 打牌是主要动作
            case 'activate-ability':
                return 80;  // 激活能力次之
            case 'skip-ability':
                return 10;  // 跳过能力分数最低
            case 'interaction-choice':
                return 50;  // 交互选择中等
            default:
                return 0;
        }
    },
};

/**
 * 打牌动作评分器
 */
const playCardScorer: LocalAiActionScorer = {
    id: 'play-card-value',
    score(context, action) {
        if (action.kind !== 'play-card') return null;
        
        try {
            const state = context.visibleState as MatchState<CardiaCore>;
            const score = scorePlayCardAction(action, state.core, context.playerId);
            
            return {
                score,
                reason: '基于卡牌影响力、能力数量和场面状态评估',
            };
        } catch (error) {
            // 评分失败时使用默认分数
            console.warn('[Cardia AI] 打牌动作评分失败:', { error, actionId: action.actionId });
            return {
                score: 50, // 默认中等分数
                reason: '评分失败，使用默认分数',
            };
        }
    },
};

/**
 * 能力动作评分器
 */
const abilityScorer: LocalAiActionScorer = {
    id: 'ability-value',
    score(context, action) {
        if (action.kind !== 'activate-ability' && action.kind !== 'skip-ability') {
            return null;
        }
        
        try {
            const state = context.visibleState as MatchState<CardiaCore>;
            const score = scoreAbilityAction(action, state.core, context.playerId);
            
            return {
                score,
                reason: action.kind === 'skip-ability' 
                    ? '跳过能力保留资源'
                    : '基于能力效果类型和游戏状态评估',
            };
        } catch (error) {
            // 评分失败时使用默认分数
            console.warn('[Cardia AI] 能力动作评分失败:', { error, actionId: action.actionId });
            return {
                score: action.kind === 'skip-ability' ? 10 : 40, // 跳过能力低分，激活能力中等分
                reason: '评分失败，使用默认分数',
            };
        }
    },
};

/**
 * 交互选择评分器
 */
const interactionScorer: LocalAiActionScorer = {
    id: 'interaction-value',
    score(context, action) {
        if (action.kind !== 'interaction-choice') return null;
        
        try {
            const state = context.visibleState as MatchState<CardiaCore>;
            const score = scoreInteractionChoice(action, state.core, context.playerId);
            
            return {
                score,
                reason: '基于交互类型和目标选择启发式',
            };
        } catch (error) {
            // 评分失败时使用默认分数
            console.warn('[Cardia AI] 交互选择评分失败:', { error, actionId: action.actionId });
            return {
                score: 50, // 默认中等分数
                reason: '评分失败，使用默认分数',
            };
        }
    },
};

/**
 * 策略配置评分器
 */
const strategyProfileScorer = createProfileAwareActionScorer<CardiaStrategyTag>({
    id: 'strategy-profile-fit',
    allowedKinds: [
        'play-card',
        'activate-ability',
        'skip-ability',
        'interaction-choice',
    ],
    getProfile(context) {
        // 根据游戏状态选择策略配置
        const state = context.visibleState as MatchState<CardiaCore>;
        const core = state.core;
        const playerId = context.playerId;
        
        const mySignets = getTotalSignets(core, playerId);
        const opponentId = getOpponentId(core, playerId);
        const opponentSignets = getTotalSignets(core, opponentId);
        
        // 根据印戒差距选择策略
        if (mySignets < opponentSignets) {
            // 落后时使用进攻型策略
            return STRATEGY_PROFILES.aggro;
        } else if (mySignets > opponentSignets) {
            // 领先时使用防守型策略
            return STRATEGY_PROFILES.control;
        } else {
            // 平局时使用平衡型策略
            return STRATEGY_PROFILES.balanced;
        }
    },
});

/**
 * 所有评分器列表
 */
const cardiaLocalPolicyScorers: LocalAiActionScorer[] = [
    cardiaKindScorer,
    playCardScorer,
    abilityScorer,
    interactionScorer,
    strategyProfileScorer,
];

/**
 * Baseline 策略（使用平衡型配置）
 */
const baselineLocalPolicy: LocalAiPolicy = createScoredLocalAiPolicy({
    id: 'baseline',
    scorers: cardiaLocalPolicyScorers,
});

/**
 * 进攻型策略
 */
const aggroLocalPolicy: LocalAiPolicy = createScoredLocalAiPolicy({
    id: 'aggro',
    scorers: cardiaLocalPolicyScorers,
});

/**
 * 防守型策略
 */
const controlLocalPolicy: LocalAiPolicy = createScoredLocalAiPolicy({
    id: 'control',
    scorers: cardiaLocalPolicyScorers,
});

/**
 * 平衡型策略
 */
const balancedLocalPolicy: LocalAiPolicy = createScoredLocalAiPolicy({
    id: 'balanced',
    scorers: cardiaLocalPolicyScorers,
});

/**
 * Cardia AI Runtime
 */
export const cardiaAiRuntime: GameAiRuntime = {
    gameId: 'cardia',
    buildLegalActions: buildCardiaAiLegalActions,
    defaultMinimumActionDelayMs: 1000,
    localPolicies: {
        baseline: baselineLocalPolicy,
        aggro: aggroLocalPolicy,
        control: controlLocalPolicy,
        balanced: balancedLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};

