import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { resolveRoomExpansionLabel, resolveRoomScenarioLabel, resolveRoomScenarioPendingLabel, type RoomItem, type ActiveMatchInfo } from './roomActions';
import type { GameManifestEntry } from '../../shared/gameManifest.types';

interface RoomListProps {
    roomItems: RoomItem[];
    gameManifest?: GameManifestEntry | null;
    gameTranslationNamespace?: string;
    activeMatch: ActiveMatchInfo | null;
    isActionLoading: boolean;
    isLobbyLoading: boolean;
    onJoinRoom: (matchID: string, gameName?: string) => void;
    onJoinRequest: (matchID: string, gameName?: string) => void;
    onAction: (matchID: string, playerID: string, credentials: string, isHost: boolean) => void;
    onForceExitLocal: (matchID: string) => void;
    onOpenCreateRoom: () => void;
    onSpectate: (matchID: string) => void;
}

export const RoomList = ({
    roomItems,
    gameManifest,
    gameTranslationNamespace,
    activeMatch,
    isActionLoading,
    isLobbyLoading,
    onJoinRoom,
    onJoinRequest,
    onAction,
    onForceExitLocal,
    onOpenCreateRoom,
    onSpectate,
}: RoomListProps) => {
    const { t } = useTranslation(gameTranslationNamespace ? ['lobby', gameTranslationNamespace] : ['lobby']);

    return (
        <>
            {/* 创建操作 */}
            <div className="mb-6 space-y-3">
                {activeMatch && (
                    <div className="w-full py-3 px-4 bg-parchment-base-bg/50 border border-parchment-card-border/50 rounded-[4px] flex flex-col items-center gap-3">
                        <span className="text-xs text-parchment-light-text font-bold uppercase tracking-wider">
                            {t('activeMatch.notice')}
                        </span>
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

            {/* 房间列表 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {isLobbyLoading ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex h-40 flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed border-parchment-card-border/30 bg-parchment-base-bg/35"
                    >
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-parchment-brown/20 border-t-parchment-brown" />
                        <p className="text-xs italic tracking-wider text-parchment-light-text">
                            {t('rooms.loading')}
                        </p>
                    </div>
                ) : roomItems.length === 0 ? (
                    <div className="text-center text-parchment-light-text py-10 italic text-sm border border-dashed border-parchment-card-border/30 rounded-[4px]">
                        {t('rooms.empty')}
                    </div>
                ) : (
                    roomItems.map((room) => (
                        <div
                            key={room.matchID}
                            data-testid={`room-list-item-${room.matchID}`}
                            className={clsx(
                                "flex items-center justify-between p-3 rounded-[4px] border transition-colors",
                                room.isMyRoom
                                    ? "border-parchment-card-border bg-parchment-base-bg/50"
                                    : "border-parchment-card-border/30 bg-parchment-card-bg hover:bg-parchment-base-bg/30"
                            )}
                        >
                            <div>
                                {(() => {
                                    const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
                                    const seatLabels = Array.from({ length: totalSeats }, (_, index) => {
                                        const seatPlayer = room.players.find(player => player.id === index);
                                        return seatPlayer?.name || t('rooms.emptySlot');
                                    });
                                    const baseTitle = room.roomName || t('rooms.matchTitle', { id: room.matchID.slice(0, 4) });
                                    const titleWithCount = totalSeats > 0
                                        ? `${baseTitle} (${room.playerCount}/${totalSeats})`
                                        : baseTitle;

                                    return (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-parchment-base-text text-sm">
                                                    {titleWithCount}
                                                </span>
                                                {room.isLocked && (
                                                    <svg className="w-3.5 h-3.5 text-parchment-light-text opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                    </svg>
                                                )}
                                                {room.isMyRoom && (
                                                    <span className="text-[8px] bg-parchment-card-border text-parchment-card-bg px-1.5 py-0.5 rounded uppercase font-bold">
                                                        {t('rooms.mine')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-parchment-light-text mt-0.5">
                                                {seatLabels.join(t('rooms.seatSeparator'))}
                                            </div>
                                            {room.publicSetupSummary?.enabledExpansions && room.publicSetupSummary.enabledExpansions.length > 0 && (
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-parchment-light-text/85">
                                                        {t('rooms.enabledExpansions')}
                                                    </span>
                                                    {room.publicSetupSummary.enabledExpansions.map((expansionId) => {
                                                        const label = resolveRoomExpansionLabel(t, room.gameName, expansionId, gameManifest ?? undefined);
                                                        return (
                                                            <span
                                                                key={expansionId}
                                                                data-testid={`room-expansion-tag-${room.matchID}-${expansionId}`}
                                                                className="inline-flex min-w-[2.4rem] items-center justify-center rounded-full border border-parchment-card-border/35 bg-parchment-base-bg/60 px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] text-parchment-base-text"
                                                            >
                                                                {label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {(() => {
                                                const scenarioLabel = room.publicSetupSummary?.scenarioId
                                                    ? resolveRoomScenarioLabel(t, room.gameName, room.publicSetupSummary.scenarioId, gameManifest ?? undefined)
                                                    : resolveRoomScenarioPendingLabel(t, gameManifest ?? undefined);
                                                return scenarioLabel ? (
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-parchment-light-text/85">
                                                            {t('rooms.scenario', { defaultValue: '剧本' })}
                                                        </span>
                                                        <span
                                                            data-testid={`room-scenario-tag-${room.matchID}`}
                                                            className="inline-flex min-w-[2.4rem] items-center justify-center rounded-full border border-parchment-card-border/35 bg-parchment-base-bg/60 px-2 py-0.5 text-[9px] font-bold tracking-[0.08em] text-parchment-base-text"
                                                        >
                                                            {scenarioLabel}
                                                        </span>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="flex gap-2">
                                {room.canReconnect && room.myPlayerID && room.myCredentials && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onAction(room.matchID, room.myPlayerID!, room.myCredentials!, room.isHost);
                                        }}
                                        className={clsx(
                                            "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border",
                                            room.isHost
                                                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                                : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                        )}
                                    >
                                        {room.isHost ? t('actions.destroy') : t('actions.leave')}
                                    </button>
                                )}
                                {room.isMyRoom && !room.canReconnect && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onForceExitLocal(room.matchID);
                                        }}
                                        className="px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border bg-white/70 text-parchment-base-text border-parchment-card-border/60 hover:bg-white"
                                        title={t('actions.forceExitHint')}
                                    >
                                        {t('actions.forceExit')}
                                    </button>
                                )}

                                {/* 满员房间：显示观战按钮（眼睛图标） */}
                                {room.isFull && !room.canReconnect && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSpectate(room.matchID);
                                        }}
                                        className="p-1.5 rounded-[4px] text-parchment-light-text hover:text-parchment-base-text hover:bg-parchment-base-bg transition-all cursor-pointer border border-parchment-card-border/30"
                                        title={t('actions.spectate')}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </button>
                                )}

                                <button
                                    data-testid={`room-list-join-${room.matchID}`}
                                    onClick={() => onJoinRequest(room.matchID, room.gameName)}
                                    disabled={(room.isFull && !room.canReconnect) || (room.isEmptyRoom && !room.isOwnerRoom)}
                                    className={clsx(
                                        "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider",
                                        room.canReconnect
                                            ? "bg-[#c0a080] text-white hover:bg-[#a08060]"
                                            : (room.isFull || (room.isEmptyRoom && !room.isOwnerRoom))
                                                ? "bg-[#e5e0d0] text-[#8c7b64] cursor-not-allowed"
                                                : "bg-[#433422] text-[#fcfbf9] hover:bg-[#2b2114]"
                                    )}
                                >
                                    {room.canReconnect
                                        ? t('actions.reconnect')
                                        : room.isFull
                                            ? t('rooms.full')
                                            : t('actions.join')}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
};
