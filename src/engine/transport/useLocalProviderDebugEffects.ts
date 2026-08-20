import {
    useCallback,
    useEffect,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from 'react';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import {
    exposeLocalProviderDebugBridge,
    syncLocalProviderTestHarness,
} from './localProviderDebugBridge';

export function useLocalProviderDebugEffects(args: {
    config: GameEngineConfig;
    state: MatchState<unknown>;
    stateRef: MutableRefObject<MatchState<unknown>>;
    setState: Dispatch<SetStateAction<MatchState<unknown>>>;
    dispatch: (type: string, payload: unknown) => void;
}) {
    const {
        config,
        state,
        stateRef,
        setState,
        dispatch,
    } = args;
    const getState = useCallback(() => stateRef.current, [stateRef]);
    const applyState = useCallback((nextState: MatchState<unknown>) => {
        stateRef.current = nextState;
        setState(nextState);
    }, [setState, stateRef]);

    useEffect(() => {
        syncLocalProviderTestHarness({
            config,
            getState,
            setState: applyState,
            dispatch,
        });
    }, [applyState, config, dispatch, getState]);

    useEffect(() => {
        return exposeLocalProviderDebugBridge({
            dispatch,
            state,
        });
    }, [dispatch, state]);
}
