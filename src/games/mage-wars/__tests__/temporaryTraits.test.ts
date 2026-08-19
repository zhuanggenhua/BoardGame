import { describe, expect, it } from 'vitest';
import type { MageWarsArenaObjectState } from '../domain/core-types';
import {
    applyMovementTemporaryTraits,
    applyObjectAbilityTemporaryGrants,
    applyTemporaryTraitGain,
    clearPostMoveAttackTraits,
    clearTemporaryTraits,
    getTemporaryChargeDiceModifier,
    getTemporaryMeleeDiceModifier,
    getTemporaryNextMeleePierceModifier,
    getTemporaryTraitIdsForTurnCleanup,
    hasExpiredRoundScopedTemporaryTraits,
    hasTemporaryMovedThisAction,
    hasTemporaryQuickActionAfterMove,
    hasTemporarySwift,
    hasTemporarySwiftFreeMoveUsed,
    hasTemporaryTeleportMovement,
    hasTemporaryVampiricNextMelee,
} from '../domain/temporaryTraits';

function arenaObject(patch: Partial<MageWarsArenaObjectState> = {}): MageWarsArenaObjectState {
    return {
        id: 'creature-1',
        kind: 'creature',
        ownerId: '0',
        sourceSpellCardId: 2822,
        sourceObjectId: 'creature-1',
        name: 'Blue Gremlin',
        zoneId: 'zone-a',
        life: 5,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        ...patch,
    };
}

describe('Mage Wars temporary traits lifecycle', () => {
    it('reads absent temporary traits as inactive and zero-valued', () => {
        const object = arenaObject();

        expect(hasTemporarySwift(object)).toBe(false);
        expect(hasTemporaryTeleportMovement(object)).toBe(false);
        expect(hasTemporarySwiftFreeMoveUsed(object)).toBe(false);
        expect(hasTemporaryMovedThisAction(object)).toBe(false);
        expect(hasTemporaryQuickActionAfterMove(object)).toBe(false);
        expect(hasTemporaryVampiricNextMelee(object)).toBe(false);
        expect(getTemporaryChargeDiceModifier(object)).toBe(0);
        expect(getTemporaryMeleeDiceModifier(object)).toBe(0);
        expect(getTemporaryNextMeleePierceModifier(object)).toBe(0);
    });

    it('reads boolean and numeric temporary traits through the formal accessors', () => {
        const object = arenaObject({
            temporaryTraits: {
                swift: true,
                teleportMovement: true,
                freeMoveUsedThisAction: true,
                movedThisAction: true,
                quickActionAfterMoveAvailable: true,
                chargeDiceModifier: 2,
                meleeDiceModifier: 3,
                vampiricNextMelee: true,
                nextMeleePierceModifier: 1,
            },
        });

        expect(hasTemporarySwift(object)).toBe(true);
        expect(hasTemporaryTeleportMovement(object)).toBe(true);
        expect(hasTemporarySwiftFreeMoveUsed(object)).toBe(true);
        expect(hasTemporaryMovedThisAction(object)).toBe(true);
        expect(hasTemporaryQuickActionAfterMove(object)).toBe(true);
        expect(hasTemporaryVampiricNextMelee(object)).toBe(true);
        expect(getTemporaryChargeDiceModifier(object)).toBe(2);
        expect(getTemporaryMeleeDiceModifier(object)).toBe(3);
        expect(getTemporaryNextMeleePierceModifier(object)).toBe(1);
    });

    it('lists the temporary trait families that should clear at turn cleanup', () => {
        expect(getTemporaryTraitIdsForTurnCleanup(arenaObject(), 3)).toEqual([]);

        expect(getTemporaryTraitIdsForTurnCleanup(arenaObject({
            temporaryTraits: {
                swift: true,
                teleportMovement: true,
                freeMoveUsedThisAction: true,
                movedThisAction: true,
                quickActionAfterMoveAvailable: true,
                chargeDiceModifier: 2,
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: 2,
                vampiricNextMelee: true,
                nextMeleePierceModifier: 1,
            },
        }), 3)).toEqual([
            'swift',
            'teleportMovement',
            'swiftFreeMove',
            'movedThisAction',
            'quickActionAfterMove',
            'charge',
            'meleeDice',
            'vampiric',
            'pierce',
        ]);

        expect(getTemporaryTraitIdsForTurnCleanup(arenaObject({
            temporaryTraits: {
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: 3,
            },
        }), 3)).toEqual([]);
    });

    it('keeps the strongest numeric temporary trait while adding boolean grants', () => {
        const first = applyTemporaryTraitGain(arenaObject({
            temporaryTraits: {
                chargeDiceModifier: 1,
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: 2,
            },
        }), {
            grants: ['swift'],
            chargeDiceModifier: 2,
            meleeDiceModifier: 1,
            meleeDiceModifierUntilRoundNumber: 1,
            vampiricNextMelee: true,
            nextMeleePierceModifier: 1,
        });

        expect(first.temporaryTraits).toEqual({
            swift: true,
            chargeDiceModifier: 2,
            meleeDiceModifier: 1,
            meleeDiceModifierUntilRoundNumber: 2,
            vampiricNextMelee: true,
            nextMeleePierceModifier: 1,
        });
    });

    it('object ability grants reset the free-move marker without clearing other traits', () => {
        const object = applyObjectAbilityTemporaryGrants(arenaObject({
            temporaryTraits: {
                freeMoveUsedThisAction: true,
                chargeDiceModifier: 1,
            },
        }), ['swift', 'teleportMovement']);

        expect(object.temporaryTraits).toEqual({
            swift: true,
            teleportMovement: true,
            freeMoveUsedThisAction: false,
            chargeDiceModifier: 1,
        });
    });

    it('movement traits distinguish normal movement from teleport and free movement', () => {
        expect(applyMovementTemporaryTraits(arenaObject(), {
            actionCost: 'normal',
            isTeleportMove: false,
        }).temporaryTraits).toEqual({
            movedThisAction: true,
            quickActionAfterMoveAvailable: true,
        });

        expect(applyMovementTemporaryTraits(arenaObject(), {
            actionCost: 'none',
            isTeleportMove: true,
        }).temporaryTraits).toEqual({
            freeMoveUsedThisAction: true,
        });
    });

    it('clears named trait families and removes the container when empty', () => {
        const object = arenaObject({
            temporaryTraits: {
                swift: true,
                movedThisAction: true,
                quickActionAfterMoveAvailable: true,
                meleeDiceModifier: 2,
                meleeDiceModifierUntilRoundNumber: 3,
            },
        });

        expect(clearTemporaryTraits(object, ['meleeDice']).temporaryTraits).toEqual({
            swift: true,
            movedThisAction: true,
            quickActionAfterMoveAvailable: true,
        });

        expect(clearTemporaryTraits(arenaObject({
            temporaryTraits: { swift: true },
        }), ['swift']).temporaryTraits).toBeUndefined();
    });

    it('clears only post-move attack traits after an attack action is spent', () => {
        const object = clearPostMoveAttackTraits(arenaObject({
            temporaryTraits: {
                swift: true,
                movedThisAction: true,
                quickActionAfterMoveAvailable: true,
            },
        }));

        expect(object.temporaryTraits).toEqual({
            swift: true,
        });
    });

    it('detects round-scoped melee modifiers that expired before the current round', () => {
        expect(hasExpiredRoundScopedTemporaryTraits(arenaObject({
            temporaryTraits: {
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: 2,
            },
        }), 3)).toBe(true);

        expect(hasExpiredRoundScopedTemporaryTraits(arenaObject({
            temporaryTraits: {
                meleeDiceModifier: 1,
                meleeDiceModifierUntilRoundNumber: 3,
            },
        }), 3)).toBe(false);
    });
});
