import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { GAME_CHANGELOG_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
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
            {eyebrow ? (
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b7453]">
                    {eyebrow}
                </div>
            ) : null}
            <div className="space-y-[0.6%]">
                <h3 className="text-[clamp(22px,2.2vw,32px)] font-bold leading-none text-[#5a3822]">
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

type HomeV2AuthMode = 'login' | 'register' | 'reset';

export function HomeV2LoginPanel({
    mode,
    onModeChange,
}: {
    mode: HomeV2AuthMode;
    onModeChange: (mode: HomeV2AuthMode) => void;
}) {
    const { t } = useTranslation(['lobby', 'auth']);
    const { user } = useAuth();

    const modeButtonClassName = `${cardSurfaceClassName} flex items-center justify-between gap-3 text-left transition-transform duration-200 hover:-translate-y-[1px]`;

    return (
        <div className="pointer-events-auto flex h-full w-full flex-col gap-[2.8%] px-[5%] py-[4.5%] text-[#5c3a24]">
            <PanelHeader
                eyebrow={t('lobby:homeV2.tabs.rooms.eyebrow')}
                title={user ? user.username : t('auth:menu.login', '登录')}
                subtitle={user ? t('lobby:homeV2.tabs.rooms.loggedInHint') : t('lobby:homeV2.tabs.rooms.loading')}
            />
            <div className="flex-1 min-h-0 overflow-hidden">
                {user ? (
                    <div className="flex h-full min-h-0 flex-col justify-center gap-3 text-center">
                        <div className={`${cardSurfaceClassName} flex min-h-[160px] flex-col items-center justify-center gap-3 px-[8%]`} style={cardSurfaceStyle}>
                            <div className="text-[clamp(18px,1.7vw,24px)] font-semibold text-[#634128]">{user.username}</div>
                            <div className="max-w-[92%] text-[clamp(12px,1vw,14px)] leading-[1.5] text-[#7a5d46]">
                                {t('lobby:homeV2.tabs.rooms.loggedInHint')}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full min-h-0 flex-col gap-3">
                        <div className={`${cardSurfaceClassName} flex-1 min-h-0`} style={cardSurfaceStyle}>
                            <div className="flex h-full min-h-0 flex-col justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9b7453]">
                                        {t('auth:menu.login', '登录')} / {t('auth:menu.register', '注册')}
                                    </div>
                                    <div className="text-[13px] leading-[1.55] text-[#6f523c]">
                                        选择左侧入口，右页表单会直接切换；默认展示登录。
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onModeChange('login')}
                                        className={modeButtonClassName}
                                        style={{
                                            ...cardSurfaceStyle,
                                            boxShadow: mode === 'login' || mode === 'reset' ? '0 10px 22px rgba(120, 80, 36, 0.16)' : undefined,
                                            transform: mode === 'login' || mode === 'reset' ? 'translateY(-1px)' : undefined,
                                        }}
                                        data-testid="home-v2-auth-mode-login"
                                    >
                                        <span>
                                            <span className="block text-[13px] font-semibold text-[#5b3822]">{t('auth:menu.login', '登录')}</span>
                                            <span className="mt-0.5 block text-[11px] text-[#8b6b4e]">账号密码直接填写</span>
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#9a6a3c]">{mode === 'login' || mode === 'reset' ? '●' : '○'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onModeChange('register')}
                                        className={modeButtonClassName}
                                        style={{
                                            ...cardSurfaceStyle,
                                            boxShadow: mode === 'register' ? '0 10px 22px rgba(120, 80, 36, 0.16)' : undefined,
                                            transform: mode === 'register' ? 'translateY(-1px)' : undefined,
                                        }}
                                        data-testid="home-v2-auth-mode-register"
                                    >
                                        <span>
                                            <span className="block text-[13px] font-semibold text-[#5b3822]">{t('auth:menu.register', '注册')}</span>
                                            <span className="mt-0.5 block text-[11px] text-[#8b6b4e]">验证码 + 用户名 + 密码</span>
                                        </span>
                                        <span className="text-[11px] font-semibold text-[#9a6a3c]">{mode === 'register' ? '●' : '○'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function HomeV2AuthFormPanel({
    mode,
    onModeChange,
}: {
    mode: HomeV2AuthMode;
    onModeChange: (mode: HomeV2AuthMode) => void;
}) {
    const { user } = useAuth();

    return (
        <div className="pointer-events-auto h-full w-full px-[5%] py-[4.5%] text-[#5c3a24]">
            {user ? (
                <div className={`${cardSurfaceClassName} flex h-full min-h-0 flex-col items-center justify-center px-[8%] text-center`} style={cardSurfaceStyle}>
                    <div className="text-[clamp(18px,1.7vw,24px)] font-semibold text-[#634128]">{user.username}</div>
                </div>
            ) : (
                <AuthModal
                    embedded
                    isOpen
                    onClose={() => undefined}
                    initialMode={mode}
                    onModeChange={onModeChange}
                    showModeSwitchFooter={false}
                />
            )}
        </div>
    );
}
