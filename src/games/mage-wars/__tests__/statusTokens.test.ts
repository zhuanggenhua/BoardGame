import { describe, expect, it } from 'vitest';
import {
    addStatusTokenAmount,
    applyStatusTokenPlacement,
    applyStatusTokenRemoval,
    getStatusTokenAmount,
    hasStatusToken,
    removeStatusTokenAmount,
    type MageWarsStatusTokenCarrier,
} from '../domain/statusTokens';
import { STATUS_TOKEN_IDS } from '../domain/ids';

function carrier(patch: Partial<MageWarsStatusTokenCarrier> = {}): MageWarsStatusTokenCarrier {
    return {
        guarding: true,
        statusTokens: {},
        ...patch,
    };
}

describe('Mage Wars status tokens lifecycle', () => {
    it('reads missing status tokens as zero and present tokens as active', () => {
        const target = carrier({
            statusTokens: {
                [STATUS_TOKEN_IDS.WEAK]: 2,
            },
        });

        expect(getStatusTokenAmount(target, STATUS_TOKEN_IDS.WEAK)).toBe(2);
        expect(getStatusTokenAmount(target, STATUS_TOKEN_IDS.DAZE)).toBe(0);
        expect(hasStatusToken(target, STATUS_TOKEN_IDS.WEAK)).toBe(true);
        expect(hasStatusToken(target, STATUS_TOKEN_IDS.DAZE)).toBe(false);
    });

    it('adds token amounts without replacing unrelated tokens', () => {
        expect(addStatusTokenAmount({
            [STATUS_TOKEN_IDS.BURN]: 1,
        }, STATUS_TOKEN_IDS.BURN, 2)).toEqual({
            [STATUS_TOKEN_IDS.BURN]: 3,
        });

        expect(addStatusTokenAmount({
            [STATUS_TOKEN_IDS.BURN]: 1,
        }, STATUS_TOKEN_IDS.ROT, 1)).toEqual({
            [STATUS_TOKEN_IDS.BURN]: 1,
            [STATUS_TOKEN_IDS.ROT]: 1,
        });
    });

    it('removes token amounts and deletes the entry at zero', () => {
        expect(removeStatusTokenAmount({
            [STATUS_TOKEN_IDS.BURN]: 3,
        }, STATUS_TOKEN_IDS.BURN, 1)).toEqual({
            [STATUS_TOKEN_IDS.BURN]: 2,
        });

        expect(removeStatusTokenAmount({
            [STATUS_TOKEN_IDS.BURN]: 1,
            [STATUS_TOKEN_IDS.ROT]: 1,
        }, STATUS_TOKEN_IDS.BURN, 5)).toEqual({
            [STATUS_TOKEN_IDS.ROT]: 1,
        });
    });

    it('stun placement clears guarding while other tokens preserve guarding', () => {
        expect(applyStatusTokenPlacement(
            carrier(),
            STATUS_TOKEN_IDS.STUN,
            1,
        )).toEqual({
            guarding: false,
            statusTokens: {
                [STATUS_TOKEN_IDS.STUN]: 1,
            },
        });

        expect(applyStatusTokenPlacement(
            carrier(),
            STATUS_TOKEN_IDS.BURN,
            1,
        )).toEqual({
            guarding: true,
            statusTokens: {
                [STATUS_TOKEN_IDS.BURN]: 1,
            },
        });
    });

    it('token removal does not restore guarding implicitly', () => {
        expect(applyStatusTokenRemoval(
            carrier({
                guarding: false,
                statusTokens: {
                    [STATUS_TOKEN_IDS.STUN]: 1,
                },
            }),
            STATUS_TOKEN_IDS.STUN,
            1,
        )).toEqual({
            guarding: false,
            statusTokens: {},
        });
    });
});
