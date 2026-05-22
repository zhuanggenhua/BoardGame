const HOME_V2_REFERENCE_THUMBNAIL_BASE = '/assets/common/images/home-v2/reference-thumbnails';

const HOME_V2_REFERENCE_THUMBNAIL_IDS = new Set([
    'cardia',
    'dicethrone',
    'smashup',
    'splendor',
    'summonerwars',
]);

export function getHomeV2ReferenceThumbnailSrc(gameId: string) {
    const normalizedId = gameId.trim().toLowerCase();
    if (!HOME_V2_REFERENCE_THUMBNAIL_IDS.has(normalizedId)) {
        return undefined;
    }
    return `${HOME_V2_REFERENCE_THUMBNAIL_BASE}/${normalizedId}.png`;
}
