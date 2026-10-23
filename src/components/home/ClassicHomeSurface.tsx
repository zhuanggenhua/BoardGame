import type { ComponentProps, ReactNode } from 'react';
import { CategoryPills, type Category } from '../layout/CategoryPills';
import { GameList } from '../lobby/GameList';

type GameListProps = ComponentProps<typeof GameList>;

interface ClassicHomeSurfaceProps extends Pick<GameListProps, 'games' | 'onGameClick' | 'onGameIntent' | 'mostPopularGameId'> {
    activeCategory: Category;
    activeMatch: ReactNode;
    brand: ReactNode;
    onCategoryChange: (category: Category) => void;
    subtitle: ReactNode;
    utility: ReactNode;
}

/** Restores the earlier lobby composition while the page owner keeps current room/game behavior. */
export function ClassicHomeSurface({
    activeCategory,
    activeMatch,
    brand,
    games,
    mostPopularGameId,
    onCategoryChange,
    onGameClick,
    onGameIntent,
    subtitle,
    utility,
}: ClassicHomeSurfaceProps) {
    return (
        <div
            className="bg-parchment-base-bg text-parchment-base-text font-serif overflow-y-scroll flex flex-col items-center pb-[env(safe-area-inset-bottom)]"
            data-testid="classic-home-surface"
            data-home-entry-style="classic"
            style={{ minHeight: 'var(--runtime-viewport-height, 100vh)' }}
        >
            <header className="w-full relative px-6 md:px-12 pt-[calc(env(safe-area-inset-top)+4.25rem)] md:pt-8 pb-0">
                <div className="flex flex-col items-center justify-center mb-1 md:mb-4">
                    <div className="flex items-center justify-center gap-3 md:gap-4 mb-2">
                        {brand}
                    </div>
                    <p className="text-[10px] md:text-sm text-parchment-light-text tracking-[0.2em] font-bold uppercase opacity-80">
                        {subtitle}
                    </p>
                </div>
                <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+0.875rem)] mb-0 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-x-3 gap-y-2 md:right-12 md:top-8 md:flex-nowrap md:gap-x-4">
                    {utility}
                </div>
            </header>
            <main className="w-full max-w-7xl flex flex-col items-center pt-0 px-4 sm:px-6 md:px-8">
                <nav className="mb-4 md:mb-6 w-full">
                    <CategoryPills activeCategory={activeCategory} onSelect={onCategoryChange} />
                </nav>
                <section className="w-full pb-20">
                    <GameList
                        games={games}
                        onGameClick={onGameClick}
                        onGameIntent={onGameIntent}
                        mostPopularGameId={mostPopularGameId}
                    />
                </section>
            </main>
            {activeMatch && (
                <div
                    data-testid="home-active-match-banner"
                    className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center px-3 sm:px-4 md:px-6 animate-in slide-in-from-bottom-4 fade-in duration-300"
                >
                    {activeMatch}
                </div>
            )}
        </div>
    );
}
