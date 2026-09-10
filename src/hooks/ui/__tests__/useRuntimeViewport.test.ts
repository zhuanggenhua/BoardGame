import { afterEach, describe, expect, it } from 'vitest';
import { applyRuntimeViewportCssVars } from '../useRuntimeViewport';

describe('applyRuntimeViewportCssVars', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-mobile-layout-engine');
        document.body.removeAttribute('data-mobile-layout-engine');
        const style = document.documentElement.style;
        style.removeProperty('--runtime-viewport-width');
        style.removeProperty('--runtime-viewport-height');
        style.removeProperty('--mobile-board-shell-design-width');
        style.removeProperty('--mobile-board-shell-design-height');
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
