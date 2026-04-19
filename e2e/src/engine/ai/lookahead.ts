import type {
    AiDecisionContext,
    AiDifficultyProfile,
    AiLegalAction,
    LocalAiActionEvaluation,
    LocalAiActionScoreContribution,
    LocalAiActionScorer,
    LocalAiPolicy,
} from './types';
import { resolveAiDifficultyProfile } from './difficulty';
import { evaluateLocalAiActions } from './scoring';
import { buildDeterministicAiNoise } from './noise';

export interface AiProjectedActionScore {
    score: number;
    reason?: string;
    metadata?: Record<string, unknown>;
}

export interface AiRelativeUtilityOptions {
    enabled?: boolean;
    weight?: number;
    minimumUtility?: number;
}

export interface AiCandidateActionLoopOptions {
    enabled?: boolean;
    maxIterations?: number;
    batchSize?: number;
    stopOnUtility?: number;
}

export interface AiAssignmentEvaluation {
    actionId: string;
    score: number;
    reason?: string;
    metadata?: Record<string, unknown>;
}

export interface AiLookaheadTraceEntry {
    actionId: string;
    kind: string;
    baseScore: number;
    searchPriority: number;
    projectedScore: number;
    assignmentScore: number;
    relativeUtility: number;
    relativeUtilityScore: number;
    noiseScore: number;
    finalScore: number;
    belowUtilityThreshold: boolean;
    searched: boolean;
    shortlisted: boolean;
    contributions: LocalAiActionScoreContribution[];
    metadata?: Record<string, unknown>;
}

export interface CreateLookaheadLocalAiPolicyOptions {
    id: string;
    scorers: LocalAiActionScorer[];
    maxReasonCount?: number;
    projectAction?: (args: {
        context: AiDecisionContext;
        action: AiLegalAction;
        baseEvaluation: LocalAiActionEvaluation;
        difficulty: AiDifficultyProfile;
        remainingBudgetMs: number;
    }) => AiProjectedActionScore | null | undefined;
    rankProjectionCandidate?: (args: {
        context: AiDecisionContext;
        action: AiLegalAction;
        baseEvaluation: LocalAiActionEvaluation;
        difficulty: AiDifficultyProfile;
    }) => number | null | undefined;
    relativeUtility?: AiRelativeUtilityOptions;
    evaluateAssignments?: (args: {
        context: AiDecisionContext;
        difficulty: AiDifficultyProfile;
        baseEvaluations: LocalAiActionEvaluation[];
    }) => AiAssignmentEvaluation[] | null | undefined;
    candidateLoop?: AiCandidateActionLoopOptions;
}

interface FinalEvaluation {
    action: AiLegalAction;
    totalScore: number;
    contributions: LocalAiActionScoreContribution[];
    trace: AiLookaheadTraceEntry;
}

function stableSortedEvaluations(
    evaluations: LocalAiActionEvaluation[],
): Array<LocalAiActionEvaluation & { index: number }> {
    return evaluations
        .map((evaluation, index) => ({ ...evaluation, index }))
        .sort((left, right) => {
            if (right.totalScore !== left.totalScore) {
                return right.totalScore - left.totalScore;
            }
            return left.index - right.index;
        });
}

function computeRelativeUtility(score: number, minScore: number, maxScore: number): number {
    if (maxScore <= minScore) {
        return 1;
    }
    return (score - minScore) / (maxScore - minScore);
}

function buildConfidence(finalEvaluations: FinalEvaluation[], best: FinalEvaluation): number | undefined {
    if (finalEvaluations.length <= 1) return 1;

    const second = finalEvaluations
        .filter((item) => item.action.actionId !== best.action.actionId)
        .sort((left, right) => right.totalScore - left.totalScore)[0];
    if (!second) return 1;

    const margin = Math.max(0, best.totalScore - second.totalScore);
    const denominator = Math.max(1, Math.abs(best.totalScore) + Math.abs(second.totalScore));
    return Math.min(1, Number((margin / denominator).toFixed(3)));
}

function buildReasoningSummary(best: FinalEvaluation, maxReasonCount: number): string | undefined {
    const topReasons = [...best.contributions]
        .sort((left, right) => right.score - left.score)
        .filter((item) => item.reason)
        .slice(0, maxReasonCount)
        .map((item) => item.reason);

    return topReasons.length > 0 ? topReasons.join('；') : undefined;
}

function compareFinalEvaluations(left: FinalEvaluation, right: FinalEvaluation, sorted: Array<LocalAiActionEvaluation & { index: number }>): number {
    if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
    }
    const leftIndex = sorted.findIndex((item) => item.action.actionId === left.action.actionId);
    const rightIndex = sorted.findIndex((item) => item.action.actionId === right.action.actionId);
    return leftIndex - rightIndex;
}

export function createLookaheadLocalAiPolicy(
    options: CreateLookaheadLocalAiPolicyOptions,
): LocalAiPolicy {
    return {
        id: options.id,
        decide(context) {
            const difficulty = context.difficulty ?? resolveAiDifficultyProfile(undefined);
            const normalizedContext = context.difficulty
                ? context
                : {
                    ...context,
                    difficulty,
                };
            const baseEvaluations = evaluateLocalAiActions(normalizedContext, options.scorers);
            if (baseEvaluations.length === 0) return null;

            const sorted = stableSortedEvaluations(baseEvaluations);
            const minBaseScore = sorted.reduce((best, item) => Math.min(best, item.totalScore), Number.POSITIVE_INFINITY);
            const maxBaseScore = sorted.reduce((best, item) => Math.max(best, item.totalScore), Number.NEGATIVE_INFINITY);
            const relativeUtilityEnabled = options.relativeUtility?.enabled === true;
            const relativeUtilityWeightRaw = options.relativeUtility?.weight ?? 0;
            const relativeUtilityWeight = Number.isFinite(relativeUtilityWeightRaw)
                ? Number(relativeUtilityWeightRaw)
                : 0;
            const minimumUtilityRaw = options.relativeUtility?.minimumUtility;
            const minimumUtility = minimumUtilityRaw !== undefined && Number.isFinite(minimumUtilityRaw)
                ? Number(minimumUtilityRaw)
                : null;

            const assignmentByActionId = new Map<string, AiAssignmentEvaluation>();
            if (options.evaluateAssignments) {
                try {
                    const assignmentEvaluations = options.evaluateAssignments({
                        context: normalizedContext,
                        difficulty,
                        baseEvaluations,
                    }) ?? [];
                    for (const assignment of assignmentEvaluations) {
                        if (!assignment || typeof assignment.actionId !== 'string') continue;
                        if (!Number.isFinite(assignment.score) || assignment.score === 0) continue;
                        assignmentByActionId.set(assignment.actionId, assignment);
                    }
                } catch {
                    assignmentByActionId.clear();
                }
            }

            const shortlistSize = Math.max(1, Math.min(difficulty.shortlistSize, sorted.length));
            const projectionRanking = sorted
                .map((evaluation) => {
                    const searchPriority = Number((options.rankProjectionCandidate?.({
                        context: normalizedContext,
                        action: evaluation.action,
                        baseEvaluation: evaluation,
                        difficulty,
                    }) ?? 0).toFixed(3));
                    return {
                        actionId: evaluation.action.actionId,
                        index: evaluation.index,
                        searchPriority,
                        rankingScore: evaluation.totalScore + searchPriority,
                    };
                })
                .sort((left, right) => {
                    if (right.rankingScore !== left.rankingScore) {
                        return right.rankingScore - left.rankingScore;
                    }
                    return left.index - right.index;
                });
            const searchPriorityByActionId = new Map(
                projectionRanking.map((item) => [item.actionId, item.searchPriority] as const),
            );
            const shortlist = new Set(projectionRanking.slice(0, shortlistSize).map((item) => item.actionId));
            const startedAt = Date.now();

            const buildFinalEvaluation = (
                evaluation: LocalAiActionEvaluation & { index: number },
                shortlistedForSearch: boolean,
            ): FinalEvaluation => {
                const contributions = [...evaluation.contributions];
                const searchPriority = searchPriorityByActionId.get(evaluation.action.actionId) ?? 0;
                let projectedScore = 0;
                let metadata: Record<string, unknown> | undefined;
                const shortlisted = shortlistedForSearch;
                const relativeUtility = computeRelativeUtility(evaluation.totalScore, minBaseScore, maxBaseScore);
                const assignment = assignmentByActionId.get(evaluation.action.actionId);
                const assignmentScore = assignment?.score ?? 0;
                let relativeUtilityScore = 0;
                if (relativeUtilityEnabled && relativeUtilityWeight !== 0) {
                    relativeUtilityScore = Number((((relativeUtility - 0.5) * 2) * relativeUtilityWeight).toFixed(3));
                    if (relativeUtilityScore !== 0) {
                        contributions.push({
                            scorerId: 'relative-utility',
                            score: relativeUtilityScore,
                            reason: `相对效用 ${(relativeUtility * 100).toFixed(0)}%`,
                        });
                    }
                }

                if (assignment && assignmentScore !== 0) {
                    contributions.push({
                        scorerId: 'assignment-first',
                        score: assignmentScore,
                        ...(assignment.reason ? { reason: assignment.reason } : {}),
                    });
                }

                const belowUtilityThreshold = minimumUtility !== null && relativeUtility < minimumUtility;
                const shouldSearch = Boolean(
                    options.projectAction
                    && difficulty.searchDepth > 0
                    && shortlistedForSearch,
                );

                if (shouldSearch) {
                    const remainingBudgetMs = Math.max(
                        0,
                        difficulty.simulationBudgetMs - (Date.now() - startedAt),
                    );
                    if (remainingBudgetMs > 0) {
                        const projected = options.projectAction?.({
                            context: normalizedContext,
                            action: evaluation.action,
                            baseEvaluation: evaluation,
                            difficulty,
                            remainingBudgetMs,
                        });
                        if (projected && Number.isFinite(projected.score) && projected.score !== 0) {
                            projectedScore = projected.score;
                            metadata = projected.metadata;
                            contributions.push({
                                scorerId: 'lookahead',
                                score: projected.score,
                                ...(projected.reason ? { reason: projected.reason } : {}),
                            });
                        }
                    }
                }

                let noiseScore = 0;
                if (difficulty.randomness > 0) {
                    noiseScore = Number(
                        (buildDeterministicAiNoise(normalizedContext, evaluation.action) * difficulty.randomness).toFixed(3),
                    );
                    if (noiseScore !== 0) {
                        contributions.push({
                            scorerId: 'difficulty-noise',
                            score: noiseScore,
                            reason: `难度扰动 ${difficulty.level}`,
                        });
                    }
                }

                if (assignment?.metadata) {
                    metadata = {
                        ...(metadata ?? {}),
                        assignment: assignment.metadata,
                    };
                }

                const finalScore = evaluation.totalScore
                    + assignmentScore
                    + relativeUtilityScore
                    + projectedScore
                    + noiseScore;
                return {
                    action: evaluation.action,
                    totalScore: finalScore,
                    contributions,
                    trace: {
                        actionId: evaluation.action.actionId,
                        kind: evaluation.action.kind,
                        baseScore: evaluation.totalScore,
                        searchPriority,
                        projectedScore,
                        assignmentScore,
                        relativeUtility,
                        relativeUtilityScore,
                        noiseScore,
                        finalScore,
                        belowUtilityThreshold,
                        searched: shouldSearch,
                        shortlisted,
                        contributions,
                        ...(metadata ? { metadata } : {}),
                    },
                };
            };

            const candidateLoopEnabled = options.candidateLoop?.enabled === true
                && Boolean(options.projectAction)
                && difficulty.searchDepth > 0;
            const finalEvaluationByActionId = new Map<string, FinalEvaluation>();

            if (candidateLoopEnabled) {
                const maxIterationsRaw = options.candidateLoop?.maxIterations;
                const maxIterations = Number.isFinite(maxIterationsRaw)
                    ? Math.max(1, Math.min(Math.ceil(Number(maxIterationsRaw)), sorted.length))
                    : Math.max(1, Math.ceil(sorted.length / Math.max(1, shortlistSize)));
                const batchSizeRaw = options.candidateLoop?.batchSize;
                const batchSize = Number.isFinite(batchSizeRaw)
                    ? Math.max(1, Math.min(Math.ceil(Number(batchSizeRaw)), sorted.length))
                    : shortlistSize;
                const stopOnUtilityRaw = options.candidateLoop?.stopOnUtility;
                const stopOnUtility = Number.isFinite(stopOnUtilityRaw)
                    ? Number(stopOnUtilityRaw)
                    : null;

                let cursor = 0;
                for (let iteration = 0; iteration < maxIterations && cursor < projectionRanking.length; iteration += 1) {
                    const batchActionIds = projectionRanking
                        .slice(cursor, cursor + batchSize)
                        .map((item) => item.actionId);
                    cursor += batchSize;

                    for (const actionId of batchActionIds) {
                        if (finalEvaluationByActionId.has(actionId)) continue;
                        const evaluation = sorted.find((item) => item.action.actionId === actionId);
                        if (!evaluation) continue;
                        finalEvaluationByActionId.set(actionId, buildFinalEvaluation(evaluation, true));
                    }

                    if (stopOnUtility !== null) {
                        const provisionalBest = [...finalEvaluationByActionId.values()].sort((left, right) => compareFinalEvaluations(left, right, sorted))[0];
                        if (provisionalBest && !provisionalBest.trace.belowUtilityThreshold && provisionalBest.trace.relativeUtility >= stopOnUtility) {
                            break;
                        }
                    }
                }
            }

            for (const evaluation of sorted) {
                if (finalEvaluationByActionId.has(evaluation.action.actionId)) continue;
                const shortlistedForSearch = candidateLoopEnabled
                    ? false
                    : shortlist.has(evaluation.action.actionId);
                finalEvaluationByActionId.set(
                    evaluation.action.actionId,
                    buildFinalEvaluation(evaluation, shortlistedForSearch),
                );
            }

            const finalEvaluations: FinalEvaluation[] = sorted
                .map((evaluation) => finalEvaluationByActionId.get(evaluation.action.actionId))
                .filter((item): item is FinalEvaluation => Boolean(item));

            const selectionPool = finalEvaluations.filter((item) => !item.trace.belowUtilityThreshold);
            const rankingSource = selectionPool.length > 0 ? selectionPool : finalEvaluations;
            const rankedActionIds = [...rankingSource]
                .sort((left, right) => compareFinalEvaluations(left, right, sorted))
                .map((item) => item.action.actionId);

            const best = rankedActionIds.length > 0
                ? rankingSource.find((item) => item.action.actionId === rankedActionIds[0])
                : undefined;
            if (!best) return null;

            return {
                actionId: best.action.actionId,
                confidence: buildConfidence(finalEvaluations, best),
                reasoningSummary: buildReasoningSummary(best, options.maxReasonCount ?? 3),
                providerMetadata: {
                    policyId: options.id,
                    difficulty,
                    shortlistSize,
                    evaluations: finalEvaluations.map((evaluation) => evaluation.trace),
                },
            };
        },
    };
}

