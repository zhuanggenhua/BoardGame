import { describe, expect, it } from 'vitest';
import type { MageWarsArenaObjectState } from '../domain';
import { ARENA_ZONE_IDS } from '../domain/ids';
import {
    canMageWarsObjectCastBoundSpell,
    isMageWarsArenaObjectActionable,
    isMageWarsCastPhase,
} from '../ui/actionReadModel';

function arenaObject(
    overrides: Partial<MageWarsArenaObjectState> & Pick<MageWarsArenaObjectState, 'id' | 'kind'>,
): MageWarsArenaObjectState {
    return {
        ownerId: '0',
        sourceSpellCardId: 3725,
        sourceObjectId: 'spell-3725',
        name: '法师魔杖',
        zoneId: ARENA_ZONE_IDS.A3,
        life: 0,
        damage: 0,
        armor: 0,
        actionReady: false,
        guarding: false,
        statusTokens: {},
        ...overrides,
    };
}

describe('isMageWarsArenaObjectActionable', () => {
    const boundStaff = arenaObject({
        id: 'mage-staff-bound-0',
        kind: 'equipment',
        boundSpellCardId: 3500,
    });

    it('keeps a moved creature selectable while its quick action is available', () => {
        const moved = arenaObject({
            id: 'moved-creature',
            kind: 'creature',
            temporaryTraits: { movedThisAction: true, quickActionAfterMoveAvailable: true },
        });
        const options = { canAct: true, activePlayerId: '0', phase: 'creatureAction' };
        expect(isMageWarsArenaObjectActionable(moved, options)).toBe(true);
        expect(isMageWarsArenaObjectActionable({ ...moved, temporaryTraits: {} }, options)).toBe(false);
        expect(isMageWarsArenaObjectActionable(moved, { ...options, activePlayerId: '1' })).toBe(false);
    });

    it('treats owned bound-spell attachments as actionable in cast phases', () => {
        expect(isMageWarsCastPhase('initiativeQuickcast')).toBe(true);
        expect(canMageWarsObjectCastBoundSpell(boundStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
        })).toBe(true);
        expect(isMageWarsArenaObjectActionable(boundStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
        })).toBe(true);
    });

    it('does not treat bound-spell attachments as actionable while targeting or on the opponent turn', () => {
        expect(isMageWarsArenaObjectActionable(boundStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
            targetingBusy: true,
        })).toBe(false);
        expect(isMageWarsArenaObjectActionable(boundStaff, {
            canAct: false,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
        })).toBe(false);
        expect(isMageWarsArenaObjectActionable(boundStaff, {
            canAct: true,
            activePlayerId: '1',
            phase: 'initiativeQuickcast',
        })).toBe(false);
        expect(isMageWarsArenaObjectActionable(boundStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'planning',
        })).toBe(false);
    });

    it('treats object-ability sources as actionable even without a bound spell', () => {
        const elementalStaff = arenaObject({
            id: 'elemental-staff-0',
            kind: 'equipment',
        });
        expect(isMageWarsArenaObjectActionable(elementalStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
            objectActionSourceIds: new Set(['elemental-staff-0']),
        })).toBe(true);
        expect(isMageWarsArenaObjectActionable(elementalStaff, {
            canAct: true,
            activePlayerId: '0',
            phase: 'initiativeQuickcast',
            objectActionSourceIds: new Set(['elemental-staff-0']),
            targetingBusy: true,
        })).toBe(false);
    });
});
