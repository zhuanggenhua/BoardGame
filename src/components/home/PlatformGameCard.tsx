import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { useCoarsePointer } from '../../hooks/ui/useCoarsePointer';
import { useMobileViewport } from '../../hooks/ui/useMobileViewport';
import { resolveGameDescription, resolveGameDisplayName } from '../lobby/gameDetailsContent';
import { ImplementationStatusRibbon } from '../game/framework/ImplementationStatusRibbon';
import type { LobbyGamePlayerCounts } from '../../hooks/useLobbyStats';

const EMPTY_PLAYER_COUNTS: LobbyGamePlayerCounts = { online: 0, waiting: 0 };

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
    playerCounts?: LobbyGamePlayerCounts;
    hasPlayerCounts?: boolean;
}

/** Compact rest card. Fine-pointer hover lifts the card and reveals title and information over the art. */
export function PlatformGameCard({ game, mode, favorite, favoritePending, onOpen, onFavorite, onIntent, playerCounts, hasPlayerCounts = false }: PlatformGameCardProps) {
    const { t } = useTranslation(['lobby', 'common']);
    const mobile = useMobileViewport();
    const coarse = useCoarsePointer();
    const [pressed, setPressed] = useState(false);
    const title = resolveGameDisplayName(game, t);
    const description = resolveGameDescription(game, t);
    const visiblePlayerCounts = hasPlayerCounts ? playerCounts ?? EMPTY_PLAYER_COUNTS : undefined;
    const players = game.playersKey ? t(game.playersKey, { defaultValue: game.playersKey }) : '';
    const category = game.category ? t(`common:category.${game.category}`, { defaultValue: game.category }) : '';
    const meta = [players, category].filter(Boolean).join(' · ');
    return <article className={`platform-game-card${mode === 'discover' && visiblePlayerCounts ? ' has-presence' : ''}`} data-game-id={game.id} data-pressed={mobile && pressed || undefined}>
        <div className="platform-game-surface">
            <button type="button" className="platform-game-open" aria-label={title}
                onPointerDown={event => {
                    if (!mobile || event.pointerType === 'mouse') return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setPressed(true);
                }}
                onPointerUp={() => setPressed(false)} onPointerCancel={() => setPressed(false)} onLostPointerCapture={() => setPressed(false)}
                onMouseEnter={() => onIntent?.(game.id)} onFocus={() => onIntent?.(game.id)} onClick={() => onOpen(game.id)}>
                <span className="platform-game-art" onDragStart={event => event.preventDefault()}>{game.thumbnail}</span>
                <span className="platform-game-veil" aria-hidden="true">
                    <strong>{title}</strong>
                    {meta ? <small>{meta}</small> : null}
                    {description ? <p>{description}</p> : null}
                </span>
            </button>
            <span className="platform-game-copy">
                <strong aria-hidden="true" title={title}>{title}</strong>
                {mode === 'discover' && visiblePlayerCounts && <span className="platform-game-presence" aria-label={t('homeV2.gamePresence.label', { online: visiblePlayerCounts.online, waiting: visiblePlayerCounts.waiting })}>
                    <span>{t('homeV2.gamePresence.online', { count: visiblePlayerCounts.online })}</span>
                    <span>{t('homeV2.gamePresence.waiting', { count: visiblePlayerCounts.waiting })}</span>
                </span>}
            </span>
            {mode === 'discover' && !coarse && <button type="button" className="platform-game-favorite" disabled={favoritePending} aria-pressed={favorite}
                aria-label={t(favorite ? 'platform.removeFavorite' : 'platform.addFavorite', { game: title, defaultValue: favorite ? `移出收藏：${title}` : `收藏：${title}` })}
                onClick={() => onFavorite(game.id, !favorite)}>
                <Star aria-hidden="true" size={18} fill={favorite ? 'currentColor' : 'none'} />
            </button>}
            {mode === 'discover' && coarse && favorite && <span className="platform-game-favorite-marker" aria-label={t('platform.favorited', { defaultValue: '已收藏' })}>
                <Star aria-hidden="true" size={22} fill="currentColor" />
            </span>}
            {game.statusTag && <ImplementationStatusRibbon unit="var(--platform-card-status-unit)" className="platform-game-status" label={t(`common:status_tags.${game.statusTag}`)} testId={`platform-status-ribbon-${game.id}`} />}
        </div>
    </article>;
}
