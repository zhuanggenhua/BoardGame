import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { startCancelableAiDelay } from '../ai/actionDelay';
import type { AiSeatController } from '../ai/types';
import type { MatchState } from '../types';
import type { GameEngineConfig } from './engineConfig';
import type { LocalAiCommandEffect } from './localAiCommandEffects';
import type { LocalProviderRandom } from './localProviderBootstrap';
import {
    LOCAL_AI_IDLE_RETRY_MS,
    LOCAL_AI_STALL_RECOVERY_GRACE_MS,
    ensureLocalAiTurnTimeline,
    type LocalAiTurnTimeline,
} from './localAiDiagnostics';
import { executeLocalDispatch } from './localDispatchExecution';
import { startLocalAiAutomationEffect } from './localAiAutomationEffect';
import {
    logLocalAiProviderRuntimeTruth,
    recoverLocalAiOnAppVisible,
    syncLocalAiActivePhase,
} from './localAiProviderLifecycle';
import { onAppVisible } from '../../lib/mobile/appVisibility';

type RefBox<T> = {
    current: T;
};

export function useLocalAiRuntime(args: {
    state: MatchState<unknown>;
    config: GameEngineConfig;
    seed: string;
    seatControllers: Record<string, AiSeatController>;
    localPregameControlledPlayerId: string | null;
    setState: Dispatch<SetStateAction<MatchState<unknown>>>;
    stateRef: RefBox<MatchState<unknown>>;
    randomRef: RefBox<LocalProviderRandom>;
    setupPlayerIds: string[];
    onCommandRejectedRef: RefBox<((commandType: string, error: string) => void) | undefined>;
    automationDisabled?: boolean;
}) {
    const {
        state,
        config,
        seed,
        seatControllers,
        localPregameControlledPlayerId,
        setState,
        stateRef,
        randomRef,
        setupPlayerIds,
        onCommandRejectedRef,
    } = args;
    const lastAiAttemptKeyRef = useRef<string | null>(null);
    const lastVisibleAiActionAtRef = useRef<number | null>(null);
    const aiCommandEffectByTokenRef = useRef<Record<string, LocalAiCommandEffect>>({});
    const [aiRetryVersion, setAiRetryVersion] = useState(0);
    const aiActivePhaseRef = useRef<{ key: string; startedAt: number } | null>(null);
    const aiTurnTimelineBySeatRef = useRef<Record<string, LocalAiTurnTimeline>>({});
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);
    const scheduleAiRetry = useCallback(() => {
        setAiRetryVersion((version) => version + 1);
    }, []);
    const dispatch = useCallback((type: string, payload: unknown) => {
        const nextState = executeLocalDispatch({
            commandType: type,
            payload,
            prevState: stateRef.current,
            config,
            seed,
            random: randomRef.current,
            setupPlayerIds,
            seatControllers,
            localPregameControlledPlayerId,
            commandEffectsByToken: aiCommandEffectByTokenRef.current,
            onCommandRejected: onCommandRejectedRef.current,
        });
        // 规则执行会消费随机数和写入诊断副作用，不能放进 React state updater。
        // 开发/测试 StrictMode 可能重复调用 updater，导致预置随机数被丢弃的预执行吃掉。
        stateRef.current = nextState;
        setState(nextState);
    }, [
        config,
        localPregameControlledPlayerId,
        onCommandRejectedRef,
        randomRef,
        seed,
        seatControllers,
        setState,
        setupPlayerIds,
        stateRef,
    ]);

    const ensureAiTurnTimeline = useCallback((playerId: string, matchState: MatchState<unknown>) => {
        return ensureLocalAiTurnTimeline({
            timelines: aiTurnTimelineBySeatRef.current,
            playerId,
            matchState,
            gameId: config.gameId,
            seed,
        });
    }, [config.gameId, seed]);

    useEffect(() => {
        syncLocalAiActivePhase({
            state,
            seatControllers,
            activePhaseRef: aiActivePhaseRef,
            ensureAiTurnTimeline,
        });
    }, [ensureAiTurnTimeline, seatControllers, state]);

    useEffect(() => {
        logLocalAiProviderRuntimeTruth({
            state,
            gameId: config.gameId,
            seatControllers,
            localPregameControlledPlayerId,
            runtimeTruthKeyRef: aiRuntimeTruthKeyRef,
        });
    }, [config.gameId, localPregameControlledPlayerId, seatControllers, state]);

    useEffect(() => {
        return onAppVisible(() => {
            recoverLocalAiOnAppVisible({
                seatControllers,
                localPregameControlledPlayerId,
                lastAiAttemptKeyRef,
                lastVisibleAiActionAtRef,
                aiCommandEffectByTokenRef,
                onRetry: scheduleAiRetry,
                automationDisabled: args.automationDisabled,
            });
        });
    }, [args.automationDisabled, localPregameControlledPlayerId, scheduleAiRetry, seatControllers]);

    useEffect(() => {
        return startLocalAiAutomationEffect({
            state,
            config,
            seed,
            seatControllers,
            localPregameControlledPlayerId,
            activePhaseStartedAt: aiActivePhaseRef.current?.startedAt ?? null,
            stallRecoveryGraceMs: LOCAL_AI_STALL_RECOVERY_GRACE_MS,
            lastAiAttemptKeyRef,
            lastVisibleAiActionAtRef,
            aiCommandEffectByTokenRef,
            aiTurnTimelineBySeatRef,
            ensureAiTurnTimeline,
            startDelay: startCancelableAiDelay,
            dispatch,
            getState: () => stateRef.current,
            scheduleRetry: scheduleAiRetry,
            onVisibleActionAt: (timestamp) => {
                lastVisibleAiActionAtRef.current = timestamp;
            },
            idleRetryMs: LOCAL_AI_IDLE_RETRY_MS,
            automationDisabled: args.automationDisabled,
        });
    }, [
        aiRetryVersion,
        args.automationDisabled,
        config,
        localPregameControlledPlayerId,
        seatControllers,
        seed,
        state,
        stateRef,
        dispatch,
        ensureAiTurnTimeline,
        scheduleAiRetry,
    ]);

    return {
        aiCommandEffectByTokenRef,
        dispatch,
    };
}
