import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CardChoiceOverlay } from '../CardChoiceOverlay';

describe('CardChoiceOverlay', () => {
    it('把卡牌本体作为唯一可见内容，不在卡外重复渲染牌名', () => {
        const html = renderToStaticMarkup(
            <CardChoiceOverlay
                isOpen
                title="选择绑定法术"
                subtitle="目标：兽王学徒"
                cancelLabel="取消"
                onCancel={() => undefined}
                onSelect={() => undefined}
                testId="spell-choice"
                options={[
                    {
                        id: 'spell-1',
                        previewRef: { type: 'image', src: '/spell-1.webp' },
                        ariaLabel: '兽性觉醒',
                        testId: 'spell-option',
                    },
                ]}
            />,
        );

        expect(html).toContain('data-choice-card-preview="true"');
        expect(html).toContain('aria-label="兽性觉醒"');
        expect(html).not.toContain('>兽性觉醒<');
    });

    it('支持多选确认，但仍只把选择态贴在卡牌本体上', () => {
        const html = renderToStaticMarkup(
            <CardChoiceOverlay
                isOpen
                title="选择两张行动"
                selectedCount="已选 1 / 2"
                selectionMode="multi"
                confirmLabel="确认"
                confirmDisabled={false}
                cancelLabel="取消"
                onCancel={() => undefined}
                onConfirm={() => undefined}
                onSelect={() => undefined}
                testId="multi-choice"
                options={[
                    {
                        id: 'action-1',
                        previewRef: { type: 'image', src: '/action-1.webp' },
                        ariaLabel: '生命之水',
                        selected: true,
                        testId: 'action-option',
                    },
                ]}
            />,
        );

        expect(html).toContain('data-testid="multi-choice-actions"');
        expect(html).toContain('data-testid="multi-choice-confirm"');
        expect(html).toContain('data-testid="action-option-selected-indicator"');
        expect(html).not.toContain('>生命之水<');
    });

    it('候选过多时限制容器宽度并启用真实折行布局', () => {
        const html = renderToStaticMarkup(
            <CardChoiceOverlay
                isOpen
                title="选择绑定法术"
                cancelLabel="取消"
                onCancel={() => undefined}
                onSelect={() => undefined}
                options={[
                    { id: 'spell-1', previewRef: { type: 'image', src: '/spell-1.webp' }, ariaLabel: '法术一' },
                    { id: 'spell-2', previewRef: { type: 'image', src: '/spell-2.webp' }, ariaLabel: '法术二' },
                ]}
            />,
        );

        expect(html).toContain('style="max-width:min(92rem, 96vw)"');
        expect(html).toContain('data-choice-layout="wrap"');
        expect(html).toContain('w-full max-w-full');
        expect(html).toContain('data-choice-overlay-layer="independent"');
        expect(html).not.toContain('w-fit');
    });

    it('支持独立于下层 UI 的滚动窗口，不为下层牌区扣高度', () => {
        const html = renderToStaticMarkup(
            <CardChoiceOverlay
                isOpen
                title="选择绑定法术"
                cancelLabel="取消"
                onCancel={() => undefined}
                onSelect={() => undefined}
                gridHeightStyle={{ height: 'min(34rem,60dvh)' }}
                options={[
                    { id: 'spell-1', previewRef: { type: 'image', src: '/spell-1.webp' }, ariaLabel: '法术一' },
                ]}
            />,
        );

        expect(html).toContain('data-choice-scroll-window="true"');
        expect(html).toContain('data-choice-scroll-policy="overlay-owned"');
        expect(html).toContain('style="height:min(34rem,60dvh)"');
        expect(html).toContain('overflow-y-auto');
        expect(html).not.toContain('calc(100vh - 34rem)');
    });
});
