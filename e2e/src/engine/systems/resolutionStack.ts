import type { MatchState, ResolutionBlocker, ResolutionFrame, ResolutionState } from '../types';

function cloneResolutionState(resolution: ResolutionState | undefined): ResolutionState {
    return {
        frames: resolution?.frames ? [...resolution.frames] : [],
        activeFrameId: resolution?.activeFrameId,
    };
}

export function getResolutionState<TCore>(state: MatchState<TCore>): ResolutionState | undefined {
    return state.sys.resolution;
}

export function getActiveResolutionFrame<TCore>(state: MatchState<TCore>): ResolutionFrame | undefined {
    const resolution = getResolutionState(state);
    if (!resolution?.activeFrameId) return undefined;
    return resolution.frames.find((frame) => frame.id === resolution.activeFrameId);
}

export function upsertActiveResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frame: ResolutionFrame,
): MatchState<TCore> {
    const resolution = cloneResolutionState(state.sys.resolution);
    const nextFrames = resolution.frames.filter((candidate) => candidate.id !== frame.id);
    nextFrames.push(frame);
    return {
        ...state,
        sys: {
            ...state.sys,
            resolution: {
                frames: nextFrames,
                activeFrameId: frame.id,
            },
        },
    };
}

export function updateActiveResolutionFrame<TCore>(
    state: MatchState<TCore>,
    updater: (frame: ResolutionFrame | undefined) => ResolutionFrame | undefined,
): MatchState<TCore> {
    const current = getActiveResolutionFrame(state);
    const updated = updater(current);
    if (!updated) {
        return clearResolutionFrame(state, current?.id);
    }
    return upsertActiveResolutionFrame(state, updated);
}

export function clearResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frameId?: string,
): MatchState<TCore> {
    const resolution = state.sys.resolution;
    if (!resolution) return state;
    const targetId = frameId ?? resolution.activeFrameId;
    if (!targetId) return state;

    const nextFrames = resolution.frames.filter((frame) => frame.id !== targetId);
    const nextActiveFrameId = resolution.activeFrameId === targetId
        ? nextFrames[nextFrames.length - 1]?.id
        : resolution.activeFrameId;

    return {
        ...state,
        sys: {
            ...state.sys,
            resolution: nextFrames.length > 0
                ? {
                    frames: nextFrames,
                    activeFrameId: nextActiveFrameId,
                }
                : undefined,
        },
    };
}

export function setActiveResolutionBlock<TCore>(
    state: MatchState<TCore>,
    blocker: ResolutionBlocker,
): MatchState<TCore> {
    return updateActiveResolutionFrame(state, (frame) => {
        if (!frame) return frame;
        if (
            frame.status === 'blocked'
            && frame.blockedBy?.type === blocker.type
            && frame.blockedBy?.id === blocker.id
            && frame.blockedBy?.reason === blocker.reason
        ) {
            return frame;
        }
        return {
            ...frame,
            status: 'blocked',
            blockedBy: blocker,
        };
    });
}

export function clearActiveResolutionBlock<TCore>(
    state: MatchState<TCore>,
    blockerType?: ResolutionBlocker['type'],
): MatchState<TCore> {
    return updateActiveResolutionFrame(state, (frame) => {
        if (!frame) return frame;
        if (blockerType && frame.blockedBy?.type !== blockerType) {
            return frame;
        }
        if (frame.status !== 'blocked' && !frame.blockedBy) {
            return frame;
        }
        return {
            ...frame,
            status: 'running',
            blockedBy: undefined,
        };
    });
}

export function syncActiveResolutionWithInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return state;
    if (state.sys.responseWindow?.current) {
        return state;
    }

    const currentInteraction = state.sys.interaction?.current;
    if (currentInteraction) {
        return setActiveResolutionBlock(state, {
            type: 'interaction',
            id: currentInteraction.id,
            reason: currentInteraction.kind,
        });
    }

    if (frame.blockedBy?.type === 'interaction') {
        return clearActiveResolutionBlock(state, 'interaction');
    }

    return state;
}

export function syncActiveResolutionWithResponseWindow<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return state;

    const currentWindow = state.sys.responseWindow?.current;
    if (currentWindow) {
        return setActiveResolutionBlock(state, {
            type: 'response-window',
            id: currentWindow.id,
            reason: currentWindow.windowType,
        });
    }

    if (frame.blockedBy?.type === 'response-window') {
        return clearActiveResolutionBlock(state, 'response-window');
    }

    return state;
}

export function hasBlockingResolutionFrame<TCore>(
    state: MatchState<TCore>,
    phase?: string,
): boolean {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return false;
    if (frame.phaseGate !== 'block-advance-when-blocked') return false;
    if (frame.status !== 'blocked') return false;
    if (phase && frame.phase && frame.phase !== phase) return false;
    return true;
}
