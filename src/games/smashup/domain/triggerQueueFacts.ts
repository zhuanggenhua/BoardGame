import type { SmashUpCore, SmashUpEvent, TriggerConsumedEvent, TriggerQueuedEvent } from './types';
import { SU_EVENTS } from './types';

export function applyTriggerQueueFactEvent(core: SmashUpCore, event: SmashUpEvent): SmashUpCore {
    if (event.type === SU_EVENTS.TRIGGER_QUEUED) {
        const { triggers } = (event as TriggerQueuedEvent).payload;
        if (!Array.isArray(triggers) || triggers.length === 0) return core;
        const prev = core.triggerQueue ?? [];
        const seenIds = new Set(prev.map(trigger => trigger.id));
        const deduped = triggers.filter(trigger => {
            if (!trigger?.id || seenIds.has(trigger.id)) return false;
            seenIds.add(trigger.id);
            return true;
        });
        if (deduped.length === 0) return core;
        return {
            ...core,
            triggerQueue: [...prev, ...deduped],
        };
    }

    if (event.type === SU_EVENTS.TRIGGER_CONSUMED) {
        const { triggerId } = (event as TriggerConsumedEvent).payload;
        const prev = core.triggerQueue ?? [];
        if (!triggerId || prev.length === 0) return core;
        const consumed = prev.find(trigger => trigger.id === triggerId);
        const next = prev.filter(trigger => {
            if (trigger.id === triggerId) return false;
            if (
                consumed?.sourceDefId === 'explorers_very_large_boulder'
                && consumed.timing === 'onMinionMoved'
                && consumed.sourceControllerId
            ) {
                return !(
                    trigger.sourceDefId === consumed.sourceDefId
                    && trigger.timing === consumed.timing
                    && trigger.sourceControllerId === consumed.sourceControllerId
                );
            }
            return true;
        });
        const consumedBoulder = (
            consumed?.sourceDefId === 'explorers_very_large_boulder'
            && consumed.timing === 'onMinionMoved'
            && consumed.sourceControllerId
        )
            ? (core.titans ?? []).find(titan =>
                titan.defId === 'explorers_very_large_boulder'
                && titan.controllerId === consumed.sourceControllerId
                && titan.location.zone === 'base',
            )
            : undefined;
        return {
            ...core,
            triggerQueue: next.length ? next : undefined,
            ...(consumedBoulder
                ? {
                    veryLargeBoulderTriggeredTurnByTitan: {
                        ...(core.veryLargeBoulderTriggeredTurnByTitan ?? {}),
                        [consumedBoulder.uid]: core.turnNumber,
                    },
                }
                : {}),
        };
    }

    return core;
}
