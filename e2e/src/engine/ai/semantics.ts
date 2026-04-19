import type {
    AiEffectIntent,
    AiHint,
    AiLegalAction,
    AiHintDerivation,
    AiRelationToActor,
    AiTargetKind,
    LocalAiActionScorer,
} from './types';

export interface ScoreAiHintOptions {
    relationIntentWeight?: number;
    optionalSkipPenalty?: number;
    moveEnemyBonus?: number;
    moveFriendlyBonus?: number;
    preferScore?: number;
    avoidScore?: number;
    mustSelectScore?: number;
    mustAvoidScore?: number;
}

export interface CreateInteractionHintScorerOptions extends ScoreAiHintOptions {
    id: string;
    actionKinds?: string[];
    skipPenaltyWhenAlternativesExist?: number;
    skipScoreWhenOnlyChoice?: number;
    confirmBonus?: number;
}

export interface BuildTargetAiHintOptions {
    actorPlayerId?: string;
    targetPlayerId?: string;
    effectIntent?: AiEffectIntent;
    targetKind?: AiTargetKind;
    targetOwnerId?: string;
    targetControllerId?: string;
    estimatedSwing?: number;
    priorityHint?: number;
    forcedTargetPolicy?: AiHint['forcedTargetPolicy'];
    tags?: string[];
    derivedFrom?: AiHintDerivation;
}

const DEFAULT_ACTION_KINDS = ['interaction-choice'];

export const OPTIONAL_SKIP_AI_HINT: AiHint = {
    tags: ['intent:optional-skip'],
    effectIntent: 'optional-skip',
    derivedFrom: 'explicit',
};

export function inferAiRelationToActor(
    targetPlayerId: string | undefined,
    actorPlayerId: string | undefined,
): AiRelationToActor | undefined {
    if (!targetPlayerId || !actorPlayerId) return undefined;
    return targetPlayerId === actorPlayerId ? 'self' : 'enemy';
}

export function getAiRelationSign(relation: AiRelationToActor | undefined): number {
    switch (relation) {
        case 'self':
        case 'ally':
            return 1;
        case 'enemy':
            return -1;
        default:
            return 0;
    }
}

export function getAiEffectBenefitSign(intent: AiEffectIntent | undefined): number {
    switch (intent) {
        case 'buff':
        case 'resource':
            return 1;
        case 'debuff':
        case 'destroy':
            return -1;
        default:
            return 0;
    }
}

export function extractActionAiHints(action: AiLegalAction): AiHint[] {
    if (Array.isArray(action.aiHints)) {
        return action.aiHints;
    }
    if (Array.isArray(action.metadata?.aiHints)) {
        return action.metadata.aiHints as AiHint[];
    }
    return [];
}

export function scoreAiHint(hint: AiHint, options: ScoreAiHintOptions = {}): number {
    const relationIntentWeight = options.relationIntentWeight ?? 75;
    const optionalSkipPenalty = options.optionalSkipPenalty ?? 35;
    const moveEnemyBonus = options.moveEnemyBonus ?? 8;
    const moveFriendlyBonus = options.moveFriendlyBonus ?? 4;
    const preferScore = options.preferScore ?? 40;
    const avoidScore = options.avoidScore ?? 40;
    const mustSelectScore = options.mustSelectScore ?? 120;
    const mustAvoidScore = options.mustAvoidScore ?? 120;

    let score = 0;
    const relationSign = getAiRelationSign(hint.relationToActor);
    const benefitSign = getAiEffectBenefitSign(hint.effectIntent);

    if (benefitSign !== 0 && relationSign !== 0) {
        score += relationSign * benefitSign * relationIntentWeight;
    }

    if (hint.effectIntent === OPTIONAL_SKIP_AI_HINT.effectIntent) {
        score -= optionalSkipPenalty;
    }

    if (hint.effectIntent === 'move') {
        if (hint.relationToActor === 'enemy') score += moveEnemyBonus;
        if (hint.relationToActor === 'self' || hint.relationToActor === 'ally') score += moveFriendlyBonus;
    }

    if (hint.effectIntent === 'inspect') {
        if (hint.relationToActor === 'enemy') score += 18;
        if (hint.relationToActor === 'self' || hint.relationToActor === 'ally') score += 6;
    }

    if (hint.forcedTargetPolicy === 'prefer') score += preferScore;
    if (hint.forcedTargetPolicy === 'avoid') score -= avoidScore;
    if (hint.forcedTargetPolicy === 'must-select') score += mustSelectScore;
    if (hint.forcedTargetPolicy === 'must-avoid') score -= mustAvoidScore;

    score += hint.priorityHint ?? 0;
    score += hint.estimatedSwing ?? 0;
    return score;
}

export function buildTargetAiHint(options: BuildTargetAiHintOptions): AiHint {
    const relationToActor = inferAiRelationToActor(options.targetPlayerId, options.actorPlayerId);
    const tags = [
        ...(options.tags ?? []),
        ...(options.targetKind ? [`target:${options.targetKind}`] : []),
        ...(relationToActor ? [`relation:${relationToActor}`] : []),
        ...(options.effectIntent ? [`intent:${options.effectIntent}`] : []),
    ];

    return {
        ...(tags.length > 0 ? { tags } : {}),
        ...(relationToActor ? { relationToActor } : {}),
        ...(options.effectIntent ? { effectIntent: options.effectIntent } : {}),
        ...(options.targetKind ? { targetKind: options.targetKind } : {}),
        ...(options.targetPlayerId ? { targetPlayerId: options.targetPlayerId } : {}),
        ...(options.targetOwnerId ? { targetOwnerId: options.targetOwnerId } : {}),
        ...(options.targetControllerId ? { targetControllerId: options.targetControllerId } : {}),
        ...(options.estimatedSwing !== undefined ? { estimatedSwing: options.estimatedSwing } : {}),
        ...(options.priorityHint !== undefined ? { priorityHint: options.priorityHint } : {}),
        ...(options.forcedTargetPolicy ? { forcedTargetPolicy: options.forcedTargetPolicy } : {}),
        derivedFrom: options.derivedFrom ?? 'inferred',
    };
}

export function scoreAiHints(hints: AiHint[], options: ScoreAiHintOptions = {}): number {
    return hints.reduce((sum, hint) => sum + scoreAiHint(hint, options), 0);
}

export function summarizeAiHints(hints: AiHint[]): string {
    if (hints.some((hint) => hint.effectIntent === 'buff' && (hint.relationToActor === 'self' || hint.relationToActor === 'ally'))) {
        return '增益目标命中己方语义';
    }
    if (hints.some((hint) => hint.effectIntent === 'buff' && hint.relationToActor === 'enemy')) {
        return '增益目标命中敌方语义，应降权';
    }
    if (hints.some((hint) => hint.effectIntent === 'destroy' && hint.relationToActor === 'enemy')) {
        return '消灭目标命中敌方语义';
    }
    if (hints.some((hint) => hint.effectIntent === 'destroy' && (hint.relationToActor === 'self' || hint.relationToActor === 'ally'))) {
        return '消灭目标命中己方语义，应降权';
    }
    if (hints.some((hint) => hint.effectIntent === 'debuff' && hint.relationToActor === 'enemy')) {
        return '减益目标命中敌方语义';
    }
    if (hints.some((hint) => hint.effectIntent === 'debuff' && (hint.relationToActor === 'self' || hint.relationToActor === 'ally'))) {
        return '减益目标命中己方语义，应降权';
    }
    if (hints.some((hint) => hint.effectIntent === 'inspect' && hint.relationToActor === 'enemy')) {
        return '侦察目标命中敌方语义';
    }
    if (hints.some((hint) => hint.effectIntent === 'inspect' && (hint.relationToActor === 'self' || hint.relationToActor === 'ally'))) {
        return '侦察目标命中己方语义';
    }
    if (hints.some((hint) => hint.effectIntent === OPTIONAL_SKIP_AI_HINT.effectIntent)) {
        return '可跳过选项默认降权';
    }
    return '交互目标语义更优';
}

export function createInteractionHintScorer(
    options: CreateInteractionHintScorerOptions,
): LocalAiActionScorer {
    const actionKinds = new Set(options.actionKinds ?? DEFAULT_ACTION_KINDS);

    return {
        id: options.id,
        score(context, action) {
            if (!actionKinds.has(action.kind)) return null;

            const hints = extractActionAiHints(action);
            if (hints.length > 0) {
                const score = scoreAiHints(hints, options);
                if (score !== 0) {
                    return {
                        score,
                        reason: summarizeAiHints(hints),
                    };
                }
            }

            const optionId = typeof action.metadata?.optionId === 'string'
                ? action.metadata.optionId
                : '';
            if (optionId === 'skip' || optionId === '__cancel__') {
                const hasAlternativeChoice = context.legalActions.some((candidate) =>
                    candidate.actionId !== action.actionId && actionKinds.has(candidate.kind),
                );
                return {
                    score: hasAlternativeChoice
                        ? -(options.skipPenaltyWhenAlternativesExist ?? 30)
                        : (options.skipScoreWhenOnlyChoice ?? 5),
                    reason: hasAlternativeChoice ? '还有其他交互候选时，默认不优先跳过' : '当前仅剩跳过候选',
                };
            }

            if (optionId.includes('confirm') || optionId.includes('accept')) {
                return {
                    score: options.confirmBonus ?? 10,
                    reason: '确认类交互保留轻微正分',
                };
            }

            return null;
        },
    };
}
