import { describe, expect, it } from 'vitest';
import {
    getAvailableGameEmotes,
    getGameEmoteById,
    isGameEmoteAllowed,
} from '../emotes';

describe('game emote catalog', () => {
    it('exposes the current shared emotes in every game picker', () => {
        const diceThroneEmotes = getAvailableGameEmotes('dicethrone');
        const smashupEmotes = getAvailableGameEmotes('smashup');

        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.speechless-facepalm');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.speechless-facepalm');
        expect(getGameEmoteById('dicethrone.moon-elf.speechless-facepalm')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.smug-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.smug-v1');
        expect(getGameEmoteById('dicethrone.moon-elf.smug-v1')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/smug-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.confused-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.moon-elf.confused-v1');
        expect(getGameEmoteById('dicethrone.moon-elf.confused-v1')?.assetPath)
            .toBe('dicethrone/emotes/moon-elf/confused-v2');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('dicethrone.barbarian.thumbs-up-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('dicethrone.barbarian.thumbs-up-v1');
        expect(getGameEmoteById('dicethrone.barbarian.thumbs-up-v1')?.assetPath)
            .toBe('dicethrone/emotes/barbarian/thumbs-up-v2');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('smashup.supreme-overlord.smug-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('smashup.supreme-overlord.smug-v1');
        expect(getGameEmoteById('smashup.supreme-overlord.smug-v1')?.assetPath)
            .toBe('smashup/emotes/supreme-overlord/smug-v1');
        expect(diceThroneEmotes.map((emote) => emote.id)).toContain('smashup.raider.angry-v1');
        expect(smashupEmotes.map((emote) => emote.id)).toContain('smashup.raider.angry-v1');
        expect(getGameEmoteById('smashup.raider.angry-v1')?.assetPath)
            .toBe('smashup/emotes/raider/angry-v1');
    });

    it('allows current shared emotes across games and still rejects unknown ids', () => {
        expect(isGameEmoteAllowed('dicethrone.moon-elf.speechless-facepalm', 'smashup')).toBe(true);
        expect(isGameEmoteAllowed('dicethrone.moon-elf.smug-v1', 'smashup')).toBe(true);
        expect(isGameEmoteAllowed('dicethrone.moon-elf.confused-v1', 'smashup')).toBe(true);
        expect(isGameEmoteAllowed('dicethrone.barbarian.thumbs-up-v1', 'smashup')).toBe(true);
        expect(isGameEmoteAllowed('smashup.supreme-overlord.smug-v1', 'dicethrone')).toBe(true);
        expect(isGameEmoteAllowed('smashup.raider.angry-v1', 'dicethrone')).toBe(true);
        expect(isGameEmoteAllowed('unknown.emote', 'dicethrone')).toBe(false);
    });
});
