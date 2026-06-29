import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiceTray } from '../DiceTray';
import type { Die } from '../../types';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

vi.mock('../Dice3D', () => ({
    Dice3D: () => <div data-testid="mock-dice-3d" />,
    DiceField3D: () => <div data-testid="mock-dice-field-3d" />,
}));

const dice: Die[] = [
    {
        id: 0,
        value: 1,
        isKept: false,
        definitionId: 'monk-dice',
    },
];

describe('DiceTray tutorial anchor', () => {
    it('右侧传统骰盘应保留 dice-tray 教程标记', () => {
        render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
            />,
        );

        expect(screen.getByTestId('mock-dice-3d').closest('[data-tutorial-id="dice-tray"]')).not.toBeNull();
    });

    it('棋盘内 3D 骰台不应复用 dice-tray 教程标记', () => {
        const { container } = render(
            <DiceTray
                dice={dice}
                rollCount={1}
                onToggleLock={vi.fn()}
                currentPhase="offensiveRoll"
                canInteract={true}
                isRolling={false}
                presentation="board"
            />,
        );

        expect(screen.getByTestId('mock-dice-field-3d')).toBeInTheDocument();
        expect(container.querySelector('[data-tutorial-id="dice-tray"]')).toBeNull();
    });
});
