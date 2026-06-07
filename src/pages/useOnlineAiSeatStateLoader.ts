import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as matchApi from '../services/matchApi';
import type { GameManifestEntry } from '../games/manifest.types';
import { useToast } from '../contexts/ToastContext';
import type { AiSeatController } from '../engine/ai';
import {
    persistAiSeatCredentials,
    isMatchNotFoundError,
    readStoredAiSeatCredentials,
} from '../hooks/match/useMatchStatus';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import {
    haveAiSeatCredentialsChanged,
    loadOnlineAiSeatState,
    resolveOnlineAiSeatClaimOptions,
    resolveMissingOnlineAiSeatCredentialIds,
} from './onlineAiSeats';

const ONLINE_AI_SEAT_LOAD_RETRY_BASE_MS = 1_000;
const ONLINE_AI_SEAT_LOAD_RETRY_MAX_MS = 8_000;
const ONLINE_AI_SEAT_LOAD_RETRY_MAX_ATTEMPTS = 5;
const ONLINE_AI_SEAT_CLAIM_AUTH_ERROR_STATUSES = new Set([401, 403]);

const getMatchApiErrorStatus = (error: unknown): number | undefined => {
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === 'number') return status;
    }
    const message = error instanceof Error ? error.message : String(error);
    const statusMatch = message.match(/^(\d{3})\b/);
    return statusMatch ? Number(statusMatch[1]) : undefined;
};

type UseOnlineAiSeatStateLoaderArgs = {
    gameId?: string;
    matchId?: string;
    gameConfig?: GameManifestEntry;
    isTutorialRoute: boolean;
    matchStatusIsHost: boolean;
    statusPlayerID: string | null;
    guestId: string;
    token?: string | null;
    localStorageTick: number;
};

type UseOnlineAiSeatStateLoaderResult = {
    onlineAiSeatControllers: Record<string, AiSeatController>;
    onlineAiSeatCredentials: Record<string, string>;
    hasOnlineAiSeat: boolean;
    onlineAiRematchAutoAcceptedPlayerIds: string[];
};

export function useOnlineAiSeatStateLoader(
    args: UseOnlineAiSeatStateLoaderArgs,
): UseOnlineAiSeatStateLoaderResult {
    const {
        gameId,
        matchId,
        gameConfig,
        isTutorialRoute,
        matchStatusIsHost,
        statusPlayerID,
        guestId,
        token,
        localStorageTick,
    } = args;
    const { t: tLobby } = useTranslation('lobby');
    const toast = useToast();
    const [onlineAiSeatReloadTick, setOnlineAiSeatReloadTick] = useState(0);
    const [onlineAiSeatControllers, setOnlineAiSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [onlineAiSeatCredentials, setOnlineAiSeatCredentials] = useState<Record<string, string>>({});
    const onlineAiSeatReloadAttemptRef = useRef(0);
    const onlineAiSeatFailureNoticeKeyRef = useRef<string | null>(null);
    const shouldEnableOnlineAiSeatLoader = !isTutorialRoute && Boolean(matchId && gameId && gameConfig);

    const hasOnlineAiSeat = useMemo(
        () => Object.values(onlineAiSeatControllers).some((controller) => controller.type !== 'human'),
        [onlineAiSeatControllers],
    );
    const onlineAiRematchAutoAcceptedPlayerIds = useMemo(
        () => Object.entries(onlineAiSeatControllers)
            .filter(([, controller]) => controller.type !== 'human')
            .map(([playerId]) => playerId)
            .sort((leftId, rightId) => leftId.localeCompare(rightId)),
        [onlineAiSeatControllers],
    );
    const canClaimMissingAiSeatCredentials = !isTutorialRoute
        && (matchStatusIsHost || statusPlayerID === '0');

    useEffect(() => {
        onlineAiSeatReloadAttemptRef.current = 0;
        onlineAiSeatFailureNoticeKeyRef.current = null;
    }, [canClaimMissingAiSeatCredentials, gameId, guestId, matchId, statusPlayerID, token]);

    useEffect(() => {
        if (!shouldEnableOnlineAiSeatLoader || !matchId || !gameId || !gameConfig) {
            onlineAiSeatReloadAttemptRef.current = 0;
            return;
        }

        let cancelled = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const notifyOnlineAiSeatFailure = (reason: string, extra?: Record<string, unknown>) => {
            const noticeKey = `${matchId}:${reason}`;
            if (onlineAiSeatFailureNoticeKeyRef.current === noticeKey) {
                return;
            }
            onlineAiSeatFailureNoticeKeyRef.current = noticeKey;
            logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-claim-toast', {
                gameId,
                matchId,
                reason,
                statusPlayerID: statusPlayerID ?? null,
                matchStatusIsHost,
                canClaimMissingAiSeatCredentials,
                ...(extra ?? {}),
            });
            toast.error(
                { kind: 'i18n', key: 'error.aiSeatClaimFailed', ns: 'lobby' },
                undefined,
                { dedupeKey: `match.ai-seat-claim-failed.${matchId}` },
            );
        };

        const scheduleOnlineAiSeatReload = (reason: string, extra?: Record<string, unknown>) => {
            if (cancelled) return;
            if (onlineAiSeatReloadAttemptRef.current >= ONLINE_AI_SEAT_LOAD_RETRY_MAX_ATTEMPTS) {
                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-retry-gave-up', {
                    gameId,
                    matchId,
                    reason,
                    attempts: onlineAiSeatReloadAttemptRef.current,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost,
                    canClaimMissingAiSeatCredentials,
                    ...(extra ?? {}),
                });
                notifyOnlineAiSeatFailure(reason, {
                    attempts: onlineAiSeatReloadAttemptRef.current,
                    ...(extra ?? {}),
                });
                return;
            }
            onlineAiSeatReloadAttemptRef.current += 1;
            const delayMs = Math.min(
                ONLINE_AI_SEAT_LOAD_RETRY_BASE_MS * (2 ** (onlineAiSeatReloadAttemptRef.current - 1)),
                ONLINE_AI_SEAT_LOAD_RETRY_MAX_MS,
            );
            logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-retry-scheduled', {
                gameId,
                matchId,
                reason,
                delayMs,
                attempt: onlineAiSeatReloadAttemptRef.current,
                statusPlayerID: statusPlayerID ?? null,
                matchStatusIsHost,
                canClaimMissingAiSeatCredentials,
                ...(extra ?? {}),
            });
            retryTimer = setTimeout(() => {
                retryTimer = null;
                if (cancelled) return;
                setOnlineAiSeatReloadTick((tick) => tick + 1);
            }, delayMs);
        };

        const loadCurrentOnlineAiSeatState = async () => {
            try {
                const matchInfo = await matchApi.getMatch(gameId, matchId);
                if (cancelled) return;

                const storedAiSeatCredentials = readStoredAiSeatCredentials(matchId);
                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-start', {
                    gameId,
                    matchId,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost,
                    canClaimMissingAiSeatCredentials,
                    storedAiSeatCredentialSeatIds: Object.keys(storedAiSeatCredentials).sort(),
                });
                const nextAiSeatState = await loadOnlineAiSeatState({
                    gameConfig,
                    matchInfo,
                    storedAiSeatCredentials,
                    claimMissingSeatCredential: canClaimMissingAiSeatCredentials
                        ? async (playerId) => {
                            const aiPlayerName = tLobby('createRoom.aiPlayerName', { seat: Number(playerId) + 1 });
                            const response = await matchApi.claimSeat(
                                gameId,
                                matchId,
                                playerId,
                                resolveOnlineAiSeatClaimOptions({
                                    matchInfo,
                                    token,
                                    guestId,
                                    playerName: aiPlayerName,
                                }),
                            );
                            return response.playerCredentials;
                        }
                        : undefined,
                    onClaimError: (playerId, error) => {
                        const status = getMatchApiErrorStatus(error);
                        logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-claim-failed', {
                            gameId,
                            matchId,
                            playerId,
                            statusPlayerID: statusPlayerID ?? null,
                            matchStatusIsHost,
                            canClaimMissingAiSeatCredentials,
                            status: status ?? null,
                            error,
                        });
                        if (status && ONLINE_AI_SEAT_CLAIM_AUTH_ERROR_STATUSES.has(status)) {
                            notifyOnlineAiSeatFailure('claim-auth-failed', {
                                playerId,
                                status,
                            });
                        }
                        console.warn('[MatchRoom] AI 座位补领失败', {
                            matchId,
                            playerId,
                            status,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    },
                });
                if (cancelled) return;

                logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-finished', {
                    gameId,
                    matchId,
                    statusPlayerID: statusPlayerID ?? null,
                    matchStatusIsHost,
                    canClaimMissingAiSeatCredentials,
                    aiSeatIds: Object.entries(nextAiSeatState.seatControllers)
                        .filter(([, controller]) => controller.type !== 'human')
                        .map(([playerId]) => playerId)
                        .sort(),
                    aiCredentialSeatIds: Object.keys(nextAiSeatState.seatCredentials).sort(),
                });

                if (canClaimMissingAiSeatCredentials && haveAiSeatCredentialsChanged(storedAiSeatCredentials, nextAiSeatState.seatCredentials)) {
                    persistAiSeatCredentials(matchId, nextAiSeatState.seatCredentials);
                }

                setOnlineAiSeatControllers(nextAiSeatState.seatControllers);
                setOnlineAiSeatCredentials(nextAiSeatState.seatCredentials);

                const missingAiSeatCredentialIds = canClaimMissingAiSeatCredentials
                    ? resolveMissingOnlineAiSeatCredentialIds(nextAiSeatState.seatControllers, nextAiSeatState.seatCredentials)
                    : [];
                if (missingAiSeatCredentialIds.length > 0) {
                    scheduleOnlineAiSeatReload('missing-ai-seat-credentials', {
                        missingAiSeatCredentialIds,
                    });
                } else {
                    onlineAiSeatReloadAttemptRef.current = 0;
                    onlineAiSeatFailureNoticeKeyRef.current = null;
                }
            } catch (error) {
                if (!cancelled) {
                    logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-failed', {
                        gameId,
                        matchId,
                        statusPlayerID: statusPlayerID ?? null,
                        matchStatusIsHost,
                        canClaimMissingAiSeatCredentials,
                        error,
                    });
                    if (isMatchNotFoundError(error)) {
                        onlineAiSeatReloadAttemptRef.current = 0;
                        setOnlineAiSeatControllers({});
                        setOnlineAiSeatCredentials({});
                        return;
                    }
                    scheduleOnlineAiSeatReload('load-failed');
                }
            }
        };

        void loadCurrentOnlineAiSeatState();

        return () => {
            cancelled = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
            }
        };
    }, [
        canClaimMissingAiSeatCredentials,
        gameConfig,
        gameId,
        guestId,
        localStorageTick,
        matchId,
        matchStatusIsHost,
        onlineAiSeatReloadTick,
        statusPlayerID,
        shouldEnableOnlineAiSeatLoader,
        tLobby,
        toast,
        token,
    ]);

    const resolvedOnlineAiSeatControllers = shouldEnableOnlineAiSeatLoader
        ? onlineAiSeatControllers
        : {};
    const resolvedOnlineAiSeatCredentials = shouldEnableOnlineAiSeatLoader
        ? onlineAiSeatCredentials
        : {};
    const resolvedHasOnlineAiSeat = shouldEnableOnlineAiSeatLoader
        ? hasOnlineAiSeat
        : false;
    const resolvedOnlineAiRematchAutoAcceptedPlayerIds = shouldEnableOnlineAiSeatLoader
        ? onlineAiRematchAutoAcceptedPlayerIds
        : [];

    return {
        onlineAiSeatControllers: resolvedOnlineAiSeatControllers,
        onlineAiSeatCredentials: resolvedOnlineAiSeatCredentials,
        hasOnlineAiSeat: resolvedHasOnlineAiSeat,
        onlineAiRematchAutoAcceptedPlayerIds: resolvedOnlineAiRematchAutoAcceptedPlayerIds,
    };
}
