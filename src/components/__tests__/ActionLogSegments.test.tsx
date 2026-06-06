import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { setAssetsBaseUrl } from '../../core';
import { OverlayLayerProvider } from '../common/overlays/OverlayLayerContext';
import { ActionLogSegments } from '../game/framework/widgets/ActionLogSegments';

describe('ActionLogSegments', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="modal-root"></div>';
        setAssetsBaseUrl('/assets');
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

    it('diceResult 片段通过通用 sprite seam 渲染非 DiceThrone 骰图资源', () => {
        const { container } = render(
            <ActionLogSegments
                locale="zh-CN"
                segments={[
                    {
                        type: 'diceResult',
                        spriteAsset: 'summonerwars/common/dice',
                        spriteCols: 3,
                        spriteRows: 3,
                        dice: [{ value: 1, col: 0, row: 0 }],
                    },
                ]}
            />
        );

        const dieIcon = container.querySelector('.inline-block');

        expect(dieIcon).not.toBeNull();
        expect(dieIcon).toHaveStyle({
            backgroundImage: 'url("/assets/i18n/zh-CN/summonerwars/common/compressed/dice.webp")',
        });
    });
});
