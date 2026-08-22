/**
 * Resolution frame driver.
 *
 * This system only drains deferred domain events that a frame already owns.
 * It does not execute arbitrary deferred actions, discover opportunities, or
 * decide game-specific completion rules.
 */

import type {
    GameEvent,
    MatchState,
    ResolutionFrame,
} from '../types';
import {
    completeResolutionFrame,
    getActiveResolutionFrame,
    getResolutionFrameById,
    updateResolutionFrame,
} from './resolutionStack';
import type { EngineSystem, HookResult } from './types';
import { SYSTEM_IDS } from './types';

export interface ResolutionFrameSystemConfig<TCore = unknown> {
    /**
     * Explicit completion predicate. The system never completes a frame with
     * deferredActions still attached, because there is no generic action host.
     */
    shouldAutoCompleteFrame?: (args: {
        state: MatchState<TCore>;
        frame: ResolutionFrame;
        emittedEvents: GameEvent[];
    }) => boolean;
}

function hasProgressBlocker(frame: ResolutionFrame): boolean {
    return frame.status === 'blocked'
        || frame.status === 'suspended'
        || Boolean(frame.blockedBy);
}

function clearDeferredEvents<TCore>(
    state: MatchState<TCore>,
    frameId: string,
): MatchState<TCore> {
    return updateResolutionFrame(state, frameId, (frame) => ({
        ...frame,
        deferredEvents: undefined,
    }));
}

function canAutoCompleteFrame<TCore>(
    config: ResolutionFrameSystemConfig<TCore>,
    state: MatchState<TCore>,
    frame: ResolutionFrame,
    emittedEvents: GameEvent[],
): boolean {
    if ((frame.deferredActions?.length ?? 0) > 0) return false;
    return config.shouldAutoCompleteFrame?.({
        state,
        frame,
        emittedEvents,
    }) === true;
}

export function createResolutionFrameSystem<TCore>(
    config: ResolutionFrameSystemConfig<TCore> = {},
): EngineSystem<TCore> {
    return {
        id: SYSTEM_IDS.RESOLUTION_FRAME,
        name: '连续结算帧系统',
        priority: 35,

        afterEvents: ({ state }): HookResult<TCore> | void => {
            const frame = getActiveResolutionFrame(state);
            if (!frame || hasProgressBlocker(frame)) return;

            const deferredEvents = frame.deferredEvents ?? [];
            let nextState = state;

            if (deferredEvents.length > 0) {
                nextState = clearDeferredEvents(nextState, frame.id);
            }

            const frameAfterEventDrain = getResolutionFrameById(nextState, frame.id) ?? {
                ...frame,
                deferredEvents: undefined,
            };
            if (canAutoCompleteFrame(config, nextState, frameAfterEventDrain, deferredEvents)) {
                nextState = completeResolutionFrame(nextState, frame.id);
            }

            if (nextState === state && deferredEvents.length === 0) return;
            return {
                state: nextState,
                events: deferredEvents.length > 0 ? deferredEvents : undefined,
            };
        },
    };
}
