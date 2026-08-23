import React from 'react';
import { createPortal } from 'react-dom';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, Download, HardDriveDownload, LoaderCircle, Plus, RefreshCw, Search, TableProperties } from 'lucide-react';
import { type GameConfig } from '../../config/games.config';
import { getGameConfigReviewPath, hasGameConfigReview } from '../../config/gameConfigReviewRoutes';
import { preloadWarmImages, resolveCriticalImages, UI_Z_INDEX } from '../../core';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
    claimSeat,
    clearOwnerActiveMatch,
    destroyMatch as destroyOwnedMatch,
    getLatestStoredMatchCredentials,
    getOwnerActiveMatch,
    readStoredMatchCredentials,
    persistMatchCredentials,
    setOwnerActiveMatch,
} from '../../hooks/match/useMatchStatus';
import {
    readStoredLocalMatchPreferences,
    stripAiSeatsFromLocalMatchPreferences,
    writeLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../../engine/ai/localMatchPreferences';
import * as matchApi from '../../services/matchApi';
import { fetchReviews, fetchReviewStats, type Review, type ReviewStats } from '../../api/review';
import { GAME_CHANGELOG_API_URL, GAME_SERVER_URL } from '../../config/server';
import { getGuestName, getOrCreateGuestId, getOwnerKey, getOwnerType } from '../../hooks/match/ownerIdentity';
import { useLobbyMatchPresence } from '../../hooks/useLobbyMatchPresence';
import { useHomeV2CompactLandscape } from '../../hooks/ui/useHomeV2CompactLandscape';
import { useGamePackageState } from '../../features/mobile-packages/useGamePackageState';
import {
    hasUsableInstalledGamePackageState,
    hasUsableInstalledGamePackageVersion,
} from '../../features/mobile-packages/types';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { requestAndroidNativeUpdateCheck } from '../../lib/mobile/androidNativeUpdates';
import { logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { CreateRoomModal, type RoomConfig } from '../lobby/CreateRoomModal';
import { GameDetailsMobilePackageCard } from '../lobby/GameDetailsMobilePackageCard';
import { GamePackageInstallConfirmModal } from '../lobby/GamePackageInstallConfirmModal';
import { resolveRoomExpansionLabel, resolveRoomScenarioLabel, resolveRoomScenarioPendingLabel } from '../lobby/roomActions';
import { PasswordField } from '../common/PasswordField';
import { HomeV2DangerConfirmModal } from '../common/overlays/HomeV2DangerConfirmModal';
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
import type { LeaderboardEntry } from '../lobby/leaderboardTypes';
import { logger } from '../../lib/logger';
import { ensureGameCriticalImageResolverLoaded, prefetchGameImplementation } from '../../games/registry';
import { prefetchOnlineMatchRoute } from '../../lib/prefetchPlayRoute';

type HomeV2Translate = TFunction<['lobby', 'common']>;
type GameConfigWithDraftMeta = GameConfig & {
    name?: string;
    description?: string;
};
type HomeV2DetailTab = 'lobby' | 'changelog' | 'reviews' | 'leaderboard';

const prewarmInitialGameImages = (gameId: string, locale: string, source: string) => {
    void ensureGameCriticalImageResolverLoaded(gameId)
        .then(() => {
            const resolved = resolveCriticalImages(gameId, undefined, locale);
            const criticalPaths = [...new Set(resolved.critical)];
            if (criticalPaths.length > 0) {
                preloadWarmImages(criticalPaths, locale, gameId);
            }
        })
        .catch((error: unknown) => {
            logger.warn(`[HomeV2Detail] ${source} 提前加载关键素材失败`, {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
};

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
    leaderboardData: { leaderboard: LeaderboardEntry[] } | null;
    error: boolean;
    t: HomeV2Translate;
    compact?: boolean;
}) {
    const entries = leaderboardData?.leaderboard ?? [];

    return (
        <HomeV2PaperPanel eyebrow={t('lobby:leaderboard.title', { defaultValue: 'ELO 排行' })}>
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
                                        ? 'min-h-[42px] grid-cols-[30px_minmax(0,1fr)_72px] gap-[5px] py-[3px]'
                                        : 'min-h-[70px] grid-cols-[66px_minmax(0,1fr)_172px] gap-[14px]'
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
                                <div className="min-w-0 pr-[8px]">
                                    <div
                                        className={`min-w-0 font-bold text-[#3f2718] ${
                                            compact
                                                ? 'truncate text-[10px] leading-[1.08]'
                                                : 'truncate text-[clamp(17px,1.16vw,20px)]'
                                        }`}
                                    >
                                        {player.name}
                                    </div>
                                    {!compact ? (
                                        <div className="mt-[3px] truncate text-[11px] font-semibold leading-none text-[#8a6444]">
                                            {t(`lobby:leaderboard.tiers.${player.tier}`, { defaultValue: player.tier })}
                                            {player.provisional ? ` · ${t('lobby:leaderboard.provisional', { defaultValue: '定级中' })}` : ''}
                                        </div>
                                    ) : null}
                                </div>
                                <div data-testid="home-v2-leaderboard-record" className={`justify-self-end text-right font-semibold text-[#6e4a32] ${compact ? 'text-[9px] leading-[1.05]' : 'text-[clamp(12px,0.86vw,14px)] leading-[1.18]'}`}>
                                    {compact ? (
                                        <>
                                            <div className="tabular-nums text-[#3f2718]">{player.rating}</div>
                                            <div className="mt-[2px] tabular-nums">{player.wins}-{player.losses}</div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="tabular-nums text-[clamp(18px,1.18vw,21px)] font-bold leading-none text-[#3f2718]">
                                                {t('lobby:leaderboard.rating', { rating: player.rating, defaultValue: '{{rating}} ELO' })}
                                            </div>
                                            <div className="mt-[5px] tabular-nums">
                                                {t('lobby:leaderboard.record', {
                                                    wins: player.wins,
                                                    losses: player.losses,
                                                    draws: player.draws,
                                                    matches: player.matches,
                                                    winRate: Math.round(player.winRate * 100),
                                                })}
                                            </div>
                                        </>
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
                                        {review.isPositive
                                            ? t('lobby:homeV2.reviews.recommend', { defaultValue: '推荐' })
                                            : t('lobby:homeV2.reviews.not_recommend', { defaultValue: '不推荐' })}
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
    disabled,
    icon,
    onClick,
    testId,
}: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    onClick?: () => void;
    testId?: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            data-testid={testId}
            className={`inline-flex items-center justify-center gap-[7px] rounded-[2px] border border-[#a5743c]/74 bg-[#4b2c18] font-bold text-[#f1dab3] shadow-[0_1px_2px_rgba(63,38,20,0.10)] transition-colors hover:text-[#fff0ce] disabled:pointer-events-none disabled:opacity-65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/22 ${className ?? ''}`}
        >
            <span className="inline-flex items-center justify-center gap-[7px]">
                {icon}
                {children}
            </span>
        </button>
    );
}

function DetailGameThumbnail({ game, framed = false }: { game: GameConfig; title: string; framed?: boolean }) {
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
        gameName?: string;
        publicSetupSummary?: {
            enabledExpansions?: string[];
            scenarioId?: string;
        };
    },
    fallbackTitle: string,
    t: HomeV2Translate,
    gameManifest?: GameConfig | null,
) {
    const enabledExpansionLabels = room.publicSetupSummary?.enabledExpansions?.map((expansionId) => (
        resolveRoomExpansionLabel(t, room.gameName, expansionId, gameManifest ?? undefined)
    )) ?? [];

    return [
        fallbackTitle,
        room.roomName ?? '',
        room.matchID,
        ...enabledExpansionLabels,
        ...room.players.map((player) => player.name ?? ''),
    ].join(' ').toLowerCase();
}

export interface LeftProps {
    game: GameConfig | null;
    onBack: () => void;
}

const GameDetailsLeftContent = ({ game, onBack }: { game: GameConfig; onBack: () => void }) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
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
    const hasConfigReview = hasGameConfigReview(game.id);

    const handleTutorial = () => {
        const gameId = game.id;
        prewarmInitialGameImages(gameId, i18n.language, '进入教程');
        void prefetchGameImplementation(gameId, { includeTutorial: true }).catch((error: unknown) => {
            logger.warn('[HomeV2Detail] 进入教程时提前加载教程 runtime 失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        navigate(`/play/${game.id}/tutorial`);
    };

    const handleConfigReview = () => {
        navigate(getGameConfigReviewPath(game.id));
    };

    return (
        <div data-testid="home-v2-detail-left-page" className="pointer-events-auto relative flex h-full w-full min-h-0 flex-col text-[#3f2718]">
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
                            {hasConfigReview ? (
                                <BookLineButton
                                    className="min-h-[31px] w-[146px] shrink-0 px-[14px] text-[10.2px] tracking-[0.05em]"
                                    icon={<TableProperties aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={2.1} />}
                                    onClick={handleConfigReview}
                                    testId="home-v2-config-review-button"
                                >
                                    {t('lobby:actions.configReview')}
                                </BookLineButton>
                            ) : null}
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
                    {hasConfigReview ? (
                        <BookLineButton
                            className="min-h-[48px] w-[52%] px-[24px] text-[clamp(16px,1.08vw,20px)] tracking-[0.06em]"
                            icon={<TableProperties aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.1} />}
                            onClick={handleConfigReview}
                            testId="home-v2-config-review-button"
                        >
                            {t('lobby:actions.configReview')}
                        </BookLineButton>
                    ) : null}
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
    const gameDisplayName = game ? getDisplayName(game, t) : '';
    const isNativeAndroidCapacitorRuntime = isNativeAndroidRuntime();
    const {
        isPackageManaged: isPackageManagedMobileGame,
        cardState: packageInstallCardState,
        pendingInstall: pendingPackageInstall,
        isConfirmingInstall: isConfirmingPackageInstall,
        requestInstall: requestGamePackageInstall,
        dismissInstall: dismissGamePackageInstall,
        cancelInstall: cancelGamePackageInstall,
        uninstallInstall: uninstallGamePackageInstall,
        confirmInstall: confirmGamePackageInstall,
        retryInstall: retryGamePackageInstall,
        notificationPermissionAction: packageNotificationPermissionAction,
        openNotificationSettings: openGamePackageNotificationSettings,
    } = useGamePackageState({
        gameId: gameId ?? '',
        gameName: gameDisplayName || gameId || '',
        delivery: game?.mobileDelivery,
        enabled: Boolean(gameId) && isNativeAndroidCapacitorRuntime,
    });
    const isAppUpdateRequiredForMobileGame = isPackageManagedMobileGame && game?.mobileDelivery?.requiresAppUpdate === true;
    const hasInstalledPackageForMobileGame = hasUsableInstalledGamePackageState(packageInstallCardState);
    const hasMobilePackageUpdateAvailable = hasInstalledPackageForMobileGame
        && packageInstallCardState.isUpdateAvailable === true;
    const packageInstallFailedActionLabel = packageInstallCardState.errorCode === 'notification-permission-required'
        && packageNotificationPermissionAction === 'settings'
        ? t('packageManager.notificationSettingsAction')
        : undefined;
    const mobilePackageCardDisplayState = (
        (!hasInstalledPackageForMobileGame || hasMobilePackageUpdateAvailable)
        && packageInstallCardState.status === 'installed'
    )
        ? {
            ...packageInstallCardState,
            status: 'not-installed' as const,
        }
        : packageInstallCardState;
    const [isMobilePackageCardExpanded, setIsMobilePackageCardExpanded] = React.useState(false);
    const [mobilePackagePortalTarget, setMobilePackagePortalTarget] = React.useState<HTMLElement | null>(null);
    const shouldShowMobilePackageRegion = isPackageManagedMobileGame;
    const shouldAutoExpandMobilePackageCard = isAppUpdateRequiredForMobileGame
        || packageInstallCardState.status === 'queued'
        || packageInstallCardState.status === 'manifest'
        || packageInstallCardState.status === 'downloading'
        || packageInstallCardState.status === 'verifying'
        || packageInstallCardState.status === 'failed';
    const { matches, hasSnapshot } = useLobbyMatchPresence({
        gameId,
        enabled: Boolean(gameId),
        requireSeen: false,
    });
    const [showCreateRoomModal, setShowCreateRoomModal] = React.useState(false);
    const [pendingPasswordRoom, setPendingPasswordRoom] = React.useState<{ matchID: string; roomName?: string } | null>(null);
    const [pendingDestroyRoom, setPendingDestroyRoom] = React.useState<{ matchID: string; roomName?: string } | null>(null);
    const [roomPasswordDraft, setRoomPasswordDraft] = React.useState('');
    const [roomSearch, setRoomSearch] = React.useState('');
    const [matchStorageTick, setMatchStorageTick] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isDestroyingRoom, setIsDestroyingRoom] = React.useState(false);
    const [isPreparingCreateRoom, setIsPreparingCreateRoom] = React.useState(false);
    const [optimisticallyRemovedRoomIds, setOptimisticallyRemovedRoomIds] = React.useState<string[]>([]);
    const [initialCreateRoomPreferences, setInitialCreateRoomPreferences] = React.useState<LocalMatchPreferences | null>(null);
    const createRoomInFlightRef = React.useRef(false);
    const [activeTab, setActiveTab] = React.useState<HomeV2DetailTab>('lobby');
    const [leaderboardData, setLeaderboardData] = React.useState<{
        leaderboard: LeaderboardEntry[];
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
    const guestId = user?.id ? undefined : getOrCreateGuestId();
    const ownerKey = getOwnerKey(user?.id, guestId);
    const guestName = getGuestName(t, guestId);

    const roomPreviewItems = matches
        .filter((room) => !optimisticallyRemovedRoomIds.includes(room.matchID))
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
        return getRoomSearchHaystack(room, fallbackTitle, t, game).includes(normalizedRoomSearch);
    }), [game, normalizedRoomSearch, roomPreviewItems, t]);

    const ownerActiveRoom = React.useMemo(() => {
        void matchStorageTick;
        if (!gameId) {
            return null;
        }

        const ownerActive = getOwnerActiveMatch();
        if (!ownerActive?.matchID || ownerActive.ownerKey !== ownerKey) {
            return null;
        }
        if (optimisticallyRemovedRoomIds.includes(ownerActive.matchID)) {
            return null;
        }

        const activeGameName = (ownerActive.gameName || '').toLowerCase();
        if (activeGameName !== gameId.toLowerCase()) {
            return null;
        }

        const storedCredentials = readStoredMatchCredentials(ownerActive.matchID);
        const latestStored = getLatestStoredMatchCredentials();
        const roomSummary = matches.find((room) => room.matchID === ownerActive.matchID) ?? null;
        const latestStoredForOwnerRoom = latestStored?.matchID === ownerActive.matchID ? latestStored : null;

        return {
            matchID: ownerActive.matchID,
            gameName: activeGameName || gameId.toLowerCase(),
            roomName: roomSummary?.roomName,
            playerID: storedCredentials?.playerID ?? latestStoredForOwnerRoom?.playerID ?? '0',
            credentials: storedCredentials?.credentials ?? latestStoredForOwnerRoom?.credentials ?? null,
        };
    }, [gameId, matchStorageTick, matches, optimisticallyRemovedRoomIds, ownerKey]);

    React.useEffect(() => {
        setActiveTab('lobby');
        setRoomSearch('');
        setPendingPasswordRoom(null);
        setPendingDestroyRoom(null);
        setRoomPasswordDraft('');
        setIsDestroyingRoom(false);
        setOptimisticallyRemovedRoomIds([]);
        setIsMobilePackageCardExpanded(false);
    }, [gameId]);

    React.useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const refresh = () => setMatchStorageTick((tick) => tick + 1);
        window.addEventListener('match-credentials-changed', refresh);
        window.addEventListener('owner-active-match-changed', refresh);
        window.addEventListener('storage', refresh);

        return () => {
            window.removeEventListener('match-credentials-changed', refresh);
            window.removeEventListener('owner-active-match-changed', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    React.useEffect(() => {
        if (!shouldShowMobilePackageRegion) {
            setIsMobilePackageCardExpanded(false);
            setMobilePackagePortalTarget(null);
            return;
        }

        setMobilePackagePortalTarget(document.querySelector<HTMLElement>('[data-testid="home-v2-detail-left-page"]'));

        if (shouldAutoExpandMobilePackageCard) {
            setIsMobilePackageCardExpanded(true);
        }
    }, [shouldAutoExpandMobilePackageCard, shouldShowMobilePackageRegion]);

    const handleOpenMobilePackageInstall = React.useCallback(() => {
        logMobileRuntimeCritical('HomeV2Detail', 'open-package-install-clicked', {
            gameId,
            gameName: gameDisplayName,
            isPackageManagedMobileGame,
            isAppUpdateRequiredForMobileGame,
            status: packageInstallCardState.status,
            hasPendingInstall: Boolean(pendingPackageInstall),
        });
        if (!gameId || !isPackageManagedMobileGame || isAppUpdateRequiredForMobileGame) {
            return;
        }

        requestGamePackageInstall();
    }, [
        gameDisplayName,
        gameId,
        isAppUpdateRequiredForMobileGame,
        isPackageManagedMobileGame,
        packageInstallCardState.status,
        pendingPackageInstall,
        requestGamePackageInstall,
    ]);

    const handleRequestAndroidNativeUpdate = React.useCallback(() => {
        logMobileRuntimeCritical('HomeV2Detail', 'native-update-clicked', {
            gameId,
            gameName: gameDisplayName,
            requiredAppVersion: game?.mobileDelivery?.requiredAppVersion,
        });
        requestAndroidNativeUpdateCheck({ interactive: true });
    }, [
        game?.mobileDelivery?.requiredAppVersion,
        gameDisplayName,
        gameId,
    ]);

    const handleDismissPackageInstall = React.useCallback(() => {
        dismissGamePackageInstall();
    }, [dismissGamePackageInstall]);

    const handleCancelPackageInstall = React.useCallback(() => {
        void Promise.resolve(cancelGamePackageInstall()).catch((error) => {
            logMobileRuntimeCritical('HomeV2Detail', 'cancel-package-install-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }, [cancelGamePackageInstall, gameId]);

    const handleUninstallPackageInstall = React.useCallback(() => {
        void Promise.resolve(uninstallGamePackageInstall()).catch((error) => {
            logMobileRuntimeCritical('HomeV2Detail', 'uninstall-package-install-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }, [gameId, uninstallGamePackageInstall]);

    const handleConfirmPackageInstall = React.useCallback(async () => {
        if (isConfirmingPackageInstall) {
            return;
        }
        await confirmGamePackageInstall();
    }, [confirmGamePackageInstall, isConfirmingPackageInstall]);

    const handleRetryPackageInstall = React.useCallback(() => {
        if (
            packageInstallCardState.errorCode === 'notification-permission-required'
            && packageNotificationPermissionAction === 'settings'
        ) {
            void openGamePackageNotificationSettings();
            return;
        }
        retryGamePackageInstall();
    }, [
        openGamePackageNotificationSettings,
        packageInstallCardState.errorCode,
        packageNotificationPermissionAction,
        retryGamePackageInstall,
    ]);

    const mobilePackageToggleMeta = React.useMemo(() => {
        if (isAppUpdateRequiredForMobileGame) {
            return {
                icon: AlertTriangle,
                iconClassName: '',
                buttonClassName: 'border-[#9d6a25]/36 bg-[#f6dfb8]/92 text-[#6b4219] hover:bg-[#f8e7c8]',
                label: t('packageManager.updateRequiredTitle'),
            };
        }

        switch (mobilePackageCardDisplayState.status) {
            case 'queued':
            case 'verifying':
                return {
                    icon: LoaderCircle,
                    iconClassName: 'animate-spin',
                    buttonClassName: 'border-[#a5743c]/78 bg-[#472916] text-[#f2dbb4] hover:text-[#fff0ce]',
                    label: t('packageManager.progress.label'),
                };
            case 'manifest':
            case 'downloading':
                return {
                    icon: Download,
                    iconClassName: '',
                    buttonClassName: 'border-[#a5743c]/78 bg-[#472916] text-[#f2dbb4] hover:text-[#fff0ce]',
                    label: t('packageManager.progress.label'),
                };
            case 'failed':
                return {
                    icon: RefreshCw,
                    iconClassName: '',
                    buttonClassName: 'border-[#9d6a25]/36 bg-[#f6dfb8]/92 text-[#6b4219] hover:bg-[#f8e7c8]',
                    label: packageInstallFailedActionLabel,
                };
            case 'installed':
                return {
                    icon: HardDriveDownload,
                    iconClassName: '',
                    buttonClassName: 'border-[#a5743c]/78 bg-[#472916] text-[#e3f0d3] hover:text-[#f4ffe9]',
                    label: hasUsableInstalledGamePackageVersion(mobilePackageCardDisplayState.installedVersion)
                        ? t('packageManager.installedVersionBadge', { version: mobilePackageCardDisplayState.installedVersion?.trim() })
                        : t('packageManager.installedCompletedBadge'),
                };
            case 'not-installed':
            default:
                return {
                    icon: Download,
                    iconClassName: '',
                    buttonClassName: 'border-[#a5743c]/78 bg-[#472916] text-[#f2dbb4] hover:text-[#fff0ce]',
                    label: t('packageManager.installAction'),
                };
        }
    }, [
        isAppUpdateRequiredForMobileGame,
        mobilePackageCardDisplayState.installedVersion,
        mobilePackageCardDisplayState.status,
        packageInstallFailedActionLabel,
        t,
    ]);
    const MobilePackageToggleIcon = mobilePackageToggleMeta.icon;

    const handleMobilePackageToggleClick = React.useCallback(() => {
        setIsMobilePackageCardExpanded((current) => !current);
    }, []);

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
                return response.json() as Promise<{ leaderboard?: LeaderboardEntry[]; error?: unknown }>;
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
        prewarmInitialGameImages(game.id, i18n.language, '打开创建房间');
        void prefetchGameImplementation(game.id, { includeTutorial: false }).catch((error: unknown) => {
            logger.warn('[HomeV2Detail] 打开创建房间时提前加载游戏 runtime 失败', {
                gameId: game.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchOnlineMatchRoute().catch((error: unknown) => {
            logger.warn('[HomeV2Detail] 打开创建房间时提前加载房间页路由失败', {
                gameId: game.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        try {
            const namespace = `game-${game.id}`;
            if (!i18n.hasLoadedNamespace(namespace)) {
                await i18n.loadNamespaces(namespace);
            }
            const storedPreferences = readStoredLocalMatchPreferences(game);
            setInitialCreateRoomPreferences(
                storedPreferences ? stripAiSeatsFromLocalMatchPreferences(storedPreferences) : null,
            );
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
        prewarmInitialGameImages(game.id, i18n.language, '提交创建房间');
        void prefetchGameImplementation(game.id, { includeTutorial: false }).catch((error: unknown) => {
            logger.warn('[HomeV2Detail] 提交创建房间时提前加载游戏 runtime 失败', {
                gameId: game.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchOnlineMatchRoute().catch((error: unknown) => {
            logger.warn('[HomeV2Detail] 提交创建房间时提前加载房间页路由失败', {
                gameId: game.id,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        try {
            writeLocalMatchPreferences(game, stripAiSeatsFromLocalMatchPreferences({
                numPlayers: config.numPlayers,
                minimumActionDelayMs: config.minimumActionDelayMs,
                seatControllers: config.seatControllers,
                setupSelections: config.setupSelections,
            }));

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

    const handleDestroyRoomConfirm = async () => {
        if (!game || !pendingDestroyRoom || isDestroyingRoom) return;

        const { matchID } = pendingDestroyRoom;
        const storedCredentials = readStoredMatchCredentials(matchID);
        const roomSummary = matches.find((item) => item.matchID === matchID);
        const roomGameName = (roomSummary?.gameName || storedCredentials?.gameName || game.id || 'tictactoe').toLowerCase();

        setIsDestroyingRoom(true);
        try {
            let destroyPlayerID = storedCredentials?.playerID ?? '0';
            let destroyCredentials = storedCredentials?.credentials ?? null;

            if (!destroyCredentials || destroyPlayerID !== '0') {
                const claimResult = await claimSeat(roomGameName, matchID, '0', {
                    token: token ?? undefined,
                    guestId,
                    playerName: user?.username ?? guestName,
                });
                if (!claimResult.success || !claimResult.credentials) {
                    toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                    return;
                }
                destroyPlayerID = '0';
                destroyCredentials = claimResult.credentials;
            }

            let result = await destroyOwnedMatch(roomGameName, matchID, destroyPlayerID, destroyCredentials);
            if (!result.success && result.error === 'forbidden') {
                const claimResult = await claimSeat(roomGameName, matchID, '0', {
                    token: token ?? undefined,
                    guestId,
                    playerName: user?.username ?? guestName,
                });
                if (!claimResult.success || !claimResult.credentials) {
                    toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                    return;
                }
                result = await destroyOwnedMatch(roomGameName, matchID, '0', claimResult.credentials);
            }

            if (!result.success) {
                if (result.error === 'forbidden') {
                    toast.error({ kind: 'i18n', key: 'error.destroyForbidden', ns: 'lobby' });
                } else {
                    toast.error({ kind: 'i18n', key: 'error.destroyNetwork', ns: 'lobby' });
                }
                return;
            }

            setOptimisticallyRemovedRoomIds((current) => (
                current.includes(matchID) ? current : [...current, matchID]
            ));
            if (pendingPasswordRoom?.matchID === matchID) {
                setPendingPasswordRoom(null);
                setRoomPasswordDraft('');
            }
            setPendingDestroyRoom(null);
        } finally {
            setIsDestroyingRoom(false);
        }
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
                            ? 'min(calc(var(--runtime-viewport-height, 100vh) - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 0.5rem), 11.75rem)'
                            : undefined,
                        maxHeight: isCompactLandscape
                            ? undefined
                            : 'min(calc(var(--runtime-viewport-height, 100vh) - var(--safe-area-top, 0px) - var(--safe-area-bottom, 0px) - 2rem), 25rem)',
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

    const destroyRoomModal = (
        <HomeV2DangerConfirmModal
            open={activeTab === 'lobby' && Boolean(pendingDestroyRoom)}
            title={t('lobby:confirm.destroy.title', { defaultValue: '销毁房间' })}
            description={t('lobby:homeV2.confirm.destroyDescription', { defaultValue: '销毁后会立即关闭房间，所有玩家将被移出当前对局。' })}
            subject={pendingDestroyRoom ? getRoomTitle(pendingDestroyRoom.matchID, t, pendingDestroyRoom.roomName) : ''}
            cancelLabel={t('common:button.cancel')}
            confirmLabel={t('lobby:actions.destroy', { defaultValue: '销毁' })}
            processingLabel={t('common:button.processing', { defaultValue: '处理中' })}
            isProcessing={isDestroyingRoom}
            onCancel={() => setPendingDestroyRoom(null)}
            onConfirm={() => void handleDestroyRoomConfirm()}
            panelTestId="home-v2-destroy-room-panel"
            surfaceTestId="home-v2-destroy-room-surface"
            confirmTestId="home-v2-destroy-room-confirm"
            cancelTestId="home-v2-destroy-room-cancel"
        />
    );

    const hasVisibleRooms = filteredRoomPreviewItems.length > 0;
    const detailTabs: Array<{ id: HomeV2DetailTab; label: string; compactLabel: string }> = [
        { id: 'lobby', label: t('lobby:homeV2.details.onlineLobbyLabel'), compactLabel: t('lobby:homeV2.details.onlineLobbyCompactLabel', { defaultValue: '大厅' }) },
        { id: 'changelog', label: t('lobby:homeV2.detailTabs.updates', { defaultValue: '更新' }), compactLabel: t('lobby:homeV2.detailTabs.updatesCompact', { defaultValue: '更新' }) },
        { id: 'reviews', label: t('lobby:homeV2.detailTabs.reviews', { defaultValue: '评价' }), compactLabel: t('lobby:homeV2.detailTabs.reviewsCompact', { defaultValue: '评价' }) },
        { id: 'leaderboard', label: t('lobby:homeV2.detailTabs.ranking', { defaultValue: '排行榜' }), compactLabel: t('lobby:homeV2.detailTabs.rankingCompact', { defaultValue: '排行' }) },
    ];
    const roomLedgerGridClassName = isCompactLandscape
        ? 'grid-cols-[minmax(0,3.06fr)_44px_60px]'
        : 'grid-cols-[minmax(0,2.2fr)_112px_132px]';
    const showRoomThumbnail = !isCompactLandscape;
    const mobilePackageRegion = shouldShowMobilePackageRegion ? (
        <div
            data-testid="home-v2-mobile-package-region"
            className={`pointer-events-none absolute ${isCompactLandscape ? 'bottom-[34px] left-[4px]' : 'bottom-[46px] left-[10px]'} z-30`}
        >
            <button
                type="button"
                data-testid="home-v2-mobile-package-toggle"
                onClick={handleMobilePackageToggleClick}
                aria-expanded={isMobilePackageCardExpanded}
                aria-label={mobilePackageToggleMeta.label}
                title={mobilePackageToggleMeta.label}
                className={[
                    'pointer-events-auto absolute bottom-0 left-0 inline-flex items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(63,38,20,0.18)] backdrop-blur-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4328]/24',
                    isCompactLandscape ? 'h-9 w-9' : 'h-11 w-11',
                    mobilePackageToggleMeta.buttonClassName,
                    isMobilePackageCardExpanded ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100',
                ].join(' ')}
            >
                <MobilePackageToggleIcon
                    aria-hidden="true"
                    className={`${isCompactLandscape ? 'h-[14px] w-[14px]' : 'h-[18px] w-[18px]'} shrink-0 ${mobilePackageToggleMeta.iconClassName}`}
                    strokeWidth={2.2}
                />
                {mobilePackageCardDisplayState.status === 'installed' ? (
                    <span data-testid="home-v2-mobile-package-version-badge" className="sr-only">
                        {mobilePackageToggleMeta.label}
                    </span>
                ) : null}
            </button>

            {isMobilePackageCardExpanded ? (
                <div className={`pointer-events-auto absolute bottom-0 left-0 origin-bottom-left ${isCompactLandscape ? 'w-[min(13.75rem,calc(100vw-3.5rem))]' : 'w-[19rem]'}`}>
                    <GameDetailsMobilePackageCard
                        gameName={gameDisplayName}
                        state={mobilePackageCardDisplayState}
                        onInstall={handleOpenMobilePackageInstall}
                        onUpdateApp={handleRequestAndroidNativeUpdate}
                        onRetry={handleRetryPackageInstall}
                        onUninstall={handleUninstallPackageInstall}
                        failedActionLabel={packageInstallFailedActionLabel}
                        onCancel={handleCancelPackageInstall}
                        onCollapse={() => setIsMobilePackageCardExpanded(false)}
                        presentation={isAppUpdateRequiredForMobileGame ? 'update-required' : 'install'}
                        requiredAppVersion={game?.mobileDelivery?.requiredAppVersion}
                        visualStyle="home-v2"
                        className=""
                    />
                </div>
            ) : null}
        </div>
    ) : null;

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
                            icon={ownerActiveRoom
                                ? <RefreshCw aria-hidden="true" className={isCompactLandscape ? 'h-[10px] w-[10px]' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />
                                : <Plus aria-hidden="true" className={isCompactLandscape ? 'h-[10px] w-[10px]' : 'h-[18px] w-[18px]'} strokeWidth={2.2} />}
                            disabled={isLoading || isPreparingCreateRoom}
                            onClick={() => ownerActiveRoom ? void handleJoinRoom(ownerActiveRoom.matchID) : void openCreateRoom()}
                            testId={ownerActiveRoom ? 'home-v2-active-room-return-button' : 'home-v2-create-room-button'}
                        >
                            {ownerActiveRoom
                                ? t('lobby:activeMatch.return', { id: ownerActiveRoom.matchID.slice(0, 4) })
                                : t('lobby:actions.createRoom', '创建房间')}
                        </BookFrameButton>
                    </div>

                    {ownerActiveRoom ? (
                        <div
                            data-testid="home-v2-active-room-banner"
                            className={`flex items-center justify-between rounded-[2px] border border-[rgba(105,66,37,0.22)] bg-[rgba(244,230,206,0.28)] ${isCompactLandscape ? 'mt-[4px] gap-[8px] px-[8px] py-[5px]' : 'mt-[1.1%] gap-[14px] px-[14px] py-[10px]'}`}
                        >
                            <div className="min-w-0">
                                <div className={`${isCompactLandscape ? 'text-[7.1px] tracking-[0.08em]' : 'text-[11px] tracking-[0.12em]'} font-bold uppercase text-[#7b5a3e]/86`}>
                                    {t('lobby:activeMatch.notice')}
                                </div>
                                <div className={`${isCompactLandscape ? 'mt-[1px] text-[8.4px]' : 'mt-[3px] text-[clamp(13px,0.94vw,15px)]'} truncate font-semibold text-[#3f2718]`}>
                                    {getRoomTitle(ownerActiveRoom.matchID, t, ownerActiveRoom.roomName)}
                                </div>
                            </div>
                            <BookLineButton
                                className={isCompactLandscape ? 'min-h-[19px] min-w-[38px] px-[6px] text-[7.6px]' : 'min-h-[34px] min-w-[78px] px-[12px] text-[clamp(12px,0.88vw,14px)]'}
                                disabled={isDestroyingRoom}
                                onClick={() => setPendingDestroyRoom({
                                    matchID: ownerActiveRoom.matchID,
                                    roomName: ownerActiveRoom.roomName,
                                })}
                                testId="home-v2-active-room-destroy-button"
                            >
                                {t('lobby:actions.destroy', { defaultValue: '销毁' })}
                            </BookLineButton>
                        </div>
                    ) : null}

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
                                            const enabledExpansionLabels = room.publicSetupSummary?.enabledExpansions?.map((expansionId) => (
                                                resolveRoomExpansionLabel(t, room.gameName, expansionId, game)
                                            )) ?? [];
                                            const roomExpansionSummary = enabledExpansionLabels.length > 0
                                                ? `${t('lobby:rooms.enabledExpansions', { defaultValue: '扩展' })}：${enabledExpansionLabels.join(' / ')}`
                                                : '';
                                            const scenarioLabel = room.publicSetupSummary?.scenarioId
                                                ? resolveRoomScenarioLabel(t, room.gameName, room.publicSetupSummary.scenarioId, game)
                                                : resolveRoomScenarioPendingLabel(t, game);
                                            const roomScenarioSummary = scenarioLabel
                                                ? `${t('lobby:rooms.scenario', { defaultValue: '剧本' })}：${scenarioLabel}`
                                                : '';
                                            const roomSetupSummary = [roomExpansionSummary, roomScenarioSummary]
                                                .filter(Boolean)
                                                .join(' · ');
                                            const actionLabel = roomState.key === 'locked'
                                                ? t('lobby:homeV2.lockedRoomLabel')
                                                : roomState.key === 'full'
                                                    ? t('lobby:actions.spectate', { defaultValue: '观战' })
                                                    : t('lobby:actions.join', { defaultValue: '加入' });
                                            const roomButtonDisabled = isLoading || isDestroyingRoom;

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
                                                        disabled={roomButtonDisabled}
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
                                                                    {isCompactLandscape && roomSetupSummary
                                                                        ? `${getRoomSeatLine(room, t)} · ${roomSetupSummary}`
                                                                        : getRoomSeatLine(room, t)}
                                                                </div>
                                                                {!isCompactLandscape && roomExpansionSummary ? (
                                                                    <div
                                                                        data-testid={`home-v2-room-expansion-summary-${room.matchID}`}
                                                                        className="mt-[6px] truncate text-[clamp(10px,0.74vw,11px)] leading-[1.2] text-[#7b5a40]"
                                                                    >
                                                                        {roomExpansionSummary}
                                                                    </div>
                                                                ) : null}
                                                                {!isCompactLandscape && roomScenarioSummary ? (
                                                                    <div
                                                                        data-testid={`home-v2-room-scenario-summary-${room.matchID}`}
                                                                        className="mt-[6px] truncate text-[clamp(10px,0.74vw,11px)] leading-[1.2] text-[#7b5a40]"
                                                                    >
                                                                        {roomScenarioSummary}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className={`${isCompactLandscape ? 'text-[11px]' : 'text-[clamp(20px,1.36vw,24px)]'} flex h-full items-center justify-center text-center font-semibold text-[#2f1b10]`} style={{ borderLeft: '1px solid rgba(105,66,37,0.26)' }}>
                                                            {playerCount}/{totalSeats || playerCount}
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

            {mobilePackagePortalTarget
                ? createPortal(mobilePackageRegion, mobilePackagePortalTarget)
                : mobilePackageRegion}

            {passwordModal}
            {destroyRoomModal}
            <CreateRoomModal
                isOpen={showCreateRoomModal}
                onClose={() => setShowCreateRoomModal(false)}
                onConfirm={handleCreateRoom}
                gameManifest={game}
                initialPreferences={initialCreateRoomPreferences}
                isLoading={isLoading}
                visualStyle="home-v2"
            />
            {pendingPackageInstall ? (
                <GamePackageInstallConfirmModal
                    gameName={pendingPackageInstall.gameName}
                    state={packageInstallCardState}
                    modulePackId={pendingPackageInstall.modulePackId}
                    assetPackId={pendingPackageInstall.assetPackId}
                    modulePackBytes={pendingPackageInstall.modulePackBytes}
                    assetPackBytes={pendingPackageInstall.assetPackBytes}
                    isLoading={isConfirmingPackageInstall}
                    closeOnBackdrop
                    onConfirm={handleConfirmPackageInstall}
                    onRetry={handleRetryPackageInstall}
                    failedActionLabel={packageInstallFailedActionLabel}
                    onClose={handleDismissPackageInstall}
                    onCancel={handleCancelPackageInstall}
                    visualStyle="home-v2"
                />
            ) : null}
        </div>
    );
};

export { Left as GameDetailsLeft, Right as GameDetailsRight };
