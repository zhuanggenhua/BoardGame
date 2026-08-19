/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardLayoutEditor } from '../BoardLayoutEditor';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) => (
            params
                ? Object.entries(params).reduce((value, [name, replacement]) => (
                    value.replace(`{{${name}}}`, String(replacement))
                ), key)
                : key
        ),
    }),
}));

vi.mock('../../../common/media/OptimizedImage', () => ({
    OptimizedImage: ({ src, alt, className, onLoad }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) => (
        <img
            data-testid="layout-background-optimized"
            src={src}
            alt={alt}
            className={className}
            onLoad={onLoad}
        />
    ),
}));

class ResizeObserverMock implements ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}

const baseConfig = {
    version: '1.0.0',
    zones: [],
    tracks: [],
    stackPoints: [],
};

describe('BoardLayoutEditor', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('用统一图片加载链渲染逻辑资源路径，避免请求过期 PNG', () => {
        render(
            <BoardLayoutEditor
                initialConfig={baseConfig}
                backgroundImage="summonerwars/common/map.png"
            />,
        );

        expect(screen.getByTestId('layout-background-optimized')).toHaveAttribute(
            'src',
            'summonerwars/common/map.png',
        );
    });

    it('兼容旧 /assets/ 背景路径，并改走逻辑资源路径', () => {
        render(
            <BoardLayoutEditor
                initialConfig={baseConfig}
                backgroundImage="/assets/summonerwars/common/map.png"
            />,
        );

        expect(screen.getByTestId('layout-background-optimized')).toHaveAttribute(
            'src',
            'summonerwars/common/map.png',
        );
    });

    it('外部 URL 仍按普通图片 URL 渲染', () => {
        render(
            <BoardLayoutEditor
                initialConfig={baseConfig}
                backgroundImage="https://example.test/map.png"
            />,
        );

        const background = screen.getByAltText('layoutEditor.backgroundAlt');
        expect(background).toHaveAttribute('src', 'https://example.test/map.png');
        expect(screen.queryByTestId('layout-background-optimized')).not.toBeInTheDocument();
    });
});
