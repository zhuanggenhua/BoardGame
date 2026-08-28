import { describe, expect, it } from 'vitest';
import { getMageWarsSpellCardFromConfig, getMageWarsSpellCardsFromConfig } from '../data/configPackage';
import { getMageWarsSpellSchools } from '../domain/spellbookBuilder';

describe('Mage Wars spellbook builder filters', () => {
    it('keeps school filters to real school or element axes instead of creature/equipment subtypes', () => {
        const fireball = getMageWarsSpellCardFromConfig(1700);
        const timberWolf = getMageWarsSpellCardFromConfig(2819);
        const swampBat = getMageWarsSpellCardFromConfig(2825);
        const leatherGloves = getMageWarsSpellCardFromConfig(3702);

        expect(fireball).toBeTruthy();
        expect(timberWolf).toBeTruthy();
        expect(swampBat).toBeTruthy();
        expect(leatherGloves).toBeTruthy();

        expect(getMageWarsSpellSchools(fireball!)).toContain('火焰');
        expect(getMageWarsSpellSchools(timberWolf!)).toContain('自然');
        expect(getMageWarsSpellSchools(swampBat!)).toContain('黑暗');
        expect(getMageWarsSpellSchools(swampBat!)).not.toEqual(expect.arrayContaining(['动物', '蝙蝠']));
        expect(getMageWarsSpellSchools(leatherGloves!)).not.toContain('手套');
    });

    it('does not leak raw type-line subtypes into the builder school option set', () => {
        const allSchools = getMageWarsSpellCardsFromConfig().flatMap((spell) => getMageWarsSpellSchools(spell));

        expect(allSchools).toEqual(expect.arrayContaining(['自然', '火焰', '圣光', '黑暗']));
        expect(allSchools).not.toEqual(expect.arrayContaining(['蝙蝠', '手套', '靴子', '传送门', '胸甲']));
    });
});
