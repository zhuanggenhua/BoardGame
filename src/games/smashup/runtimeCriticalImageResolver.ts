import type { MatchState } from '../../engine/types';
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import { getAllBaseDefs, getAllCardDefs, getBasePodFactionIds } from './data/cards';
import smashUpEnglishMap from './data/englishAtlasMap.json';
import { getSmashUpAtlasImageById, getSmashUpAtlasImagesByKind } from './domain/atlasCatalog';

type PreviewRefLike = {
    type?: string;
    atlasId?: string;
};

type DefWithFactionPreview = {
    faction?: string;
    previewRef?: PreviewRefLike;
};

type SmashUpPlayerLike = {
    factions?: [string, string];
};

const ALL_CARD_ATLAS = getSmashUpAtlasImagesByKind('card');
const ALL_BASE_ATLAS = getSmashUpAtlasImagesByKind('base');
const TTS_MAP = smashUpEnglishMap as Record<string, { atlasId: string; index: number }>;

function dedupePreserveOrder<T>(items: T[]): T[] {
    return [...new Set(items)];
}

function resolveAtlasImagePath(previewRef?: PreviewRefLike): string | undefined {
    if (!previewRef || previewRef.type !== 'atlas' || typeof previewRef.atlasId !== 'string') {
        return undefined;
    }
    return getSmashUpAtlasImageById(previewRef.atlasId);
}

function buildFactionAtlasMap(defs: DefWithFactionPreview[]): Record<string, string[]> {
    const map = new Map<string, Set<string>>();

    for (const def of defs) {
        const faction = def.faction;
        if (!faction) continue;
        const atlasPath = resolveAtlasImagePath(def.previewRef);
        if (!atlasPath) continue;

        let set = map.get(faction);
        if (!set) {
            set = new Set<string>();
            map.set(faction, set);
        }
        set.add(atlasPath);
    }

    return Object.fromEntries(
        [...map.entries()].map(([faction, atlases]) => [faction, [...atlases]]),
    );
}

function getFactionCardAtlasMap(): Record<string, string[]> {
    return buildFactionAtlasMap(getAllCardDefs());
}

function getFactionBaseAtlasMap(): Record<string, string[]> {
    const map = new Map<string, Set<string>>();

    for (const base of getAllBaseDefs()) {
        const factionIds = new Set<string>();
        if (base.faction) {
            factionIds.add(base.faction);
        }
        for (const podFactionId of getBasePodFactionIds(base)) {
            factionIds.add(podFactionId);
        }

        const atlasPaths = new Set<string>();
        const previewAtlasPath = resolveAtlasImagePath(base.previewRef);
        if (previewAtlasPath) {
            atlasPaths.add(previewAtlasPath);
        }
        const podAtlasId = TTS_MAP[`${base.id}_pod`]?.atlasId;
        const podAtlasPath = podAtlasId ? getSmashUpAtlasImageById(podAtlasId) : undefined;
        if (podAtlasPath) {
            atlasPaths.add(podAtlasPath);
        }
        if (atlasPaths.size === 0) continue;

        for (const factionId of factionIds) {
            let set = map.get(factionId);
            if (!set) {
                set = new Set<string>();
                map.set(factionId, set);
            }
            for (const atlasPath of atlasPaths) {
                set.add(atlasPath);
            }
        }
    }

    return Object.fromEntries(
        [...map.entries()].map(([faction, atlases]) => [faction, [...atlases]]),
    );
}

function getCardAtlasesForFactions(factionIds: string[]): string[] {
    const atlasMap = getFactionCardAtlasMap();
    return dedupePreserveOrder(
        factionIds.flatMap((factionId) => atlasMap[factionId] ?? []),
    );
}

function getBaseAtlasesForFactions(factionIds: string[]): string[] {
    const atlasMap = getFactionBaseAtlasMap();
    return dedupePreserveOrder(
        factionIds.flatMap((factionId) => atlasMap[factionId] ?? []),
    );
}

function getOrderedPlayers(state: MatchState): Array<{ pid: string; factions: string[] }> {
    const core = state.core as { players?: Record<string, SmashUpPlayerLike> };
    const players = core.players ?? {};

    return Object.entries(players)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([pid, player]) => ({
            pid,
            factions: dedupePreserveOrder((player.factions ?? []).filter(Boolean)),
        }));
}

function buildSelectionSnapshot(state: MatchState): string {
    const orderedPlayers = getOrderedPlayers(state);
    if (orderedPlayers.length === 0) {
        return 'none';
    }
    return orderedPlayers
        .map(({ pid, factions }) => `${pid}:${factions.join(',') || 'none'}`)
        .join('|');
}

function getFactionBuckets(
    state: MatchState,
    playerID?: string | null,
): {
    mySelected: string[];
    opponentSelected: string[];
    remainingSelected: string[];
    allSelected: string[];
} {
    const orderedPlayers = getOrderedPlayers(state).filter(({ factions }) => factions.length > 0);
    const mySelected = playerID
        ? orderedPlayers.find(({ pid }) => pid === playerID)?.factions ?? []
        : [];

    const otherPlayers = playerID
        ? orderedPlayers.filter(({ pid }) => pid !== playerID)
        : orderedPlayers;

    const opponentSelected = otherPlayers[0]?.factions ?? [];
    const remainingSelected = dedupePreserveOrder(
        otherPlayers.slice(1).flatMap(({ factions }) => factions),
    );
    const allSelected = dedupePreserveOrder([
        ...mySelected,
        ...opponentSelected,
        ...remainingSelected,
    ]);

    return {
        mySelected,
        opponentSelected,
        remainingSelected,
        allSelected,
    };
}

function buildPlayingPhaseKey(state: MatchState, playerID?: string | null): string {
    return `playing:${playerID ?? 'spectator'}:${buildSelectionSnapshot(state)}`;
}

export const smashUpRuntimeCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState | undefined;
    const perspectiveKey = playerID ?? 'spectator';

    if (!state?.core) {
        return {
            critical: [...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS],
            warm: [],
            phaseKey: `init:${perspectiveKey}`,
        };
    }

    const phase = state.sys?.phase;
    const isTutorial = state.sys?.tutorial?.active === true;
    const { mySelected, opponentSelected, remainingSelected, allSelected } = getFactionBuckets(state, playerID);

    if (phase === 'factionSelect') {
        if (isTutorial) {
            return {
                critical: [],
                warm: [],
                phaseKey: `tutorial-factionSelect:${perspectiveKey}`,
            };
        }

        const selectedBaseAtlases = getBaseAtlasesForFactions(allSelected);
        const remainingBaseAtlases = ALL_BASE_ATLAS.filter((atlas) => !selectedBaseAtlases.includes(atlas));

        return {
            critical: [...ALL_CARD_ATLAS],
            warm: [...selectedBaseAtlases, ...remainingBaseAtlases],
            phaseKey: `factionSelect:${perspectiveKey}:${buildSelectionSnapshot(state)}`,
        };
    }

    if (isTutorial && allSelected.length === 0) {
        return {
            critical: [],
            warm: [],
            phaseKey: `tutorial-setup:${perspectiveKey}`,
        };
    }

    if (allSelected.length > 0) {
        return {
            critical: dedupePreserveOrder([
                ...getBaseAtlasesForFactions(allSelected),
                ...getCardAtlasesForFactions(mySelected),
                ...getCardAtlasesForFactions(opponentSelected),
                ...getCardAtlasesForFactions(remainingSelected),
            ]),
            warm: [],
            phaseKey: buildPlayingPhaseKey(state, playerID),
        };
    }

    return {
        critical: [...ALL_CARD_ATLAS, ...ALL_BASE_ATLAS],
        warm: [],
        phaseKey: `playing:${perspectiveKey}:fallback-all`,
    };
};

export default smashUpRuntimeCriticalImageResolver;
