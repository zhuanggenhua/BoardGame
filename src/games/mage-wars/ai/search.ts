import type {
    AiActionOutcome,
    AiDecisionContext,
    AiDifficultyProfile,
    AiLegalAction,
    BuildGameAiLegalActionsArgs,
} from '../../../engine/ai';
import { createSeededRandom } from '../../../engine/pipeline';
import type { Command, MatchState } from '../../../engine/types';
import { MageWarsDomain } from '../domain';
import type { MageWarsCommand, MageWarsCore } from '../domain/types';
import {
    buildMageWarsEvaluationDelta,
    evaluateMageWarsBoardState,
} from './evaluation';

const PROJECTABLE_COMMAND_TYPES = new Set<string>([
    'mw:plan_spells',
    'mw:plan_object_spell',
    'mw:cast_spell',
    'mw:move_mage',
    'mw:move_arena_object',
    'mw:guard',
    'mw:declare_attack',
    'mw:declare_object_attack',
]);

const PROJECTABLE_ACTION_KINDS = new Set<string>([
    'plan-spells',
    'plan-object-spell',
    'cast-spell',
    'cast-object-spell',
    'move-mage',
    'move-object',
    'guard',
    'guard-object',
    'attack',
    'object-attack',
]);

export interface MageWarsActionProjection {
    score: number;
    reason: string;
    metadata: Record<string, unknown>;
}

interface SimulateActionResult {
    ok: boolean;
    state: MatchState<MageWarsCore>;
    reason?: string;
    eventsCount?: number;
}

const clampScore = (value: number): number => Number(Math.max(-180, Math.min(240, value)).toFixed(3));

const isProjectableAction = (action: AiLegalAction): boolean => (
    PROJECTABLE_ACTION_KINDS.has(action.kind)
    && action.commands.length > 0
    && action.commands.every((command) => PROJECTABLE_COMMAND_TYPES.has(command.type))
);

export function simulateMageWarsAiAction(args: {
    state: MatchState<MageWarsCore>;
    playerId: string;
    action: AiLegalAction;
    seed?: string;
}): SimulateActionResult {
    if (!isProjectableAction(args.action)) {
        return {
            ok: false,
            state: args.state,
            reason: '动作包含交互或阶段推进，当前不做状态投影',
        };
    }

    let currentState = args.state;
    let eventsCount = 0;
    for (const [index, commandSpec] of args.action.commands.entries()) {
        const command: Command = {
            type: commandSpec.type,
            playerId: args.playerId,
            payload: commandSpec.payload,
            timestamp: 0,
        };
        const validation = MageWarsDomain.validate(currentState, command as MageWarsCommand);
        if (!validation.valid) {
            return {
                ok: false,
                state: args.state,
                reason: `投影验证失败：${validation.error ?? command.type}`,
            };
        }
        const events = MageWarsDomain.execute(
            currentState,
            command as MageWarsCommand,
            createSeededRandom(`${args.seed ?? 'mage-wars-ai-projection'}:${args.action.actionId}:${index}`),
        );
        for (const event of events) {
            currentState = {
                ...currentState,
                core: MageWarsDomain.reduce(currentState.core, event),
            };
        }
        eventsCount += events.length;
    }

    return { ok: true, state: currentState, eventsCount };
}

function resolveSequenceDepth(difficulty: AiDifficultyProfile): number {
    switch (difficulty.level) {
        case 'expert':
        case 'hard':
            return 2;
        case 'normal':
            return 1;
        case 'easy':
        default:
            return 0;
    }
}

function rankSequenceCandidate(action: AiLegalAction): number {
    const targetValue = typeof action.metadata?.targetValue === 'number'
        ? action.metadata.targetValue
        : 0;
    const lethal = action.metadata?.lethalLikely === true ? 90 : 0;
    switch (action.kind) {
        case 'object-attack':
        case 'attack':
            return 100 + targetValue * 0.35 + lethal;
        case 'cast-spell':
        case 'cast-object-spell':
            return 84 + targetValue * 0.25 + (action.metadata?.isSummonSpell === true ? 32 : 0);
        case 'plan-object-spell':
        case 'plan-spells':
            return 50 + (action.metadata?.planningValueTotal as number ?? 0);
        case 'move-mage':
        case 'move-object':
            return 44 + (action.metadata?.distanceToEnemyMageAfter as number ?? 0) * -2;
        case 'guard':
        case 'guard-object':
            return 36;
        default:
            return 0;
    }
}

function searchMageWarsSequence(args: {
    state: MatchState<MageWarsCore>;
    playerId: string;
    currentEvaluation: ReturnType<typeof evaluateMageWarsBoardState>;
    currentLegalActions: readonly AiLegalAction[];
    depthRemaining: number;
    deadlineMs: number;
    shortlistSize: number;
    buildLegalActions: (args: BuildGameAiLegalActionsArgs) => AiLegalAction[];
}): { score: number; actions: string[]; path: string[] } | null {
    if (args.depthRemaining <= 0 || Date.now() >= args.deadlineMs) return null;

    const candidates = args.currentLegalActions
        .filter(isProjectableAction)
        .sort((left, right) => rankSequenceCandidate(right) - rankSequenceCandidate(left))
        .slice(0, Math.max(1, args.shortlistSize));
    let best: { score: number; actions: string[]; path: string[] } | null = null;

    for (const action of candidates) {
        if (Date.now() >= args.deadlineMs) break;
        const simulated = simulateMageWarsAiAction({
            state: args.state,
            playerId: args.playerId,
            action,
            seed: 'mage-wars-ai-sequence',
        });
        if (!simulated.ok) continue;
        const nextLegalActions = args.buildLegalActions({
            playerId: args.playerId,
            state: simulated.state as MatchState<unknown>,
        });
        const nextEvaluation = evaluateMageWarsBoardState({
            state: simulated.state,
            playerId: args.playerId,
            legalActions: nextLegalActions,
        });
        const immediateGain = nextEvaluation.total - args.currentEvaluation.total;
        const child = searchMageWarsSequence({
            ...args,
            state: simulated.state,
            currentEvaluation: nextEvaluation,
            currentLegalActions: nextLegalActions,
            depthRemaining: args.depthRemaining - 1,
        });
        const score = immediateGain + (child ? Math.max(0, child.score) * 0.65 : 0);
        const result = {
            score,
            actions: [action.kind, ...(child?.actions ?? [])],
            path: [action.actionId, ...(child?.path ?? [])],
        };
        if (!best || result.score > best.score) best = result;
    }
    return best;
}

export function projectMageWarsActionDelta(args: {
    context: AiDecisionContext;
    action: AiLegalAction;
    difficulty: AiDifficultyProfile;
    remainingBudgetMs: number;
    buildLegalActions: (args: BuildGameAiLegalActionsArgs) => AiLegalAction[];
}): MageWarsActionProjection {
    const state = args.context.visibleState as MatchState<MageWarsCore>;
    const before = evaluateMageWarsBoardState({
        state,
        playerId: args.context.playerId,
        legalActions: args.context.legalActions,
    });
    const simulated = simulateMageWarsAiAction({
        state,
        playerId: args.context.playerId,
        action: args.action,
    });
    if (!simulated.ok) {
        return {
            score: 0,
            reason: simulated.reason ?? '动作无法安全投影',
            metadata: { projection: { status: 'fallback', reason: simulated.reason } },
        };
    }

    const afterLegalActions = args.buildLegalActions({
        playerId: args.context.playerId,
        state: simulated.state as MatchState<unknown>,
    });
    const after = evaluateMageWarsBoardState({
        state: simulated.state,
        playerId: args.context.playerId,
        legalActions: afterLegalActions,
    });
    const rawDelta = after.total - before.total;
    const sequenceDepth = resolveSequenceDepth(args.difficulty);
    const sequence = sequenceDepth > 0
        ? searchMageWarsSequence({
            state: simulated.state,
            playerId: args.context.playerId,
            currentEvaluation: after,
            currentLegalActions: afterLegalActions,
            depthRemaining: sequenceDepth,
            deadlineMs: Date.now() + Math.max(0, args.remainingBudgetMs),
            shortlistSize: args.difficulty.shortlistSize,
            buildLegalActions: args.buildLegalActions,
        })
        : null;
    const sequenceScore = sequence ? Math.max(0, sequence.score) : 0;
    const score = clampScore(rawDelta * 0.22 + sequenceScore * 0.08);
    const delta = buildMageWarsEvaluationDelta(before, after);
    const largestDelta = Object.entries(delta)
        .sort((left, right) => Math.abs(right[1].delta) - Math.abs(left[1].delta))
        .slice(0, 2)
        .map(([dimension, value]) => `${dimension}:${value.delta >= 0 ? '+' : ''}${value.delta.toFixed(1)}`)
        .join(' / ');

    return {
        score,
        reason: `执行后局面差值 ${largestDelta}${sequence && sequence.score > 0 ? `；短线 ${sequence.actions.join('→')}` : ''}`,
        metadata: {
            projection: {
                status: 'projected',
                baselineTotal: before.total,
                projectedTotal: after.total,
                rawDelta: Number(rawDelta.toFixed(3)),
                eventsCount: simulated.eventsCount ?? 0,
            },
            boardDelta: delta,
            sequence: sequence
                ? { score: Number(sequence.score.toFixed(3)), path: sequence.path, actions: sequence.actions }
                : { score: 0, path: [], actions: [] },
        },
    };
}

export function projectMageWarsActionOutcome(args: {
    context: AiDecisionContext;
    action: AiLegalAction;
}): AiActionOutcome | null {
    if (!isProjectableAction(args.action)) return null;
    const simulated = simulateMageWarsAiAction({
        state: args.context.visibleState as MatchState<MageWarsCore>,
        playerId: args.context.playerId,
        action: args.action,
    });
    if (!simulated.ok) {
        return {
            actionId: args.action.actionId,
            actionKind: args.action.kind,
            status: 'rejected',
            tags: ['projection-rejected'],
        };
    }
    const before = evaluateMageWarsBoardState({
        state: args.context.visibleState as MatchState<MageWarsCore>,
        playerId: args.context.playerId,
        legalActions: args.context.legalActions,
    });
    const after = evaluateMageWarsBoardState({
        state: simulated.state,
        playerId: args.context.playerId,
    });
    const utilityDelta = Number((after.total - before.total).toFixed(3));
    return {
        actionId: args.action.actionId,
        actionKind: args.action.kind,
        status: 'succeeded',
        utilityDelta,
        hasMeaningfulEffect: utilityDelta > 0,
        tags: utilityDelta <= 0 ? ['no-benefit'] : ['projected'],
        eventTypes: [],
        metadata: { utilityDelta, eventsCount: simulated.eventsCount ?? 0 },
    };
}
