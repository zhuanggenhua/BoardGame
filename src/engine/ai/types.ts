import type { MatchState, PlayerId } from '../types';
import type { AiDecisionDescriptor, AiInteractionSupportDeclaration } from './decisionSemantics';

export type AiRelationToActor = 'self' | 'ally' | 'enemy' | 'neutral';

export type AiEffectIntent =
    | 'buff'
    | 'debuff'
    | 'destroy'
    | 'move'
    | 'inspect'
    | 'resource'
    | 'optional-skip'
    | 'affect';

export type AiTargetKind = 'player' | 'minion' | 'base' | 'card';

export type AiHintDerivation = 'explicit' | 'inferred';

export type AiForcedTargetPolicy = 'prefer' | 'avoid' | 'must-select' | 'must-avoid';

export interface AiHint {
    tags?: string[];
    relationToActor?: AiRelationToActor;
    effectIntent?: AiEffectIntent;
    targetKind?: AiTargetKind;
    targetPlayerId?: PlayerId;
    targetOwnerId?: PlayerId;
    targetControllerId?: PlayerId;
    estimatedSwing?: number;
    priorityHint?: number;
    forcedTargetPolicy?: AiForcedTargetPolicy;
    derivedFrom?: AiHintDerivation;
}

export interface AiSupportProfile {
    capture: boolean;
    localAi: boolean;
    remoteAi: boolean;
    defaultLocalAiSeats?: 'first-opponent' | 'all-opponents';
}

export type AiDifficultyLevel = 'easy' | 'normal' | 'hard' | 'expert';

export interface AiDifficultyProfile {
    level: AiDifficultyLevel;
    searchDepth: number;
    shortlistSize: number;
    simulationBudgetMs: number;
    randomness: number;
    beliefSampleCount: number;
    evaluatorProfile: 'basic' | 'balanced' | 'strong' | 'expert';
}

type ManualSetupSelectionFlagFields<TValue> = {
    manualSetupSelection?: TValue;
    /**
     * @deprecated 旧命名仍兼容；新游戏应优先使用 manualSetupSelection。
     */
    manualFactionSelection?: TValue;
};

export type ManualSetupSeatControllerLike = {
    type?: unknown;
} & ManualSetupSelectionFlagFields<unknown>;

export type AiManualSetupSelectionFlags = ManualSetupSelectionFlagFields<boolean>;

export type AiSeatController =
    | { type: 'human' }
    | ({
        type: 'local-ai';
        policyId?: string;
        fallbackPolicyId?: string;
        difficulty?: AiDifficultyLevel;
        minimumActionDelayMs?: number;
    } & AiManualSetupSelectionFlags)
    | ({
        type: 'remote-ai';
        providerId: string;
        fallbackPolicyId?: string;
        timeoutMs?: number;
        retryCount?: number;
        minimumActionDelayMs?: number;
    } & AiManualSetupSelectionFlags);

export interface AiInteractionOptionSnapshot {
    id: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
    disabledReason?: string;
    displayMode?: string;
    _ai?: AiHint;
}

export interface AiInteractionSnapshot {
    id: string;
    kind: string;
    sourceId?: string;
    playerId?: string;
    options: AiInteractionOptionSnapshot[];
    multi?: unknown;
    ai?: AiInteractionSupportDeclaration;
    aiDecisions?: AiDecisionDescriptor[];
    choiceRequest?: Record<string, unknown>;
}

export interface AiResponseWindowSnapshot {
    windowType?: string;
    sourceId?: string;
    currentResponderIndex?: number;
    responderQueue?: string[];
    allowedCommands?: string[];
    pendingInteractionId?: string;
}

export interface AiCommandSpec {
    type: string;
    payload: unknown;
}

export interface AiActionStrategyMetadata {
    strategyTags?: string[];
    /**
     * @deprecated 旧的卡牌策略标签字段，读取仍兼容；新代码应优先写入 strategyTags。
     */
    cardStrategyTags?: string[];
    visibleStepDelayPolicy?: 'hidden' | 'visible';
    /**
     * @deprecated 旧的“后续 gate”语义；读取仍兼容为 visible/hidden，可逐步迁移到 visibleStepDelayPolicy。
     */
    followUpDelayPolicy?: 'skip' | 'delay';
}

export type AiSetupOptionStatus = 'available' | 'in_progress' | 'disabled';

export interface AiSetupOptionActionMetadata {
    /** 开局选项可玩状态：共享 AI 层默认据此过滤自动选择。 */
    setupOptionStatus?: AiSetupOptionStatus;
    setupOptionStatusReason?: string;
}

export interface AiSetupOptionStatusResolution {
    status: AiSetupOptionStatus;
    reason?: string;
}

export type AiActionMetadata = Record<string, unknown>
    & AiActionStrategyMetadata
    & AiSetupOptionActionMetadata;

export interface AiLegalAction {
    actionId: string;
    kind: string;
    label: string;
    commands: AiCommandSpec[];
    aiHints?: AiHint[];
    metadata?: AiActionMetadata;
}

export interface AiDecisionContext {
    gameId: string;
    matchId: string;
    playerId: PlayerId;
    visibleState: MatchState<unknown>;
    interaction: AiInteractionSnapshot | null;
    responseWindow: AiResponseWindowSnapshot | null;
    legalActions: AiLegalAction[];
    rulesVersion: string | null;
    decisionBudgetMs: number;
    source: 'local' | 'online';
    difficulty: AiDifficultyProfile;
    featureSnapshot?: Record<string, unknown> | null;
}

export interface AiActionDecision {
    actionId: string;
    confidence?: number;
    reasoningSummary?: string;
    providerMetadata?: Record<string, unknown>;
}

export interface LocalAiActionScoreContribution {
    scorerId: string;
    score: number;
    reason?: string;
}

export interface LocalAiActionEvaluation {
    action: AiLegalAction;
    totalScore: number;
    contributions: LocalAiActionScoreContribution[];
}

export type LocalAiActionScoreResult =
    | number
    | {
        score: number;
        reason?: string;
    };

export interface LocalAiActionScorer {
    id: string;
    score(
        context: AiDecisionContext,
        action: AiLegalAction,
    ): LocalAiActionScoreResult | null | undefined;
}

export interface LocalAiPolicy {
    id: string;
    decide(context: AiDecisionContext): AiActionDecision | null | Promise<AiActionDecision | null>;
}

export interface RemoteAiProvider {
    id: string;
    defaultTimeoutMs?: number;
    defaultRetryCount?: number;
    decide(
        context: AiDecisionContext,
        seatController: Extract<AiSeatController, { type: 'remote-ai' }>,
    ): AiActionDecision | null | Promise<AiActionDecision | null>;
}

export interface BuildGameAiLegalActionsArgs {
    playerId: PlayerId;
    state: MatchState<unknown>;
}

export interface BuildGameAiFeatureSnapshotArgs {
    playerId: PlayerId;
    state: MatchState<unknown>;
    legalActions: AiLegalAction[];
    interaction: AiInteractionSnapshot | null;
    responseWindow: AiResponseWindowSnapshot | null;
}

export type OnlineAiDecisionVisibility = 'shared' | 'private-required';

export type LocalAiActionVisibility = 'hidden' | 'visible';

export interface LocalAiVisibleStepDelayConfig {
    mode: 'whitelist';
    actionKinds: string[];
}

/**
 * @deprecated 旧命名；保留为 LocalAiVisibleStepDelayConfig 的兼容别名。
 */
export interface LocalAiFollowUpDelayConfig {
    mode: 'whitelist';
    actionKinds: string[];
}

export interface GameAiRuntime {
    gameId: string;
    buildLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[];
    buildFeatureSnapshot?(args: BuildGameAiFeatureSnapshotArgs): Record<string, unknown> | null | undefined;
    /**
     * 统一开局选项可玩状态：共享 AI 层据此过滤自动选择。
     * 游戏只负责把自己的配置真相源翻译到这里，不能让 UI 元数据成为 AI 真相源。
     */
    resolveSetupOptionStatus?(args: {
        playerId: PlayerId;
        state: MatchState<unknown>;
        action: AiLegalAction;
    }): AiSetupOptionStatus | AiSetupOptionStatusResolution | null | undefined;
    refineAiAction?(args: {
        context: AiDecisionContext;
        proposedAction: AiLegalAction;
        source: 'local-policy' | 'local-fallback' | 'remote-ai' | 'remote-ai-fallback';
    }): AiLegalAction | null | undefined;
    resolveOnlineDecisionVisibility?(args: {
        playerId: PlayerId;
        sharedState: MatchState<unknown>;
        privateOverlay: MatchState<unknown> | null;
    }): OnlineAiDecisionVisibility | null | undefined;
    resolveCurrentDecisionPlayerId?(args: {
        state: MatchState<unknown>;
        fallbackPlayerId: PlayerId | null;
    }): PlayerId | null | undefined;
    localVisibleStepDelayConfig?: LocalAiVisibleStepDelayConfig;
    /** 游戏声明哪些本地 AI 命令应作为快速隐藏步骤处理；共享层只内置通用系统命令。 */
    localHiddenCommandTypes?: string[];
    defaultMinimumActionDelayMs?: number;
    /**
     * @deprecated 旧命名；读取仍兼容，建议迁移到 localVisibleStepDelayConfig。
     */
    localFollowUpDelayConfig?: LocalAiFollowUpDelayConfig;
    localPolicies?: Record<string, LocalAiPolicy>;
    defaultLocalPolicyId?: string;
    shouldUseRemoteDecision?: (
        context: AiDecisionContext,
        seatController: Extract<AiSeatController, { type: 'remote-ai' }>,
    ) => boolean;
}
