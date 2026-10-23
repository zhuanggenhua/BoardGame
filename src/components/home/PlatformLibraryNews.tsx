import { useQueries } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { getGameChangelogs } from '../../api/game-changelogs';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import { GameChangelogContent } from '../lobby/GameChangelogContent';

/** Published collection updates use cover cards; full patch notes open on demand. */
export function PlatformLibraryNews({ games }: { games: readonly GameConfig[] }) {
    const { t, i18n } = useTranslation('lobby');
    const mobile = useMobileViewport();
    const [expandedOverride, setExpanded] = useState<boolean | null>(null);
    const expanded = expandedOverride ?? !mobile;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const contentId = useId();
    const track = useRef<HTMLDivElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const results = useQueries({ queries: games.map(game => ({
        queryKey: ['game-changelogs', game.id],
        queryFn: ({ signal }: { signal: AbortSignal }) => getGameChangelogs(game.id, signal),
        staleTime: 60_000,
        retry: 1,
    })) });
    const allItems = results.flatMap((result, index) => (result.data ?? []).map(item => ({ ...item, game: games[index] })))
        .sort((a, b) => Date.parse(b.publishedAt || b.updatedAt || b.createdAt) - Date.parse(a.publishedAt || a.updatedAt || a.createdAt));
    // Library home is a summary, not a second full changelog history.
    const seenGames = new Set<string>();
    const items = allItems.filter(item => {
        if (seenGames.has(item.game.id)) return false;
        seenGames.add(item.game.id);
        return true;
    });
    const pendingNames = results.flatMap((result, index) => result.isPending ? [resolveGameDisplayName(games[index], t)] : []).join('、');
    const failedNames = results.flatMap((result, index) => result.isError ? [resolveGameDisplayName(games[index], t)] : []).join('、');
    const selected = allItems.find(item => `${item.game.id}:${item.id}` === selectedId);
    useDocumentScrollLock(Boolean(selected));
    useEffect(() => {
        if (selected && dialog.current && !dialog.current.open) dialog.current.showModal();
        if (!selected && dialog.current?.open) dialog.current.close();
    }, [selected]);
    const shift = (direction: number) => {
        const node = track.current;
        if (!node) return;
        const distance = (node.firstElementChild?.getBoundingClientRect().width ?? node.clientWidth) + 12;
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        node.scrollBy({ left: distance * direction, behavior: reduced ? 'auto' : 'smooth' });
    };
    if (!games.length) return null;
    return <section className="platform-library-news">
        <div className="platform-library-news-heading">
            <button type="button" className="platform-library-news-toggle" aria-expanded={expanded} aria-controls={`${contentId}-track`} onClick={() => setExpanded(!expanded)}>
                {t('platform.libraryNews', { defaultValue: '收藏游戏动态' })}<span aria-hidden="true">{expanded ? '−' : '+'}</span>
            </button>
            {expanded && items.length > 1 && <nav aria-label={t('platform.newsNavigation', { defaultValue: '切换动态' })}>
                <button type="button" aria-label={t('platform.previousNews', { defaultValue: '上一条动态' })} onClick={() => shift(-1)}><ChevronLeft size={20}/></button>
                <button type="button" aria-label={t('platform.nextNews', { defaultValue: '下一条动态' })} onClick={() => shift(1)}><ChevronRight size={20}/></button>
            </nav>}
        </div>
        {expanded && <div className="platform-library-news-body">
            {pendingNames && <p role="status">{t('platform.newsLoadingGames', { games: pendingNames, defaultValue: `正在加载：${pendingNames}` })}</p>}
            {failedNames && <p role="alert">{t('platform.newsFailedGames', { games: failedNames, defaultValue: `未能加载动态：${failedNames}` })} <button type="button" onClick={() => {
                for (const result of results) if (result.isError) void result.refetch();
            }}>{t('platform.retry', { defaultValue: '重试' })}</button></p>}
            {!items.length && results.every(result => result.isSuccess) && <p>{t('leaderboard.changelogEmpty')}</p>}
            <div id={`${contentId}-track`} ref={track} className="platform-library-news-track" aria-label={t('platform.libraryNews', { defaultValue: '收藏游戏动态' })}>
                {items.map(item => <button type="button" className="platform-library-news-card" key={`${item.game.id}:${item.id}`} onClick={() => setSelectedId(`${item.game.id}:${item.id}`)}>
                    <span className="platform-library-news-art" aria-hidden="true">{item.game.thumbnail}</span>
                    <span className="platform-library-news-caption">{!item.title.toLocaleLowerCase().includes(resolveGameDisplayName(item.game, t).toLocaleLowerCase()) && <span>{resolveGameDisplayName(item.game, t)}</span>}<strong>{item.title}</strong>
                        <time dateTime={item.publishedAt || item.updatedAt || item.createdAt}>{new Date(item.publishedAt || item.updatedAt || item.createdAt).toLocaleDateString(i18n.language)}</time>
                    </span>
                </button>)}
            </div>
        </div>}
        <dialog aria-labelledby={`${contentId}-title`} ref={dialog} className="platform-news-dialog" onCancel={() => setSelectedId(null)} onClose={() => setSelectedId(null)} onClick={event => { if (event.target === event.currentTarget) { dialog.current?.close(); setSelectedId(null); } }}>
            {selected && <div className="platform-news-dialog-panel">
                <header><div>{!selected.title.toLocaleLowerCase().includes(resolveGameDisplayName(selected.game, t).toLocaleLowerCase()) && <small>{resolveGameDisplayName(selected.game, t)}</small>}<h2 id={`${contentId}-title`}>{selected.title}</h2></div><button type="button" aria-label={t('platform.closeNews', { defaultValue: '关闭动态详情' })} onClick={() => { dialog.current?.close(); setSelectedId(null); }}><X size={22}/></button></header>
                <div className="platform-news-dialog-content"><GameChangelogContent content={selected.content}/></div>
            </div>}
        </dialog>
    </section>;
}
