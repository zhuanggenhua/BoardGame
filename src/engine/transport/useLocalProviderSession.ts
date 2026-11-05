import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchState } from '../types';
import { StateRestoreError } from '../statePersistence';
import type { GameEngineConfig } from './engineConfig';
import { createInitialLocalProviderState, createLocalProviderRandom, type LocalProviderRandom } from './localProviderBootstrap';
import { clearLocalMatchSnapshot, persistLocalMatchSnapshot, readLocalMatchSnapshotResult,
    type LocalMatchSnapshot, type LocalSnapshotSaveResult } from './localSession';
import { isPersistedLocalStateCompatible, normalizePersistedLocalStateForGame } from './stateNormalization';

export interface LocalSessionStatus {
    restoreError: string | null;
    saveResult: LocalSnapshotSaveResult | null;
    expired: boolean;
}

export function useLocalProviderSession(args: {
    config: GameEngineConfig; numPlayers: number; seed: string; setupData: unknown;
    setupPlayerIds: string[]; aiSeatIds: string[]; persistSession: boolean;
    persistGameId?: string; shouldRestorePersistedSession?: (snapshot: LocalMatchSnapshot) => boolean;
}) {
    const { config, numPlayers, seed, setupData, setupPlayerIds, aiSeatIds, persistSession,
        persistGameId, shouldRestorePersistedSession } = args;
    const storageGameId = persistGameId ?? config.gameId;
    const admitted = useMemo(() => {
        if (!persistSession) return { snapshot: null, error: null, expired: false };
        const read = readLocalMatchSnapshotResult({ gameId: storageGameId, seed, numPlayers });
        if (read.status !== 'ready') return { snapshot: null,
            error: read.status === 'invalid' ? 'invalid-snapshot'
                : read.status === 'unavailable' ? 'restore-read-unavailable' : null, expired: read.status === 'expired' };
        try {
            if (shouldRestorePersistedSession && !shouldRestorePersistedSession(read.snapshot)) throw new StateRestoreError('setup-mismatch');
            if (!isPersistedLocalStateCompatible({ state: read.snapshot.state, expectedPlayerIds: setupPlayerIds })) throw new StateRestoreError('player-identity-mismatch');
            const state = normalizePersistedLocalStateForGame(config, read.snapshot.state);
            return { snapshot: { ...read.snapshot, state }, error: null, expired: false };
        } catch (error) {
            return { snapshot: null, error: error instanceof StateRestoreError ? error.reason : 'migration-failed', expired: false };
        }
    }, [config, numPlayers, persistSession, seed, setupPlayerIds, shouldRestorePersistedSession, storageGameId]);
    const [restoreError, setRestoreError] = useState<string | null>(admitted.error);
    const [saveResult, setSaveResult] = useState<LocalSnapshotSaveResult | null>(null);
    const [initialRandom] = useState<LocalProviderRandom>(() => createLocalProviderRandom(seed, admitted.snapshot?.randomCursor ?? 0));
    const randomRef = useRef(initialRandom);
    const [state, setState] = useState<MatchState<unknown>>(() => createInitialLocalProviderState({
        config, persistedState: admitted.snapshot?.state, aiSeatIds, initialRandom, setupData, setupPlayerIds,
    }));
    const stateRef = useRef(state);

    useEffect(() => {
        // Preserve an incompatible saved game byte-for-byte until explicit reset.
        if (!persistSession || restoreError) return;
        setSaveResult(persistLocalMatchSnapshot({ gameId: storageGameId, seed, numPlayers,
            state, randomCursor: randomRef.current.getCursor() }));
    }, [numPlayers, persistSession, restoreError, seed, state, storageGameId]);

    const reset = useCallback(() => {
        if (persistSession) clearLocalMatchSnapshot(storageGameId, seed);
        const random = createLocalProviderRandom(seed);
        randomRef.current = random;
        const next = createInitialLocalProviderState({ config, persistedState: null, aiSeatIds,
            initialRandom: random, setupData, setupPlayerIds });
        stateRef.current = next;
        setRestoreError(null);
        setSaveResult(null);
        setState(next);
    }, [aiSeatIds, config, persistSession, seed, setupData, setupPlayerIds, storageGameId]);

    const localSession: LocalSessionStatus = { restoreError, saveResult, expired: admitted.expired };
    return { state, setState, stateRef, randomRef, reset, localSession };
}
