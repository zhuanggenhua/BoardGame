import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompareRollOverlay } from '../CompareRollOverlay';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            exists: (key?: string) => Boolean(key),
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../SpotlightContainer', () => ({
    default: ({ children, isVisible }: { children: React.ReactNode; isVisible: boolean }) => (
        isVisible ? <div data-testid="spotlight-container">{children}</div> : null
    ),
}));

vi.mock('../RollSpotlightDiceContent', () => ({
    default: ({ value }: { value: number }) => <div data-testid="roll-spotlight-dice-content">{value}</div>,
}));

describe('CompareRollOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const compareRoll = {
        id: 'compare-roll-1',
        playerId: '1',
        title: 'compareRoll.gunslingerDuel.title',
        contestants: [
            {
                playerId: '1',
                labelKey: 'compareRoll.gunslingerDuel.defender',
                roll: 6,
                characterId: 'gunslinger',
            },
            {
                playerId: '0',
                labelKey: 'compareRoll.gunslingerDuel.attacker',
                roll: 1,
                characterId: 'monk',
            },
        ] as const,
        resultTextKey: 'compareRoll.gunslingerDuel.win',
        options: [
            {
                id: 'option-0',
                label: 'choices.gunslingerDuel.deal3',
                labelKey: 'choices.gunslingerDuel.deal3',
                value: { value: 3, customId: 'gunslinger-duel-deal-3' },
            },
        ],
    };

    it('无选项时应在 3 秒后自动确认，且重渲染不会重置计时器', () => {
        const initialConfirm = vi.fn();
        const latestConfirm = vi.fn();
        const compareRollWithoutOptions = {
            ...compareRoll,
            options: [],
        };
        const { rerender } = render(
            <CompareRollOverlay
                compareRoll={compareRollWithoutOptions}
                isVisible={true}
                canResolve={true}
                onResolveOption={vi.fn()}
                onConfirm={initialConfirm}
                usePortal={false}
            />,
        );

        vi.advanceTimersByTime(1000);

        rerender(
            <CompareRollOverlay
                compareRoll={{ ...compareRollWithoutOptions }}
                isVisible={true}
                canResolve={true}
                onResolveOption={vi.fn()}
                onConfirm={latestConfirm}
                usePortal={false}
            />,
        );

        vi.advanceTimersByTime(1999);
        expect(initialConfirm).not.toHaveBeenCalled();
        expect(latestConfirm).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(initialConfirm).not.toHaveBeenCalled();
        expect(latestConfirm).toHaveBeenCalledTimes(1);
    });

    it('非拥有者应看到等待文案而不是可点击按钮', () => {
        render(
            <CompareRollOverlay
                compareRoll={compareRoll}
                isVisible={true}
                canResolve={false}
                onResolveOption={vi.fn()}
                onConfirm={vi.fn()}
                usePortal={false}
            />,
        );

        expect(screen.getByTestId('compare-roll-overlay')).toBeTruthy();
        expect(screen.getByTestId('compare-roll-waiting').textContent).toBe('compareRoll.waitingForOwnerChoice');
        expect(screen.queryByRole('button', { name: 'choices.gunslingerDuel.deal3' })).toBeNull();
    });
});
