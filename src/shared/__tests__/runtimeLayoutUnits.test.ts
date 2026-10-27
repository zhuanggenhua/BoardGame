// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readBoardShellBlockUnitPixelValue, readBoardShellInlineUnitPixelValue } from '../runtimeLayoutUnits';

describe('壳层 CSS 长度读取为像素', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 });
    });
    afterEach(() => {
        document.documentElement.style.removeProperty('--mobile-board-shell-inline-unit');
        document.documentElement.style.removeProperty('--mobile-board-shell-block-unit');
    });

    it('桌面 1vw 的悬停与扇形位移按视口宽度计算', () => {
        document.documentElement.style.setProperty('--mobile-board-shell-inline-unit', '1vw');
        expect(readBoardShellInlineUnitPixelValue()).toBe(12.8);
        expect(readBoardShellInlineUnitPixelValue() * 3.1).toBeCloseTo(39.68);
    });
    it('桌面 1vh 的发牌与弃牌纵向位移按视口高度计算', () => {
        document.documentElement.style.setProperty('--mobile-board-shell-block-unit', '1vh');
        expect(readBoardShellBlockUnitPixelValue()).toBe(7.2);
    });
    it('等比壳层像素单位保持逻辑尺寸', () => {
        document.documentElement.style.setProperty('--mobile-board-shell-inline-unit', '19.2px');
        document.documentElement.style.setProperty('--mobile-board-shell-block-unit', '10.8px');
        expect(readBoardShellInlineUnitPixelValue()).toBe(19.2);
        expect(readBoardShellBlockUnitPixelValue()).toBe(10.8);
    });
    it('未配置壳层单位时沿用真实视口单位', () => {
        expect(readBoardShellInlineUnitPixelValue()).toBe(12.8);
        expect(readBoardShellBlockUnitPixelValue()).toBe(7.2);
    });
});
