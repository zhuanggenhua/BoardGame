import {
    BETRAYAL_DISCOVERY_POOLS,
    BETRAYAL_SHARED_PRE_HAUNT_SETUP,
    isBetrayalEventRuntimeSupported,
    type BetrayalDeckKind,
} from './scenarioConfig';

export const BETRAYAL_INITIAL_DECK_COUNTS: Record<BetrayalDeckKind, number> = {
    ...BETRAYAL_SHARED_PRE_HAUNT_SETUP.initialDeckCounts,
    event: BETRAYAL_DISCOVERY_POOLS.events.filter(isBetrayalEventRuntimeSupported).length,
};
