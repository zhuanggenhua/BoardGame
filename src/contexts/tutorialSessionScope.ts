import type { TutorialManifest } from '../engine/types';

export interface TutorialSessionScope {
    key: string;
    gameId: string | null;
    tutorialId: string | null;
    manifestId: string;
    manifestRevision: number | null;
}

type TutorialSessionScopeInput = {
    gameId?: string | null;
    tutorialId?: string | null;
    manifest?: TutorialManifest | null;
    manifestId?: string | null;
    manifestRevision?: number | null;
};

const normalizeScopePart = (value: string | null | undefined): string | null => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const encodeScopePart = (value: string | null) => encodeURIComponent(value ?? '');

export const buildTutorialSessionScope = ({
    gameId,
    tutorialId,
    manifest,
    manifestId,
    manifestRevision,
}: TutorialSessionScopeInput): TutorialSessionScope | null => {
    const resolvedManifestId = normalizeScopePart(manifest?.id ?? manifestId);
    if (!resolvedManifestId) return null;

    const resolvedGameId = normalizeScopePart(gameId);
    const resolvedTutorialId = normalizeScopePart(tutorialId) ?? resolvedManifestId;
    const resolvedRevision = Number.isInteger(manifest?.revision)
        ? manifest?.revision ?? null
        : (Number.isInteger(manifestRevision) ? manifestRevision ?? null : null);
    const keyParts = [
        'tutorial-session:v1',
        encodeScopePart(resolvedGameId),
        encodeScopePart(resolvedTutorialId),
        encodeScopePart(resolvedManifestId),
    ];
    if (resolvedRevision !== null) {
        keyParts.push(`r${resolvedRevision}`);
    }

    return {
        key: keyParts.join(':'),
        gameId: resolvedGameId,
        tutorialId: resolvedTutorialId,
        manifestId: resolvedManifestId,
        manifestRevision: resolvedRevision,
    };
};

export const isSameTutorialSessionScope = (
    left: TutorialSessionScope | null | undefined,
    right: TutorialSessionScope | null | undefined,
): boolean => Boolean(left && right && left.key === right.key);
