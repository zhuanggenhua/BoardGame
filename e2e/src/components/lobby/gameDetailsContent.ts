import type { GameManifestEntry } from '../../games/manifest.types';

export interface GameChangelogItem {
    id: string;
    gameId: string;
    title: string;
    versionLabel?: string | null;
    content: string;
    published: boolean;
    pinned: boolean;
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export const DEFAULT_AUTHOR_NAME = '佚名';

type LobbyTextResolver = (key: string, options?: { defaultValue?: string }) => string;

const GAME_MANIFEST_KEY_PREFIX = 'games.';

function resolveGameManifestText(
    value: string | undefined,
    t: LobbyTextResolver,
    fallback = '',
) {
    const normalized = value?.trim();
    if (!normalized) return fallback;
    if (!normalized.startsWith(GAME_MANIFEST_KEY_PREFIX)) {
        return normalized;
    }
    return t(normalized, { defaultValue: fallback });
}

export const resolveGameAuthorName = (
    manifest?: Pick<GameManifestEntry, 'authorName'> | null,
    fallback = DEFAULT_AUTHOR_NAME,
) => {
    const normalized = manifest?.authorName?.trim();
    return normalized || fallback;
};

export const resolveGameDisplayName = (
    manifest: Pick<GameManifestEntry, 'id' | 'titleKey'> | null | undefined,
    t: LobbyTextResolver,
    fallback?: string,
) => resolveGameManifestText(manifest?.titleKey, t, fallback ?? manifest?.id ?? '');

export const resolveGameDescription = (
    manifest: Pick<GameManifestEntry, 'descriptionKey'> | null | undefined,
    t: LobbyTextResolver,
    fallback = '',
) => resolveGameManifestText(manifest?.descriptionKey, t, fallback);
