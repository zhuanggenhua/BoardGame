import { cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const HOVER_PREVIEW_DELAY_MS = 160;

/** Compact rest card; fine-pointer hover raises the cover and opens a side title/art/info panel. */
export function PlatformGameCard({ game, mode, favorite, favoritePending, onOpen, onFavorite, onIntent }: PlatformGameCardProps) {
    const { t } = useTranslation(['lobby', 'common']);
    const mobile = useMobileViewport();
    const coarse = useCoarsePointer();
    const [pressed, setPressed] = useState(false);
    const [preview, setPreview] = useState(false);
    const [previewSide, setPreviewSide] = useState<'right' | 'left'>('right');
    const [artSrc, setArtSrc] = useState('');
    const cardRef = useRef<HTMLElement>(null);
    const previewRef = useRef<HTMLElement>(null);
    const delayRef = useRef(0);
    const title = resolveGameDisplayName(game, t);
    const description = resolveGameDescription(game, t);
    const players = game.playersKey ? t(game.playersKey, { defaultValue: game.playersKey }) : '';
    const category = game.category ? t(`common:category.${game.category}`, { defaultValue: game.category }) : '';
    const meta = [players, category].filter(Boolean).join(' · ');
    const previewArt = isValidElement(game.thumbnail) ? cloneElement(game.thumbnail) : game.thumbnail;
    const clearPreviewTimer = () => {
        window.clearTimeout(delayRef.current);
        delayRef.current = 0;
    };
    const hidePreview = useCallback(() => {
        clearPreviewTimer();
        setPreview(false);
        setPreviewSide('right');
    }, []);
    const schedulePreview = () => {
        if (coarse) return;
        clearPreviewTimer();
        delayRef.current = window.setTimeout(() => setPreview(true), HOVER_PREVIEW_DELAY_MS);
    };
    useLayoutEffect(() => {
        if (!preview || !cardRef.current) return;
        const img = cardRef.current.querySelector('.platform-game-art img');
        setArtSrc(img instanceof HTMLImageElement ? (img.currentSrc || img.src) : '');
        if (!previewRef.current) return;
        const cardBox = cardRef.current.getBoundingClientRect();
        setPreviewSide(cardBox.right + previewRef.current.offsetWidth > window.innerWidth - 12 ? 'left' : 'right');
    }, [preview]);
    useEffect(() => {
        if (!preview) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hidePreview(); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('scroll', hidePreview, true);
        window.addEventListener('resize', hidePreview);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', hidePreview, true);
            window.removeEventListener('resize', hidePreview);
        };
    }, [hidePreview, preview]);
    useEffect(() => () => clearPreviewTimer(), []);
    return <article ref={cardRef} className="platform-game-card" data-game-id={game.id}
        data-preview-side={preview ? previewSide : undefined} data-pressed={mobile && pressed || undefined}
        onMouseEnter={schedulePreview} onMouseLeave={hidePreview} onFocus={schedulePreview} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) hidePreview();
        }}>
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
            </button>
            {mode === 'discover' && !coarse && <button type="button" className="platform-game-favorite" disabled={favoritePending} aria-pressed={favorite}
                aria-label={t(favorite ? 'platform.removeFavorite' : 'platform.addFavorite', { game: title, defaultValue: favorite ? `移出收藏：${title}` : `收藏：${title}` })}
                onClick={() => onFavorite(game.id, !favorite)}>
                <Star aria-hidden="true" size={16} fill={favorite ? 'currentColor' : 'none'} />
                <span className="platform-game-favorite-label">{t(favorite ? 'platform.saved' : 'platform.save', { defaultValue: favorite ? '已收藏' : '收藏' })}</span>
            </button>}
            {game.statusTag && <span className="platform-game-status">{t(`common:status_tags.${game.statusTag}`)}</span>}
        </div>
        {preview && <aside ref={previewRef} className="platform-game-hover-preview" data-preview-side={previewSide} aria-hidden="true">
            <div className="platform-game-hover-preview-art">{artSrc ? <img src={artSrc} alt="" /> : previewArt}</div>
            <div className="platform-game-hover-preview-copy">
                <strong>{title}</strong>
                {description ? <p>{description}</p> : null}
                {meta ? <small>{meta}</small> : null}
            </div>
        </aside>}
    </article>;
}
