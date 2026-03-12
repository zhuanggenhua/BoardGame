import { describe, expect, it } from 'vitest';
import { getAllGames, getGameById } from '../../config/games.config';
import {
    getGameMobileBannerKind,
    getGamePageDataAttributes,
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

    it('summonerwars stays in tablet-only mode', () => {
        const game = getGameById('summonerwars');

        expect(game?.mobileProfile).toBe('tablet-only');
        expect(game?.preferredOrientation).toBe('landscape');
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
});
