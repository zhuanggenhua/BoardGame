import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiceDisplaySettingsSection } from '../DiceDisplaySettingsSection';

const toggleBoardDice3d = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../useDiceThroneDisplayPreference', () => ({
    useDiceThroneDisplayPreference: () => ({
        boardDice3dEnabled: false,
        toggleBoardDice3d,
    }),
}));

describe('DiceDisplaySettingsSection', () => {
    it('应使用滑块开关切换棋盘 3D 骰子', () => {
        render(<DiceDisplaySettingsSection t={(key: string) => key} />);

        const toggle = screen.getByRole('switch', { name: 'hud.diceDisplay.board3d' });
        expect(toggle).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'hud.diceDisplay.board3d' })).toBeNull();

        fireEvent.click(toggle);
        expect(toggleBoardDice3d).toHaveBeenCalledTimes(1);
    });
});
