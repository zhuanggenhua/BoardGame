import type { CriticalImageResolver, CriticalImageResolverResult } from '../../core/types';
import {
    FANTASY_REALMS_CARD_ATLAS_COMPRESSED_PATH,
    FANTASY_REALMS_CARD_ATLAS_PATH,
    FANTASY_REALMS_CARD_BACK_PATH,
} from './ui/cardAtlas';

const FANTASY_REALMS_CRITICAL_IMAGE_PATHS = [
    FANTASY_REALMS_CARD_ATLAS_PATH,
    FANTASY_REALMS_CARD_ATLAS_COMPRESSED_PATH,
    FANTASY_REALMS_CARD_BACK_PATH,
];

export const fantasyRealmsCriticalImageResolver: CriticalImageResolver = (): CriticalImageResolverResult => ({
    critical: FANTASY_REALMS_CRITICAL_IMAGE_PATHS,
    warm: [],
    phaseKey: 'fantasyrealms:first-paint',
});

export default fantasyRealmsCriticalImageResolver;
