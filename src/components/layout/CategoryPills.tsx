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
        <div className="w-full">
            <div className="flex w-full flex-wrap items-center justify-center gap-2 px-1 py-1 font-serif sm:gap-3 sm:px-2 md:gap-6 md:px-6 md:py-2">
                {categories.map((category) => {
                    const isActive = activeCategory === category;
                    return (
                        <button
                            key={category}
                            onClick={() => onSelect(category)}
                            className={`
                                group relative inline-flex h-8 items-center text-sm tracking-wide transition-colors duration-300 cursor-pointer whitespace-nowrap px-2 sm:px-3
                                ${isActive ? 'text-parchment-base-text font-bold' : 'text-parchment-light-text hover:text-parchment-base-text'}
                            `}
                        >
                            {t(categoryLabelKeys[category])}
                            <span className={`underline-center ${isActive ? '!left-0 !w-full' : ''}`} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
