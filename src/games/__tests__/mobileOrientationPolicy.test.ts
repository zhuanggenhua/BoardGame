/* @vitest-environment happy-dom */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllGames } from '../../config/games.config';
import { resolveGameMobileSupport } from '../../shared/mobileSupport';

describe('mobile orientation policy', () => {
    it('all enabled games use landscape except tictactoe and match the Android orientation map', () => {
        const games = getAllGames().filter((game) => game.type === 'game');
        const androidOrientationMap = JSON.parse(
            readFileSync('android/app/src/main/assets/game-orientation-map.json', 'utf8'),
        ) as Record<string, string>;

        expect(
            games
                .filter(
                    (game) =>
                        resolveGameMobileSupport(game).preferredOrientation === 'portrait',
                )
                .map((game) => game.id),
        ).toEqual(['tictactoe']);

        for (const game of games) {
            const expectedOrientation = game.id === 'tictactoe' ? 'portrait' : 'landscape';
            expect(resolveGameMobileSupport(game).preferredOrientation).toBe(
                expectedOrientation,
            );
            expect(androidOrientationMap[game.id]).toBe(expectedOrientation);
        }
    });
});
