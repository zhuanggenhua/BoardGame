import type {
    AiDecisionContext,
    AiDifficultyProfile,
    AiLegalAction,
    BuildGameAiLegalActionsArgs,
} from '../../../engine/ai';
import type { Command, MatchState } from '../../../engine/types';
import { createSeededRandom } from '../../../engine/pipeline';
import { SummonerWarsDomain } from '../domain';
import { SW_COMMANDS } from '../domain/types';
import type { PlayerId, SummonerWarsCore } from '../domain/types';
import {
    buildSummonerWarsEvaluationDelta,
    evaluateSummonerWarsBoardState,
    type SummonerWarsBoardEvaluation,
    type SummonerWarsEvaluationDimension,
} from './evaluation';

export interface SummonerWarsActionProjection {
    score: number;
    reason: string;
    metadata: Record<string, unknown>;
}

interface SimulateActionResult {
    ok: boolean;
    state: MatchState<SummonerWarsCore>;
    reason?: string;
    eventsCount?: number;
}

interface ProjectActionDeltaArgs {
    context: AiDecisionContext;
    action: AiLegalAction;
    difficulty: AiDifficultyProfile;
    remainingBudgetMs: number;
    scoreScale: number;
    buildLegalActions: (args: BuildGameAiLegalActionsArgs) => AiLegalAction[];
}

interface SequenceSearchArgs {
    state: MatchState<SummonerWarsCore>;
    playerId: PlayerId;
    currentEvaluation: SummonerWarsBoardEvaluation;
    currentLegalActions: readonly AiLegalAction[];
    depthRemaining: number;
    deadlineMs: number;
    shortlistSize: number;
    buildLegalActions: (args: BuildGameAiLegalActionsArgs) => AiLegalAction[];
}

interface SequenceSearchResult {
    score: number;
    path: string[];
    actions: string[];
    terminalEvaluation: SummonerWarsBoardEvaluation;
    pruned: string[];
}

const SAFE_PROJECTABLE_COMMAND_TYPES = new Set<string>([
    SW_COMMANDS.SUMMON_UNIT,
    SW_COMMANDS.MOVE_UNIT,
    SW_COMMANDS.BUILD_STRUCTURE,
    SW_COMMANDS.DECLARE_ATTACK,
    SW_COMMANDS.DISCARD_FOR_MAGIC,
    SW_COMMANDS.PLAY_EVENT,
    SW_COMMANDS.ACTIVATE_ABILITY,
]);

const SAFE_SEQUENCE_ACTION_KINDS = new Set<string>([
    'summon-unit',
    'move-unit',
    'build-structure',
    'declare-attack',
    'discard-for-magic',
    'play-event',
    'activate-ability',
]);

const clampProjectionScore = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    return Number(Math.max(-160, Math.min(220, value)).toFixed(3));
};

const readMetadataNumber = (action: AiLegalAction, key: string): number => {
    const value = action.metadata?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const readMetadataPosition = (action: AiLegalAction, key: string): { row: number; col: number } | null => {
    const value = action.metadata?.[key];
    if (!value || typeof value !== 'object') return null;
    const candidate = value as { row?: unknown; col?: unknown };
    return typeof candidate.row === 'number' && typeof candidate.col === 'number'
        ? { row: candidate.row, col: candidate.col }
        : null;
};

const isSamePosition = (
    left: { row: number; col: number } | null,
    right: { row: number; col: number } | null,
): boolean => {
    return !!left && !!right && left.row === right.row && left.col === right.col;
};

function getSummonerExposurePenalty(context: AiDecisionContext, action: AiLegalAction): number {
    if (action.kind !== 'declare-attack' || action.metadata?.sourceIsSummoner !== true) {
        return 0;
    }
    if (String(action.metadata?.targetType ?? '') === 'summoner') {
        return 0;
    }

    const target = readMetadataPosition(action, 'target');
    const hasNonSummonerSameTargetAlternative = context.legalActions.some((candidate) => {
        return candidate.actionId !== action.actionId
            && candidate.kind === 'declare-attack'
            && candidate.metadata?.sourceIsSummoner !== true
            && isSamePosition(readMetadataPosition(candidate, 'target'), target);
    });

    return hasNonSummonerSameTargetAlternative ? 80 : 20;
}

function resolveSummonerWarsSequenceDepth(difficulty: AiDifficultyProfile): number {
    switch (difficulty.level) {
        case 'expert':
        case 'hard':
            return 3;
        case 'normal':
            return 2;
        case 'easy':
        default:
            return 1;
    }
}

function isProjectableAction(action: AiLegalAction): boolean {
    return action.commands.length > 0
        && action.commands.every((command) => SAFE_PROJECTABLE_COMMAND_TYPES.has(command.type));
}

function rankSequenceCandidate(action: AiLegalAction): number {
    switch (action.kind) {
        case 'declare-attack':
            return 120
                + (action.metadata?.lethalLikely === true ? 70 : 0)
                + (String(action.metadata?.targetType ?? '') === 'summoner' ? 90 : 0)
                + (action.metadata?.targetIsThreateningSummoner === true ? 55 : 0);
        case 'summon-unit':
            return 85
                + readMetadataNumber(action, 'strength') * 8
                + readMetadataNumber(action, 'life') * 3
                + (action.metadata?.nearForwardGate === true ? 28 : 0);
        case 'move-unit':
            return 78
                + readMetadataNumber(action, 'attackTargetsAfterMove') * 28
                + readMetadataNumber(action, 'centerScore') * 6;
        case 'build-structure':
            return 62
                + (action.metadata?.isGate === true ? 36 : 0)
                + readMetadataNumber(action, 'summonRangeExtension') * 22
                + readMetadataNumber(action, 'blocksEnemySummon') * 26;
        case 'discard-for-magic':
            return 42 - readMetadataNumber(action, 'keepValue') * 0.2;
        case 'activate-ability':
            return 76
                + readMetadataNumber(action, 'selfChargeGain') * 20
                + readMetadataNumber(action, 'adjacentAttackReadyCount') * 16
                + readMetadataNumber(action, 'allAttackReadyCount') * 12;
        case 'play-event':
            return action.metadata?.interaction === true ? 0 : 68;
        default:
            return 0;
    }
}

export function simulateSummonerWarsAiAction(args: {
    state: MatchState<SummonerWarsCore>;
    playerId: PlayerId;
    action: AiLegalAction;
    seed?: string;
}): SimulateActionResult {
    if (!isProjectableAction(args.action)) {
        return {
            ok: false,
            state: args.state,
            reason: '动作包含交互、阶段推进或未列入安全投影的命令',
        };
    }

    let currentState = args.state;
    let eventsCount = 0;
    for (let index = 0; index < args.action.commands.length; index += 1) {
        const commandSpec = args.action.commands[index];
        const command: Command = {
            type: commandSpec.type,
            playerId: args.playerId,
            payload: commandSpec.payload,
            timestamp: 0,
        };
        const validation = SummonerWarsDomain.validate(currentState, command as never);
        if (!validation.valid) {
            return {
                ok: false,
                state: args.state,
                reason: `投影验证失败：${validation.error ?? command.type}`,
            };
        }

        const random = createSeededRandom(`${args.seed ?? 'summonerwars-ai-projection'}:${args.action.actionId}:${index}`);
        const events = SummonerWarsDomain.execute(currentState, command as never, random);
        let nextCore = currentState.core;
        for (const event of events) {
            nextCore = SummonerWarsDomain.reduce(nextCore, event as never);
        }
        currentState = {
            ...currentState,
            core: nextCore,
        };
        eventsCount += events.length;
    }

    return {
        ok: true,
        state: currentState,
        eventsCount,
    };
}

function searchSummonerWarsInPhaseSequence(args: SequenceSearchArgs): SequenceSearchResult | null {
    if (args.depthRemaining <= 0 || Date.now() >= args.deadlineMs) return null;

    const candidates = args.currentLegalActions
        .filter((action) => SAFE_SEQUENCE_ACTION_KINDS.has(action.kind))
        .filter(isProjectableAction)
        .map((action) => ({ action, rank: rankSequenceCandidate(action) }))
        .sort((left, right) => right.rank - left.rank)
        .slice(0, Math.max(1, args.shortlistSize));

    let best: SequenceSearchResult | null = null;
    const pruned: string[] = [];

    for (const { action } of candidates) {
        if (Date.now() >= args.deadlineMs) {
            pruned.push('时间预算耗尽');
            break;
        }

        const simulated = simulateSummonerWarsAiAction({
            state: args.state,
            playerId: args.playerId,
            action,
            seed: 'summonerwars-ai-sequence',
        });
        if (!simulated.ok) {
            pruned.push(`${action.kind}:${simulated.reason ?? '不可投影'}`);
            continue;
        }
        if (
            simulated.state.core.currentPlayer !== args.state.core.currentPlayer
            || simulated.state.core.phase !== args.state.core.phase
        ) {
            pruned.push(`${action.kind}:离开当前阶段`);
            continue;
        }

        const nextLegalActions = args.buildLegalActions({
            playerId: args.playerId,
            state: simulated.state as MatchState<unknown>,
        });
        const nextEvaluation = evaluateSummonerWarsBoardState({
            state: simulated.state,
            playerId: args.playerId,
            legalActions: nextLegalActions,
        });
        const immediateGain = nextEvaluation.total - args.currentEvaluation.total;
        const child = searchSummonerWarsInPhaseSequence({
            ...args,
            state: simulated.state,
            currentEvaluation: nextEvaluation,
            currentLegalActions: nextLegalActions,
            depthRemaining: args.depthRemaining - 1,
        });
        const childScore = child ? Math.max(0, child.score) * 0.7 : 0;
        const totalScore = Number((immediateGain + childScore).toFixed(3));
        const result: SequenceSearchResult = {
            score: totalScore,
            path: [action.actionId, ...(child?.path ?? [])],
            actions: [action.kind, ...(child?.actions ?? [])],
            terminalEvaluation: child?.terminalEvaluation ?? nextEvaluation,
            pruned: [...pruned, ...(child?.pruned ?? [])],
        };

        if (!best || result.score > best.score) {
            best = result;
        }
    }

    return best;
}

function formatBoardDeltaReason(
    deltaBreakdown: Record<SummonerWarsEvaluationDimension, { delta: number }>,
    sequence: SequenceSearchResult | null,
): string {
    const ranked = Object.entries(deltaBreakdown)
        .sort((left, right) => Math.abs(right[1].delta) - Math.abs(left[1].delta))
        .slice(0, 2)
        .map(([dimension, value]) => `${dimension}:${value.delta >= 0 ? '+' : ''}${value.delta.toFixed(1)}`);
    const sequenceReason = sequence && sequence.score > 0
        ? `；短线序列 ${sequence.actions.join('→')} 额外收益`
        : '';
    return `局面差值评估 ${ranked.join(' / ')}${sequenceReason}`;
}

export function projectSummonerWarsActionDelta(args: ProjectActionDeltaArgs): SummonerWarsActionProjection {
    const state = args.context.visibleState as MatchState<SummonerWarsCore>;
    const playerId = args.context.playerId === '0' || args.context.playerId === '1'
        ? args.context.playerId
        : null;
    if (!playerId) {
        return {
            score: 0,
            reason: '非召唤师战争玩家视角，投影保守降级',
            metadata: {
                projection: {
                    status: 'fallback',
                    reason: 'invalid-player',
                },
            },
        };
    }

    const before = evaluateSummonerWarsBoardState({
        state,
        playerId,
        legalActions: args.context.legalActions,
    });
    const simulated = simulateSummonerWarsAiAction({
        state,
        playerId,
        action: args.action,
    });
    if (!simulated.ok) {
        return {
            score: 0,
            reason: simulated.reason ?? '不可安全投影，保守回退到基础 scorer',
            metadata: {
                projection: {
                    status: 'fallback',
                    reason: simulated.reason ?? 'unsafe-action',
                    baselineTotal: before.total,
                },
            },
        };
    }

    const afterLegalActions = args.buildLegalActions({
        playerId,
        state: simulated.state as MatchState<unknown>,
    });
    const after = evaluateSummonerWarsBoardState({
        state: simulated.state,
        playerId,
        legalActions: afterLegalActions,
    });
    const deltaBreakdown = buildSummonerWarsEvaluationDelta(before, after);
    const rawBoardDelta = after.total - before.total;
    const deadlineMs = Date.now() + Math.max(0, args.remainingBudgetMs);
    const sequenceDepth = resolveSummonerWarsSequenceDepth(args.difficulty) - 1;
    const sequence = sequenceDepth > 0
        ? searchSummonerWarsInPhaseSequence({
            state: simulated.state,
            playerId,
            currentEvaluation: after,
            currentLegalActions: afterLegalActions,
            depthRemaining: sequenceDepth,
            deadlineMs,
            shortlistSize: args.difficulty.shortlistSize,
            buildLegalActions: args.buildLegalActions,
        })
        : null;
    const sequenceScore = sequence ? Math.max(0, sequence.score) : 0;
    const summonerExposurePenalty = getSummonerExposurePenalty(args.context, args.action);
    const score = clampProjectionScore(
        (((rawBoardDelta * 0.18) + (sequenceScore * 0.1)) * args.scoreScale) - summonerExposurePenalty,
    );

    return {
        score,
        reason: formatBoardDeltaReason(deltaBreakdown, sequence),
        metadata: {
            projection: {
                status: 'projected',
                mode: 'validate-execute-reduce',
                baselineTotal: before.total,
                projectedTotal: after.total,
                rawBoardDelta: Number(rawBoardDelta.toFixed(3)),
                summonerExposurePenalty,
                scaledScore: score,
                eventsCount: simulated.eventsCount ?? 0,
            },
            boardDelta: {
                breakdown: deltaBreakdown,
            },
            sequence: sequence
                ? {
                    score: Number(sequence.score.toFixed(3)),
                    path: sequence.path,
                    actions: sequence.actions,
                    terminalTotal: sequence.terminalEvaluation.total,
                    pruned: sequence.pruned.slice(0, 6),
                }
                : {
                    score: 0,
                    path: [],
                    actions: [],
                    pruned: sequenceDepth > 0 ? ['无正收益短线序列'] : ['当前难度未启用多步序列'],
                },
        },
    };
}
