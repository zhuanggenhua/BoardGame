import type { MatchState, PlayerId } from '../../../engine/types';
import type { SmashUpCore, SmashUpReactionSession } from './types';

type ReactionSysState = MatchState<SmashUpCore>['sys'] & {
    smashupReactionSession?: SmashUpReactionSession;
};

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
    const session = (state.sys as ReactionSysState).smashupReactionSession;
    if (session?.responseWindowType) {
        return {
            windowType: session.responseWindowType,
            activePlayerId: session.activePlayerId,
            currentPlayerId: session.currentPlayerId,
            sourceBaseIndex: session.sourceBaseIndex,
        };
    }

    const responseWindow = state.sys.responseWindow?.current;
    if (
        responseWindow
        && (responseWindow.windowType === 'meFirst' || responseWindow.windowType === 'afterScoring')
        && responseWindow.responderQueue?.length
    ) {
        const activePlayerId = responseWindow.responderQueue[responseWindow.currentResponderIndex]
            ?? responseWindow.responderQueue[0];
        const currentPlayerId = responseWindow.responderQueue[0] ?? activePlayerId;
        if (!activePlayerId || !currentPlayerId) {
            return undefined;
        }
        return {
            windowType: responseWindow.windowType,
            activePlayerId,
            currentPlayerId,
        };
    }

    return undefined;
}

export function getSmashUpReactionWindowPresentation(
    state: MatchState<SmashUpCore>,
): SmashUpReactionWindowPresentation | undefined {
    const session = (state.sys as ReactionSysState).smashupReactionSession;
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

export function hasBlockingLegacyResponseWindow(state: MatchState<SmashUpCore>): boolean {
    const responseWindow = state.sys.responseWindow?.current;
    return !!responseWindow && responseWindow.sourceId !== 'smashup_reaction_choose';
}
