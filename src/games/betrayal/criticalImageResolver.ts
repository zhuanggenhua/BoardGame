import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';
import type { BetrayalCore } from './game';

const BETRAYAL_CRITICAL_IMAGE_PATHS = [
    'betrayal/ui/title-banner',
    'betrayal/ui/trait-track-0-9',
    'betrayal/cards/player-reference-zh-front',
    'betrayal/cards/player-reference-zh-back',
    'betrayal/cards/back-omen',
    'betrayal/cards/back-item',
    'betrayal/cards/back-event',
    'betrayal/cards/back-traitor',
    'betrayal/rooms/trophy-room',
    'betrayal/rooms/sunroom',
    'betrayal/rooms/room-back-ground',
    'betrayal/rooms/room-back-basement',
];

export const betrayalCriticalImageResolver: CriticalImageResolver = (
    gameState: unknown,
    _locale?: string,
    playerID?: string | null,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<BetrayalCore> | undefined;
    const phase = state?.core?.phase ?? 'characterSelect';

    return {
        critical: BETRAYAL_CRITICAL_IMAGE_PATHS,
        warm: [],
        phaseKey: `betrayal:${phase}:${playerID ?? 'spectator'}`,
    };
};

export const _testExports = {
    BETRAYAL_CRITICAL_IMAGE_PATHS,
};

export default betrayalCriticalImageResolver;
