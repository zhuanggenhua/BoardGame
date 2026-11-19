import {
    getPresetSpellbookEntriesFromConfig,
    type MageWarsConfigSpellbookEntry,
} from '../data/configPackage';
import type { MageId } from './ids';
import type { MageWarsCore } from './core-types';

export type MageWarsPlayerSpellbookEntry = Pick<MageWarsConfigSpellbookEntry, 'spellCardId' | 'count'>;

type MageWarsSpellbookOwner = {
    mageId: MageId;
    spellbookEntries?: readonly MageWarsPlayerSpellbookEntry[];
};

export function getMageWarsPlayerSpellbookEntries(
    player: MageWarsSpellbookOwner,
): readonly MageWarsPlayerSpellbookEntry[] {
    return player.spellbookEntries ?? getPresetSpellbookEntriesFromConfig(player.mageId);
}

export function getMageWarsPlayerSpellbookCardIds(
    player: MageWarsSpellbookOwner,
): number[] {
    return getMageWarsPlayerSpellbookEntries(player).flatMap((entry) => (
        Array.from({ length: entry.count }, () => entry.spellCardId)
    ));
}

export function hasMageWarsPlayerSpellbookCard(
    player: MageWarsSpellbookOwner,
    spellCardId: number,
): boolean {
    return getMageWarsPlayerSpellbookEntries(player)
        .some((entry) => entry.spellCardId === spellCardId && entry.count > 0);
}

export function getMageWarsPlayerSpellbookCopyCount(
    player: MageWarsSpellbookOwner,
    spellCardId: number,
): number {
    return getMageWarsPlayerSpellbookEntries(player)
        .find((entry) => entry.spellCardId === spellCardId)
        ?.count ?? 0;
}

export function getMageWarsAvailableSpellbookCopyCount(
    core: MageWarsCore,
    playerId: string,
    spellCardId: number,
    options: { replaceMagePlan?: boolean } = {},
): number {
    const player = core.players[playerId];
    if (!player) return 0;
    let available = getMageWarsPlayerSpellbookCopyCount(player, spellCardId);
    for (const id of player.discardSpellCardIds) if (id === spellCardId) available--;
    if (!options.replaceMagePlan) {
        for (const id of player.preparedSpellCardIds) if (id === spellCardId) available--;
    }
    for (const object of Object.values(core.objects)) {
        const cardOwnerId = object.cardOwnerId ?? object.ownerId;
        if (cardOwnerId === playerId && object.sourceSpellCardId === spellCardId) available--;
        if (cardOwnerId === playerId && object.boundSpellCardId === spellCardId) available--;
        if (object.ownerId === playerId && object.preparedSpellCardId === spellCardId) available--;
    }
    for (const wall of Object.values(core.walls)) {
        if (wall.ownerId === playerId && wall.sourceSpellCardId === spellCardId) available--;
    }
    return Math.max(0, available);
}

export function getMageWarsAvailableSpellbookCardIds(
    core: MageWarsCore,
    playerId: string,
    options?: { replaceMagePlan?: boolean },
): number[] {
    const player = core.players[playerId];
    if (!player) return [];
    return getMageWarsPlayerSpellbookEntries(player).flatMap(({ spellCardId }) => (
        Array.from({ length: getMageWarsAvailableSpellbookCopyCount(core, playerId, spellCardId, options) }, () => spellCardId)
    ));
}

export function getMageWarsSpellbookCardCount(entries: readonly MageWarsPlayerSpellbookEntry[]): number {
    return entries.reduce((total, entry) => total + entry.count, 0);
}

export function cloneMageWarsSpellbookEntries(
    entries: readonly MageWarsPlayerSpellbookEntry[],
): MageWarsPlayerSpellbookEntry[] {
    return entries.map((entry) => ({
        spellCardId: entry.spellCardId,
        count: entry.count,
    }));
}

export function getMageWarsPresetSpellbookEntriesForMage(
    mageId: MageId,
): MageWarsPlayerSpellbookEntry[] {
    return cloneMageWarsSpellbookEntries(getPresetSpellbookEntriesFromConfig(mageId));
}
