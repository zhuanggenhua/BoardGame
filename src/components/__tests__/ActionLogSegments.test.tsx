import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OverlayLayerProvider } from '../common/overlays/OverlayLayerContext';
import { ActionLogSegments } from '../game/framework/widgets/ActionLogSegments';

describe('ActionLogSegments', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="modal-root"></div>';
    });

    it('将父浮层提供的 breakdown tooltip 层级透传给 portal 浮层', async () => {
        render(
            <OverlayLayerProvider tooltipZIndex={2403}>
                <ActionLogSegments
                    segments={[
                        {
                            type: 'breakdown',
                            displayText: '+3',
                            lines: [{ label: '修正', value: 3 }],
                        },
                    ]}
                />
            </OverlayLayerProvider>
        );

        fireEvent.mouseEnter(screen.getByText('+3'));

        const tooltipLayer = await screen.findByText('修正');
        const portalLayer = tooltipLayer.closest('.fixed');

        expect(portalLayer).not.toBeNull();
        expect(portalLayer).toHaveStyle({ zIndex: '2403' });
    });

    it('显式传入的 breakdown zIndex 仍然优先于父浮层上下文', async () => {
        render(
            <OverlayLayerProvider tooltipZIndex={2403}>
                <ActionLogSegments
                    segments={[
                        {
                            type: 'breakdown',
                            displayText: '+5',
                            lines: [{ label: '额外修正', value: 5 }],
                        },
                    ]}
                    breakdownZIndex={2501}
                />
            </OverlayLayerProvider>
        );

        fireEvent.mouseEnter(screen.getByText('+5'));

        const tooltipLayer = await screen.findByText('额外修正');
        const portalLayer = tooltipLayer.closest('.fixed');

        expect(portalLayer).not.toBeNull();
        expect(portalLayer).toHaveStyle({ zIndex: '2501' });
    });
});
