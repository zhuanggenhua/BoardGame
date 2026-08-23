import type { MatchState } from '../types';

export type LocalAiCommandEffect = {
    hasStateDelta: boolean;
    markerProgressed: boolean;
    rejected?: boolean;
    failureReason?: string;
};

export type LocalAiCommandStateSnapshot = {
    handCount: number | null;
    cp: number | null;
    phase: string | null;
    eventStreamNextId: number | null;
    marker: string;
};

function readPlayerCp(state: MatchState<unknown>, playerId: string): number | null {
    const player = (state.core as {
        players?: Record<string, { resources?: Record<string, unknown>; hand?: unknown }>;
    } | undefined)?.players?.[playerId];
    const resources = player?.resources;
    if (!resources || typeof resources !== 'object') {
        return null;
    }
    const cp = resources.cp;
    if (typeof cp === 'number') {
        return cp;
    }
    const uppercaseCp = resources.CP;
    return typeof uppercaseCp === 'number' ? uppercaseCp : null;
}

export function buildLocalAiCommandStateSnapshot(args: {
    state: MatchState<unknown>;
    playerId: string;
    marker: string;
}): LocalAiCommandStateSnapshot {
    const { state, playerId, marker } = args;
    const player = (state.core as {
        players?: Record<string, { hand?: unknown }>;
    } | undefined)?.players?.[playerId];
    return {
        handCount: Array.isArray(player?.hand) ? player.hand.length : null,
        cp: readPlayerCp(state, playerId),
        phase: typeof state.sys?.phase === 'string' ? state.sys.phase : null,
        eventStreamNextId: typeof state.sys?.eventStream?.nextId === 'number'
            ? state.sys.eventStream.nextId
            : null,
        marker,
    };
}

export function resolveLocalAiCommandEffect(args: {
    before: LocalAiCommandStateSnapshot;
    after: LocalAiCommandStateSnapshot;
    override?: LocalAiCommandEffect;
}): LocalAiCommandEffect {
    const markerProgressed = args.override?.markerProgressed ?? (args.after.marker !== args.before.marker);
    const hasStateDelta = args.override?.hasStateDelta ?? (
        markerProgressed
        || args.before.handCount !== args.after.handCount
        || args.before.cp !== args.after.cp
        || args.before.phase !== args.after.phase
        || args.before.eventStreamNextId !== args.after.eventStreamNextId
    );
    return {
        hasStateDelta,
        markerProgressed,
        ...(args.override?.rejected ? { rejected: true } : {}),
        ...(args.override?.failureReason ? { failureReason: args.override.failureReason } : {}),
    };
}

export function buildLocalAiCommandAppliedPayload(args: {
    gameId: string;
    seed: string;
    commandType: string;
    playerId: string;
    before: LocalAiCommandStateSnapshot;
    after: LocalAiCommandStateSnapshot;
    effect: LocalAiCommandEffect;
}): Record<string, unknown> {
    const { gameId, seed, commandType, playerId, before, after, effect } = args;
    return {
        gameId,
        matchId: `local:${gameId}:${seed}`,
        commandType,
        playerId,
        progressed: effect.markerProgressed,
        hasStateDelta: effect.hasStateDelta,
        rejected: effect.rejected === true,
        failureReason: effect.failureReason ?? null,
        phaseBefore: before.phase,
        phaseAfter: after.phase,
        handCountBefore: before.handCount,
        handCountAfter: after.handCount,
        cpBefore: before.cp,
        cpAfter: after.cp,
        markerBefore: before.marker,
        markerAfter: after.marker,
    };
}

export function buildLocalAiCommandProgressPayload(args: {
    gameId: string;
    seed: string;
    playerId: string;
    source: string;
    actionKind: string;
    commandType: string;
    commandIndex: number;
    commandTotal: number;
    before: LocalAiCommandStateSnapshot;
    after: LocalAiCommandStateSnapshot;
    effect: LocalAiCommandEffect;
}): Record<string, unknown> {
    const {
        gameId,
        seed,
        playerId,
        source,
        actionKind,
        commandType,
        commandIndex,
        commandTotal,
        before,
        after,
        effect,
    } = args;
    return {
        gameId,
        matchId: `local:${gameId}:${seed}`,
        playerId,
        source,
        actionKind,
        commandType,
        commandIndex,
        commandTotal,
        progressed: effect.markerProgressed,
        hasStateDelta: effect.hasStateDelta,
        rejected: effect.rejected === true,
        failureReason: effect.failureReason ?? null,
        handCountBefore: before.handCount,
        handCountAfter: after.handCount,
        cpBefore: before.cp,
        cpAfter: after.cp,
        phaseBefore: before.phase,
        phaseAfter: after.phase,
        eventStreamNextIdBefore: before.eventStreamNextId,
        eventStreamNextIdAfter: after.eventStreamNextId,
        markerBefore: before.marker,
        markerAfter: after.marker,
    };
}
