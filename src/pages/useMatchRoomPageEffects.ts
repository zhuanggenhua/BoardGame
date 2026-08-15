import { useEffect } from 'react';
import { syncGamePageDocumentAttributes } from '../shared/mobileSupport';
import { appendMatchLoadTrace } from '../lib/matchLoadTrace';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import { isNativeAndroidRuntime } from '../lib/mobile/androidRuntime';

export function useMatchRoomPageEffects(args: {
    gameId?: string;
    matchId?: string;
    isTutorialRoute: boolean;
    searchParams: URLSearchParams;
    userId?: string | null;
    gamePageDataAttributes: Record<string, string | undefined>;
}) {
    const {
        gameId,
        matchId,
        isTutorialRoute,
        searchParams,
        userId,
        gamePageDataAttributes,
    } = args;

    useEffect(() => {
        syncGamePageDocumentAttributes(gamePageDataAttributes);
    }, [gamePageDataAttributes]);

    useEffect(() => {
        appendMatchLoadTrace({
            stage: 'match-room-mounted',
            gameId,
            matchId,
            payload: {
                playerID: searchParams.get('playerID'),
                spectate: searchParams.get('spectate'),
                isTutorialRoute,
            },
        });
    }, [gameId, isTutorialRoute, matchId, searchParams]);

    useEffect(() => {
        if (!isNativeAndroidRuntime()) return;
        logMobileRuntimeCritical('MatchRoom', 'render-enter', {
            gameId,
            matchId,
            playerID: searchParams.get('playerID'),
            spectate: searchParams.get('spectate'),
            userId: userId ?? null,
        });
    }, [gameId, matchId, searchParams, userId]);
}
