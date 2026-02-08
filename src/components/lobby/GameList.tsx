import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Flame } from 'lucide-react';
import type { GameConfig } from '../../config/games.config';

interface GameListProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    mostPopularGameId?: string | null;
}

export const GameList = ({ games, onGameClick, mostPopularGameId }: GameListProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    return (
        <div className="grid grid-cols-[repeat(auto-fill,180px)] justify-center gap-5 w-full max-w-full mx-auto">
            {games.map((game, index) => (
                <motion.a
                    key={game.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    data-game-id={game.id}
                    href={`/?game=${game.id}`}
                    onClick={(e) => {
                        e.preventDefault();
                        onGameClick(game.id);
                    }}
                    className="
                        group relative cursor-pointer 
                        flex flex-col 
                        bg-parchment-card-bg 
                        w-full max-w-[190px] mx-auto
                        p-2 sm:p-2.5
                        rounded-sm
                        shadow-parchment-card
                        hover:shadow-parchment-card-hover
                        transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-1
                        no-underline
                    "
                >
                    {/* 交互式角落边框 - 默认可见以突出结构 */}
                    <div className="absolute top-[4px] left-[4px] w-2 h-2 border-t-2 border-l-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-[4px] right-[4px] w-2 h-2 border-t-2 border-r-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-[4px] left-[4px] w-2 h-2 border-b-2 border-l-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-[4px] right-[4px] w-2 h-2 border-b-2 border-r-2 border-parchment-card-border opacity-30 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* 缩略图 - 保持 4/3 但缩减下边距 */}
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

                    {/* Popularity Badge */}
                    {mostPopularGameId && mostPopularGameId.toLowerCase() === game.id.toLowerCase() && (
                        <div className="absolute top-2 right-2 z-10 bg-red-500 text-white p-1 rounded-full shadow-lg animate-pulse">
                            <Flame size={14} fill="currentColor" />
                        </div>
                    )}

                    {/* 内容 - 极紧凑垂直结构 */}
                    <div className="flex flex-col flex-1 justify-between">
                        <div>
                            <h3 className="text-sm font-serif font-bold text-parchment-base-text leading-tight mb-0.5">
                                {t(game.titleKey, { defaultValue: game.titleKey })}
                            </h3>
                            <p className="text-[11px] text-parchment-light-text leading-tight line-clamp-2 min-h-[2.1rem]">
                                {t(game.descriptionKey, { defaultValue: game.descriptionKey })}
                            </p>
                        </div>

                        {/* 元信息标签 - 超紧凑 */}
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
                                    : t(game.playersKey, { defaultValue: game.playersKey })}
                            </span>
                        </div>
                    </div>
                </motion.a>
            ))}
        </div>
    );
};
