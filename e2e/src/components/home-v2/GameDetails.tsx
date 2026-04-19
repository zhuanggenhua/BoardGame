import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type GameConfig } from '../../config/games.config';
import { getOptimizedImageUrls } from '../../core/AssetLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    claimSeat,
    clearOwnerActiveMatch,
    getOwnerActiveMatch,
    persistMatchCredentials,
    setOwnerActiveMatch,
} from '../../hooks/match/useMatchStatus';
import { readLocalMatchPreferences, writeLocalMatchPreferences } from '../../engine/ai/localMatchPreferences';
import * as matchApi from '../../services/matchApi';
import { getGuestName, getOrCreateGuestId, getOwnerKey, getOwnerType } from '../../hooks/match/ownerIdentity';
import { useLobbyMatchPresence } from '../../hooks/useLobbyMatchPresence';
import { CreateRoomModal, type RoomConfig } from '../lobby/CreateRoomModal';
import { resolveGameDisplayName, resolveGameDescription } from '../lobby/gameDetailsContent';

const HOME_V2_HOLDER_BG = getOptimizedImageUrls('/assets/common/images/home-v2/holders/1.png').webp;

const getDisplayName = (game: GameConfig, t: any, i18n: any) => {
    if (game.isUgc && (game as any).name) return game.titleKey || (game as any).name || game.id;
    if (typeof i18n?.getFixedT === 'function') {
        const fixedT = i18n.getFixedT('zh-CN', ['lobby', 'common']);
        return resolveGameDisplayName(game, fixedT);
    }
    return resolveGameDisplayName(game, t);
};

const getDescription = (game: GameConfig, t: any, i18n: any) => {
    if (game.isUgc && (game as any).description) return (game as any).description;
    if (typeof i18n?.getFixedT === 'function') {
        const fixedT = i18n.getFixedT('zh-CN', ['lobby', 'common']);
        return resolveGameDescription(game, fixedT);
    }
    return resolveGameDescription(game, t);
};

function getRoomTitle(matchID: string, roomName?: string) {
    return roomName?.trim() || `房间 ${matchID.slice(0, 4).toUpperCase()}`;
}

function showLockedRoomToast(toast: ReturnType<typeof useToast>) {
    toast.warning('密码房间暂时请从原大厅进入。');
}

function getRoomSeatLine(
    match: {
        players: Array<{ name?: string }>;
        totalSeats?: number;
    },
    t: any,
) {
    const totalSeats = Math.max(match.totalSeats ?? 0, match.players.length);
    const playerCount = match.players.filter((player) => Boolean(player.name)).length;
    const names = match.players
        .map((player) => player.name?.trim())
        .filter(Boolean)
        .slice(0, 3);

    const namesText = names.length > 0 ? names.join(' / ') : '等待玩家进入';
    const seatsText = totalSeats > 0
        ? `${playerCount}/${totalSeats} ${t('common:game_details.people')}`
        : `${playerCount} ${t('common:game_details.people')}`;

    return `${seatsText} · ${namesText}`;
}

function RoomLedgerSkeleton() {
    return (
        <div className="space-y-[2.4%]">
            {Array.from({ length: 2 }, (_, index) => (
                <div
                    key={`room-skeleton-${index}`}
                    className="rounded-[12px] border border-[#d9b287]/45 bg-[rgba(255,248,236,0.22)] px-[4.8%] py-[4.2%]"
                >
                    <div className="mb-[3.2%] h-[11px] w-[48%] rounded-full bg-[#ebd2af]/75" />
                    <div className="h-[9px] w-[74%] rounded-full bg-[#edd9bc]/55" />
                </div>
            ))}
        </div>
    );
}

function getDescriptionExcerpt(description: string) {
    const normalized = description.replace(/\s+/g, ' ').trim();
    const firstSentence = normalized.split(/(?<=[。！？!?.])/)[0]?.trim();
    if (firstSentence && firstSentence.length >= 12) {
        return firstSentence;
    }
    return normalized.slice(0, 58).trimEnd() + (normalized.length > 58 ? '…' : '');
}

function BookFrameButton({
    children,
    className,
    size = 'regular',
    onClick,
    disabled = false,
}: {
    children: React.ReactNode;
    className?: string;
    size?: 'regular' | 'compact' | 'tiny';
    onClick?: () => void;
    disabled?: boolean;
}) {
    const sizeClassName = size === 'regular'
        ? 'min-h-[38px] min-w-[116px] px-[20px] py-[10px] text-[clamp(11px,0.82vw,12px)]'
        : size === 'compact'
            ? 'min-h-[34px] min-w-[104px] px-[16px] py-[8px] text-[clamp(10px,0.78vw,11px)]'
            : 'min-h-[28px] min-w-[70px] px-[10px] py-[5px] text-[clamp(9px,0.7vw,10px)]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`relative inline-flex items-center justify-center bg-transparent bg-center bg-no-repeat font-bold text-[#5d3923] transition-transform duration-200 hover:-translate-y-[1px] disabled:translate-y-0 ${sizeClassName} ${className ?? ''}`}
            style={{
                backgroundImage: `url(${HOME_V2_HOLDER_BG})`,
                backgroundSize: '100% 100%',
                opacity: disabled ? 0.65 : 1,
                pointerEvents: disabled ? 'none' : 'auto',
            }}
        >
            <span className="relative z-10 [text-shadow:0_1px_0_rgba(255,249,235,0.75)]">
                {children}
            </span>
        </button>
    );
}

export interface LeftProps {
    game: GameConfig | null;
    onBack: () => void;
}

export const Left = ({ game, onBack }: LeftProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);

    if (!game) return null;

    const playerLabel = game.type === 'game' && game.playerOptions && game.playerOptions.length > 1
        ? `${Math.min(...game.playerOptions)}-${Math.max(...game.playerOptions)} ${t('common:game_details.people')}`
        : t(game.playersKey);
    const categoryLabel = game.category ? t(`common:category.${game.category}`) : null;

    return (
        <div className="pointer-events-auto flex h-full w-full min-h-0 flex-col gap-[4.2%] text-[#5b3822]">
            <div className="flex items-start justify-between gap-[10px]">
                <BookFrameButton size="tiny" className="shrink-0" onClick={onBack}>
                    ← {t('lobby:actions.backToDirectory', '返回目录')}
                </BookFrameButton>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-[1.5%]">
                <div className="mb-[2.1%] text-[clamp(8px,0.72vw,9px)] font-semibold tracking-[0.16em] text-[#8b6748]">
                    {categoryLabel ? `${categoryLabel} · ${playerLabel}` : playerLabel}
                </div>

                <h2 className="mb-[2.4%] text-[clamp(21px,2.02vw,27px)] font-bold leading-[1.02] text-[#5b3822]">
                    {getDisplayName(game, t, i18n)}
                </h2>

                <div className="mb-[3.2%] flex max-w-[92%] items-stretch gap-[12px] border-y border-[#d8b18a]/42 py-[3.6%] text-[clamp(10px,0.8vw,11px)] text-[#77563a]">
                    <div className="flex-1">
                        <div className="mb-[3px] text-[clamp(8px,0.68vw,9px)] font-semibold tracking-[0.14em] text-[#8d6747]">
                            类型
                        </div>
                        <div className="font-medium text-[#6e4a32]">{categoryLabel ?? '桌游'}</div>
                    </div>
                    <div className="w-px shrink-0 bg-[rgba(163,105,63,0.24)]" />
                    <div className="flex-1">
                        <div className="mb-[3px] text-[clamp(8px,0.68vw,9px)] font-semibold tracking-[0.14em] text-[#8d6747]">
                            建议人数
                        </div>
                        <div className="font-medium text-[#6e4a32]">{playerLabel}</div>
                    </div>
                </div>

                <div className="mb-[3.4%] h-px w-full bg-[linear-gradient(90deg,rgba(163,105,63,0.5)_0%,rgba(163,105,63,0.18)_70%,rgba(163,105,63,0)_100%)]" />

                <div className="mb-[1.8%] text-[clamp(9px,0.74vw,10px)] font-semibold tracking-[0.14em] text-[#8d6747]">
                    玩法概览
                </div>
                <p className="max-w-[92%] text-[clamp(10px,0.8vw,11px)] leading-[1.62] text-[#75573f]">
                    {getDescriptionExcerpt(getDescription(game, t, i18n))}
                </p>
            </div>
        </div>
    );
};

export interface RightProps {
    game: GameConfig | null;
}

export const Right = ({ game }: RightProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const toast = useToast();
    const gameId = game?.id ?? null;
    const { matches, hasSnapshot } = useLobbyMatchPresence({
        gameId,
        enabled: Boolean(gameId),
        requireSeen: false,
    });
    const [showCreateRoomModal, setShowCreateRoomModal] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isPreparingCreateRoom, setIsPreparingCreateRoom] = React.useState(false);
    const [initialCreateRoomPreferences, setInitialCreateRoomPreferences] = React.useState<ReturnType<typeof readLocalMatchPreferences> | null>(null);

    if (!game) return null;

    const displayName = getDisplayName(game, t, i18n);
    const playerLabel = game.type === 'game' && game.playerOptions && game.playerOptions.length > 1
        ? `${Math.min(...game.playerOptions)}-${Math.max(...game.playerOptions)} ${t('common:game_details.people')}`
        : t(game.playersKey);
    const categoryLabel = game.category ? t(`common:category.${game.category}`) : null;
    const roomPreviewItems = matches
        .slice()
        .sort((left, right) => {
            const leftPlayers = left.players.filter((player) => Boolean(player.name)).length;
            const rightPlayers = right.players.filter((player) => Boolean(player.name)).length;
            const leftSeats = Math.max(left.totalSeats ?? 0, left.players.length);
            const rightSeats = Math.max(right.totalSeats ?? 0, right.players.length);
            const leftHasSpace = leftSeats === 0 || leftPlayers < leftSeats;
            const rightHasSpace = rightSeats === 0 || rightPlayers < rightSeats;

            if (leftHasSpace !== rightHasSpace) {
                return leftHasSpace ? -1 : 1;
            }

            return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
        })
        .slice(0, 3);

    const guestId = user?.id ? undefined : getOrCreateGuestId();
    const ownerKey = getOwnerKey(user?.id, guestId);
    const guestName = getGuestName(t, guestId);

    const openCreateRoom = async () => {
        if (isPreparingCreateRoom) return;
        setIsPreparingCreateRoom(true);
        try {
            const namespace = `game-${game.id}`;
            if (!i18n.hasLoadedNamespace(namespace)) {
                await i18n.loadNamespaces(namespace);
            }
            setInitialCreateRoomPreferences(readLocalMatchPreferences(game));
            setShowCreateRoomModal(true);
        } finally {
            setIsPreparingCreateRoom(false);
        }
    };

    const navigateToMatch = (matchID: string, playerID: string, extra?: string) => {
        navigate(`/play/${game.id}/match/${matchID}?playerID=${playerID}${extra ?? ''}`);
    };

    const handleCreateRoom = async (config: RoomConfig) => {
        setIsLoading(true);
        try {
            writeLocalMatchPreferences(game, {
                numPlayers: config.numPlayers,
                seatControllers: config.seatControllers,
                setupSelections: config.setupSelections,
            });

            const setupSelections = Object.fromEntries(
                Object.entries(config.setupSelections ?? {}).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
            );

            const result = await matchApi.createMatch(
                game.id,
                {
                    numPlayers: config.numPlayers,
                    setupData: {
                        ...(config.roomName ? { roomName: config.roomName } : {}),
                        ttlSeconds: config.ttlSeconds,
                        ownerKey,
                        ownerType: getOwnerType(user?.id),
                        ...(guestId ? { guestId } : {}),
                        ...(config.password ? { password: config.password } : {}),
                        ...(Object.keys(setupSelections).length > 0 ? { setupSelections } : {}),
                        ...(config.enableAi ? { enableAi: true, seatControllers: config.seatControllers } : {}),
                    },
                },
                token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
            );

            const claimResult = await claimSeat(game.id, result.matchID, '0', {
                token: token ?? undefined,
                guestId,
                playerName: user?.username ?? guestName,
            });

            if (!claimResult.success) {
                toast.error({ kind: 'i18n', key: 'error.roomCreatedButClaimFailed', ns: 'lobby' });
                return;
            }

            setOwnerActiveMatch({
                matchID: result.matchID,
                gameName: game.id,
                ownerKey,
                ownerType: getOwnerType(user?.id),
            });

            setShowCreateRoomModal(false);
            navigateToMatch(result.matchID, '0');
        } catch (error) {
            console.error('[HomeV2Detail] 创建房间失败', error);
            toast.error({ kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async (matchID: string) => {
        setIsLoading(true);
        try {
            const summary = matches.find((item) => item.matchID === matchID);
            if (summary?.isLocked) {
                showLockedRoomToast(toast);
                return;
            }

            if (summary?.ownerKey && summary.ownerKey === ownerKey) {
                const claimResult = await claimSeat(game.id, matchID, '0', {
                    token: token ?? undefined,
                    guestId,
                    playerName: user?.username ?? guestName,
                });
                if (!claimResult.success) {
                    toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                    return;
                }
                setOwnerActiveMatch({
                    matchID,
                    gameName: game.id,
                    ownerKey,
                    ownerType: getOwnerType(user?.id),
                });
                navigateToMatch(matchID, '0');
                return;
            }

            const room = await matchApi.getMatch(game.id, matchID);
            const openSeat = [...room.players]
                .sort((a, b) => a.id - b.id)
                .find((player) => !player.name);

            if (!openSeat) {
                navigate(`/play/${game.id}/match/${matchID}?spectate=1`);
                return;
            }

            const joinResult = await matchApi.joinMatch(game.id, matchID, {
                playerID: String(openSeat.id),
                playerName: user?.username ?? guestName,
            });

            persistMatchCredentials(matchID, {
                matchID,
                playerID: String(openSeat.id),
                credentials: joinResult.playerCredentials,
                gameName: game.id,
                playerName: user?.username ?? guestName,
            });

            const ownerActive = getOwnerActiveMatch();
            if (ownerActive?.matchID && ownerActive.matchID !== matchID) {
                clearOwnerActiveMatch(ownerActive.matchID);
            }

            navigateToMatch(matchID, String(openSeat.id));
        } catch (error) {
            console.error('[HomeV2Detail] 加入房间失败', error);
            toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
        } finally {
            setIsLoading(false);
        }
    };

    const hasVisibleRooms = roomPreviewItems.length > 0;

    return (
        <div className="pointer-events-auto flex h-full w-full min-h-0 flex-col text-[#5b3822]">
            <div className="mb-[2%] flex items-end justify-between gap-[10px]">
                <div className="text-[clamp(19px,1.84vw,24px)] font-bold leading-[1.04] text-[#5b3822]">
                    房间簿
                </div>
                {hasSnapshot ? (
                    <div className="shrink-0 text-[clamp(9px,0.74vw,10px)] font-medium text-[#8a6444]">
                        {matches.length} 间
                    </div>
                ) : null}
            </div>

            <div className="mb-[2.2%] h-px w-full bg-[linear-gradient(90deg,rgba(163,105,63,0.5)_0%,rgba(163,105,63,0.18)_70%,rgba(163,105,63,0)_100%)]" />

            <div className="min-h-0 flex-1 rounded-[16px] border border-[#d9b287]/44 bg-[linear-gradient(180deg,rgba(255,248,238,0.28)_0%,rgba(248,232,210,0.12)_100%)] px-[5.4%] py-[4.6%] shadow-[inset_0_1px_0_rgba(255,252,245,0.45)]">
                <div className="flex h-full min-h-0 flex-col">
                    <div className="min-h-0 flex-1">
                        {!hasSnapshot ? (
                            <div className="h-full">
                                <RoomLedgerSkeleton />
                            </div>
                        ) : !hasVisibleRooms ? (
                            <div className="flex h-full min-h-[0] flex-col justify-center border-y border-dashed border-[#d8b38a]/55 px-[2%] text-center">
                                <div className="mb-[1.8%] text-[clamp(16px,1.3vw,18px)] font-semibold text-[#6f4b32]">
                                    还没有公开房间
                                </div>
                                <p className="mx-auto max-w-[88%] text-[clamp(10px,0.8vw,11px)] leading-[1.6] text-[#84644a]">
                                    先开一局，书页里就会出现可加入的对局记录。
                                </p>
                            </div>
                        ) : (
                            <div className="custom-scrollbar h-full overflow-y-auto pr-[0.4%]">
                                <div className="divide-y divide-[rgba(163,105,63,0.16)] border-y border-[rgba(163,105,63,0.16)]">
                                    {roomPreviewItems.map((room) => {
                                        const playerCount = room.players.filter((player) => Boolean(player.name)).length;
                                        const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
                                        const isFull = totalSeats > 0 && playerCount >= totalSeats;
                                        const actionLabel = room.isLocked ? '加密' : isFull ? '观战' : '加入';
                                        return (
                                            <article
                                                key={room.matchID}
                                                className="py-[4.6%]"
                                            >
                                                <button
                                                    type="button"
                                                    className="block w-full rounded-[10px] px-[2%] py-[1.4%] text-left transition-colors duration-200 hover:bg-[rgba(255,248,238,0.32)]"
                                                    disabled={isLoading}
                                                    onClick={() => void handleJoinRoom(room.matchID)}
                                                >
                                                    <div className="mb-[4px] flex items-start justify-between gap-[10px]">
                                                        <div className="min-w-0 pr-[4px] text-[clamp(12px,0.96vw,13px)] font-semibold leading-[1.28] text-[#603d27] [word-break:break-word]">
                                                            {getRoomTitle(room.matchID, room.roomName)}
                                                        </div>
                                                        <div className="shrink-0 text-[clamp(8px,0.66vw,9px)] font-semibold tracking-[0.14em] text-[#8a6647]">
                                                            {actionLabel}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 text-[clamp(10px,0.8vw,11px)] leading-[1.55] text-[#7a5a41]">
                                                        {getRoomSeatLine(room, t)}
                                                    </div>
                                                </button>
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-[4.2%] border-t border-[rgba(163,105,63,0.18)] pt-[4.2%]">
                        <BookFrameButton
                            className="w-full justify-center"
                            size="compact"
                            disabled={isLoading || isPreparingCreateRoom}
                            onClick={() => void openCreateRoom()}
                        >
                            {t('lobby:actions.createRoom', '创建房间')}
                        </BookFrameButton>
                    </div>
                </div>
            </div>
            <CreateRoomModal
                isOpen={showCreateRoomModal}
                onClose={() => setShowCreateRoomModal(false)}
                onConfirm={handleCreateRoom}
                gameManifest={game}
                initialPreferences={initialCreateRoomPreferences}
                isLoading={isLoading}
            />
        </div>
    );
};

export const GameDetails = {
    Left,
    Right
};
