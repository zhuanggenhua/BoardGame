import type { MatchState } from '../types';
import { getGameAiRuntime } from './registry';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from './snapshots';
import type { AiActionDecision, AiDecisionContext, AiLegalAction } from './types';

export function createAiLegalActionId(...parts: Array<string | number | undefined | null>): string {
    return parts
        .filter((part) => part !== undefined && part !== null && `${part}`.length > 0)
        .map((part) => `${part}`.replace(/[^a-zA-Z0-9_-]+/g, '-'))
        .join(':');
}

interface BuildAiDecisionContextArgs {
    gameId: string;
    matchId: string;
    playerId: string;
    visibleState: MatchState<unknown>;
    rulesVersion: string | null;
    decisionBudgetMs: number;
    source: 'local' | 'online';
}

export function buildAiDecisionContext(args: BuildAiDecisionContextArgs): AiDecisionContext {
    const runtime = getGameAiRuntime(args.gameId);
    const legalActions = runtime?.buildLegalActions({
        playerId: args.playerId,
        state: args.visibleState,
    }) ?? [];

    return {
        gameId: args.gameId,
        matchId: args.matchId,
        playerId: args.playerId,
        visibleState: args.visibleState,
        interaction: extractAiInteractionSnapshot(args.visibleState),
        responseWindow: extractAiResponseWindowSnapshot(args.visibleState),
        legalActions,
        rulesVersion: args.rulesVersion,
        decisionBudgetMs: args.decisionBudgetMs,
        source: args.source,
    };
}

export function resolveAiActionDecision(
    context: AiDecisionContext,
    decision: AiActionDecision | null | undefined,
): AiLegalAction | null {
    if (!decision) return null;
    return context.legalActions.find((action) => action.actionId === decision.actionId) ?? null;
}
