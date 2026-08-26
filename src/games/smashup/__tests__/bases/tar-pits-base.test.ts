import { makeMinionDestroyedEvent } from '../helpers';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    reduce,
    makeState,
    makeMinion,
    SU_EVENTS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_tar_pits: 被消灭随从放入牌库底', () => {
    it('随从在 Tar Pits 被消灭时，MINION_DESTROYED 归约会把它放到拥有者牌库底（仍算被消灭）', () => {
        const state = makeState({
            bases: [{
                defId: 'base_tar_pits',
                minions: [makeMinion('m1', '0', 3, 'test_minion')],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            } as any,
        });

        const evt = makeMinionDestroyedEvent({minionUid: 'm1', minionDefId: 'test_minion', fromBaseIndex: 0, ownerId: '0', reason: 'test', timestamp: 1000 });

        const next = reduce(state, evt);
        expect(next.players['0'].discard.length).toBe(0);
        expect(next.players['0'].deck.map((c: any) => c.uid)).toEqual(['m1']);
        expect(next.bases[0].minions.length).toBe(0);
        expect((next.turnDestroyedMinions ?? []).some((r: any) => r.uid === 'm1')).toBe(true);
    });

});

// ============================================================================
// base_haunted_house: 伊万斯堡城镇公墓 - 冠军弃手牌抽5
// ============================================================================
