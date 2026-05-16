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

describe('base_ritual_site: 随从洗回牌库', () => {
    it('所有随从产生 CARD_TO_DECK_BOTTOM 事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 4),
                        makeMinion('m3', '0', 2),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(3);
        expect(events.every(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        const uids = events.map(event => (event as any).payload.cardUid);
        expect(uids).toContain('m1');
        expect(uids).toContain('m2');
        expect(uids).toContain('m3');

        const m2Event = events.find(event => (event as any).payload.cardUid === 'm2');
        expect((m2Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});
