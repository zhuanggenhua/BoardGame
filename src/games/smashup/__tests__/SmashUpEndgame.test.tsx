import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SmashUpEndgameContent } from '../ui/SmashUpEndgame';
import { MADNESS_CARD_DEF_ID } from '../domain/types';
import { makeBase, makeCard, makePlayer, makeState } from './helpers';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: { count?: number; penalty?: number; defaultValue?: string }) => {
            if (key === 'endgame.madnessPenalty') {
                return `疯狂卡 ×${options?.count}（-${options?.penalty}）`;
            }
            return options?.defaultValue ?? key;
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

describe('SmashUpEndgameContent', () => {
    it('疯狂牌明细应与终局计分同源，包含埋葬在基地旁的疯狂牌', () => {
        const core = makeState({
            madnessDeck: [],
            players: {
                '0': makePlayer('0', {
                    vp: 15,
                    hand: [makeCard('mad-hand', MADNESS_CARD_DEF_ID, 'action', '0')],
                    deck: [makeCard('mad-deck', MADNESS_CARD_DEF_ID, 'action', '0')],
                    discard: [makeCard('mad-discard', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1', { vp: 12 }),
            },
            bases: [
                makeBase({
                    defId: 'base_the_jungle',
                    minions: [],
                    ongoingActions: [],
                    buriedCards: [{
                        uid: 'buried-mad',
                        defId: MADNESS_CARD_DEF_ID,
                        trueOwnerId: '0',
                        controllerId: '0',
                        buriedFrom: 'hand',
                    }],
                }),
            ],
        });

        render(
            <SmashUpEndgameContent
                core={core}
                myPlayerId="0"
                playerNames={{ '0': 'Host', '1': 'Guest' }}
                result={{ winner: '0', scores: { '0': 13, '1': 12 } } as any}
            />,
        );

        expect(screen.getByText('疯狂卡 ×4（-2）')).toBeInTheDocument();
        expect(screen.queryByText('疯狂卡 ×3（-2）')).not.toBeInTheDocument();
    });
});
