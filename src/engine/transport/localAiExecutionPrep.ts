import {
    resolveLocalAiActionDelayPlan,
    type LocalAiActionDelayPlan,
} from '../ai/actionDelay';
import { getGameAiRuntime } from '../ai/registry';
import type { AiResolution } from '../ai/localRunner';
import type { AiSeatController } from '../ai/types';
import { resolveLocalAiActionVisibility } from '../ai/actionVisibility';
import type { MatchState } from '../types';
import type { LocalAiTurnTimeline } from './localAiDiagnostics';

export type LocalAiExecutionPreparation = {
    controller: Exclude<AiSeatController, { type: 'human' }>;
    actionVisibility: 'hidden' | 'visible';
    delayPlan: LocalAiActionDelayPlan;
    commandTypes: string[];
    turnTimeline: LocalAiTurnTimeline | undefined;
    decisionReadyPayload: Record<string, unknown>;
    scheduledPayload: Record<string, unknown>;
};

export function prepareLocalAiExecution(args: {
    gameId: string;
    seed: string;
    resolution: AiResolution;
    seatControllers: Record<string, AiSeatController>;
    decisionResolvedAt: number;
    decisionElapsedMs: number;
    activePhaseElapsedMs: number | null;
    lastVisibleActionAt: number | null;
    state: MatchState<unknown>;
    ensureAiTurnTimeline: (playerId: string, matchState: MatchState<unknown>) => LocalAiTurnTimeline | undefined;
}): LocalAiExecutionPreparation | null {
    const controller = args.seatControllers[args.resolution.playerId];
    if (!controller || controller.type === 'human') {
        return null;
    }

    const runtime = getGameAiRuntime(args.gameId);
    const actionVisibility = resolveLocalAiActionVisibility(args.resolution.action, runtime);
    const delayPlan = resolveLocalAiActionDelayPlan({
        controller,
        actionVisibility,
        now: args.decisionResolvedAt,
        defaultMinimumActionDelayMs: runtime?.defaultMinimumActionDelayMs,
        lastVisibleActionAt: args.lastVisibleActionAt,
    });
    const commandTypes = args.resolution.action.commands.map((command) => command.type);
    const turnTimeline = args.ensureAiTurnTimeline(args.resolution.playerId, args.state);
    if (turnTimeline) {
        turnTimeline.decisionReadyAt = args.decisionResolvedAt;
    }

    return {
        controller,
        actionVisibility,
        delayPlan,
        commandTypes,
        turnTimeline,
        decisionReadyPayload: {
            gameId: args.gameId,
            matchId: `local:${args.gameId}:${args.seed}`,
            playerId: args.resolution.playerId,
            source: args.resolution.source,
            actionKind: args.resolution.action.kind,
            commandTypes,
            decisionElapsedMs: args.decisionElapsedMs,
            turnKey: turnTimeline?.turnKey ?? null,
            turnStartedElapsedMs: turnTimeline
                ? args.decisionResolvedAt - turnTimeline.turnStartedAt
                : null,
            activePhaseElapsedMs: args.activePhaseElapsedMs,
            ...delayPlan,
        },
        scheduledPayload: {
            gameId: args.gameId,
            matchId: `local:${args.gameId}:${args.seed}`,
            playerId: args.resolution.playerId,
            controllerType: controller.type,
            source: args.resolution.source,
            actionKind: args.resolution.action.kind,
            commandTypes,
            decisionElapsedMs: args.decisionElapsedMs,
            activePhaseElapsedMs: args.activePhaseElapsedMs,
            ...delayPlan,
        },
    };
}
