import type { MatchState, PlayerId } from '../../../engine/types';
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

export function getSmashUpReactionWindowContext(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowContext | undefined {
    const session = getReactionSessionFromResolution(state);
    if (session?.responseWindowType) {
        return {
            windowType: session.responseWindowType,
            activePlayerId: session.activePlayerId,
            currentPlayerId: session.currentPlayerId,
            sourceBaseIndex: session.sourceBaseIndex,
        };
    }

    return undefined;
}

export function getSmashUpReactionWindowPresentation(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowPresentation | undefined {
    const session = getReactionSessionFromResolution(state);
    const responseWindow = state.sys.responseWindow?.current;

    if (session?.responseWindowType) {
        const responderQueue = getClockwiseOrder(state.core.turnOrder ?? [], session.currentPlayerId);
        const currentResponderIndex = Math.max(0, responderQueue.indexOf(session.activePlayerId));
        const mirroredPassedPlayers = responseWindow?.sourceId === 'smashup_reaction_choose'
            ? (responseWindow.passedPlayers ?? [])
            : [];

        return {
            windowType: session.responseWindowType,
            activePlayerId: session.activePlayerId,
            currentPlayerId: session.currentPlayerId,
            sourceBaseIndex: session.sourceBaseIndex,
            responderQueue,
            currentResponderIndex,
            passedPlayers: mirroredPassedPlayers,
        };
    }

    const fallbackContext = getSmashUpReactionWindowContext(state);
    if (!fallbackContext || !responseWindow?.responderQueue?.length) {
        return undefined;
    }

    return {
        ...fallbackContext,
        responderQueue: responseWindow.responderQueue,
        currentResponderIndex: responseWindow.currentResponderIndex,
        passedPlayers: responseWindow.passedPlayers ?? [],
    };
}
