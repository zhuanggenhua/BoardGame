import type { MageWarsArenaObjectState } from './core-types';

export type MageWarsTemporaryTraitGrantId = 'swift' | 'teleportMovement';

export type MageWarsTemporaryTraitId =
    | MageWarsTemporaryTraitGrantId
    | 'swiftFreeMove'
    | 'movedThisAction'
    | 'quickActionAfterMove'
    | 'charge'
    | 'meleeDice'
    | 'vampiric'
    | 'pierce';

export interface MageWarsTemporaryTraitGain {
    grants?: readonly MageWarsTemporaryTraitGrantId[];
    chargeDiceModifier?: number;
    meleeDiceModifier?: number;
    meleeDiceModifierUntilRoundNumber?: number;
    vampiricNextMelee?: boolean;
    nextMeleePierceModifier?: number;
}

export interface MageWarsTemporaryTraitReader {
    temporaryTraits?: MageWarsArenaObjectState['temporaryTraits'];
}

export function hasTemporarySwift(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.swift === true;
}

export function hasTemporaryTeleportMovement(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.teleportMovement === true;
}

export function hasTemporarySwiftFreeMoveUsed(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.freeMoveUsedThisAction === true;
}

export function hasTemporaryMovedThisAction(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.movedThisAction === true;
}

export function hasTemporaryQuickActionAfterMove(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.quickActionAfterMoveAvailable === true;
}

export function getTemporaryChargeDiceModifier(reader: MageWarsTemporaryTraitReader): number {
    return reader.temporaryTraits?.chargeDiceModifier ?? 0;
}

export function getTemporaryMeleeDiceModifier(reader: MageWarsTemporaryTraitReader): number {
    return reader.temporaryTraits?.meleeDiceModifier ?? 0;
}

export function getTemporaryNextMeleePierceModifier(reader: MageWarsTemporaryTraitReader): number {
    return reader.temporaryTraits?.nextMeleePierceModifier ?? 0;
}

export function hasTemporaryVampiricNextMelee(reader: MageWarsTemporaryTraitReader): boolean {
    return reader.temporaryTraits?.vampiricNextMelee === true;
}

export function getTemporaryTraitIdsForTurnCleanup(
    reader: MageWarsTemporaryTraitReader,
    turnNumber: number,
): MageWarsTemporaryTraitId[] {
    const traitIds: MageWarsTemporaryTraitId[] = [];
    if (hasTemporarySwift(reader)) traitIds.push('swift');
    if (hasTemporaryTeleportMovement(reader)) traitIds.push('teleportMovement');
    if (hasTemporarySwiftFreeMoveUsed(reader)) traitIds.push('swiftFreeMove');
    if (hasTemporaryMovedThisAction(reader)) traitIds.push('movedThisAction');
    if (hasTemporaryQuickActionAfterMove(reader)) traitIds.push('quickActionAfterMove');
    if (getTemporaryChargeDiceModifier(reader) > 0) traitIds.push('charge');
    if (
        getTemporaryMeleeDiceModifier(reader) > 0
        && reader.temporaryTraits?.meleeDiceModifierUntilRoundNumber !== turnNumber
    ) {
        traitIds.push('meleeDice');
    }
    if (hasTemporaryVampiricNextMelee(reader)) traitIds.push('vampiric');
    if (getTemporaryNextMeleePierceModifier(reader) > 0) traitIds.push('pierce');
    return traitIds;
}

function hasTemporaryTraits(temporaryTraits: NonNullable<MageWarsArenaObjectState['temporaryTraits']>): boolean {
    return Object.keys(temporaryTraits).length > 0;
}

function withTemporaryTraits(
    object: MageWarsArenaObjectState,
    temporaryTraits: MageWarsArenaObjectState['temporaryTraits'],
): MageWarsArenaObjectState {
    return {
        ...object,
        temporaryTraits: temporaryTraits && hasTemporaryTraits(temporaryTraits)
            ? temporaryTraits
            : undefined,
    };
}

export function applyTemporaryTraitGain(
    object: MageWarsArenaObjectState,
    gain: MageWarsTemporaryTraitGain,
): MageWarsArenaObjectState {
    const temporaryTraits = { ...object.temporaryTraits };
    if (gain.grants?.includes('swift')) {
        temporaryTraits.swift = true;
    }
    if (gain.grants?.includes('teleportMovement')) {
        temporaryTraits.teleportMovement = true;
    }
    if ((gain.chargeDiceModifier ?? 0) > 0) {
        temporaryTraits.chargeDiceModifier = Math.max(
            object.temporaryTraits?.chargeDiceModifier ?? 0,
            gain.chargeDiceModifier ?? 0,
        );
    }
    if ((gain.meleeDiceModifier ?? 0) > 0) {
        temporaryTraits.meleeDiceModifier = Math.max(
            object.temporaryTraits?.meleeDiceModifier ?? 0,
            gain.meleeDiceModifier ?? 0,
        );
        if (gain.meleeDiceModifierUntilRoundNumber !== undefined) {
            temporaryTraits.meleeDiceModifierUntilRoundNumber = Math.max(
                object.temporaryTraits?.meleeDiceModifierUntilRoundNumber ?? 0,
                gain.meleeDiceModifierUntilRoundNumber,
            );
        }
    }
    if (gain.vampiricNextMelee === true) {
        temporaryTraits.vampiricNextMelee = true;
    }
    if ((gain.nextMeleePierceModifier ?? 0) > 0) {
        temporaryTraits.nextMeleePierceModifier = Math.max(
            object.temporaryTraits?.nextMeleePierceModifier ?? 0,
            gain.nextMeleePierceModifier ?? 0,
        );
    }

    return withTemporaryTraits(object, temporaryTraits);
}

export function applyObjectAbilityTemporaryGrants(
    object: MageWarsArenaObjectState,
    grants: readonly MageWarsTemporaryTraitGrantId[] | undefined,
): MageWarsArenaObjectState {
    if (!grants?.length) return object;
    const granted = applyTemporaryTraitGain(object, { grants });
    return withTemporaryTraits(granted, {
        ...granted.temporaryTraits,
        freeMoveUsedThisAction: false,
    });
}

export function applyMovementTemporaryTraits(
    object: MageWarsArenaObjectState,
    options: {
        actionCost?: 'normal' | 'none';
        isTeleportMove: boolean;
    },
): MageWarsArenaObjectState {
    return withTemporaryTraits(object, {
        ...object.temporaryTraits,
        ...(options.actionCost === 'none' ? { freeMoveUsedThisAction: true } : {}),
        ...(!options.isTeleportMove ? { movedThisAction: true } : {}),
        ...(options.actionCost !== 'none' && !options.isTeleportMove
            ? { quickActionAfterMoveAvailable: true }
            : {}),
    });
}

export function clearTemporaryTraits(
    object: MageWarsArenaObjectState,
    traitIds?: readonly MageWarsTemporaryTraitId[],
): MageWarsArenaObjectState {
    if (!object.temporaryTraits) return object;
    if (!traitIds?.length) {
        const { temporaryTraits: _temporaryTraits, ...nextObject } = object;
        return nextObject;
    }

    const nextTraits = { ...object.temporaryTraits };
    for (const traitId of traitIds) {
        switch (traitId) {
            case 'swift':
                delete nextTraits.swift;
                break;
            case 'teleportMovement':
                delete nextTraits.teleportMovement;
                break;
            case 'swiftFreeMove':
                delete nextTraits.freeMoveUsedThisAction;
                break;
            case 'movedThisAction':
                delete nextTraits.movedThisAction;
                break;
            case 'quickActionAfterMove':
                delete nextTraits.quickActionAfterMoveAvailable;
                break;
            case 'charge':
                delete nextTraits.chargeDiceModifier;
                break;
            case 'meleeDice':
                delete nextTraits.meleeDiceModifier;
                delete nextTraits.meleeDiceModifierUntilRoundNumber;
                break;
            case 'vampiric':
                delete nextTraits.vampiricNextMelee;
                break;
            case 'pierce':
                delete nextTraits.nextMeleePierceModifier;
                break;
        }
    }

    return withTemporaryTraits(object, nextTraits);
}

export function clearPostMoveAttackTraits(object: MageWarsArenaObjectState): MageWarsArenaObjectState {
    if (!object.temporaryTraits?.movedThisAction && !object.temporaryTraits?.quickActionAfterMoveAvailable) {
        return object;
    }

    const {
        movedThisAction: _movedThisAction,
        quickActionAfterMoveAvailable: _quickActionAfterMoveAvailable,
        ...remainingTraits
    } = object.temporaryTraits;
    return withTemporaryTraits(object, remainingTraits);
}

export function hasExpiredRoundScopedTemporaryTraits(
    object: MageWarsArenaObjectState,
    roundNumber: number,
): boolean {
    return object.temporaryTraits?.meleeDiceModifierUntilRoundNumber !== undefined
        && object.temporaryTraits.meleeDiceModifierUntilRoundNumber < roundNumber;
}
