import { describe, expect, it } from 'vitest';

import {
    cloneSpecialTroopStacksAsPieces,
    collapseCompatPiecesToSpecialTroopStacks,
    expandSpecialTroopStacksToCompatPieces,
} from '../domain/troopCompat';
import {
    buildMercenaryTroopStack,
    buildRegularTroopStack,
    buildSecondaryTroopStack,
} from '../domain/troopStacks';

describe('七大恨部队身份', () => {
    it('正规、次级与附兵由建立入口写入明确身份', () => {
        expect(buildRegularTroopStack('ming', 'regular', 1)).toMatchObject({
            faction: 'ming',
            originalFaction: 'ming',
            troopClass: 'regular',
        });
        expect(buildSecondaryTroopStack('jin', 'secondary', 1)).toMatchObject({
            faction: 'jin',
            originalFaction: 'jin',
            troopClass: 'secondary',
        });
        expect(buildMercenaryTroopStack('mongol', 'auxiliary', 1)).toMatchObject({
            faction: 'mongol',
            originalFaction: 'mongol',
            troopClass: 'auxiliary',
        });
    });

    it('临时转侧后展开、归并与克隆仍保留原始阵营和次级身份', () => {
        const [secondaryStack] = cloneSpecialTroopStacksAsPieces([{
            ...buildSecondaryTroopStack('jin', 'defected', 1),
            faction: 'ming',
        }]);
        expect(secondaryStack).toMatchObject({
            faction: 'ming',
            originalFaction: 'jin',
            troopClass: 'secondary',
        });

        const pieces = expandSpecialTroopStacksToCompatPieces([secondaryStack]);
        expect(pieces).toEqual([
            expect.objectContaining({
                faction: 'ming',
                originalFaction: 'jin',
                troopClass: 'secondary',
            }),
        ]);

        expect(collapseCompatPiecesToSpecialTroopStacks(pieces)).toEqual([
            expect.objectContaining({
                faction: 'ming',
                originalFaction: 'jin',
                troopClass: 'secondary',
            }),
        ]);
    });
});
