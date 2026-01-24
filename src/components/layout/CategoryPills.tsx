import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export type Category = 'All' | 'strategy' | 'casual' | 'party' | 'abstract' | 'tools';

interface CategoryPillsProps {
    activeCategory: Category;
    onSelect: (category: Category) => void;
}

const categories: Category[] = ['All', 'strategy', 'casual', 'party', 'abstract', 'tools'];

const categoryLabelKeys: Record<Category, string> = {
    All: 'category.all',
    strategy: 'category.strategy',
    casual: 'category.casual',
    party: 'category.party',
    abstract: 'category.abstract',
    tools: 'category.tools',
};

export const CategoryPills = ({ activeCategory, onSelect }: CategoryPillsProps) => {
    const { t } = useTranslation('common');

    return (
        <div className="flex justify-center w-full">
            <div className="flex items-center gap-6 font-serif overflow-x-auto no-scrollbar px-6 max-w-full py-2">
                {categories.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => onSelect(category)}
                            className={`
                                group relative text-sm tracking-wide transition-colors duration-300 cursor-pointer whitespace-nowrap py-1
                                ${isActive ? 'text-[#433422] font-bold' : 'text-[#8c7b64] hover:text-[#433422]'}
                            `}
                        >
                            <span className="relative z-10 px-1">
                                {t(categoryLabelKeys[category])}
                            </span>

                            {/* Active Underline - Sliding implementation */}
                            {isActive ? (
                                <motion.div
                                    layoutId="activeCategory"
                                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#433422] z-0"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            ) : (
                                /* Hover Underline - Expanding from center */
                                <span className="underline-center h-[1px] opacity-40" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
