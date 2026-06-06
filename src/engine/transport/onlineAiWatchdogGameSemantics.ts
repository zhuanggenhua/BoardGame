import type { MatchState } from '../types';
import type { OnlineAiRecoveryEngineConfig } from './onlineAiRecovery';

const EMPTY_ONLINE_AI_PHASE_SET = new Set<string>();
const DEFAULT_HUMAN_TURN_LEGAL_ACTION_PROBE_PHASES = new Set(['defensiveRoll']);

const resolveConfiguredPhaseSet = (
    phases: string[] | undefined,
): Set<string> => {
    if (Array.isArray(phases) && phases.length > 0) {
        return new Set(phases);
    }
    return EMPTY_ONLINE_AI_PHASE_SET;
};

export function resolveOnlineAiWatchdogAdvancePhaseCommandType(args: {
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
} = {}): string {
    const configured = args.engineConfig?.onlineAiRecovery?.advancePhaseCommandType;
    if (typeof configured === 'string' && configured.length > 0) {
        return configured;
    }
    return 'ADVANCE_PHASE';
}

export function resolveOnlineAiWatchdogFallbackAdvancePhaseCommandType(args: {
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
} = {}): string | null {
    if (args.engineConfig?.onlineAiRecovery?.disableFallbackAdvancePhase === true) {
        return null;
    }
    return resolveOnlineAiWatchdogAdvancePhaseCommandType(args);
}

export function isOnlineAiWatchdogPublicPregameLegalActionPhase(args: {
    state: MatchState<unknown>;
    phase?: string | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): boolean {
    const currentPhase = typeof args.phase === 'string'
        ? args.phase
        : typeof args.state.sys?.phase === 'string'
            ? args.state.sys.phase
            : '';
    const core = args.state.core as { hostStarted?: unknown } | undefined;
    if (core?.hostStarted !== false) {
        return false;
    }

    const configuredPhases = resolveConfiguredPhaseSet(
        args.engineConfig?.onlineAiRecovery?.publicPregameLegalActionPhases,
    );
    return configuredPhases.has(currentPhase);
}

export function isOnlineAiWatchdogActiveTurnLegalActionOnlyPhase(args: {
    state: MatchState<unknown>;
    phase?: string | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
}): boolean {
    const currentPhase = typeof args.phase === 'string'
        ? args.phase
        : typeof args.state.sys?.phase === 'string'
            ? args.state.sys.phase
            : '';
    if (!currentPhase) {
        return false;
    }

    const configuredPhases = resolveConfiguredPhaseSet(
        args.engineConfig?.onlineAiRecovery?.activeTurnLegalActionOnlyPhases,
    );
    return configuredPhases.has(currentPhase);
}

export function shouldProbeOnlineAiLegalActionOnlyCandidateForHumanTurn(args: {
    state: MatchState<unknown>;
    currentPlayerId: string;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): boolean {
    const currentPhase = typeof args.state.sys?.phase === 'string' ? args.state.sys.phase : '';
    const core = args.state.core as {
        hostStarted?: unknown;
        pendingAttack?: { defenderId?: unknown };
    } | undefined;

    const isPublicPregameSetup = isOnlineAiWatchdogPublicPregameLegalActionPhase({
        state: args.state,
        phase: currentPhase,
        engineConfig: args.engineConfig,
        gameId: args.gameId,
    });

    // 当真人是当前操作者时，仅允许在公开的 off-turn 阶段或预开局公开 setup 阶段探测 AI legal-only。
    const humanTurnProbePhases = resolveConfiguredPhaseSet(
        args.engineConfig?.onlineAiRecovery?.humanTurnLegalActionProbePhases,
    );
    const isHumanActiveOffTurnRollPhase = DEFAULT_HUMAN_TURN_LEGAL_ACTION_PROBE_PHASES.has(currentPhase)
        || humanTurnProbePhases.has(currentPhase);
    if (!isHumanActiveOffTurnRollPhase && !isPublicPregameSetup) {
        return false;
    }

    const defenderId = currentPhase === 'defensiveRoll' && typeof core?.pendingAttack?.defenderId === 'string'
        ? core.pendingAttack.defenderId
        : null;
    if (defenderId === args.currentPlayerId) {
        return false;
    }

    return true;
}

export function shouldSuppressOnlineAiWatchdogActiveTurnCandidate(args: {
    state: MatchState<unknown>;
    phase: string;
    currentPlayerId: string;
    turnNumber: number | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): boolean {
    const configured = args.engineConfig?.onlineAiRecovery?.shouldSuppressActiveTurnCandidate;
    if (typeof configured === 'function') {
        return configured({
            state: args.state,
            phase: args.phase,
            currentPlayerId: args.currentPlayerId,
            turnNumber: args.turnNumber,
        });
    }
    return false;
}

export function shouldAutoSelectOnlineAiWatchdogFirstTriggerOnlySimpleChoice(args: {
    sourceId?: string | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
    gameId?: string | null;
}): boolean {
    if (typeof args.sourceId !== 'string' || args.sourceId.length === 0) {
        return false;
    }

    const configured = args.engineConfig?.onlineAiRecovery?.autoSelectFirstTriggerOnlySimpleChoiceSourceIds;
    if (Array.isArray(configured) && configured.length > 0) {
        return configured.includes(args.sourceId);
    }
    return false;
}
