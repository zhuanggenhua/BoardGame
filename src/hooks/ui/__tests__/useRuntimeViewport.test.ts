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
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 936, height: 432 });

        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-width')).toBe('1160px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.806897');
    });

    it('fantasyrealms board-shell uses its own design baseline instead of the shared default width', () => {
        const gamePage = document.createElement('div');
        gamePage.setAttribute('data-game-page', 'true');
        gamePage.setAttribute('data-game-id', 'fantasyrealms');
        gamePage.setAttribute('data-mobile-profile', 'landscape-adapted');
        gamePage.setAttribute('data-mobile-layout-preset', 'board-shell');
        document.body.appendChild(gamePage);

        applyRuntimeViewportCssVars({ width: 936, height: 432 });

        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-design-width')).toBe('1520px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-scale')).toBe('0.540000');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-x')).toBe('57.600px');
        expect(document.documentElement.style.getPropertyValue('--mobile-board-shell-offset-y')).toBe('0.000px');
    });
});
