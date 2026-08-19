import { describe, expect, it } from 'vitest';
import type { MageWarsArenaObjectState } from '../domain/core-types';
import {
    applyMovementTemporaryTraits,
    applyObjectAbilityTemporaryGrants,
    applyTemporaryTraitGain,
    clearPostMoveAttackTraits,
    clearTemporaryTraits,
    hasExpiredRoundScopedTemporaryTraits,
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
