import { MAGE_WARS_EVENTS } from './events';
import type { MageWarsCore, MageWarsEvent } from './types';
import { getArenaObject } from './utils';

export function createMageWarsArenaObjectSourceConsumeAvailableEvent(
    core: MageWarsCore,
    sourceObjectId: string,
    sourceCommandType: string,
    timestamp: number,
    sourceAbilityId: string,
): MageWarsEvent | undefined {
    const sourceObject = getArenaObject(core, sourceObjectId);
    if (!sourceObject) return undefined;

    return {
        type: MAGE_WARS_EVENTS.ARENA_OBJECT_SOURCE_CONSUME_AVAILABLE,
        payload: {
            sourceObjectId: sourceObject.id,
            sourceAbilityId,
        },
        sourceCommandType,
        timestamp,
    };
}

export function createMageWarsCounterstrikeSourceConsumeAvailableEvent(
    core: MageWarsCore,
    sourceObjectId: string,
    sourceCommandType: string,
    timestamp: number,
): MageWarsEvent | undefined {
    return createMageWarsArenaObjectSourceConsumeAvailableEvent(
        core,
        sourceObjectId,
        sourceCommandType,
        timestamp,
        'mw.enchantment.counterstrike.consume',
    );
}
