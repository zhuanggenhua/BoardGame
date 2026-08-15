import { describe, expect, it } from 'vitest';
import { resolveAllowedPlayerCountsForGame } from '../../../shared/roomSetup';
import { buildGamePublicRoomSummary } from '../../roomSetupRegistry';
import manifest from '../manifest';
import {
    FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE,
    FANTASY_REALMS_DUEL_SETUP_VALUE,
    buildFantasyRealmsPublicRoomSummary,
    getFantasyRealmsAllowedPlayerCounts,
    readFantasyRealmsRuntimeSetupConfig,
} from '../roomSetup';

describe('fantasyrealms room setup', () => {
    it('标准局人数应限制在 3 到 6 人', () => {
        expect(getFantasyRealmsAllowedPlayerCounts()).toEqual([3, 4, 5, 6]);
        expect(resolveAllowedPlayerCountsForGame({
            gameManifest: manifest,
            setupData: undefined,
        })).toEqual([3, 4, 5, 6]);
    });

    it('双人变体 setup 会把允许人数收敛到 2 人', () => {
        const setupData = {
            setupSelections: {
                variant: FANTASY_REALMS_DUEL_SETUP_VALUE,
            },
        };

        expect(getFantasyRealmsAllowedPlayerCounts(setupData)).toEqual([2]);
        expect(resolveAllowedPlayerCountsForGame({
            gameManifest: manifest,
            setupData,
        })).toEqual([2]);
    });

    it('legacy 双人无 setup 数据时，运行时仍回落到 duel 变体', () => {
        expect(readFantasyRealmsRuntimeSetupConfig(undefined, {
            playerCount: 2,
            allowLegacyTwoPlayerFallback: true,
        })).toMatchObject({
            variant: 'duel',
            expansion: 'base',
            cursedHoardSuitsEnabled: false,
        });
    });

    it('公开房间摘要只暴露新花色扩展，不暴露其他内部 setup 细节', () => {
        const setupData = {
            setupSelections: {
                variant: FANTASY_REALMS_DUEL_SETUP_VALUE,
                expansion: FANTASY_REALMS_CURSED_HOARD_SUITS_SETUP_VALUE,
            },
        };

        expect(buildFantasyRealmsPublicRoomSummary(setupData)).toEqual({
            enabledExpansions: ['cursed-hoard-suits'],
        });
        expect(buildGamePublicRoomSummary('fantasyrealms', setupData)).toEqual({
            enabledExpansions: ['cursed-hoard-suits'],
        });
    });
});
