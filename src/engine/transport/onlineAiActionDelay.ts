import {
    getGameAiRuntime,
    type AiLegalAction,
    type AiSeatController,
} from '../ai';
import {
    resolveLocalAiActionDelayPlan,
    type LocalAiActionDelayPlan,
} from '../ai/actionDelay';
import { resolveLocalAiActionVisibility } from '../ai/actionVisibility';

export type OnlineAiActionDelayResult = {
    delayPlan: LocalAiActionDelayPlan;
    waitedMs: number;
};

export type OnlineAiActionDelayContext = {
    lastVisibleActionAt: number | null;
};

export type OnlineAiActionDelayTraceEmitter = (
    stage: string,
    payload: Record<string, unknown>,
) => void;

export function createOnlineAiActionDelayContext(): OnlineAiActionDelayContext {
    return {
        lastVisibleActionAt: null,
    };
}

export async function waitForOnlineAiActionDelay(args: {
    matchId: string;
    gameId: string;
    playerId: string;
    action: AiLegalAction;
    controller: AiSeatController;
    delayContext?: OnlineAiActionDelayContext;
    emitTrace: OnlineAiActionDelayTraceEmitter;
}): Promise<OnlineAiActionDelayResult> {
    const runtime = getGameAiRuntime(args.gameId);
    const actionVisibility = resolveLocalAiActionVisibility(args.action, runtime);
    const lastVisibleActionAt = args.delayContext?.lastVisibleActionAt ?? null;
    const plannedAt = Date.now();
    const delayPlan = resolveLocalAiActionDelayPlan({
        controller: args.controller,
        actionVisibility,
        now: plannedAt,
        defaultMinimumActionDelayMs: runtime?.defaultMinimumActionDelayMs ?? 0,
        lastVisibleActionAt,
    });

    if (delayPlan.remainingDelayMs <= 0) {
        args.emitTrace('online-ai-delay-skipped', {
            matchId: args.matchId,
            gameId: args.gameId,
            playerId: args.playerId,
            actionKind: args.action.kind,
            commandTypes: args.action.commands.map((command) => command.type),
            ...delayPlan,
        });
        return {
            delayPlan,
            waitedMs: 0,
        };
    }

    args.emitTrace('online-ai-delay-started', {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        actionKind: args.action.kind,
        commandTypes: args.action.commands.map((command) => command.type),
        ...delayPlan,
    });
    const startedAt = Date.now();
    await new Promise<void>((resolve) => {
        setTimeout(resolve, delayPlan.remainingDelayMs);
    });
    const waitedMs = Math.max(0, Date.now() - startedAt);
    args.emitTrace('online-ai-delay-finished', {
        matchId: args.matchId,
        gameId: args.gameId,
        playerId: args.playerId,
        actionKind: args.action.kind,
        commandTypes: args.action.commands.map((command) => command.type),
        ...delayPlan,
        waitedMs,
    });

    return {
        delayPlan,
        waitedMs,
    };
}

export function markOnlineAiVisibleActionCompleted(
    delayContext: OnlineAiActionDelayContext | undefined,
    delayResult: OnlineAiActionDelayResult,
): void {
    if (
        !delayContext
        || delayResult.delayPlan.actionVisibility !== 'visible'
    ) {
        return;
    }

    delayContext.lastVisibleActionAt = Date.now();
}
