import React from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search } from 'lucide-react';
import { type GameConfig } from '../../config/games.config';
import { UI_Z_INDEX } from '../../core';
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
import { fetchReviews, fetchReviewStats, type Review, type ReviewStats } from '../../api/review';
import { GAME_CHANGELOG_API_URL, GAME_SERVER_URL } from '../../config/server';
import { getGuestName, getOrCreateGuestId, getOwnerKey, getOwnerType } from '../../hooks/match/ownerIdentity';
import { useLobbyMatchPresence } from '../../hooks/useLobbyMatchPresence';
import { useHomeV2CompactLandscape } from '../../hooks/ui/useHomeV2CompactLandscape';
import { CreateRoomModal, type RoomConfig } from '../lobby/CreateRoomModal';
import { PasswordField } from '../common/PasswordField';
import { HomeV2PaperModalFrame } from '../common/overlays/HomeV2PaperModalFrame';
import {
    homeV2PaperCompactHintClassName,
    homeV2PaperCompactInputClassName,
    homeV2PaperCompactPrimaryButtonClassName,
    homeV2PaperCompactSecondaryButtonClassName,
    homeV2PaperHintClassName,
    homeV2PaperInputClassName,
    homeV2PaperPrimaryButtonClassName,
    homeV2PaperSecondaryButtonClassName,
} from '../common/overlays/homeV2PaperModalTheme';
import {
    type GameChangelogItem,
    resolveGameAuthorName,
    resolveGameDisplayName,
    resolveGameDescription,
} from '../lobby/gameDetailsContent';
import { logger } from '../../lib/logger';

type HomeV2Translate = TFunction<['lobby', 'common']>;
type GameConfigWithDraftMeta = GameConfig & {
    name?: string;
    description?: string;
};
type HomeV2DetailTab = 'lobby' | 'changelog' | 'reviews' | 'leaderboard';

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

function HomeV2PaperPanel({
    eyebrow,
    children,
    testId,
}: {
    eyebrow: string;
    children: React.ReactNode;
    testId?: string;
}) {
    return (
        <section data-testid={testId} className="flex h-full min-h-0 flex-col">
            <div className="border-b border-[rgba(105,66,37,0.38)] pb-[1.4%] text-[clamp(13px,0.92vw,15px)] font-bold tracking-[0.14em] text-[#6c4a32]">
                {eyebrow}
            </div>
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-[6px] pt-[1.6%]">
                {children}
            </div>
        </section>
    );
}

function HomeV2EmptyNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-[156px] items-center justify-center px-[10px] text-center text-[clamp(16px,1.08vw,19px)] font-semibold text-[#8a6444]">
            {children}
        </div>
    );
}

function HomeV2LeaderboardPanel({
    leaderboardData,
    error,
    t,
    compact = false,
}: {
    leaderboardData: { leaderboard: { name: string; wins: number; matches: number }[] } | null;
    error: boolean;
    t: HomeV2Translate;
    compact?: boolean;
}) {
    const entries = leaderboardData?.leaderboard ?? [];

    return (
        <HomeV2PaperPanel eyebrow={t('lobby:leaderboard.title', { defaultValue: '胜场排行' })}>
            {error ? (
                <HomeV2EmptyNote>{t('lobby:leaderboard.error', { defaultValue: '排行榜加载失败' })}</HomeV2EmptyNote>
            ) : !leaderboardData ? (
                <HomeV2EmptyNote>{t('lobby:leaderboard.loading', { defaultValue: '加载排行榜中...' })}</HomeV2EmptyNote>
            ) : entries.length === 0 ? (
                <HomeV2EmptyNote>{t('lobby:leaderboard.empty', { defaultValue: '暂无数据' })}</HomeV2EmptyNote>
            ) : (
                <div className="border-b border-[rgba(105,66,37,0.28)]">
                    {entries.map((player, index) => {
                        const rankLabel = String(index + 1);
                        const rankTheme = index === 0
                            ? 'border-[#c39a4d] bg-[linear-gradient(180deg,_rgba(244,216,154,0.98)_0%,_rgba(191,142,58,0.98)_100%)] text-[#fff4d5] shadow-[0_2px_5px_rgba(103,69,26,0.18)]'
                            : index === 1
                                ? 'border-[#b0b4bf] bg-[linear-gradient(180deg,_rgba(235,238,246,0.98)_0%,_rgba(170,175,186,0.98)_100%)] text-[#fbfcff] shadow-[0_2px_5px_rgba(92,94,104,0.14)]'
                                : index === 2
                                    ? 'border-[#b77d4d] bg-[linear-gradient(180deg,_rgba(233,188,149,0.98)_0%,_rgba(180,117,67,0.98)_100%)] text-[#fff2e3] shadow-[0_2px_5px_rgba(104,63,31,0.15)]'
                                    : 'border-[#a5743c]/54 bg-[rgba(79,46,25,0.06)] text-[#5b351d]';
                        return (
                            <div
                                key={`${player.name}-${index}`}
                                className={`grid items-center border-t border-[rgba(105,66,37,0.28)] text-[#3f2718] ${
                                    compact
                                        ? 'min-h-[40px] grid-cols-[30px_minmax(0,1fr)_60px] gap-[5px] py-[3px]'
                                        : 'min-h-[66px] grid-cols-[66px_minmax(0,1fr)_148px] gap-[14px]'
                                }`}
                            >
                                <div className="flex justify-center">
                                    <span
                                        data-testid="home-v2-leaderboard-rank-badge"
                                        className={`inline-flex items-center justify-center rounded-[2px] border font-bold tabular-nums ${
                                            compact
                                                ? 'h-[22px] min-w-[22px] px-[3px] text-[9px]'
                                                : 'h-[34px] min-w-[34px] px-[8px] text-[clamp(18px,1.18vw,22px)]'
                                        } ${rankTheme}`}
                                    >
                                        {rankLabel}
                                    </span>
                                </div>
                                <div
                                    className={`min-w-0 font-bold text-[#3f2718] ${
                                        compact
                                            ? 'pr-[2px] text-[10px] leading-[1.08] truncate'
                                            : 'truncate pr-[12px] text-[clamp(17px,1.16vw,20px)]'
                                    }`}
                                >
                                    {player.name}
                                </div>
                                <div data-testid="home-v2-leaderboard-record" className={`justify-self-end text-right font-semibold text-[#6e4a32] ${compact ? 'text-[9.2px] leading-[1]' : 'text-[clamp(13px,0.94vw,15px)]'}`}>
                                    {compact ? (
                                        <span className="tabular-nums">
                                            {player.wins}/{player.matches}
                                        </span>
                                    ) : (
                                        t('lobby:leaderboard.record', { wins: player.wins, matches: player.matches })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </HomeV2PaperPanel>
    );
}

function HomeV2ChangelogPanel({
    items,
    loading,
    error,
    t,
}: {
    items: GameChangelogItem[];
    loading: boolean;
    error: boolean;
    t: HomeV2Translate;
}) {
    return (
        <HomeV2PaperPanel eyebrow={t('lobby:changelog.title', { defaultValue: '最近更新' })}>
            {error ? (
                <HomeV2EmptyNote>{t('lobby:changelog.error', { defaultValue: '更新日志加载失败' })}</HomeV2EmptyNote>
            ) : loading ? (
                <HomeV2EmptyNote>{t('lobby:changelog.loading', { defaultValue: '加载更新日志中...' })}</HomeV2EmptyNote>
            ) : items.length === 0 ? (
                <HomeV2EmptyNote>{t('lobby:leaderboard.changelogEmpty', { defaultValue: '暂无日志' })}</HomeV2EmptyNote>
            ) : (
                <div className="space-y-[10px]">
                    {items.map((item) => (
                        <article key={item.id} className="border-b border-[rgba(105,66,37,0.28)] pb-[14px]">
                            <div className="flex items-start justify-between gap-[18px]">
                                <h4 className="text-[clamp(18px,1.22vw,22px)] font-bold leading-tight text-[#3f2718]">{item.title}</h4>
                                <span className="shrink-0 text-[clamp(11px,0.78vw,13px)] font-semibold tracking-[0.08em] text-[#8a6444]">
                                    {item.versionLabel || item.publishedAt || item.updatedAt || item.createdAt}
                                </span>
                            </div>
                            <p className="mt-[8px] whitespace-pre-wrap text-[clamp(13px,0.94vw,15px)] leading-[1.65] text-[#5e3d27]">{item.content}</p>
                        </article>
                    ))}
                </div>
            )}
        </HomeV2PaperPanel>
    );
}

function HomeV2ReviewsPanel({
    stats,
    reviews,
    loading,
    error,
    t,
    compact = false,
}: {
    stats: ReviewStats | null;
    reviews: Review[];
    loading: boolean;
    error: boolean;
    t: HomeV2Translate;
    compact?: boolean;
}) {
    return (
        <HomeV2PaperPanel eyebrow={t('lobby:tabs.reviews', { defaultValue: '评价' })}>
            {error ? (
                <HomeV2EmptyNote>{t('lobby:homeV2.reviews.error', { defaultValue: '加载评价失败，请稍后重试' })}</HomeV2EmptyNote>
            ) : loading ? (
                <HomeV2EmptyNote>{t('common:loading', { defaultValue: '加载中...' })}</HomeV2EmptyNote>
            ) : (
                <div className={compact ? 'space-y-[8px]' : 'space-y-[14px]'}>
                    <div className={`border-y border-[rgba(105,66,37,0.28)] ${compact ? 'py-[8px]' : 'py-[14px]'}`}>
                        <div className={`flex items-end justify-between ${compact ? 'gap-[10px]' : 'gap-[20px]'}`}>
                            <div className={compact ? 'text-[21px] font-bold leading-none text-[#3f2718]' : 'text-[clamp(36px,2.4vw,46px)] font-bold leading-none text-[#3f2718]'}>
                                {stats ? `${stats.rate}%` : '--'}
                            </div>
                            <div className={compact ? 'text-right text-[8.8px] font-semibold leading-[1.1] text-[#6e4a32]' : 'text-right text-[clamp(12px,0.9vw,14px)] font-semibold text-[#6e4a32]'}>
                                {stats ? `${stats.positive}/${stats.total}` : t('lobby:homeV2.reviews.empty', { defaultValue: '暂无评论' })}
                            </div>
                        </div>
                        <div className={compact ? 'mt-[6px] h-[5px] overflow-hidden rounded-full bg-[rgba(105,66,37,0.16)]' : 'mt-[10px] h-[7px] overflow-hidden rounded-full bg-[rgba(105,66,37,0.16)]'}>
                            <div className="h-full rounded-full bg-[#315c27]" style={{ width: `${stats?.rate ?? 0}%` }} />
                        </div>
                    </div>
                    {reviews.length === 0 ? (
                        <HomeV2EmptyNote>{t('lobby:homeV2.reviews.empty', { defaultValue: '暂无评论' })}</HomeV2EmptyNote>
                    ) : (
                        reviews.map((review) => (
                            <article key={review._id} className={`border-b border-[rgba(105,66,37,0.24)] ${compact ? 'pb-[8px]' : 'pb-[12px]'}`}>
                                <div className={`flex items-center justify-between ${compact ? 'gap-[10px]' : 'gap-[16px]'}`}>
                                    <div className={compact ? 'truncate text-[10px] font-bold text-[#3f2718]' : 'truncate text-[clamp(15px,1.06vw,18px)] font-bold text-[#3f2718]'}>{review.user.username}</div>
                                    <div className={`${compact ? 'text-[8.5px]' : 'text-[clamp(12px,0.88vw,14px)]'} shrink-0 font-semibold ${review.isPositive ? 'text-[#315c27]' : 'text-[#8a3f2a]'}`}>
                                        {review.isPositive ? '推荐' : '不推荐'}
                                    </div>
                                </div>
                                {review.content ? (
                                    <p className={compact ? 'mt-[4px] text-[8.8px] leading-[1.4] text-[#5e3d27]' : 'mt-[7px] text-[clamp(13px,0.92vw,15px)] leading-[1.55] text-[#5e3d27]'}>{review.content}</p>
                                ) : null}
                            </article>
                        ))
                    )}
                </div>
            )}
        </HomeV2PaperPanel>
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
    icon,
    labelClassName,
    size = 'regular',
    onClick,
    disabled = false,
    testId,
}: {
    children: React.ReactNode;
    className?: string;
    icon?: React.ReactNode;
    labelClassName?: string;
    size?: 'prominent' | 'regular' | 'compact' | 'tiny';
    onClick?: () => void;
    disabled?: boolean;
    testId?: string;
}) {
    const sizeClassName = size === 'prominent'
        ? 'min-h-[clamp(52px,2.7vw,60px)] min-w-[clamp(196px,9.2vw,232px)] px-[clamp(30px,1.9vw,42px)] py-[clamp(12px,0.72vw,15px)] text-[clamp(18px,1.16vw,21px)]'
        : size === 'regular'
            ? 'min-h-[38px] min-w-[124px] px-[20px] py-[9px] text-[clamp(12px,0.86vw,13px)]'
        : size === 'compact'
                ? 'min-h-[28px] min-w-[92px] px-[10px] py-[4px] text-[8.8px]'
                : 'min-h-[24px] min-w-[74px] px-[9px] py-[3px] text-[clamp(8.5px,0.62vw,9.5px)]';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
            className={`relative inline-flex items-center justify-center rounded-[2px] border font-bold text-[#f5dfb9] transition-colors duration-150 hover:text-[#fff1ce] disabled:translate-y-0 ${sizeClassName} ${className ?? ''}`}
            style={{
                borderColor: 'rgba(174, 122, 60, 0.84)',
                background: 'linear-gradient(180deg, rgba(79, 46, 25, 0.98) 0%, rgba(52, 30, 17, 0.99) 100%)',
                boxShadow: '0 1px 2px rgba(63,38,20,0.12)',
                opacity: disabled ? 0.65 : 1,
                pointerEvents: disabled ? 'none' : 'auto',
            }}
        >
            <span className={`inline-flex items-center justify-center gap-[6px] ${labelClassName ?? ''}`}>
                {icon}
                {children}
            </span>
        </button>
    );
}

function RoomLedgerActionTag({ children, compact }: { children: React.ReactNode; compact: boolean }) {
    return (
        <span
            data-testid="home-v2-room-action-tag"
            className={`inline-flex items-center justify-center rounded-[2px] border border-[#a5743c]/78 bg-[#472916] font-bold leading-none text-[#f2dbb4] shadow-none ${
                compact ? 'min-h-[19px] min-w-[32px] px-[4px] text-[7.6px]' : 'min-h-[34px] min-w-[78px] px-[12px] text-[clamp(12px,0.88vw,14px)]'
            }`}
        >
            {children}
        </span>
    );
}

function BookLineButton({
    children,
    className,
    icon,
    onClick,
    testId,
}: {
    children: React.ReactNode;
    className?: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    testId?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            className={`inline-flex items-center justify-center gap-[7px] rounded-[2px] border border-[#a5743c]/74 bg-[#4b2c18] font-bold text-[#f1dab3] shadow-[0_1px_2px_rgba(63,38,20,0.10)] transition-colors hover:text-[#fff0ce] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/22 ${className ?? ''}`}
        >
            <span className="inline-flex items-center justify-center gap-[7px]">
                {icon}
                {children}
            </span>
        </button>
    );
}

function DetailGameThumbnail({ game, title, framed = false }: { game: GameConfig; title: string; framed?: boolean }) {
    const manifestThumbnail = React.useMemo(() => {
        if (!React.isValidElement(game.thumbnail)) {
            return game.thumbnail;
        }
        return React.cloneElement(game.thumbnail);
    }, [game.thumbnail]);

    return (
        <div
            className={`relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,_rgba(40,25,18,0.94)_0%,_rgba(20,14,11,0.96)_100%)] shadow-[0_14px_28px_rgba(63,38,20,0.12)] ${
                framed
                    ? 'rounded-[4px] border border-[#e1b86e]/88 ring-2 ring-[#3a2314]/82'
                    : 'rounded-[14px] border border-[#8f6642]/24'
            }`}
            style={framed ? {
                boxShadow: 'inset 0 0 0 1px rgba(86, 49, 24, 0.86), inset 0 0 0 4px rgba(214, 164, 83, 0.20), 0 12px 22px rgba(63,38,20,0.16)',
            } : undefined}
        >
            {manifestThumbnail ? (
                <div className={`${framed ? 'absolute inset-[3.5%] rounded-[1px]' : 'absolute inset-[6%] rounded-[10px]'} flex items-center justify-center overflow-hidden`}>
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
            {framed ? (
                <>
                    <span aria-hidden="true" className="absolute left-[4px] top-[4px] h-[15px] w-[15px] border-l-2 border-t-2 border-[#f0c979]" />
                    <span aria-hidden="true" className="absolute right-[4px] top-[4px] h-[15px] w-[15px] border-r-2 border-t-2 border-[#f0c979]" />
                    <span aria-hidden="true" className="absolute bottom-[4px] left-[4px] h-[15px] w-[15px] border-b-2 border-l-2 border-[#f0c979]" />
                    <span aria-hidden="true" className="absolute bottom-[4px] right-[4px] h-[15px] w-[15px] border-b-2 border-r-2 border-[#f0c979]" />
                </>
            ) : null}
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

export interface LeftProps {
    game: GameConfig | null;
    onBack: () => void;
}

const GameDetailsLeftContent = ({ game, onBack }: { game: GameConfig; onBack: () => void }) => {
    const { t } = useTranslation(['lobby', 'common']);
    const navigate = useNavigate();
    const isCompactLandscape = useHomeV2CompactLandscape();

    const displayName = getDisplayName(game, t);
    const categoryLabel = getCategoryLabel(game, t);
    const playerLabel = getPlayerLabel(game, t);
    const detailBadges = getDetailBadgeLabels(game, t);
    const recommendedPlayerCounts = getRecommendedPlayerCounts(game);
    const bestPlayerCountSet = new Set(
        (game.bestPlayers ?? [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0),
    );
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
        <div data-testid="home-v2-detail-left-page" className="pointer-events-auto flex h-full w-full min-h-0 flex-col text-[#3f2718]">
            <div className={`flex items-start justify-between ${isCompactLandscape ? 'pb-[3px]' : 'pb-[1.2%]'}`}>
                <button
                    type="button"
                    data-testid="home-v2-detail-back-button"
                    aria-label={t('lobby:actions.backToDirectory', '返回目录')}
                    className={`inline-flex items-center justify-center border border-transparent bg-transparent font-bold leading-none text-[#2f1b10] shadow-none transition-colors hover:text-[#6b4328] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/25 ${
                        isCompactLandscape
                            ? 'h-[28px] min-w-[86px] rounded-full text-[10.5px] tracking-[0.02em]'
                            : 'h-[54px] min-w-[156px] rounded-full text-[24px]'
                    }`}
                    onClick={onBack}
                >
                    <span aria-hidden="true" className={`${isCompactLandscape ? 'mr-[5px]' : 'mr-[10px]'} leading-none`}>←</span>
                    <span aria-hidden="true">{t('lobby:actions.backToDirectory', '返回目录')}</span>
                    <span className="sr-only">{t('lobby:actions.backToDirectory', '返回目录')}</span>
                </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pr-[1.2%]">
                <div
                    data-testid="home-v2-detail-left-hero"
                    className={`grid w-full items-start ${
                        isCompactLandscape
                            ? 'grid-cols-[78px_minmax(0,1fr)] gap-[12px]'
                            : 'grid-cols-[clamp(210px,12.4vw,294px)_minmax(0,1fr)] gap-[clamp(28px,2.1vw,42px)]'
                    }`}
                >
                    <div
                        data-testid="home-v2-detail-thumbnail"
                        className={isCompactLandscape
                            ? 'h-[78px] w-[78px] max-w-full'
                            : 'h-[clamp(210px,12.4vw,294px)] w-[clamp(210px,12.4vw,294px)]'}
                    >
                        <DetailGameThumbnail game={game} title={displayName} framed />
                    </div>
                    <div className="min-w-0">
                        <div className={`${isCompactLandscape ? 'mb-[3px] flex items-center gap-[7px] text-[9px]' : 'mb-[9px] flex items-center gap-[10px] text-[clamp(11px,0.82vw,13px)]'} font-semibold uppercase tracking-[0.18em] text-[#8b694b]`}>
                            <span aria-hidden="true" className="text-[#9a7443]">◆</span>
                            <span>{categoryLabel}</span>
                            <span aria-hidden="true" className="text-[#9a7443]">◆</span>
                        </div>
                        <h2 className={`${isCompactLandscape ? 'break-keep text-[24px] leading-[1.02]' : 'text-[clamp(42px,3.1vw,58px)] leading-[1.04] [text-wrap:balance]'} font-bold tracking-[0.01em] text-[#3f2718]`}>
                            {displayName}
                        </h2>
                        <div className={`${isCompactLandscape ? 'mt-[6px] gap-[4px]' : 'mt-[14px] gap-[7px]'} flex flex-wrap text-[#6e4a32]`}>
                            {detailBadges.map((badgeLabel, index) => (
                                <span
                                    key={`${badgeLabel}-${index}`}
                                    data-testid="home-v2-detail-meta-tag"
                                    className={`inline-flex items-center whitespace-nowrap rounded-[4px] border border-[#9d7a54]/45 bg-[rgba(244,230,206,0.32)] font-semibold leading-none text-[#4f301d] ${
                                        isCompactLandscape
                                            ? 'px-[7px] py-[4px] text-[9px]'
                                            : 'px-[13px] py-[7px] text-[clamp(11px,0.82vw,13px)]'
                                    }`}
                                >
                                    {badgeLabel}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {leadParagraph && isCompactLandscape ? (
                    <div
                        data-testid="home-v2-detail-description"
                        className="ml-[5%] mt-[7px] w-[84%] text-[#54341f]"
                    >
                        <div aria-hidden="true" className="mb-[7px] flex items-center gap-[6px] text-[#9a7443]">
                            <span className="h-px flex-1 bg-[rgba(138,100,68,0.26)]" />
                            <span className="text-[9px] leading-none">◆</span>
                            <span className="h-px flex-1 bg-[rgba(138,100,68,0.26)]" />
                        </div>
                        <div className="mb-[5px] flex items-center gap-[8px] text-[10px] font-bold tracking-[0.08em] text-[#4b2d1a]">
                            <span className="text-[#8b6a3f]">◆</span>
                            <span>{t('common:game_details.description', '游戏简介')}</span>
                            <span className="text-[#8b6a3f]">◆</span>
                        </div>
                        <p className="line-clamp-3 text-[10.5px] leading-[1.38]">
                            {leadParagraph}
                        </p>
                    </div>
                ) : null}

                {leadParagraph && !isCompactLandscape ? (
                    <div
                        data-testid="home-v2-detail-description"
                        className="mt-[1.4%] w-[68%] border-y border-[rgba(138,100,68,0.24)] py-[3.4%] text-[#54341f]"
                    >
                        <div className="mb-[3.0%] flex items-center gap-[8px] text-[clamp(14px,0.96vw,16px)] font-bold tracking-[0.08em] text-[#4b2d1a]">
                            <span className="text-[#8b6a3f]">◆</span>
                            <span>{t('common:game_details.description', '游戏简介')}</span>
                            <span className="text-[#8b6a3f]">◆</span>
                        </div>
                        <p className="text-[clamp(14px,1.02vw,16px)] leading-[1.82] text-[#54341f]">
                            {leadParagraph}
                        </p>
                        {secondaryParagraph ? (
                            <p className="mt-[2.6%] text-[clamp(13px,0.94vw,15px)] leading-[1.76] text-[#65472e]">
                                {secondaryParagraph}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <div className={`mt-auto ${isCompactLandscape ? 'pb-[4.2%]' : 'flex flex-col items-center gap-[14px] pb-[8.6%]'}`}>
                    {isCompactLandscape ? (
                        <div className="flex w-full flex-col items-center gap-[8px]">
                            <div className="flex w-full items-center justify-center text-[#4d301e]">
                                <div data-testid="home-v2-recommended-player-band" className="inline-flex items-center justify-center gap-[7px]">
                                    <span className="shrink-0 text-[8.8px] font-semibold tracking-[0.04em] text-[#6f4b32]/82">
                                        {t('common:game_details.recommended_players')}：
                                    </span>
                                    <div className="flex items-center justify-center gap-[6px]">
                                        {recommendedPlayerCounts.map((count) => {
                                            const isBest = bestPlayerCountSet.size === 0 || bestPlayerCountSet.has(count);
                                            return (
                                                <span
                                                    key={count}
                                                    data-testid="home-v2-player-count-box"
                                                    title={isBest ? t('common:game_details.best_recommendation') : undefined}
                                                    className={`flex h-[24px] w-[24px] items-center justify-center rounded-[3px] border font-bold leading-none text-[10px] ${
                                                        isBest
                                                            ? 'border-[#3f2718] bg-[#3f2718] text-[#f4e6ce] shadow-[0_2px_4px_rgba(63,38,20,0.14)]'
                                                            : 'border-[#8d6a46]/52 bg-transparent text-[#6f4b32]/76'
                                                    }`}
                                                >
                                                    {count}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <BookLineButton
                                className="min-h-[31px] w-[146px] shrink-0 px-[14px] text-[10.2px] tracking-[0.05em]"
                                icon={<BookOpen aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={2.1} />}
                                onClick={handleTutorial}
                                testId="home-v2-tutorial-button"
                            >
                                {t('lobby:actions.tutorial')}
                            </BookLineButton>
                        </div>
                    ) : null}
                    {!isCompactLandscape ? (
                        <>
                    <div
                        data-testid="home-v2-recommended-player-band"
                        className={`flex items-center justify-center text-[#4d301e] ${isCompactLandscape ? 'w-[46%]' : 'w-[52%]'}`}
                    >
                        <div className="inline-flex items-center justify-center gap-[10px]">
                            <span className={`${isCompactLandscape ? 'text-[8.6px]' : 'text-[10px]'} shrink-0 font-semibold tracking-[0.04em] text-[#6f4b32]/78`}>
                                {t('common:game_details.recommended_players')}：
                            </span>
                            <div className={`flex items-center justify-center ${isCompactLandscape ? 'gap-[6px]' : 'gap-[9px]'}`}>
                                {recommendedPlayerCounts.map((count) => {
                                    const isBest = bestPlayerCountSet.size === 0 || bestPlayerCountSet.has(count);
                                    return (
                                        <span
                                            key={count}
                                            data-testid="home-v2-player-count-box"
                                            title={isBest ? t('common:game_details.best_recommendation') : undefined}
                                            className={`flex items-center justify-center rounded-[4px] border font-bold leading-none ${
                                                isCompactLandscape ? 'h-[24px] w-[24px] text-[10px]' : 'h-[34px] w-[34px] text-[14px]'
                                            } ${
                                                isBest
                                                    ? 'border-[#3f2718] bg-[#3f2718] text-[#f4e6ce] shadow-[0_2px_4px_rgba(63,38,20,0.14)]'
                                                    : 'border-[#8d6a46]/52 bg-transparent text-[#6f4b32]/76'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <BookLineButton
                        className="min-h-[48px] w-[52%] px-[24px] text-[clamp(16px,1.08vw,20px)] tracking-[0.06em]"
                        icon={<BookOpen aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.1} />}
                        onClick={handleTutorial}
                        testId="home-v2-tutorial-button"
                    >
                        {t('lobby:actions.tutorial')}
                    </BookLineButton>
                        </>
                    ) : null}
                    {hasRealAuthorName ? (
                        <div className="flex items-center justify-center">
                            <div className={`${isCompactLandscape ? 'text-[10px]' : 'text-[clamp(9px,0.72vw,10px)]'} inline-flex max-w-full items-center rounded-full border border-[#c6a580]/30 bg-[rgba(244,230,206,0.24)] px-[14px] py-[7px] font-medium text-[#7b5a40] shadow-[0_6px_14px_rgba(75,49,30,0.05)]`}>
                                {t('lobby:authorInfo.button', { author: gameAuthorName })}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export const Left = ({ game, onBack }: LeftProps) => (
    game ? <GameDetailsLeftContent game={game} onBack={onBack} /> : null
);

export interface RightProps {
    game: GameConfig | null;
}

export const Right = ({ game }: RightProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const toast = useToast();
    const isCompactLandscape = useHomeV2CompactLandscape();
    const gameId = game?.id ?? null;
    const { matches, hasSnapshot } = useLobbyMatchPresence({
        gameId,
        enabled: Boolean(gameId),
        requireSeen: false,
    });
    const [showCreateRoomModal, setShowCreateRoomModal] = React.useState(false);
    const [pendingPasswordRoom, setPendingPasswordRoom] = React.useState<{ matchID: string; roomName?: string } | null>(null);
    const [roomPasswordDraft, setRoomPasswordDraft] = React.useState('');
    const [roomSearch, setRoomSearch] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [isPreparingCreateRoom, setIsPreparingCreateRoom] = React.useState(false);
    const [initialCreateRoomPreferences, setInitialCreateRoomPreferences] = React.useState<ReturnType<typeof readLocalMatchPreferences> | null>(null);
    const createRoomInFlightRef = React.useRef(false);
    const [activeTab, setActiveTab] = React.useState<HomeV2DetailTab>('lobby');
    const [leaderboardData, setLeaderboardData] = React.useState<{
        leaderboard: { name: string; wins: number; matches: number }[];
    } | null>(null);
    const [leaderboardError, setLeaderboardError] = React.useState(false);
    const [changelogItems, setChangelogItems] = React.useState<GameChangelogItem[]>([]);
    const [changelogLoading, setChangelogLoading] = React.useState(false);
    const [changelogError, setChangelogError] = React.useState(false);
    const [reviewStats, setReviewStats] = React.useState<ReviewStats | null>(null);
    const [reviewItems, setReviewItems] = React.useState<Review[]>([]);
    const [reviewsLoading, setReviewsLoading] = React.useState(false);
    const [reviewsError, setReviewsError] = React.useState(false);
    const passwordHintClassName = isCompactLandscape ? homeV2PaperCompactHintClassName : homeV2PaperHintClassName;
    const passwordInputClassName = isCompactLandscape ? homeV2PaperCompactInputClassName : homeV2PaperInputClassName;
    const passwordPrimaryButtonClassName = isCompactLandscape ? homeV2PaperCompactPrimaryButtonClassName : homeV2PaperPrimaryButtonClassName;
    const passwordSecondaryButtonClassName = isCompactLandscape ? homeV2PaperCompactSecondaryButtonClassName : homeV2PaperSecondaryButtonClassName;

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

    const normalizedRoomSearch = roomSearch.trim().toLowerCase();
    const filteredRoomPreviewItems = React.useMemo(() => roomPreviewItems.filter((room) => {
        if (!normalizedRoomSearch) {
            return true;
        }

        const fallbackTitle = getRoomTitle(room.matchID, t, room.roomName);
        return getRoomSearchHaystack(room, fallbackTitle).includes(normalizedRoomSearch);
    }), [normalizedRoomSearch, roomPreviewItems, t]);

    const guestId = user?.id ? undefined : getOrCreateGuestId();
    const ownerKey = getOwnerKey(user?.id, guestId);
    const guestName = getGuestName(t, guestId);

    React.useEffect(() => {
        setActiveTab('lobby');
        setRoomSearch('');
        setPendingPasswordRoom(null);
        setRoomPasswordDraft('');
    }, [gameId]);

    React.useEffect(() => {
        if (!gameId || activeTab !== 'leaderboard') {
            return;
        }

        let cancelled = false;
        setLeaderboardError(false);
        setLeaderboardData(null);

        fetch(`${GAME_SERVER_URL}/games/${encodeURIComponent(gameId)}/leaderboard`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json() as Promise<{ leaderboard?: { name: string; wins: number; matches: number }[]; error?: unknown }>;
            })
            .then((payload) => {
                if (cancelled) return;
                if (payload && !payload.error) {
                    setLeaderboardData({
                        leaderboard: Array.isArray(payload.leaderboard) ? payload.leaderboard : [],
                    });
                    return;
                }
                setLeaderboardError(true);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                logger.error('[HomeV2Detail] 获取排行榜失败', {
                    gameId,
                    error,
                });
                setLeaderboardError(true);
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, gameId]);

    React.useEffect(() => {
        if (!gameId || activeTab !== 'changelog') {
            return;
        }

        let cancelled = false;
        setChangelogLoading(true);
        setChangelogError(false);
        setChangelogItems([]);

        fetch(`${GAME_CHANGELOG_API_URL}/${encodeURIComponent(gameId)}`)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json() as Promise<{ changelogs?: GameChangelogItem[] }>;
            })
            .then((payload) => {
                if (cancelled) return;
                setChangelogItems(Array.isArray(payload.changelogs) ? payload.changelogs : []);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                logger.error('[HomeV2Detail] 获取更新日志失败', {
                    gameId,
                    error,
                });
                setChangelogError(true);
            })
            .finally(() => {
                if (!cancelled) {
                    setChangelogLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, gameId]);

    React.useEffect(() => {
        if (!gameId || activeTab !== 'reviews') {
            return;
        }

        let cancelled = false;
        setReviewsLoading(true);
        setReviewsError(false);
        setReviewStats(null);
        setReviewItems([]);

        Promise.all([
            fetchReviewStats(gameId),
            fetchReviews(gameId, 1, 5),
        ])
            .then(([stats, reviewList]) => {
                if (cancelled) return;
                setReviewStats(stats);
                setReviewItems(reviewList.items ?? []);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                logger.error('[HomeV2Detail] 获取评价失败', {
                    gameId,
                    error,
                });
                setReviewsError(true);
            })
            .finally(() => {
                if (!cancelled) {
                    setReviewsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, gameId]);

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
        if (createRoomInFlightRef.current) {
            return;
        }
        if (!game) return;
        createRoomInFlightRef.current = true;
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
            createRoomInFlightRef.current = false;
        }
    };

    const handleJoinRoom = async (matchID: string, password?: string) => {
        if (!game) return;
        setIsLoading(true);
        try {
            const summary = matches.find((item) => item.matchID === matchID);
            if (summary?.isLocked) {
                if (!password) {
                    setPendingPasswordRoom({ matchID, roomName: summary.roomName });
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

    const passwordModal = activeTab === 'lobby' && pendingPasswordRoom && typeof document !== 'undefined'
        ? createPortal(
            <div
                data-testid="home-v2-room-password-panel"
                className="fixed inset-0 flex items-center justify-center bg-[rgba(18,13,9,0.56)] p-4 pointer-events-auto backdrop-blur-[2px]"
                style={{ zIndex: UI_Z_INDEX.modalContent }}
            >
                <HomeV2PaperModalFrame
                    title={t('lobby:password.modalTitle')}
                    dataTestId="home-v2-room-password-surface"
                    dataTextEntryAutoscroll="off"
                    surfaceClassName={`font-serif ${isCompactLandscape ? 'home-v2-paper-modal-compact w-[min(15.25rem,calc(100vw-1rem))]' : 'w-[min(31rem,calc(100vw-2rem))]'}`}
                    surfaceStyle={{
                        height: isCompactLandscape
                            ? 'min(calc(100vh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 0.5rem), 11.75rem)'
                            : undefined,
                        maxHeight: isCompactLandscape
                            ? undefined
                            : 'min(calc(100vh - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 2rem), 25rem)',
                    }}
                    headerClassName={isCompactLandscape ? 'px-[22px] pb-[9px] pt-[13px]' : 'px-7 pb-3 pt-6'}
                    titleClassName={isCompactLandscape ? 'text-[11.8px] tracking-[0.075em]' : undefined}
                    dividerClassName={isCompactLandscape ? 'mt-[7px] w-[72%] gap-1.5' : undefined}
                >
                    <div className={`relative z-10 flex flex-col ${isCompactLandscape ? 'gap-[6px] px-[22px] pb-[11px]' : 'gap-4 px-7 pb-6'}`}>
                        <div className="text-center">
                            <div className={passwordHintClassName}>
                                {getRoomTitle(pendingPasswordRoom.matchID, t, pendingPasswordRoom.roomName)}
                            </div>
                        </div>
                        <div>
                            <div className="mb-2 flex items-center justify-between gap-3">
                                <label
                                    htmlFor="home-v2-room-password-input"
                                    className={isCompactLandscape ? 'block text-[7.2px] font-semibold tracking-[0.04em] text-[#3f2616]' : 'block text-[12px] font-semibold tracking-[0.06em] text-[#3f2616]'}
                                >
                                    {t('lobby:createRoom.password')}
                                </label>
                                <span className={passwordHintClassName}>
                                    {t('lobby:password.modalDesc')}
                                </span>
                            </div>
                        </div>
                        <PasswordField
                            data-testid="home-v2-room-password-input"
                            id="home-v2-room-password-input"
                            name="homeV2RoomPassword"
                            value={roomPasswordDraft}
                            onChange={(event) => setRoomPasswordDraft(event.target.value)}
                            placeholder={t('lobby:password.placeholder')}
                            autoComplete="new-password"
                            className={`${passwordInputClassName} ${isCompactLandscape ? 'pr-10' : 'pr-11'}`}
                            toggleButtonTestId="home-v2-room-password-toggle"
                            toggleButtonClassName="text-[#8a6444] hover:text-[#5f3b25]"
                            iconSize={isCompactLandscape ? 9 : undefined}
                        />
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingPasswordRoom(null);
                                    setRoomPasswordDraft('');
                                }}
                                data-testid="home-v2-room-password-cancel"
                                className={`${passwordSecondaryButtonClassName} min-w-[6.75rem]`}
                            >
                                {t('common:button.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePasswordConfirm(roomPasswordDraft.trim())}
                                disabled={!roomPasswordDraft.trim() || isLoading}
                                data-testid="home-v2-room-password-confirm"
                                className={`${passwordPrimaryButtonClassName} min-w-[7.5rem]`}
                            >
                                {t('common:button.confirm')}
                            </button>
                        </div>
                    </div>
                </HomeV2PaperModalFrame>
            </div>,
            document.body,
        )
        : null;

    const hasVisibleRooms = filteredRoomPreviewItems.length > 0;
    const detailTabs: Array<{ id: HomeV2DetailTab; label: string; compactLabel: string }> = [
        { id: 'lobby', label: t('lobby:homeV2.details.onlineLobbyLabel'), compactLabel: t('lobby:homeV2.details.onlineLobbyCompactLabel', { defaultValue: '大厅' }) },
        { id: 'changelog', label: t('lobby:homeV2.detailTabs.updates', { defaultValue: '更新' }), compactLabel: t('lobby:homeV2.detailTabs.updatesCompact', { defaultValue: '更新' }) },
        { id: 'reviews', label: t('lobby:homeV2.detailTabs.reviews', { defaultValue: '评价' }), compactLabel: t('lobby:homeV2.detailTabs.reviewsCompact', { defaultValue: '评价' }) },
        { id: 'leaderboard', label: t('lobby:homeV2.detailTabs.ranking', { defaultValue: '排行榜' }), compactLabel: t('lobby:homeV2.detailTabs.rankingCompact', { defaultValue: '排行' }) },
    ];
    const roomLedgerGridClassName = isCompactLandscape
        ? 'grid-cols-[minmax(0,3.06fr)_44px_60px_56px]'
        : 'grid-cols-[minmax(0,2.2fr)_112px_132px_132px]';
    const showRoomThumbnail = !isCompactLandscape;

    return (
        <div data-testid="home-v2-detail-right-page" className="pointer-events-auto relative flex h-full w-full min-h-0 flex-col text-[#3f2718]">
            <div className={`flex items-end justify-between border-b border-[rgba(105,66,37,0.38)] ${isCompactLandscape ? 'gap-[8px] pb-[4px]' : 'gap-[18px] pb-[0.8%]'}`}>
                <div
                    data-testid="home-v2-detail-tabs"
                    className={isCompactLandscape
                        ? 'grid min-w-0 flex-1 grid-cols-4 items-end gap-[6px]'
                        : 'flex min-w-0 items-end flex-wrap gap-[clamp(34px,2.7vw,54px)]'}
                >
                    {detailTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            data-testid="home-v2-detail-tab"
                            data-tab-id={tab.id}
                            aria-pressed={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative min-w-0 leading-none transition-colors ${
                                isCompactLandscape ? 'pb-[6px] text-[11px] tracking-[0.02em]' : 'shrink-0 pb-[8px] text-[clamp(24px,1.78vw,32px)]'
                            } ${
                                activeTab === tab.id
                                    ? 'font-bold text-[#2f1b10]'
                                    : 'font-semibold text-[#4e311f] hover:text-[#2f1b10]'
                            }`}
                        >
                            <span className="block whitespace-nowrap text-center">
                                {isCompactLandscape ? tab.compactLabel : tab.label}
                            </span>
                            {activeTab === tab.id ? (
                                <>
                                    <span
                                        aria-hidden="true"
                                        className={`${isCompactLandscape ? 'bottom-[1px] left-[6%] w-[88%]' : 'bottom-0 left-[-8%] w-[116%]'} absolute h-[2px] bg-[linear-gradient(90deg,rgba(49,92,39,0)_0%,rgba(49,92,39,0.95)_14%,rgba(49,92,39,0.95)_86%,rgba(49,92,39,0)_100%)]`}
                                    />
                                    <span
                                        aria-hidden="true"
                                        className={`${isCompactLandscape ? 'bottom-[-2px] h-[6px] w-[6px]' : 'bottom-[-4px] h-[8px] w-[8px]'} absolute left-1/2 -translate-x-1/2 rotate-45 bg-[#315c27]`}
                                    />
                                </>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'lobby' ? (
                <>
                    <div className={`flex items-center justify-end border-b border-[rgba(105,66,37,0.30)] ${isCompactLandscape ? 'mt-[4px] gap-[9px] pb-[4px]' : 'mt-[0.7%] gap-[18px] pb-[1.0%]'}`}>
                        <label
                            data-testid="home-v2-room-search-field"
                            className={`relative block min-w-0 rounded-none border-b border-[#6f4b32]/54 bg-transparent ${isCompactLandscape ? 'h-[27px] w-[49%]' : 'h-[42px] w-[42%]'}`}
                            style={{ borderBottom: '1px solid rgba(111, 75, 50, 0.54)' }}
                        >
                            <input
                                type="text"
                                value={roomSearch}
                                onChange={(event) => setRoomSearch(event.target.value)}
                                placeholder={t('lobby:homeV2.detailSearchPlaceholder')}
                                className={`${isCompactLandscape ? 'h-[25px] px-[7px] pr-[22px] text-[9px]' : 'h-[40px] px-[12px] pr-[42px] text-[clamp(14px,0.98vw,16px)]'} w-full border-0 bg-transparent text-[#3f2718] outline-none placeholder:font-medium placeholder:text-[#7e5d43]/74`}
                            />
                            <span
                                data-testid="home-v2-room-search-icon"
                                className={`pointer-events-none absolute inset-y-0 flex items-center leading-none text-[#3f2718] ${isCompactLandscape ? 'right-[7px]' : 'right-[12px]'}`}
                            >
                                <Search aria-hidden="true" className={isCompactLandscape ? 'block h-[9px] w-[9px]' : 'block h-[18px] w-[18px]'} strokeWidth={1.95} />
                            </span>
                        </label>
                        <BookFrameButton
                            className={`${isCompactLandscape ? 'min-h-[31px] min-w-[94px] px-[9px] py-[4px] text-[10.1px]' : ''} shrink-0`}
                            size={isCompactLandscape ? 'compact' : 'prominent'}
                            icon={<Plus aria-hidden="true" className={isCompactLandscape ? 'h-[10px] w-[10px]' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />}
                            disabled={isLoading || isPreparingCreateRoom}
                            onClick={() => void openCreateRoom()}
                            testId="home-v2-create-room-button"
                        >
                            {t('lobby:actions.createRoom', '创建房间')}
                        </BookFrameButton>
                    </div>

                    <div data-testid="home-v2-room-ledger" className={`${isCompactLandscape ? 'mt-[3px]' : 'mt-[0.8%]'} flex min-h-0 flex-1 flex-col px-[0.6%]`}>
                        <div
                            data-testid="home-v2-room-ledger-header"
                            className={`grid items-center gap-0 border-b border-t border-[rgba(105,66,37,0.42)] font-bold tracking-[0.06em] text-[#3f2718] ${
                                isCompactLandscape
                                    ? `${roomLedgerGridClassName} py-[2px] text-[9.3px]`
                                : `${roomLedgerGridClassName} py-[2.0%] text-[clamp(14px,0.98vw,16px)]`
                            }`}
                        >
                            <div className={isCompactLandscape ? 'pl-[4px]' : ''}>{t('lobby:homeV2.detailColumns.roomName')}</div>
                            <div className="text-center" style={{ borderLeft: '1px solid rgba(105,66,37,0.34)' }}>{t('lobby:homeV2.detailColumns.players')}</div>
                            <div className="text-center" style={{ borderLeft: '1px solid rgba(105,66,37,0.34)' }}>{t('lobby:homeV2.detailColumns.status')}</div>
                            <div className="text-center" style={{ borderLeft: '1px solid rgba(105,66,37,0.34)' }}>{t('lobby:homeV2.detailColumns.action')}</div>
                        </div>

                        <div className="min-h-0 flex-1">
                            {!hasSnapshot ? (
                                <RoomLedgerSkeleton />
                            ) : !hasVisibleRooms ? (
                                <div className="flex min-h-[164px] flex-col items-center justify-center px-[3%] text-center">
                                    <div className="text-[clamp(15px,1.1vw,17px)] font-semibold text-[#6f4b32]">
                                            {normalizedRoomSearch
                                                ? t('lobby:homeV2.detailNoMatchTitle')
                                                : t('lobby:homeV2.emptyRoomTitle')}
                                    </div>
                                    <div className="mt-[8px] text-[clamp(12px,0.9vw,14px)] leading-[1.6] text-[#8a6444]">
                                        {normalizedRoomSearch
                                            ? t('lobby:homeV2.detailNoMatchDescription')
                                            : t('lobby:homeV2.emptyRoomDescription')}
                                    </div>
                                </div>
                            ) : (
                                <div className="custom-scrollbar h-full overflow-y-auto pr-[2px]">
                                    <div data-testid="home-v2-room-ledger-table" className="space-y-0 border-b border-[rgba(105,66,37,0.28)]">
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
                                                    data-testid="home-v2-room-ledger-row"
                                                    className="border-b border-[rgba(105,66,37,0.28)] last:border-b-0"
                                                >
                                                    <button
                                                        type="button"
                                                        className={`group grid w-full items-center gap-0 text-left transition-colors duration-200 hover:bg-[rgba(127,88,56,0.05)] ${
                                                            isCompactLandscape
                                                                ? `min-h-[36px] ${roomLedgerGridClassName} py-[2px]`
                                                                : `min-h-[82px] ${roomLedgerGridClassName} py-[9px]`
                                                        }`}
                                                        disabled={isLoading}
                                                        onClick={() => void handleJoinRoom(room.matchID)}
                                                    >
                                                        <div className={`flex min-w-0 ${showRoomThumbnail ? 'items-center' : 'items-start'} ${isCompactLandscape ? 'pl-[4px] pr-[8px]' : 'gap-[15px] pr-[12px]'}`}>
                                                            {showRoomThumbnail ? (
                                                                <div
                                                                    data-testid="home-v2-room-thumbnail"
                                                                    className="h-[64px] w-[82px] shrink-0 overflow-hidden rounded-[4px] border border-[#6f4b32]/34 bg-[rgba(255,255,255,0.04)]"
                                                                >
                                                                    <DetailGameThumbnail game={game} title={getRoomTitle(room.matchID, t, room.roomName)} />
                                                                </div>
                                                            ) : null}
                                                            <div className="min-w-0">
                                                                <div className={`${isCompactLandscape ? 'text-[10px]' : 'text-[clamp(16px,1.12vw,18px)]'} truncate font-bold leading-[1.12] text-[#3f2718]`}>
                                                                    {getRoomTitle(room.matchID, t, room.roomName)}
                                                                </div>
                                                                <div className={`${isCompactLandscape ? 'mt-[1px] text-[7.7px]' : 'mt-[5px] text-[clamp(12px,0.9vw,14px)]'} truncate leading-[1.2] text-[#5e3d27]`}>
                                                                    {getRoomSeatLine(room, t)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={`${isCompactLandscape ? 'text-[11px]' : 'text-[clamp(20px,1.36vw,24px)]'} flex h-full items-center justify-center text-center font-semibold text-[#2f1b10]`} style={{ borderLeft: '1px solid rgba(105,66,37,0.26)' }}>
                                                            {playerCount}/{totalSeats || playerCount}
                                                        </div>
                                                        <div className="flex h-full items-center justify-center text-center" style={{ borderLeft: '1px solid rgba(105,66,37,0.26)' }}>
                                                            <span className={`inline-flex items-center justify-center border-b font-semibold leading-none ${isCompactLandscape ? 'min-w-[34px] px-[3px] py-[1px] text-[8.4px]' : 'min-w-[68px] px-[8px] py-[5px] text-[clamp(13px,0.92vw,15px)]'} ${
                                                                roomState.key === 'locked'
                                                                    ? 'border-[#9d773f]/42 bg-transparent text-[#4e321f]'
                                                                    : roomState.key === 'full'
                                                                        ? 'border-[#7d6a58]/34 bg-transparent text-[#5f5144]'
                                                                        : 'border-[#526d3d]/38 bg-transparent text-[#314625]'
                                                            }`}>
                                                                {roomState.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex h-full items-center justify-center text-center" style={{ borderLeft: '1px solid rgba(105,66,37,0.26)' }}>
                                                            <RoomLedgerActionTag compact={isCompactLandscape}>
                                                                {actionLabel}
                                                            </RoomLedgerActionTag>
                                                        </div>
                                                    </button>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div
                    data-testid={`home-v2-detail-panel-${activeTab}`}
                    className="mt-[2.1%] min-h-0 flex-1 overflow-hidden border-t border-[rgba(105,66,37,0.30)] pt-[2.0%]"
                >
                    {activeTab === 'leaderboard' ? (
                        <HomeV2LeaderboardPanel leaderboardData={leaderboardData} error={leaderboardError} t={t} compact={isCompactLandscape} />
                    ) : activeTab === 'changelog' ? (
                        <HomeV2ChangelogPanel items={changelogItems} loading={changelogLoading} error={changelogError} t={t} />
                    ) : (
                        <HomeV2ReviewsPanel stats={reviewStats} reviews={reviewItems} loading={reviewsLoading} error={reviewsError} t={t} compact={isCompactLandscape} />
                    )}
                </div>
            )}

            {passwordModal}
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
