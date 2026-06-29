import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';
import { ImplementationStatusRibbon } from '../game/framework';
import { resolveGameDescription, resolveGameDisplayName } from './gameDetailsContent';
import { assetsPath } from '../../core/AssetLoader';

const HOME_V2_ASSET_ROOT = 'common/images/home-v2';
const HOME_V2_HOLDER_BG = assetsPath(`${HOME_V2_ASSET_ROOT}/holders/compressed/1.webp`);
const SQUARE_RATIO_PADDING = '100%';
const LANDSCAPE_4X3_PADDING = '75%';

export interface GameListCardProps {
    game: GameConfig;
    index: number;
    onGameClick: (id: string) => void;
    onGameIntent?: (id: string) => void;
    mostPopularGameId?: string | null;
    className?: string;
    style?: CSSProperties;
    variant?: 'default' | 'homeV2Compact' | 'homeV2Row';
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
    const categoryLabel = t(`common:category.${game.category}`);
    const statusLabel = game.statusTag ? t(`common:status_tags.${game.statusTag}`) : null;
    const chipLabels = Array.from(new Set([
        categoryLabel,
        ...(game.tags?.slice(0, 1).map((tag) => t(`common:game_tags.${tag}`)) ?? []),
    ].filter(Boolean)));
    const playerLabel = game.type === 'game' && game.playerOptions && game.playerOptions.length > 1
        ? (() => {
            const min = Math.min(...game.playerOptions);
            const max = Math.max(...game.playerOptions);
            const unit = t('common:game_details.people');
            const sep = i18n.language.startsWith('en') ? ' ' : '';
            return `${min}-${max}${sep}${unit}`;
        })()
        : t(game.playersKey);

    if (variant === 'homeV2Row') {
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
                className={`group relative flex w-full items-start gap-[14px] cursor-pointer no-underline text-left ${className ?? ''}`}
                style={style}
            >
                <div
                    className="relative w-[86px] shrink-0 overflow-hidden rounded-[18px] border border-[#6f4d32]/15 bg-[rgba(64,40,24,0.1)] shadow-[0_8px_18px_rgba(50,30,18,0.12)] transition-transform duration-200 group-hover:-translate-y-[1px]"
                    style={{ width: 86, height: 86, aspectRatio: '1 / 1' }}
                >
                    {statusLabel ? (
                        <ImplementationStatusRibbon
                            label={statusLabel}
                            testId={`game-list-status-ribbon-${game.id}`}
                        />
                    ) : null}
                    <div className="absolute inset-[2px] overflow-hidden rounded-[14px] bg-[rgba(255,245,224,0.4)] [&_*img]:!block [&_*img]:!h-full [&_*img]:!w-full [&_*img]:!object-cover [&_*img]:!object-center]">
                        {game.thumbnail ? (
                            game.thumbnail
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-[28px] text-[#7c5c42]">
                                {game.icon}
                            </div>
                        )}
                    </div>
                </div>

                <div className="min-w-0 flex-1 pt-[2px]">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[clamp(15px,1.05vw,17px)] font-semibold tracking-[0.01em] text-[#55351f]">
                                {title}
                            </h3>
                            <p className="mt-[6px] line-clamp-2 text-[clamp(11px,0.85vw,13px)] leading-[1.55] text-[#71553d]">
                                {resolveGameDescription(game, t, '')}
                            </p>
                            <div className="mt-[8px] flex flex-wrap gap-[6px]">
                                {chipLabels.slice(0, 2).map((label) => (
                                    <span
                                        key={`${game.id}-${label}`}
                                        className="inline-flex items-center rounded-[8px] border border-[#b79168]/35 bg-[rgba(245,228,197,0.42)] px-[8px] py-[2px] text-[10px] font-medium text-[#6c4a31]"
                                    >
                                        {label}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="shrink-0 pt-[6px] text-[clamp(12px,0.95vw,14px)] font-medium text-[#735138] whitespace-nowrap">
                            {playerLabel}
                        </div>
                    </div>
                </div>
            </a>
        );
    }

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
                        className="relative w-full bg-transparent transition-transform duration-200 group-hover:-translate-y-[1px]"
                        style={{
                            height: 0,
                            paddingTop: SQUARE_RATIO_PADDING,
                            aspectRatio: '1 / 1',
                            borderStyle: 'solid',
                            borderWidth: '10px 12px',
                            borderImageSource: `url("${HOME_V2_HOLDER_BG}")`,
                            borderImageSlice: '38 38 38 38 fill',
                            borderImageRepeat: 'round',
                        }}
                    >
                        {statusLabel ? (
                            <ImplementationStatusRibbon
                                label={statusLabel}
                                testId={`game-list-status-ribbon-${game.id}`}
                            />
                        ) : null}
                        <div className="absolute inset-[11%] overflow-hidden rounded-[6px]">
                            <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03] [&_*img]:!block [&_*img]:!h-full [&_*img]:!w-full [&_*img]:!object-contain [&_*img]:!object-center">
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
                <h3 className="mt-[5.2%] min-h-[2.1em] line-clamp-2 max-w-full text-center text-[clamp(8px,0.76vw,10px)] font-medium leading-[1.1] text-[#f7e6bc] [text-shadow:0_1px_2px_rgba(66,38,19,0.45)]">
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

            <div
                className="w-full mb-1.5 relative overflow-hidden rounded-sm bg-slate-900 ring-1 ring-black/5"
                style={{ height: 0, paddingTop: LANDSCAPE_4X3_PADDING, aspectRatio: '4 / 3' }}
            >
                {statusLabel ? (
                    <ImplementationStatusRibbon
                        label={statusLabel}
                        testId={`game-list-status-ribbon-${game.id}`}
                    />
                ) : null}
                <div className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-110">
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
                        {chipLabels.length > 0 ? (
                            chipLabels.slice(0, 2).map((label) => (
                                <span key={label} className="text-[10px] font-bold text-parchment-light-text bg-parchment-cream px-1.5 py-0.5 rounded-[2px] whitespace-nowrap">
                                    {label}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] font-bold text-parchment-light-text bg-parchment-cream px-1.5 py-0.5 rounded-[2px]">
                                {t(`common:category.${game.category}`)}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-parchment-light-text italic">
                        {playerLabel}
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
