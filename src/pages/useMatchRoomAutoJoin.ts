import { useEffect, useRef, useState } from 'react';
import { readStoredMatchCredentials, rejoinMatch } from '../hooks/match/useMatchStatus';

const AUTO_JOIN_MAX_RETRIES = 5;
const AUTO_JOIN_RETRY_DELAY_MS = 500;
const AUTO_JOIN_GRACE_MS = 5000;

export function useMatchRoomAutoJoin(args: {
    shouldAutoJoin: boolean;
    gameId?: string;
    matchId?: string;
    isTutorialRoute: boolean;
    guestId: string;
    guestPlayerName: string;
    userId?: string;
    roomFullText: string;
    joinRoomFailedText: string;
    onLocalStateChanged: () => void;
}) {
    const {
        shouldAutoJoin,
        gameId,
        matchId,
        isTutorialRoute,
        guestId,
        guestPlayerName,
        userId,
        roomFullText,
        joinRoomFailedText,
        onLocalStateChanged,
    } = args;
    const [isAutoJoining, setIsAutoJoining] = useState(false);
    const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
    const [autoJoinGraceActive, setAutoJoinGraceActive] = useState(false);
    const autoJoinStartedRef = useRef(false);
    const autoJoinGraceTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (autoJoinGraceTimerRef.current !== null) {
                window.clearTimeout(autoJoinGraceTimerRef.current);
                autoJoinGraceTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!shouldAutoJoin || !gameId || !matchId || isTutorialRoute) {
            return;
        }
        if (autoJoinStartedRef.current) {
            return;
        }
        autoJoinStartedRef.current = true;
        setAutoJoinError(null);

        let cancelled = false;
        let retryTimer: number | undefined;

        const cleanup = () => {
            cancelled = true;
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            autoJoinStartedRef.current = false;
        };

        const stored = readStoredMatchCredentials(matchId);
        if (stored?.playerID) {
            onLocalStateChanged();
            return cleanup;
        }

        setIsAutoJoining(true);
        let retryCount = 0;

        const activateGrace = () => {
            if (autoJoinGraceTimerRef.current !== null) {
                window.clearTimeout(autoJoinGraceTimerRef.current);
            }
            setAutoJoinGraceActive(true);
            autoJoinGraceTimerRef.current = window.setTimeout(() => {
                autoJoinGraceTimerRef.current = null;
                setAutoJoinGraceActive(false);
            }, AUTO_JOIN_GRACE_MS);
        };

        const scheduleRetry = () => {
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            retryTimer = window.setTimeout(() => {
                if (!cancelled) {
                    void tryJoin();
                }
            }, AUTO_JOIN_RETRY_DELAY_MS);
        };

        const finishWithError = (message: string) => {
            if (cancelled) {
                return;
            }
            setAutoJoinError(message);
            setIsAutoJoining(false);
        };

        const tryJoin = async () => {
            if (cancelled) {
                return;
            }

            try {
                const { success, error } = await rejoinMatch(
                    gameId,
                    matchId,
                    undefined,
                    guestPlayerName,
                    { guestId: userId ? undefined : guestId },
                );
                if (cancelled) {
                    return;
                }
                if (success) {
                    activateGrace();
                    onLocalStateChanged();
                    setIsAutoJoining(false);
                    return;
                }
                if (error === 'room_full') {
                    finishWithError(roomFullText);
                    return;
                }

                retryCount++;
                if (retryCount < AUTO_JOIN_MAX_RETRIES) {
                    scheduleRetry();
                    return;
                }

                finishWithError(joinRoomFailedText);
            } catch {
                if (cancelled) {
                    return;
                }
                retryCount++;
                if (retryCount < AUTO_JOIN_MAX_RETRIES) {
                    scheduleRetry();
                    return;
                }
                finishWithError(joinRoomFailedText);
            }
        };

        void tryJoin();

        return cleanup;
    }, [
        gameId,
        guestId,
        guestPlayerName,
        isTutorialRoute,
        joinRoomFailedText,
        matchId,
        onLocalStateChanged,
        roomFullText,
        shouldAutoJoin,
        userId,
    ]);

    return {
        isAutoJoining,
        autoJoinError,
        autoJoinGraceActive,
    };
}
