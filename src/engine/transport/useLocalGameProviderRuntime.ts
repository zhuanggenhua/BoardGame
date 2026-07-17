import {
    useEffect,
    useMemo,
    useRef,
} from 'react';
import {
    getAiSeatIds,
} from '../ai/seatControllers';
import type { AiSeatController } from '../ai/types';
import type { GameClientContextValue } from './reactContext';
import type { GameEngineConfig } from './server';
import { resolveLocalPregameControlledPlayerId } from './followCurrentTurnPlayer';
import { useLocalAiRuntime } from './useLocalAiRuntime';
import { useLocalProviderDebugEffects } from './useLocalProviderDebugEffects';
import { useLocalProviderSession } from './useLocalProviderSession';
import { useLocalProviderViewModel } from './useLocalProviderViewModel';
import { resolveSetupPlayerIds } from './setupPlayerOrder';
import { resolveRuntimeSeatControllers } from './stateNormalization';

export function useLocalGameProviderRuntime(args: {
    config: GameEngineConfig;
    numPlayers: number;
    seed: string;
    setupData: unknown;
    onCommandRejected?: (commandType: string, error: string) => void;
    seatControllers: Record<string, AiSeatController>;
    playerNames?: Record<string, string>;
    localPlayerId: string | null;
    followCurrentTurnPlayer: boolean;
    persistSession: boolean;
    persistGameId?: string;
}): GameClientContextValue {
    const playerIds = useMemo(
        () => Array.from({ length: args.numPlayers }, (_, i) => String(i)),
        [args.numPlayers],
    );
    const setupPlayerIds = useMemo(
        () => resolveSetupPlayerIds({
            playerIds,
            setupData: args.setupData,
            seatControllers: args.seatControllers,
        }),
        [args.seatControllers, args.setupData, playerIds],
    );
    const aiSeatIds = useMemo(() => getAiSeatIds(args.seatControllers), [args.seatControllers]);
    const onCommandRejectedRef = useRef(args.onCommandRejected);

    useEffect(() => {
        onCommandRejectedRef.current = args.onCommandRejected;
    }, [args.onCommandRejected]);

    const {
        state,
        setState,
        stateRef,
        randomRef,
        reset,
    } = useLocalProviderSession({
        config: args.config,
        numPlayers: args.numPlayers,
        seed: args.seed,
        setupData: args.setupData,
        setupPlayerIds,
        aiSeatIds,
        persistSession: args.persistSession,
        persistGameId: args.persistGameId,
    });
    const runtimeSeatControllers = useMemo(
        () => resolveRuntimeSeatControllers({
            state,
            seatControllers: args.seatControllers,
        }),
        [args.seatControllers, state],
    );

    const localPregameControlledPlayerId = useMemo(
        () => resolveLocalPregameControlledPlayerId({
            state,
            seatControllers: runtimeSeatControllers,
            localPlayerId: args.localPlayerId,
            resolver: args.config.resolveLocalPregameControlledPlayerId,
        }),
        [args.config.resolveLocalPregameControlledPlayerId, args.localPlayerId, runtimeSeatControllers, state],
    );

    const { dispatch } = useLocalAiRuntime({
        state,
        config: args.config,
        seed: args.seed,
        seatControllers: runtimeSeatControllers,
        localPregameControlledPlayerId,
        setState,
        stateRef,
        randomRef,
        setupPlayerIds,
        onCommandRejectedRef,
    });

    const value = useLocalProviderViewModel({
        state,
        dispatch,
        reset,
        playerIds,
        seatControllers: runtimeSeatControllers,
        playerNames: args.playerNames,
        localPregameControlledPlayerId,
        followCurrentTurnPlayer: args.followCurrentTurnPlayer,
        localPlayerId: args.localPlayerId,
    });

    useLocalProviderDebugEffects({
        config: args.config,
        state,
        stateRef,
        setState,
        dispatch,
    });

    return value;
}
