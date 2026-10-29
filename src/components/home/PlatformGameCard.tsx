import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { useCoarsePointer } from '../../hooks/ui/useCoarsePointer';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { resolveGameDescription, resolveGameDisplayName } from '../lobby/gameDetailsContent';

export type PlatformCatalogGame = Pick<GameConfig, 'id' | 'titleKey' | 'descriptionKey' | 'thumbnail' | 'statusTag'>
    & Partial<Pick<GameConfig, 'playersKey' | 'category'>>;

interface PlatformGameCardProps {
    game: PlatformCatalogGame;
    mode: 'discover' | 'library';
    favorite: boolean;
    favoritePending: boolean;
    onOpen: (id: string) => void;
    onFavorite: (id: string, next: boolean) => void;
    onIntent?: (id: string) => void;
}

/** Compact rest card. Fine-pointer hover reveals title and information over the art without shifting the grid. */
export function PlatformGameCard({ game, mode, favorite, favoritePending, onOpen, onFavorite, onIntent }: PlatformGameCardProps) {
    const { t } = useTranslation(['lobby', 'common']);
    const mobile = useMobileViewport();
    const coarse = useCoarsePointer();
    const [pressed, setPressed] = useState(false);
    const title = resolveGameDisplayName(game, t);
    const description = resolveGameDescription(game, t);
    const players = game.playersKey ? t(game.playersKey, { defaultValue: game.playersKey }) : '';
    const category = game.category ? t(`common:category.${game.category}`, { defaultValue: game.category }) : '';
    const meta = [players, category].filter(Boolean).join(' · ');
    return <article className="platform-game-card" data-game-id={game.id} data-pressed={mobile && pressed || undefined}>
        <div className="platform-game-surface">
            <button type="button" className="platform-game-open" aria-label={title}
                onPointerDown={event => {
                    if (!mobile || event.pointerType === 'mouse') return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setPressed(true);
                }}
                onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)} onLostPointerCapture={() => setPressed(false)}
                onMouseEnter={() => onIntent?.(game.id)} onFocus={() => onIntent?.(game.id)} onClick={() => onOpen(game.id)}>
                <span className="platform-game-art">{game.thumbnail}</span>
                <span className="platform-game-copy"><strong>{title}</strong></span>
                <span className="platform-game-veil" aria-hidden="true">
                    <strong>{title}</strong>
                    {meta ? <small>{meta}</small> : null}
                    {description ? <p>{description}</p> : null}
                </span>
            </button>
            {mode === 'discover' && !coarse && <button type="button" className="platform-game-favorite" disabled={favoritePending} aria-pressed={favorite}
                aria-label={t(favorite ? 'platform.removeFavorite' : 'platform.addFavorite', { game: title, defaultValue: favorite ? `移出收藏：${title}` : `收藏：${title}` })}
                onClick={() => onFavorite(game.id, !favorite)}>
                <Star aria-hidden="true" size={16} fill={favorite ? 'currentColor' : 'none'} />
                <span className="platform-game-favorite-label">{t(favorite ? 'platform.saved' : 'platform.save', { defaultValue: favorite ? '已收藏' : '收藏' })}</span>
            </button>}
            {game.statusTag && <span className="platform-game-status">{t(`common:status_tags.${game.statusTag}`)}</span>}
        </div>
    </article>;
}
