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

const normalizeEmoteCatalog = (catalog: unknown): readonly EmoteDefinition[] => (
    Array.isArray(catalog) ? catalog : []
);

export const getEmoteById = (
    catalog: unknown,
    emoteId: string,
): EmoteDefinition | undefined => (
    normalizeEmoteCatalog(catalog).find((emote) => emote.id === emoteId && emote.enabled)
);

export const getAvailableEmotesForGame = (
    catalog: unknown,
    gameId?: string | null,
): EmoteDefinition[] => {
    const normalizedGameId = normalizeGameId(gameId);
    return normalizeEmoteCatalog(catalog).filter((emote) => {
        if (!emote.enabled) return false;
        if (emote.scope === 'common') return true;
        return normalizeGameId(emote.gameId) === normalizedGameId;
    });
};

export const isEmoteAllowedForGame = (
    catalog: unknown,
    emoteId: string,
    gameId?: string | null,
): boolean => (
    getAvailableEmotesForGame(catalog, gameId).some((emote) => emote.id === emoteId)
);
