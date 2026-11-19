import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { DomainSetupContext, MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import {
    createFreshLocalProviderState,
    createInitialLocalProviderState,
    createLocalProviderRandom,
    type LocalProviderRandom,
} from './localProviderBootstrap';
import {
    clearLocalMatchSnapshot,
    type LocalMatchSnapshot,
    persistLocalMatchSnapshot,
    readLocalMatchSnapshot,
} from './localSession';

export function useLocalProviderSession(args: {
    config: GameEngineConfig;
    numPlayers: number;
    seed: string;
    randomSeed?: string;
    setupData: unknown;
    setupContext: DomainSetupContext;
    setupPlayerIds: string[];
    aiSeatIds: string[];
    persistSession: boolean;
    persistGameId?: string;
    shouldRestorePersistedSession?: (snapshot: LocalMatchSnapshot) => boolean;
}) {
    const {
        config,
        numPlayers,
        seed,
        randomSeed = seed,
        setupData,
        setupContext,
        setupPlayerIds,
        aiSeatIds,
        persistSession,
        persistGameId,
        shouldRestorePersistedSession,
    } = args;
    const storageGameId = persistGameId ?? config.gameId;

    const persistedSnapshotResult = useMemo(() => {
        if (!persistSession) return null;
        const snapshot = readLocalMatchSnapshot({ gameId: storageGameId, seed, numPlayers });
        if (!snapshot) return null;
        if (shouldRestorePersistedSession && !shouldRestorePersistedSession(snapshot)) {
            return { snapshot: null, rejectedSeed: seed };
        }
        return { snapshot, rejectedSeed: null };
    }, [numPlayers, persistSession, seed, shouldRestorePersistedSession, storageGameId]);
    const persistedSnapshot = persistedSnapshotResult?.snapshot ?? null;
    const rejectedPersistedSnapshotSeed = persistedSnapshotResult?.rejectedSeed ?? null;

    // 初始状态和已消费的随机源必须一起创建。StrictMode重跑初始化时，
    // 每次使用独立随机源，避免被丢弃的setup继续推进保留下来的游标。
    const [initialSession] = useState(() => {
        const random = createLocalProviderRandom(randomSeed, persistedSnapshot?.randomCursor ?? 0);
        return {
            random,
            state: createInitialLocalProviderState({
                config,
                persistedState: persistedSnapshot?.state,
                aiSeatIds,
                initialRandom: random,
                setupData,
                setupPlayerIds,
                setupContext,
            }),
        };
    });
    const randomRef = useRef<LocalProviderRandom>(initialSession.random);
    const [state, setState] = useState<MatchState<unknown>>(initialSession.state);
    const stateRef = useRef(state);

    useEffect(() => {
        if (!persistSession) return;
        if (rejectedPersistedSnapshotSeed) {
            clearLocalMatchSnapshot(storageGameId, rejectedPersistedSnapshotSeed);
        }
        persistLocalMatchSnapshot({
            gameId: storageGameId,
            seed,
            numPlayers,
            state,
            randomCursor: randomRef.current.getCursor(),
        });
    }, [numPlayers, persistSession, rejectedPersistedSnapshotSeed, seed, state, storageGameId]);

    const reset = useCallback(() => {
        randomRef.current = createLocalProviderRandom(randomSeed);
        const nextState = createFreshLocalProviderState({
            config,
            aiSeatIds,
            initialRandom: randomRef.current,
            setupData,
            setupPlayerIds,
            setupContext,
        });
        stateRef.current = nextState;
        setState(nextState);
    }, [aiSeatIds, config, randomSeed, setupData, setupPlayerIds, setupContext]);

    return {
        state,
        setState,
        stateRef,
        randomRef,
        reset,
    };
}
