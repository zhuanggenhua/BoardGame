/**
 * 大杀四方 - 科学怪人派系能力
 *
 * 主题：+1力量指示物的放置、移除、转移
 */

import type { MatchState, PlayerId } from '../../../engine/types';
import type { PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildAbilityFeedback,
    buildMinionTargetOptions,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedReturnEvents,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraMinion,
    grantExtraMinion,
    queueMinionPlayEffect,
    removePowerCounter,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createAbilityRuntimeExecutor,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import {
    addPowerCounterPrimitive,
    createEffectDslProgram,
    optionalPrimitive,
} from '../domain/effectDsl';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { registerTriggerProgramExecutor } from '../domain/triggerExecutors';
import { getCardDef } from '../data/cards';
import type { MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { matchesDefId } from '../domain/utils';

const BODY_SHOP_PENDING_DISTRIBUTIONS_KEY = '_pendingBodyShopDistributions';

export interface BodyShopPendingDistribution {
    playerId: PlayerId;
    targetMinionUid: string;
    totalCounters: number;
}

type FrankensteinPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type CounterPromptContext = FrankensteinPromptContext & {
    reasonDefId: string;
    excludeUid?: string;
    excludeBaseIndex?: number;
};

type AngryMobCardContext = FrankensteinPromptContext & {
    minionUid: string;
    baseIndex: number;
};

type BlitzedRemoveContext = FrankensteinPromptContext & {
    removedTotal: number;
};

type BlitzedDestroyContext = FrankensteinPromptContext & {
    removedTotal: number;
};

type BodyShopDistributeContext = FrankensteinPromptContext & {
    remaining: number;
};

type MinionChoiceValue = {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type AngryMobCardChoiceValue = { cardUid: string; defId: string };
type AngryMobStopChoiceValue = { stop: true };
type BlitzedRemoveChoiceValue = { minionUid: string; defId: string; baseIndex: number } | { done: true };
type BodyShopDistributeChoiceValue = {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
    remaining: number;
};

function appendPendingBodyShopDistribution(
    matchState: MatchState<SmashUpCore>,
    pending: BodyShopPendingDistribution,
): MatchState<SmashUpCore> {
    const existing = Array.isArray((matchState.sys as Record<string, unknown>)[BODY_SHOP_PENDING_DISTRIBUTIONS_KEY])
        ? (matchState.sys as Record<string, unknown>)[BODY_SHOP_PENDING_DISTRIBUTIONS_KEY] as BodyShopPendingDistribution[]
        : [];
    return {
        ...matchState,
        sys: {
            ...matchState.sys,
            [BODY_SHOP_PENDING_DISTRIBUTIONS_KEY]: [...existing, pending],
        } as typeof matchState.sys,
    };
}

function createPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): FrankensteinPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function getAllOwnMinions(core: SmashUpCore, playerId: PlayerId): Array<{ minion: MinionOnBase; baseIndex: number }> {
    const result: Array<{ minion: MinionOnBase; baseIndex: number }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        for (const minion of core.bases[baseIndex].minions) {
            if (minion.controller === playerId) {
                result.push({ minion, baseIndex });
            }
        }
    }
    return result;
}

function buildOwnMinionCandidates(
    core: SmashUpCore,
    playerId: PlayerId,
    excludeUid?: string,
    filter?: (minion: MinionOnBase, baseIndex: number) => boolean,
) {
    return getAllOwnMinions(core, playerId)
        .filter(({ minion, baseIndex }) =>
            minion.uid !== excludeUid
            && (!filter || filter(minion, baseIndex)))
        .map(({ minion, baseIndex }) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(core, minion, baseIndex)})`,
        }));
}

function buildFriendlyMinionPromptOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    excludeUid?: string,
    filter?: (minion: MinionOnBase, baseIndex: number) => boolean,
): PromptOption<MinionChoiceValue>[] {
    return buildOwnMinionCandidates(core, playerId, excludeUid, filter).map((candidate, index) => ({
        id: `minion-${index}`,
        label: candidate.label,
        value: { minionUid: candidate.uid, minionDefId: candidate.defId, baseIndex: candidate.baseIndex },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
}

function buildCounterTargetOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    excludeUid?: string,
    filter?: (minion: MinionOnBase, baseIndex: number) => boolean,
): PromptOption<MinionChoiceValue>[] {
    return buildFriendlyMinionPromptOptions(core, playerId, excludeUid, filter);
}

function buildAngryMobCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<AngryMobCardChoiceValue | AngryMobStopChoiceValue>[] {
    const player = core.players[playerId];
    if (!player) return [];
    return [
        ...player.hand.map((card, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'hand' as const,
            displayMode: 'card' as const,
        })),
        {
            id: 'stop',
            label: '完成放牌',
            labelKey: 'ui.frankenstein_angry_mob_finish_option',
            value: { stop: true },
            displayMode: 'button' as const,
        },
    ];
}

function buildBlitzedRemoveOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    removedTotal: number,
): PromptOption<BlitzedRemoveChoiceValue>[] {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        for (const minion of core.bases[baseIndex].minions) {
            if (minion.controller !== playerId || (minion.powerCounters ?? 0) <= 0) continue;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（移除1个，剩余 ${minion.powerCounters ?? 0}）`,
            });
        }
    }
    return [
        ...buildMinionTargetOptions(candidates, { state: core, sourcePlayerId: playerId }),
        {
            id: 'done',
            label: removedTotal > 0 ? `完成移除（已移除 ${removedTotal} 个，消灭力量≤${removedTotal} 的随从）` : '跳过（不移除）',
            labelKey: removedTotal > 0
                ? 'ui.frankenstein_blitzed_finish_removed_option'
                : 'ui.frankenstein_blitzed_skip_remove_option',
            ...(removedTotal > 0 ? { labelParams: { removedTotal } } : {}),
            displayMode: 'button' as const,
            value: { done: true },
        },
    ];
}

function buildBlitzedDestroyOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    removedTotal: number,
): PromptOption<MinionChoiceValue>[] {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        for (const minion of core.bases[baseIndex].minions) {
            const power = getMinionPower(core, minion, baseIndex);
            if (power > removedTotal) continue;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${power})`,
            });
        }
    }
    return buildMinionTargetOptions(candidates, {
        state: core,
        sourcePlayerId: playerId,
        effectType: 'destroy',
    });
}

function buildBodyShopDistributeOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    remaining: number,
    excludeUid?: string,
): PromptOption<BodyShopDistributeChoiceValue>[] {
    return buildOwnMinionCandidates(core, playerId, excludeUid).map((candidate, index) => ({
        id: `minion-${index}`,
        label: candidate.label,
        value: {
            minionUid: candidate.uid,
            minionDefId: candidate.defId,
            baseIndex: candidate.baseIndex,
            remaining,
        },
        _source: 'field' as const,
        displayMode: 'card' as const,
    }));
}

function runtimeResultToTriggerResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): TriggerResult {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

function resolveCounterPlacement(
    state: SmashUpCore,
    playerId: PlayerId,
    context: { reasonDefId: string; excludeUid?: string; excludeBaseIndex?: number },
    selected: Partial<MinionChoiceValue> | undefined,
    timestamp: number,
): SmashUpEvent[] {
    if (!selected?.minionUid || typeof selected.baseIndex !== 'number') return [];
    const liveTarget = state.bases[selected.baseIndex]?.minions.find((minion) =>
        minion.uid === selected.minionUid
        && minion.controller === playerId
        && minion.uid !== context.excludeUid
        && selected.baseIndex !== context.excludeBaseIndex
    );
    if (!liveTarget) return [];
    return [addPowerCounter(selected.minionUid, selected.baseIndex, 1, context.reasonDefId, timestamp)];
}

const frankensteinLabAssistantPromptProgram = createPromptProgram<CounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_lab_assistant',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_lab_assistant_${context.now}`,
            context.playerId,
            '选择一个你的随从放置+1力量指示物',
            buildCounterTargetOptions(context.matchState.core, context.playerId, context.excludeUid),
            {
                sourceId: 'frankenstein_lab_assistant',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_counter_target_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildCounterTargetOptions(state.core as SmashUpCore, context.playerId, context.excludeUid);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => ({
        events: resolveCounterPlacement(state.core, playerId, context, value as Partial<MinionChoiceValue>, timestamp),
    }),
});

const frankensteinHerrDoktorPromptProgram = createPromptProgram<CounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_herr_doktor',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_herr_doktor_${context.now}`,
            context.playerId,
            '选择一个你的随从放置+1力量指示物',
            buildCounterTargetOptions(context.matchState.core, context.playerId, context.excludeUid),
            {
                sourceId: 'frankenstein_herr_doktor',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_counter_target_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildCounterTargetOptions(state.core as SmashUpCore, context.playerId, context.excludeUid);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => ({
        events: resolveCounterPlacement(state.core, playerId, context, value as Partial<MinionChoiceValue>, timestamp),
    }),
});

const frankensteinIgorPromptProgram = createPromptProgram<CounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_igor',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_igor_${context.playerId}_${context.now}`,
            context.playerId,
            '选择一个你的随从放置+1力量指示物（科学小怪蛋）',
            buildCounterTargetOptions(
                context.matchState.core,
                context.playerId,
                context.excludeUid,
                context.excludeBaseIndex === undefined
                    ? undefined
                    : (_minion, baseIndex) => baseIndex !== context.excludeBaseIndex,
            ),
            {
                sourceId: 'frankenstein_igor',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_igor_counter_target_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildCounterTargetOptions(
                state.core as SmashUpCore,
                context.playerId,
                context.excludeUid,
                context.excludeBaseIndex === undefined
                    ? undefined
                    : (_minion, baseIndex) => baseIndex !== context.excludeBaseIndex,
            );
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => ({
        events: resolveCounterPlacement(state.core, playerId, context, value as Partial<MinionChoiceValue>, timestamp),
    }),
});

const frankensteinAngryMobChooseCardPromptProgram = createPromptProgram<AngryMobCardContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_angry_mob_choose_card',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_angry_mob_choose_card_${context.now}`,
            context.playerId,
            '愤怒的民众：选择一张手牌放到牌库底（或完成放牌）',
            buildAngryMobCardOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'frankenstein_angry_mob_choose_card',
                targetType: 'hand',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_angry_mob_choose_card_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildAngryMobCardOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as ({ __cancel__?: boolean } & Partial<AngryMobCardChoiceValue & AngryMobStopChoiceValue>) | undefined;
        if (selected?.__cancel__ || selected?.stop) return { events: [] };
        if (!selected?.cardUid || !selected?.defId) return { events: [] };
        const sourceCard = state.core.players[playerId]?.hand.find(card =>
            card.uid === selected.cardUid && card.defId === selected.defId,
        );
        if (!sourceCard) return { events: [] };

        const deckBottomEvents = buildValidatedCardToDeckBottomEvents(state, {
            cardUid: sourceCard.uid,
            defId: sourceCard.defId,
            ownerId: sourceCard.owner,
            sourcePlayerId: playerId,
            reason: 'frankenstein_angry_mob',
            now: timestamp,
            expectedLocation: 'hand',
        });
        if (deckBottomEvents.length === 0) return { events: [] };

        const events: SmashUpEvent[] = [
            ...deckBottomEvents,
            addPowerCounter(context.minionUid, context.baseIndex, 1, 'frankenstein_angry_mob', timestamp),
        ];
        const remainingHandCount = (state.core.players[playerId]?.hand ?? [])
            .filter(card => card.uid !== sourceCard.uid)
            .length;
        if (remainingHandCount === 0) {
            return { events };
        }

        return {
            events,
            context: createPromptContext(state, playerId, timestamp, {
                minionUid: context.minionUid,
                baseIndex: context.baseIndex,
            }),
            nextProgram: frankensteinAngryMobChooseCardPromptProgram,
        };
    },
});

const frankensteinAngryMobPromptProgram = createPromptProgram<FrankensteinPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_angry_mob',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_angry_mob_${context.now}`,
            context.playerId,
            '选择一个你的随从（每放一张手牌到牌库底就放一个+1力量指示物）',
            buildCounterTargetOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'frankenstein_angry_mob',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_angry_mob_target_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildCounterTargetOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as Partial<MinionChoiceValue> | undefined;
        if (!selected?.minionUid || typeof selected.baseIndex !== 'number') return { events: [] };
        const liveTarget = state.core.bases[selected.baseIndex]?.minions.find((minion) =>
            minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!liveTarget || (state.core.players[playerId]?.hand.length ?? 0) === 0) return { events: [] };
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                minionUid: selected.minionUid,
                baseIndex: selected.baseIndex,
            }),
            nextProgram: frankensteinAngryMobChooseCardPromptProgram,
        };
    },
});

const frankensteinBodyShopDistributePromptProgram = createPromptProgram<BodyShopDistributeContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_body_shop_distribute',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_body_shop_distribute_${context.now}`,
            context.playerId,
            `选择随从放置+1指示物（剩余 ${context.remaining} 个）`,
            buildBodyShopDistributeOptions(context.matchState.core, context.playerId, context.remaining),
            {
                sourceId: 'frankenstein_body_shop_distribute',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildBodyShopDistributeOptions(state.core as SmashUpCore, context.playerId, context.remaining);
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as Partial<BodyShopDistributeChoiceValue> | undefined;
        if (!selected?.minionUid || typeof selected.baseIndex !== 'number') return { events: [] };
        const liveTarget = state.core.bases[selected.baseIndex]?.minions.find((minion) =>
            minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!liveTarget) return { events: [] };
        const currentRemaining = typeof context?.remaining === 'number'
            ? context.remaining
            : (typeof selected.remaining === 'number' ? selected.remaining : 0);
        if (currentRemaining <= 0) return { events: [] };

        const events: SmashUpEvent[] = [
            addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_body_shop', timestamp),
        ];
        const nextRemaining = currentRemaining - 1;
        if (nextRemaining <= 0) return { events };

        if (buildBodyShopDistributeOptions(state.core, playerId, nextRemaining).length === 0) {
            return { events };
        }

        return {
            events,
            context: createPromptContext(state, playerId, timestamp, { remaining: nextRemaining }),
            nextProgram: frankensteinBodyShopDistributePromptProgram,
        };
    },
});

const frankensteinBodyShopPromptProgram = createPromptProgram<FrankensteinPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_body_shop',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_body_shop_${context.now}`,
            context.playerId,
            '选择你要消灭的随从（其力量数的+1指示物将分配到其他随从）',
            buildCounterTargetOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'frankenstein_body_shop',
                targetType: 'minion',
                responseValidationMode: 'live',
                titleKey: 'ui.frankenstein_body_shop_target_title',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildCounterTargetOptions(state.core as SmashUpCore, context.playerId);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as Partial<MinionChoiceValue> | undefined;
        if (!selected?.minionUid || !selected?.minionDefId || typeof selected.baseIndex !== 'number') {
            return { events: [] };
        }
        const liveTarget = state.core.bases[selected.baseIndex]?.minions.find((minion) =>
            minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!liveTarget) return { events: [] };

        const power = getMinionPower(state.core, liveTarget, selected.baseIndex);
        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'frankenstein_body_shop',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'frankenstein_body_shop',
            sourceControllerId: playerId,
            sourceKind: 'action',
        });
        if (power <= 0) return { events };
        return {
            events,
            matchState: appendPendingBodyShopDistribution(state, {
                playerId,
                targetMinionUid: selected.minionUid,
                totalCounters: power,
            }),
        };
    },
});

const frankensteinBlitzedDestroyPromptProgram = createPromptProgram<BlitzedDestroyContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_blitzed_destroy',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_blitzed_destroy_${context.now}`,
            context.playerId,
            `选择要消灭的随从（力量≤${context.removedTotal}）`,
            buildBlitzedDestroyOptions(context.matchState.core, context.playerId, context.removedTotal),
            {
                sourceId: 'frankenstein_blitzed_destroy',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) =>
            buildBlitzedDestroyOptions(state.core as SmashUpCore, context.playerId, context.removedTotal);
        return interaction;
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as (Partial<MinionChoiceValue> & { defId?: string }) | undefined;
        const selectedDefId = selected?.minionDefId ?? selected?.defId;
        if (!selected?.minionUid || !selectedDefId || typeof selected.baseIndex !== 'number') {
            return { events: [] };
        }
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selectedDefId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'frankenstein_blitzed',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'frankenstein_blitzed',
                sourceControllerId: playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const frankensteinBlitzedRemovePromptProgram = createPromptProgram<BlitzedRemoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'frankenstein_blitzed_remove',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `frankenstein_blitzed_remove_${context.now}`,
            context.playerId,
            `闪电攻击：点击随从移除1个指示物（已移除 ${context.removedTotal}）`,
            buildBlitzedRemoveOptions(context.matchState.core, context.playerId, context.removedTotal),
            {
                sourceId: 'frankenstein_blitzed_remove',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state, data) => {
            const liveRemovedTotal = typeof (data as { continuationContext?: { removedTotal?: number } } | undefined)?.continuationContext?.removedTotal === 'number'
                ? (data as { continuationContext?: { removedTotal?: number } }).continuationContext!.removedTotal!
                : context.removedTotal;
            return buildBlitzedRemoveOptions(state.core as SmashUpCore, context.playerId, liveRemovedTotal);
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as Partial<{ minionUid: string; baseIndex: number; done: boolean }> | undefined;
        if (selected?.done) {
            if (buildBlitzedDestroyOptions(state.core, playerId, context.removedTotal).length === 0) return { events: [] };
            return {
                events: [],
                context: createPromptContext(state, playerId, timestamp, { removedTotal: context.removedTotal }),
                nextProgram: frankensteinBlitzedDestroyPromptProgram,
            };
        }
        if (!selected?.minionUid || typeof selected.baseIndex !== 'number') return { events: [] };
        const liveTarget = state.core.bases[selected.baseIndex]?.minions.find((minion) =>
            minion.uid === selected.minionUid
            && minion.controller === playerId
            && (minion.powerCounters ?? 0) > 0,
        );
        if (!liveTarget) return { events: [] };

        const events: SmashUpEvent[] = [
            removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_blitzed', timestamp),
        ];
        return {
            events,
            context: createPromptContext(state, playerId, timestamp, { removedTotal: context.removedTotal + 1 }),
            nextProgram: frankensteinBlitzedRemovePromptProgram,
        };
    },
});

export function createFrankensteinBodyShopDistributionInteraction(
    state: MatchState<SmashUpCore>,
    pending: BodyShopPendingDistribution,
    timestamp: number,
) {
    const interaction = createAbilityRuntimeSimpleChoice(
        `frankenstein_body_shop_distribute_${timestamp}`,
        pending.playerId,
        `选择随从放置+1指示物（剩余 ${pending.totalCounters} 个）`,
        buildBodyShopDistributeOptions(state.core, pending.playerId, pending.totalCounters, pending.targetMinionUid),
        {
            sourceId: 'frankenstein_body_shop_distribute',
            continuationId: `frankenstein_body_shop_distribute:${pending.playerId}:${timestamp}`,
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    interaction.data.optionsGenerator = (latestState) =>
        buildBodyShopDistributeOptions(
            (latestState.core as SmashUpCore),
            pending.playerId,
            pending.totalCounters,
            pending.targetMinionUid,
        );
    return interaction;
}

const frankensteinLabAssistantProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildCounterTargetOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (options.length === 1) {
        const selected = options[0].value;
        return { events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_lab_assistant', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            reasonDefId: 'frankenstein_lab_assistant',
            excludeUid: ctx.cardUid,
        }),
        nextProgram: frankensteinLabAssistantPromptProgram,
    };
});

const frankensteinHerrDoktorProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildCounterTargetOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (options.length === 1) {
        const selected = options[0].value;
        return { events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_herr_doktor', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            reasonDefId: 'frankenstein_herr_doktor',
            excludeUid: ctx.cardUid,
        }),
        nextProgram: frankensteinHerrDoktorPromptProgram,
    };
});

const frankensteinIgorOnDestroyProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const options = buildCounterTargetOptions(ctx.state, ctx.playerId, ctx.cardUid);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (options.length === 1) {
        const selected = options[0].value;
        return { events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, ctx.defId, ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            reasonDefId: ctx.defId,
            excludeUid: ctx.cardUid,
        }),
        nextProgram: frankensteinIgorPromptProgram,
    };
});

const frankensteinAngryMobProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const minionOptions = buildCounterTargetOptions(ctx.state, ctx.playerId);
    if (minionOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if ((ctx.state.players[ctx.playerId]?.hand.length ?? 0) === 0) {
        return { events: [] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: frankensteinAngryMobPromptProgram,
    };
});

const frankensteinBodyShopProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const minionOptions = buildCounterTargetOptions(ctx.state, ctx.playerId);
    if (minionOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        nextProgram: frankensteinBodyShopPromptProgram,
    };
});

const frankensteinBlitzedProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
    events: [],
    context: createPromptContext(ctx.matchState, ctx.playerId, ctx.now, { removedTotal: 0 }),
    nextProgram: frankensteinBlitzedRemovePromptProgram,
}));

function isFrankensteinGermanEngineeringEligible(ctx: TriggerContext): boolean {
    const { state, baseIndex, playerId } = ctx;
    if (baseIndex === undefined) return false;
    const base = state.bases[baseIndex];
    if (!base) return false;
    return base.ongoingActions.some((action) =>
        matchesDefId(action.defId, 'frankenstein_german_engineering')
        && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId),
    );
}

const frankensteinGermanEngineeringDslProgram = createEffectDslProgram<TriggerContext>(
    optionalPrimitive({
        when: (ctx) => !!ctx.triggerMinionUid && isFrankensteinGermanEngineeringEligible(ctx),
        effect: addPowerCounterPrimitive<TriggerContext>({
            minionUid: (ctx) => ctx.triggerMinionUid,
            baseIndex: (ctx) => ctx.baseIndex,
            amount: 1,
            reason: 'frankenstein_german_engineering',
            now: (ctx) => ctx.now,
        }),
    }),
);

function frankensteinTheMonster(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found || (found.minion.powerCounters ?? 0) < 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }
    return {
        events: [
            removePowerCounter(found.minion.uid, found.baseIndex, 1, 'frankenstein_the_monster', ctx.now),
            grantContextualExtraMinion(ctx, 'frankenstein_the_monster'),
        ],
    };
}

function frankensteinJolt(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        for (const minion of ctx.state.bases[baseIndex].minions) {
            if (minion.controller === ctx.playerId) {
                events.push(addPowerCounter(minion.uid, baseIndex, 1, 'frankenstein_jolt', ctx.now));
            }
        }
    }
    return { events };
}

function frankensteinItsAlive(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'frankenstein_its_alive', ctx.now, undefined, {
                playTiming: 'immediate',
                consumePendingMinionPlayEffectOnSkip: true,
            }),
            queueMinionPlayEffect(ctx.playerId, 'addPowerCounter', 1, ctx.now),
        ],
    };
}

function registerFrankensteinOngoingEffects(): void {
    registerTrigger('frankenstein_igor', 'onMinionDiscardedFromBase', (ctx: TriggerContext) => {
        const isIgor = ctx.triggerMinionDefId === 'frankenstein_igor' || ctx.triggerMinionDefId === 'frankenstein_igor_pod';
        if (!isIgor || ctx.baseIndex === undefined || !ctx.triggerMinionUid) return [];
        // Igor 的“destroyed or discarded”在 destroy -> discard 真链里只应结算一次；
        // 若当前 discard trigger 来自 processDestroyTriggers 的 destroy 落地，交给 onDestroy 处理即可。
        if (typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:')) {
            return [];
        }

        const base = ctx.state.bases[ctx.baseIndex];
        // queued discarded-from-base triggers may execute after Igor has already left the base,
        // so prefer triggerMinion LKI and only fall back to live base lookup for direct callers.
        const controllerId = ctx.triggerMinion?.controller
            ?? base?.minions.find((minion) => minion.uid === ctx.triggerMinionUid)?.controller;
        if (!controllerId) return [];
        const options = buildCounterTargetOptions(
            ctx.state,
            controllerId,
            ctx.triggerMinionUid,
            typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('base-clear-discard:')
                ? (_minion, targetBaseIndex) => targetBaseIndex !== ctx.baseIndex
                : undefined,
        );
        if (options.length === 0) return [];

        const reasonDefId = ctx.triggerMinionDefId;
        if (options.length === 1) {
            const selected = options[0].value;
            return [addPowerCounter(selected.minionUid, selected.baseIndex, 1, reasonDefId, ctx.now)];
        }
        if (!ctx.matchState) {
            const selected = options[0].value;
            return [addPowerCounter(selected.minionUid, selected.baseIndex, 1, reasonDefId, ctx.now)];
        }

        return runtimeResultToTriggerResult(
            executeAbilityProgram(
                frankensteinIgorPromptProgram,
                createPromptContext(ctx.matchState, controllerId, ctx.now, {
                    reasonDefId,
                    excludeUid: ctx.triggerMinionUid,
                    ...(typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('base-clear-discard:')
                        ? { excludeBaseIndex: ctx.baseIndex }
                        : {}),
                }),
            ),
            ctx.matchState,
        );
    }, {
    });

    registerTrigger('frankenstein_german_engineering', 'onMinionPlayed', (ctx: TriggerContext) =>
        executeAbilityProgram(frankensteinGermanEngineeringDslProgram, ctx).events, {
        sourceScope: 'triggerBase',
        canTrigger: isFrankensteinGermanEngineeringEligible,
        perInstance: true,
    }, {
    });
    registerTriggerProgramExecutor(
        'frankenstein_german_engineering',
        'onMinionPlayed',
        createAbilityRuntimeExecutor(frankensteinGermanEngineeringDslProgram),
    );

    registerTrigger('frankenstein_grave_situation', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, baseIndex, triggerMinionUid, triggerMinionDefId, now } = ctx;
        if (baseIndex === undefined || !triggerMinionUid || !triggerMinionDefId) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        const minion = ctx.triggerMinion
            ?? base.minions.find((candidate) => candidate.uid === triggerMinionUid);
        const controllerId = minion?.controller;
        if (!controllerId) return [];
        const hasGraveSituation = base.ongoingActions.some((action) =>
            matchesDefId(action.defId, 'frankenstein_grave_situation')
            && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === controllerId),
        );
        if (!hasGraveSituation) return [];

        return buildValidatedReturnEvents(ctx.state, {
            minionUid: triggerMinionUid,
            minionDefId: triggerMinionDefId,
            fromBaseIndex: baseIndex,
            toPlayerId: minion.owner,
            sourcePlayerId: controllerId,
            reason: 'frankenstein_grave_situation',
            now,
        });
    }, {
        phase: 'replacement',
    });

    registerTrigger('frankenstein_uberserum', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        if (ctx.sourceCardUid) {
            for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
                for (const minion of state.bases[baseIndex].minions) {
                    const attachment = minion.attachedActions.find((action) =>
                        action.uid === ctx.sourceCardUid
                        && matchesDefId(action.defId, 'frankenstein_uberserum'),
                    );
                    if (!attachment) continue;
                    const attachmentControllerId = ((attachment.metadata?.sourceControllerId as PlayerId | undefined) ?? attachment.ownerId);
                    if (attachmentControllerId !== playerId) return [];
                    return [addPowerCounter(minion.uid, baseIndex, 1, 'frankenstein_uberserum', now)];
                }
            }
            return [];
        }

        const events: SmashUpEvent[] = [];
        for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
            for (const minion of state.bases[baseIndex].minions) {
                const matchingAttachments = minion.attachedActions.filter((action) =>
                    matchesDefId(action.defId, 'frankenstein_uberserum')
                    && (((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId),
                );
                for (const _attachment of matchingAttachments) {
                    events.push(addPowerCounter(minion.uid, baseIndex, 1, 'frankenstein_uberserum', now));
                }
            }
        }
        return events;
    }, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerProtection('frankenstein_uberserum', 'destroy', (ctx) =>
        ctx.targetMinion.attachedActions.some((action) => matchesDefId(action.defId, 'frankenstein_uberserum')),
    );
}

export function registerFrankensteinAbilities(): void {
    registerAbilityProgram('frankenstein_lab_assistant', 'onPlay', { program: frankensteinLabAssistantProgram });
    registerSimpleAbility('frankenstein_the_monster', 'talent', {
        execute: frankensteinTheMonster,
        validateUse: (ctx) => {
            const minion = ctx.state.bases[ctx.baseIndex]?.minions.find((candidate) => candidate.uid === ctx.cardUid);
            return (minion?.powerCounters ?? 0) >= 1 ? null : '该随从当前无法发动天赋：没有+1力量指示物';
        },
    });
    registerAbilityProgram('frankenstein_herr_doktor', 'talent', {
        program: frankensteinHerrDoktorProgram,
        validateUse: (ctx) => {
            const hasOtherOwnMinion = ctx.state.bases.some((base) =>
                base.minions.some((minion) => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid),
            );
            return hasOtherOwnMinion ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('frankenstein_igor', 'onDestroy', { program: frankensteinIgorOnDestroyProgram });

    registerSimpleAbility('frankenstein_jolt', 'onPlay', frankensteinJolt);
    registerSimpleAbility('frankenstein_its_alive', 'onPlay', frankensteinItsAlive);
    registerAbilityProgram('frankenstein_angry_mob', 'onPlay', { program: frankensteinAngryMobProgram });
    registerAbilityProgram('frankenstein_body_shop', 'onPlay', { program: frankensteinBodyShopProgram });
    registerAbilityProgram('frankenstein_blitzed', 'onPlay', { program: frankensteinBlitzedProgram });

    registerFrankensteinOngoingEffects();
}
