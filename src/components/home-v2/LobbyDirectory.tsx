import React from 'react';
import { Compass, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameConfig } from '../../config/games.config';
import { useAuth } from '../../contexts/AuthContext';
import { OptimizedImage } from '../common/media/OptimizedImage';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';

type LobbyCategory = 'all' | 'card' | 'dice' | 'abstract' | 'wargame' | 'casual' | 'tools';

type PositionedRect = {
    left: string;
    top: string;
    width: string;
    height: string;
};

type HomepageCatalogEntryMeta = {
    id: string;
    rect: PositionedRect;
};

type CategoryNavItem = {
    id: LobbyCategory;
    left: string;
    width: string;
};

const CATEGORY_NAV_ITEMS: CategoryNavItem[] = [
    { id: 'all', left: '9.9%', width: '15.4%' },
    { id: 'card', left: '31.2%', width: '6.8%' },
    { id: 'dice', left: '41.5%', width: '6.4%' },
    { id: 'abstract', left: '54.8%', width: '7.0%' },
    { id: 'wargame', left: '66.2%', width: '7.0%' },
    { id: 'casual', left: '76.2%', width: '6.4%' },
    { id: 'tools', left: '85.4%', width: '6.4%' },
];

const HOMEPAGE_CATALOG_LAYOUT: HomepageCatalogEntryMeta[] = [
    {
        id: 'cardia',
        rect: { left: '6.7%', top: '18.0%', width: '39.4%', height: '20.5%' },
    },
    {
        id: 'dicethrone',
        rect: { left: '6.7%', top: '40.8%', width: '39.4%', height: '20.5%' },
    },
    {
        id: 'smashup',
        rect: { left: '6.7%', top: '63.6%', width: '39.4%', height: '20.5%' },
    },
    {
        id: 'splendor',
        rect: { left: '52.9%', top: '18.0%', width: '39.7%', height: '20.5%' },
    },
    {
        id: 'summonerwars',
        rect: { left: '52.9%', top: '40.8%', width: '39.7%', height: '20.5%' },
    },
    {
        id: 'tictactoe',
        rect: { left: '52.9%', top: '63.6%', width: '39.7%', height: '20.5%' },
    },
];

const ACCOUNT_RECT: PositionedRect = { left: '79.1%', top: '2.0%', width: '12.7%', height: '5.7%' };
const HELP_RECT: PositionedRect = { left: '90.9%', top: '2.0%', width: '6.2%', height: '5.7%' };
const EMPTY_STATE_RECT: PositionedRect = { left: '28.5%', top: '36.8%', width: '43.0%', height: '20.0%' };

const OVERVIEW_CONTENT_RECT: PositionedRect = { left: '4.4%', top: '4.3%', width: '91.2%', height: '86.4%' };

function asAbsoluteStyle(rect: PositionedRect): React.CSSProperties {
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
    };
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
        return `${Math.min(...game.playerOptions)}-${Math.max(...game.playerOptions)}${t('common:game_details.people')}`;
    }
    if (game.playerOptions?.length === 1) {
        return `${game.playerOptions[0]}${t('common:game_details.people')}`;
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
    if (sentenceMatches.length > 0) {
        let summary = sentenceMatches[0].trim();
        if (summary.length < 20 && sentenceMatches.length > 1) {
            const appended = `${summary}${sentenceMatches[1].trim()}`.trim();
            if (appended.length <= 32) {
                summary = appended;
            }
        }
        if (summary.length <= 30) {
            return summary;
        }
    }

    const clauseBreakIndex = fullDescription.search(/[，,、：:]/);
    if (clauseBreakIndex >= 0 && clauseBreakIndex <= 22) {
        return fullDescription.slice(0, clauseBreakIndex);
    }

    if (fullDescription.length <= 30) {
        return fullDescription;
    }

    return `${fullDescription.slice(0, 28).trim()}…`;
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
        default:
            return badgeKey;
    }
}

function matchesActiveCategory(game: Pick<GameConfig, 'category' | 'tags'>, activeCategory: LobbyCategory) {
    if (activeCategory === 'all') {
        return true;
    }
    return game.category === activeCategory || game.tags?.includes(activeCategory);
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
            className="rounded-[calc(6px*var(--home-v2-stage-scale))] border border-[#c6aa79]/70 bg-[rgba(247,236,212,0.74)] px-[calc(10px*var(--home-v2-stage-scale))] py-[calc(4px*var(--home-v2-stage-scale))] text-[#7b5b34]"
            style={{
                fontSize: 'calc(16px * var(--home-v2-stage-scale))',
                lineHeight: 1,
            }}
        >
            {badgeLabel}
        </span>
    );
}

function HomeCatalogThumbnail({ game }: { game: GameConfig }) {
    const { t } = useTranslation(['lobby', 'common']);
    const [imgFailed, setImgFailed] = React.useState(false);
    const title = resolveGameDisplayName(game, t, game.id);
    const manifestThumbnail = React.useMemo(() => {
        if (!React.isValidElement(game.thumbnail)) {
            return game.thumbnail;
        }
        return React.cloneElement(game.thumbnail);
    }, [game.thumbnail]);

    if (!game.thumbnailPath || imgFailed) {
        if (manifestThumbnail) {
            return (
                <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
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
                        fontSize: 'calc(30px * var(--home-v2-stage-scale))',
                        lineHeight: 1,
                        fontWeight: 600,
                    }}
                >
                    {game.icon || '·'}
                </span>
            </div>
        );
    }

    return (
        <OptimizedImage
            src={game.thumbnailPath}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgFailed(true)}
        />
    );
}

function renderHomepageThumbnail(game: GameConfig) {
    return <HomeCatalogThumbnail game={game} />;
}

export interface OverviewSpreadProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
}

export const OverviewSpread = ({ games, onGameClick, onAccountClick }: OverviewSpreadProps) => {
    const { t } = useTranslation(['lobby', 'common']);
    const { user } = useAuth();
    const [activeCategory, setActiveCategory] = React.useState<LobbyCategory>('all');

    const gameMap = React.useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
    const visibleEntries = React.useMemo(
        () => HOMEPAGE_CATALOG_LAYOUT.filter((entry) => {
            const game = gameMap.get(entry.id);
            if (!game) {
                return false;
            }
            return matchesActiveCategory(game, activeCategory);
        }),
        [activeCategory, gameMap],
    );

    const playerLabel = user?.username?.trim() || t('lobby:homeV2.catalog.playerNickname');

    return (
        <div className="pointer-events-auto relative h-full w-full text-[#5a3f27] select-none">
            <div
                className="absolute"
                style={asAbsoluteStyle(OVERVIEW_CONTENT_RECT)}
            >
            <div
                className="absolute left-[6.9%] top-[12.2%] h-px w-[85.0%] bg-[linear-gradient(90deg,rgba(149,113,68,0)_0%,rgba(149,113,68,0.55)_12%,rgba(149,113,68,0.55)_88%,rgba(149,113,68,0)_100%)]"
                aria-hidden="true"
            />

            {CATEGORY_NAV_ITEMS.map(({ id, left, width }) => {
                const isActive = activeCategory === id;
                return (
                    <button
                        key={id}
                        type="button"
                        data-testid={`home-v2-category-${id}`}
                        aria-pressed={isActive}
                        className="absolute flex items-center justify-center border-0 bg-transparent p-0 text-[#4f3824] transition-opacity duration-150 hover:opacity-100"
                        style={{
                            left,
                            top: '4.5%',
                            width,
                            height: '7.2%',
                            fontSize: isActive
                                ? 'calc(33px * var(--home-v2-stage-scale))'
                                : 'calc(29px * var(--home-v2-stage-scale))',
                            fontWeight: isActive ? 700 : 600,
                            letterSpacing: isActive ? '0' : '0.01em',
                            color: isActive ? '#66713a' : '#5a4028',
                            opacity: isActive ? 1 : 0.9,
                        }}
                        onClick={() => setActiveCategory(id)}
                    >
                        <span
                            className="relative inline-flex h-full items-center justify-center px-[calc(6px*var(--home-v2-stage-scale))]"
                            style={{ fontSize: isActive ? 'calc(29px * var(--home-v2-stage-scale))' : undefined }}
                        >
                            {buildCategoryLabel(id, t)}
                            {isActive ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute bottom-[10%] left-1/2 h-[calc(2px*var(--home-v2-stage-scale))] w-[72%] -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(128,140,67,0)_0%,rgba(128,140,67,0.95)_20%,rgba(128,140,67,0.95)_80%,rgba(128,140,67,0)_100%)]"
                                />
                            ) : null}
                        </span>
                    </button>
                );
            })}

            <button
                type="button"
                data-testid="home-v2-account-entry"
                aria-label={playerLabel}
                title={playerLabel}
                className="absolute flex items-center justify-start gap-[calc(5px*var(--home-v2-stage-scale))] border-0 bg-transparent p-0 text-[#5a3f27]"
                style={asAbsoluteStyle(ACCOUNT_RECT)}
                onClick={onAccountClick}
            >
                <span className="flex items-center justify-center rounded-full bg-[rgba(209,166,69,0.96)] text-[#fff4d3] shadow-[0_2px_4px_rgba(70,41,16,0.22)]">
                    <User
                        size={18}
                        style={{
                            width: 'calc(25px * var(--home-v2-stage-scale))',
                            height: 'calc(25px * var(--home-v2-stage-scale))',
                            padding: 'calc(5px * var(--home-v2-stage-scale))',
                        }}
                    />
                </span>
                <span
                    className="truncate"
                    style={{
                        maxWidth: 'calc(126px * var(--home-v2-stage-scale))',
                        fontSize: 'calc(15.5px * var(--home-v2-stage-scale))',
                        fontWeight: 700,
                        opacity: 0.98,
                    }}
                >
                    {playerLabel}
                </span>
            </button>

            <button
                type="button"
                aria-label={t('lobby:homeV2.catalog.help')}
                title={t('lobby:homeV2.catalog.help')}
                className="absolute flex items-center justify-start gap-[calc(5px*var(--home-v2-stage-scale))] border-0 bg-transparent p-0 text-[#5a3f27]"
                style={asAbsoluteStyle(HELP_RECT)}
            >
                <span className="flex items-center justify-center rounded-full bg-[rgba(209,166,69,0.82)] text-[#604224] shadow-[0_2px_4px_rgba(70,41,16,0.16)]">
                    <Compass
                        size={18}
                        style={{
                            width: 'calc(23px * var(--home-v2-stage-scale))',
                            height: 'calc(23px * var(--home-v2-stage-scale))',
                            padding: 'calc(5px * var(--home-v2-stage-scale))',
                        }}
                    />
                </span>
                <span
                    className="truncate"
                    style={{
                        maxWidth: 'calc(58px * var(--home-v2-stage-scale))',
                        fontSize: 'calc(14.5px * var(--home-v2-stage-scale))',
                        fontWeight: 700,
                        opacity: 0.98,
                    }}
                >
                    {t('lobby:homeV2.catalog.help')}
                </span>
            </button>

            {visibleEntries.length === 0 ? (
                <div
                    className="absolute flex flex-col items-center justify-center rounded-[calc(22px*var(--home-v2-stage-scale))] border border-[#b89a6b]/55 bg-[rgba(247,237,212,0.72)] text-center text-[#6b4a2b]"
                    style={asAbsoluteStyle(EMPTY_STATE_RECT)}
                >
                    <div
                        style={{
                            fontSize: 'calc(22px * var(--home-v2-stage-scale))',
                            fontWeight: 700,
                            marginBottom: 'calc(8px * var(--home-v2-stage-scale))',
                        }}
                    >
                        {t('lobby:homeV2.referenceCatalog.emptyTitle')}
                    </div>
                    <div style={{ fontSize: 'calc(14px * var(--home-v2-stage-scale))' }}>
                        {t('lobby:homeV2.referenceCatalog.emptyDescription')}
                    </div>
                </div>
            ) : null}

            {visibleEntries.map((entry) => {
                const game = gameMap.get(entry.id);
                if (!game) {
                    return null;
                }
                const badgeKeys = resolveGameBadgeKeys(game).filter((badgeKey, index, allKeys) => {
                    const label = resolveBadgeLabel(badgeKey, t);
                    return allKeys.findIndex((candidate) => resolveBadgeLabel(candidate, t) === label) === index;
                });
                const homepageSummary = buildHomepageSummary(game, t);

                return (
                    <button
                        key={entry.id}
                        type="button"
                        data-game-id={entry.id}
                        aria-label={resolveGameDisplayName(game, t, entry.id)}
                        className="absolute border-0 bg-transparent p-0 text-left transition-transform duration-150 hover:scale-[1.005]"
                        style={asAbsoluteStyle(entry.rect)}
                        onClick={() => onGameClick(entry.id)}
                    >
                        <div className="relative flex h-full w-full gap-[calc(18px*var(--home-v2-stage-scale))]">
                            <div
                                className="relative shrink-0 overflow-hidden rounded-[calc(14px*var(--home-v2-stage-scale))] shadow-[0_8px_18px_rgba(57,35,14,0.18)]"
                                style={{
                                    width: '30.2%',
                                    height: '85.5%',
                                    marginTop: '1.1%',
                                }}
                            >
                                <div className="absolute inset-0">{renderHomepageThumbnail(game)}</div>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col">
                                <div
                                    className="truncate text-[#4b2f1d]"
                                    style={{
                                        marginTop: 'calc(1px * var(--home-v2-stage-scale))',
                                        fontSize: 'calc(41px * var(--home-v2-stage-scale))',
                                        fontWeight: 700,
                                        lineHeight: 1.04,
                                    }}
                                >
                                    {resolveGameDisplayName(game, t, entry.id)}
                                </div>

                                <div
                                    className="mt-[calc(9px*var(--home-v2-stage-scale))] max-w-[76%] text-[#6c4b2f]"
                                    style={{
                                        fontSize: 'calc(19px * var(--home-v2-stage-scale))',
                                        lineHeight: 1.42,
                                        minHeight: 'calc(46px * var(--home-v2-stage-scale))',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {homepageSummary}
                                </div>

                                <div className="mt-[calc(11px*var(--home-v2-stage-scale))] flex items-end justify-between gap-[calc(10px*var(--home-v2-stage-scale))]">
                                    <div className="flex flex-wrap gap-[calc(8px*var(--home-v2-stage-scale))]">
                                        {badgeKeys.map((badgeKey, index) => renderBadge(badgeKey, index, t))}
                                    </div>
                                    <div
                                        className="shrink-0 text-[#705238]"
                                        style={{
                                            fontSize: 'calc(23px * var(--home-v2-stage-scale))',
                                            fontWeight: 600,
                                            marginRight: 'calc(4px * var(--home-v2-stage-scale))',
                                        }}
                                    >
                                        {buildPlayerLabel(game, t)}
                                    </div>
                                </div>
                            </div>

                            <div
                                className="pointer-events-none absolute bottom-0 left-[16.8%] h-px w-[78.8%] bg-[linear-gradient(90deg,rgba(168,132,81,0)_0%,rgba(168,132,81,0.52)_15%,rgba(168,132,81,0.52)_85%,rgba(168,132,81,0)_100%)]"
                                aria-hidden="true"
                            />
                        </div>
                    </button>
                );
            })}
            </div>
        </div>
    );
};

export interface OverviewProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
}

export const Overview = ({ games, onGameClick, onAccountClick }: OverviewProps) => (
    <OverviewSpread games={games} onGameClick={onGameClick} onAccountClick={onAccountClick} />
);

export interface LeftProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
}

export const Left = ({ games, onGameClick, onAccountClick }: LeftProps) => (
    <OverviewSpread games={games} onGameClick={onGameClick} onAccountClick={onAccountClick} />
);

export interface RightProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
    onAccountClick?: () => void;
}

export const Right = ({ games, onGameClick, onAccountClick }: RightProps) => (
    <OverviewSpread games={games} onGameClick={onGameClick} onAccountClick={onAccountClick} />
);

export const LobbyDirectory = {
    Overview,
    OverviewSpread,
    Left,
    Right,
};
