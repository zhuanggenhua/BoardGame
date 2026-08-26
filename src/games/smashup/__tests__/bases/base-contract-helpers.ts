import { initAllAbilities } from '../../abilities';
import {
    triggerBaseAbility,
    triggerExtendedBaseAbility,
} from '../../domain/baseAbilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { buildBuryCardEvents } from '../../domain/bury';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import { collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reduce';
import { processDestroyTriggers } from '../../domain/reducer';
import {
    SU_COMMANDS,
    SU_EVENTS,
    type CardInstance,
    type MinionDestroyedEvent,
    type MinionOnBase,
    type SmashUpCore,
} from '../../domain/types';
import type { MatchState, RandomFn } from '../../../../engine/types';
import {
    expectNoPrompt,
    getInteractionsFromResult,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeMinionDestroyedEvent,
    makeMatchState,
    resolveInteractionChain,
    respondCommand,
    triggerBaseAbilityWithMS,
    type DestroyedMinionInput,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

export {
    buildBuryCardEvents,
    collectTriggers,
    defaultTestRandom,
    expectNoPrompt,
    fireTriggers,
    getInteractionsFromResult,
    getOptionalSimpleChoicePrompt,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeMinionDestroyedEvent,
    initAllAbilities,
    makeMatchState,
    maybeResolveReactionQueue,
    processDestroyTriggers,
    reduce,
    resolveInteractionChain,
    respondCommand,
    runCommand,
    SMASHUP_FACTION_IDS,
    SU_COMMANDS,
    SU_EVENTS,
    triggerBaseAbility,
    triggerBaseAbilityWithMS,
    triggerExtendedBaseAbility,
};
export type {
    BaseAbilityContext,
    CardInstance,
    MatchState,
    MinionDestroyedEvent,
    MinionOnBase,
    RandomFn,
    SmashUpCore,
};

export const dummyRandom: RandomFn = defaultTestRandom;

export function resolveDestroyedMinions(args: {
    state: MatchState<SmashUpCore>;
    currentPlayerId: string;
    destroyed: DestroyedMinionInput[];
    random?: RandomFn;
    now?: number;
    options?: { skipDestroyEventKeys?: Set<string> };
}) {
    return processDestroyTriggers(
        args.destroyed.map(entry => makeMinionDestroyedEvent(entry, args.state)),
        args.state,
        args.currentPlayerId,
        args.random ?? dummyRandom,
        args.now ?? 1000,
        args.options,
    );
}

export function resolveDuelChain(
    initialState: ReturnType<typeof makeMatchState>,
    overrides: Partial<Record<string, (prompt: any, state: ReturnType<typeof makeMatchState>, step: number) => { optionId?: string; optionIds?: string[]; mergedValue?: unknown }>> = {},
) {
    return resolveInteractionChain(initialState, (prompt, state, step) => {
        const sourceId = getPromptSourceId(prompt);
        const custom = sourceId ? overrides[sourceId] : undefined;
        if (custom) return custom(prompt, state, step);

        if (sourceId === 'smashup_duel_pinkerton') {
            const option = getPromptOption(prompt, entry => entry?.value?.amount === 0, 'Pinkerton 的 0 指示物选项');
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_card' || sourceId === 'smashup_duel_deputy_card') {
            const option = getPromptOption(prompt, entry => entry?.value?.skip === true, `${sourceId} 的跳过选项`);
            return { optionId: option.id };
        }
        if (sourceId === 'smashup_duel_run_em_off_move') {
            return { optionId: getPromptOptions(prompt)[0].id };
        }

        throw new Error(`未处理的决斗交互 sourceId: ${sourceId ?? 'unknown'}`);
    }, dummyRandom);
}

export function resolveReactionPromptBySource(
    state: MatchState<SmashUpCore>,
    sourceDefId: string,
    playerId = '0',
) {
    const prompt = getSimpleChoicePrompt(state, 'smashup_reaction_choose');
    const queueById = new Map(state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
    const option = getPromptOptions(prompt).find((entry: any) => {
        const trigger = queueById.get(entry.value?.triggerId) as any;
        return trigger?.sourceDefId === sourceDefId;
    }) ?? getPromptOptions(prompt)[0];
    return runCommand(
        state,
        respondCommand(option.id, playerId),
        dummyRandom,
    );
}

export function maybeResolveReactionPromptBySource(
    state: MatchState<SmashUpCore>,
    sourceDefId: string,
    playerId = '0',
) {
    const prompt = getOptionalSimpleChoicePrompt(state, 'smashup_reaction_choose');
    if (!prompt) {
        return { events: [], finalState: state };
    }
    const queueById = new Map(state.core.triggerQueue?.map(trigger => [trigger.id, trigger]) ?? []);
    const option = getPromptOptions(prompt).find((entry: any) => {
        const trigger = queueById.get(entry.value?.triggerId) as any;
        return trigger?.sourceDefId === sourceDefId;
    }) ?? getPromptOptions(prompt)[0];
    return runCommand(
        state,
        respondCommand(option.id, playerId),
        dummyRandom,
    );
}

export function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {},
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

export function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid,
        defId,
        controller,
        owner: controller,
        basePower: power,
        powerCounters: 0,
        powerModifier: 0,
        tempPowerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
}

export function makeCard(uid: string, owner: string, defId = 'test_card'): CardInstance {
    return { uid, defId, type: 'minion', owner };
}
