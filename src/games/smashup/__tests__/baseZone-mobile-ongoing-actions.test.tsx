import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BaseZone } from '../ui/BaseZone';
import { SU_COMMANDS } from '../domain/types';

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => true,
}));

vi.mock('../../../components/common/media/CardPreview', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../components/common/media/CardPreview')>();
    return {
        ...actual,
        CardPreview: ({ previewRef }: { previewRef?: unknown }) => (
            React.createElement('div', {
                'data-testid': 'mock-card-preview',
                'data-preview-ref': JSON.stringify(previewRef ?? null),
            })
        ),
    };
});

afterEach(() => {
    vi.clearAllMocks();
});

function buildCore() {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['tricksters', 'werewolves'],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['pirates', 'dinosaurs'],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            {
                defId: 'base_the_jungle',
                minions: [],
                ongoingActions: [],
            },
        ],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
    };
}

function renderBaseZone(options?: {
    ongoingActions?: Array<{ uid: string; defId: string; ownerId: string; talentUsed?: boolean }>;
    minions?: Array<Record<string, unknown>>;
    usableOngoingTalentUids?: Set<string>;
}) {
    const dispatch = vi.fn();
    const core = buildCore();
    core.bases[0] = {
        ...core.bases[0],
        minions: (options?.minions ?? []) as any,
        ongoingActions: (options?.ongoingActions ?? []) as any,
    };

    render(
        React.createElement(BaseZone, {
            base: core.bases[0] as any,
            baseIndex: 0,
            core: core as any,
            turnOrder: core.turnOrder,
            isDeployMode: false,
            isMyTurn: true,
            myPlayerId: '0',
            dispatch,
            onClick: vi.fn(),
            onViewMinion: vi.fn(),
            onViewAction: vi.fn(),
            onViewBase: vi.fn(),
            onViewTitan: vi.fn(),
            usableOngoingTalentUids: options?.usableOngoingTalentUids,
        }),
    );

    return { dispatch };
}

describe('BaseZone 移动端 ongoing 交互', () => {
    it('基地上的天赋战术在移动端单击一次就应发动', () => {
        const { dispatch } = renderBaseZone({
            ongoingActions: [
                { uid: 'oa1', defId: 'miskatonic_lost_knowledge', ownerId: '0', talentUsed: false },
            ],
            usableOngoingTalentUids: new Set(['oa1']),
        });

        const ongoingCard = document.querySelector('[data-ongoing-uid="oa1"]');
        expect(ongoingCard).not.toBeNull();
        fireEvent.click(ongoingCard as Element);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(SU_COMMANDS.USE_TALENT, {
            ongoingCardUid: 'oa1',
            baseIndex: 0,
        });
    });

    it('附着在随从上的天赋战术在移动端展开后单击一次就应发动', () => {
        const { dispatch } = renderBaseZone({
            minions: [
                {
                    uid: 'm1',
                    defId: 'pirate_first_mate',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [
                        { uid: 'aa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: false },
                    ],
                },
            ],
            usableOngoingTalentUids: new Set(['aa1']),
        });

        const minionCard = document.querySelector('[data-minion-uid="m1"]');
        expect(minionCard).not.toBeNull();
        fireEvent.click(minionCard as Element);
        const attachedAction = document.querySelector('[data-attached-action-uid="aa1"]');
        expect(attachedAction).not.toBeNull();

        fireEvent.click(attachedAction as Element);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(SU_COMMANDS.USE_TALENT, {
            ongoingCardUid: 'aa1',
            baseIndex: 0,
        });
    });
});
