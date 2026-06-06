import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getDiscardActionPlayOptions } from '../../domain/discardActionPlayability';
import { makeBase, makeCard, makeMinion, makePlayer, makeState } from '../helpers';

describe('电子猿弃牌堆行动入口', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('赛博守护者会把弃牌堆中的附着随从持续行动暴露为可打出入口', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_monkey_lab', [
                makeMinion('own-cyberback', 'cyborg_apes_cyberback', '0', 5),
                makeMinion('own-other', 'sharks_mako', '0', 2),
                makeMinion('enemy-cyberback', 'cyborg_apes_cyberback', '1', 5),
            ])],
        });

        const options = getDiscardActionPlayOptions(core, '0');

        expect(options).toHaveLength(1);
        expect(options[0]?.card.uid).toBe('evo-a');
        expect(options[0]?.sourceId).toBe('cyborg_apes_cyberback');
        expect(options[0]?.allowedBaseIndices).toEqual([0]);
        expect(options[0]?.allowedMinionUids).toEqual(['own-cyberback']);
    });

    it('没有己方赛博守护者时，不暴露弃牌堆行动入口', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_monkey_lab', [
                makeMinion('own-other', 'sharks_mako', '0', 2),
                makeMinion('enemy-cyberback', 'cyborg_apes_cyberback', '1', 5),
            ])],
        });

        expect(getDiscardActionPlayOptions(core, '0')).toEqual([]);
    });
});
