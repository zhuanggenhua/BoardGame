import type {
    AiActionDecision,
    AiDecisionContext,
    AiLegalAction,
    LocalAiActionEvaluation,
    LocalAiActionScoreContribution,
    LocalAiActionScoreResult,
    LocalAiActionScorer,
    LocalAiPolicy,
} from './types';

export interface CreateScoredLocalAiPolicyOptions {
    id: string;
    scorers: LocalAiActionScorer[];
    maxReasonCount?: number;
}

function normalizeScoreResult(
    scorerId: string,
    result: LocalAiActionScoreResult | null | undefined,
): LocalAiActionScoreContribution | null {
    if (result === null || result === undefined) {
        return null;
    }

    if (typeof result === 'number') {
        if (!Number.isFinite(result) || result === 0) return null;
        return { scorerId, score: result };
    }

    if (!Number.isFinite(result.score) || result.score === 0) {
        return null;
    }

    return {
        scorerId,
        score: result.score,
        ...(result.reason ? { reason: result.reason } : {}),
    };
}

export function evaluateLocalAiActions(
    context: AiDecisionContext,
    scorers: LocalAiActionScorer[],
): LocalAiActionEvaluation[] {
    return context.legalActions.map((action) => {
        const contributions: LocalAiActionScoreContribution[] = [];

        for (const scorer of scorers) {
            const normalized = normalizeScoreResult(scorer.id, scorer.score(context, action));
            if (!normalized) continue;
            contributions.push(normalized);
        }

        return {
            action,
            totalScore: contributions.reduce((sum, item) => sum + item.score, 0),
            contributions,
        };
    });
}

export function pickBestLocalAiActionEvaluation(
    evaluations: LocalAiActionEvaluation[],
): LocalAiActionEvaluation | null {
    if (evaluations.length === 0) return null;

    let best = evaluations[0];
    for (let index = 1; index < evaluations.length; index += 1) {
        const current = evaluations[index];
        if (current.totalScore > best.totalScore) {
            best = current;
        }
    }

    return best;
}

function buildConfidence(evaluations: LocalAiActionEvaluation[], best: LocalAiActionEvaluation): number | undefined {
    if (evaluations.length <= 1) return 1;

    const competingScores = evaluations
        .filter((item) => item.action.actionId !== best.action.actionId)
        .map((item) => item.totalScore)
        .sort((a, b) => b - a);
    const secondBestScore = competingScores[0];
    if (secondBestScore === undefined) return 1;

    const margin = Math.max(0, best.totalScore - secondBestScore);
    const denominator = Math.max(1, Math.abs(best.totalScore) + Math.abs(secondBestScore));
    return Math.min(1, Number((margin / denominator).toFixed(3)));
}

function buildReasoningSummary(best: LocalAiActionEvaluation, maxReasonCount: number): string | undefined {
    const topReasons = [...best.contributions]
        .sort((a, b) => b.score - a.score)
        .filter((item) => item.reason)
        .slice(0, maxReasonCount)
        .map((item) => item.reason);

    if (topReasons.length === 0) return undefined;
    return topReasons.join('；');
}

export function buildScoredLocalAiDecision(
    context: AiDecisionContext,
    scorers: LocalAiActionScorer[],
    options?: { maxReasonCount?: number },
): AiActionDecision | null {
    const evaluations = evaluateLocalAiActions(context, scorers);
    const best = pickBestLocalAiActionEvaluation(evaluations);
    if (!best) return null;

    return {
        actionId: best.action.actionId,
        confidence: buildConfidence(evaluations, best),
        reasoningSummary: buildReasoningSummary(best, options?.maxReasonCount ?? 3),
        providerMetadata: {
            totalScore: best.totalScore,
            contributions: best.contributions,
            evaluations: evaluations.map((evaluation) => ({
                actionId: evaluation.action.actionId,
                kind: evaluation.action.kind,
                totalScore: evaluation.totalScore,
                contributions: evaluation.contributions,
            })),
        },
    };
}

export function createScoredLocalAiPolicy(
    options: CreateScoredLocalAiPolicyOptions,
): LocalAiPolicy {
    return {
        id: options.id,
        decide(context) {
            return buildScoredLocalAiDecision(context, options.scorers, {
                maxReasonCount: options.maxReasonCount,
            });
        },
    };
}

export function createActionKindScorer(
    id: string,
    weights: Record<string, number>,
    defaultScore = 0,
): LocalAiActionScorer {
    return {
        id,
        score(_context, action: AiLegalAction) {
            return weights[action.kind] ?? defaultScore;
        },
    };
}
