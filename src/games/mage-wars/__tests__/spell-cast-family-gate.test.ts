import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { MAGE_WARS_COMMANDS } from '../domain';
import { MAGE_IDS } from '../domain/ids';
import type { MageWarsCore } from '../domain/types';
import {
    makeArenaObject,
    PLAYER_ZERO_START_ZONE,
    setupState,
    validateCommand,
    withArenaObject,
    withPreparedPlayerMage,
} from './helpers/domainFlowHarness';

describe('mage-wars spell cast family gate', () => {
    it('accepts the configured 1905 hidden response enchantment through the normal cast entry', () => {
        const responseSpellId = 1905;
        const baseState = setupState('creatureAction');
        const target = makeArenaObject('redirect-response-target', '0', PLAYER_ZERO_START_ZONE);
        const state: MatchState<MageWarsCore> = {
            ...baseState,
            core: withArenaObject(
                withPreparedPlayerMage(
                    baseState.core,
                    '0',
                    MAGE_IDS.WIZARD_APPRENTICE,
                    [responseSpellId],
                    20,
                ),
                target,
            ),
        };

        expect(validateCommand(state, {
            type: MAGE_WARS_COMMANDS.CAST_SPELL,
            playerId: '0',
            payload: {
                spellCardId: responseSpellId,
                manaCost: 7,
                targetObjectId: target.id,
            },
        })).toBeUndefined();
    });
});
