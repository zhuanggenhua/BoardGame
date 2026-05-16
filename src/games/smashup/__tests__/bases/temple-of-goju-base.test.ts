import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    SU_EVENTS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_temple_of_goju: 最高力量随从放牌库底', () => {
    it('每位玩家最高力量随从放入牌库底', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '0', 3),
                        makeMinion('m3', '1', 4),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 8, vp: 2 },
                { playerId: '1', power: 4, vp: 3 },
            ],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(2);

        const p0Event = events.find(event => (event as any).payload.cardUid === 'm1');
        expect(p0Event).toBeDefined();
        expect(p0Event!.type).toBe(SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect((p0Event as any).payload.ownerId).toBe('0');

        const p1Event = events.find(event => (event as any).payload.cardUid === 'm3');
        expect(p1Event).toBeDefined();
        expect((p1Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});
