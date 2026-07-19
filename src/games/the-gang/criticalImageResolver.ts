import type { MatchState } from '../../engine/types';
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import {
    THE_GANG_CHALLENGES,
    THE_GANG_SPECIALISTS,
    THE_GANG_TOOLS,
} from './domain/expansions';
import type { PlayingCard, Suit, TheGangCore } from './domain/types';

const CARD_BACK_ASSET_PATH = 'the-gang/cards/card-back';

const CARD_RANK_ASSET_NAMES = {
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    J: 'jack',
    Q: 'queen',
    K: 'king',
    A: 'ace',
} as const;

const STANDARD_SUITS: readonly Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

const CHIP_ASSET_COLORS = {
    1: 'white',
    2: 'yellow',
    3: 'orange',
    4: 'red',
} as const;

const RULE_SURFACE_ASSET_PATHS = [
    'the-gang/rule-assets/surfaces/challenge-zone',
    'the-gang/rule-assets/surfaces/tools-zone',
    'the-gang/rule-assets/surfaces/tools-discard-zone',
    'the-gang/rule-assets/surfaces/specialists-zone',
    'the-gang/rule-assets/surfaces/specialists-discard-zone',
] as const;

const dedupePreserveOrder = (paths: readonly string[]): string[] => [...new Set(paths)];

const getChipAssetPath = (round: number, value: number): string => {
    const color = CHIP_ASSET_COLORS[round as keyof typeof CHIP_ASSET_COLORS] ?? 'white';
    return `the-gang/chips/round-${round}-${color}-${value}`;
};

const getCardAssetPath = (card: PlayingCard): string | undefined => {
    if (card.suit === 'gear' || card.suit === 'special') return undefined;
    const rank = CARD_RANK_ASSET_NAMES[card.rank as keyof typeof CARD_RANK_ASSET_NAMES];
    return rank ? `the-gang/cards/${rank}-${card.suit}` : undefined;
};

const THE_GANG_CHALLENGE_IMAGE_PATHS = Object.keys(THE_GANG_CHALLENGES)
    .map((challengeId) => `the-gang/rule-assets/challenges/${challengeId}`);

const THE_GANG_TOOL_IMAGE_PATHS = Object.keys(THE_GANG_TOOLS)
    .map((toolId) => `the-gang/rule-assets/tools/${toolId}`);

const THE_GANG_SPECIALIST_IMAGE_PATHS = Object.keys(THE_GANG_SPECIALISTS)
    .map((specialistId) => `the-gang/rule-assets/specialists/${specialistId}`);

const THE_GANG_STANDARD_CARD_IMAGE_PATHS = Object.values(CARD_RANK_ASSET_NAMES)
    .flatMap((rank) => STANDARD_SUITS.map((suit) => `the-gang/cards/${rank}-${suit}`));

const THE_GANG_CHIP_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

const THE_GANG_CHIP_IMAGE_PATHS = [1, 2, 3, 4]
    .flatMap((round) => THE_GANG_CHIP_VALUES.map((value) => getChipAssetPath(round, value)));

const THE_GANG_SETUP_CRITICAL_IMAGE_PATHS = dedupePreserveOrder([
    CARD_BACK_ASSET_PATH,
    ...THE_GANG_CHIP_IMAGE_PATHS,
]);

const THE_GANG_RULE_WARM_IMAGE_PATHS = dedupePreserveOrder([
    ...RULE_SURFACE_ASSET_PATHS,
    ...THE_GANG_CHALLENGE_IMAGE_PATHS,
    ...THE_GANG_TOOL_IMAGE_PATHS,
    ...THE_GANG_SPECIALIST_IMAGE_PATHS,
]);

const collectVisibleStandardCardPaths = (core: TheGangCore | undefined, playerID: string | null | undefined): string[] => {
    if (!core) return [];
    const localPlayerId = playerID ?? core.playerIds[0];
    const localPlayer = localPlayerId ? core.players[localPlayerId] : undefined;
    const paths: string[] = [];

    const addCards = (cards: readonly PlayingCard[] | undefined) => {
        for (const card of cards ?? []) {
            const path = getCardAssetPath(card);
            if (path) paths.push(path);
        }
    };

    addCards(core.communityCards);
    addCards(localPlayer?.pocketCards);
    addCards(localPlayer?.secondaryPocketCards);
    addCards(localPlayer?.flashlightCards);
    addCards(localPlayer?.nightVisionCards);
    addCards(core.lastShowdown?.results.flatMap((result) => [
        ...result.pocketCards,
        ...(result.secondaryPocketCards ?? []),
        ...result.bestCards,
    ]));

    return dedupePreserveOrder(paths);
};

export const theGangCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<TheGangCore> | undefined;
    const core = state?.core;
    const heistStarted = core?.heistStarted === true;
    const visibleCardPaths = collectVisibleStandardCardPaths(core, playerID);

    return {
        critical: dedupePreserveOrder([
            ...THE_GANG_SETUP_CRITICAL_IMAGE_PATHS,
            ...(heistStarted ? THE_GANG_STANDARD_CARD_IMAGE_PATHS : visibleCardPaths),
        ]),
        warm: dedupePreserveOrder([
            ...THE_GANG_RULE_WARM_IMAGE_PATHS,
            ...(heistStarted ? [] : THE_GANG_STANDARD_CARD_IMAGE_PATHS),
        ]),
        phaseKey: `the-gang:${heistStarted ? 'playing' : 'setup'}:${core?.phase ?? 'unknown'}:${core?.round ?? 0}:${playerID ?? 'spectator'}`,
    };
};

export const _testExports = {
    THE_GANG_CHALLENGE_IMAGE_PATHS,
    THE_GANG_RULE_WARM_IMAGE_PATHS,
    THE_GANG_SETUP_CRITICAL_IMAGE_PATHS,
    THE_GANG_STANDARD_CARD_IMAGE_PATHS,
};

export default theGangCriticalImageResolver;
