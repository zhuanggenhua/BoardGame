import React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Flame, Globe2, User, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { useAuth } from '../../contexts/AuthContext';
import { LANGUAGE_OPTIONS } from '../../lib/i18n/types';
import { ImplementationStatusRibbon } from '../game/framework';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import { sortGamesForLobbyDirectory } from './lobbyDirectorySorting';
import { UserMenu } from '../social/UserMenu';

export type LobbyCategory = 'all' | 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

type PositionedRect = {
    left: string;
    top: string;
    width: string;
    height: string;
};

type HomepageCatalogEntryMeta = {
    rect: PositionedRect;
};

type CategoryNavItem = {
    id: LobbyCategory;
    rect: PositionedRect;
};

export type HomeV2ContinueMatch = {
    matchID: string;
    gameName: string;
    gameLabel: string;
    playerID?: string;
    playerLabel?: string;
    isHost?: boolean;
};

const CATEGORY_NAV_ITEMS: CategoryNavItem[] = [
    { id: 'all', rect: { left: '10.8%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'card', rect: { left: '16.2%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'dice', rect: { left: '21.6%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'abstract', rect: { left: '27.0%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'wargame', rect: { left: '32.4%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'casual', rect: { left: '37.8%', top: '8.1%', width: '4.6%', height: '5.8%' } },
    { id: 'tools', rect: { left: '43.2%', top: '8.1%', width: '4.6%', height: '5.8%' } },
];

const HOMEPAGE_CATALOG_LAYOUT: HomepageCatalogEntryMeta[] = [
    { rect: { left: '10.4%', top: '17.0%', width: '37.4%', height: '15.4%' } },
    { rect: { left: '10.4%', top: '35.3%', width: '37.4%', height: '15.4%' } },
    { rect: { left: '10.4%', top: '53.6%', width: '37.4%', height: '15.4%' } },
    { rect: { left: '53.0%', top: '17.0%', width: '37.0%', height: '15.4%' } },
    { rect: { left: '53.0%', top: '35.3%', width: '37.0%', height: '15.4%' } },
    { rect: { left: '53.0%', top: '53.6%', width: '37.0%', height: '15.4%' } },
];

const PAGE_SIZE = HOMEPAGE_CATALOG_LAYOUT.length;

const ACCOUNT_RECT: PositionedRect = { left: '71.0%', top: '7.6%', width: '10.0%', height: '5.2%' };
const LANGUAGE_RECT: PositionedRect = { left: '82.2%', top: '7.6%', width: '8.8%', height: '5.2%' };
const PREVIOUS_PAGE_RECT: PositionedRect = { left: '33.7%', top: '75.4%', width: '2.4%', height: '5.6%' };
const PAGE_LABEL_RECT: PositionedRect = { left: '37.3%', top: '75.4%', width: '5.8%', height: '5.6%' };
const NEXT_PAGE_RECT: PositionedRect = { left: '44.2%', top: '75.4%', width: '2.4%', height: '5.6%' };
const CONTINUE_RECT: PositionedRect = { left: '52.8%', top: '74.8%', width: '38.4%', height: '6.8%' };
const CONTINUE_HOST_RECT: PositionedRect = { left: '52.8%', top: '74.8%', width: '34.6%', height: '6.8%' };
const EMPTY_STATE_RECT: PositionedRect = { left: '31.0%', top: '44.0%', width: '38.0%', height: '10.0%' };

function asAbsoluteStyle(rect: PositionedRect): React.CSSProperties {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
}

function scaled(value: number) {
    return `calc(${value}px * var(--home-v2-stage-scale))`;
}

function centeredPercent(left: string, width: string) {
    return `${parseFloat(left) + parseFloat(width) / 2}%`;
}

function buildCategoryLabel(category: LobbyCategory, t: (key: string, options?: { defaultValue?: string }) => string) {
    if (category === 'all') {
        return t('lobby:homeV2.catalog.allGames');
    }
    return t(`common:category.${category}`);
}

function buildPlayerLabel(
    game: Pick<GameConfig, 'playersKey' | 'playerOptions'>,
    t: (key: string, options?: { defaultValue?: string }) => string,
) {
    if (game.playerOptions && game.playerOptions.length > 1) {
        return `${Math.min(...game.playerOptions)}-${Math.max(...game.playerOptions)} ${t('common:game_details.people')}`;
    }
    if (game.playerOptions?.length === 1) {
        const [playerOption] = game.playerOptions;
        return `${playerOption} ${t('common:game_details.people')}`;
    }
    return t(game.playersKey);
}

function buildHomepageSummary(
    game: Pick<GameConfig, 'descriptionKey'>,
    t: (key: string, options?: { defaultValue?: string }) => string,
) {
    const fullDescription = t(game.descriptionKey).trim();
    if (!fullDescription) {
        return '';
    }

    const sentenceMatches = fullDescription.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [];
    const firstSentence = sentenceMatches[0];
    if (firstSentence) {
        let summary = firstSentence.trim();
        const secondSentence = sentenceMatches[1];
        if (summary.length < 18 && secondSentence) {
            const appended = `${summary}${secondSentence.trim()}`.trim();
            if (appended.length <= 34) {
                summary = appended;
            }
        }
        if (summary.length <= 34) {
            return summary;
        }
    }

    const clauseBreakIndex = fullDescription.search(/[，,、：:]/);
    if (clauseBreakIndex >= 0 && clauseBreakIndex <= 24) {
        return fullDescription.slice(0, clauseBreakIndex);
    }

    if (fullDescription.length <= 34) {
        return fullDescription;
    }

    return `${fullDescription.slice(0, 32).trim()}...`;
}

function resolveGameBadgeKeys(game: Pick<GameConfig, 'category' | 'tags'>): string[] {
    const supportedTagKeys = new Set([
        'dice_driven',
        'combat',
        'ugc',
        'tactical',
        'card_driven',
        'casual',
    ]);

    const badgeKeys = [`common:category.${game.category}`];
    for (const tag of game.tags ?? []) {
        if (!supportedTagKeys.has(tag)) {
            continue;
        }
        const tagKey = `common:game_tags.${tag}`;
        if (!badgeKeys.includes(tagKey)) {
            badgeKeys.push(tagKey);
        }
        if (badgeKeys.length >= 2) {
            break;
        }
    }
    return badgeKeys;
}

function resolveBadgeLabel(
    badgeKey: string,
    t: (key: string, options?: { defaultValue?: string }) => string,
) {
    switch (badgeKey) {
        case 'common:category.card':
            return t('common:category.card');
        case 'common:category.dice':
            return t('common:category.dice');
        case 'common:category.abstract':
            return t('common:category.abstract');
        case 'common:category.wargame':
            return t('common:category.wargame');
        case 'common:category.casual':
            return t('common:category.casual');
        case 'common:category.tools':
            return t('common:category.tools');
        case 'common:game_tags.dice_driven':
            return t('common:game_tags.dice_driven');
        case 'common:game_tags.combat':
            return t('common:game_tags.combat');
        case 'common:game_tags.ugc':
            return t('common:game_tags.ugc');
        case 'common:game_tags.tactical':
            return t('common:game_tags.tactical');
        case 'common:game_tags.card_driven':
            return t('common:game_tags.card_driven');
        case 'common:game_tags.casual':
            return t('common:game_tags.casual');
        case 'common:status_tags.under_construction':
            return t('common:status_tags.under_construction');
        default:
            return badgeKey;
    }
}

function renderBadge(
    badgeKey: string,
    index: number,
    t: (key: string, options?: { defaultValue?: string }) => string,
) {
    const badgeLabel = resolveBadgeLabel(badgeKey, t);

    return (
        <span
            key={`${badgeKey}:${index}`}
            className="inline-flex items-center border border-[#b8945e]/70 bg-[rgba(239,222,185,0.72)] text-[#6d4a2b]"
            style={{
                borderRadius: scaled(4),
                padding: `${scaled(2)} ${scaled(6)}`,
                fontSize: scaled(12),
                lineHeight: 1,
            }}
        >
            {badgeLabel}
        </span>
    );
}

function HomeCatalogThumbnail({ game }: { game: GameConfig }) {
    const { t } = useTranslation(['lobby', 'common']);
    const title = resolveGameDisplayName(game, t, game.id);
    const manifestThumbnail = React.useMemo(() => {
        if (!React.isValidElement(game.thumbnail)) {
            return game.thumbnail;
        }
        return React.cloneElement(game.thumbnail);
    }, [game.thumbnail]);

    if (manifestThumbnail) {
        return (
            <div className="absolute inset-0 overflow-hidden rounded-[inherit] [&_*img]:!h-full [&_*img]:!w-full [&_*img]:!object-cover">
                {manifestThumbnail}
            </div>
        );
    }

    return (
        <div className="flex h-full w-full items-center justify-center rounded-[inherit] bg-[rgba(248,240,224,0.92)] text-[#8a6a46]">
            <span
                aria-label={title}
                title={title}
                style={{
                    fontSize: scaled(30),
                    lineHeight: 1,
                    fontWeight: 600,
                }}
            >
                {game.icon || '.'}
            </span>
        </div>
    );
}

export interface OverviewSpreadProps {
    games: GameConfig[];
    popularityByGameId?: Record<string, number>;
    mostPopularGameId?: string | null;
    activeCategory?: LobbyCategory;
    onCategoryChange?: (category: LobbyCategory) => void;
    catalogPageIndex?: number;
    onCatalogPageChange?: (pageIndex: number) => void;
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
    continueMatch?: HomeV2ContinueMatch | null;
    onContinueMatch?: (match: HomeV2ContinueMatch) => void;
    onDestroyContinueMatch?: (match: HomeV2ContinueMatch) => void;
}

export const OverviewSpread = ({
    games,
    popularityByGameId = {},
    mostPopularGameId,
    activeCategory = 'all',
    onCategoryChange,
    catalogPageIndex: controlledCatalogPageIndex,
    onCatalogPageChange,
    onGameClick,
    onAccountClick,
    continueMatch,
    onContinueMatch,
    onDestroyContinueMatch,
}: OverviewSpreadProps) => {
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const { user, logout } = useAuth();
    const [uncontrolledCatalogPageIndex, setUncontrolledCatalogPageIndex] = React.useState(0);
    const [languageMenuOpen, setLanguageMenuOpen] = React.useState(false);
    const languageMenuRef = React.useRef<HTMLDivElement>(null);

    const orderedGames = React.useMemo(
        () => sortGamesForLobbyDirectory(games, activeCategory, popularityByGameId),
        [activeCategory, games, popularityByGameId],
    );
    const totalPages = Math.max(1, Math.ceil(orderedGames.length / PAGE_SIZE));
    const requestedCatalogPageIndex = controlledCatalogPageIndex ?? uncontrolledCatalogPageIndex;
    const catalogPageIndex = Math.max(0, Math.min(totalPages - 1, requestedCatalogPageIndex));
    const visibleEntries = React.useMemo(
        () => orderedGames
            .slice(catalogPageIndex * PAGE_SIZE, catalogPageIndex * PAGE_SIZE + PAGE_SIZE)
            .map((game, index) => ({
                game,
                rect: HOMEPAGE_CATALOG_LAYOUT[index]?.rect,
            }))
            .filter((entry): entry is { game: GameConfig; rect: PositionedRect } => Boolean(entry.rect)),
        [catalogPageIndex, orderedGames],
    );

    React.useEffect(() => {
        if (controlledCatalogPageIndex === undefined) {
            setUncontrolledCatalogPageIndex(0);
        }
    }, [activeCategory, controlledCatalogPageIndex]);

    React.useEffect(() => {
        if (controlledCatalogPageIndex === undefined) {
            setUncontrolledCatalogPageIndex((current) => Math.min(current, totalPages - 1));
        }
    }, [controlledCatalogPageIndex, totalPages]);

    const requestCatalogPageChange = React.useCallback((nextPageIndex: number) => {
        const clampedNextPageIndex = Math.max(0, Math.min(totalPages - 1, nextPageIndex));
        if (clampedNextPageIndex === catalogPageIndex) {
            return;
        }

        if (onCatalogPageChange) {
            onCatalogPageChange(clampedNextPageIndex);
            return;
        }

        setUncontrolledCatalogPageIndex(clampedNextPageIndex);
    }, [catalogPageIndex, onCatalogPageChange, totalPages]);

    const playerLabel = user?.username?.trim() || t('auth:menu.login');
    const canGoPrevious = catalogPageIndex > 0;
    const canGoNext = catalogPageIndex + 1 < totalPages;
    const activeCategoryRect = CATEGORY_NAV_ITEMS.find((item) => item.id === activeCategory)?.rect ?? CATEGORY_NAV_ITEMS[0]!.rect;
    const activeCategoryCenter = centeredPercent(activeCategoryRect.left, activeCategoryRect.width);
    const currentLanguage = i18n.resolvedLanguage ?? i18n.language;
    const currentLanguageOption = LANGUAGE_OPTIONS.find((option) => option.code === currentLanguage) ?? LANGUAGE_OPTIONS[0]!;
    const mostPopularGameIdKey = mostPopularGameId?.toLowerCase();
    const continueMatchCode = continueMatch?.matchID ? `#${continueMatch.matchID.slice(-4).toUpperCase()}` : '';
    const continueRect = continueMatch?.isHost ? CONTINUE_HOST_RECT : CONTINUE_RECT;

    React.useEffect(() => {
        if (!languageMenuOpen) return undefined;

        const handlePointerDown = (event: MouseEvent) => {
            if (languageMenuRef.current?.contains(event.target as Node)) return;
            setLanguageMenuOpen(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [languageMenuOpen]);

    return (
        <div
            className="pointer-events-auto relative h-full w-full text-[#51361f] select-none"
            data-home-v2-reference-layout="real-dom"
        >
            {[
                { left: '8.6%', top: '15.0%', width: '39.2%' },
                { left: '53.0%', top: '15.0%', width: '37.0%' },
            ].map((rect, index) => (
                <div
                    key={index}
                    data-testid={index === 0 ? 'home-v2-left-header-rule' : 'home-v2-right-header-rule'}
                    className="pointer-events-none absolute bg-[linear-gradient(90deg,rgba(130,92,47,0.08)_0%,rgba(130,92,47,0.34)_12%,rgba(130,92,47,0.34)_88%,rgba(130,92,47,0.08)_100%)]"
                    style={{
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: scaled(1),
                    }}
                    aria-hidden="true"
                />
            ))}

            {CATEGORY_NAV_ITEMS.map(({ id, rect }) => {
                const isActive = activeCategory === id;
                const label = buildCategoryLabel(id, t);
                return (
                    <button
                        key={id}
                        type="button"
                        data-testid={`home-v2-category-${id}`}
                        aria-label={label}
                        aria-pressed={isActive}
                        className="absolute flex items-center justify-center border-0 bg-transparent p-0 font-serif transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                        style={{
                            ...asAbsoluteStyle(rect),
                            color: isActive ? '#315c27' : '#2f2116',
                            fontSize: scaled(20),
                            fontWeight: isActive ? 800 : 700,
                            letterSpacing: '0',
                        }}
                        onClick={() => {
                            if (!isActive) {
                                onCategoryChange?.(id);
                            }
                        }}
                    >
                        <span
                            className="relative flex h-full w-full items-center justify-center"
                        >
                            {label}
                        </span>
                    </button>
                );
            })}

            <span
                data-testid="home-v2-category-active-rule"
                aria-hidden="true"
                className="pointer-events-none absolute bg-[#315c27]"
                style={{
                    left: activeCategoryCenter,
                    top: '15.0%',
                    width: '5.1%',
                    height: scaled(3),
                    transform: 'translateX(-50%)',
                }}
            />
            <span
                data-testid="home-v2-category-active-marker"
                aria-hidden="true"
                className="pointer-events-none absolute bg-[#315c27]"
                style={{
                    left: activeCategoryCenter,
                    top: `calc(15.0% - ${scaled(4)})`,
                    width: scaled(8),
                    height: scaled(8),
                    transform: 'translateX(-50%) rotate(45deg)',
                }}
            />

            <div
                className="absolute"
                style={asAbsoluteStyle(ACCOUNT_RECT)}
            >
                {user ? (
                    <UserMenu onLogout={logout} variant="book" triggerTestId="home-v2-account-entry" />
                ) : (
                    <button
                        type="button"
                        data-testid="home-v2-account-entry"
                        aria-label={playerLabel}
                        title={playerLabel}
                        className="flex h-full w-full items-center justify-end border-0 bg-transparent p-0 font-serif text-[#2f2116] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                        style={{
                            gap: scaled(6),
                        }}
                        onClick={onAccountClick}
                    >
                        <User aria-hidden="true" style={{ width: scaled(21), height: scaled(21) }} />
                        <span
                            className="truncate"
                            style={{
                                maxWidth: scaled(102),
                                fontSize: scaled(16),
                                fontWeight: 700,
                            }}
                        >
                            {playerLabel}
                        </span>
                        <ChevronDown aria-hidden="true" style={{ width: scaled(17), height: scaled(17) }} />
                    </button>
                )}
            </div>

            <div
                className="pointer-events-none absolute bg-[rgba(98,65,33,0.45)]"
                style={{
                    left: '81.65%',
                    top: '8.2%',
                    width: scaled(1),
                    height: '4.2%',
                }}
                aria-hidden="true"
            />

            <div
                ref={languageMenuRef}
                className="absolute"
                style={asAbsoluteStyle(LANGUAGE_RECT)}
            >
                <button
                    type="button"
                    data-testid="home-v2-language-entry"
                    aria-label={currentLanguageOption.label}
                    aria-expanded={languageMenuOpen}
                    className="flex h-full w-full items-center justify-start border-0 bg-transparent p-0 font-serif text-[#2f2116] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                    style={{
                        gap: scaled(6),
                        fontSize: scaled(16),
                        fontWeight: 700,
                    }}
                    onClick={() => setLanguageMenuOpen((open) => !open)}
                >
                    <Globe2 aria-hidden="true" style={{ width: scaled(21), height: scaled(21) }} />
                    <span className="truncate">{currentLanguageOption.label}</span>
                    <ChevronDown aria-hidden="true" style={{ width: scaled(17), height: scaled(17) }} />
                </button>
                {languageMenuOpen ? (
                    <div
                        data-testid="home-v2-language-menu"
                        className="absolute right-0 z-30 overflow-hidden border border-[#8b633e]/45 bg-[#f5e5c7] shadow-[0_8px_20px_rgba(54,35,20,0.18)]"
                        style={{
                            top: `calc(100% + ${scaled(7)})`,
                            minWidth: scaled(148),
                            borderRadius: scaled(5),
                        }}
                    >
                        {LANGUAGE_OPTIONS.map((option) => (
                            <button
                                key={option.code}
                                type="button"
                                data-testid={`home-v2-language-option-${option.code}`}
                                className="flex w-full items-center justify-between border-0 bg-transparent text-left font-serif text-[#3c2819] hover:bg-[rgba(120,84,48,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                                style={{
                                    padding: `${scaled(10)} ${scaled(12)}`,
                                    fontSize: scaled(15),
                                    fontWeight: currentLanguageOption.code === option.code ? 800 : 700,
                                }}
                                onClick={() => {
                                    try {
                                        localStorage.setItem('bg_locale_preference', option.code);
                                    } catch {
                                        // ignore storage failures
                                    }
                                    void i18n.changeLanguage(option.code);
                                    setLanguageMenuOpen(false);
                                }}
                            >
                                <span>{option.label}</span>
                                {currentLanguageOption.code === option.code ? <span aria-hidden="true">◆</span> : null}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {visibleEntries.length === 0 ? (
                <div
                    className="absolute flex items-center justify-center border border-[#b99767]/55 bg-[rgba(238,220,184,0.32)] font-serif text-[#68472b]"
                    style={{
                        ...asAbsoluteStyle(EMPTY_STATE_RECT),
                        borderRadius: scaled(4),
                        fontSize: scaled(22),
                        fontWeight: 700,
                    }}
                >
                    {t('lobby:homeV2.referenceCatalog.emptyTitle')}
                </div>
            ) : null}

            {visibleEntries.map(({ game, rect }) => {
                const name = resolveGameDisplayName(game, t, game.id);
                const summary = buildHomepageSummary(game, t);
                const playerLabelText = buildPlayerLabel(game, t);
                const isMostPopularGame = Boolean(mostPopularGameIdKey) && mostPopularGameIdKey === game.id.toLowerCase();
                const statusLabel = game.statusTag ? t(`common:status_tags.${game.statusTag}`) : null;
                const badgeKeys = [
                    ...resolveGameBadgeKeys(game),
                ].filter((badgeKey, index, allKeys) => {
                    const label = resolveBadgeLabel(badgeKey, t);
                    return allKeys.findIndex((candidate) => resolveBadgeLabel(candidate, t) === label) === index;
                });
                const accessibleLabel = [name, summary, playerLabelText].filter(Boolean).join('，');

                return (
                    <button
                        key={game.id}
                        type="button"
                        data-game-id={game.id}
                        aria-label={accessibleLabel}
                        title={accessibleLabel}
                        className="group absolute border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                        style={asAbsoluteStyle(rect)}
                        onClick={() => onGameClick(game.id)}
                    >
                        <div
                            className="relative flex h-full w-full bg-transparent transition-colors duration-150 group-hover:bg-[rgba(238,220,184,0.16)]"
                            style={{
                                borderRadius: scaled(3),
                                padding: `${scaled(5)} ${scaled(9)}`,
                                gap: scaled(15),
                            }}
                        >
                            <div
                                className="relative shrink-0 overflow-hidden border border-[#584022]/42 bg-[#d8c59b] shadow-[0_3px_7px_rgba(60,36,14,0.16)]"
                                style={{
                                    width: '25.7%',
                                    height: '100%',
                                    borderRadius: scaled(4),
                                }}
                            >
                                {statusLabel ? (
                                    <ImplementationStatusRibbon
                                        label={statusLabel}
                                        testId={`home-v2-status-ribbon-${game.id}`}
                                    />
                                ) : null}
                                {isMostPopularGame ? (
                                    <div
                                        data-testid={`home-v2-hot-badge-${game.id}`}
                                        className="absolute z-10 bg-red-500 text-white rounded-full shadow-lg animate-pulse"
                                        style={{
                                            top: scaled(4),
                                            right: scaled(4),
                                            width: scaled(24),
                                            height: scaled(24),
                                            padding: scaled(4),
                                        }}
                                        aria-label={t('lobby:homeV2.catalog.hotAria')}
                                    >
                                        <Flame
                                            aria-hidden="true"
                                            fill="currentColor"
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    </div>
                                ) : null}
                                <HomeCatalogThumbnail game={game} />
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col">
                                <div className="flex min-w-0 items-start justify-between" style={{ gap: scaled(10) }}>
                                    <div
                                        className="truncate font-serif text-[#3f2818]"
                                        style={{
                                            fontSize: scaled(24),
                                            fontWeight: 800,
                                            lineHeight: 1.08,
                                        }}
                                    >
                                        {name}
                                    </div>
                                    <div
                                        className="ml-auto flex shrink-0 items-center text-[#4f3521]"
                                        style={{
                                            gap: scaled(4),
                                            fontSize: scaled(17),
                                            fontWeight: 700,
                                            paddingTop: scaled(3),
                                        }}
                                    >
                                        <Users aria-hidden="true" style={{ width: scaled(20), height: scaled(20) }} />
                                        <span className="whitespace-nowrap">{playerLabelText}</span>
                                    </div>
                                </div>

                                <div
                                    className="text-[#65462d]"
                                    style={{
                                        marginTop: scaled(3),
                                        fontSize: scaled(15),
                                        lineHeight: 1.35,
                                        minHeight: scaled(27),
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {summary}
                                </div>

                                <div className="mt-auto flex flex-wrap" style={{ gap: scaled(7) }}>
                                    {badgeKeys.map((badgeKey, index) => renderBadge(badgeKey, index, t))}
                                </div>
                            </div>

                            <div
                                className="pointer-events-none absolute bottom-0 h-px bg-[linear-gradient(90deg,rgba(167,125,76,0)_0%,rgba(167,125,76,0.54)_18%,rgba(167,125,76,0.54)_82%,rgba(167,125,76,0)_100%)]"
                                style={{
                                    left: '0',
                                    width: '100%',
                                }}
                                aria-hidden="true"
                            />
                        </div>
                    </button>
                );
            })}

            <button
                type="button"
                data-testid="home-v2-catalog-prev-page"
                aria-label={t('lobby:homeV2.catalog.previousPage')}
                className="absolute flex items-center justify-center border border-[#a98655]/60 bg-[rgba(229,209,174,0.54)] text-[#604126] transition-opacity disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                style={{
                    ...asAbsoluteStyle(PREVIOUS_PAGE_RECT),
                    borderRadius: scaled(3),
                }}
                disabled={!canGoPrevious}
                onClick={() => requestCatalogPageChange(catalogPageIndex - 1)}
            >
                <ChevronLeft aria-hidden="true" style={{ width: scaled(18), height: scaled(18) }} />
            </button>
            <span
                data-testid="home-v2-catalog-page-label"
                className="absolute flex items-center justify-center font-serif tabular-nums text-[#5f4027]"
                style={{
                    ...asAbsoluteStyle(PAGE_LABEL_RECT),
                    fontSize: scaled(16),
                    fontWeight: 700,
                }}
            >
                {catalogPageIndex + 1} / {totalPages}
            </span>
            <button
                type="button"
                data-testid="home-v2-catalog-next-page"
                aria-label={t('lobby:homeV2.catalog.nextPage')}
                className="absolute flex items-center justify-center border border-[#a98655]/60 bg-[rgba(229,209,174,0.54)] text-[#604126] transition-opacity disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                style={{
                    ...asAbsoluteStyle(NEXT_PAGE_RECT),
                    borderRadius: scaled(3),
                }}
                disabled={!canGoNext}
                onClick={() => requestCatalogPageChange(catalogPageIndex + 1)}
            >
                <ChevronRight aria-hidden="true" style={{ width: scaled(18), height: scaled(18) }} />
            </button>
            <div
                className="absolute flex items-center"
                style={{
                    ...asAbsoluteStyle(continueRect),
                    gap: scaled(continueMatch?.isHost ? 6 : 8),
                    opacity: continueMatch ? 1 : 0.48,
                }}
            >
                <button
                    type="button"
                    data-testid="home-v2-continue-entry"
                    aria-label={continueMatch
                        ? t('lobby:homeV2.catalog.continueMatchAria', { game: continueMatch.gameLabel })
                        : t('lobby:homeV2.catalog.noContinueMatch')}
                    className="flex min-w-0 flex-1 items-center border border-[#9a7a4a]/52 bg-[rgba(196,179,136,0.36)] font-serif text-[#3b321f] shadow-[inset_0_1px_0_rgba(255,248,222,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                    style={{
                        height: '100%',
                        borderRadius: scaled(3),
                        fontSize: scaled(16),
                        fontWeight: 700,
                    }}
                    disabled={!continueMatch}
                    onClick={() => continueMatch ? onContinueMatch?.(continueMatch) : undefined}
                >
                    <span
                        aria-hidden="true"
                        className="self-stretch bg-[#315c27]"
                        style={{
                            width: scaled(27),
                            marginRight: scaled(18),
                            clipPath: 'polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)',
                        }}
                    />
                    <span className="min-w-0 flex-1 truncate leading-none">
                        {continueMatch
                            ? t('lobby:homeV2.catalog.continueMatchLabel', {
                                game: continueMatch.gameLabel,
                                code: continueMatchCode ? ` ${continueMatchCode}` : '',
                            })
                            : t('lobby:homeV2.catalog.noContinueMatch')}
                    </span>
                    <span className="flex items-center whitespace-nowrap" style={{ gap: scaled(5), marginLeft: scaled(12), marginRight: scaled(14) }}>
                        <span>{continueMatch?.playerLabel ?? '-'}</span>
                        <ChevronRight aria-hidden="true" style={{ width: scaled(19), height: scaled(19) }} />
                    </span>
                </button>
                {continueMatch?.isHost ? (
                    <button
                        type="button"
                        data-testid="home-v2-continue-destroy-button"
                        aria-label={t('lobby:homeV2.catalog.destroyCurrentRoom')}
                        className="shrink-0 border border-[#a16f43]/72 bg-[linear-gradient(180deg,rgba(94,53,29,0.96)_0%,rgba(70,39,21,0.98)_100%)] font-serif text-[#f3dfbd] shadow-[0_2px_5px_rgba(59,33,17,0.18)] transition-colors hover:bg-[linear-gradient(180deg,rgba(104,58,30,0.98)_0%,rgba(75,42,22,1)_100%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70"
                        style={{
                            height: '100%',
                            minWidth: scaled(68),
                            borderRadius: scaled(3),
                            fontSize: scaled(14),
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            padding: `${scaled(4)} ${scaled(10)}`,
                        }}
                        onClick={() => onDestroyContinueMatch?.(continueMatch)}
                    >
                        {t('lobby:actions.destroy')}
                    </button>
                ) : null}
            </div>
        </div>
    );
};

export interface OverviewProps {
    games: GameConfig[];
    popularityByGameId?: Record<string, number>;
    mostPopularGameId?: string | null;
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
    continueMatch?: HomeV2ContinueMatch | null;
    onContinueMatch?: (match: HomeV2ContinueMatch) => void;
    onDestroyContinueMatch?: (match: HomeV2ContinueMatch) => void;
}

export const Overview = ({ games, popularityByGameId, mostPopularGameId, onGameClick, onAccountClick, continueMatch, onContinueMatch, onDestroyContinueMatch }: OverviewProps) => (
    <OverviewSpread games={games} popularityByGameId={popularityByGameId} mostPopularGameId={mostPopularGameId} onGameClick={onGameClick} onAccountClick={onAccountClick} continueMatch={continueMatch} onContinueMatch={onContinueMatch} onDestroyContinueMatch={onDestroyContinueMatch} />
);

export interface LeftProps {
    games: GameConfig[];
    popularityByGameId?: Record<string, number>;
    mostPopularGameId?: string | null;
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
    continueMatch?: HomeV2ContinueMatch | null;
    onContinueMatch?: (match: HomeV2ContinueMatch) => void;
    onDestroyContinueMatch?: (match: HomeV2ContinueMatch) => void;
}

export const Left = ({ games, popularityByGameId, mostPopularGameId, onGameClick, onAccountClick, continueMatch, onContinueMatch, onDestroyContinueMatch }: LeftProps) => (
    <OverviewSpread games={games} popularityByGameId={popularityByGameId} mostPopularGameId={mostPopularGameId} onGameClick={onGameClick} onAccountClick={onAccountClick} continueMatch={continueMatch} onContinueMatch={onContinueMatch} onDestroyContinueMatch={onDestroyContinueMatch} />
);

export interface RightProps {
    games: GameConfig[];
    popularityByGameId?: Record<string, number>;
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
    continueMatch?: HomeV2ContinueMatch | null;
    onContinueMatch?: (match: HomeV2ContinueMatch) => void;
    onDestroyContinueMatch?: (match: HomeV2ContinueMatch) => void;
}

export const Right = ({ games, popularityByGameId, onGameClick, onAccountClick, continueMatch, onContinueMatch, onDestroyContinueMatch }: RightProps) => (
    <OverviewSpread games={games} popularityByGameId={popularityByGameId} onGameClick={onGameClick} onAccountClick={onAccountClick} continueMatch={continueMatch} onContinueMatch={onContinueMatch} onDestroyContinueMatch={onDestroyContinueMatch} />
);

export const LobbyDirectory = {
    Overview,
    OverviewSpread,
    Left,
    Right,
};
