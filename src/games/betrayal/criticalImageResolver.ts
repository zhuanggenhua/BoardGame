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
    'betrayal/explorers/xia',
    'betrayal/explorers/anita-hernandez',
    'betrayal/explorers/father-warren-leung',
    'betrayal/explorers/dan-nguyen-md',
    'betrayal/explorers/michelle-monroe',
    'betrayal/explorers/beat-box-bowen',
    'betrayal/explorers/josef-hooper',
    'betrayal/explorers/oliver-swift',
    'betrayal/explorers/stephanie-richter',
    'betrayal/explorers/persephone-puleri',
    'betrayal/explorers/sammy-angler',
    'betrayal/explorers/jade-jones',
    'betrayal/tokens/explorers/isa-valencia',
    'betrayal/tokens/explorers/anita-hernandez',
    'betrayal/tokens/explorers/father-warren-leung',
    'betrayal/tokens/explorers/dan-nguyen-md',
    'betrayal/tokens/explorers/michelle-monroe',
    'betrayal/tokens/explorers/beat-box-bowen',
    'betrayal/tokens/explorers/josef-hooper',
    'betrayal/tokens/explorers/oliver-swift',
    'betrayal/tokens/explorers/stephanie-richter',
    'betrayal/tokens/explorers/persephone-puleri',
    'betrayal/tokens/explorers/sammy-angler',
    'betrayal/tokens/explorers/jaden-jones',
    'betrayal/tokens/monsters/werewolf',
    'betrayal/tokens/monsters/ghost',
    'betrayal/tokens/monsters/jacks-spirit',
    'betrayal/tokens/monsters/jacks-spirit-stunned',
    'betrayal/tokens/monsters/head-of-the-house',
    'betrayal/tokens/monsters/head-of-the-house-stunned',
    'betrayal/tokens/monsters/demon',
    'betrayal/tokens/monsters/demon-stunned',
    'betrayal/tokens/monsters/dark-queen',
    'betrayal/tokens/monsters/dark-queen-stunned',
    'betrayal/tokens/monsters/ghost-shark',
    'betrayal/tokens/monsters/ghost-shark-stunned',
    'betrayal/tokens/monsters/construct',
    'betrayal/tokens/monsters/construct-stunned',
    'betrayal/tokens/monsters/bakeneko',
    'betrayal/tokens/monsters/bakeneko-stunned',
    'betrayal/tokens/monsters/giant-wasp',
    'betrayal/tokens/monsters/giant-wasp-stunned',
    'betrayal/tokens/monsters/demon-dog',
    'betrayal/tokens/monsters/demon-dog-stunned',
    'betrayal/tokens/monsters/werewolf-stunned',
    'betrayal/tokens/monsters/vampire',
    'betrayal/tokens/monsters/vampire-stunned',
    'betrayal/tokens/monsters/faceless-man',
    'betrayal/tokens/monsters/faceless-man-stunned',
    'betrayal/tokens/monsters/ghost-stunned',
    'betrayal/tokens/monsters/troll-right-hand',
    'betrayal/tokens/monsters/troll-right-hand-stunned',
    'betrayal/tokens/monsters/giant-hair-monster',
    'betrayal/tokens/monsters/giant-hair-monster-stunned',
    'betrayal/tokens/monsters/troll-left-hand',
    'betrayal/tokens/monsters/large-monster-front',
    'betrayal/monsters/mummy',
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
