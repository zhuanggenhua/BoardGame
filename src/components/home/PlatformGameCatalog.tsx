import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Star } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { useCoarsePointer } from '../../hooks/ui/useCoarsePointer';
import { useArmedActivation } from '../../hooks/ui/useArmedActivation';
import { resolveGameDescription, resolveGameDisplayName } from '../lobby/gameDetailsContent';
import './platform-catalog.css';

interface PlatformGameCatalogProps {
    heading?: ReactNode;
    query?: string;
    onQueryChange?: (query: string) => void;
    showSearch?: boolean;
    filters?: ReactNode;
    beforeGames?: ReactNode;
    games: readonly GameConfig[];
    favoriteIds: ReadonlySet<string>;
    mode: 'discover' | 'library';
    onOpen: (id: string) => void;
    onFavorite: (id: string, next: boolean) => void;
    favoritePending?: boolean;
    onIntent?: (id: string) => void;
}

/** Registry-backed cards. Collection data and room navigation remain caller-owned. */
export function PlatformGameCatalog({ heading, filters, beforeGames, games, favoriteIds, mode, onOpen, onFavorite, onIntent, favoritePending = false, query: controlledQuery, onQueryChange, showSearch = true }: PlatformGameCatalogProps) {
    const { t } = useTranslation(['lobby', 'common']);
    const coarsePointer = useCoarsePointer();
    const mobile = useMobileViewport();
    const [queries, setQueries] = useState({ discover: '', library: '' });
    const query = controlledQuery ?? queries[mode];
    const setQuery = (value: string) => onQueryChange ? onQueryChange(value) : setQueries(current => ({ ...current, [mode]: value }));
    const [sort, setSort] = useState('default');
    const visibleGames = useMemo(() => {
        const matching = games.filter(game => (mode !== 'library' || favoriteIds.has(game.id))
            && resolveGameDisplayName(game, t).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
        return mode === 'library' && sort === 'name' ? [...matching].sort((a, b) => resolveGameDisplayName(a, t).localeCompare(resolveGameDisplayName(b, t))) : matching;
    }, [games, favoriteIds, mode, query, sort, t]);
    const { isArmed, armOrActivate } = useArmedActivation<string>({
        requireArming: coarsePointer && mode === 'discover',
        isKeyValid: key => visibleGames.some(game => game.id === key),
    });
    return <section className={`platform-catalog platform-catalog--${mode}`}>
        {beforeGames}
        <div className="platform-catalog-header">
        {mode === 'library' ? <h1 className="platform-catalog-title">{t('platform.myGames', { defaultValue: '我的游戏' })} <small>· {visibleGames.length}</small></h1> : heading && <h1 className="platform-catalog-title">{heading}</h1>}
        {filters && <div className="platform-catalog-filters">{filters}</div>}
        <div className="platform-catalog-tools">
            {showSearch && <label>
                <span className="sr-only">{t('platform.search', { defaultValue: '搜索游戏' })}</span>
                <input type="search" value={query} placeholder={t('platform.search', { defaultValue: '搜索游戏' })}
                    onChange={event => setQuery(event.target.value)} />
            </label>}
            {mode === 'library' && <select value={sort} aria-label={t('platform.sort', { defaultValue: '排序' })} onChange={event => setSort(event.target.value)}>
                <option value="default">{mobile ? t('platform.defaultOrderShort', {defaultValue:'默认'}) : t('platform.defaultOrder', { defaultValue: '默认顺序' })}</option>
                <option value="name">{mobile ? t('platform.gameNameShort', {defaultValue:'名称'}) : t('platform.gameName', { defaultValue: '游戏名称' })}</option>
            </select>}
        </div>
        </div>
        <div className="platform-game-grid">
            {visibleGames.map(game => {
                const title = resolveGameDisplayName(game, t);
                const armed = mode === 'discover' && coarsePointer && isArmed(game.id);
                const favorite = favoriteIds.has(game.id);
                return <article key={game.id} className={`platform-game-card${armed ? ' is-expanded' : ''}`} data-game-id={game.id}>
                    <button type="button" className="platform-game-open" aria-label={title}
                        onMouseEnter={() => onIntent?.(game.id)} onFocus={() => onIntent?.(game.id)}
                        onClick={() => armOrActivate(game.id, { onActivate: () => onOpen(game.id), onArm: () => onIntent?.(game.id) })}>
                        <span className="platform-game-art">{game.thumbnail}</span>
                        <span className="platform-game-copy">
                            <strong>{title}</strong>
                            <span className="platform-game-description">{resolveGameDescription(game, t)}</span>
                            {armed && <span className="platform-game-open-hint">{t('platform.openLobby', { defaultValue: '查看房间' })}<ArrowRight size={16} aria-hidden="true"/></span>}
                        </span>
                    </button>
                    {mode === 'discover' && <button type="button" className="platform-game-favorite" disabled={favoritePending} aria-pressed={favorite}
                        aria-label={t(favorite ? 'platform.removeFavorite' : 'platform.addFavorite', { game: title, defaultValue: favorite ? `移出收藏：${title}` : `收藏：${title}` })}
                        onClick={() => onFavorite(game.id, !favorite)}>
                        <Star aria-hidden="true" size={20} fill={favorite ? 'currentColor' : 'none'} />
                    </button>}
                    {game.statusTag && <span className="platform-game-status">{t(`common:status_tags.${game.statusTag}`)}</span>}
                </article>;
            })}
        </div>
        {!visibleGames.length && <p className="platform-catalog-empty" role="status">{t(query || mode === 'discover' ? 'platform.noSearchResults' : 'platform.emptyLibrary', {
            defaultValue: query || mode === 'discover' ? '没有找到匹配的游戏' : '还没有收藏游戏，去发现页点星标添加',
        })}</p>}
    </section>;
}
