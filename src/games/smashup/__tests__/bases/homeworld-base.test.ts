import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMatchState,
    SU_EVENTS,
    type LimitModifiedEvent,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_the_homeworld 母星', () => {
    it('随从入场后授予额外随从出牌次数', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_homeworld', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_homeworld', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_homeworld',
            playerId: '0',
            minionUid: 'm1',
            now: 0,
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        const evt = result.events[0] as LimitModifiedEvent;
        expect(evt.payload.limitType).toBe('minion');
        expect(evt.payload.delta).toBe(1);
    });
});
