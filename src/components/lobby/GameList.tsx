import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';

interface GameListProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const GameList = ({ games, onGameClick }: GameListProps) => {
    const { t } = useTranslation(['lobby', 'common']);
    return (
        <div className="grid grid-cols-[repeat(auto-fill,180px)] justify-center gap-5 w-full max-w-full mx-auto">
            {games.map((game, index) => (
                <motion.div
                    key={game.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => onGameClick(game.id)}
                    className="
                        group relative cursor-pointer 
                        flex flex-col 
                        bg-[#fcfbf9] 
                        w-full max-w-[190px] mx-auto
                        p-2 sm:p-2.5
                        rounded-sm
                        shadow-[0_2px_8px_rgba(67,52,34,0.04)]
                        hover:shadow-[0_4px_16px_rgba(67,52,34,0.1)]
                        transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-1
                    "
                >
                    {/* Interactive Corner Borders - 精简偏移量适应小内边距 */}
                    <div className="absolute top-[4px] left-[4px] w-2 h-2 border-t-2 border-l-2 border-[#C8B69E] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-[4px] right-[4px] w-2 h-2 border-t-2 border-r-2 border-[#C8B69E] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-[4px] left-[4px] w-2 h-2 border-b-2 border-l-2 border-[#C8B69E] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-[4px] right-[4px] w-2 h-2 border-b-2 border-r-2 border-[#C8B69E] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Thumbnail - 保持 4/3 但缩减下边距 */}
                    <div className="w-full aspect-[4/3] mb-1.5 relative overflow-hidden rounded-sm bg-slate-900 ring-1 ring-black/5">
                        <div className="w-full h-full transition-transform duration-500 group-hover:scale-110">
                            {game.thumbnail ? (
                                game.thumbnail
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl text-[#00F3FF]">
                                    {game.icon}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content - 极紧凑垂直结构 */}
                    <div className="flex flex-col flex-1 justify-between">
                        <div>
                            <h3 className="text-sm font-serif font-bold text-[#433422] leading-tight mb-0.5">
                                {t(game.titleKey, { defaultValue: game.titleKey })}
                            </h3>
                            <p className="text-[11px] text-[#8c7b64] leading-tight line-clamp-2 min-h-[2.1rem]">
                                {t(game.descriptionKey, { defaultValue: game.descriptionKey })}
                            </p>
                        </div>

                        {/* Metadata Tag - Ultrapact */}
                        <div className="mt-0.5 flex items-center justify-between border-t border-[#e5e0d0] pt-1">
                            <span className="text-[10px] font-bold text-[#6b5a45] bg-[#e5e0d0]/30 px-1.5 py-0.5 rounded-[2px]">
                                {t(`common:category.${game.category}`)}
                            </span>
                            <span className="text-[10px] text-[#8c7b64] italic">
                                {t(game.playersKey, { defaultValue: game.playersKey })}
                            </span>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
