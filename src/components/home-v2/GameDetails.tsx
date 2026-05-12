import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type GameConfig } from '../../config/games.config';
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
import { PasswordField } from '../common/PasswordField';
import { OptimizedImage } from '../common/media/OptimizedImage';
import { resolveGameAuthorName, resolveGameDisplayName, resolveGameDescription } from '../lobby/gameDetailsContent';

type HomeV2Translate = TFunction<['lobby', 'common']>;
type GameConfigWithDraftMeta = GameConfig & {
    name?: string;
    description?: string;
};
type RoomFilterMode = 'all' | 'open' | 'locked' | 'full';

const getDisplayName = (game: GameConfig, t: HomeV2Translate) => {
    const draftMeta = game as GameConfigWithDraftMeta;
    if (game.isUgc && draftMeta.name) {
        return game.titleKey || draftMeta.name || game.id;
    }
    return resolveGameDisplayName(game, t);
};

function getCategoryLabel(game: GameConfig, t: HomeV2Translate) {
    return game.category ? t(`common:category.${game.category}`) : t('lobby:homeV2.details.defaultCategory');
}

function getPlayerLabel(game: GameConfig, t: HomeV2Translate) {
    return game.type === 'game' && game.playerOptions && game.playerOptions.length > 1
        ? `${Math.min(...game.playerOptions)}-${Math.max(...game.playerOptions)} ${t('common:game_details.people')}`
        : t(game.playersKey);
}

function getDetailBadgeLabels(game: GameConfig, t: HomeV2Translate) {
    const badgeLabels = [getCategoryLabel(game, t), getPlayerLabel(game, t)];
    const tagKeys = game.tags ?? [];
    const supportedTagKeys = ['card_driven', 'dice_driven', 'combat', 'tactical', 'casual', 'ugc'];

    for (const tagKey of supportedTagKeys) {
        if (tagKeys.includes(tagKey)) {
            badgeLabels.push(t(`common:game_tags.${tagKey}`));
        }
        if (badgeLabels.length >= 4) {
            break;
        }
    }

    return badgeLabels.filter(Boolean);
}

function getRecommendedPlayerCounts(game: GameConfig) {
    const preferred = Array.isArray(game.bestPlayers) && game.bestPlayers.length > 0
        ? game.bestPlayers
        : Array.isArray(game.playerOptions)
            ? game.playerOptions
            : [];

    return Array.from(new Set(
        preferred
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0),
    )).slice(0, 3);
}

const getDescription = (game: GameConfig, t: HomeV2Translate) => {
    const draftMeta = game as GameConfigWithDraftMeta;
    if (game.isUgc && draftMeta.description) {
        return draftMeta.description;
    }
    return resolveGameDescription(game, t);
};

function getRoomTitle(matchID: string, t: HomeV2Translate, roomName?: string) {
    return roomName?.trim() || t('lobby:homeV2.roomTitleFallback', { id: matchID.slice(0, 4).toUpperCase() });
}

function getRoomSeatLine(
    match: {
        players: Array<{ name?: string }>;
        totalSeats?: number;
    },
    t: HomeV2Translate,
) {
    const totalSeats = Math.max(match.totalSeats ?? 0, match.players.length);
    const playerCount = match.players.filter((player) => Boolean(player.name)).length;
    const names = match.players
        .map((player) => player.name?.trim())
        .filter(Boolean)
        .slice(0, 3);

    const namesText = names.length > 0 ? names.join(' / ') : t('lobby:homeV2.waitingPlayers');
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
                    className="rounded-[12px] border border-[#8e6542]/35 bg-[rgba(100,68,44,0.14)] px-[4.8%] py-[4.2%]"
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

function normalizeUiTextForCompare(text: string) {
    return text
        .replace(/\s+/g, '')
        .replace(/[·•:：,，。.!！？、\-_/]/g, '')
        .toLowerCase();
}

function getDedupedDescriptionExcerpt(description: string, duplicateAnchors: string[]) {
    const excerpt = getDescriptionExcerpt(description);
    const normalizedExcerpt = normalizeUiTextForCompare(excerpt);
    if (!normalizedExcerpt) return excerpt;

    const hasDuplicate = duplicateAnchors.some((anchor) => {
        const normalizedAnchor = normalizeUiTextForCompare(anchor);
        return normalizedAnchor.length > 0 && normalizedExcerpt.includes(normalizedAnchor);
    });

    return hasDuplicate ? '' : excerpt;
}

function BookFrameButton({
    children,
    className,
    labelClassName,
    size = 'regular',
    onClick,
    disabled = false,
    testId,
}: {
    children: React.ReactNode;
    className?: string;
    labelClassName?: string;
    size?: 'regular' | 'compact' | 'tiny';
    onClick?: () => void;
    disabled?: boolean;
    testId?: string;
}) {
    const sizeClassName = size === 'regular'
        ? 'min-h-[42px] min-w-[132px] px-[22px] py-[11px] text-[clamp(12px,0.9vw,13px)]'
        : size === 'compact'
            ? 'min-h-[34px] min-w-[102px] px-[14px] py-[7px] text-[clamp(10px,0.76vw,11px)]'
            : 'min-h-[32px] min-w-[88px] px-[12px] py-[6px] text-[clamp(10px,0.72vw,10px)]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
            className={`relative inline-flex items-center justify-center rounded-[10px] border font-bold text-[#f4e0bc] transition-transform duration-200 hover:-translate-y-[1px] disabled:translate-y-0 ${sizeClassName} ${className ?? ''}`}
            style={{
                borderColor: 'rgba(110,72,43,0.9)',
                background: 'linear-gradient(180deg, rgba(113,76,47,0.96) 0%, rgba(83,53,32,0.98) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,238,212,0.18), 0 8px 18px rgba(69,43,24,0.16)',
                opacity: disabled ? 0.65 : 1,
                pointerEvents: disabled ? 'none' : 'auto',
            }}
        >
            <span className={`relative z-10 [text-shadow:0_1px_0_rgba(52,31,18,0.72)] ${labelClassName ?? ''}`}>
                {children}
            </span>
        </button>
    );
}

function DetailGameThumbnail({ game, title }: { game: GameConfig; title: string }) {
    const [imgFailed, setImgFailed] = React.useState(false);
    const manifestThumbnail = React.useMemo(() => {
        if (!React.isValidElement(game.thumbnail)) {
            return game.thumbnail;
        }
        return React.cloneElement(game.thumbnail);
    }, [game.thumbnail]);

    return (
        <div className="relative h-full w-full overflow-hidden rounded-[14px] border border-[#8f6642]/24 bg-[linear-gradient(180deg,_rgba(40,25,18,0.94)_0%,_rgba(20,14,11,0.96)_100%)] shadow-[0_14px_28px_rgba(63,38,20,0.12)]">
            {game.thumbnailPath && !imgFailed ? (
                <OptimizedImage
                    src={game.thumbnailPath}
                    alt={title}
                    className="absolute inset-[6%] h-[88%] w-[88%] object-contain"
                    onError={() => setImgFailed(true)}
                />
            ) : manifestThumbnail ? (
                <div className="absolute inset-[6%] flex items-center justify-center overflow-hidden rounded-[10px]">
                    <div className="h-full w-full [&>*]:h-full [&>*]:w-full [&>*]:object-contain">
                        {manifestThumbnail}
                    </div>
                </div>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-[#f2d19a]">
                    <span className="text-[clamp(24px,1.6vw,32px)] font-semibold leading-none">
                        {game.icon || '·'}
                    </span>
                </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08)_0%,_rgba(255,255,255,0)_34%,_rgba(0,0,0,0.18)_100%)]" />
        </div>
    );
}

function getRoomStateSummary(
    room: {
        isLocked?: boolean;
        totalSeats?: number;
        players: Array<{ name?: string }>;
    },
    t: HomeV2Translate,
) {
    const playerCount = room.players.filter((player) => Boolean(player.name)).length;
    const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
    const isFull = totalSeats > 0 && playerCount >= totalSeats;

    if (room.isLocked) {
        return { key: 'locked' as const, label: t('lobby:homeV2.lockedRoomLabel') };
    }
    if (isFull) {
        return { key: 'full' as const, label: t('lobby:homeV2.detailFilters.full') };
    }
    return { key: 'open' as const, label: t('lobby:homeV2.detailFilters.open') };
}

function getRoomSearchHaystack(
    room: {
        roomName?: string;
        matchID: string;
        players: Array<{ name?: string }>;
    },
    fallbackTitle: string,
) {
    return [
        fallbackTitle,
        room.roomName ?? '',
        room.matchID,
        ...room.players.map((player) => player.name ?? ''),
    ].join(' ').toLowerCase();
}

function getRoomHeaderMetrics(matches: Array<{
    isLocked?: boolean;
    totalSeats?: number;
    players: Array<{ name?: string }>;
}>) {
    return matches.reduce((accumulator, room) => {
        const playerCount = room.players.filter((player) => Boolean(player.name)).length;
        const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
        const isFull = totalSeats > 0 && playerCount >= totalSeats;

        accumulator.players += playerCount;
        if (room.isLocked) {
            accumulator.locked += 1;
        }
        if (!isFull) {
            accumulator.open += 1;
        }
        return accumulator;
    }, {
        players: 0,
        locked: 0,
        open: 0,
    });
}

export interface LeftProps {
    game: GameConfig | null;
    onBack: () => void;
}

export const Left = ({ game, onBack }: LeftProps) => {
    const { t } = useTranslation(['lobby', 'common']);
    const navigate = useNavigate();

    if (!game) return null;

    const displayName = getDisplayName(game, t);
    const categoryLabel = getCategoryLabel(game, t);
    const playerLabel = getPlayerLabel(game, t);
    const detailBadges = getDetailBadgeLabels(game, t);
    const recommendedPlayerCounts = getRecommendedPlayerCounts(game);
    const hasRealAuthorName = Boolean(game.authorName?.trim());
    const gameAuthorName = resolveGameAuthorName(game);
    const description = getDescription(game, t).trim();
    const descriptionExcerpt = getDedupedDescriptionExcerpt(description, [
        displayName,
        categoryLabel,
        playerLabel,
    ]);
    const editorialParagraphs = description
        .split(/\n+/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .slice(0, 2);
    const leadParagraph = editorialParagraphs[0] || descriptionExcerpt;
    const secondaryParagraph = editorialParagraphs[1] || '';

    const handleTutorial = () => {
        navigate(`/play/${game.id}/tutorial`);
    };

    return (
        <div className="pointer-events-auto flex h-full w-full min-h-0 flex-col text-[#5b3822]">
            <div className="flex items-start justify-between gap-[10px] pb-[2.2%]">
                <BookFrameButton size="tiny" className="shrink-0 !rounded-full px-[14px]" onClick={onBack}>
                    ← {t('lobby:actions.backToDirectory', '返回目录')}
                </BookFrameButton>
            </div>

            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-[1.2%]">
                <div className="mx-auto w-full max-w-[94%]">
                    <div className="mx-auto h-[clamp(138px,10.8vw,170px)] w-[clamp(138px,10.8vw,170px)]">
                        <DetailGameThumbnail game={game} title={displayName} />
                    </div>
                    <div className="mt-[3.6%] border-b border-[rgba(138,100,68,0.18)] pb-[3.6%] text-center">
                        <div className="mb-[1.8%] text-[clamp(10px,0.78vw,11px)] font-semibold uppercase tracking-[0.24em] text-[#8b694b]">
                            {categoryLabel}
                        </div>
                        <h2 className="text-[clamp(31px,2.36vw,37px)] font-bold leading-[1.04] tracking-[0.01em] text-[#56321f] [text-wrap:balance]">
                            {displayName}
                        </h2>
                        <div className="mt-[2.8%] flex flex-wrap justify-center gap-[5px] text-[#6e4a32]">
                            {detailBadges.map((badgeLabel, index) => (
                                <span
                                    key={`${badgeLabel}-${index}`}
                                    data-testid="home-v2-detail-meta-tag"
                                    className="inline-flex items-center whitespace-nowrap rounded-full border border-[#c3a07a]/40 bg-[rgba(244,230,206,0.26)] px-[8px] py-[2px] text-[clamp(7px,0.58vw,8px)] font-semibold leading-none"
                                >
                                    {badgeLabel}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {leadParagraph ? (
                    <div className="mx-auto mt-[3.6%] max-w-[84%] text-[#6d4b33]">
                        <p className="text-center text-[clamp(11px,0.9vw,13px)] leading-[1.74] text-[#6d4b33]">
                            {leadParagraph}
                        </p>
                        {secondaryParagraph ? (
                            <p className="mt-[2.8%] text-center text-[clamp(10px,0.8vw,12px)] leading-[1.7] text-[#7a5a41]">
                                {secondaryParagraph}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <div className="mx-auto mt-[4.4%] max-w-[95%]">
                    <div className="flex items-center justify-center gap-[10px]">
                        {recommendedPlayerCounts.length > 0 ? recommendedPlayerCounts.map((count) => (
                            <div
                                key={`recommended-player-${count}`}
                                className="flex h-[40px] min-w-[40px] items-center justify-center rounded-[10px] border border-[#8b6544]/28 bg-[linear-gradient(180deg,_rgba(102,67,41,0.96)_0%,_rgba(75,49,30,0.98)_100%)] px-[12px] text-[clamp(15px,1.22vw,18px)] font-bold text-[#f6e3c0] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                            >
                                {count}
                            </div>
                        )) : (
                            <div className="rounded-[10px] border border-[rgba(146,103,67,0.2)] bg-[rgba(247,238,220,0.28)] px-[14px] py-[10px] text-[clamp(11px,0.92vw,13px)] font-semibold text-[#5b3822]">
                                {playerLabel}
                            </div>
                        )}
                    </div>
                    <div className="mt-[10px] text-center text-[clamp(8px,0.62vw,9px)] font-semibold uppercase tracking-[0.18em] text-[#8b694b]">
                        {t('common:game_details.recommended_players')}
                    </div>
                </div>

                <div className="mx-auto mt-[3.8%] flex max-w-[82%] flex-col gap-[8px]">
                    <BookFrameButton
                        className="w-full min-h-[50px] shadow-[0_8px_18px_rgba(88,56,34,0.16)]"
                        labelClassName="text-[clamp(16px,1.22vw,20px)] tracking-[0.04em]"
                        onClick={handleTutorial}
                        testId="home-v2-tutorial-button"
                    >
                        {t('lobby:actions.tutorial')}
                    </BookFrameButton>
                    {hasRealAuthorName ? (
                        <div className="flex items-center justify-center">
                            <div className="inline-flex max-w-full items-center rounded-full border border-[#c6a580]/30 bg-[rgba(244,230,206,0.24)] px-[14px] py-[7px] text-[clamp(9px,0.72vw,10px)] font-medium text-[#7b5a40] shadow-[0_6px_14px_rgba(75,49,30,0.05)]">
                                {t('lobby:authorInfo.button', { author: gameAuthorName })}
                            </div>
                        </div>
                    ) : null}
                </div>
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
    const [pendingPasswordRoom, setPendingPasswordRoom] = React.useState<{ matchID: string } | null>(null);
    const [roomPasswordDraft, setRoomPasswordDraft] = React.useState('');
    const [roomSearch, setRoomSearch] = React.useState('');
    const [roomFilter, setRoomFilter] = React.useState<RoomFilterMode>('all');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isPreparingCreateRoom, setIsPreparingCreateRoom] = React.useState(false);
    const [initialCreateRoomPreferences, setInitialCreateRoomPreferences] = React.useState<ReturnType<typeof readLocalMatchPreferences> | null>(null);

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
        });

    const roomHeaderMetrics = React.useMemo(() => getRoomHeaderMetrics(roomPreviewItems), [roomPreviewItems]);
    const normalizedRoomSearch = roomSearch.trim().toLowerCase();
    const filteredRoomPreviewItems = React.useMemo(() => roomPreviewItems.filter((room) => {
        const roomState = getRoomStateSummary(room, t);
        if (roomFilter !== 'all' && roomState.key !== roomFilter) {
            return false;
        }

        if (!normalizedRoomSearch) {
            return true;
        }

        const fallbackTitle = getRoomTitle(room.matchID, t, room.roomName);
        return getRoomSearchHaystack(room, fallbackTitle).includes(normalizedRoomSearch);
    }), [normalizedRoomSearch, roomFilter, roomPreviewItems, t]);

    const guestId = user?.id ? undefined : getOrCreateGuestId();
    const ownerKey = getOwnerKey(user?.id, guestId);
    const guestName = getGuestName(t, guestId);

    const openCreateRoom = async () => {
        if (!game || isPreparingCreateRoom) return;
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
        if (!game) return;
        navigate(`/play/${game.id}/match/${matchID}?playerID=${playerID}${extra ?? ''}`);
    };

    const handleCreateRoom = async (config: RoomConfig) => {
        if (!game) return;
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

    const handleJoinRoom = async (matchID: string, password?: string) => {
        if (!game) return;
        setIsLoading(true);
        try {
            const summary = matches.find((item) => item.matchID === matchID);
            if (summary?.isLocked) {
                if (!password) {
                    setPendingPasswordRoom({ matchID });
                    setRoomPasswordDraft('');
                    return;
                }
            }

            if (!summary) {
                toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
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

            const joinData: Record<string, string> = {};
            if (password) {
                joinData.password = password;
            }
            if (guestId) {
                joinData.guestId = guestId;
            }

            const joinResult = await matchApi.joinMatch(game.id, matchID, {
                playerID: String(openSeat.id),
                playerName: user?.username ?? guestName,
                data: Object.keys(joinData).length > 0 ? joinData : undefined,
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

    const handlePasswordConfirm = (password: string) => {
        if (!pendingPasswordRoom) return;
        const { matchID } = pendingPasswordRoom;
        setPendingPasswordRoom(null);
        void handleJoinRoom(matchID, password);
    };

    if (!game) return null;

    const hasVisibleRooms = filteredRoomPreviewItems.length > 0;
    const filterOptions: Array<{ id: RoomFilterMode; label: string }> = [
        { id: 'all', label: t('lobby:homeV2.detailFilters.all') },
        { id: 'open', label: t('lobby:homeV2.detailFilters.open') },
        { id: 'locked', label: t('lobby:homeV2.detailFilters.locked') },
        { id: 'full', label: t('lobby:homeV2.detailFilters.full') },
    ];
    const detailTabs = [
        t('lobby:homeV2.details.onlineLobbyLabel'),
        t('lobby:homeV2.detailTabs.updates', { defaultValue: '更新' }),
        t('lobby:homeV2.detailTabs.reviews', { defaultValue: '评价' }),
        t('lobby:homeV2.detailTabs.ranking', { defaultValue: '排行榜' }),
    ];

    return (
        <div className="pointer-events-auto flex h-full w-full min-h-0 flex-col text-[#5b3822]">
            <div className="flex items-end justify-between gap-[12px] border-b border-[rgba(163,105,63,0.18)] pb-[2.1%]">
                <div className="flex min-w-0 flex-wrap items-end gap-[13px]">
                    {detailTabs.map((tabLabel, index) => (
                        <div
                            key={`${tabLabel}-${index}`}
                            className={index === 0
                                ? 'relative pb-[4px] text-[clamp(17px,1.34vw,20px)] font-bold text-[#5b3822]'
                                : 'pb-[4px] text-[clamp(11px,0.9vw,13px)] font-semibold text-[#8a6444]'
                            }
                        >
                            {tabLabel}
                            {index === 0 ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute bottom-0 left-0 h-px w-full bg-[linear-gradient(90deg,rgba(122,90,55,0)_0%,rgba(122,90,55,0.95)_14%,rgba(122,90,55,0.95)_86%,rgba(122,90,55,0)_100%)]"
                                />
                            ) : null}
                        </div>
                    ))}
                </div>
                <BookFrameButton
                    className="shrink-0"
                    size="compact"
                    disabled={isLoading || isPreparingCreateRoom}
                    onClick={() => void openCreateRoom()}
                    testId="home-v2-create-room-button"
                >
                    {t('lobby:actions.createRoom', '创建房间')}
                </BookFrameButton>
            </div>

            <div className="mt-[2.4%] flex items-center gap-[10px]">
                <label className="relative min-w-0 flex-1">
                    <input
                        type="text"
                        value={roomSearch}
                        onChange={(event) => setRoomSearch(event.target.value)}
                        placeholder={t('lobby:homeV2.detailSearchPlaceholder')}
                        className="h-[34px] w-full rounded-[9px] border border-[#b18962]/28 bg-[rgba(247,238,220,0.34)] px-[13px] pr-[34px] text-[clamp(11px,0.84vw,12px)] text-[#5f3b25] outline-none transition-colors placeholder:text-[#9a7c5d] focus:border-[#8a6444]"
                    />
                    <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-[14px] text-[#896240]">
                        ⌕
                    </span>
                </label>
            </div>

            <div className="mt-[1.8%] flex items-center justify-between gap-[12px]">
                <div className="flex flex-wrap items-center gap-[6px]">
                    {filterOptions.map((option) => {
                        const active = roomFilter === option.id;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                className={`rounded-full border px-[8px] py-[2px] text-[clamp(8px,0.64vw,9px)] font-semibold transition-colors ${
                                    active
                                        ? 'border-[#8f6642]/45 bg-[rgba(117,79,49,0.08)] text-[#5f3b25]'
                                        : 'border-[#c7ab84]/26 bg-[rgba(247,238,220,0.16)] text-[#8a6444]'
                                }`}
                                onClick={() => setRoomFilter(option.id)}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
                {hasSnapshot ? (
                    <div className="shrink-0 text-[clamp(10px,0.78vw,11px)] font-medium text-[#8a6444]">
                        {t('lobby:homeV2.roomCount', { count: roomPreviewItems.length })}
                    </div>
                ) : null}
            </div>

            <div className="mt-[2.2%] flex min-h-0 flex-1 flex-col px-[1%]">
                <div className="grid grid-cols-[minmax(0,2.1fr)_56px_62px_74px] items-center gap-[10px] border-b border-[rgba(163,105,63,0.18)] pb-[1.8%] text-[clamp(8px,0.66vw,9px)] font-semibold uppercase tracking-[0.12em] text-[#8b694b]">
                    <div>{t('lobby:homeV2.detailColumns.roomName')}</div>
                    <div className="text-center">{t('lobby:homeV2.detailColumns.players')}</div>
                    <div className="text-center">{t('lobby:homeV2.detailColumns.status')}</div>
                    <div className="text-center">{t('lobby:homeV2.detailColumns.action')}</div>
                </div>

                <div className="mt-[1.4%] min-h-0 flex-1">
                    {!hasSnapshot ? (
                        <RoomLedgerSkeleton />
                    ) : !hasVisibleRooms ? (
                        <div className="flex min-h-[164px] flex-col items-center justify-center px-[3%] text-center">
                            <div className="text-[clamp(14px,1.1vw,16px)] font-semibold text-[#6f4b32]">
                                {normalizedRoomSearch || roomFilter !== 'all'
                                    ? t('lobby:homeV2.detailNoMatchTitle')
                                    : t('lobby:homeV2.emptyRoomTitle')}
                            </div>
                            <div className="mt-[8px] text-[clamp(10px,0.8vw,11px)] leading-[1.6] text-[#8a6444]">
                                {normalizedRoomSearch || roomFilter !== 'all'
                                    ? t('lobby:homeV2.detailNoMatchDescription')
                                    : t('lobby:homeV2.emptyRoomDescription')}
                            </div>
                        </div>
                    ) : (
                        <div className="custom-scrollbar h-full overflow-y-auto pr-[2px]">
                            <div className="space-y-[6px]">
                                {filteredRoomPreviewItems.map((room) => {
                                    const playerCount = room.players.filter((player) => Boolean(player.name)).length;
                                    const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
                                    const roomState = getRoomStateSummary(room, t);
                                    const actionLabel = roomState.key === 'locked'
                                        ? t('lobby:homeV2.lockedRoomLabel')
                                        : roomState.key === 'full'
                                            ? t('lobby:actions.spectate')
                                            : t('lobby:actions.join');

                                    return (
                                        <article
                                            key={room.matchID}
                                            className="border-b border-[rgba(163,105,63,0.1)] pb-[3px] last:border-b-0 last:pb-0"
                                        >
                                            <button
                                                type="button"
                                                className="group grid w-full grid-cols-[minmax(0,2.1fr)_56px_62px_74px] items-center gap-[10px] rounded-[10px] px-[2px] py-[6px] text-left transition-colors duration-200 hover:bg-[rgba(127,88,56,0.05)]"
                                                disabled={isLoading}
                                                onClick={() => void handleJoinRoom(room.matchID)}
                                            >
                                                <div className="flex min-w-0 items-center gap-[8px]">
                                                    <div className="h-[40px] w-[40px] shrink-0 rounded-[8px] border border-[#8f6642]/16 bg-[rgba(255,255,255,0.04)]">
                                                        <DetailGameThumbnail game={game} title={getRoomTitle(room.matchID, t, room.roomName)} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-[clamp(11px,0.88vw,12px)] font-semibold leading-[1.24] text-[#603d27]">
                                                            {getRoomTitle(room.matchID, t, room.roomName)}
                                                        </div>
                                                        <div className="mt-[1px] truncate text-[clamp(9px,0.72vw,10px)] leading-[1.35] text-[#7a5a41]">
                                                            {getRoomSeatLine(room, t)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-center text-[clamp(9px,0.7vw,10px)] font-semibold text-[#67412a]">
                                                    {playerCount}/{totalSeats || playerCount}
                                                </div>
                                                <div className="text-center">
                                                    <span className={`inline-flex min-w-[42px] items-center justify-center rounded-full border px-[5px] py-[2px] text-[7px] font-semibold leading-none ${
                                                        roomState.key === 'locked'
                                                            ? 'border-[#9b774f]/30 bg-[rgba(167,132,90,0.1)] text-[#6f4b32]'
                                                            : roomState.key === 'full'
                                                                ? 'border-[#b88a68]/28 bg-[rgba(175,122,73,0.08)] text-[#845236]'
                                                                : 'border-[#8a6b4f]/26 bg-[rgba(117,79,49,0.08)] text-[#5d3923]'
                                                    }`}>
                                                        {roomState.label}
                                                    </span>
                                                </div>
                                                <div className="text-center">
                                                    <span
                                                        data-testid="home-v2-room-action-tag"
                                                        className="inline-flex min-w-[56px] items-center justify-center rounded-[7px] border border-[#5f3d26]/18 bg-[linear-gradient(180deg,_rgba(112,76,48,0.92)_0%,_rgba(81,53,32,0.96)_100%)] px-[8px] py-[6px] text-[clamp(8px,0.64vw,9px)] font-semibold text-[#f4e2c2] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                                                    >
                                                        {actionLabel}
                                                    </span>
                                                </div>
                                            </button>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {hasSnapshot ? (
                    <div className="mt-[1.6%] flex items-center justify-between border-t border-[rgba(163,105,63,0.12)] pt-[1.6%] text-[clamp(8px,0.64vw,9px)] text-[#8b694b]">
                        <div>{t('lobby:homeV2.waitingPlayers')}</div>
                        <div>
                            {t('lobby:homeV2.roomCount', { count: filteredRoomPreviewItems.length })}
                            {' · '}
                            {t('common:game_details.people')}: {roomHeaderMetrics.players}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mt-[3.4%] flex items-center justify-between gap-[10px] border-t border-[rgba(163,105,63,0.18)] pt-[3.2%] text-[clamp(9px,0.72vw,10px)] text-[#8a6444]">
                <div>
                    {t('lobby:homeV2.roomCount', { count: roomPreviewItems.length })} · {t('common:game_details.people')} {roomHeaderMetrics.players}
                </div>
                <div>
                    {t('lobby:homeV2.detailOpenSummary', { open: roomHeaderMetrics.open, locked: roomHeaderMetrics.locked })}
                </div>
            </div>

            {pendingPasswordRoom ? (
                <div
                    data-testid="home-v2-room-password-panel"
                    className="mt-[3.2%] rounded-[10px] border border-[#9d724f]/28 px-[4.4%] py-[3.8%]"
                >
                    <div className="text-[clamp(10px,0.76vw,11px)] font-semibold text-[#6e4a32]">
                        {t('lobby:password.modalTitle')}
                    </div>
                    <div className="mt-[2.4%]">
                        <PasswordField
                            data-testid="home-v2-room-password-input"
                            name="homeV2RoomPassword"
                            value={roomPasswordDraft}
                            onChange={(event) => setRoomPasswordDraft(event.target.value)}
                            placeholder={t('lobby:password.placeholder')}
                            autoComplete="new-password"
                            className="w-full rounded-[6px] border border-[#9d724f]/32 bg-transparent px-[10px] py-[8px] pr-[38px] text-[clamp(11px,0.9vw,13px)] text-[#5f3b25] placeholder:text-[clamp(10px,0.78vw,12px)] outline-none focus:border-[#8a6444]"
                            toggleButtonTestId="home-v2-room-password-toggle"
                            toggleButtonClassName="text-[#8a6444] hover:text-[#5f3b25]"
                        />
                    </div>
                    <div className="mt-[3%] flex items-center justify-end gap-[8px]">
                        <BookFrameButton
                            size="tiny"
                            onClick={() => {
                                setPendingPasswordRoom(null);
                                setRoomPasswordDraft('');
                            }}
                            testId="home-v2-room-password-cancel"
                        >
                            {t('common:button.cancel')}
                        </BookFrameButton>
                        <BookFrameButton
                            size="tiny"
                            onClick={() => handlePasswordConfirm(roomPasswordDraft.trim())}
                            disabled={!roomPasswordDraft.trim() || isLoading}
                            testId="home-v2-room-password-confirm"
                        >
                            {t('common:button.confirm')}
                        </BookFrameButton>
                    </div>
                </div>
            ) : null}
            <CreateRoomModal
                isOpen={showCreateRoomModal}
                onClose={() => setShowCreateRoomModal(false)}
                onConfirm={handleCreateRoom}
                gameManifest={game}
                initialPreferences={initialCreateRoomPreferences}
                isLoading={isLoading}
                visualStyle="home-v2"
            />
        </div>
    );
};

export { Left as GameDetailsLeft, Right as GameDetailsRight };
