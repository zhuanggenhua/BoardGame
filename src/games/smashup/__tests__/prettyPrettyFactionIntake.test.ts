import { describe, expect, it } from 'vitest';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { isFactionImplementationInProgress } from '../ui/factionMeta';

describe('SmashUp Pretty Pretty intake 静态合同', () => {
    it('猫咪与小马已不再标记为实施中', () => {
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.KITTY_CATS)).toBe(false);
        expect(isFactionImplementationInProgress(SMASHUP_FACTION_IDS.MYTHIC_HORSES)).toBe(false);
    });
});
