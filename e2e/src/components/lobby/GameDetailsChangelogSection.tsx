import { useEffect, useState } from 'react';
import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GAME_CHANGELOG_API_URL } from '../../config/server';
import { logger } from '../../lib/logger';
import type { GameChangelogItem } from './gameDetailsContent';

interface GameDetailsChangelogSectionProps {
    gameId: string;
}

type GameChangelogResponse = {
    changelogs?: GameChangelogItem[];
};

type LoadedState = {
    gameId: string;
    items: GameChangelogItem[];
    error: boolean;
};

const resolveDisplayDate = (item: GameChangelogItem) => item.publishedAt || item.updatedAt || item.createdAt;

export const GameDetailsChangelogSection = ({ gameId }: GameDetailsChangelogSectionProps) => {
    const { t, i18n } = useTranslation('lobby');
    const [loadedState, setLoadedState] = useState<LoadedState | null>(null);
    const isLoading = Boolean(gameId) && loadedState?.gameId !== gameId;
    const resolvedItems = loadedState?.gameId === gameId ? loadedState.items : [];
    const resolvedError = loadedState?.gameId === gameId ? loadedState.error : false;

    useEffect(() => {
        if (!gameId) {
            return;
        }

        const controller = new AbortController();

        fetch(`${GAME_CHANGELOG_API_URL}/${encodeURIComponent(gameId)}`, {
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const payload = await response.json() as GameChangelogResponse;
                setLoadedState({
                    gameId,
                    items: Array.isArray(payload.changelogs) ? payload.changelogs : [],
                    error: false,
                });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                logger.error('[GameDetailsChangelogSection] 获取更新日志失败', {
                    gameId,
                    error,
                });
                setLoadedState({
                    gameId,
                    items: [],
                    error: true,
                });
            });

        return () => {
            controller.abort();
        };
    }, [gameId]);

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat(i18n.language, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(new Date(dateString));
        } catch {
            return dateString;
        }
    };

    return (
        <section aria-live="polite" className="space-y-3 py-1">
            {resolvedError ? (
                <div className="rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70 px-4 py-8 text-center">
                    <p className="text-sm italic text-[#8c7b64]">{t('changelog.error')}</p>
                </div>
            ) : isLoading ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-parchment-brown/20 border-t-parchment-brown" />
                    <p className="text-xs italic tracking-wider text-[#8c7b64]">{t('changelog.loading')}</p>
                </div>
            ) : resolvedItems.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[#e5e0d0] bg-[#f8f4eb]/70 px-4 py-8 text-center">
                    <p className="text-sm italic text-[#8c7b64]">{t('leaderboard.changelogEmpty')}</p>
                </div>
            ) : (
                resolvedItems.map((item) => (
                    <article
                        key={item.id}
                        className="rounded-[6px] border border-parchment-card-border/30 bg-[#fcfbf9] px-4 py-4 shadow-sm"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-base font-bold leading-tight text-parchment-base-text">
                                        {item.title}
                                    </h4>
                                    {item.versionLabel ? (
                                        <span className="rounded-full border border-parchment-card-border/40 bg-parchment-base-bg/60 px-2 py-0.5 text-[11px] font-medium text-parchment-light-text">
                                            {item.versionLabel}
                                        </span>
                                    ) : null}
                                    {item.pinned ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                            <Pin size={12} />
                                            {t('changelog.pinned')}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5b4b37]">
                                    {item.content}
                                </p>
                            </div>
                            <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-parchment-light-text/70">
                                {formatDate(resolveDisplayDate(item))}
                            </span>
                        </div>
                    </article>
                ))
            )}
        </section>
    );
};
