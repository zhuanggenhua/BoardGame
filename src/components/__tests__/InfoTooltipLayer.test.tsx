import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UI_Z_INDEX } from '../../core';
import { InfoTooltip } from '../common/overlays/InfoTooltip';
import { ModalBase } from '../common/overlays/ModalBase';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const MotionDiv = ({ children, ...rest }: { children?: React.ReactNode }) => (
        React.createElement('div', rest, children)
    );

    return {
        motion: { div: MotionDiv },
        AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
            React.createElement(React.Fragment, null, children)
        ),
    };
});

describe('InfoTooltip layer context', () => {
    it('在 ModalBase 内默认继承 modal tooltip 层级', () => {
        render(
            <ModalBase>
                <div className="relative">
                    <InfoTooltip
                        title="标题"
                        content={['说明']}
                        isVisible
                    />
                </div>
            </ModalBase>
        );

        const tooltipTitle = screen.getByText('标题');
        const tooltipLayer = tooltipTitle.closest('.absolute');

        expect(tooltipLayer).not.toBeNull();
        expect(tooltipLayer).toHaveStyle({ zIndex: String(UI_Z_INDEX.modalTooltip) });
    });
});
