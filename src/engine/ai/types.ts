import type { MatchState, PlayerId } from '../types';

export interface AiSupportProfile {
    capture: boolean;
    localAi: boolean;
    remoteAi: boolean;
}

export type AiSeatController =
    | { type: 'human' }
    | { type: 'local-ai'; policyId?: string; fallbackPolicyId?: string }
    | {
        type: 'remote-ai';
        providerId: string;
        fallbackPolicyId?: string;
        timeoutMs?: number;
        retryCount?: number;
    };

export interface AiInteractionOptionSnapshot {
    id: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
    displayMode?: string;
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

export interface AiLegalAction {
    actionId: string;
    kind: string;
    label: string;
    commands: AiCommandSpec[];
    metadata?: Record<string, unknown>;
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

export interface GameAiRuntime {
    gameId: string;
    buildLegalActions(args: BuildGameAiLegalActionsArgs): AiLegalAction[];
    localPolicies?: Record<string, LocalAiPolicy>;
    defaultLocalPolicyId?: string;
}
