import {
    getPresetSpellbookEntriesFromConfig,
    type MageWarsConfigSpellbookEntry,
} from '../data/configPackage';
import type { MageId } from './ids';

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
