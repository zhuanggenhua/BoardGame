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
            />,
        );

        vi.advanceTimersByTime(1999);
        expect(initialConfirm).not.toHaveBeenCalled();
        expect(latestConfirm).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(initialConfirm).not.toHaveBeenCalled();
        expect(latestConfirm).toHaveBeenCalledTimes(1);
    });

    it('无选项时应保留手动确认按钮，避免自动确认未触发时卡住', () => {
        const onConfirm = vi.fn();
        const compareRollWithoutOptions = {
            ...compareRoll,
            options: [],
        };
        render(
            <CompareRollOverlay
                compareRoll={compareRollWithoutOptions}
                isVisible={true}
                canResolve={true}
                onResolveOption={vi.fn()}
                onConfirm={onConfirm}
            />,
        );

        const button = screen.getByRole('button', { name: 'compareRoll.confirm' });
        expect(button).toBeTruthy();
        button.click();
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('非拥有者应看到等待文案而不是可点击按钮', () => {
        render(
            <CompareRollOverlay
                compareRoll={compareRoll}
                isVisible={true}
                canResolve={false}
                onResolveOption={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        expect(screen.getByTestId('compare-roll-overlay')).toBeTruthy();
        expect(screen.getByTestId('compare-roll-overlay')).toHaveAttribute('data-placement', 'main-result-layer');
        expect(screen.getByTestId('compare-roll-waiting').textContent).toBe('compareRoll.waitingForOwnerChoice');
        expect(screen.queryByRole('button', { name: 'choices.gunslingerDuel.deal3' })).toBeNull();
    });

    it('非拥有者看到无选项结果时也应等待主人确认，而不是显示确认中', () => {
        render(
            <CompareRollOverlay
                compareRoll={{ ...compareRoll, options: [] }}
                isVisible={true}
                canResolve={false}
                onResolveOption={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        expect(screen.getByTestId('compare-roll-waiting').textContent).toBe('compareRoll.waitingForOwnerChoice');
        expect(screen.queryByRole('button', { name: 'compareRoll.confirm' })).toBeNull();
    });

    it('结果选择层应离开右侧骰盘，且不渲染中间骰子特写', () => {
        render(
            <CompareRollOverlay
                compareRoll={compareRoll}
                isVisible={true}
                canResolve={true}
                onResolveOption={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        expect(screen.getByTestId('compare-roll-overlay')).toBeTruthy();
        expect(screen.getByTestId('compare-roll-overlay')).toHaveAttribute('data-placement', 'main-result-layer');
        expect(screen.queryByTestId('compare-roll-participant-0')).toBeNull();
        expect(screen.queryByTestId('compare-roll-participant-1')).toBeNull();
        expect(screen.queryByTestId('spotlight-container')).toBeNull();
        expect(screen.queryByTestId('roll-spotlight-dice-content')).toBeNull();
        expect(screen.queryByTestId('dice-2d')).toBeNull();
    });
});
