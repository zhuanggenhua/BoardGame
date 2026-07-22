import type { PlayerId } from '../../../engine/types';
import type { TheGangCore, TheGangHandSlot } from './types';
import { getExitChipCount } from './setup';

export type { TheGangHandSlot } from './types';

export const THE_GANG_HAND_SLOTS: readonly TheGangHandSlot[] = ['top', 'bottom'];

export const getChipOwnerKey = (
    playerId: PlayerId,
    handSlot: TheGangHandSlot,
    twoHand: boolean,
): string => (twoHand ? `${playerId}:${handSlot}` : playerId);

export const parseChipOwnerKey = (ownerKey: string): { playerId: PlayerId; handSlot?: TheGangHandSlot } => {
    const [playerId, handSlot] = ownerKey.split(':');
    return {
        playerId,
        handSlot: handSlot === 'top' || handSlot === 'bottom' ? handSlot : undefined,
    };
};

export const resolveChipOwnerKey = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot = 'top',
): string => getChipOwnerKey(playerId, handSlot, core.rules.config.twoHand);

export const getPlayerChipOwnerKeys = (core: TheGangCore, playerId: PlayerId): string[] => (
    core.rules.config.twoHand
        ? THE_GANG_HAND_SLOTS.map((handSlot) => getChipOwnerKey(playerId, handSlot, true))
        : [playerId]
);

export const getRequiredChipOwnerKeys = (core: TheGangCore): string[] => (
    core.playerIds.flatMap((playerId) => getPlayerChipOwnerKeys(core, playerId))
);

export const allRequiredChipOwnersHaveChips = (core: TheGangCore): boolean => (
    getRequiredChipOwnerKeys(core).every((ownerKey) => core.currentRoundChips[ownerKey] !== undefined)
);

export const getRequiredExitChipCount = (core: TheGangCore): number => (
    core.round === 4 ? getExitChipCount(core.playerIds.length, core.rules.config) : 0
);

export const getCurrentRoundExitChipOwners = (core: TheGangCore): string[] => (
    core.currentRoundExitChipOwners ?? []
);

export const allRequiredExitChipsAreTaken = (core: TheGangCore): boolean => (
    getCurrentRoundExitChipOwners(core).length >= getRequiredExitChipCount(core)
);

export const allRequiredFinalTokensAreTaken = (core: TheGangCore): boolean => (
    allRequiredChipOwnersHaveChips(core) && allRequiredExitChipsAreTaken(core)
);

export const getMissingHandSlotsForPlayer = (
    core: TheGangCore,
    playerId: PlayerId,
): TheGangHandSlot[] => (
    core.rules.config.twoHand
        ? THE_GANG_HAND_SLOTS.filter((handSlot) => (
            core.currentRoundChips[getChipOwnerKey(playerId, handSlot, true)] === undefined
        ))
        : (core.currentRoundChips[playerId] === undefined ? ['top'] : [])
);

export const getChipForHandSlot = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot = 'top',
): number | undefined => core.currentRoundChips[resolveChipOwnerKey(core, playerId, handSlot)];

export const hasExitChipForHandSlot = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot = 'top',
): boolean => getCurrentRoundExitChipOwners(core).includes(resolveChipOwnerKey(core, playerId, handSlot));

const countChipValues = (chips: readonly number[]): Map<number, number> => {
    const counts = new Map<number, number>();
    for (const chip of chips) {
        counts.set(chip, (counts.get(chip) ?? 0) + 1);
    }
    return counts;
};

export const getUnoccupiedChipValues = (
    availableChips: readonly number[],
    currentRoundChips: Record<string, number>,
): number[] => {
    const heldCounts = countChipValues(Object.values(currentRoundChips));
    const seenCounts = new Map<number, number>();

    return availableChips.filter((chip) => {
        const nextSeenCount = (seenCounts.get(chip) ?? 0) + 1;
        seenCounts.set(chip, nextSeenCount);
        return (heldCounts.get(chip) ?? 0) < nextSeenCount;
    });
};

export const removeConflictingChipOwners = (
    currentRoundChips: Record<string, number>,
    ownerKey: string,
    chip: number,
    availableChips: readonly number[],
): Record<string, number> => {
    const chipCapacity = Math.max(1, availableChips.filter((value) => value === chip).length);
    const entries = Object.entries(currentRoundChips);
    const conflictingOwners = entries
        .filter(([key, value]) => key !== ownerKey && value === chip)
        .map(([key]) => key);
    const removeCount = Math.max(0, conflictingOwners.length + 1 - chipCapacity);
    const ownersToRemove = new Set<string>([ownerKey, ...conflictingOwners.slice(0, removeCount)]);

    return Object.fromEntries(entries.filter(([key]) => !ownersToRemove.has(key)));
};
