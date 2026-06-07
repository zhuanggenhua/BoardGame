import type { MatchState, PlayerId } from '../../../engine/types';
import { getCurrentScoringBaseIndex } from './scoringSession';
import type { SmashUpCore, SmashUpReactionSession } from './types';

function getReactionSessionFromResolution(
    state: MatchState<SmashUpCore>,
): SmashUpReactionSession | undefined {
    const resolutionFrames = state.sys.resolution?.frames ?? [];
    const frameIds = [
        state.sys.responseWindow?.current?.resolutionFrameId,
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

function getNormalizedLegacyReactionWindow(
    state: MatchState<SmashUpCore>,
    legacyWindow: {
        windowType?: 'meFirst' | 'afterScoring';
        responderQueue?: PlayerId[];
        currentResponderIndex?: number;
        sourceBaseIndex?: number;
        passedPlayers?: PlayerId[];
    },
): SmashUpReactionWindowPresentation | undefined {
    const turnOrder = state.core.turnOrder ?? [];
    if (turnOrder.length === 0) return undefined;

    const filteredQueue = (legacyWindow.responderQueue ?? []).filter(playerId => turnOrder.includes(playerId));
    const liveCurrentPlayerId = state.core.turnOrder[state.core.currentPlayerIndex];
    const currentPlayerId = liveCurrentPlayerId && turnOrder.includes(liveCurrentPlayerId)
        ? liveCurrentPlayerId
        : turnOrder[0];
    if (!currentPlayerId) return undefined;
    const activePlayerId = currentPlayerId;

    const responderQueue = getClockwiseOrder(turnOrder, currentPlayerId);
    return {
        windowType: legacyWindow.windowType!,
        activePlayerId,
        currentPlayerId,
        sourceBaseIndex: typeof legacyWindow.sourceBaseIndex === 'number'
            ? legacyWindow.sourceBaseIndex
            : undefined,
        responderQueue,
        currentResponderIndex: Math.max(0, responderQueue.indexOf(activePlayerId)),
        passedPlayers: (legacyWindow.passedPlayers ?? []).filter(playerId => responderQueue.includes(playerId)),
    };
}

export function getSmashUpReactionWindowContext(
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

    const legacyWindow = state.sys.responseWindow?.current;
    const legacyWindowType = legacyWindow?.windowType;
    if (
        (legacyWindowType === 'meFirst' || legacyWindowType === 'afterScoring')
        && legacyWindow.responderQueue?.length
    ) {
        const normalizedLegacyWindow = getNormalizedLegacyReactionWindow(state, legacyWindow);
        if (!normalizedLegacyWindow) return undefined;
        return {
            windowType: normalizedLegacyWindow.windowType,
            activePlayerId: normalizedLegacyWindow.activePlayerId,
            currentPlayerId: normalizedLegacyWindow.currentPlayerId,
            sourceBaseIndex: normalizedLegacyWindow.sourceBaseIndex,
        };
    }

    return undefined;
}

export function getSmashUpReactionWindowPresentation(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowPresentation | undefined {
    const session = getReactionSessionFromResolution(state);
    const responseWindow = state.sys.responseWindow?.current;
    const interactionSourceId = (
        state.sys.interaction?.current?.data as { sourceId?: string } | undefined
    )?.sourceId;

    if (session?.responseWindowType) {
        if (!responseWindow && interactionSourceId !== 'smashup_reaction_choose') {
            return undefined;
        }
        const normalizedSession = normalizeReactionSessionPlayers(state, session);
        const responderQueue = getClockwiseOrder(state.core.turnOrder ?? [], normalizedSession.currentPlayerId);
        const currentResponderIndex = Math.max(0, responderQueue.indexOf(normalizedSession.activePlayerId));
        const mirroredPassedPlayers = responseWindow?.sourceId === 'smashup_reaction_choose'
            ? (responseWindow.passedPlayers ?? [])
            : [];
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
            passedPlayers: mirroredPassedPlayers,
        };
    }

    const fallbackContext = getSmashUpReactionWindowContext(state);
    if (!fallbackContext || !responseWindow?.responderQueue?.length) {
        return undefined;
    }

    const normalizedLegacyWindow = getNormalizedLegacyReactionWindow(state, responseWindow as any);
    if (normalizedLegacyWindow) {
        return normalizedLegacyWindow;
    }

    return {
        ...fallbackContext,
        responderQueue: responseWindow.responderQueue,
        currentResponderIndex: responseWindow.currentResponderIndex,
        passedPlayers: responseWindow.passedPlayers ?? [],
    };
}

export function hasBlockingLegacyResponseWindow(
    state: MatchState<SmashUpCore>,
): boolean {
    const responseWindow = state.sys.responseWindow?.current;
    if (!responseWindow) {
        return false;
    }

    if (!getReactionSessionFromResolution(state)) {
        return false;
    }

    // 新响应链统一镜像为 smashup_reaction_choose；这里仅拦截仍未收口的旧窗口状态。
    if (responseWindow.sourceId === 'smashup_reaction_choose') {
        return false;
    }

    const interactionSourceId = (
        state.sys.interaction?.current?.data as { sourceId?: string } | undefined
    )?.sourceId;
    return interactionSourceId !== 'smashup_reaction_choose';
}

