import { describe, expect, it } from 'vitest';
import { canMageWarsSkipCreatureAction, countMageWarsActiveCreatures } from '../domain/creatureAction';
import { STATUS_TOKEN_IDS } from '../domain/ids';
import { makeArenaObject, PLAYER_ZERO_START_ZONE, setupState, withArenaObject } from './helpers/domainFlowHarness';

describe('mage-wars active creature counts', () => {
    it('counts mages and creatures with ready markers, including stunned creatures', () => {
        const base = setupState('creatureAction');
        const stunned = makeArenaObject('stunned-active', '0', PLAYER_ZERO_START_ZONE, {
            statusTokens: { [STATUS_TOKEN_IDS.STUN]: 1 },
        });
        const sleeping = makeArenaObject('newly-summoned', '0', PLAYER_ZERO_START_ZONE, { actionReady: false });
        const banished = makeArenaObject('banished', '0', PLAYER_ZERO_START_ZONE, {
            banished: { remainingTokens: 1, returnToZoneId: PLAYER_ZERO_START_ZONE },
        });
        const core = [stunned, sleeping, banished].reduce(withArenaObject, base.core);
        expect(countMageWarsActiveCreatures(core, '0')).toBe(2);
        expect(countMageWarsActiveCreatures(core, '1')).toBe(1);
        expect(canMageWarsSkipCreatureAction(core, '0')).toBe(false);
        expect(canMageWarsSkipCreatureAction(core, '1')).toBe(true);
        expect(canMageWarsSkipCreatureAction(base.core, '0')).toBe(false);
    });
});
