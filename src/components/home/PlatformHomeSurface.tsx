import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserMenu } from '../social/UserMenu';
import { CategoryPills, type Category } from '../layout/CategoryPills';
import { PlatformNavigation } from './PlatformNavigation';
import { PlatformGameCatalog } from './PlatformGameCatalog';
import { PlatformUploadWorkspace } from './PlatformUploadWorkspace';
import { PlatformProfile } from './PlatformProfile';
import { PlatformLibraryNews } from './PlatformLibraryNews';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { useGameLibrary } from './useGameLibrary';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import './platform-home.css';
import './platform-motion.css';

type HomeSection = 'discover' | 'library' | 'upload' | 'profile';
interface PlatformHomeSurfaceProps {
    brand: ReactNode;
    utility: ReactNode;
    mobileUtility?: (close: () => void) => ReactNode;
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
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedSection = searchParams.get('section');
    const section: HomeSection = requestedSection === 'library' || requestedSection === 'upload' || requestedSection === 'profile'
        ? requestedSection : 'discover';
    const setSection = (next: HomeSection) => setSearchParams(current => {
        const updated = new URLSearchParams(current);
        if (next === 'discover') updated.delete('section'); else updated.set('section', next);
        return updated;
    });
    const library = useGameLibrary();
    const mobile = useMobileViewport();
    const [libraryQuery, setLibraryQuery] = useState('');
    const favoriteIds = useMemo(() => new Set(library.gameIds), [library.gameIds]);
    const favorites = allGames.filter(game => favoriteIds.has(game.id));
    const filteredFavorites = favorites.filter(game => resolveGameDisplayName(game, t).toLocaleLowerCase().includes(libraryQuery.trim().toLocaleLowerCase()));
    const navigation = ['discover', 'library', 'upload'].map(id => ({ id, label: t(`platform.${id}`) }));
    return <div className="platform-home">
        <header className="platform-home-header">
            <div className="platform-home-brand">{brand}</div>
            <PlatformNavigation items={navigation} selected={section} onSelect={id => setSection(id as HomeSection)}
                menuLabel={t('platform.menu')} closeLabel={t('platform.closeMenu')} utility={utility} mobileUtility={mobileUtility}
 />
            <div className="platform-home-account">
                {user ? <UserMenu variant="platform" onLogout={onLogout} onProfile={() => setSection('profile')} /> : <>
                    <button type="button" onClick={onLogin}>{t('auth:menu.login')}</button>
                    <button type="button" onClick={onRegister}>{t('auth:menu.register')}</button>
                </>}
            </div>
        </header>
        <main className={`platform-home-main platform-home-main--${section}`}>
            {section === 'discover' || section === 'library' ? <>
                {section === 'library' && <aside className="platform-library-sidebar">
                    <button type="button" className="platform-library-home" onClick={onLibraryHome}>{t('platform.libraryHome', {defaultValue:'收藏库主页'})}</button>
                    <label className="platform-library-search"><span className="sr-only">{t('platform.search', {defaultValue:'搜索游戏'})}</span><input type="search" value={libraryQuery} placeholder={t('platform.search', {defaultValue:'搜索游戏'})} onChange={event => setLibraryQuery(event.target.value)}/></label>
                    <div className="platform-library-list">
                    {filteredFavorites.map(game => <button type="button" key={game.id} aria-current={searchParams.get('libraryGame') === game.id ? 'page' : undefined} onClick={() => onOpenLibraryGame(game.id)}>
                        <span className="platform-library-thumb">{game.thumbnail}</span><strong>{resolveGameDisplayName(game, t)}</strong>
                    </button>)}
                    </div>
                </aside>}
                <div className={`platform-home-directory${section === 'library' && libraryDetails ? ' is-detail' : ''}`}>
                  {section === 'library' && libraryDetails}
                  <div hidden={section === 'library' && Boolean(libraryDetails)}>
                    {library.error && <p role="alert">{t('platform.librarySyncError')} <button type="button" onClick={() => void library.retry()}>{t('platform.retry')}</button></p>}
                    {section === 'library' && library.isLoading ? <p role="status">{t('platform.loadingLibrary')}</p> : <PlatformGameCatalog
                        heading={t(`platform.${section}`)}
                        query={section === 'library' ? libraryQuery : undefined}
                        onQueryChange={section === 'library' ? setLibraryQuery : undefined}
                        showSearch={section !== 'library' || mobile}
                        beforeGames={section === 'library' ? <PlatformLibraryNews games={favorites} /> : undefined}
                        filters={section === 'discover' ? <CategoryPills activeCategory={category} onSelect={onCategory} /> : undefined}
                        games={section === 'library' ? allGames : games} mode={section} favoriteIds={favoriteIds} favoritePending={library.isSaving}
                        onOpen={section === 'library' ? onOpenLibraryGame : onOpenGame} onIntent={onGameIntent} onFavorite={(gameId, favorite) => {
                            void library.setFavorite({ gameId, favorite }).catch(error => toast.error(error instanceof Error ? error.message : t('platform.favoriteError')));
                        }} />}
                  </div>
                </div>
            </> : section === 'upload' ? <PlatformUploadWorkspace onLogin={onLogin} />
                : <PlatformProfile favoriteCount={favorites.length} onOpenGame={onOpenGame} onLogin={onLogin} />}
        </main>
        {activeMatch && <div className="platform-active-match" data-testid="home-active-match-banner">{activeMatch}</div>}
    </div>;
}
