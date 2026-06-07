import { describe, expect, it } from 'vitest';
import {
    getAvailableEmotesForGame,
    getEmoteById,
    isEmoteAllowedForGame,
} from '../emotes';

describe('emote catalog', () => {
    it('exposes the current shared emotes in every game picker', () => {
        const diceThroneEmotes = getAvailableEmotesForGame('dicethrone');
        const smashupEmotes = getAvailableEmotesForGame('smashup');

        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.speechless-facepalm');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.speechless-facepalm');
        expect(getEmoteById('dicethrone.moon-elf.speechless-facepalm')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.smug-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.smug-v1');
        expect(getEmoteById('dicethrone.moon-elf.smug-v1')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/smug-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.confused-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.confused-v1');
        expect(getEmoteById('dicethrone.moon-elf.confused-v1')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/confused-v2');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.barbarian.thumbs-up-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.barbarian.thumbs-up-v1');
        expect(getEmoteById('dicethrone.barbarian.thumbs-up-v1')?.assetPath)
            .toBe('dicethrone/emotes/barbarian/thumbs-up-v2');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('smashup.supreme-overlord.smug-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('smashup.supreme-overlord.smug-v1');
        expect(getEmoteById('smashup.supreme-overlord.smug-v1')?.assetPath)
            .toBe('smashup/emotes/supreme-overlord/smug-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('smashup.raider.angry-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('smashup.raider.angry-v1');
        expect(getEmoteById('smashup.raider.angry-v1')?.assetPath)
            .toBe('smashup/emotes/raider/angry-v1');
    });

    it('allows current shared emotes across games and still rejects unknown ids', () => {
        expect(isEmoteAllowedForGame('dicethrone.moon-elf.speechless-facepalm', 'smashup')).toBe(true);
        expect(isEmoteAllowedForGame('dicethrone.moon-elf.smug-v1', 'smashup')).toBe(true);
        expect(isEmoteAllowedForGame('dicethrone.moon-elf.confused-v1', 'smashup')).toBe(true);
        expect(isEmoteAllowedForGame('dicethrone.barbarian.thumbs-up-v1', 'smashup')).toBe(true);
        expect(isEmoteAllowedForGame('smashup.supreme-overlord.smug-v1', 'dicethrone')).toBe(true);
        expect(isEmoteAllowedForGame('smashup.raider.angry-v1', 'dicethrone')).toBe(true);
        expect(isEmoteAllowedForGame('unknown.emote', 'dicethrone')).toBe(false);
    });
});
