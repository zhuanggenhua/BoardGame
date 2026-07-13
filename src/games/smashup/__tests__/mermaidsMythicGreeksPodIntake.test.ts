import { describe, expect, it, beforeAll } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { getCardDef, getFactionCards } from '../data/cards';
import { clearRegistry, hasAbility } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, hasRegisteredTrigger } from '../domain/ongoingEffects';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../domain/ids';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Mermaids and Mythic Greeks POD intake', () => {
    it('Mermaids POD cards use the local 4x5 atlas and have the expected deck count', () => {
        const defs = getFactionCards(SMASHUP_FACTION_IDS.MERMAIDS_POD);
        expect(defs).toHaveLength(12);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(20);

        expect(getCardDef('mermaids_charmed_pod')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: SMASHUP_ATLAS_IDS.MERMAIDS_POD_CARDS,
            index: 0,
        });
        expect(getCardDef('mermaids_mermaid_queen_pod')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: SMASHUP_ATLAS_IDS.MERMAIDS_POD_CARDS,
            index: 19,
        });
    });

    it('Mythic Greeks POD cards use the local 4x5 atlas and have the expected deck count', () => {
        const defs = getFactionCards(SMASHUP_FACTION_IDS.MYTHIC_GREEKS_POD);
        expect(defs).toHaveLength(15);
        expect(defs.reduce((sum, def) => sum + def.count, 0)).toBe(20);

        expect(getCardDef('mythic_greeks_favor_of_hades_pod')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: SMASHUP_ATLAS_IDS.MYTHIC_GREEKS_POD_CARDS,
            index: 0,
        });
        expect(getCardDef('mythic_greeks_odysseus_pod')?.previewRef).toEqual({
            type: 'atlas',
            atlasId: SMASHUP_ATLAS_IDS.MYTHIC_GREEKS_POD_CARDS,
            index: 19,
        });
    });

    it('POD ability and trigger registrations are present for the behavior-critical cards', () => {
        expect(hasAbility('mermaids_charmed_pod', 'onPlay')).toBe(true);
        expect(hasAbility('mermaids_becalmed_shores_pod', 'talent')).toBe(true);
        expect(hasAbility('mythic_greeks_argonaut_pod', 'onPlay')).toBe(true);
        expect(hasAbility('mythic_greeks_favor_of_zeus_pod', 'onPlay')).toBe(true);
        expect(hasRegisteredTrigger('mermaids_desert_island_pod', 'onTurnStart')).toBe(true);
        expect(hasRegisteredTrigger('mythic_greeks_odysseus_pod', 'onActionPlayed')).toBe(true);
        expect(hasRegisteredTrigger('mythic_greeks_jason_pod', 'onActionPlayed')).toBe(true);
    });
});
