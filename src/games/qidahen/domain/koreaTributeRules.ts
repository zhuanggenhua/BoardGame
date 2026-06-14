import { hasActiveCharacter } from './characterPresenceAccessors';
import { resolveQidahenRuleRegionConfig } from './regionConfig';
import type { QidahenCore, QidahenFactionId } from './types';

export const getEffectiveKoreaTributeCardsForFaction = (
    state: QidahenCore,
    factionId: QidahenFactionId,
    regionId: string,
): number => {
    const baseTributeCards = resolveQidahenRuleRegionConfig(regionId).tributeCards;
    if (baseTributeCards <= 0) {
        return 0;
    }
    return factionId === 'jin' && hasActiveCharacter(state, 'jin', 'jin-amin')
        ? baseTributeCards + 1
        : baseTributeCards;
};
