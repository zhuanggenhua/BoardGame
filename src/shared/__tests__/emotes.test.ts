import { describe, expect, it } from 'vitest';
import {
    getAvailableEmotesForGame,
    getEmoteById,
    isEmoteAllowedForGame,
} from '../emotes';

describe('emote catalog', () => {
    it('exposes the DiceThrone Moon Elf emote for DiceThrone matches', () => {
        const emotes = getAvailableEmotesForGame('dicethrone');

        expect(emotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.speechless-facepalm');
        expect(getEmoteById('dicethrone.moon-elf.speechless-facepalm')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1');
        expect(emotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.smug-v1');
        expect(getEmoteById('dicethrone.moon-elf.smug-v1')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/smug-v1');
    });

    it('rejects game-scoped emotes for other games and unknown ids', () => {
        expect(isEmoteAllowedForGame('dicethrone.moon-elf.speechless-facepalm', 'smashup')).toBe(false);
        expect(isEmoteAllowedForGame('dicethrone.moon-elf.smug-v1', 'smashup')).toBe(false);
        expect(isEmoteAllowedForGame('unknown.emote', 'dicethrone')).toBe(false);
    });
});
