import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';
import type { BetrayalCore } from './game';
import { EVENT_FRONT_ATLAS_IMAGE_PATHS } from './discoveryAtlas';
import { BETRAYAL_POSSESSION_ATLAS_IMAGE_PATHS } from './possessionAtlas';
import { BETRAYAL_ROOM_ATLAS_IMAGE_PATHS } from './roomAtlas';

const BETRAYAL_CRITICAL_IMAGE_PATHS = [
    'betrayal/ui/title-banner',
    'betrayal/ui/trait-track-0-9',
    'betrayal/cards/player-reference-zh-front',
    'betrayal/cards/player-reference-zh-back',
    'betrayal/cards/traitor-reference-zh',
    'betrayal/cards/monster-reference-zh',
    'betrayal/cards/back-omen',
    'betrayal/cards/back-item',
    'betrayal/cards/back-event',
    'betrayal/cards/back-traitor',
    'betrayal/tokens/explorers/jaden-jones',
    'betrayal/tokens/explorers/father-warren-leung',
    'betrayal/tokens/explorers/rebecca-allen',
    'betrayal/tokens/explorers/darryl-highla',
    'betrayal/tokens/monsters/werewolf',
    'betrayal/tokens/monsters/ghost',
    'betrayal/tokens/monsters/small-monster-1-front',
    'betrayal/tokens/monsters/small-monster-2-front',
    'betrayal/tokens/monsters/small-monster-3-front',
    'betrayal/tokens/monsters/small-monster-4-front',
    'betrayal/tokens/monsters/small-monster-5-front',
    'betrayal/tokens/monsters/small-monster-6-front',
    ...BETRAYAL_POSSESSION_ATLAS_IMAGE_PATHS,
    ...EVENT_FRONT_ATLAS_IMAGE_PATHS,
    ...BETRAYAL_ROOM_ATLAS_IMAGE_PATHS,
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
