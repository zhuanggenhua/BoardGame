import type { MatchState } from '../../engine/types';
import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import { SPLENDOR_ASSETS, SPLENDOR_DECK_IMAGE_BY_TIER, SPLENDOR_TOKEN_IMAGE_BY_COLOR } from './assets';
import type { SplendorCore } from './domain';
import { SPLENDOR_SPRITE_ATLASES } from './spriteMapping';

const dedupePreserveOrder = (paths: string[]): string[] => [...new Set(paths.filter(Boolean))];

const SPLENDOR_CRITICAL_IMAGE_PATHS = dedupePreserveOrder([
    SPLENDOR_ASSETS.BOARD_DESK,
    SPLENDOR_ASSETS.THUMBNAIL,
    ...Object.values(SPLENDOR_TOKEN_IMAGE_BY_COLOR),
    ...Object.values(SPLENDOR_DECK_IMAGE_BY_TIER),
    ...SPLENDOR_SPRITE_ATLASES.map((atlas) => atlas.imagePath),
]);

export const splendorCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<SplendorCore> | undefined;
    const hostStarted = state?.core?.hostStarted === true;
    return {
        critical: SPLENDOR_CRITICAL_IMAGE_PATHS,
        warm: [],
        phaseKey: `splendor:${hostStarted ? 'playing' : 'pregame'}:${playerID ?? 'spectator'}`,
    };
};

export const _testExports = {
    SPLENDOR_CRITICAL_IMAGE_PATHS,
};

export default splendorCriticalImageResolver;
