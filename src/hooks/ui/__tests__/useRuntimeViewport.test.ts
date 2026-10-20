import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { applyRuntimeViewportCssVars, useRuntimeViewport } from '../useRuntimeViewport';
import { readBoardShellCanvasSizeValue, readBoardShellScaleValue } from '../../../shared/runtimeLayoutUnits';

describe('applyRuntimeViewportCssVars', () => {
    it.each([
        ['width', 936, 432, '0.487500', '0.000px'],
        ['height', 936, 432, '0.450000', '36.000px'],
        ['height', 1000, 432, '0.450000', '68.000px'],
        ['contain', 936, 432, '0.450000', '36.000px'],
        ['contain', 800, 450, '0.416667', '0.000px'],
    ])('按%s匹配同一PC参考画布（视口%s×%s）', (fit, width, height, scale, offsetX) => {
        const gamePage = document.createElement('div');
        const attrs = {
            'data-game-page': 'true', 'data-mobile-profile': 'landscape-adapted',
            'data-mobile-layout-preset': 'board-shell',
            'data-mobile-board-shell-design-width': '2340', 'data-mobile-board-shell-design-height': '1080',
            'data-mobile-board-shell-reference-width': '1920', 'data-mobile-board-shell-reference-height': '960',
            'data-mobile-board-shell-fit': String(fit),
        };
        for (const [key, value] of Object.entries(attrs)) gamePage.setAttribute(key, value);
        document.body.appendChild(gamePage);
        applyRuntimeViewportCssVars({ width: Number(width), height: Number(height) });
        const style = document.documentElement.style;
        expect(style.getPropertyValue('--mobile-board-shell-scale')).toBe(scale);
        expect(style.getPropertyValue('--mobile-board-shell-canvas-width')).toBe('1920px');
        expect(style.getPropertyValue('--mobile-board-shell-canvas-height')).toBe('960px');
        expect(style.getPropertyValue('--mobile-board-shell-inline-unit')).toBe('19.2000px');
        expect(style.getPropertyValue('--mobile-board-shell-block-unit')).toBe('9.6000px');
        expect(style.getPropertyValue('--mobile-board-shell-offset-x')).toBe(offsetX);
        expect(readBoardShellCanvasSizeValue()).toEqual({ width: 1920, height: 960 });
    });
    it('完整适配使用安全区内的可用矩形，偏移包含安全区原点', () => {
        const gamePage = document.createElement('div');
        for (const [key, value] of Object.entries({
            'data-game-page': 'true', 'data-mobile-profile': 'landscape-adapted',
            'data-mobile-layout-preset': 'board-shell', 'data-mobile-board-shell-fit': 'contain',
            'data-mobile-board-shell-reference-width': '1920', 'data-mobile-board-shell-reference-height': '960',
        })) gamePage.setAttribute(key, value);
        document.body.appendChild(gamePage);
        applyRuntimeViewportCssVars({ width: 936, height: 432,
            safeArea: { left: 30, right: 12, top: 4, bottom: 8 }, keyboardInsetBottom: 0 });
        const style = document.documentElement.style;
        expect(style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.437500');
        expect(style.getPropertyValue('--mobile-board-shell-offset-x')).toBe('57.000px');
        expect(style.getPropertyValue('--mobile-board-shell-offset-y')).toBe('4.000px');
    });
    it('横屏视口不变时从首页进入游戏仍同步新的画布参数', async () => {
        const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 936 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 432 });
        const attrs = {
            'data-game-page': 'true', 'data-game-id': 'dicethrone',
            'data-mobile-profile': 'landscape-adapted', 'data-mobile-layout-preset': 'board-shell',
            'data-mobile-board-shell-design-width': '2340', 'data-mobile-board-shell-design-height': '1080',
            'data-mobile-board-shell-reference-width': '1920', 'data-mobile-board-shell-reference-height': '1080',
        };
        const { result, unmount } = renderHook(() => ({ viewport: useRuntimeViewport(), scale: readBoardShellScaleValue() }));
        try {
            await act(async () => { for (const [key, value] of Object.entries(attrs)) document.body.setAttribute(key, value); });
            await waitFor(() => expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.400000'));
            await waitFor(() => expect(result.current.scale).toBe(0.4));
            await act(async () => {
                document.body.setAttribute('data-mobile-board-shell-design-width', '940');
                document.body.removeAttribute('data-mobile-board-shell-design-height');
            });
            await waitFor(() => expect(result.current.scale).toBe(0.995745));
            await act(async () => {
                Object.defineProperty(window, 'innerWidth', { configurable: true, value: 812 });
                window.dispatchEvent(new Event('resize'));
            });
            await waitFor(() => expect(result.current.scale).toBe(0.86383));
            expect(result.current.viewport.width).toBe(812);
            await act(async () => { for (const key of Object.keys(attrs)) document.body.removeAttribute(key); });
            await waitFor(() => expect(result.current.scale).toBe(1));
            expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('');
        } finally {
            unmount();
            for (const key of Object.keys(attrs)) document.body.removeAttribute(key);
            if (width) Object.defineProperty(window, 'innerWidth', width);
            if (height) Object.defineProperty(window, 'innerHeight', height);
        }
    });
    it('同一视口切换宽高适配，并在返回旧游戏和退出时清理参考画布', async () => {
        const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 936 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 432 });
        const attrs = {
            'data-game-page': 'true', 'data-mobile-profile': 'landscape-adapted',
            'data-mobile-layout-preset': 'board-shell',
            'data-mobile-board-shell-design-width': '2340', 'data-mobile-board-shell-design-height': '1080',
            'data-mobile-board-shell-reference-width': '1920', 'data-mobile-board-shell-reference-height': '960',
            'data-mobile-board-shell-fit': 'height',
        };
        for (const [key, value] of Object.entries(attrs)) document.body.setAttribute(key, value);
        const { result, unmount } = renderHook(() => {
            useRuntimeViewport();
            return readBoardShellScaleValue();
        });
        const style = document.documentElement.style;
        try {
            await waitFor(() => expect(result.current).toBe(0.45));
            expect(style.getPropertyValue('--mobile-board-shell-canvas-height')).toBe('960px');
            await act(async () => { document.body.setAttribute('data-mobile-board-shell-fit', 'width'); });
            await waitFor(() => expect(result.current).toBe(0.4875));
            await act(async () => { document.body.removeAttribute('data-mobile-board-shell-fit'); });
            await waitFor(() => expect(result.current).toBe(0.4));
            expect(style.getPropertyValue('--mobile-board-shell-canvas-width')).toBe('');
            expect(style.getPropertyValue('--mobile-board-shell-canvas-height')).toBe('');
            await act(async () => {
                document.body.setAttribute('data-mobile-board-shell-fit', 'height');
            });
            await waitFor(() => expect(result.current).toBe(0.45));
            await act(async () => { for (const key of Object.keys(attrs)) document.body.removeAttribute(key); });
            await waitFor(() => expect(result.current).toBe(1));
            expect(style.getPropertyValue('--mobile-board-shell-canvas-height')).toBe('');
        } finally {
            unmount();
            for (const key of Object.keys(attrs)) document.body.removeAttribute(key);
            if (width) Object.defineProperty(window, 'innerWidth', width);
            if (height) Object.defineProperty(window, 'innerHeight', height);
        }
    });
    it.each([true, false])('游戏参数先于hook挂载时同步CSS读取者（syncCssVars=%s）', async (syncCssVars) => {
        const width = Object.getOwnPropertyDescriptor(window, 'innerWidth');
        const height = Object.getOwnPropertyDescriptor(window, 'innerHeight');
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 936 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 432 });
        const attrs = { 'data-game-page': 'true', 'data-mobile-profile': 'landscape-adapted',
            'data-mobile-layout-preset': 'board-shell', 'data-mobile-board-shell-design-width': '2340',
            'data-mobile-board-shell-design-height': '1080' };
        for (const [key, value] of Object.entries(attrs)) document.body.setAttribute(key, value);
        document.documentElement.style.setProperty('--mobile-board-shell-scale', '0.5');
        let renders = 0;
        const { result, unmount } = renderHook(() => {
            useRuntimeViewport({ syncCssVars });
            return { scale: readBoardShellScaleValue(), renders: ++renders };
        });
        try {
            await waitFor(() => expect(result.current.renders).toBeGreaterThan(1));
            expect(result.current.scale).toBe(syncCssVars ? 0.4 : 0.5);
        } finally {
            unmount();
            for (const key of Object.keys(attrs)) document.body.removeAttribute(key);
            if (width) Object.defineProperty(window, 'innerWidth', width);
            if (height) Object.defineProperty(window, 'innerHeight', height);
        }
    });
    afterEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-mobile-layout-engine');
        document.body.removeAttribute('data-mobile-layout-engine');
        const style = document.documentElement.style;
        style.removeProperty('--runtime-viewport-width');
        style.removeProperty('--runtime-viewport-height');
        style.removeProperty('--mobile-board-shell-design-width');
        style.removeProperty('--mobile-board-shell-design-height');
        style.removeProperty('--mobile-board-shell-canvas-width');
        style.removeProperty('--mobile-board-shell-canvas-height');
        style.removeProperty('--mobile-board-shell-reference-width');
        style.removeProperty('--mobile-board-shell-reference-height');
        style.removeProperty('--mobile-board-shell-scale');
        style.removeProperty('--mobile-board-shell-inverse-scale');
        style.removeProperty('--mobile-board-shell-logical-height');
        style.removeProperty('--mobile-board-shell-inline-unit');
        style.removeProperty('--mobile-board-shell-block-unit');
        style.removeProperty('--mobile-board-shell-offset-x');
        style.removeProperty('--mobile-board-shell-offset-y');
    });

    it('uses descendant game page metadata before html/body attributes are synced', () => {
        const gamePage = document.createElement('div');
        gamePage.setAttribute('data-game-page', 'true');
        gamePage.setAttribute('data-game-id', 'smashup');
        gamePage.setAttribute('data-mobile-profile', 'landscape-adapted');
        gamePage.setAttribute('data-mobile-layout-preset', 'board-shell');
        gamePage.setAttribute('data-mobile-board-shell-design-width', '1160');
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 936, height: 432 });

        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-width')).toBe('1160px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-height')).toBe('');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.806897');
    });

    it('board-shell uses manifest-provided design dimensions instead of the shared default width', () => {
        const gamePage = document.createElement('div');
        gamePage.setAttribute('data-game-page', 'true');
        gamePage.setAttribute('data-game-id', 'fantasyrealms');
        gamePage.setAttribute('data-mobile-profile', 'landscape-adapted');
        gamePage.setAttribute('data-mobile-layout-preset', 'board-shell');
        gamePage.setAttribute('data-mobile-board-shell-design-width', '1920');
        gamePage.setAttribute('data-mobile-board-shell-design-height', '1080');
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 936, height: 432 });

        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-width')).toBe('1920px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-height')).toBe('1080px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.400000');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-x')).toBe('84.000px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-y')).toBe('0.000px');
    });

    it('portrait board-shell fits a portrait reference canvas without rotating or cropping it', () => {
        const gamePage = document.createElement('div');
        for (const [key, value] of Object.entries({
            'data-game-page': 'true', 'data-game-id': 'tictactoe',
            'data-mobile-profile': 'portrait-adapted', 'data-mobile-layout-preset': 'board-shell',
            'data-mobile-board-shell-design-width': '1080', 'data-mobile-board-shell-design-height': '2340',
            'data-mobile-board-shell-reference-width': '1080', 'data-mobile-board-shell-reference-height': '2340',
            'data-mobile-board-shell-fit': 'contain',
        })) gamePage.setAttribute(key, value);
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 390, height: 845 });

        const style = document.documentElement.style;
        expect(style.getPropertyValue('--mobile-board-shell-design-width')).toBe('1080px');
        expect(style.getPropertyValue('--mobile-board-shell-design-height')).toBe('2340px');
        expect(style.getPropertyValue('--mobile-board-shell-canvas-width')).toBe('1080px');
        expect(style.getPropertyValue('--mobile-board-shell-canvas-height')).toBe('2340px');
        expect(style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.361111');
        expect(style.getPropertyValue('--mobile-board-shell-offset-x')).toBe('0.000px');
        expect(style.getPropertyValue('--mobile-board-shell-offset-y')).toBe('0.000px');
        expect(readBoardShellCanvasSizeValue()).toEqual({ width: 1080, height: 2340 });
    });

    it('separates the mobile shell canvas from the PC visual reference units', () => {
        const gamePage = document.createElement('div');
        gamePage.setAttribute('data-game-page', 'true');
        gamePage.setAttribute('data-game-id', 'dicethrone');
        gamePage.setAttribute('data-mobile-profile', 'landscape-adapted');
        gamePage.setAttribute('data-mobile-layout-preset', 'board-shell');
        gamePage.setAttribute('data-mobile-board-shell-design-width', '2340');
        gamePage.setAttribute('data-mobile-board-shell-design-height', '1080');
        gamePage.setAttribute('data-mobile-board-shell-reference-width', '1920');
        gamePage.setAttribute('data-mobile-board-shell-reference-height', '1080');
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 936, height: 432 });

        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-width')).toBe('2340px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-height')).toBe('1080px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-reference-width')).toBe('1920px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-reference-height')).toBe('1080px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.400000');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-inline-unit')).toBe('19.2000px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-block-unit')).toBe('10.8000px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-x')).toBe('0.000px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-y')).toBe('0.000px');
    });
});
