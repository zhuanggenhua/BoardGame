export type EmoteScope = 'common' | 'game';

export interface EmoteDefinition {
    id: string;
    scope: EmoteScope;
    gameId?: string;
    characterId?: string;
    emotion: string;
    label: string;
    assetPath: string;
    enabled: boolean;
}

const normalizeGameId = (gameId?: string | null): string | undefined => {
    const normalized = gameId?.trim().toLowerCase();
    return normalized || undefined;
};

export const EMOTE_CATALOG: readonly EmoteDefinition[] = [
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
        id: 'dicethrone.barbarian.thumbs-up-v1',
        scope: 'common',
        characterId: 'barbarian',
        emotion: 'thumbs-up',
        label: '点赞',
        assetPath: 'dicethrone/emotes/barbarian/thumbs-up-v1',
        enabled: true,
    },
] as const;

export const getEmoteById = (emoteId: string): EmoteDefinition | undefined => (
    EMOTE_CATALOG.find((emote) => emote.id === emoteId && emote.enabled)
);

export const getAvailableEmotesForGame = (gameId?: string | null): EmoteDefinition[] => {
    const normalizedGameId = normalizeGameId(gameId);
    return EMOTE_CATALOG.filter((emote) => {
        if (!emote.enabled) return false;
        if (emote.scope === 'common') return true;
        return normalizeGameId(emote.gameId) === normalizedGameId;
    });
};

export const isEmoteAllowedForGame = (emoteId: string, gameId?: string | null): boolean => (
    getAvailableEmotesForGame(gameId).some((emote) => emote.id === emoteId)
);
