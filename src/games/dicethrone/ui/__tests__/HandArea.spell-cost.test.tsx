import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandArea } from '../HandArea';
import { DOCTOR_STRANGE_CARDS, DOCTOR_STRANGE_SPELLS } from '../../heroes/doctor_strange/cards';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../components/common/media/CardPreview', () => ({
    CardPreview: () => <div data-testid="card-preview" />,
}));

afterEach(() => {
    vi.useRealTimers();
});

describe('DiceThrone 法术手牌费用显示', () => {
    it('未印费用的奇异博士法术不显示数字或 CP 费用标签', () => {
        vi.useFakeTimers();
        render(
            <HandArea handDiscardInteraction={undefined}
                hand={[DOCTOR_STRANGE_SPELLS[0]]}
                locale="zh-CN"
                currentPhase="main1"
                playerCp={5}
                canInteract={false}
                canPlayCards={false}
                canSellCards={false}
            />,
        );
        act(() => vi.runAllTimers());

        expect(screen.queryByTestId('dt-hand-card-cost')).toBeNull();
        expect(screen.queryByLabelText(/费用 .* CP/)).toBeNull();
    });

    it('仍为有印制费用的行动牌显示 CP 费用', () => {
        vi.useFakeTimers();
        const paidAction = { ...DOCTOR_STRANGE_CARDS[28], cpCost: 1 };
        render(
            <HandArea handDiscardInteraction={undefined}
                hand={[paidAction]}
                locale="zh-CN"
                currentPhase="main1"
                playerCp={5}
                canInteract={false}
                canPlayCards={false}
                canSellCards={false}
            />,
        );
        act(() => vi.runAllTimers());

        expect(screen.getByTestId('dt-hand-card-cost')).toHaveAttribute('data-cost', '1');
        expect(screen.getByLabelText('费用 1 CP')).toBeInTheDocument();
    });
});
