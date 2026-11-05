import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhaseIndicator } from '../PhaseIndicator';

const coarsePointer = vi.hoisted(() => ({ value: true }));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../hooks/ui/useCoarsePointer', () => ({
    useCoarsePointer: () => coarsePointer.value,
}));

vi.mock('../../../../components/common/overlays/InfoTooltip', () => ({
    InfoTooltip: ({ title, isVisible }: { title: unknown; isVisible: boolean }) => (
        <div data-testid="phase-info-tooltip" data-title={String(title)} data-visible={String(isVisible)} />
    ),
}));

describe('DiceThrone PhaseIndicator mobile explanation', () => {
    it('触控设备点按阶段项显示说明，再点一次关闭；切换项目时只显示新项目', () => {
        render(<PhaseIndicator currentPhase="main1" />);

        const items = screen.getAllByRole('button');
        expect(items).toHaveLength(7);
        const tooltips = screen.getAllByTestId('phase-info-tooltip');
        expect(tooltips.every((tooltip) => tooltip.getAttribute('data-visible') === 'false')).toBe(true);

        fireEvent.click(items[0]);
        expect(tooltips[0]).toHaveAttribute('data-visible', 'true');
        expect(items[0]).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(items[1]);
        expect(tooltips[0]).toHaveAttribute('data-visible', 'false');
        expect(tooltips[1]).toHaveAttribute('data-visible', 'true');

        fireEvent.click(items[1]);
        expect(tooltips[1]).toHaveAttribute('data-visible', 'false');
        expect(items[1]).toHaveAttribute('aria-expanded', 'false');
    });

    it('触控设备可用键盘激活阶段说明', () => {
        render(<PhaseIndicator currentPhase="main1" />);
        const firstItem = screen.getAllByRole('button')[0];

        fireEvent.keyDown(firstItem, { key: 'Enter' });

        expect(screen.getAllByTestId('phase-info-tooltip')[0]).toHaveAttribute('data-visible', 'true');
    });
});
