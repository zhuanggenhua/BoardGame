import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileBoardShell } from '../MobileBoardShell';

describe('MobileBoardShell', () => {
    it('renders canvas content and optional rails', () => {
        render(
            <MobileBoardShell
                topRail={<div>top</div>}
                sideDock={<div>side</div>}
                bottomRail={<div>bottom</div>}
            >
                <div>board</div>
            </MobileBoardShell>,
        );

        expect(screen.getByText('board')).toBeInTheDocument();
        expect(screen.getByText('top')).toBeInTheDocument();
        expect(screen.getByText('side')).toBeInTheDocument();
        expect(screen.getByText('bottom')).toBeInTheDocument();
    });
});
