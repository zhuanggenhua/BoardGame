import type { MatchState, PlayerId } from '../../../engine/types';
import { getCurrentScoringBaseIndex } from './scoringSession';
import { hasSmashUpResponderDrivenReactionOptions } from './reactionSession';
import type { SmashUpCore, SmashUpReactionSession } from './types';

function getReactionSessionFromResolution(
    state: MatchState<SmashUpCore>,
): SmashUpReactionSession | undefined {
    const resolutionFrames = state.sys.resolution?.frames ?? [];
    const frameIds = [
        state.sys.resolution?.activeFrameId,
        ...resolutionFrames.map((frame) => frame.id).reverse(),
    ].filter((frameId): frameId is string => !!frameId);

    for (const frameId of frameIds) {
        const frame = resolutionFrames.find((candidate) => candidate.id === frameId);
        const session = frame?.metadata?.smashupReactionSession as SmashUpReactionSession | undefined;
        if (session) {
            return {
                ...session,
                phase: (frame?.step as SmashUpReactionSession['phase'] | undefined) ?? session.phase,
            };
        }
    }

    return undefined;
}

export interface SmashUpReactionWindowContext {
    windowType: 'meFirst' | 'afterScoring';
    activePlayerId: PlayerId;
    currentPlayerId: PlayerId;
    sourceBaseIndex?: number;
}

export interface SmashUpReactionWindowPresentation extends SmashUpReactionWindowContext {
    responderQueue: PlayerId[];
    currentResponderIndex: number;
    passedPlayers: PlayerId[];
    showsPassWindow: boolean;
}

function getClockwiseOrder(turnOrder: PlayerId[], startingPlayerId: PlayerId): PlayerId[] {
    const idx = turnOrder.indexOf(startingPlayerId);
    if (idx < 0) return [...turnOrder];
    return [...turnOrder.slice(idx), ...turnOrder.slice(0, idx)];
}

function getValidReactionPlayerId(
    turnOrder: PlayerId[],
    preferredPlayerId: PlayerId | undefined,
    fallbackPlayerId: PlayerId | undefined,
): PlayerId | undefined {
    if (preferredPlayerId && turnOrder.includes(preferredPlayerId)) return preferredPlayerId;
    if (fallbackPlayerId && turnOrder.includes(fallbackPlayerId)) return fallbackPlayerId;
    return turnOrder[0];
}

function normalizeReactionSessionPlayers(
    state: MatchState<SmashUpCore>,
    session: SmashUpReactionSession,
): SmashUpReactionSession {
    const turnOrder = state.core.turnOrder ?? [];
    if (turnOrder.length === 0) return session;

    const liveCurrentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    const currentPlayerId = getValidReactionPlayerId(
        turnOrder,
        session.currentPlayerId,
        liveCurrentPlayerId,
    );
    const activePlayerId = getValidReactionPlayerId(
        turnOrder,
        session.activePlayerId,
        currentPlayerId,
    );

    if (currentPlayerId === session.currentPlayerId && activePlayerId === session.activePlayerId) {
        return session;
    }

    return {
        ...session,
        currentPlayerId: currentPlayerId ?? session.currentPlayerId,
        activePlayerId: activePlayerId ?? session.activePlayerId,
    };
}

export function getSmashUpReactionWindowContext(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowContext | undefined {
    return getLiveSmashUpReactionWindowContext(state);
}

export function getLiveSmashUpReactionWindowContext(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowContext | undefined {
    const session = getReactionSessionFromResolution(state);
    if (session?.responseWindowType) {
        const normalizedSession = normalizeReactionSessionPlayers(state, session);
        const sourceBaseIndex = session.responseWindowType === 'afterScoring'
            ? getCurrentScoringBaseIndex(state)
            : session.sourceBaseIndex;
        return {
            windowType: normalizedSession.responseWindowType,
            activePlayerId: normalizedSession.activePlayerId,
            currentPlayerId: normalizedSession.currentPlayerId,
            sourceBaseIndex,
        };
    }

    return undefined;
}

export function getSmashUpReactionWindowPresentation(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowPresentation | undefined {
    const session = getReactionSessionFromResolution(state);

    if (session?.responseWindowType) {
        const normalizedSession = normalizeReactionSessionPlayers(state, session);
        const responderQueue = getClockwiseOrder(state.core.turnOrder ?? [], normalizedSession.currentPlayerId);
        const currentResponderIndex = Math.max(0, responderQueue.indexOf(normalizedSession.activePlayerId));
        const sessionPassedPlayers = (normalizedSession.passedPlayerIds ?? [])
            .filter(playerId => responderQueue.includes(playerId));
        const sourceBaseIndex = normalizedSession.responseWindowType === 'afterScoring'
            ? getCurrentScoringBaseIndex(state)
            : normalizedSession.sourceBaseIndex;

        return {
            windowType: normalizedSession.responseWindowType,
            activePlayerId: normalizedSession.activePlayerId,
            currentPlayerId: normalizedSession.currentPlayerId,
            sourceBaseIndex,
            responderQueue,
            currentResponderIndex,
            passedPlayers: sessionPassedPlayers,
            showsPassWindow: hasSmashUpResponderDrivenReactionOptions(
                state,
                normalizedSession,
                state.core.turnNumber ?? 0,
            ),
        };
    }

    return undefined;
}

