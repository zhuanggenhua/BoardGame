import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { setAssetsBaseUrl } from '../../core';
import { OverlayLayerProvider } from '../common/overlays/OverlayLayerContext';
import { ActionLogSegments } from '../game/framework/widgets/ActionLogSegments';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            if (!params) return key;
            return Object.entries(params).reduce(
                (text, [paramKey, value]) => text.replace(`{{${paramKey}}}`, String(value)),
                key,
            );
        },
        i18n: { language: 'zh-CN' },
    }),
}));

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

    it('card 片段缺少内联预览时，向 registry 传递玩家和角色上下文并打开卡图 tooltip', async () => {
        const getCardPreviewRef = vi.fn(() => ({
            type: 'image' as const,
            src: 'dicethrone/images/xixuegui/ability-cards',
        }));

        render(
            <ActionLogSegments
                locale="zh-CN"
                playerId="0"
                characterId="vampire_lord"
                getCardPreviewRef={getCardPreviewRef}
                segments={[
                    {
                        type: 'card',
                        cardId: 'card-get-away',
                        previewText: '起开！',
                    },
                ]}
            />
        );

        expect(getCardPreviewRef).toHaveBeenCalledWith('card-get-away', {
            playerId: '0',
            characterId: 'vampire_lord',
        });

        fireEvent.mouseEnter(screen.getByTestId('card-preview-tooltip-anchor'));

        expect(await screen.findByTestId('card-preview-tooltip')).toBeInTheDocument();
    });

    it('i18n 交互参数带 previewRef 时，关键词可直接打开卡图 tooltip', async () => {
        render(
            <ActionLogSegments
                locale="zh-CN"
                segments={[
                    {
                        type: 'i18n',
                        ns: 'game-betrayal',
                        key: '{{playerId}} 探索到{{room}}，触发事件：{{event}}',
                        params: { playerId: '薇薇安', room: '厨房', event: '无线电广播' },
                        interactiveParams: {
                            room: {
                                text: '厨房',
                                previewRef: { type: 'image', src: 'betrayal/rooms/kitchen' },
                            },
                        },
                    },
                ]}
            />
        );

        fireEvent.mouseEnter(screen.getByText('厨房'));

        expect(await screen.findByTestId('card-preview-tooltip')).toBeInTheDocument();
    });

    it('card 片段的卡图 tooltip 继承父浮层层级，避免被日志面板遮挡', async () => {
        const getCardPreviewRef = vi.fn(() => ({
            type: 'image' as const,
            src: 'dicethrone/images/xixuegui/ability-cards',
        }));

        render(
            <OverlayLayerProvider tooltipZIndex={2603}>
                <ActionLogSegments
                    locale="zh-CN"
                    playerId="0"
                    characterId="vampire_lord"
                    getCardPreviewRef={getCardPreviewRef}
                    segments={[
                        {
                            type: 'card',
                            cardId: 'card-vampire-lord-total-demise',
                            previewText: '死无全尸！',
                        },
                    ]}
                />
            </OverlayLayerProvider>
        );

        fireEvent.mouseEnter(screen.getByTestId('card-preview-tooltip-anchor'));

        const tooltipLayer = await screen.findByTestId('card-preview-tooltip');
        expect(tooltipLayer).toHaveStyle({ zIndex: '2603' });
    });
});
