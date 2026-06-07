import { describe, expect, it } from 'vitest';
import { TOKEN_IDS } from '../domain/ids';
import { GUNSLINGER_ABILITIES, QUICK_DRAW_UPGRADED } from '../heroes/gunslinger/abilities';

describe('gunslinger loaded reroll contract', () => {
    it('models quick draw II as a global Loaded reroll hook', () => {
        expect(QUICK_DRAW_UPGRADED.tokenBonusDieReroll).toEqual({
            tokenId: TOKEN_IDS.LOADED,
            maxRerollCount: 1,
            scope: 'allTokenUses',
        });
    });

    it('models fill-em-with-lead as a source ability Loaded reroll hook', () => {
        const ultimate = GUNSLINGER_ABILITIES.find(ability => ability.id === 'fill-em-with-lead');

        expect(ultimate?.tokenBonusDieReroll).toEqual({
            tokenId: TOKEN_IDS.LOADED,
            maxRerollCount: 1,
        });
    });
});
