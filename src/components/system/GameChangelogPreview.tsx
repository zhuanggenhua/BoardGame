import { useEffect, useState } from 'react';
import { Pin, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAllGames, getGameById } from '../../config/games.config';
import { GAME_CHANGELOG_API_URL } from '../../config/server';
import { logger } from '../../lib/logger';
import { resolveGameDisplayName, type GameChangelogItem } from '../lobby/gameDetailsContent';

type ChangelogPreviewState = {
    items: GameChangelogItem[];
    loading: boolean;
    error: boolean;
};

const MAX_GAMES_TO_QUERY = 8;
const MAX_ITEMS_TO_SHOW = 4;

const resolveItemDate = (item: GameChangelogItem) => item.publishedAt || item.updatedAt || item.createdAt;

const formatDate = (value: string | null | undefined, locale: string) => {
    if (!value) {
        return '';
    }

    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(value));
    } catch {
        return value;
    }
};

export const GameChangelogPreview = () => {
    const { t, i18n } = useTranslation('lobby');
    const [state, setState] = useState<ChangelogPreviewState>({
        items: [],
        loading: true,
        error: false,
    });

    useEffect(() => {
        const controller = new AbortController();
        const targetGames = getAllGames()
            .filter((game) => game.type === 'game')
            .slice(0, MAX_GAMES_TO_QUERY);

        void (async () => {
            const settled = await Promise.allSettled(targetGames.map(async (game) => {
                const response = await fetch(`${GAME_CHANGELOG_API_URL}/${encodeURIComponent(game.id)}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const payload = await response.json() as { changelogs?: GameChangelogItem[] };
                return (payload.changelogs ?? [])
                    .filter((item) => item.published !== false)
                    .map((item) => ({ ...item, gameId: game.id }));
            }));

            if (controller.signal.aborted) {
                return;
            }

            const items = settled.flatMap((result) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }

                logger.warn?.('[GameChangelogPreview] 获取游戏更新日志失败', result.reason);
                return [];
            });

            items.sort((left, right) => (
                new Date(resolveItemDate(right)).getTime() - new Date(resolveItemDate(left)).getTime()
            ));

            setState({
                items: items.slice(0, MAX_ITEMS_TO_SHOW),
                loading: false,
                error: items.length === 0 && settled.some((result) => result.status === 'rejected'),
            });
        })();

        return () => {
            controller.abort();
        };
    }, []);

    return (
        <section
            data-testid="app-update-game-changelog"
            aria-live="polite"
            className="mt-6 border-t border-white/10 pt-5 text-left"
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200/15 bg-amber-100/5 text-amber-200/80">
                    <ScrollText size={17} />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/60">
                        {t('changelog.title')}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-amber-50">
                        {t('homeV2.tabs.changelog.description', { defaultValue: '查看最近更新记录。' })}
                    </h3>
                </div>
            </div>

            {state.loading ? (
                <p className="mt-3 text-xs leading-5 text-amber-100/55">
                    {t('changelog.loading')}
                </p>
            ) : state.error ? (
                <p className="mt-3 text-xs leading-5 text-amber-100/55">
                    {t('changelog.error')}
                </p>
            ) : state.items.length === 0 ? (
                <p className="mt-3 text-xs leading-5 text-amber-100/55">
                    {t('leaderboard.changelogEmpty')}
                </p>
            ) : (
                <div className="mt-3 max-h-[min(28vh,15rem)] space-y-2 overflow-y-auto pr-1">
                    {state.items.map((item) => {
                        const game = getGameById(item.gameId);
                        const gameLabel = game
                            ? resolveGameDisplayName(game, t, game.id)
                            : item.gameId;

                        return (
                            <article
                                key={`${item.gameId}-${item.id}`}
                                className="rounded-xl border border-amber-200/10 bg-black/15 px-3 py-2.5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/55">
                                            {gameLabel}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-amber-50">
                                            {item.title}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[10px] text-amber-100/45">
                                        {formatDate(resolveItemDate(item), i18n.language)}
                                    </span>
                                </div>
                                <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-5 text-amber-100/62">
                                    {item.content}
                                </p>
                                {item.pinned ? (
                                    <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-amber-200/65">
                                        <Pin size={11} />
                                        {t('changelog.pinned')}
                                    </span>
                                ) : null}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default GameChangelogPreview;
