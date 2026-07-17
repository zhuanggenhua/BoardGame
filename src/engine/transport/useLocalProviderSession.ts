import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createInitialSystemState } from '../pipeline';
import type { MatchState } from '../types';
import type { EngineSystem } from '../systems/types';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import type { GameEngineConfig } from './server';
import {
    createInitialLocalProviderState,
    createLocalProviderRandom,
    type LocalProviderRandom,
} from './localProviderBootstrap';
import {
    persistLocalMatchSnapshot,
    readLocalMatchSnapshot,
} from './localSession';
import { normalizeStateForConfig } from './stateNormalization';

export function useLocalProviderSession(args: {
    config: GameEngineConfig;
    numPlayers: number;
    seed: string;
    setupData: unknown;
    setupPlayerIds: string[];
    aiSeatIds: string[];
    persistSession: boolean;
    persistGameId?: string;
}) {
    const {
        config,
        numPlayers,
        seed,
        setupData,
        setupPlayerIds,
        aiSeatIds,
        persistSession,
        persistGameId,
    } = args;
    const storageGameId = persistGameId ?? config.gameId;

    const persistedSnapshot = useMemo(
        () => (
            persistSession
                ? readLocalMatchSnapshot({ gameId: storageGameId, seed, numPlayers })
                : null
        ),
        [numPlayers, persistSession, seed, storageGameId],
    );

    const [initialRandom] = useState<LocalProviderRandom>(() =>
        createLocalProviderRandom(seed, persistedSnapshot?.randomCursor ?? 0),
    );
    const randomRef = useRef<LocalProviderRandom>(initialRandom);

    const [state, setState] = useState<MatchState<unknown>>(() =>
        createInitialLocalProviderState({
            config,
            persistedState: persistedSnapshot?.state,
            aiSeatIds,
            initialRandom,
            setupData,
            setupPlayerIds,
        }),
    );
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        if (!persistSession) return;
        persistLocalMatchSnapshot({
            gameId: storageGameId,
            seed,
            numPlayers,
            state,
            randomCursor: randomRef.current.getCursor(),
        });
    }, [numPlayers, persistSession, seed, state, storageGameId]);

    const reset = useCallback(() => {
        randomRef.current = createLocalProviderRandom(seed);
        const random = randomRef.current;
        const core = config.domain.setup(setupPlayerIds, random, setupData);
        const sys = createInitialSystemState(
            setupPlayerIds,
            config.systems as EngineSystem[],
        );
        const nextState = setUndoAiSeatIds(
            normalizeStateForConfig(config, { sys, core }),
            aiSeatIds,
        );
        stateRef.current = nextState;
        setState(nextState);
    }, [aiSeatIds, config, seed, setupData, setupPlayerIds]);

    return {
        state,
        setState,
        stateRef,
        randomRef,
        reset,
    };
}
