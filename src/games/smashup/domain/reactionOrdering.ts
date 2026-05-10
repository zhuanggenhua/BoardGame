import type { MatchState, RandomFn } from '../../../engine/types';
import {
    deriveFootprintFromTriggerProbe,
    explicitFallbackFootprintFromTrigger,
    recordReactionFootprintFallback,
    resourceFootprintsConflict,
} from './reactionResources';
import type { SmashUpCore, SmashUpReactionResourceFootprint, TriggerInstance } from './types';

function resolveTriggerFootprint(
    trigger: TriggerInstance,
    state?: MatchState<SmashUpCore>,
    random?: RandomFn,
    now?: number,
): SmashUpReactionResourceFootprint | undefined {
    if (trigger.derivedFootprint) return trigger.derivedFootprint;
    if (state && random && typeof now === 'number') {
        const derived = deriveFootprintFromTriggerProbe(state, trigger, random, now);
        const explicitFallback = explicitFallbackFootprintFromTrigger(trigger);
        if (explicitFallback && !derived.fallbackReason) {
            recordReactionFootprintFallback(trigger, explicitFallback.fallbackReason);
            trigger.derivedFootprint = {
                reads: [...derived.reads, ...explicitFallback.reads],
                writes: [...derived.writes, ...explicitFallback.writes],
                opensInteraction: derived.opensInteraction || explicitFallback.opensInteraction,
                fallbackReason: explicitFallback.fallbackReason,
            };
            return trigger.derivedFootprint;
        }
        if (!derived.fallbackReason) {
            trigger.derivedFootprint = derived;
            return trigger.derivedFootprint;
        }
        recordReactionFootprintFallback(trigger, derived.fallbackReason);
        trigger.derivedFootprint = explicitFallback
            ? {
                reads: explicitFallback.reads,
                writes: explicitFallback.writes,
                opensInteraction: explicitFallback.opensInteraction || derived.opensInteraction,
                fallbackReason: explicitFallback.fallbackReason,
            }
            : derived;
        return trigger.derivedFootprint;
    }
    return explicitFallbackFootprintFromTrigger(trigger);
}

export function areReactionOrderingTriggersConflicting(
    left: TriggerInstance,
    right: TriggerInstance,
    state?: MatchState<SmashUpCore>,
    random?: RandomFn,
    now?: number,
): boolean {
    const leftFootprint = resolveTriggerFootprint(left, state, random, now);
    const rightFootprint = resolveTriggerFootprint(right, state, random, now);

    if (!leftFootprint || !rightFootprint) {
        return true;
    }

    return resourceFootprintsConflict(leftFootprint, rightFootprint);
}

export function partitionMandatoryReactionOrderingComponents(
    triggers: TriggerInstance[],
    state?: MatchState<SmashUpCore>,
    random?: RandomFn,
    now?: number,
): TriggerInstance[][] {
    if (triggers.length <= 1) {
        return triggers.length === 0 ? [] : [triggers];
    }

    const visited = new Array(triggers.length).fill(false);
    const components: Array<{ indices: number[]; triggers: TriggerInstance[] }> = [];

    for (let start = 0; start < triggers.length; start++) {
        if (visited[start]) continue;

        const stack = [start];
        visited[start] = true;
        const indices: number[] = [];

        while (stack.length > 0) {
            const index = stack.pop()!;
            indices.push(index);

            for (let next = 0; next < triggers.length; next++) {
                if (visited[next]) continue;
                if (!areReactionOrderingTriggersConflicting(triggers[index], triggers[next], state, random, now)) continue;
                visited[next] = true;
                stack.push(next);
            }
        }

        indices.sort((left, right) => left - right);
        components.push({
            indices,
            triggers: indices.map(index => triggers[index]),
        });
    }

    components.sort((left, right) => left.indices[0] - right.indices[0]);
    return components.map(component => component.triggers);
}
