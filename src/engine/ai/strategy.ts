import type {
    AiDecisionContext,
    AiLegalAction,
    AiActionMetadata,
    LocalAiActionScoreResult,
    LocalAiActionScorer,
} from './types';

export const AI_ACTION_STRATEGY_TAG_METADATA_KEY = 'strategyTags' as const;
export const AI_ACTION_LEGACY_STRATEGY_TAG_METADATA_KEYS = ['cardStrategyTags'] as const;

export interface AiStrategyProfile<Tag extends string = string> {
    tags?: readonly Tag[];
    tagWeights?: Partial<Record<Tag, number>>;
    summary?: readonly string[];
}

export interface AiProfileAwareActionFit<Tag extends string = string> {
    score: number;
    reason: string;
    tags: Tag[];
    matchedTags: Tag[];
    profileSummary: string[];
}

export interface GetAiActionStrategyTagsOptions<Tag extends string = string> {
    metadataKeys?: readonly string[];
    fallback?: (action: AiLegalAction) => readonly Tag[] | null | undefined;
}

export interface ScoreActionAgainstStrategyProfileArgs<Tag extends string = string> {
    profile: AiStrategyProfile<Tag>;
    actionTags: readonly Tag[];
    weightMultiplier?: number;
}

export interface EvaluateProfileAwareActionFitArgs<Tag extends string = string> {
    context: AiDecisionContext;
    action: AiLegalAction;
    getProfile: (context: AiDecisionContext, action: AiLegalAction) => AiStrategyProfile<Tag> | null | undefined;
    getActionTags?: (context: AiDecisionContext, action: AiLegalAction) => readonly Tag[] | null | undefined;
    evaluate?: (args: {
        context: AiDecisionContext;
        action: AiLegalAction;
        profile: AiStrategyProfile<Tag>;
        actionTags: Tag[];
    }) => Omit<AiProfileAwareActionFit<Tag>, 'tags' | 'profileSummary'> | null | undefined;
}

export interface CreateProfileAwareActionScorerOptions<Tag extends string = string> {
    id: string;
    allowedKinds?: readonly string[];
    getProfile: (context: AiDecisionContext, action: AiLegalAction) => AiStrategyProfile<Tag> | null | undefined;
    getActionTags?: (context: AiDecisionContext, action: AiLegalAction) => readonly Tag[] | null | undefined;
    evaluate?: (args: {
        context: AiDecisionContext;
        action: AiLegalAction;
        profile: AiStrategyProfile<Tag>;
        actionTags: Tag[];
    }) => Omit<AiProfileAwareActionFit<Tag>, 'tags' | 'profileSummary'> | null | undefined;
    formatReason?: (fit: AiProfileAwareActionFit<Tag>) => string;
}

function normalizeTags<Tag extends string = string>(tags: readonly unknown[] | null | undefined): Tag[] {
    if (!Array.isArray(tags) || tags.length === 0) return [];
    return [...new Set(tags.filter((tag): tag is Tag => typeof tag === 'string' && tag.trim().length > 0))];
}

export function getAiActionStrategyTags<Tag extends string = string>(
    action: AiLegalAction,
    options: GetAiActionStrategyTagsOptions<Tag> = {},
): Tag[] {
    const metadata = (action.metadata ?? {}) as Record<string, unknown>;
    const metadataKeys = options.metadataKeys ?? [
        AI_ACTION_STRATEGY_TAG_METADATA_KEY,
        ...AI_ACTION_LEGACY_STRATEGY_TAG_METADATA_KEYS,
    ];

    for (const key of metadataKeys) {
        const tags = normalizeTags<Tag>(Array.isArray(metadata[key]) ? metadata[key] : null);
        if (tags.length > 0) return tags;
    }

    return normalizeTags<Tag>(options.fallback?.(action));
}

export function withAiActionStrategyTags(
    metadata: AiActionMetadata | undefined,
    tags: readonly string[],
    options?: { mirrorLegacyCardStrategyTags?: boolean },
): AiActionMetadata {
    const normalizedTags = normalizeTags(tags);
    const next: AiActionMetadata = {
        ...(metadata ?? {}),
    };

    if (normalizedTags.length === 0) {
        return next;
    }

    next.strategyTags = normalizedTags;
    if (options?.mirrorLegacyCardStrategyTags === true) {
        next.cardStrategyTags = normalizedTags;
    }
    return next;
}

export function scoreActionAgainstStrategyProfile<Tag extends string = string>(
    args: ScoreActionAgainstStrategyProfileArgs<Tag>,
): AiProfileAwareActionFit<Tag> | null {
    const actionTags = normalizeTags<Tag>(args.actionTags);
    if (actionTags.length === 0) return null;

    const weights: Partial<Record<Tag, number>> = {
        ...(args.profile.tagWeights ?? {}),
    };
    for (const tag of normalizeTags<Tag>(args.profile.tags)) {
        if (weights[tag] === undefined) {
            weights[tag] = 1;
        }
    }

    const matchedTags = actionTags.filter((tag) => {
        const weight = weights[tag];
        return typeof weight === 'number' && Number.isFinite(weight) && weight > 0;
    });
    if (matchedTags.length === 0) return null;

    const weightMultiplier = args.weightMultiplier ?? 18;
    const score = matchedTags.reduce((sum, tag) => sum + ((weights[tag] as number) * weightMultiplier), 0);
    const profileSummary = [...(args.profile.summary ?? [])];

    return {
        score: Number(score.toFixed(3)),
        reason: matchedTags.length === 1
            ? `当前策略更偏好 ${matchedTags[0]} 标签动作`
            : `当前策略更偏好 ${matchedTags.join(' / ')} 组合动作`,
        tags: actionTags,
        matchedTags,
        profileSummary,
    };
}

export function evaluateProfileAwareActionFit<Tag extends string = string>(
    args: EvaluateProfileAwareActionFitArgs<Tag>,
): AiProfileAwareActionFit<Tag> | null {
    const profile = args.getProfile(args.context, args.action);
    if (!profile) return null;

    const actionTags = args.getActionTags
        ? normalizeTags<Tag>(args.getActionTags(args.context, args.action))
        : getAiActionStrategyTags<Tag>(args.action);
    if (actionTags.length === 0) return null;

    if (args.evaluate) {
        const evaluated = args.evaluate({
            context: args.context,
            action: args.action,
            profile,
            actionTags,
        });
        if (!evaluated || !Number.isFinite(evaluated.score) || evaluated.score === 0) {
            return null;
        }

        return {
            score: Number(evaluated.score.toFixed(3)),
            reason: evaluated.reason,
            tags: actionTags,
            matchedTags: normalizeTags<Tag>(evaluated.matchedTags?.length ? evaluated.matchedTags : actionTags),
            profileSummary: [...(profile.summary ?? [])],
        };
    }

    return scoreActionAgainstStrategyProfile({
        profile,
        actionTags,
    });
}

export function createProfileAwareActionScorer<Tag extends string = string>(
    options: CreateProfileAwareActionScorerOptions<Tag>,
): LocalAiActionScorer {
    return {
        id: options.id,
        score(context, action): LocalAiActionScoreResult | null {
            if (options.allowedKinds && !options.allowedKinds.includes(action.kind)) {
                return null;
            }

            const fit = evaluateProfileAwareActionFit({
                context,
                action,
                getProfile: options.getProfile,
                getActionTags: options.getActionTags,
                evaluate: options.evaluate,
            });
            if (!fit || fit.score === 0) {
                return null;
            }

            return {
                score: fit.score,
                reason: options.formatReason
                    ? options.formatReason(fit)
                    : fit.profileSummary.length > 0
                        ? `${fit.reason}（当前策略：${fit.profileSummary.join(' / ')}）`
                        : fit.reason,
            };
        },
    };
}
