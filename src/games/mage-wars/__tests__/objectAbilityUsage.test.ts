import { describe, expect, it } from 'vitest';
import type { MageWarsArenaObjectState } from '../domain/core-types';
import {
    hasObjectAbilityUseInRound,
    recordObjectAbilityUseInRound,
} from '../domain/objectAbilityUsage';
import { MAGE_WARS_OBJECT_ABILITY_IDS } from '../domain/ids';

function arenaObject(patch: Partial<MageWarsArenaObjectState> = {}): MageWarsArenaObjectState {
    return {
        id: 'staff-1',
        kind: 'equipment',
        ownerId: '0',
        sourceSpellCardId: 3710,
        sourceObjectId: 'staff-1',
        name: 'Beast Staff',
        zoneId: 'zone-a',
        life: 0,
        damage: 0,
        armor: 0,
        actionReady: true,
        guarding: false,
        statusTokens: {},
        ...patch,
    };
}

describe('Mage Wars object ability usage', () => {
    it('records object ability use by ability id and round number', () => {
        const object = recordObjectAbilityUseInRound(
            arenaObject(),
            MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            2,
        );

        expect(object.abilityUseRoundNumbers).toEqual({
            [MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF]: 2,
        });
        expect(hasObjectAbilityUseInRound(
            object,
            MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            2,
        )).toBe(true);
        expect(hasObjectAbilityUseInRound(
            object,
            MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            3,
        )).toBe(false);
    });

    it('does not create a usage marker when the event has no round number', () => {
        const object = arenaObject();

        expect(recordObjectAbilityUseInRound(
            object,
            MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF,
            undefined,
        )).toBe(object);
    });
});
