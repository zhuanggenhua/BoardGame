import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { GAME_CHANGELOG_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useLobbyStats } from '../../hooks/useLobbyStats';
import { logger } from '../../lib/logger';
import { AuthModal } from '../auth/AuthModal';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';

type OpenGameHandler = (gameId: string) => void;

type ChangelogEntry = {
    id: string;
    gameId: string;
    title: string;
    content: string;
    publishedAt?: string;
    updatedAt?: string;
    createdAt?: string;
    pinned?: boolean;
};

const HOME_V2_ASSET_ROOT = '/assets/common/images/home-v2';
const HOME_V2_HOLDER_BG = `${HOME_V2_ASSET_ROOT}/holders/compressed/1.webp`;
const cardSurfaceClassName = 'rounded-[16px] border border-[#8c6644]/45 px-[4.8%] py-[4.5%] shadow-[0_8px_20px_rgba(120,80,36,0.08)]';
const cardSurfaceStyle = {
    backgroundImage: `url(${HOME_V2_HOLDER_BG})`,
    backgroundSize: '100% 100%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
} satisfies React.CSSProperties;

function HolderActionButton({
    onClick,
    children,
}: {
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex min-h-[34px] min-w-[120px] items-center justify-center bg-transparent px-[16px] py-[8px] text-[clamp(10px,0.78vw,11px)] font-bold text-[#5d3923] transition-transform duration-200 hover:-translate-y-[1px]"
            style={{
                borderStyle: 'solid',
                borderWidth: '10px 14px',
                borderImageSource: `url("${HOME_V2_HOLDER_BG}")`,
                borderImageSlice: '38 38 38 38 fill',
                borderImageRepeat: 'round',
            }}
        >
            {children}
        </button>
    );
}

function PanelHeader({
    eyebrow,
    title,
    subtitle,
}: {
    eyebrow: string;
    title: string;
    subtitle?: string;
}) {
    return (
        <header className="space-y-[0.8%]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b7453]">
                {eyebrow}
            </div>
            <div className="space-y-[0.6%]">
                <h3 className="text-[clamp(18px,2vw,30px)] font-bold leading-none text-[#5a3822]">
                    {title}
                </h3>
                {subtitle ? (
                    <p className="max-w-[92%] text-[clamp(10px,0.92vw,13px)] leading-[1.45] text-[#7a5d46] line-clamp-1">
                        {subtitle}
                    </p>
                ) : null}
            </div>
        </header>
    );
}

function SpinnerLabel({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-4 text-[#86634a]">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#c89f76]/30 border-t-[#8f6440]" />
            <div className="text-[12px] italic tracking-[0.16em]">{label}</div>
        </div>
    );
}

function EmptyState({
    title,
}: {
    title: string;
}) {
    return (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[16px] border border-[#9d724f]/45 bg-[rgba(93,63,40,0.08)] px-[7%] text-center text-[#7d614a]">
            <div className="text-[clamp(18px,1.7vw,24px)] font-semibold text-[#634128]">{title}</div>
        </div>
    );
}

function formatDisplayDate(dateString?: string, locale = 'zh-CN') {
    if (!dateString) return '';
    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(dateString));
    } catch {
        return dateString;
    }
}

export function HomeV2RoomsPanel({
    games,
    onOpenGame,
}: {
    games: GameConfig[];
    onOpenGame: OpenGameHandler;
}) {
    const { t } = useTranslation(['lobby', 'common']);
    const { matches, hasSnapshot } = useLobbyStats();
    const gameMap = React.useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
    const visibleMatches = React.useMemo(
        () => matches
            .filter((match) => gameMap.has(match.gameName))
            .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
            .slice(0, 6),
        [gameMap, matches],
    );

    return (
        <div className="pointer-events-auto flex h-full w-full flex-col gap-[2.8%] px-[5%] py-[4.5%] text-[#5c3a24]">
            <PanelHeader
                eyebrow={t('lobby:homeV2.tabs.rooms.eyebrow')}
                title={t('lobby:homeV2.roomLedgerTitle')}
            />
            <div className="flex-1 min-h-0 overflow-hidden px-[1.4%] py-[1%]">
                {!hasSnapshot ? (
                    <SpinnerLabel label={t('lobby:homeV2.tabs.rooms.loading')} />
                ) : visibleMatches.length === 0 ? (
                    <EmptyState
                        title={t('lobby:homeV2.tabs.rooms.emptyTitle')}
                    />
                ) : (
                    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1">
                        {visibleMatches.map((match) => {
                            const game = gameMap.get(match.gameName);
                            if (!game) return null;
                            const title = match.roomName?.trim() || t('lobby:homeV2.roomTitleFallback', {
                                id: match.matchID.slice(0, 4).toUpperCase(),
                            });
                            const totalSeats = Math.max(match.totalSeats ?? 0, match.players.length);
                            const playerCount = match.players.length;
                            const gameLabel = resolveGameDisplayName(game, t, game.id);
                            const lockLabel = match.isLocked ? t('lobby:homeV2.lockedRoomLabel') : null;

                            return (
                                <button
                                    key={match.matchID}
                                    type="button"
                                    onClick={() => onOpenGame(game.id)}
                                    className="flex w-full items-center justify-between gap-2 rounded-[14px] px-3 py-2 text-left transition-transform duration-200 hover:-translate-y-[1px]"
                                    style={{
                                        borderStyle: 'solid',
                                        borderWidth: '10px 14px',
                                        borderImageSource: `url("${HOME_V2_HOLDER_BG}")`,
                                        borderImageSlice: '38 38 38 38 fill',
                                        borderImageRepeat: 'round',
                                    }}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[14px] font-semibold text-[#5b3822]">{title}</div>
                                        <div className="mt-0.5 truncate text-[11px] text-[#7c5d44]">
                                            {gameLabel} ·{' '}
                                            {t('lobby:homeV2.tabs.rooms.playerSummary', {
                                                players: playerCount,
                                                seats: totalSeats,
                                            })}
                                            {lockLabel ? ` · ${lockLabel}` : ''}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-[11px] font-semibold text-[#a0693c]">
                                        →
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function HomeV2ChangelogPanel({
    games,
    onOpenGame,
}: {
    games: GameConfig[];
    onOpenGame: OpenGameHandler;
}) {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const [items, setItems] = React.useState<ChangelogEntry[] | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        const targetGames = games.filter((game) => game.type === 'game').slice(0, 8);
        setItems(null);

        void (async () => {
            const settled = await Promise.allSettled(targetGames.map(async (game) => {
                const response = await fetch(`${GAME_CHANGELOG_API_URL}/${encodeURIComponent(game.id)}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const payload = await response.json() as { changelogs?: ChangelogEntry[] };
                return (payload.changelogs ?? []).map((item) => ({ ...item, gameId: game.id }));
            }));

            if (cancelled) return;

            const merged = settled.flatMap((result) => {
                if (result.status === 'fulfilled') return result.value;
                logger.warn?.('[HomeV2ChangelogPanel] 获取更新日志失败', result.reason);
                return [];
            });

            merged.sort((a, b) => {
                const left = new Date(a.publishedAt || a.updatedAt || a.createdAt || 0).getTime();
                const right = new Date(b.publishedAt || b.updatedAt || b.createdAt || 0).getTime();
                return right - left;
            });

            setItems(merged.slice(0, 6));
        })();

        return () => {
            cancelled = true;
        };
    }, [games]);

    return (
        <div className="pointer-events-auto flex h-full w-full flex-col gap-[2.8%] px-[5%] py-[4.5%] text-[#5c3a24]">
            <PanelHeader
                eyebrow={t('lobby:homeV2.tabs.changelog.eyebrow')}
                title={t('lobby:homeV2.tabs.changelog.title')}
            />
            <div className={`${cardSurfaceClassName} flex-1 min-h-0 overflow-hidden`} style={cardSurfaceStyle}>
                {items === null ? (
                    <SpinnerLabel label={t('lobby:homeV2.tabs.changelog.loading')} />
                ) : items.length === 0 ? (
                    <EmptyState
                        title={t('lobby:homeV2.tabs.changelog.emptyTitle')}
                    />
                ) : (
                    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1">
                        {items.map((item) => {
                            const game = games.find((entry) => entry.id === item.gameId);
                            const gameLabel = game ? resolveGameDisplayName(game, t, game.id) : item.gameId;
                            return (
                                <button
                                    key={`${item.gameId}-${item.id}`}
                                    type="button"
                                    onClick={() => onOpenGame(item.gameId)}
                                    className="rounded-[14px] px-3 py-2 text-left transition-transform duration-200 hover:-translate-y-[1px]"
                                    style={{
                                        borderStyle: 'solid',
                                        borderWidth: '10px 14px',
                                        borderImageSource: `url("${HOME_V2_HOLDER_BG}")`,
                                        borderImageSlice: '38 38 38 38 fill',
                                        borderImageRepeat: 'round',
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9c724f]">
                                                {gameLabel}
                                            </div>
                                            <div className="mt-0.5 line-clamp-2 text-[13px] font-semibold text-[#5b3822]">
                                                {item.title}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-[10px] text-[#9a7759]">
                                            {formatDisplayDate(item.publishedAt || item.updatedAt || item.createdAt, i18n.language)}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function HomeV2LoginPanel() {
    const { t } = useTranslation(['lobby', 'auth']);
    const { user } = useAuth();
    const { openModal, closeModal } = useModalStack();
    const authModalIdRef = React.useRef<string | null>(null);

    const openAuth = React.useCallback((mode: 'login' | 'register') => {
        if (authModalIdRef.current) {
            closeModal(authModalIdRef.current);
            authModalIdRef.current = null;
        }
        authModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                authModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <AuthModal
                    isOpen
                    onClose={close}
                    initialMode={mode}
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
    }, [closeModal, openModal]);

    React.useEffect(() => () => {
        if (authModalIdRef.current) {
            closeModal(authModalIdRef.current);
            authModalIdRef.current = null;
        }
    }, [closeModal]);

    return (
        <div className="pointer-events-auto flex h-full w-full flex-col gap-[2.8%] px-[5%] py-[4.5%] text-[#5c3a24]">
            <PanelHeader
                eyebrow={t('lobby:homeV2.tabs.rooms.eyebrow')}
                title={user ? user.username : t('lobby:homeV2.tabs.rooms.title')}
            />
            <div className={`${cardSurfaceClassName} flex-1 min-h-0 overflow-hidden`} style={cardSurfaceStyle}>
                {user ? (
                    <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
                        <div className="max-w-[92%] text-[clamp(10px,0.9vw,12px)] leading-[1.5] text-[#7a5d46]">
                            {t('lobby:homeV2.tabs.rooms.loggedInHint')}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <HolderActionButton onClick={() => openAuth('login')}>
                                {t('auth:menu.login', '登录')}
                            </HolderActionButton>
                            <HolderActionButton onClick={() => openAuth('register')}>
                                {t('auth:menu.register', '注册')}
                            </HolderActionButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
