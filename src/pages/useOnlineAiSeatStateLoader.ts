import { useEffect, useMemo, useState } from 'react';
import * as matchApi from '../services/matchApi';
import type { MatchInfo } from '../services/matchApi';
import type { GameManifestEntry } from '../games/manifest.types';
import type { AiSeatController } from '../engine/ai';
import {
    isMatchNotFoundError,
    persistAiSeatCredentials,
    readStoredAiSeatCredentials,
} from '../hooks/match/useMatchStatus';
import { logMobileRuntimeCritical } from '../lib/mobile/mobileRuntimeDebug';
import {
    haveAiSeatCredentialsChanged,
    loadOnlineAiSeatState,
    resolveOnlineAiSeatClaimOptions,
} from './onlineAiSeats';

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

const resolveAiSeatPlayerName = (matchInfo: MatchInfo, playerId: string): string => {
    const player = matchInfo.players.find((item) => String(item.id) === playerId);
    if (player?.name?.trim()) {
        return player.name.trim();
    }
    const seatNumber = Number(playerId);
    return Number.isFinite(seatNumber) ? `AI ${seatNumber + 1}` : `AI ${playerId}`;
};

const serializeSeatController = (controller: AiSeatController | undefined): string => JSON.stringify(controller ?? {});

const haveAiSeatControllersChanged = (
    prev: Record<string, AiSeatController>,
    next: Record<string, AiSeatController>,
): boolean => {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) {
        return true;
    }
    return nextKeys.some((key) => serializeSeatController(prev[key]) !== serializeSeatController(next[key]));
};

export function useOnlineAiSeatStateLoader(
    args: UseOnlineAiSeatStateLoaderArgs,
): UseOnlineAiSeatStateLoaderResult {
    const { gameId, matchId, gameConfig, isTutorialRoute } = args;
    const [onlineAiSeatControllers, setOnlineAiSeatControllers] = useState<Record<string, AiSeatController>>({});
    const [onlineAiSeatCredentials, setOnlineAiSeatCredentials] = useState<Record<string, string>>({});
    const shouldEnable = !isTutorialRoute && Boolean(matchId && gameId && gameConfig);

    useEffect(() => {
        if (!shouldEnable || !matchId || !gameId || !gameConfig) {
            return;
        }
        let cancelled = false;
        void matchApi.getMatch(gameId, matchId).then(async (matchInfo) => {
            if (cancelled) return;
            const storedAiSeatCredentials = readStoredAiSeatCredentials(matchId);
            const state = await loadOnlineAiSeatState({
                gameConfig,
                matchInfo,
                storedAiSeatCredentials,
                claimMissingSeatCredential: args.matchStatusIsHost && args.statusPlayerID === '0'
                    ? async (playerId) => {
                        const result = await matchApi.claimSeat(gameId, matchId, playerId, resolveOnlineAiSeatClaimOptions({
                            matchInfo,
                            token: args.token,
                            guestId: args.guestId,
                            playerName: resolveAiSeatPlayerName(matchInfo, playerId),
                        }));
                        return result.playerCredentials;
                    }
                    : undefined,
                onClaimError: (playerId, error) => {
                    logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-credential-claim-failed', {
                        gameId,
                        matchId,
                        playerId,
                        error: error instanceof Error ? error.message : String(error),
                    });
                },
            });
            if (cancelled) return;
            if (haveAiSeatCredentialsChanged(storedAiSeatCredentials, state.seatCredentials)) {
                persistAiSeatCredentials(matchId, state.seatCredentials);
            }
            setOnlineAiSeatControllers((prev) => (
                haveAiSeatControllersChanged(prev, state.seatControllers) ? state.seatControllers : prev
            ));
            setOnlineAiSeatCredentials((prev) => (
                haveAiSeatCredentialsChanged(prev, state.seatCredentials) ? state.seatCredentials : prev
            ));
            logMobileRuntimeCritical('MatchRoom', 'online-ai-seat-state-load-finished', {
                gameId,
                matchId,
                authority: 'server-online-ai-executor',
                aiSeatIds: Object.entries(state.seatControllers)
                    .filter(([, controller]) => controller.type !== 'human')
                    .map(([playerId]) => playerId)
                    .sort(),
                credentialSeatIds: Object.keys(state.seatCredentials).sort(),
            });
        }).catch((error) => {
            if (cancelled || !isMatchNotFoundError(error)) return;
            setOnlineAiSeatControllers({});
            setOnlineAiSeatCredentials({});
        });
        return () => {
            cancelled = true;
        };
    }, [
        args.guestId,
        args.localStorageTick,
        args.matchStatusIsHost,
        args.statusPlayerID,
        args.token,
        gameConfig,
        gameId,
        matchId,
        shouldEnable,
    ]);

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

    return {
        onlineAiSeatControllers: shouldEnable ? onlineAiSeatControllers : {},
        onlineAiSeatCredentials: shouldEnable ? onlineAiSeatCredentials : {},
        hasOnlineAiSeat: shouldEnable && hasOnlineAiSeat,
        onlineAiRematchAutoAcceptedPlayerIds: shouldEnable ? onlineAiRematchAutoAcceptedPlayerIds : [],
    };
}
