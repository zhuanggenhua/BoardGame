import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { getOptimizedImageUrls } from '../../core/AssetLoader';
import { resolveGameDescription, resolveGameDisplayName } from './gameDetailsContent';

const HOME_V2_HOLDER_BG = getOptimizedImageUrls('/assets/common/images/home-v2/holders/1.png').webp;

export interface GameListCardProps {
    game: GameConfig;
    index: number;
    onGameClick: (id: string) => void;
    onGameIntent?: (id: string) => void;
    mostPopularGameId?: string | null;
    className?: string;
    style?: CSSProperties;
    variant?: 'default' | 'homeV2Compact';
}

export const GameListCard = ({
    game,
    index,
    onGameClick,
    onGameIntent,
    mostPopularGameId,
    className,
    style,
    variant = 'default',
}: GameListCardProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const title = resolveGameDisplayName(game, t, game.id);

    if (variant === 'homeV2Compact') {
        return (
            <a
                data-game-id={game.id}
                href={`/?game=${game.id}`}
                onClick={(e) => {
                    e.preventDefault();
                    onGameClick(game.id);
                }}
                onMouseEnter={() => onGameIntent?.(game.id)}
                onFocus={() => onGameIntent?.(game.id)}
                onPointerDown={() => onGameIntent?.(game.id)}
                className={`group relative flex w-full flex-col items-center justify-start cursor-pointer no-underline ${className ?? ''}`}
                style={{
                    animation: 'game-card-fade-in 360ms ease-out both',
                    animationDelay: `${Math.min(index, 8) * 45}ms`,
                    ...style,
                }}
            >
                <div className="relative flex w-full justify-center">
                    <div
                        className="relative w-full bg-center bg-no-repeat transition-transform duration-200 group-hover:-translate-y-[1px]"
                        style={{
                            aspectRatio: '1 / 1',
                            backgroundImage: `url(${HOME_V2_HOLDER_BG})`,
                            backgroundSize: '100% 100%',
                            backgroundPosition: 'center',
                        }}
                    >
                        <div className="absolute inset-[11%] overflow-hidden rounded-[4px] bg-[#ead9ba]">
                            <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]">
                                {game.thumbnail ? (
                                    game.thumbnail
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[clamp(20px,2vw,28px)] text-[#7c5c42]">
                                        {game.icon}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <h3 className="mt-[6%] line-clamp-3 max-w-[122%] text-center text-[clamp(10px,0.92vw,14px)] font-medium leading-[1.08] text-[#f7e6bc] [text-shadow:0_1px_2px_rgba(66,38,19,0.45)]">
                    {title}
                </h3>
            </a>
        );
    }

    return (
        <a
            data-game-id={game.id}
            href={`/?game=${game.id}`}
            onClick={(e) => {
                e.preventDefault();
                onGameClick(game.id);
            }}
            onMouseEnter={() => onGameIntent?.(game.id)}
            onFocus={() => onGameIntent?.(game.id)}
            onPointerDown={() => onGameIntent?.(game.id)}
            className={`
                group relative cursor-pointer
                flex flex-col
                bg-parchment-card-bg
                w-full max-w-none mx-auto sm:max-w-[190px]
                p-2 sm:p-2.5
                rounded-sm
                shadow-parchment-card
                hover:shadow-parchment-card-hover
                transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-1
                no-underline
                ${className ?? ''}
            `}
            style={{
                animation: 'game-card-fade-in 360ms ease-out both',
                animationDelay: `${Math.min(index, 8) * 45}ms`,
                ...style,
            }}
        >
            <div className="absolute top-[4px] left-[4px] w-2 h-2 border-t-2 border-l-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-[4px] right-[4px] w-2 h-2 border-t-2 border-r-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-[4px] left-[4px] w-2 h-2 border-b-2 border-l-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-[4px] right-[4px] w-2 h-2 border-b-2 border-r-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="w-full aspect-[4/3] mb-1.5 relative overflow-hidden rounded-sm bg-slate-900 ring-1 ring-black/5">
                <div className="w-full h-full transition-transform duration-500 group-hover:scale-110">
                    {game.thumbnail ? (
                        game.thumbnail
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl text-parchment-base-text">
                            {game.icon}
                        </div>
                    )}
                </div>
            </div>

            {mostPopularGameId && mostPopularGameId.toLowerCase() === game.id.toLowerCase() && (
                <div className="absolute top-2 right-2 z-10 bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse">
                    <Flame size={14} fill="currentColor" />
                </div>
            )}

            <div className="flex flex-col flex-1 justify-between">
                <div>
                    <h3 className="text-sm font-serif font-bold text-parchment-base-text leading-tight mb-0.5">
                        {title}
                    </h3>
                    <p className="text-[11px] text-parchment-light-text leading-tight line-clamp-2 min-h-[2.1rem]">
                        {resolveGameDescription(game, t, '')}
                    </p>
                </div>

                <div className="mt-0.5 flex items-center justify-between border-t border-parchment-cream pt-1">
                    <div className="flex items-center gap-1 overflow-hidden">
                        {game.tags && game.tags.length > 0 ? (
                            game.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="text-[10px] font-bold text-parchment-light-text bg-parchment-cream px-1.5 py-0.5 rounded-[2px] whitespace-nowrap">
                                    {t(`common:game_tags.${tag}`)}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] font-bold text-parchment-light-text bg-parchment-cream px-1.5 py-0.5 rounded-[2px]">
                                {t(`common:category.${game.category}`)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-parchment-light-text italic">
                        {game.type === 'game' && game.playerOptions && game.playerOptions.length > 1
                            ? (() => {
                                const min = Math.min(...game.playerOptions);
                                const max = Math.max(...game.playerOptions);
                                const unit = t('common:game_details.people');
                                const sep = i18n.language.startsWith('en') ? ' ' : '';
                                return `${min}-${max}${sep}${unit}`;
                            })()
                            : t(game.playersKey)}
                    </span>
                </div>
            </div>
        </a>
    );
};

interface GameListProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    onGameIntent?: (id: string) => void;
    mostPopularGameId?: string | null;
}

export const GameList = ({ games, onGameClick, onGameIntent, mostPopularGameId }: GameListProps) => {
    return (
        <div className="grid w-full max-w-full grid-cols-2 gap-3 mx-auto sm:grid-cols-[repeat(auto-fill,180px)] sm:justify-center sm:gap-5">
            {games.map((game, index) => (
                <GameListCard
                    key={game.id}
                    game={game}
                    index={index}
                    onGameClick={onGameClick}
                    onGameIntent={onGameIntent}
                    mostPopularGameId={mostPopularGameId}
                />
            ))}
        </div>
    );
};
