import { describe, expect, it } from 'vitest';
import { getAllGames, getGameById } from '../../config/games.config';
import {
    getGameMobileBannerKind,
    getGamePageDataAttributes,
    resolveStableViewportSize,
    resolveGameMobileSupport,
    shouldUseBoardShellScale,
} from '../mobileSupport';

describe('mobile support manifest contract', () => {
    it('all enabled entries expose explicit mobileProfile and shellTargets', () => {
        const games = getAllGames();

        expect(games.length).toBeGreaterThan(0);
        for (const game of games) {
            expect(game.mobileProfile).toBeDefined();
            expect(game.shellTargets?.length ?? 0).toBeGreaterThan(0);
        }
    });

    it('dicethrone declares landscape board-shell support and container targets', () => {
        const game = getGameById('dicethrone');

        expect(game?.mobileProfile).toBe('landscape-adapted');
        expect(game?.preferredOrientation).toBe('landscape');
        expect(game?.mobileLayoutPreset).toBe('board-shell');
        expect(game?.shellTargets).toEqual(
            expect.arrayContaining(['pwa', 'app-webview', 'mini-program-webview']),
        );
    });

    it('cardia declares landscape board-shell support', () => {
        const game = getGameById('cardia');

        expect(game?.mobileProfile).toBe('landscape-adapted');
        expect(game?.preferredOrientation).toBe('landscape');
        expect(game?.mobileLayoutPreset).toBe('board-shell');
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
            shellTargets: ['pwa'],
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
            shellTargets: ['pwa', 'app-webview'],
        });

        expect(attrs['data-game-page']).toBe('true');
        expect(attrs['data-game-id']).toBe('dicethrone');
        expect(attrs['data-mobile-profile']).toBe('landscape-adapted');
        expect(attrs['data-preferred-orientation']).toBe('landscape');
        expect(attrs['data-mobile-layout-preset']).toBe('board-shell');
        expect(attrs['data-shell-targets']).toBe('pwa,app-webview');
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
                { width: 375, height: 812 },
                { width: 812, height: 0 },
                { width: 0, height: 0 },
            ),
        ).toEqual({ width: 812, height: 812 });
    });

    it('prefers the first usable viewport candidate and falls back per dimension', () => {
        expect(
            resolveStableViewportSize(
                { width: 375, height: 812 },
                { width: 844, height: 390 },
                { width: 812, height: 375 },
                { width: 0, height: 0 },
            ),
        ).toEqual({ width: 844, height: 390 });

        expect(
            resolveStableViewportSize(
                { width: 375, height: 812 },
                { width: undefined, height: 390 },
                { width: 844, height: undefined },
            ),
        ).toEqual({ width: 844, height: 390 });
    });
});
