import { describe, expect, it } from 'vitest';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import {
    getFactionVariantGroupById,
    getPreferredFactionVariant,
    getVisibleFactionVariantGroups,
} from '../ui/factionMeta';

describe('SmashUp faction variant groups', () => {
    it('merges base and POD into one visible group in zh-CN', () => {
        const groups = getVisibleFactionVariantGroups('zh-CN');
        const piratesGroup = groups.find((group) => group.groupId === SMASHUP_FACTION_IDS.PIRATES);

        expect(piratesGroup).toBeTruthy();
        expect(piratesGroup?.variants.map((variant) => variant.id)).toEqual([
            SMASHUP_FACTION_IDS.PIRATES,
            SMASHUP_FACTION_IDS.PIRATES_POD,
        ]);
        expect(piratesGroup?.defaultVariant.id).toBe(SMASHUP_FACTION_IDS.PIRATES);
    });

    it('prefers POD as the only visible default variant in en', () => {
        const groups = getVisibleFactionVariantGroups('en');
        const piratesGroup = groups.find((group) => group.groupId === SMASHUP_FACTION_IDS.PIRATES);

        expect(piratesGroup).toBeTruthy();
        expect(piratesGroup?.variants.map((variant) => variant.id)).toEqual([
            SMASHUP_FACTION_IDS.PIRATES_POD,
        ]);
        expect(piratesGroup?.defaultVariant.id).toBe(SMASHUP_FACTION_IDS.PIRATES_POD);
    });

    it('normalizes a POD faction id back to its shared group', () => {
        const group = getFactionVariantGroupById(SMASHUP_FACTION_IDS.WIZARDS_POD);

        expect(group?.groupId).toBe(SMASHUP_FACTION_IDS.WIZARDS);
        expect(group?.variants.map((variant) => variant.id)).toEqual([
            SMASHUP_FACTION_IDS.WIZARDS,
            SMASHUP_FACTION_IDS.WIZARDS_POD,
        ]);
    });

    it('returns locale-aware preferred variants', () => {
        expect(getPreferredFactionVariant(SMASHUP_FACTION_IDS.ZOMBIES, 'zh-CN')?.id).toBe(SMASHUP_FACTION_IDS.ZOMBIES);
        expect(getPreferredFactionVariant(SMASHUP_FACTION_IDS.ZOMBIES, 'en')?.id).toBe(SMASHUP_FACTION_IDS.ZOMBIES_POD);
    });
});
