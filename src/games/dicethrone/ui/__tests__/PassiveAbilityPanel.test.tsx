import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassiveAbilityPanel } from '../PassiveAbilityPanel';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

describe('PassiveAbilityPanel', () => {
    it('按钮正文只显示动作名称，可用状态表达是否能执行，成本保留在无障碍名称', () => {
        render(
            <PassiveAbilityPanel
                passives={[{
                    id: 'vampire-lord-blood-power',
                    nameKey: 'passive.vampireLordBloodPower.name',
                    actions: [{
                        type: 'custom',
                        labelKey: 'passive.vampireLordBloodPower.attackBonusShort',
                        cpCost: 0,
                        tokenCost: { tokenId: 'blood_power', amount: 1 },
                        timing: 'ownRollPhase',
                        descriptionKey: 'passive.vampireLordBloodPower.attackBonus',
                    }],
                }]}
                actionUsability={new Map([['vampire-lord-blood-power', [true]]])}
                currentCp={0}
                onActionClick={vi.fn()}
            />,
        );

        const button = screen.getByTestId('passive-action-vampire-lord-blood-power-0');
        expect(button).toHaveTextContent('passive.vampireLordBloodPower.attackBonusShort');
        expect(button).not.toHaveTextContent('1 tokens.blood_power.name');
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('data-passive-action-usable', 'true');
        expect(button).toHaveClass('ring-2');
        expect(button).toHaveClass('ring-emerald-300/80');
        expect(button).toHaveAttribute(
            'aria-label',
            expect.stringContaining('1 tokens.blood_power.name'),
        );
    });

    it('攻击伤害型能力作为常驻按钮显示，并按可用状态高亮', () => {
        render(
            <PassiveAbilityPanel
                passives={[{
                    id: 'vampire-lord-blood-power',
                    nameKey: 'passive.vampireLordBloodPower.name',
                    actions: [{
                        type: 'custom',
                        labelKey: 'passive.vampireLordBloodPower.healShort',
                        cpCost: 0,
                        tokenCost: { tokenId: 'blood_power', amount: 4 },
                        timing: 'ownMainPhase',
                        descriptionKey: 'passive.vampireLordBloodPower.heal',
                        requiresCurrentAttackDamageDealt: true,
                        showWhenUnavailable: true,
                    }],
                }]}
                actionUsability={new Map([['vampire-lord-blood-power', [true]]])}
                currentCp={0}
                onActionClick={vi.fn()}
            />,
        );

        const button = screen.getByTestId('passive-action-vampire-lord-blood-power-0');
        expect(button).toBeEnabled();
        expect(button).toHaveAttribute('data-passive-action-usable', 'true');
        expect(button).toHaveClass('ring-emerald-300/80');
    });
});
