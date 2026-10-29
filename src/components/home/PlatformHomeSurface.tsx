import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserMenu } from '../social/UserMenu';
import { CategoryPills, type Category } from '../layout/CategoryPills';
import { PlatformNavigation } from './PlatformNavigation';
import { PlatformGameCatalog, type PlatformCatalogGame } from './PlatformGameCatalog';
import { PlatformUploadWorkspace } from './PlatformUploadWorkspace';
import { PlatformProfile } from './PlatformProfile';
import { PlatformLibraryNews } from './PlatformLibraryNews';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { useGameLibrary } from './useGameLibrary';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import { listExternalGames } from '../../api/external-games';
import { getSessionStorage, readSessionStorageItem, writeSessionStorageItem } from '../../lib/browserStorage';
import './platform-home.css';
import './platform-motion.css';
import './platform-secondary-dialogs.css';

type HomeSection = 'discover' | 'library' | 'upload' | 'profile';
interface PlatformHomeSurfaceProps {
    brand: ReactNode;
    utility: ReactNode;
    mobileUtility?: (close: () => void, included?: ReadonlySet<string>) => ReactNode;
    games: readonly GameConfig[];
    allGames: readonly GameConfig[];
    category: Category;
    onCategory: (category: Category) => void;
    onOpenGame: (id: string) => void;
    onOpenLibraryGame: (id: string) => void;
    onLibraryHome: () => void;
    libraryDetails?: ReactNode;
    onGameIntent: (id: string) => void;
    onLogin: () => void;
    onRegister: () => void;
    onLogout: () => void;
    activeMatch: ReactNode;
}

/** The platform's view composition; game rules and room operations stay outside this owner. */
export function PlatformHomeSurface({ brand, utility, mobileUtility, games, allGames, category, onCategory, onOpenGame, onOpenLibraryGame, onLibraryHome, libraryDetails, onGameIntent, onLogin, onRegister, onLogout, activeMatch }: PlatformHomeSurfaceProps) {
    const { t } = useTranslation(['lobby', 'auth']);
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedSection = searchParams.get('section');
    const section: HomeSection = requestedSection === 'library' || requestedSection === 'upload' || requestedSection === 'profile'
        ? requestedSection : 'discover';
    useLayoutEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [section]);
    const setSection = (next: HomeSection) => setSearchParams(current => {
        const updated = new URLSearchParams(current);
        if (next === 'discover') updated.delete('section'); else updated.set('section', next);
        return updated;
    });
    const library = useGameLibrary();
    const external = useQuery({ queryKey: ['external-games'], queryFn: listExternalGames, staleTime: 30_000 });
    const mobile = useMobileViewport();
    const libraryQuery = searchParams.get('libraryQuery') ?? '';
    const discoverQuery = searchParams.get('search') ?? '';
    const setQuery = (key: 'libraryQuery' | 'search', value: string) => setSearchParams(current => {
        const updated = new URLSearchParams(current);
        if (value) updated.set(key, value); else updated.delete(key);
        return updated;
    }, { replace: true });
    const setLibraryQuery = (value: string) => setQuery('libraryQuery', value);
    const favoriteIds = useMemo(() => new Set(library.gameIds), [library.gameIds]);
    const externalGames = external.data?.items ?? [];
    const externalCards: PlatformCatalogGame[] = externalGames.map(game => ({
        id: game.gameId, titleKey: game.name, descriptionKey: game.description,
        thumbnail: game.coverUrl ? <img src={game.coverUrl} alt="" /> : <span className="platform-external-art"><small>外部游戏</small><strong>{game.name}</strong><span>{game.author}</span></span>,
    }));
    const favorites = allGames.filter(game => favoriteIds.has(game.id));
    const allCards = [...allGames, ...externalCards];
    const filteredFavorites = allCards.filter(game => favoriteIds.has(game.id) && resolveGameDisplayName(game, t).toLocaleLowerCase().includes(libraryQuery.trim().toLocaleLowerCase()));
    const visibleExternalCards = externalCards.filter(card => category === 'All' || externalGames.find(game => game.gameId === card.id)?.category === category);
    const openGame = (id: string, fromLibrary = false) => {
        if (externalGames.some(game => game.gameId === id)) {
            writeSessionStorageItem('bg-external-return', JSON.stringify({ url: location.pathname + location.search, scroll: window.scrollY }));
            navigate(`/external/${encodeURIComponent(id)}?from=${encodeURIComponent(location.pathname + location.search)}`);
        } else if (fromLibrary) onOpenLibraryGame(id); else onOpenGame(id);
    };
    useEffect(() => {
        if (external.isPending) return;
        const raw = readSessionStorageItem('bg-external-return');
        if (!raw) return;
        try {
            const previous = JSON.parse(raw) as { url?: unknown; scroll?: unknown };
            if (previous.url === location.pathname + location.search && typeof previous.scroll === 'number') {
                window.requestAnimationFrame(() => window.scrollTo({ top: previous.scroll as number, behavior: 'instant' }));
                getSessionStorage()?.removeItem('bg-external-return');
            }
        } catch { /* 列表仍可浏览；只放弃不可用的本次滚动位置。 */ }
    }, [external.isPending, location.pathname, location.search]);
    const navigation = (mobile ? ['discover', 'library'] : ['discover', 'library', 'upload']).map(id => ({ id, label: t(`platform.${id}`) }));
    return <div className="platform-home">
        <header className="platform-home-header">
            <div className="platform-home-brand">{brand}</div>
            <PlatformNavigation items={navigation} selected={section} onSelect={id => setSection(id as HomeSection)}
                menuLabel={t('platform.menu')} closeLabel={t('platform.closeMenu')} utility={utility} mobileUtility={mobileUtility}
                drawerContent={close => <button type="button" className="platform-secondary-entry" onClick={() => {
                    setSection('upload');
                    close();
                }}>{t('platform.upload')}</button>}
                account={<div className="platform-home-account">
                {user ? <UserMenu variant="platform" onLogout={onLogout} onProfile={() => setSection('profile')} /> : <>
                    <button type="button" onClick={onLogin}>{t('auth:menu.login')}</button>
                    <button type="button" onClick={onRegister}>{t('auth:menu.register')}</button>
                </>}
                </div>}
            />
        </header>
        <main className={`platform-home-main platform-home-main--${section}`}>
            {section === 'discover' || section === 'library' ? <>
                {section === 'library' && <aside className="platform-library-sidebar">
                    <button type="button" className="platform-library-home" onClick={onLibraryHome}>{t('platform.libraryHome', {defaultValue:'收藏库主页'})}</button>
                    <label className="platform-library-search"><span className="sr-only">{t('platform.search', {defaultValue:'搜索游戏'})}</span><input type="search" value={libraryQuery} placeholder={t('platform.search', {defaultValue:'搜索游戏'})} onChange={event => setLibraryQuery(event.target.value)}/></label>
                    <div className="platform-library-list">
                    {filteredFavorites.map(game => <button type="button" key={game.id} aria-current={searchParams.get('libraryGame') === game.id ? 'page' : undefined} onClick={() => openGame(game.id, true)}>
                        <span className="platform-library-thumb">{game.thumbnail}</span><strong>{resolveGameDisplayName(game, t)}</strong>
                    </button>)}
                    </div>
                </aside>}
                <div className={`platform-home-directory${section === 'library' && libraryDetails ? ' is-detail' : ''}`}>
                  {section === 'library' && libraryDetails}
                  <div hidden={section === 'library' && Boolean(libraryDetails)}>
                    {library.error && <p role="alert">{t('platform.librarySyncError')} <button type="button" onClick={() => void library.retry()}>{t('platform.retry')}</button></p>}
                    {external.isError && <p role="alert">外部游戏目录读取失败。<button type="button" onClick={() => void external.refetch()}>重试</button></p>}
                    {section === 'library' && library.isLoading ? <p role="status">{t('platform.loadingLibrary')}</p> : <PlatformGameCatalog
                        heading={t(`platform.${section}`)}
                        query={section === 'library' ? libraryQuery : discoverQuery}
                        onQueryChange={section === 'library' ? setLibraryQuery : value => setQuery('search', value)}
                        showSearch={section !== 'library' || mobile}
                        beforeGames={section === 'library' ? <PlatformLibraryNews games={favorites} /> : undefined}
                        filters={section === 'discover' ? <CategoryPills variant="platform" activeCategory={category} onSelect={onCategory} /> : undefined}
                        games={section === 'library' ? allCards : [...games, ...visibleExternalCards]} mode={section} favoriteIds={favoriteIds} favoritePending={library.isSaving}
                        onOpen={id => openGame(id, section === 'library')} onIntent={id => { if (!externalGames.some(game => game.gameId === id)) onGameIntent(id); }} onFavorite={(gameId, favorite) => {
                            void library.setFavorite({ gameId, favorite }).catch(error => toast.error(error instanceof Error ? error.message : t('platform.favoriteError')));
                        }} />}
                  </div>
                </div>
            </> : section === 'upload' ? <PlatformUploadWorkspace onLogin={onLogin} initialSubmissionId={searchParams.get('submission') ?? undefined} onBack={searchParams.get('fromProfile') ? () => {
                setSearchParams(current => { const next = new URLSearchParams(current); next.set('section', 'profile'); next.set('tab', 'submissions'); next.delete('submission'); next.delete('fromProfile'); return next; });
            } : undefined} />
                : <PlatformProfile favoriteCount={allCards.filter(game => favoriteIds.has(game.id)).length} onLogin={onLogin} tab={searchParams.get('tab') ?? 'overview'} initialGameId={searchParams.get('claimGame') ?? ''}
                    submissionFilter={searchParams.get('submissionFilter') ?? 'all'}
                    onSubmissionFilterChange={filter => setSearchParams(current => { const next = new URLSearchParams(current); if (filter === 'all') next.delete('submissionFilter'); else next.set('submissionFilter', filter); return next; }, { replace: true })}
                    onTabChange={tab => setSearchParams(current => { const next = new URLSearchParams(current); next.set('tab', tab); next.delete('claimGame'); return next; })}
                    onOpenSubmission={submissionId => {
                        writeSessionStorageItem('bg-submission-return', JSON.stringify({ userId: user?.id, filter: searchParams.get('submissionFilter') ?? 'all', scroll: window.scrollY }));
                        setSearchParams(current => { const next = new URLSearchParams(current); next.set('section', 'upload'); next.set('fromProfile', '1'); if (submissionId) next.set('submission', submissionId); else next.delete('submission'); return next; });
                    }}
                    onOpenGame={(id, preview) => navigate(`/external/${encodeURIComponent(id)}?${preview ? 'preview=1&' : ''}from=${encodeURIComponent(location.pathname + location.search)}`)} />}
        </main>
        {activeMatch && <div className="platform-active-match" data-testid="home-active-match-banner">{activeMatch}</div>}
    </div>;
}
