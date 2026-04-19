import { useTranslation } from 'react-i18next';

export type Category = 'All' | 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

interface CategoryPillsProps {
    activeCategory: Category;
    onSelect: (category: Category) => void;
}

const categories: Category[] = ['All', 'card', 'dice', 'abstract', 'wargame', 'casual', 'tools'];

const categoryLabelKeys: Record<Category, string> = {
    All: 'category.all',
    card: 'category.card',
    dice: 'category.dice',
    abstract: 'category.abstract',
    wargame: 'category.wargame',
    casual: 'category.casual',
    tools: 'category.tools',
};

export const CategoryPills = ({ activeCategory, onSelect }: CategoryPillsProps) => {
    const { t } = useTranslation('common');

    return (
        <div className="w-full overflow-x-auto no-scrollbar">
            <div className="inline-flex min-w-max items-center gap-6 px-6 py-0 font-serif md:flex md:min-w-0 md:w-full md:justify-center md:py-2">
                {categories.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => onSelect(category)}
                            className={`
                                group relative text-sm tracking-wide transition-colors duration-300 cursor-pointer whitespace-nowrap px-4 py-1.5 rounded-full
                                ${isActive ? 'text-parchment-base-text font-bold' : 'text-parchment-light-text hover:text-parchment-base-text'}
                            `}
                        >
                            <span className="relative z-10">
                                {t(categoryLabelKeys[category])}
                            </span>

                            {/* 当前选中背景 */}
                            {isActive && (
                                <span className="absolute inset-0 rounded-full bg-parchment-brown/10 z-0 transition-all duration-300" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
