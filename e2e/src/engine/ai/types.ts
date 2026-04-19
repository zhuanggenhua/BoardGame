import type { MatchState, PlayerId } from '../types';

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

export type AiSeatController =
    | { type: 'human' }
    | {
        type: 'local-ai';
        policyId?: string;
        fallbackPolicyId?: string;
        difficulty?: AiDifficultyLevel;
        minimumActionDelayMs?: number;
    }
    | {
        type: 'remote-ai';
        providerId: string;
        fallbackPolicyId?: string;
        timeoutMs?: number;
        retryCount?: number;
        minimumActionDelayMs?: number;
    };

export interface AiInteractionOptionSnapshot {
    id: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
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
}

export interface AiResponseWindowSnapshot {
    windowType?: string;
    currentResponderIndex?: number;
    responderQueue?: string[];
    allowedCommands?: string[];
}

export interface AiCommandSpec {
    type: string;
    payload: unknown;
}

export interface AiActionStrategyMetadata {
    strategyTags?: string[];
    /**
     * @deprecated 旧的 Smash Up 专用字段，读取仍兼容；新代码应优先写入 strategyTags。
     */
    cardStrategyTags?: string[];
}

export type AiActionMetadata = Record<string, unknown> & AiActionStrategyMetadata;

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

export interface GameAiRuntime {
    gameId: string;
    buildLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[];
    buildFeatureSnapshot?(args: BuildGameAiFeatureSnapshotArgs): Record<string, unknown> | null | undefined;
    resolveOnlineDecisionVisibility?(args: {
        playerId: PlayerId;
        sharedState: MatchState<unknown>;
        privateOverlay: MatchState<unknown> | null;
    }): OnlineAiDecisionVisibility | null | undefined;
    localPolicies?: Record<string, LocalAiPolicy>;
    defaultLocalPolicyId?: string;
    shouldUseRemoteDecision?: (
        context: AiDecisionContext,
        seatController: Extract<AiSeatController, { type: 'remote-ai' }>,
    ) => boolean;
}
