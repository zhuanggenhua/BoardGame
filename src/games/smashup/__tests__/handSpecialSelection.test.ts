import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../abilities';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import {
    getHandSpecialPlayableBaseIndices,
    shouldOfferHandSpecialActionChoice,
    shouldPreferHandSpecialSelection,
} from '../ui/handSpecialSelection';

describe('SmashUp 手牌 special 选择策略', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('极客粉丝在随从额度已用完但 special 仍合法时，应优先走 hand-special 选择', () => {
        const matchState = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));
        const card = matchState.core.players['0'].hand[0];

        expect(Array.from(getHandSpecialPlayableBaseIndices(matchState, '0', card.uid))).toEqual([0]);
        expect(shouldPreferHandSpecialSelection({
            matchState,
            playerId: '0',
            card,
            normalPlayableBaseIndices: new Set(),
        })).toBe(true);
    });

    it('极客粉丝在仍可正常打出时，应先让玩家选择普通打出或使用 special', () => {
        const matchState = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '0')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a')],
        }));
        const card = matchState.core.players['0'].hand[0];

        expect(shouldPreferHandSpecialSelection({
            matchState,
            playerId: '0',
            card,
            normalPlayableBaseIndices: new Set([0]),
        })).toBe(false);
        expect(shouldOfferHandSpecialActionChoice({
            matchState,
            playerId: '0',
            card,
            normalPlayableBaseIndices: new Set([0]),
        })).toBe(true);
    });
});
