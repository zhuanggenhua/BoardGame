import type {
    BetrayalExplorerSummary,
    BetrayalExplorerTemplate,
    BetrayalTraitKey,
    BetrayalTraitTrackMap,
    BetrayalTraitTrackState,
} from './game';

export const BETRAYAL_TRAIT_KEYS: BetrayalTraitKey[] = ['might', 'speed', 'knowledge', 'sanity'];

export function buildDefaultTraitTrack(trackId: string, startValue: number): BetrayalTraitTrackState {
    const normalizedStart = Math.max(2, Math.round(startValue));
    const lowMid = Math.max(1, normalizedStart - 1);
    const highMid = normalizedStart + 1;
    const values = [
        1,
        lowMid,
        lowMid,
        normalizedStart,
        highMid,
        highMid,
        highMid + 1,
        highMid + 2,
    ];
    const startPosition = 3;
    return {
        trackId,
        values,
        position: startPosition,
        startPosition,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition: values.length - 1,
    };
}

export function buildTraitTrackFromSeed(
    trackId: string,
    seed: BetrayalExplorerTemplate['traitTracks'][BetrayalTraitKey],
    fallbackStartValue: number,
): BetrayalTraitTrackState {
    if (seed.values.length === 0) {
        return buildDefaultTraitTrack(trackId, fallbackStartValue);
    }
    const values = [...seed.values];
    const maxPosition = values.length - 1;
    const startPosition = Math.max(0, Math.min(maxPosition, seed.startPosition));
    return {
        trackId,
        values,
        position: startPosition,
        startPosition,
        criticalPosition: 0,
        skullPosition: -1,
        maxPosition,
    };
}

export function cloneTraitTrack(track: BetrayalTraitTrackState): BetrayalTraitTrackState {
    return { ...track, values: [...track.values] };
}

export function cloneTraitTracks(tracks: BetrayalTraitTrackMap): BetrayalTraitTrackMap {
    return Object.fromEntries(
        BETRAYAL_TRAIT_KEYS.map((trait) => [trait, cloneTraitTrack(tracks[trait])]),
    ) as BetrayalTraitTrackMap;
}

export function traitValueAtPosition(
    track: BetrayalTraitTrackState,
    position = track.position,
): number {
    if (position <= track.skullPosition) {
        return 0;
    }
    const clampedPosition = Math.max(track.criticalPosition, Math.min(track.maxPosition, position));
    return track.values[clampedPosition] ?? track.values[track.criticalPosition] ?? 1;
}

export function buildTraitTracksFromValues(
    explorerId: string,
    values: Record<BetrayalTraitKey, number>,
): BetrayalTraitTrackMap {
    return Object.fromEntries(
        BETRAYAL_TRAIT_KEYS.map((trait) => [
            trait,
            buildDefaultTraitTrack(`${explorerId}-${trait}`, values[trait]),
        ]),
    ) as BetrayalTraitTrackMap;
}

export function buildTraitTracksFromTemplate(template: BetrayalExplorerTemplate): BetrayalTraitTrackMap {
    return Object.fromEntries(
        BETRAYAL_TRAIT_KEYS.map((trait) => [
            trait,
            buildTraitTrackFromSeed(
                `${template.explorerId}-${trait}`,
                template.traitTracks[trait],
                template.traits[trait],
            ),
        ]),
    ) as BetrayalTraitTrackMap;
}

function positionForTraitValue(track: BetrayalTraitTrackState, value: number): number {
    if (value <= 0) {
        return track.skullPosition;
    }
    const exactPositions = track.values
        .map((trackValue, index) => ({ trackValue, index }))
        .filter(({ trackValue }) => trackValue === value)
        .map(({ index }) => index);
    if (exactPositions.length > 0) {
        return exactPositions.reduce((best, index) => (
            Math.abs(index - track.startPosition) < Math.abs(best - track.startPosition)
                ? index
                : best
        ), exactPositions[0]!);
    }
    return track.values.reduce((best, trackValue, index) => {
        const bestValue = track.values[best] ?? trackValue;
        return Math.abs(trackValue - value) < Math.abs(bestValue - value) ? index : best;
    }, track.criticalPosition);
}

function traitTrackContainsValue(track: BetrayalTraitTrackState, value: number): boolean {
    return value <= 0 || track.values.includes(value);
}

export function normalizeExplorerTraitTracks(explorer: BetrayalExplorerSummary): void {
    const currentTracks = explorer.traitTracks ?? buildTraitTracksFromValues(explorer.explorerId, explorer.traits);
    const normalizedTracks = {} as BetrayalTraitTrackMap;
    for (const trait of BETRAYAL_TRAIT_KEYS) {
        const existingTrack = currentTracks[trait]
            ?? buildDefaultTraitTrack(`${explorer.explorerId}-${trait}`, explorer.traits[trait]);
        let track = cloneTraitTrack(existingTrack);
        const derivedValue = traitValueAtPosition(track);
        if (explorer.traits[trait] !== derivedValue) {
            track = traitTrackContainsValue(track, explorer.traits[trait])
                ? track
                : buildDefaultTraitTrack(`${explorer.explorerId}-${trait}`, explorer.traits[trait]);
            track.position = positionForTraitValue(track, explorer.traits[trait]);
        }
        normalizedTracks[trait] = track;
        explorer.traits[trait] = traitValueAtPosition(track);
    }
    explorer.traitTracks = normalizedTracks;
}

export function resolveTraitDamageAssignableSteps(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    options: { allowSkull?: boolean } = {},
): number {
    normalizeExplorerTraitTracks(explorer);
    const track = explorer.traitTracks[trait];
    const floorPosition = options.allowSkull ? track.skullPosition : track.criticalPosition;
    return Math.max(0, track.position - floorPosition);
}

export function damageTraitsAreAssignable(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    options: { allowSkull?: boolean } = {},
): boolean {
    const counts = new Map<BetrayalTraitKey, number>();
    for (const trait of traits) {
        counts.set(trait, (counts.get(trait) ?? 0) + 1);
    }
    return [...counts.entries()].every(([trait, count]) => (
        count <= resolveTraitDamageAssignableSteps(explorer, trait, options)
    ));
}

export function applyTraitLoss(
    explorer: BetrayalExplorerSummary,
    traits: BetrayalTraitKey[],
    amount: number,
    options: { allowSkull?: boolean } = {},
): number {
    let remaining = Math.max(0, amount);
    let applied = 0;
    for (let index = 0; index < traits.length && remaining > 0; index += 1) {
        const trait = traits[index]!;
        const reducible = resolveTraitDamageAssignableSteps(explorer, trait, options);
        if (reducible <= 0) {
            continue;
        }
        const delta = Math.min(reducible, remaining);
        moveExplorerTraitSteps(explorer, trait, -delta, options);
        remaining -= delta;
        applied += delta;
    }
    return applied;
}

export function applyGeneralDamage(
    explorer: BetrayalExplorerSummary,
    amount: number,
    selectedTraits: BetrayalTraitKey[],
    options: { allowSkull?: boolean } = {},
): number {
    let remaining = Math.max(0, amount);
    let applied = 0;
    for (const trait of selectedTraits) {
        if (remaining <= 0) {
            break;
        }
        const traitLoss = applyTraitLoss(explorer, [trait], 1, options);
        remaining -= traitLoss;
        applied += traitLoss;
    }
    return applied;
}

function syncExplorerTraitValue(explorer: BetrayalExplorerSummary, trait: BetrayalTraitKey): void {
    explorer.traits[trait] = traitValueAtPosition(explorer.traitTracks[trait]);
}

export function moveExplorerTraitSteps(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    steps: number,
    options: { allowSkull?: boolean } = {},
): void {
    normalizeExplorerTraitTracks(explorer);
    const track = explorer.traitTracks[trait];
    const minPosition = options.allowSkull ? track.skullPosition : track.criticalPosition;
    track.position = Math.max(minPosition, Math.min(track.maxPosition, track.position + steps));
    syncExplorerTraitValue(explorer, trait);
}

export function healExplorerTraitToStart(explorer: BetrayalExplorerSummary, trait: BetrayalTraitKey): void {
    normalizeExplorerTraitTracks(explorer);
    const track = explorer.traitTracks[trait];
    if (track.position < track.startPosition) {
        track.position = track.startPosition;
        syncExplorerTraitValue(explorer, trait);
    }
}

export function setExplorerTraitPosition(
    explorer: BetrayalExplorerSummary,
    trait: BetrayalTraitKey,
    position: number,
): void {
    normalizeExplorerTraitTracks(explorer);
    const track = explorer.traitTracks[trait];
    track.position = Math.max(track.skullPosition, Math.min(track.maxPosition, position));
    syncExplorerTraitValue(explorer, trait);
}

export function setExplorerTraitsFromValues(
    explorer: BetrayalExplorerSummary,
    traits: Record<BetrayalTraitKey, number>,
): void {
    explorer.traits = { ...traits };
    normalizeExplorerTraitTracks(explorer);
}
