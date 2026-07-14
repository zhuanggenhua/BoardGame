import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SummonerWarsCombatEffectSettingsSection } from '../CombatEffectSettingsSection';

const toggleReducedCombatEffects = vi.fn();

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock('../useSummonerWarsCombatEffectPreference', () => ({
    useSummonerWarsCombatEffectPreference: () => ({
        reducedCombatEffects: false,
        toggleReducedCombatEffects,
    }),
}));

describe('SummonerWarsCombatEffectSettingsSection', () => {
    it('应使用滑块开关切换降低攻击特效', () => {
        render(<SummonerWarsCombatEffectSettingsSection t={(key: string) => key} />);

        const toggle = screen.getByRole('switch', { name: 'hud.combatEffects.reduced' });
        expect(toggle).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'hud.combatEffects.reduced' })).toBeNull();

        fireEvent.click(toggle);
        expect(toggleReducedCombatEffects).toHaveBeenCalledTimes(1);
    });
});
