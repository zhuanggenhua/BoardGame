import type { MatchState } from '../types';
import { resolveAiDifficultyProfile } from './difficulty';
import { getGameAiRuntime } from './registry';
import { extractAiInteractionSnapshot, extractAiResponseWindowSnapshot } from './snapshots';
import type { AiActionDecision, AiDecisionContext, AiLegalAction, AiSeatController } from './types';

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
    seatController?: AiSeatController;
}

function shouldBlockHiddenInteractionActions(
    visibleState: MatchState<unknown>,
    interaction: ReturnType<typeof extractAiInteractionSnapshot>,
    responseWindow: ReturnType<typeof extractAiResponseWindowSnapshot>,
    playerId: string,
): boolean {
    if (visibleState.sys?.interaction?.isBlocked !== true || interaction) {
        return false;
    }

    const responderIndex = typeof responseWindow?.currentResponderIndex === 'number'
        ? responseWindow.currentResponderIndex
        : 0;
    const currentResponderId = responseWindow?.responderQueue?.[responderIndex];
    if (currentResponderId === playerId && !responseWindow?.pendingInteractionId) {
        return false;
    }

    return true;
}

export function buildAiDecisionContext(args: BuildAiDecisionContextArgs): AiDecisionContext {
    const runtime = getGameAiRuntime(args.gameId);
    const interaction = extractAiInteractionSnapshot(args.visibleState);
    const responseWindow = extractAiResponseWindowSnapshot(args.visibleState);
    const legalActions = shouldBlockHiddenInteractionActions(args.visibleState, interaction, responseWindow, args.playerId)
        ? []
        : (runtime?.buildLegalActions({
            playerId: args.playerId,
            state: args.visibleState,
        }) ?? []);
    let featureSnapshot: Record<string, unknown> | null = null;
    if (runtime?.buildFeatureSnapshot) {
        try {
            const snapshot = runtime.buildFeatureSnapshot({
                playerId: args.playerId,
                state: args.visibleState,
                legalActions,
                interaction,
                responseWindow,
            });
            if (snapshot && typeof snapshot === 'object') {
                featureSnapshot = snapshot;
            }
        } catch {
            featureSnapshot = null;
        }
    }

    return {
        gameId: args.gameId,
        matchId: args.matchId,
        playerId: args.playerId,
        visibleState: args.visibleState,
        interaction,
        responseWindow,
        legalActions,
        rulesVersion: args.rulesVersion,
        decisionBudgetMs: args.decisionBudgetMs,
        source: args.source,
        difficulty: resolveAiDifficultyProfile(
            args.seatController?.type === 'local-ai'
                ? args.seatController.difficulty
                : undefined,
        ),
        featureSnapshot,
    };
}

export function resolveAiActionDecision(
    context: AiDecisionContext,
    decision: AiActionDecision | null | undefined,
): AiLegalAction | null {
    if (!decision) return null;
    return context.legalActions.find((action) => action.actionId === decision.actionId) ?? null;
}
