import type {
    MatchState,
    ResolutionBlocker,
    ResolutionFrame,
    ResolutionOwnerRef,
    ResolutionOrdering,
    ResolutionState,
    ResolutionStatus,
} from '../types';

function cloneResolutionState(resolution: ResolutionState | undefined): ResolutionState {
    return {
        frames: resolution?.frames ? [...resolution.frames] : [],
        activeFrameId: resolution?.activeFrameId,
    };
}

function writeResolutionState<TCore>(
    state: MatchState<TCore>,
    resolution: ResolutionState | undefined,
): MatchState<TCore> {
    return {
        ...state,
        sys: {
            ...state.sys,
            resolution,
        },
    };
}

function normalizeOrdering(ordering: ResolutionOrdering | undefined): ResolutionOrdering {
    return ordering ?? 'explicit';
}

function normalizeStatus(status: ResolutionStatus | undefined): ResolutionStatus {
    return status ?? 'running';
}

function ensureFrameDefaults(frame: ResolutionFrame): ResolutionFrame {
    return {
        ...frame,
        ownerToken: frame.ownerToken ?? frame.id,
        ordering: normalizeOrdering(frame.ordering),
        status: normalizeStatus(frame.status),
    };
}

function findFrameIndex(frames: ResolutionFrame[], frameId?: string): number {
    if (!frameId) return -1;
    return frames.findIndex((frame) => frame.id === frameId);
}

function resolveNextActiveFrameId(
    frames: ResolutionFrame[],
    preferredFrameId?: string,
): string | undefined {
    if (preferredFrameId && frames.some((frame) => frame.id === preferredFrameId)) {
        return preferredFrameId;
    }
    for (let index = frames.length - 1; index >= 0; index -= 1) {
        if (frames[index].status !== 'completed') {
            return frames[index].id;
        }
    }
    return undefined;
}

function clearBlocker(frame: ResolutionFrame): ResolutionFrame {
    if (frame.status !== 'blocked' && !frame.blockedBy) {
        return frame;
    }
    return {
        ...frame,
        status: 'running',
        blockedBy: undefined,
    };
}

function isSameOwner(
    left: ResolutionOwnerRef | undefined,
    right: ResolutionOwnerRef | undefined,
): boolean {
    if (!left && !right) return true;
    if (!left || !right) return false;
    return left.system === right.system
        && left.id === right.id
        && left.kind === right.kind
        && left.gameId === right.gameId
        && left.namespace === right.namespace
        && left.resolutionFrameId === right.resolutionFrameId
        && left.blocksProgress === right.blocksProgress;
}

function writeFrames<TCore>(
    state: MatchState<TCore>,
    frames: ResolutionFrame[],
    activeFrameId?: string,
): MatchState<TCore> {
    if (frames.length === 0) {
        return writeResolutionState(state, undefined);
    }
    return writeResolutionState(state, {
        frames,
        activeFrameId: resolveNextActiveFrameId(frames, activeFrameId),
    });
}

function updateFrameAtIndex(
    frames: ResolutionFrame[],
    frameIndex: number,
    updater: (frame: ResolutionFrame) => ResolutionFrame,
): ResolutionFrame[] {
    const nextFrames = [...frames];
    nextFrames[frameIndex] = ensureFrameDefaults(updater(nextFrames[frameIndex]));
    return nextFrames;
}

function syncResolutionBlocker<TCore>(
    state: MatchState<TCore>,
    blockerType: ResolutionBlocker['type'],
    current: { frameId?: string; blockerId?: string; reason?: string; owner?: ResolutionOwnerRef } | undefined,
): MatchState<TCore> {
    const resolution = state.sys.resolution;
    if (!resolution?.frames?.length) return state;

    let changed = false;
    const nextFrames = resolution.frames.map((frame) => {
        const shouldAttach = !!current?.frameId && frame.id === current.frameId;
        if (shouldAttach) {
            const nextBlocker: ResolutionBlocker = {
                type: blockerType,
                id: current?.blockerId,
                reason: current?.reason,
            };
            const alreadySame = frame.status === 'blocked'
                && frame.blockedBy?.type === nextBlocker.type
                && frame.blockedBy?.id === nextBlocker.id
                && frame.blockedBy?.reason === nextBlocker.reason
                && isSameOwner(frame.foregroundOwner, current?.owner);
            if (alreadySame) return frame;
            changed = true;
            return {
                ...frame,
                status: 'blocked' as const,
                blockedBy: nextBlocker,
                foregroundOwner: current?.owner,
            };
        }

        if (frame.blockedBy?.type !== blockerType) {
            return frame;
        }

        changed = true;
        const cleared = clearBlocker(frame);
        return {
            ...cleared,
            foregroundOwner: frame.foregroundOwner?.system === 'modal'
                ? frame.foregroundOwner
                : undefined,
        };
    });

    if (!changed) return state;
    return writeFrames(state, nextFrames, current?.frameId ?? resolution.activeFrameId);
}

export function getResolutionState<TCore>(state: MatchState<TCore>): ResolutionState | undefined {
    return state.sys.resolution;
}

export function getResolutionFrames<TCore>(state: MatchState<TCore>): ResolutionFrame[] {
    return state.sys.resolution?.frames ?? [];
}

export function getResolutionFrameById<TCore>(
    state: MatchState<TCore>,
    frameId?: string,
): ResolutionFrame | undefined {
    if (!frameId) return undefined;
    return getResolutionFrames(state).find((frame) => frame.id === frameId);
}

export function getActiveResolutionFrame<TCore>(state: MatchState<TCore>): ResolutionFrame | undefined {
    return getResolutionFrameById(state, getResolutionState(state)?.activeFrameId);
}

export function getResolutionOwnerToken<TCore>(
    state: MatchState<TCore>,
    frameId?: string,
): string | undefined {
    const frame = frameId ? getResolutionFrameById(state, frameId) : getActiveResolutionFrame(state);
    return frame?.ownerToken ?? frame?.id;
}

export function getActiveResolutionOwner<TCore>(
    state: MatchState<TCore>,
): ResolutionOwnerRef | undefined {
    return getActiveResolutionFrame(state)?.foregroundOwner;
}

export function upsertActiveResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frame: ResolutionFrame,
): MatchState<TCore> {
    return upsertResolutionFrame(state, frame, { setActive: true });
}

export function upsertResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frame: ResolutionFrame,
    options?: { setActive?: boolean },
): MatchState<TCore> {
    const normalized = ensureFrameDefaults(frame);
    const resolution = cloneResolutionState(state.sys.resolution);
    const frameIndex = findFrameIndex(resolution.frames, normalized.id);
    const nextFrames = frameIndex >= 0
        ? updateFrameAtIndex(resolution.frames, frameIndex, () => normalized)
        : [...resolution.frames, normalized];
    const nextActiveFrameId = options?.setActive
        ? normalized.id
        : resolution.activeFrameId ?? normalized.id;
    return writeFrames(state, nextFrames, nextActiveFrameId);
}

export function pushResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frame: ResolutionFrame,
    options?: {
        parentFrameId?: string;
        suspendParent?: boolean;
    },
): MatchState<TCore> {
    const resolution = cloneResolutionState(state.sys.resolution);
    const activeFrame = getActiveResolutionFrame(state);
    const parentFrameId = frame.parentFrameId ?? options?.parentFrameId ?? activeFrame?.id;
    let nextFrames = resolution.frames;

    if (options?.suspendParent !== false && activeFrame && activeFrame.id !== frame.id) {
        const parentIndex = findFrameIndex(nextFrames, activeFrame.id);
        if (parentIndex >= 0) {
            nextFrames = updateFrameAtIndex(nextFrames, parentIndex, (parent) => ({
                ...parent,
                status: 'suspended',
                suspendedByFrameId: frame.id,
                blockedBy: {
                    type: 'child-frame',
                    id: frame.id,
                    reason: frame.kind,
                },
            }));
        }
    }

    const normalized = ensureFrameDefaults({
        ...frame,
        parentFrameId,
        status: frame.status === 'completed' ? 'running' : normalizeStatus(frame.status),
    });
    const frameIndex = findFrameIndex(nextFrames, normalized.id);
    nextFrames = frameIndex >= 0
        ? updateFrameAtIndex(nextFrames, frameIndex, () => normalized)
        : [...nextFrames, normalized];

    return writeFrames(state, nextFrames, normalized.id);
}

export function updateResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    updater: (frame: ResolutionFrame) => ResolutionFrame,
): MatchState<TCore> {
    const resolution = state.sys.resolution;
    if (!resolution?.frames?.length) return state;
    const frameIndex = findFrameIndex(resolution.frames, frameId);
    if (frameIndex < 0) return state;
    const nextFrames = updateFrameAtIndex(resolution.frames, frameIndex, updater);
    return writeFrames(state, nextFrames, resolution.activeFrameId);
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

export function setResolutionFrameDeferredPayload<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    payload: Pick<ResolutionFrame, 'deferredEvents' | 'deferredActions'>,
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => ({
        ...frame,
        deferredEvents: payload.deferredEvents ?? frame.deferredEvents,
        deferredActions: payload.deferredActions ?? frame.deferredActions,
    }));
}

export function appendResolutionFrameDeferredPayload<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    payload: Pick<ResolutionFrame, 'deferredEvents' | 'deferredActions'>,
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => ({
        ...frame,
        deferredEvents: payload.deferredEvents?.length
            ? [...(frame.deferredEvents ?? []), ...payload.deferredEvents]
            : frame.deferredEvents,
        deferredActions: payload.deferredActions?.length
            ? [...(frame.deferredActions ?? []), ...payload.deferredActions]
            : frame.deferredActions,
    }));
}

export function consumeResolutionFrameDeferredPayload<TCore>(
    state: MatchState<TCore>,
    frameId: string,
): {
    state: MatchState<TCore>;
    deferredEvents: NonNullable<ResolutionFrame['deferredEvents']>;
    deferredActions: NonNullable<ResolutionFrame['deferredActions']>;
} {
    const frame = getResolutionFrameById(state, frameId);
    if (!frame) {
        return {
            state,
            deferredEvents: [],
            deferredActions: [],
        };
    }

    return {
        state: updateResolutionFrame(state, frameId, (current) => ({
            ...current,
            deferredEvents: undefined,
            deferredActions: undefined,
        })),
        deferredEvents: frame.deferredEvents ?? [],
        deferredActions: frame.deferredActions ?? [],
    };
}

export function setResolutionFrameOwner<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    owner: ResolutionOwnerRef | undefined,
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => {
        if (isSameOwner(frame.foregroundOwner, owner)) {
            return frame;
        }
        return {
            ...frame,
            foregroundOwner: owner,
        };
    });
}

export function setActiveResolutionOwner<TCore>(
    state: MatchState<TCore>,
    owner: ResolutionOwnerRef | undefined,
): MatchState<TCore> {
    const frameId = getActiveResolutionFrame(state)?.id;
    if (!frameId) return state;
    return setResolutionFrameOwner(state, frameId, owner);
}

export function completeResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frameId?: string,
): MatchState<TCore> {
    const resolution = state.sys.resolution;
    if (!resolution?.frames?.length) return state;
    const targetId = frameId ?? resolution.activeFrameId;
    if (!targetId) return state;

    const targetFrame = getResolutionFrameById(state, targetId);
    if (!targetFrame) return state;

    let nextFrames = resolution.frames.filter((frame) => frame.id !== targetId);
    if (targetFrame.parentFrameId) {
        const parentIndex = findFrameIndex(nextFrames, targetFrame.parentFrameId);
        if (parentIndex >= 0) {
            nextFrames = updateFrameAtIndex(nextFrames, parentIndex, (parent) => {
                const shouldResume = parent.suspendedByFrameId === targetId;
                if (!shouldResume) return parent;
                return {
                    ...parent,
                    status: 'running',
                    blockedBy: undefined,
                    suspendedByFrameId: undefined,
                };
            });
        }
    }

    return writeFrames(state, nextFrames, targetFrame.parentFrameId ?? resolution.activeFrameId);
}

export function clearResolutionFrame<TCore>(
    state: MatchState<TCore>,
    frameId?: string,
): MatchState<TCore> {
    return completeResolutionFrame(state, frameId);
}

export function setResolutionFrameBlock<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    blocker: ResolutionBlocker,
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => {
        const alreadySame = frame.status === 'blocked'
            && frame.blockedBy?.type === blocker.type
            && frame.blockedBy?.id === blocker.id
            && frame.blockedBy?.reason === blocker.reason;
        if (alreadySame) return frame;
        return {
            ...frame,
            status: 'blocked',
            blockedBy: blocker,
        };
    });
}

export function setActiveResolutionBlock<TCore>(
    state: MatchState<TCore>,
    blocker: ResolutionBlocker,
): MatchState<TCore> {
    const frameId = getActiveResolutionFrame(state)?.id;
    if (!frameId) return state;
    return setResolutionFrameBlock(state, frameId, blocker);
}

export function clearResolutionFrameBlock<TCore>(
    state: MatchState<TCore>,
    frameId: string,
    blockerType?: ResolutionBlocker['type'],
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => {
        if (blockerType && frame.blockedBy?.type !== blockerType) {
            return frame;
        }
        return clearBlocker(frame);
    });
}

export function clearActiveResolutionBlock<TCore>(
    state: MatchState<TCore>,
    blockerType?: ResolutionBlocker['type'],
): MatchState<TCore> {
    const frameId = getActiveResolutionFrame(state)?.id;
    if (!frameId) return state;
    return clearResolutionFrameBlock(state, frameId, blockerType);
}

export function syncActiveResolutionWithInteraction<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return state;

    const currentInteraction = state.sys.interaction?.current;
    if (!currentInteraction) {
        return syncResolutionBlocker(state, 'interaction', undefined);
    }

    return syncResolutionBlocker(state, 'interaction', {
        frameId: currentInteraction.resolutionFrameId ?? frame.id,
        blockerId: currentInteraction.id,
        reason: currentInteraction.kind,
        owner: {
            system: 'interaction',
            id: currentInteraction.id,
            kind: currentInteraction.kind,
            gameId: frame.ownerGame,
            resolutionFrameId: currentInteraction.resolutionFrameId ?? frame.id,
            blocksProgress: true,
        },
    });
}

export function syncActiveResolutionWithResponseWindow<TCore>(
    state: MatchState<TCore>,
): MatchState<TCore> {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return state;

    const currentWindow = state.sys.responseWindow?.current;
    if (!currentWindow) {
        return syncResolutionBlocker(state, 'response-window', undefined);
    }

    return syncResolutionBlocker(state, 'response-window', {
        frameId: currentWindow.resolutionFrameId ?? frame.id,
        blockerId: currentWindow.id,
        reason: currentWindow.windowType,
        owner: {
            system: 'response-window',
            id: currentWindow.id,
            kind: currentWindow.windowType,
            gameId: frame.ownerGame,
            resolutionFrameId: currentWindow.resolutionFrameId ?? frame.id,
            blocksProgress: true,
        },
    });
}

export function hasBlockingResolutionFrame<TCore>(
    state: MatchState<TCore>,
    phase?: string,
): boolean {
    const frame = getActiveResolutionFrame(state);
    if (!frame) return false;
    if (frame.phaseGate !== 'block-advance-when-blocked') return false;
    if (frame.status !== 'blocked') return false;
    // Active blocking frames must gate phase advance even if sys.phase has drifted.
    // Otherwise a suspended score/reaction chain can leak into a later phase and be skipped.
    void phase;
    return true;
}
