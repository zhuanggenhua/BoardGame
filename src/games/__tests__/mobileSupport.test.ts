/* @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { getAllGames, getGameById } from '../../config/games.config';
import { MOBILE_REFERENCE_VIEWPORT } from '../../shared/referenceViewports';
import {
    getGameMobileBannerKind,
    getGamePageDataAttributes,
    resolveStableViewportSize,
    resolveGameMobileSupport,
    shouldUseBoardShellScale,
    syncGamePageDocumentAttributes,
} from '../../shared/mobileSupport';

describe('mobile support manifest contract', () => {
    it('all enabled entries expose explicit mobileProfile and shellTargets', () => {
        const games = getAllGames();

        expect(games.length).toBeGreaterThan(0);
        for (const game of games) {
            expect(game.mobileProfile).toBeDefined();
            expect(game.mobileBattlefieldZoom).toBeDefined();
            expect(game.shellTargets?.length ?? 0).toBeGreaterThan(0);
            expect(game.mobileDelivery?.mode).toBeDefined();
        }
    });

    it('dicethrone declares landscape board-shell support, container targets and package delivery metadata', () => {
        const game = getGameById('dicethrone');

        expect(game?.mobileProfile).toBe('landscape-adapted');
        expect(game?.preferredOrientation).toBe('landscape');
        expect(game?.mobileLayoutPreset).toBe('board-shell');
        expect(game?.mobileBattlefieldZoom).toBe('game-owned');
        expect(game?.shellTargets).toEqual(
            expect.arrayContaining(['pwa', 'app-webview', 'mini-program-webview']),
        );
        expect(game?.mobileDelivery).toEqual({
            mode: 'package-managed',
            runtimeChannel: 'edge',
            modulePackId: 'dicethrone',
            assetPackId: 'dicethrone',
        });
    });

    it('cardia declares landscape board-shell support', () => {
        const game = getGameById('cardia');

        expect(game?.mobileProfile).toBe('landscape-adapted');
        expect(game?.preferredOrientation).toBe('landscape');
        expect(game?.mobileLayoutPreset).toBe('board-shell');
        expect(game?.mobileBattlefieldZoom).toBe('none');
        expect(
            getGameMobileBannerKind(
                {
                    mobileProfile: game?.mobileProfile,
                    preferredOrientation: game?.preferredOrientation,
                    mobileLayoutPreset: game?.mobileLayoutPreset,
                },
                375,
                667,
            ),
        ).toBe('rotate-to-landscape');
    });

    it('summonerwars declares landscape board-shell support with board-shell scaling', () => {
        const game = getGameById('summonerwars');

        expect(game?.mobileProfile).toBe('landscape-adapted');
        expect(game?.preferredOrientation).toBe('landscape');
        expect(game?.mobileLayoutPreset).toBe('board-shell');
        expect(game?.mobileBattlefieldZoom).toBe('none');
        expect(
            shouldUseBoardShellScale(
                {
                    mobileProfile: game?.mobileProfile,
                    preferredOrientation: game?.preferredOrientation,
                    mobileLayoutPreset: game?.mobileLayoutPreset,
                },
                900,
                500,
            ),
        ).toBe(true);
    });
});

describe('mobile support helpers', () => {
    it('fills default orientation, layout preset and shell target', () => {
        expect(resolveGameMobileSupport({ mobileProfile: 'landscape-adapted' })).toEqual({
            mobileProfile: 'landscape-adapted',
            preferredOrientation: 'landscape',
            mobileLayoutPreset: 'board-shell',
            mobileBattlefieldZoom: 'none',
            shellTargets: ['pwa'],
            mobileDelivery: {
                mode: 'builtin',
            },
        });
    });

    it('does not infer package-managed delivery for entries outside app-webview targets', () => {
        expect(
            resolveGameMobileSupport({
                mobileProfile: 'landscape-adapted',
                shellTargets: ['pwa'],
                mobileDelivery: {
                    mode: 'package-managed',
                    runtimeChannel: 'beta',
                    modulePackId: 'demo',
                    assetPackId: 'demo',
                },
            }).mobileDelivery,
        ).toEqual({
            mode: 'builtin',
        });
    });

    it('保留 package-managed 的必须更新 App 元数据', () => {
        expect(
            resolveGameMobileSupport({
                mobileProfile: 'landscape-adapted',
                shellTargets: ['pwa', 'app-webview'],
                mobileDelivery: {
                    mode: 'package-managed',
                    runtimeChannel: 'stable',
                    modulePackId: 'demo',
                    assetPackId: 'demo',
                    requiresAppUpdate: true,
                    requiredAppVersion: '0.6.0',
                },
            }).mobileDelivery,
        ).toEqual({
            mode: 'package-managed',
            runtimeChannel: 'stable',
            modulePackId: 'demo',
            assetPackId: 'demo',
            requiresAppUpdate: true,
            requiredAppVersion: '0.6.0',
        });
    });

    it('builds banner state from profile and viewport', () => {
        expect(
            getGameMobileBannerKind(
                { mobileProfile: 'landscape-adapted', preferredOrientation: 'landscape' },
                800,
                1200,
            ),
        ).toBe('rotate-to-landscape');

        expect(
            getGameMobileBannerKind(
                { mobileProfile: 'portrait-adapted', preferredOrientation: 'portrait' },
                900,
                800,
            ),
        ).toBe('rotate-to-portrait');

        expect(getGameMobileBannerKind({ mobileProfile: 'tablet-only' }, 800, 1200)).toBe('tablet-only');
        expect(getGameMobileBannerKind({ mobileProfile: 'none' }, 800, 1200)).toBe('not-supported');
    });

    it('does not infer unsupported state before manifest metadata is ready', () => {
        expect(getGameMobileBannerKind(undefined, 800, 1200)).toBeNull();
        expect(getGamePageDataAttributes('dicethrone')).toEqual({
            'data-game-page': 'true',
            'data-game-id': 'dicethrone',
        });
    });

    it('builds data attributes for game pages', () => {
        const attrs = getGamePageDataAttributes('dicethrone', {
            mobileProfile: 'landscape-adapted',
            preferredOrientation: 'landscape',
            mobileLayoutPreset: 'board-shell',
            mobileBattlefieldZoom: 'shell-pinch-pan',
            shellTargets: ['pwa', 'app-webview'],
            mobileBoardShellLayout: {
                designWidth: 1160,
                designHeight: 720,
            },
        });

        expect(attrs['data-game-page']).toBe('true');
        expect(attrs['data-game-id']).toBe('dicethrone');
        expect(attrs['data-mobile-profile']).toBe('landscape-adapted');
        expect(attrs['data-preferred-orientation']).toBe('landscape');
        expect(attrs['data-mobile-layout-preset']).toBe('board-shell');
        expect(attrs['data-mobile-battlefield-zoom']).toBe('shell-pinch-pan');
        expect(attrs['data-shell-targets']).toBe('pwa,app-webview');
        expect(attrs['data-mobile-board-shell-design-width']).toBe('1160');
        expect(attrs['data-mobile-board-shell-design-height']).toBe('720');
    });

    it('mirrors game page attributes to html and body while the page is mounted', () => {
        document.documentElement.setAttribute('data-game-id', 'previous-root');
        document.body.setAttribute('data-mobile-profile', 'previous-body-profile');

        const cleanup = syncGamePageDocumentAttributes({
            'data-game-page': 'true',
            'data-game-id': 'dicethrone',
            'data-mobile-profile': 'landscape-adapted',
            'data-mobile-layout-preset': 'board-shell',
            'data-mobile-battlefield-zoom': 'game-owned',
        });

        expect(document.documentElement.getAttribute('data-game-page')).toBe('true');
        expect(document.documentElement.getAttribute('data-game-id')).toBe('dicethrone');
        expect(document.body.getAttribute('data-mobile-profile')).toBe('landscape-adapted');
        expect(document.body.getAttribute('data-mobile-layout-preset')).toBe('board-shell');
        expect(document.body.getAttribute('data-mobile-battlefield-zoom')).toBe('game-owned');

        cleanup();

        expect(document.documentElement.getAttribute('data-game-page')).toBeNull();
        expect(document.documentElement.getAttribute('data-game-id')).toBe('previous-root');
        expect(document.body.getAttribute('data-mobile-profile')).toBe('previous-body-profile');
        expect(document.body.getAttribute('data-mobile-layout-preset')).toBeNull();
        expect(document.body.getAttribute('data-mobile-battlefield-zoom')).toBeNull();
    });

    it('only landscape board-shell games enable legacy scale fallback', () => {
        expect(
            shouldUseBoardShellScale(
                { mobileProfile: 'landscape-adapted', mobileLayoutPreset: 'board-shell' },
                900,
                500,
            ),
        ).toBe(true);

        expect(
            shouldUseBoardShellScale(
                { mobileProfile: 'portrait-adapted', mobileLayoutPreset: 'portrait-simple' },
                900,
                500,
            ),
        ).toBe(false);
    });

    it('keeps the last stable viewport when orientation switching reports zero height', () => {
        expect(
            resolveStableViewportSize(
                MOBILE_REFERENCE_VIEWPORT,
                { width: 812, height: 0 },
                { width: 0, height: 0 },
            ),
        ).toEqual({ width: 812, height: 812 });
    });

    it('prefers the first usable viewport candidate and falls back per dimension', () => {
        expect(
            resolveStableViewportSize(
                MOBILE_REFERENCE_VIEWPORT,
                { width: 844, height: 390 },
                { width: 812, height: 375 },
                { width: 0, height: 0 },
            ),
        ).toEqual({ width: 844, height: 390 });

        expect(
            resolveStableViewportSize(
                MOBILE_REFERENCE_VIEWPORT,
                { width: undefined, height: 390 },
                { width: 844, height: undefined },
            ),
        ).toEqual({ width: 844, height: 390 });
    });
});
