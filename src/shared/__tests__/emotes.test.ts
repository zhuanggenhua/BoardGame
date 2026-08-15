import { describe, expect, it } from 'vitest';
import {
    getAvailableEmotesForGame,
    getEmoteById,
    isEmoteAllowedForGame,
    type EmoteDefinition,
} from '../emotes';

const catalog: readonly EmoteDefinition[] = [
    {
        id: 'common.wave',
        scope: 'common',
        emotion: 'wave',
        label: '招手',
        assetPath: 'common/emotes/wave',
        enabled: true,
    },
    {
        id: 'game-alpha.cheer',
        scope: 'game',
        gameId: 'game-alpha',
        emotion: 'cheer',
        label: '欢呼',
        assetPath: 'game-alpha/emotes/cheer',
        enabled: true,
    },
    {
        id: 'game-beta.disabled',
        scope: 'game',
        gameId: 'game-beta',
        emotion: 'sleep',
        label: '休眠',
        assetPath: 'game-beta/emotes/disabled',
        enabled: false,
    },
];

describe('emote helpers', () => {
    it('filters enabled common and matching game emotes from an injected catalog', () => {
        const gameAlphaEmotes = getAvailableEmotesForGame(catalog, 'GAME-ALPHA');
        const gameBetaEmotes = getAvailableEmotesForGame(catalog, 'game-beta');

        expect(gameAlphaEmotes.map((emote) => emote.id)).toEqual([
            'common.wave',
            'game-alpha.cheer',
        ]);
        expect(gameBetaEmotes.map((emote) => emote.id)).toEqual(['common.wave']);
    });

    it('resolves enabled emotes and rejects disabled or unknown ids', () => {
        expect(getEmoteById(catalog, 'common.wave')?.assetPath).toBe('common/emotes/wave');
        expect(getEmoteById(catalog, 'game-beta.disabled')).toBeUndefined();
        expect(isEmoteAllowedForGame(catalog, 'game-alpha.cheer', 'game-alpha')).toBe(true);
        expect(isEmoteAllowedForGame(catalog, 'game-alpha.cheer', 'game-beta')).toBe(false);
        expect(isEmoteAllowedForGame(catalog, 'missing', 'game-alpha')).toBe(false);
    });

    it('treats invalid injected catalogs as empty instead of crashing the HUD', () => {
        expect(getAvailableEmotesForGame({} as unknown as readonly EmoteDefinition[], 'game-alpha')).toEqual([]);
        expect(getEmoteById({} as unknown as readonly EmoteDefinition[], 'common.wave')).toBeUndefined();
        expect(isEmoteAllowedForGame({} as unknown as readonly EmoteDefinition[], 'common.wave', 'game-alpha')).toBe(false);
    });
});
