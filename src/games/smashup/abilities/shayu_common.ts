import type { MatchState, PlayerId } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import type { AbilityResult } from '../domain/abilityRegistry';
import type { TriggerEffectContract, SmashUpCore, SmashUpEvent, MinionOnBase } from '../domain/types';
import type { TriggerResult } from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { getMinionPower } from '../domain/abilityHelpers';

export const SHAYU_TRIGGER_CONTRACT: TriggerEffectContract = {
    reads: [
        'playLimits', 'triggerMinionPower', 'minionBoardState', 'titanBoardState',
        'baseDeckState', 'handState', 'deckState', 'madnessDeckState', 'discardState',
        'vpState', 'triggerMinionState', 'sourceSelfState', 'baseState', 'controllerState',
        'scoringState', 'targetAvailability', 'turnFlags',
    ],
    writes: [
        'playLimits', 'triggerMinionPower', 'minionBoardState', 'titanBoardState',
        'baseDeckState', 'handState', 'deckState', 'madnessDeckState', 'discardState',
        'vpState', 'triggerMinionState', 'sourceSelfState', 'baseState', 'controllerState',
        'scoringState', 'targetAvailability', 'turnFlags',
    ],
    opensInteraction: true,
};

export type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
    __cancel__?: boolean;
};

export type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
    skip?: boolean;
    __cancel__?: boolean;
};

export type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: string;
    skip?: boolean;
    __cancel__?: boolean;
};

export type ButtonChoice<T extends string = string> = {
    choice?: T;
    skip?: boolean;
    __cancel__?: boolean;
};

export type PromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

export type MinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

export type BaseTarget = {
    baseIndex: number;
    label: string;
};

export type RenderableCardChoiceValue =
    | { defId: string }
    | { minionDefId: string }
    | { baseDefId: string };

export function runtimeToAbilityResult(
    result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> },
): AbilityResult {
    return result.matchState ? { events: result.events, matchState: result.matchState } : { events: result.events };
}

export function runtimeToTriggerResult(
    result: { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> },
    fallback: MatchState<SmashUpCore>,
): TriggerResult {
    return { events: result.events, matchState: result.matchState ?? fallback };
}

export function baseLabel(state: SmashUpCore, baseIndex: number): string {
    return getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
}

export function minionLabel(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): string {
    const name = getCardDef(minion.defId)?.name ?? minion.defId;
    return `${name} @ ${baseLabel(state, baseIndex)}（力量 ${getMinionPower(state, minion, baseIndex)}）`;
}

export function collectMinionTargets(
    state: SmashUpCore,
    predicate: (minion: MinionOnBase, baseIndex: number) => boolean,
): MinionTarget[] {
    const targets: MinionTarget[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        for (const minion of state.bases[baseIndex].minions) {
            if (!predicate(minion, baseIndex)) continue;
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: minionLabel(state, minion, baseIndex),
            });
        }
    }
    return targets;
}

export function collectBaseTargets(
    state: SmashUpCore,
    predicate: (baseIndex: number) => boolean = () => true,
): BaseTarget[] {
    return state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(state, baseIndex) }))
        .filter(target => predicate(target.baseIndex));
}

export function asCardOptions<T extends Record<string, unknown> & RenderableCardChoiceValue>(
    targets: Array<{ uid?: string; id?: string; label: string; value: T }>,
): PromptOption<T>[] {
    return targets.map((target, index) => ({
        id: target.id ?? target.uid ?? `option-${index}`,
        label: target.label,
        value: target.value as T & RenderableCardChoiceValue,
        displayMode: 'card' as const,
    }));
}
