import type { MatchState } from '../../engine/types';
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { DiceThroneCore, SelectableCharacterId } from './domain/types';
import { hasDiceThroneTipBoard, IMPLEMENTED_DICETHRONE_CHARACTER_IDS } from './domain/types';

const CHARACTER_ASSET_TYPES = [
    { key: 'player-board', tags: ['selection', 'gameplay'] },
    { key: 'tip', tags: ['selection', 'gameplay'] },
    { key: 'ability-cards', tags: ['gameplay'] },
    { key: 'dice', tags: ['gameplay'] },
    { key: 'status-icons-atlas', tags: ['gameplay'] },
] as const;

type AssetTag = 'selection' | 'gameplay';

const CHARACTER_DIR_MAP: Record<SelectableCharacterId, string> = {
    monk: 'monk',
    barbarian: 'barbarian',
    pyromancer: 'pyromancer',
    shadow_thief: 'shadow_thief',
    moon_elf: 'moon_elf',
    paladin: 'paladin',
    gunslinger: 'gunslinger',
    samurai: 'samurai',
    treant: 'treant',
    ninja: 'ninja',
    zhanshujia: 'zhanshujia',
    cursed_pirate: 'cursed',
    artificer: 'artificial',
    tianshi: 'tianshi',
    lieren: 'lieren',
    vampire_lord: 'xixuegui',
};

const IMPLEMENTED_CHARACTERS: readonly SelectableCharacterId[] = IMPLEMENTED_DICETHRONE_CHARACTER_IDS;

const COMMON_CRITICAL_PATHS = [
    'dicethrone/images/Common/background',
    'dicethrone/images/Common/card-background',
    'dicethrone/images/Common/character-portraits',
    'dicethrone/images/Common/characterhead2',
] as const;

const HAND_ATLAS_CHARACTER_IDS: ReadonlySet<SelectableCharacterId> = new Set(['gunslinger', 'samurai']);
const EXTRA_GAMEPLAY_ASSETS_BY_CHARACTER: Partial<Record<SelectableCharacterId, string[]>> = {
    cursed_pirate: ['human-player-board'],
};

function dedupePreserveOrder(paths: string[]): string[] {
    return [...new Set(paths.filter(Boolean))];
}

function getCharAssetPath(charId: SelectableCharacterId, assetKey: string): string {
    return `dicethrone/images/${CHARACTER_DIR_MAP[charId]}/${assetKey}`;
}

function getHandAtlasAssets(charId: SelectableCharacterId): string[] {
    if (!HAND_ATLAS_CHARACTER_IDS.has(charId)) return [];
    return [getCharAssetPath(charId, 'hand-cards-atlas')];
}

function getExtraGameplayAssets(charId: SelectableCharacterId): string[] {
    return (EXTRA_GAMEPLAY_ASSETS_BY_CHARACTER[charId] ?? []).map((assetKey) => getCharAssetPath(charId, assetKey));
}

function getCharAssetsByTag(charId: SelectableCharacterId, tag: AssetTag): string[] {
    const baseAssets = CHARACTER_ASSET_TYPES
        .filter((asset) => asset.key !== 'tip' || hasDiceThroneTipBoard(charId))
        .filter((asset) => (asset.tags as readonly string[]).includes(tag))
        .map((asset) => getCharAssetPath(charId, asset.key));
    if (tag !== 'gameplay') return baseAssets;
    return [...baseAssets, ...getExtraGameplayAssets(charId), ...getHandAtlasAssets(charId)];
}

function getAllCharAssets(charId: SelectableCharacterId): string[] {
    return [
        ...CHARACTER_ASSET_TYPES
            .filter((asset) => asset.key !== 'tip' || hasDiceThroneTipBoard(charId))
            .map((asset) => getCharAssetPath(charId, asset.key)),
        ...getHandAtlasAssets(charId),
    ];
}

function extractSelectedCharacters(core: DiceThroneCore): SelectableCharacterId[] {
    const selected = new Set<SelectableCharacterId>();
    for (const charId of Object.values(core.selectedCharacters)) {
        if (charId && charId !== 'unselected') {
            selected.add(charId as SelectableCharacterId);
        }
    }
    return [...selected];
}

function isInSetupPhase(core: DiceThroneCore): boolean {
    return !core.hostStarted;
}

function buildSelectionSnapshot(core: DiceThroneCore): string {
    return Object.entries(core.selectedCharacters)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([pid, charId]) => `${pid}:${charId ?? 'unselected'}`)
        .join('|');
}

function getPerspectiveCharacterBuckets(
    core: DiceThroneCore,
    playerID?: string | null,
): {
    mySelected: SelectableCharacterId[];
    opponentSelected: SelectableCharacterId[];
    remaining: SelectableCharacterId[];
    allSelected: SelectableCharacterId[];
} {
    const allSelected = extractSelectedCharacters(core);
    const selectedSet = new Set(allSelected);
    const myCharId = playerID ? core.selectedCharacters[playerID] : null;
    const mySelected = myCharId && myCharId !== 'unselected'
        ? [myCharId as SelectableCharacterId]
        : [];
    const opponentSelected = playerID
        ? allSelected.filter((charId) => charId !== mySelected[0])
        : allSelected;
    const remaining = IMPLEMENTED_CHARACTERS.filter((charId) => !selectedSet.has(charId));

    return {
        mySelected,
        opponentSelected,
        remaining,
        allSelected,
    };
}

function buildSetupWarmPaths(core: DiceThroneCore, playerID?: string | null): string[] {
    const { mySelected, opponentSelected, remaining } = getPerspectiveCharacterBuckets(core, playerID);
    return dedupePreserveOrder([
        ...mySelected.flatMap((charId) => getCharAssetsByTag(charId, 'gameplay')),
        ...opponentSelected.flatMap((charId) => getCharAssetsByTag(charId, 'gameplay')),
        ...remaining.flatMap((charId) => getCharAssetsByTag(charId, 'gameplay')),
    ]);
}

export const diceThroneCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<DiceThroneCore> | undefined;
    const core = state?.core;
    const perspectiveKey = playerID ?? 'spectator';

    if (!core) {
        const critical = [
            ...COMMON_CRITICAL_PATHS,
            ...IMPLEMENTED_CHARACTERS.flatMap((charId) => getCharAssetsByTag(charId, 'selection')),
        ];
        const warm = IMPLEMENTED_CHARACTERS.flatMap((charId) => getCharAssetsByTag(charId, 'gameplay'));
        return {
            critical: dedupePreserveOrder(critical),
            warm: dedupePreserveOrder(warm),
            phaseKey: `no-state:${perspectiveKey}`,
        };
    }

    if (isInSetupPhase(core)) {
        const isTutorial = state?.sys?.tutorial?.active === true;
        if (isTutorial) {
            return {
                critical: [...COMMON_CRITICAL_PATHS],
                warm: [],
                phaseKey: `tutorial-setup:${perspectiveKey}`,
            };
        }

        const critical = [
            ...COMMON_CRITICAL_PATHS,
            ...IMPLEMENTED_CHARACTERS.flatMap((charId) => getCharAssetsByTag(charId, 'selection')),
        ];

        return {
            critical: dedupePreserveOrder(critical),
            warm: buildSetupWarmPaths(core, playerID),
            phaseKey: `setup:${perspectiveKey}:${buildSelectionSnapshot(core)}`,
        };
    }

    const { mySelected, opponentSelected, allSelected } = getPerspectiveCharacterBuckets(core, playerID);
    if (allSelected.length === 0) {
        return {
            critical: [...COMMON_CRITICAL_PATHS],
            warm: [],
            phaseKey: `playing:${perspectiveKey}:none`,
        };
    }

    const criticalCharacters = playerID ? mySelected : allSelected;
    const critical = [
        ...COMMON_CRITICAL_PATHS,
        ...criticalCharacters.flatMap((charId) => getAllCharAssets(charId)),
    ];

    const warm = playerID
        ? opponentSelected.flatMap((charId) => getAllCharAssets(charId))
        : [];

    return {
        critical: dedupePreserveOrder(critical),
        warm: dedupePreserveOrder(warm),
        phaseKey: `playing:${perspectiveKey}:${buildSelectionSnapshot(core)}`,
    };
};

export const _testExports = {
    CHARACTER_ASSET_TYPES,
    HAND_ATLAS_CHARACTER_IDS,
    IMPLEMENTED_CHARACTERS,
    COMMON_CRITICAL_PATHS,
    getCharAssetPath,
    getCharAssetsByTag,
    getAllCharAssets,
    getExtraGameplayAssets,
    getHandAtlasAssets,
};

export default diceThroneCriticalImageResolver;
