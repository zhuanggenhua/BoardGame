import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import type { MatchState } from '../../engine/types';
import type { MageWarsCore } from './domain/types';
import {
    MAGE_WARS_MAGES_ATLAS_IMAGE_PATH,
    MAGE_WARS_SPELL_ATLAS_IMAGE_PATHS,
} from './ui/cardAtlas';

const MAGE_WARS_COMMON_CRITICAL_IMAGES = [
    'mage-wars/board/standard-arena',
    'mage-wars/boards/mage-status/mage-status-board',
    MAGE_WARS_MAGES_ATLAS_IMAGE_PATH,
    'mage-wars/cards/backs/spell-card-back',
    'mage-wars/dice/attack-die-texture',
    'mage-wars/tokens/action/ready-token-front',
    'mage-wars/tokens/action/ready-token-back',
    'mage-wars/tokens/quickcast/quickcast-marker-front',
    'mage-wars/tokens/damage/damage-token-front',
    'mage-wars/tokens/channeling/channeling-token-front',
] as const;

const MAGE_WARS_INITIAL_SPELLBOOK_CRITICAL_IMAGES = [
    'mage-wars/cards/spells/spell-equipment-core-atlas',
] as const;

const MAGE_WARS_WARM_IMAGES = [
    ...MAGE_WARS_SPELL_ATLAS_IMAGE_PATHS,
    'mage-wars/cards/backs/wall-card-back',
    'mage-wars/tokens/status/burn-token',
    'mage-wars/tokens/status/daze-token',
    'mage-wars/tokens/status/guard-token',
    'mage-wars/tokens/status/rot-token',
    'mage-wars/tokens/status/sleep-token',
    'mage-wars/tokens/status/stun-token',
] as const;

export const mageWarsCriticalImageResolver: CriticalImageResolver = (
    gameState,
): CriticalImageResolverResult => {
    const state = gameState as MatchState<MageWarsCore> | undefined;
    const phase = state?.sys?.phase ?? 'foundation';

    return {
        critical: [
            ...MAGE_WARS_COMMON_CRITICAL_IMAGES,
            ...MAGE_WARS_INITIAL_SPELLBOOK_CRITICAL_IMAGES,
        ],
        warm: [...MAGE_WARS_WARM_IMAGES],
        phaseKey: `mage-wars:${phase}`,
    };
};

export default mageWarsCriticalImageResolver;
