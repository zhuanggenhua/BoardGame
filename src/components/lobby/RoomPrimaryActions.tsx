import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import type { ActiveMatchInfo } from './roomActions';

export interface RoomPrimaryActionsProps {
    compact?: boolean;
    activeMatch: ActiveMatchInfo | null;
    isActionLoading: boolean;
    onJoinRoom: (matchID: string, gameName?: string) => void;
    onAction: (matchID: string, playerID: string, credentials: string, isHost: boolean) => void;
    onForceExitLocal: (matchID: string) => void;
    onOpenCreateRoom: () => void;
}

/** The same room commands can be placed in the game header or legacy list. */
export function RoomPrimaryActions({ compact = false, activeMatch, isActionLoading, onJoinRoom, onAction, onForceExitLocal, onOpenCreateRoom }: RoomPrimaryActionsProps) {
    const { t } = useTranslation('lobby');
    return (
<div className="mb-6 space-y-3">
                {activeMatch && (
                    <div className={compact ? "platform-active-room-primary" : "w-full py-3 px-4 bg-parchment-base-bg/50 border border-parchment-card-border/50 rounded-[4px] flex flex-col items-center gap-3"}>
                        {!compact && <span className="text-xs text-parchment-light-text font-bold uppercase tracking-wider">
                            {t('activeMatch.notice')}
                        </span>}
                        <div className="flex flex-wrap justify-center gap-2">
                            <button
                                onClick={() => onJoinRoom(activeMatch.matchID, activeMatch.gameName)}
                                className="px-4 py-1.5 bg-parchment-card-border text-parchment-card-bg text-xs font-bold rounded hover:bg-parchment-brown transition-colors cursor-pointer uppercase tracking-wider"
                            >
                                {t('activeMatch.return', { id: activeMatch.matchID.slice(0, 4) })}
                            </button>
                            {activeMatch.canReconnect && activeMatch.myPlayerID && activeMatch.myCredentials && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAction(activeMatch.matchID, activeMatch.myPlayerID!, activeMatch.myCredentials!, activeMatch.isHost);
                                    }}
                                    data-action-tone={activeMatch.isHost ? 'danger' : 'warning'}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border",
                                        activeMatch.isHost
                                            ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                            : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                    )}
                                >
                                    {activeMatch.isHost ? t('actions.destroy') : t('actions.leave')}
                                </button>
                            )}
                            {!activeMatch.canReconnect && (
                                <button
                                    onClick={() => onForceExitLocal(activeMatch.matchID)}
                                    className="px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border bg-white/70 text-parchment-base-text border-parchment-card-border/60 hover:bg-white"
                                    title={t('actions.forceExitHint')}
                                >
                                    {t('actions.forceExit')}
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {!activeMatch && (
                    <button
                        onClick={onOpenCreateRoom}
                        disabled={isActionLoading}
                        data-testid="game-details-open-create-room"
                        className="w-full py-3 bg-parchment-base-text hover:bg-parchment-brown text-parchment-card-bg font-bold rounded-[4px] shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm uppercase tracking-widest"
                    >
                        {isActionLoading ? t('button.processing') : t('actions.createRoom')}
                    </button>
                )}
            </div>
    );
}
