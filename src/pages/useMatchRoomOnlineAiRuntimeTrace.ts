import { useEffect, useRef } from 'react';
import type { AiSeatController } from '../engine/ai';
import { aiRuntimeTruthLogger, emitAiRuntimeTruth, summarizeSeatControllerTypes } from './onlineAiRuntimeSupport';

export function useMatchRoomOnlineAiRuntimeTrace(args: {
    gameId?: string | null;
    matchId?: string | null;
    isTutorialRoute: boolean;
    isSpectatorRoute: boolean;
    shouldAutoJoin: boolean;
    hasOnlineAiSeat: boolean;
    onlineAiSeatControllers: Record<string, AiSeatController>;
    onlineAiSeatCredentials: Record<string, string>;
    effectivePlayerID?: string | null;
    statusPlayerID?: string | null;
}): void {
    const aiRuntimeTruthKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const seatControllerTypes = summarizeSeatControllerTypes(args.onlineAiSeatControllers);
        const aiSeatIds = Object.entries(seatControllerTypes)
            .filter(([, type]) => type !== 'human')
            .map(([playerId]) => playerId)
            .sort((leftId, rightId) => leftId.localeCompare(rightId));
        const aiCredentialSeatIds = Object.keys(args.onlineAiSeatCredentials)
            .sort((leftId, rightId) => leftId.localeCompare(rightId));
        const payload = {
            mode: args.isTutorialRoute ? 'tutorial-local' : 'online',
            source: 'MatchRoom',
            gameId: args.gameId ?? null,
            matchId: args.matchId ?? null,
            hasOnlineAiSeat: args.hasOnlineAiSeat,
            aiSeatIds,
            aiCredentialSeatIds,
            effectivePlayerID: args.effectivePlayerID ?? null,
            statusPlayerID: args.statusPlayerID ?? null,
            route: {
                isTutorialRoute: args.isTutorialRoute,
                isSpectatorRoute: args.isSpectatorRoute,
                shouldAutoJoin: args.shouldAutoJoin,
            },
            seatControllerTypes,
        };
        const nextKey = JSON.stringify(payload);
        if (aiRuntimeTruthKeyRef.current === nextKey) {
            return;
        }
        aiRuntimeTruthKeyRef.current = nextKey;
        aiRuntimeTruthLogger.info('match-room-ai-runtime', payload);
        emitAiRuntimeTruth('match-room-ai-runtime', payload);
        if (!args.isTutorialRoute && !args.hasOnlineAiSeat) {
            const disabledPayload = {
                mode: 'online',
                source: 'MatchRoom',
                gameId: args.gameId ?? null,
                matchId: args.matchId ?? null,
                reason: 'all-human-seats-or-ai-seat-not-configured',
                seatControllerTypes,
            };
            aiRuntimeTruthLogger.warn('online-ai-not-enabled', disabledPayload);
            emitAiRuntimeTruth('online-ai-not-enabled', disabledPayload);
        }
    }, [
        args.effectivePlayerID,
        args.gameId,
        args.hasOnlineAiSeat,
        args.isSpectatorRoute,
        args.isTutorialRoute,
        args.matchId,
        args.onlineAiSeatControllers,
        args.onlineAiSeatCredentials,
        args.shouldAutoJoin,
        args.statusPlayerID,
    ]);
}
