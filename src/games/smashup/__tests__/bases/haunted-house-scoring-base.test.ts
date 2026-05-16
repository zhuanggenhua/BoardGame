import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    makeCard,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_haunted_house: 冠军弃手牌抽5', () => {
    it('冠军弃掉所有手牌并抽5张', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0', `card_${i}`)
        );
        const handCards = [makeCard('h1', '0'), makeCard('h2', '0'), makeCard('h3', '0')];

        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house',
                    minions: [makeMinion('m1', '0', 5), makeMinion('m2', '1', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: handCards,
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 5, vp: 5 },
                { playerId: '1', power: 3, vp: 3 },
            ],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(2); // 弃牌 + 抽牌

        // 第一个事件：弃掉所有手牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids).toEqual(['h1', 'h2', 'h3']);

        // 第二个事件：抽5张
        expect(events[1].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[1] as any).payload.playerId).toBe('0');
        expect((events[1] as any).payload.count).toBe(5);
        expect((events[1] as any).payload.cardUids.length).toBe(5);
    });

    it('无排名信息时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState(),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            // rankings 未设置
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });

    it('冠军手牌为空时只抽牌不弃牌', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0')
        );

        const ctx: BaseAbilityContext = {
            state: makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 5 }],
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(1); // 只有抽牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });
});
