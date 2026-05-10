import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SmashUpCore } from '../domain/types';
import { FactionSelection } from '../ui/FactionSelection';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: Record<string, unknown>) => {
            const defaultValue = typeof options?.defaultValue === 'string'
                ? options.defaultValue
                : key;
            return defaultValue
                .replace(/\{\{player\}\}/g, String(options?.player ?? ''))
                .replace(/\{\{id\}\}/g, String(options?.id ?? ''))
                .replace(/\{\{count\}\}/g, String(options?.count ?? ''));
        },
        i18n: { language: 'zh-CN' },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({ className }: { className?: string }) => (
        <div className={className} data-testid="mock-card-preview" />
    ),
}));

function buildCore(): SmashUpCore {
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
                factions: ['aliens', 'dinosaurs'],
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
                factions: ['robots_pod', 'pirates'],
            },
        },
        seatOrder: ['0', '1'],
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        teamMode: undefined,
        bases: [],
        titans: [],
        enabledExpansions: [],
        baseDeck: [],
        baseDiscard: [],
        triggerQueue: undefined,
        turnNumber: 1,
        nextUid: 1,
        gameResult: undefined,
        factionSelection: {
            takenFactions: ['robots_pod'],
            playerSelections: {
                '0': [],
                '1': ['robots_pod'],
            },
            completedPlayers: [],
        },
        cardsPlayedThisTurn: 0,
        powerCountersPlacedOnMinionsThisTurn: 0,
    };
}

function renderSelection(dispatch = vi.fn()) {
    render(
        <MemoryRouter>
            <FactionSelection
                core={buildCore()}
                dispatch={dispatch}
                playerID="0"
                playerNames={{ '0': '我', '1': 'AI' }}
                playerOrder={['0', '1']}
                getPlayerOrderLabel={(playerId) => `P${Number(playerId) + 1}`}
            />
        </MemoryRouter>,
    );
    return dispatch;
}

describe('FactionSelection POD/旧版派系统一占用', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('别人选择 robots_pod 后，robots 组应直接显示为已占用', () => {
        renderSelection();

        expect(screen.getByText('AI 已占领')).toBeInTheDocument();
    });

    it('别人选择 robots_pod 后，打开 robots 详情不应再出现确认选择按钮', () => {
        renderSelection();

        fireEvent.click(screen.getByTestId('faction-option-robots'));

        expect(screen.queryByTestId('faction-confirm-button')).not.toBeInTheDocument();
        expect(screen.getByText('ui.taken_by_other')).toBeInTheDocument();
    });
});
