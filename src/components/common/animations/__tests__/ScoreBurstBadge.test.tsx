import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScoreBurstBadge } from '../ScoreBurstBadge';

vi.mock('framer-motion', async () => {
    const React = await import('react');
    const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        ({ children, ...rest }, ref) => React.createElement('div', { ...rest, ref }, children),
    );
    MotionDiv.displayName = 'MotionDiv';

    return {
        motion: { div: MotionDiv },
        useAnimate: () => [
            { current: null },
            vi.fn().mockResolvedValue(undefined),
        ] as const,
    };
});

describe('ScoreBurstBadge', () => {
    it('保留外层容器居中能力，不在内部写死收缩宽度', () => {
        render(
            <ScoreBurstBadge
                value="+102"
                className="score-burst-host"
                testId="score-burst"
            />,
        );

        const host = screen.getByTestId('score-burst');
        const inner = host.firstElementChild as HTMLElement | null;

        expect(host).not.toBeNull();
        expect(inner).not.toBeNull();
        expect(host).not.toHaveStyle({ width: 'max-content' });
        expect(inner).not.toHaveStyle({ width: 'max-content' });
        expect(inner).toHaveStyle({
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformOrigin: 'center center',
        });
    });
});
