import React from 'react';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { GAME_CHANGELOG_API_URL } from '../../config/server';
import { assetsPath } from '../../core/AssetLoader';
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

const cardSurfaceClassName = 'px-[4.8%] py-[4.5%]';
const HOME_V2_ASSET_ROOT = 'common/images/home-v2';
const HOME_V2_HOLDER_BG = assetsPath(`${HOME_V2_ASSET_ROOT}/holders/compressed/1.webp`);
const cardSurfaceStyle = {
    border: '1px solid rgba(159,111,75,0.28)',
    borderRadius: '16px',
    background: 'linear-gradient(180deg, rgba(249,235,210,0.82) 0%, rgba(245,226,194,0.68) 100%)',
    boxShadow: '0 12px 26px rgba(74,48,29,0.08)',
} satisfies React.CSSProperties;
const authPlainSurfaceClassName = 'h-full min-h-0 overflow-hidden';

const authModeTabs: Array<{ mode: HomeV2AuthMode; testId: string }> = [
    { mode: 'login', testId: 'home-v2-auth-mode-login' },
    { mode: 'register', testId: 'home-v2-auth-mode-register' },
    { mode: 'reset', testId: 'home-v2-auth-mode-reset' },
];

function getAuthModeLabel(t: ReturnType<typeof useTranslation>['t'], mode: HomeV2AuthMode) {
    switch (mode) {
        case 'register':
            return t('auth:menu.register');
        case 'reset':
            return t('auth:login.forgot');
        case 'login':
        default:
            return t('auth:menu.login');
    }
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
            {eyebrow ? (
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9b7453]">
                    {eyebrow}
                </div>
            ) : null}
            <div className="space-y-[0.6%]">
                <h3 className="text-[clamp(19px,1.84vw,25px)] font-bold leading-none text-[#5a3822]">
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
    const featureItems = [
        {
            title: t('lobby:homeV2.tabs.rooms.brandFeatureStrategyTitle'),
            description: t('lobby:homeV2.tabs.rooms.brandFeatureStrategyDescription'),
        },
        {
            title: t('lobby:homeV2.tabs.rooms.brandFeatureBattleTitle'),
            description: t('lobby:homeV2.tabs.rooms.brandFeatureBattleDescription'),
        },
        {
            title: t('lobby:homeV2.tabs.rooms.brandFeaturePartyTitle'),
            description: t('lobby:homeV2.tabs.rooms.brandFeaturePartyDescription'),
        },
    ];

    return (
        <div className="pointer-events-auto relative flex h-full w-full flex-col px-[6%] py-[5%] text-[#5c3a24]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[18%] h-[42%] w-[58%] -translate-x-1/2 rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle at center, rgba(112,92,63,0.16) 0%, rgba(112,92,63,0.08) 38%, rgba(112,92,63,0) 74%)',
                }}
            />
            <div className="relative flex h-full min-h-0 flex-col">
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
                    <div className="flex h-full min-h-0 flex-col">
                        <div className="pt-[10%] text-center">
                            <div className="text-[clamp(46px,4.1vw,68px)] font-bold tracking-[0.08em] text-[#4d3120]">
                                {t('lobby:homeV2.tabs.rooms.brandTitle')}
                            </div>
                            <div className="mt-[2.8%] text-[clamp(12px,1vw,15px)] font-semibold tracking-[0.24em] text-[#7a5a40]">
                                {t('lobby:homeV2.tabs.rooms.brandSubtitle')}
                            </div>
                        </div>

                        <div className="mt-[15%] flex flex-1 min-h-0 flex-col justify-center gap-[5.4%]">
                            {featureItems.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="flex items-start gap-[10px]">
                                    <div className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#8b6643]/70 shadow-[0_0_0_3px_rgba(196,161,123,0.15)]" />
                                    <div className="min-w-0">
                                        <div className="text-[clamp(16px,1.28vw,19px)] font-semibold text-[#5a3923]">
                                            {item.title}
                                        </div>
                                        <div className="mt-[4px] text-[clamp(11px,0.92vw,13px)] leading-[1.6] text-[#7a5d46]">
                                            {item.description}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-[7%] border-t border-[rgba(164,118,78,0.16)] pt-[4.4%]">
                            <div className="mb-[2.2%] text-center text-[clamp(9px,0.76vw,10px)] font-semibold uppercase tracking-[0.22em] text-[#9a7759]">
                                {t('lobby:homeV2.tabs.rooms.accountActionLabel')}
                            </div>
                            <div className="flex items-center justify-center gap-[18px]">
                            {authModeTabs.map(({ mode: tabMode, testId }) => {
                                const active = mode === tabMode || (tabMode === 'login' && mode === 'reset');
                                return (
                                    <button
                                        key={tabMode}
                                        type="button"
                                        onClick={() => onModeChange(tabMode)}
                                        className={`relative pb-[4px] text-[clamp(12px,0.96vw,13px)] font-semibold transition-colors ${
                                            active ? 'text-[#5b3822]' : 'text-[#8d6c50] hover:text-[#6f4b32]'
                                        }`}
                                        data-testid={testId}
                                    >
                                            {getAuthModeLabel(t, tabMode)}
                                            {active ? (
                                                <span
                                                    aria-hidden="true"
                                                    className="absolute bottom-0 left-1/2 h-px w-[80%] -translate-x-1/2 bg-[linear-gradient(90deg,rgba(122,90,55,0)_0%,rgba(122,90,55,0.95)_20%,rgba(122,90,55,0.95)_80%,rgba(122,90,55,0)_100%)]"
                                                />
                                            ) : null}
                                    </button>
                                );
                            })}
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
    const { t } = useTranslation(['lobby', 'auth']);

    return (
        <div className="pointer-events-auto h-full w-full px-[6.2%] py-[5.6%] text-[#5c3a24]">
            {user ? (
                <div className={`${authPlainSurfaceClassName} flex h-full min-h-0 flex-col items-center justify-center px-[8%] text-center`} style={cardSurfaceStyle}>
                    <div className="text-[clamp(18px,1.7vw,24px)] font-semibold text-[#634128]">{user.username}</div>
                </div>
            ) : (
                <div className={authPlainSurfaceClassName} data-testid="auth-embedded-panel">
                    <div className="mx-auto flex h-full min-h-0 max-w-[94%] flex-col">
                        <div className="mb-[4.5%] flex items-center justify-center gap-[34px] pt-[1.4%]">
                            {authModeTabs.map(({ mode: tabMode, testId }) => {
                                const active = mode === tabMode;
                                return (
                                    <button
                                        key={`top-${tabMode}`}
                                        type="button"
                                        data-testid={`${testId}-header`}
                                        onClick={() => onModeChange(tabMode)}
                                        className={`relative pb-[4px] text-[clamp(12px,0.96vw,14px)] font-semibold transition-colors ${active ? 'text-[#5b3822]' : 'text-[#8c7459] hover:text-[#6f4b32]'}`}
                                    >
                                        {getAuthModeLabel(t, tabMode)}
                                        {active ? (
                                            <span
                                                aria-hidden="true"
                                                className="absolute bottom-0 left-1/2 h-px w-[82%] -translate-x-1/2 bg-[linear-gradient(90deg,rgba(122,90,55,0)_0%,rgba(122,90,55,0.95)_18%,rgba(122,90,55,0.95)_82%,rgba(122,90,55,0)_100%)]"
                                            />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                        <div
                            aria-hidden="true"
                            className="mb-[4.5%] h-px w-full bg-[linear-gradient(90deg,rgba(143,102,66,0)_0%,rgba(143,102,66,0.34)_16%,rgba(143,102,66,0.34)_84%,rgba(143,102,66,0)_100%)]"
                        />
                        <div className="min-h-0 flex-1">
                            <AuthModal
                                embedded
                                isOpen
                                onClose={() => undefined}
                                initialMode={mode}
                                onModeChange={onModeChange}
                                showModeSwitchFooter={false}
                                showTitle={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
