import { useMemo, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveMatchSeatSwapContext } from '../components/game/framework';
import type { MatchSeatSwapConfig } from '../components/game/framework';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import type { AiSeatController } from '../engine/ai';
import type { MatchState } from '../engine/types';

type MatchRoomHudSeatSwapModel = Pick<
    ComponentProps<typeof GameHUD>,
    'showSeatSwap' | 'seatSwapActionActive' | 'seatSwapContent'
>;

export function useMatchRoomHudSeatSwapModel(args: {
    seatSwapConfig?: MatchSeatSwapConfig | null;
    state?: MatchState<unknown> | null;
    dispatch: (type: string, payload?: Record<string, unknown>) => void;
    myPlayerId?: string | null;
    players: Array<{ id: number; name?: string; isConnected?: boolean }>;
    seatControllers: Record<string, AiSeatController>;
}): MatchRoomHudSeatSwapModel {
    const {
        seatSwapConfig,
        state,
        dispatch,
        myPlayerId,
        players,
        seatControllers,
    } = args;

    const { t: tGame } = useTranslation('game');
    const normalizedMyPlayerId = myPlayerId != null ? String(myPlayerId) : null;
    const seatNameByPlayerId = useMemo(() => {
        const map = new Map<string, string>();
        for (const player of players) {
            const normalizedId = String(player.id);
            map.set(
                normalizedId,
                player.name?.trim()
                    ? player.name
                    : tGame('hud.status.player', { id: normalizedId }),
            );
        }
        return map;
    }, [players, tGame]);

    const seatSwapContext = useMemo(() => resolveMatchSeatSwapContext({
        seatSwapConfig,
        state,
        myPlayerId: normalizedMyPlayerId,
        seatControllers,
    }), [normalizedMyPlayerId, seatControllers, seatSwapConfig, state]);

    const seatSwapContent = useMemo(() => {
        if (!seatSwapContext || normalizedMyPlayerId == null) {
            return undefined;
        }

        const {
            seatSwapMode,
            seatingOrder,
            seatControllerTypeByPlayerId,
            pendingSeatSwapRequest,
            requestSeatSwapCommandType,
            respondSeatSwapCommandType,
            cancelSeatSwapCommandType,
        } = seatSwapContext;
        const isSeatSwapPending = seatSwapMode === 'request' && Boolean(pendingSeatSwapRequest);
        const isRequester = pendingSeatSwapRequest?.requesterId === normalizedMyPlayerId;
        const isTarget = pendingSeatSwapRequest?.targetPlayerId === normalizedMyPlayerId;
        const resolveSeatPlayerName = (playerId: string) => (
            seatNameByPlayerId.get(playerId)
            ?? tGame('hud.status.player', { id: playerId })
        );
        const pendingHintText = (() => {
            if (seatSwapMode !== 'request' || !pendingSeatSwapRequest) {
                return tGame('hud.seatSwap.hint');
            }
            if (isRequester) {
                return tGame('hud.seatSwap.waiting', {
                    player: resolveSeatPlayerName(pendingSeatSwapRequest.targetPlayerId),
                });
            }
            if (isTarget) {
                return tGame('hud.seatSwap.incoming', {
                    player: resolveSeatPlayerName(pendingSeatSwapRequest.requesterId),
                });
            }
            return tGame('hud.seatSwap.pendingOther', {
                requester: resolveSeatPlayerName(pendingSeatSwapRequest.requesterId),
                target: resolveSeatPlayerName(pendingSeatSwapRequest.targetPlayerId),
            });
        })();

        return ({ closePanel }: { closePanel: () => void }) => (
            <div className="space-y-3">
                <p className="text-xs text-white/70">{pendingHintText}</p>
                <div className="space-y-2">
                    {seatingOrder.map((seatPlayerId, seatIndex) => {
                        const isSelfSeat = seatPlayerId === normalizedMyPlayerId;
                        const isAiSeat = (seatControllerTypeByPlayerId[seatPlayerId] ?? 'human') !== 'human';
                        const isSeatRequester = pendingSeatSwapRequest?.requesterId === seatPlayerId;
                        const isSeatTarget = pendingSeatSwapRequest?.targetPlayerId === seatPlayerId;
                        return (
                            <button
                                key={`hud-seat-swap-seat-${seatPlayerId}`}
                                type="button"
                                disabled={isSeatSwapPending || isSelfSeat}
                                onClick={() => {
                                    dispatch(requestSeatSwapCommandType, { targetPlayerId: seatPlayerId });
                                    closePanel();
                                }}
                                className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                    isSeatRequester || isSeatTarget
                                        ? 'border-amber-400/45 bg-amber-500/12 text-amber-100'
                                        : 'border-white/12 bg-white/5 text-white/85 hover:bg-white/10'
                                } ${
                                    isSeatSwapPending || isSelfSeat
                                        ? 'cursor-default opacity-70'
                                        : ''
                                }`}
                                data-testid={`hud-seat-swap-seat-${seatPlayerId}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-white/88">
                                        {tGame('hud.seatSwap.seatNumber', { seat: seatIndex + 1 })}
                                    </span>
                                    {isAiSeat && (
                                        <span className="rounded-full border border-sky-300/45 bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                                            {tGame('hud.seatSwap.aiBadge')}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 truncate text-white/75">{resolveSeatPlayerName(seatPlayerId)}</div>
                            </button>
                        );
                    })}
                </div>

                {seatSwapMode === 'request' && isTarget && (
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (respondSeatSwapCommandType) {
                                    dispatch(respondSeatSwapCommandType, { approve: true });
                                }
                                closePanel();
                            }}
                            className="rounded-md border border-emerald-500/45 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 transition-colors hover:bg-emerald-500/28"
                            data-testid="hud-seat-swap-approve"
                        >
                            {tGame('hud.seatSwap.approve')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (respondSeatSwapCommandType) {
                                    dispatch(respondSeatSwapCommandType, { approve: false });
                                }
                                closePanel();
                            }}
                            className="rounded-md border border-rose-500/45 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 transition-colors hover:bg-rose-500/28"
                            data-testid="hud-seat-swap-reject"
                        >
                            {tGame('hud.seatSwap.reject')}
                        </button>
                    </div>
                )}

                {seatSwapMode === 'request' && isRequester && (
                    <button
                        type="button"
                        onClick={() => {
                            if (cancelSeatSwapCommandType) {
                                dispatch(cancelSeatSwapCommandType, {});
                            }
                            closePanel();
                        }}
                        className="w-full rounded-md border border-white/18 bg-white/8 px-3 py-2 text-xs font-bold text-white/85 transition-colors hover:bg-white/14"
                        data-testid="hud-seat-swap-cancel"
                    >
                        {tGame('hud.seatSwap.cancel')}
                    </button>
                )}
            </div>
        );
    }, [dispatch, normalizedMyPlayerId, seatNameByPlayerId, seatSwapContext, tGame]);

    return {
        showSeatSwap: Boolean(seatSwapContext),
        seatSwapActionActive: Boolean(seatSwapContext?.pendingSeatSwapRequest),
        seatSwapContent,
    };
}
