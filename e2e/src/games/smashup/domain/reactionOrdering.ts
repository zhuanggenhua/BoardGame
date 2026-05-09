import { getBaseDef } from '../data/cards';
import type { ReactionOrderingAtom, TriggerEffectContract, TriggerInstance } from './types';

interface MaterializedTriggerEffectContract {
    reads: string[];
    writes: string[];
    opensInteraction: boolean;
}

function overlap(left: string[], right: string[]): boolean {
    return left.some(key => right.includes(key));
}

function resolveOwnerScope(trigger: TriggerInstance): string {
    return trigger.sourceControllerId
        ?? trigger.ownerPlayerId
        ?? 'global';
}

function resolveSourceSelfScope(trigger: TriggerInstance): string {
    if (trigger.sourceCardUid) {
        return `source-card:${trigger.sourceCardUid}`;
    }
    if (typeof trigger.sourceBaseIndex === 'number' && getBaseDef(trigger.sourceDefId)) {
        return `source-base:${trigger.sourceBaseIndex}:${trigger.sourceDefId}`;
    }
    if (trigger.frameId) {
        return `source-trigger:${trigger.frameId}:${trigger.id}`;
    }
    return `source-trigger:${trigger.id}`;
}

function resolveTriggerMinionScope(trigger: TriggerInstance): string {
    if (trigger.triggerMinionUid) {
        return `trigger-minion:${trigger.triggerMinionUid}`;
    }
    if (trigger.triggerMinionDefId) {
        return `trigger-minion-def:${trigger.triggerMinionDefId}`;
    }
    return 'trigger-minion:unknown';
}

function resolveBaseScope(trigger: TriggerInstance): string {
    const baseIndex = trigger.baseIndex
        ?? trigger.sourceBaseIndex
        ?? trigger.actionTargetBaseIndex;
    return typeof baseIndex === 'number'
        ? `base:${baseIndex}`
        : 'base:global';
}

function materializeReactionOrderingAtom(
    atom: ReactionOrderingAtom,
    trigger: TriggerInstance,
): string {
    switch (atom) {
        case 'sourceSelfState':
            return resolveSourceSelfScope(trigger);
        case 'triggerMinionState':
            return resolveTriggerMinionScope(trigger);
        case 'triggerMinionPower':
            return `${resolveTriggerMinionScope(trigger)}:power`;
        case 'playLimits':
        case 'handState':
        case 'deckState':
        case 'madnessDeckState':
        case 'discardState':
        case 'vpState':
        case 'controllerState':
        case 'turnFlags':
            return `${atom}:${resolveOwnerScope(trigger)}`;
        case 'baseState':
            return `${atom}:${resolveBaseScope(trigger)}`;
        case 'minionBoardState':
        case 'titanBoardState':
        case 'baseDeckState':
        case 'scoringState':
        case 'targetAvailability':
            return atom;
        default: {
            const exhaustiveCheck: never = atom;
            return exhaustiveCheck;
        }
    }
}

function materializeTriggerEffectContract(
    trigger: TriggerInstance,
    footprint: TriggerEffectContract | undefined,
): MaterializedTriggerEffectContract | undefined {
    if (!footprint) return undefined;
    const normalizedFootprint = normalizePersistedTriggerEffectContract(trigger, footprint);
    return {
        reads: (normalizedFootprint.reads ?? []).map(atom => materializeReactionOrderingAtom(atom, trigger)),
        writes: (normalizedFootprint.writes ?? []).map(atom => materializeReactionOrderingAtom(atom, trigger)),
        opensInteraction: normalizedFootprint.opensInteraction ?? false,
    };
}

function normalizePersistedTriggerEffectContract(
    trigger: TriggerInstance,
    footprint: TriggerEffectContract,
): TriggerEffectContract {
    const isLegacyFirstMinionBaseTrigger = (
        trigger.timing === 'onMinionPlayed'
        && (trigger.sourceDefId === 'base_laboratorium' || trigger.sourceDefId === 'base_moot_site')
        && (footprint.writes ?? []).includes('triggerMinionPower')
        && (footprint.reads ?? []).includes('playLimits')
    );
    if (!isLegacyFirstMinionBaseTrigger) return footprint;

    return {
        ...footprint,
        reads: (footprint.reads ?? []).filter(atom => atom !== 'playLimits'),
    };
}

export function areReactionOrderingTriggersConflicting(
    left: TriggerInstance,
    right: TriggerInstance,
): boolean {
    const leftFootprint = materializeTriggerEffectContract(left, left.effectContract);
    const rightFootprint = materializeTriggerEffectContract(right, right.effectContract);

    if (!leftFootprint || !rightFootprint) {
        return true;
    }

    return overlap(leftFootprint.writes, [...rightFootprint.reads, ...rightFootprint.writes])
        || overlap(rightFootprint.writes, [...leftFootprint.reads, ...leftFootprint.writes]);
}

export function partitionMandatoryReactionOrderingComponents(
    triggers: TriggerInstance[],
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
                if (!areReactionOrderingTriggersConflicting(triggers[index], triggers[next])) continue;
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
