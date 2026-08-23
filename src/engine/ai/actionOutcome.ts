import type {
    AiDecisionContext,
    AiLegalAction,
    LocalAiActionScoreResult,
    LocalAiActionScorer,
} from './types';

export type AiActionOutcomeStatus = 'succeeded' | 'rejected';

export interface AiActionOutcome {
    actionId?: string;
    actionKind?: string;
    status: AiActionOutcomeStatus;
    utilityDelta?: number;
    hasMeaningfulEffect?: boolean;
    hasOwnedFollowUp?: boolean;
    feedbackKeys?: string[];
    eventTypes?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
}

export type ProjectAiActionOutcome = (args: {
    context: AiDecisionContext;
    action: AiLegalAction;
}) => AiActionOutcome | null | undefined;

export interface AiActionOutcomeNoBenefitOptions {
    noBenefitFeedbackKeys?: readonly string[];
    treatNonPositiveUtilityAsNoBenefit?: boolean;
}

export interface CreateAiActionOutcomeNoBenefitScorerOptions extends AiActionOutcomeNoBenefitOptions {
    id: string;
    actionKinds?: readonly string[];
    projectOutcome: ProjectAiActionOutcome;
    noBenefitScore?: number;
    getReason?: (args: {
        context: AiDecisionContext;
        action: AiLegalAction;
        outcome: AiActionOutcome;
    }) => string | undefined;
}

export type AiActionOutcomeCache<TOutcome extends AiActionOutcome> = WeakMap<
    AiDecisionContext,
    Map<string, TOutcome | null>
>;

const DEFAULT_NO_BENEFIT_FEEDBACK_KEYS = ['feedback.no_valid_targets'];

export function getCachedAiActionOutcome<TOutcome extends AiActionOutcome>(
    cache: AiActionOutcomeCache<TOutcome>,
    context: AiDecisionContext,
    action: AiLegalAction,
    project: () => TOutcome | null | undefined,
): TOutcome | null {
    let cachedByContext = cache.get(context);
    if (!cachedByContext) {
        cachedByContext = new Map<string, TOutcome | null>();
        cache.set(context, cachedByContext);
    }

    if (cachedByContext.has(action.actionId)) {
        return cachedByContext.get(action.actionId) ?? null;
    }

    const outcome = project() ?? null;
    cachedByContext.set(action.actionId, outcome);
    return outcome;
}

export function hasAiActionOutcomeFeedback(
    outcome: AiActionOutcome | null | undefined,
    feedbackKey: string,
): boolean {
    return Array.isArray(outcome?.feedbackKeys) && outcome.feedbackKeys.includes(feedbackKey);
}

export function isAiActionOutcomeNoBenefit(
    outcome: AiActionOutcome | null | undefined,
    options: AiActionOutcomeNoBenefitOptions = {},
): boolean {
    if (!outcome) return false;
    if (outcome.status === 'rejected') return true;
    if (outcome.hasMeaningfulEffect === true || outcome.hasOwnedFollowUp === true) return false;
    if (outcome.tags?.includes('no-benefit') || outcome.tags?.includes('no-op')) return true;

    const noBenefitFeedbackKeys = options.noBenefitFeedbackKeys ?? DEFAULT_NO_BENEFIT_FEEDBACK_KEYS;
    if (noBenefitFeedbackKeys.some((feedbackKey) => hasAiActionOutcomeFeedback(outcome, feedbackKey))) {
        return true;
    }

    if (
        options.treatNonPositiveUtilityAsNoBenefit === true
        && typeof outcome.utilityDelta === 'number'
        && outcome.utilityDelta <= 0
    ) {
        return true;
    }

    return false;
}

export function createAiActionOutcomeNoBenefitScorer(
    options: CreateAiActionOutcomeNoBenefitScorerOptions,
): LocalAiActionScorer {
    const actionKinds = options.actionKinds ? new Set(options.actionKinds) : null;

    return {
        id: options.id,
        score(context, action): LocalAiActionScoreResult | null {
            if (actionKinds && !actionKinds.has(action.kind)) {
                return null;
            }

            const outcome = options.projectOutcome({ context, action });
            if (!isAiActionOutcomeNoBenefit(outcome, options) || !outcome) {
                return null;
            }

            return {
                score: options.noBenefitScore ?? -120,
                reason: options.getReason?.({ context, action, outcome })
                    ?? '动作预演没有产生实际收益，跳过优先于空耗资源',
            };
        },
    };
}
