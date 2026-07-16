import type { MatchState } from '../../engine/types';
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { FactionId, SummonerWarsCore } from './domain/types';

const FACTION_DIR_MAP: Record<FactionId, string> = {
    necromancer: 'Necromancer',
    trickster: 'Trickster',
    paladin: 'Paladin',
    goblin: 'Goblin',
    frost: 'Frost',
    barbaric: 'Barbaric',
    mogu: 'mogu',
    huijin: 'huijin',
};

const ALL_FACTIONS: FactionId[] = ['necromancer', 'trickster', 'paladin', 'goblin', 'frost', 'barbaric', 'mogu', 'huijin'];

const SELECTION_CRITICAL = [
    'summonerwars/common/map',
    'summonerwars/common/cardback',
] as const;

const GAMEPLAY_COMMON = [
    'summonerwars/common/Portal',
    'summonerwars/common/dice',
] as const;

function dedupePreserveOrder<T>(items: T[]): T[] {
    return [...new Set(items)];
}

function getHeroAtlasPath(factionId: FactionId): string {
    return `summonerwars/hero/${FACTION_DIR_MAP[factionId]}/hero`;
}

function getCardsAtlasPath(factionId: FactionId): string {
    return `summonerwars/hero/${FACTION_DIR_MAP[factionId]}/cards`;
}

function getTipImagePath(factionId: FactionId): string {
    return `summonerwars/hero/${FACTION_DIR_MAP[factionId]}/tip`;
}

function isInFactionSelectPhase(core: SummonerWarsCore): boolean {
    return !core.hostStarted;
}

function buildSelectionSnapshot(core: SummonerWarsCore): string {
    return Object.entries(core.selectedFactions)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([pid, factionId]) => `${pid}:${factionId ?? 'unselected'}`)
        .join('|');
}

function getFactionBuckets(
    core: SummonerWarsCore,
    playerID?: string | null,
): {
    mySelected: FactionId[];
    opponentSelected: FactionId[];
    remainingSelected: FactionId[];
    allSelected: FactionId[];
    unselected: FactionId[];
} {
    const orderedEntries = Object.entries(core.selectedFactions)
        .sort(([left], [right]) => left.localeCompare(right))
        .filter(([, factionId]) => factionId && factionId !== 'unselected')
        .map(([pid, factionId]) => ({ pid, factionId: factionId as FactionId }));

    const mySelected = playerID
        ? orderedEntries
            .filter(({ pid }) => pid === playerID)
            .map(({ factionId }) => factionId)
        : [];

    const restSelected = playerID
        ? orderedEntries
            .filter(({ pid }) => pid !== playerID)
            .map(({ factionId }) => factionId)
        : orderedEntries.map(({ factionId }) => factionId);

    const opponentSelected = restSelected.slice(0, 1);
    const remainingSelected = restSelected.slice(1);
    const allSelected = dedupePreserveOrder([
        ...mySelected,
        ...opponentSelected,
        ...remainingSelected,
    ]);
    const selectedSet = new Set(allSelected);
    const unselected = ALL_FACTIONS.filter((factionId) => !selectedSet.has(factionId));

    return {
        mySelected,
        opponentSelected,
        remainingSelected,
        allSelected,
        unselected,
    };
}

export const summonerWarsCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<SummonerWarsCore> | undefined;
    const core = state?.core;
    const perspectiveKey = playerID ?? 'spectator';

    if (!core) {
        return {
            critical: [...SELECTION_CRITICAL, ...ALL_FACTIONS.map(getHeroAtlasPath)],
            warm: [...GAMEPLAY_COMMON, ...ALL_FACTIONS.map(getTipImagePath)],
            phaseKey: `init:${perspectiveKey}`,
        };
    }

    if (isInFactionSelectPhase(core)) {
        const isTutorial = state?.sys?.tutorial?.active === true;
        if (isTutorial) {
            return {
                critical: [...SELECTION_CRITICAL],
                warm: [],
                phaseKey: `tutorial-setup:${perspectiveKey}`,
            };
        }

        const { mySelected, opponentSelected, remainingSelected, unselected } = getFactionBuckets(core, playerID);
        return {
            critical: [...SELECTION_CRITICAL, ...ALL_FACTIONS.map(getHeroAtlasPath)],
            warm: dedupePreserveOrder([
                ...GAMEPLAY_COMMON,
                ...mySelected.map(getCardsAtlasPath),
                ...opponentSelected.map(getCardsAtlasPath),
                ...remainingSelected.map(getCardsAtlasPath),
                ...mySelected.map(getTipImagePath),
                ...opponentSelected.map(getTipImagePath),
                ...remainingSelected.map(getTipImagePath),
                ...unselected.map(getTipImagePath),
            ]),
            phaseKey: `factionSelect:${perspectiveKey}:${buildSelectionSnapshot(core)}`,
        };
    }

    const { mySelected, opponentSelected, remainingSelected, allSelected, unselected } = getFactionBuckets(core, playerID);

    if (allSelected.length === 0) {
        return {
            critical: [
                ...SELECTION_CRITICAL,
                ...GAMEPLAY_COMMON,
                ...ALL_FACTIONS.map(getHeroAtlasPath),
                ...ALL_FACTIONS.map(getCardsAtlasPath),
            ],
            warm: [],
            phaseKey: `playing:${perspectiveKey}:fallback-all`,
        };
    }

    const critical = dedupePreserveOrder([
        ...SELECTION_CRITICAL,
        ...GAMEPLAY_COMMON,
        ...mySelected.map(getHeroAtlasPath),
        ...mySelected.map(getCardsAtlasPath),
        ...opponentSelected.map(getHeroAtlasPath),
        ...opponentSelected.map(getCardsAtlasPath),
        ...remainingSelected.map(getHeroAtlasPath),
        ...remainingSelected.map(getCardsAtlasPath),
    ]);

    const isTutorial = state?.sys?.tutorial?.active === true;
    return {
        critical,
        warm: isTutorial ? [] : unselected.map(getCardsAtlasPath),
        phaseKey: `playing:${perspectiveKey}:${buildSelectionSnapshot(core)}`,
    };
};

export default summonerWarsCriticalImageResolver;
