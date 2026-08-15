import {
    getAvailableEmotesForGame,
    getEmoteById,
    isEmoteAllowedForGame,
    type EmoteDefinition,
} from '../shared/emotes';

export const GAME_EMOTE_CATALOG: readonly EmoteDefinition[] = [
    {
        id: 'dicethrone.moon-elf.speechless-facepalm',
        scope: 'common',
        characterId: 'moon-elf',
        emotion: 'speechless',
        label: '无语',
        assetPath: 'dicethrone/emotes/moon-elf/speechless-facepalm-chibi-v1',
        enabled: true,
    },
    {
        id: 'dicethrone.moon-elf.smug-v1',
        scope: 'common',
        characterId: 'moon-elf',
        emotion: 'smug',
        label: '得意',
        assetPath: 'dicethrone/emotes/moon-elf/smug-v1',
        enabled: true,
    },
    {
        id: 'dicethrone.moon-elf.confused-v1',
        scope: 'common',
        characterId: 'moon-elf',
        emotion: 'confused',
        label: '疑惑',
        assetPath: 'dicethrone/emotes/moon-elf/confused-v2',
        enabled: true,
    },
    {
        id: 'dicethrone.barbarian.thumbs-up-v1',
        scope: 'common',
        characterId: 'barbarian',
        emotion: 'thumbs-up',
        label: '点赞',
        assetPath: 'dicethrone/emotes/barbarian/thumbs-up-v2',
        enabled: true,
    },
    {
        id: 'smashup.supreme-overlord.smug-v1',
        scope: 'common',
        gameId: 'smashup',
        characterId: 'supreme-overlord',
        emotion: 'smug',
        label: '得意',
        assetPath: 'smashup/emotes/supreme-overlord/smug-v1',
        enabled: true,
    },
    {
        id: 'smashup.raider.angry-v1',
        scope: 'common',
        gameId: 'smashup',
        characterId: 'raider',
        emotion: 'angry',
        label: '生气',
        assetPath: 'smashup/emotes/raider/angry-v1',
        enabled: true,
    },
] as const;

export const getGameEmoteById = (emoteId: string): EmoteDefinition | undefined => (
    getEmoteById(GAME_EMOTE_CATALOG, emoteId)
);

export const getAvailableGameEmotes = (gameId?: string | null): EmoteDefinition[] => (
    getAvailableEmotesForGame(GAME_EMOTE_CATALOG, gameId)
);

export const isGameEmoteAllowed = (emoteId: string, gameId?: string | null): boolean => (
    isEmoteAllowedForGame(GAME_EMOTE_CATALOG, emoteId, gameId)
);
