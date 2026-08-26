import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import {
    getFormalStartingMageIdFromConfig,
    getPresetMageOrderFromConfig,
    getPresetMageSetupFromConfig,
    getPresetSpellbookCountFromConfig,
} from '../data/configPackage';
import { MageWarsDomain } from '../domain';
import { MAGE_IDS } from '../domain/ids';
import {
    buildMageWarsMageSetupData,
    buildMageWarsSetupOptions,
    getMageWarsSelectableMageIds,
    MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD,
    MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD,
    resolveMageWarsSelectedMageIdForSeat,
} from '../roomSetup';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

describe('mage-wars room setup', () => {
    it('exposes the four standard starting mages as setup options', () => {
        const setupOptions = buildMageWarsSetupOptions();
        const expectedMageIds = getPresetMageOrderFromConfig();

        expect(getMageWarsSelectableMageIds()).toEqual(expectedMageIds);
        expect(setupOptions[MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD]).toMatchObject({
            type: 'select',
            labelKey: 'setup.seat0Mage.label',
            default: getFormalStartingMageIdFromConfig(0),
        });
        expect(setupOptions[MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD]).toMatchObject({
            type: 'select',
            labelKey: 'setup.seat1Mage.label',
            default: getFormalStartingMageIdFromConfig(1),
        });
        expect(setupOptions[MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD].options?.map((option) => option.value))
            .toEqual(expectedMageIds);
    });

    it('uses setupData selected mages to initialize player stats and spellbooks', () => {
        const setupData = buildMageWarsMageSetupData([
            MAGE_IDS.WARLOCK_APPRENTICE,
            MAGE_IDS.WIZARD_APPRENTICE,
        ]);

        const core = MageWarsDomain.setup(['0', '1'], fixedRandom, setupData);

        expect(core.players['0'].mageId).toBe(MAGE_IDS.WARLOCK_APPRENTICE);
        expect(core.players['1'].mageId).toBe(MAGE_IDS.WIZARD_APPRENTICE);
        for (const playerId of core.playerOrder) {
            const player = core.players[playerId];
            const setup = getPresetMageSetupFromConfig(player.mageId);
            expect(player.life).toBe(setup.startingLife);
            expect(player.mana).toBe(setup.startingMana);
            expect(player.channeling).toBe(setup.channeling);
            expect(player.baseMeleeDice).toBe(setup.baseMeleeDice);
            expect(player.spellbookCount).toBe(getPresetSpellbookCountFromConfig(player.mageId));
        }
    });

    it('falls back to configured default mages for invalid external setupData', () => {
        const setupData = {
            setupSelections: {
                [MAGE_WARS_SEAT_0_MAGE_SETUP_FIELD]: 'not-a-mage',
                [MAGE_WARS_SEAT_1_MAGE_SETUP_FIELD]: MAGE_IDS.WIZARD_APPRENTICE,
            },
        };

        expect(resolveMageWarsSelectedMageIdForSeat(setupData, 0)).toBe(getFormalStartingMageIdFromConfig(0));
        expect(resolveMageWarsSelectedMageIdForSeat(setupData, 1)).toBe(MAGE_IDS.WIZARD_APPRENTICE);

        const core = MageWarsDomain.setup(['0', '1'], fixedRandom, setupData);
        expect(core.players['0'].mageId).toBe(getFormalStartingMageIdFromConfig(0));
        expect(core.players['1'].mageId).toBe(MAGE_IDS.WIZARD_APPRENTICE);
    });
});
