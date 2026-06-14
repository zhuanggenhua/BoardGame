import type { AiDecisionContext, AiLegalAction, GameAiRuntime, LocalAiPolicy } from '../../engine/ai';
import { createAiLegalActionId } from '../../engine/ai';
import type { MatchState, PlayerId, RandomFn } from '../../engine/types';
import { FantasyRealmsDomain } from './domain';
import { evaluateFantasyRealmsScore } from './domain';
import { getDeckDrawCount } from './domain/commands';
import type { FantasyRealmsCommand, FantasyRealmsCore } from './domain/types';
import { RUNTIME_DECK_CARDS } from './foundation';

type FantasyRealmsState = MatchState<FantasyRealmsCore>;
type AiOutcomeScore = {
    totalScore: number;
    tiebreakBaseScore: number;
};
type AiEvaluationCache = {
    discardOutcomeByKey: Map<string, AiOutcomeScore>;
    playerOutcomeByKey: Map<string, AiOutcomeScore>;
};

const RUNTIME_CARD_IDS = new Set(RUNTIME_DECK_CARDS.map((card) => card.id));

const AI_NOOP_RANDOM: RandomFn = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T>(array: T[]) => [...array],
};
const MAX_BLIND_SINGLE_DRAW_SAMPLES = 48;
const MAX_BLIND_DOUBLE_DRAW_SAMPLES = 120;

const createDrawDeckAction = (): AiLegalAction => ({
    actionId: createAiLegalActionId('draw-deck'),
    kind: 'draw-deck',
    label: '从牌库摸牌',
    commands: [{
        type: 'DRAW_FROM_DECK',
        payload: {},
    }],
});

const createTakeDiscardAction = (cardId: string, cardName: string): AiLegalAction => ({
    actionId: createAiLegalActionId('take-discard', cardId),
    kind: 'take-discard',
    label: `拿取公开弃牌 ${cardName}`,
    commands: [{
        type: 'TAKE_FROM_DISCARD',
        payload: { cardId },
    }],
    metadata: { cardId, cardName },
});

const createDiscardAction = (cardId: string, cardName: string): AiLegalAction => ({
    actionId: createAiLegalActionId('discard-card', cardId),
    kind: 'discard-card',
    label: `弃置手牌 ${cardName}`,
    commands: [{
        type: 'DISCARD_CARD',
        payload: { cardId },
    }],
    metadata: { cardId, cardName },
});

function cloneState(state: FantasyRealmsState): FantasyRealmsState {
    return {
        ...state,
        core: {
            ...state.core,
            drawPile: state.core.drawPile.map((card) => ({ ...card })),
            discardPile: state.core.discardPile.map((card) => ({ ...card })),
            players: Object.fromEntries(
                Object.entries(state.core.players).map(([playerId, player]) => [playerId, {
                    ...player,
                    hand: player.hand.map((card) => ({ ...card })),
                    scoreBreakdown: player.scoreBreakdown.map((line) => ({ ...line })),
                }]),
            ) as FantasyRealmsCore['players'],
        },
        sys: { ...state.sys },
    };
}

function createAiEvaluationCache(): AiEvaluationCache {
    return {
        discardOutcomeByKey: new Map<string, AiOutcomeScore>(),
        playerOutcomeByKey: new Map<string, AiOutcomeScore>(),
    };
}

function buildCardSetKey(cards: Array<{ id: string }>): string {
    return cards.map((card) => card.id).sort().join('|');
}

function cloneOutcome(outcome: AiOutcomeScore): AiOutcomeScore {
    return {
        totalScore: outcome.totalScore,
        tiebreakBaseScore: outcome.tiebreakBaseScore,
    };
}

function resolveBlindSampleCap(drawCount: number, decisionBudgetMs: number): number {
    const normalizedBudget = Number.isFinite(decisionBudgetMs) ? Math.max(0, decisionBudgetMs) : 250;
    const baseline = drawCount >= 2 ? MAX_BLIND_DOUBLE_DRAW_SAMPLES : MAX_BLIND_SINGLE_DRAW_SAMPLES;
    if (normalizedBudget >= 1000) return baseline;
    if (normalizedBudget >= 500) return Math.max(32, Math.floor(baseline * 0.75));
    return Math.max(16, Math.floor(baseline * 0.5));
}

function applyAiCommand(state: FantasyRealmsState, playerId: PlayerId, command: FantasyRealmsCommand): FantasyRealmsState {
    const workingState = cloneState(state);
    const normalizedCommand = {
        ...command,
        playerId,
        timestamp: command.timestamp ?? 0,
    } as FantasyRealmsCommand;
    const events = FantasyRealmsDomain.execute(workingState, normalizedCommand, AI_NOOP_RANDOM);
    const nextCore = events.reduce(
        (core, event) => FantasyRealmsDomain.reduce(core, event),
        workingState.core,
    );
    return {
        ...workingState,
        core: nextCore,
    };
}

function evaluatePlayerOutcome(state: FantasyRealmsState, playerId: PlayerId, cache: AiEvaluationCache): AiOutcomeScore {
    const player = state.core.players[playerId];
    if (!player) {
        return {
            totalScore: Number.NEGATIVE_INFINITY,
            tiebreakBaseScore: Number.POSITIVE_INFINITY,
        };
    }
    const cacheKey = `${buildCardSetKey(player.hand)}::${buildCardSetKey(state.core.discardPile)}`;
    const cached = cache.playerOutcomeByKey.get(cacheKey);
    if (cached) {
        return cloneOutcome(cached);
    }
    const evaluation = evaluateFantasyRealmsScore(player.hand, state.core.discardPile);
    const outcome = {
        totalScore: evaluation.totalScore,
        tiebreakBaseScore: evaluation.tiebreakBaseScore,
    };
    cache.playerOutcomeByKey.set(cacheKey, outcome);
    return cloneOutcome(outcome);
}

function compareAiOutcome(a: AiOutcomeScore, b: AiOutcomeScore): number {
    if (a.totalScore !== b.totalScore) {
        return a.totalScore - b.totalScore;
    }
    if (a.tiebreakBaseScore !== b.tiebreakBaseScore) {
        return b.tiebreakBaseScore - a.tiebreakBaseScore;
    }
    return 0;
}

function getBestDiscardOutcome(
    hand: FantasyRealmsState['core']['players'][PlayerId]['hand'],
    discardPile: FantasyRealmsState['core']['discardPile'],
    cache: AiEvaluationCache,
): AiOutcomeScore {
    if (hand.length === 0) {
        const evaluation = evaluateFantasyRealmsScore([], discardPile);
        return {
            totalScore: evaluation.totalScore,
            tiebreakBaseScore: evaluation.tiebreakBaseScore,
        };
    }
    const cacheKey = `${buildCardSetKey(hand)}::${buildCardSetKey(discardPile)}`;
    const cached = cache.discardOutcomeByKey.get(cacheKey);
    if (cached) {
        return cloneOutcome(cached);
    }

    let bestOutcome: AiOutcomeScore | null = null;
    for (let index = 0; index < hand.length; index += 1) {
        const discardedCard = hand[index];
        if (!discardedCard) continue;
        const keptHand = hand.filter((_, currentIndex) => currentIndex !== index);
        const evaluation = evaluateFantasyRealmsScore(keptHand, [...discardPile, discardedCard]);
        const candidateOutcome = {
            totalScore: evaluation.totalScore,
            tiebreakBaseScore: evaluation.tiebreakBaseScore,
        };
        if (!bestOutcome || compareAiOutcome(candidateOutcome, bestOutcome) > 0) {
            bestOutcome = candidateOutcome;
        }
    }

    const outcome = bestOutcome ?? {
        totalScore: Number.NEGATIVE_INFINITY,
        tiebreakBaseScore: Number.POSITIVE_INFINITY,
    };
    cache.discardOutcomeByKey.set(cacheKey, outcome);
    return cloneOutcome(outcome);
}

function buildUnseenCardPool(state: FantasyRealmsState): FantasyRealmsState['core']['drawPile'] {
    const visibleCardIds = new Set<string>();
    for (const card of state.core.discardPile) {
        if (RUNTIME_CARD_IDS.has(card.id)) {
            visibleCardIds.add(card.id);
        }
    }
    for (const player of Object.values(state.core.players)) {
        for (const card of player.hand) {
            if (RUNTIME_CARD_IDS.has(card.id)) {
                visibleCardIds.add(card.id);
            }
        }
    }

    return RUNTIME_DECK_CARDS
        .filter((card) => !visibleCardIds.has(card.id))
        .map((card) => ({ ...card }));
}

function evaluateBlindDeckDrawOutcome(
    state: FantasyRealmsState,
    playerId: PlayerId,
    decisionBudgetMs: number,
    cache: AiEvaluationCache,
): AiOutcomeScore {
    const player = state.core.players[playerId];
    if (!player) {
        return {
            totalScore: Number.NEGATIVE_INFINITY,
            tiebreakBaseScore: Number.POSITIVE_INFINITY,
        };
    }

    const unseenPool = buildUnseenCardPool(state);
    const drawCount = getDeckDrawCount(state.core);
    if (drawCount <= 0 || unseenPool.length < drawCount) {
        return evaluatePlayerOutcome(state, playerId, cache);
    }

    const sampleCap = resolveBlindSampleCap(drawCount, decisionBudgetMs);
    let totalScoreSum = 0;
    let tiebreakBaseScoreSum = 0;
    let sampleCount = 0;

    if (drawCount === 1) {
        const stride = Math.max(1, Math.ceil(unseenPool.length / sampleCap));
        for (let index = 0; index < unseenPool.length; index += stride) {
            const drawnCard = unseenPool[index];
            if (!drawnCard) continue;
            const outcome = getBestDiscardOutcome([...player.hand, drawnCard], state.core.discardPile, cache);
            totalScoreSum += outcome.totalScore;
            tiebreakBaseScoreSum += outcome.tiebreakBaseScore;
            sampleCount += 1;
        }
    } else {
        const totalCombinationCount = (unseenPool.length * (unseenPool.length - 1)) / 2;
        const effectiveCap = Math.min(sampleCap, totalCombinationCount);
        const stride = Math.max(1, Math.ceil(totalCombinationCount / Math.max(1, effectiveCap)));
        let combinationIndex = 0;
        for (let firstIndex = 0; firstIndex < unseenPool.length - 1; firstIndex += 1) {
            const firstCard = unseenPool[firstIndex];
            if (!firstCard) continue;
            for (let secondIndex = firstIndex + 1; secondIndex < unseenPool.length; secondIndex += 1) {
                const secondCard = unseenPool[secondIndex];
                if (!secondCard) continue;
                if (combinationIndex % stride === 0) {
                    const outcome = getBestDiscardOutcome([...player.hand, firstCard, secondCard], state.core.discardPile, cache);
                    totalScoreSum += outcome.totalScore;
                    tiebreakBaseScoreSum += outcome.tiebreakBaseScore;
                    sampleCount += 1;
                }
                combinationIndex += 1;
            }
        }
    }

    if (sampleCount === 0) {
        return evaluatePlayerOutcome(state, playerId, cache);
    }

    return {
        totalScore: totalScoreSum / sampleCount,
        tiebreakBaseScore: tiebreakBaseScoreSum / sampleCount,
    };
}

function evaluateActionOutcome(
    state: FantasyRealmsState,
    playerId: PlayerId,
    action: AiLegalAction,
    decisionBudgetMs: number,
    cache: AiEvaluationCache,
): AiOutcomeScore {
    if (action.kind === 'draw-deck') {
        return evaluateBlindDeckDrawOutcome(state, playerId, decisionBudgetMs, cache);
    }

    const command = action.commands[0] as FantasyRealmsCommand | undefined;
    if (!command) {
        return {
            totalScore: Number.NEGATIVE_INFINITY,
            tiebreakBaseScore: Number.POSITIVE_INFINITY,
        };
    }

    const afterAction = applyAiCommand(state, playerId, command);
    if (afterAction.core.currentPlayer === playerId && afterAction.core.stage === 'discard') {
        return getBestDiscardOutcome(afterAction.core.players[playerId]?.hand ?? [], afterAction.core.discardPile, cache);
    }

    return evaluatePlayerOutcome(afterAction, playerId, cache);
}

export function buildFantasyRealmsAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as FantasyRealmsState;
    const core = state.core;
    if (state.sys?.gameover) return [];
    if (core.currentPlayer !== args.playerId) return [];

    if (core.stage === 'draw') {
        const actions: AiLegalAction[] = [];
        if (core.drawPile.length >= getDeckDrawCount(core)) {
            actions.push(createDrawDeckAction());
        }
        for (const card of core.discardPile) {
            actions.push(createTakeDiscardAction(card.id, card.displayNameZh || card.name));
        }
        return actions;
    }

    if (core.stage === 'discard') {
        return (core.players[args.playerId]?.hand ?? []).map((card) => (
            createDiscardAction(card.id, card.displayNameZh || card.name)
        ));
    }

    return [];
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context: AiDecisionContext) {
        const state = context.visibleState as FantasyRealmsState;
        const playerId = context.playerId;
        const cache = createAiEvaluationCache();

        let bestActionId: string | null = null;
        let bestOutcome: AiOutcomeScore | null = null;

        for (const action of context.legalActions) {
            const outcome = evaluateActionOutcome(state, playerId, action, context.decisionBudgetMs, cache);
            if (!bestOutcome || compareAiOutcome(outcome, bestOutcome) > 0) {
                bestOutcome = outcome;
                bestActionId = action.actionId;
            }
        }

        return bestActionId ? { actionId: bestActionId } : null;
    },
};

export const fantasyRealmsAiRuntime: GameAiRuntime = {
    gameId: 'fantasyrealms',
    buildLegalActions: buildFantasyRealmsAiLegalActions,
    defaultMinimumActionDelayMs: 900,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
