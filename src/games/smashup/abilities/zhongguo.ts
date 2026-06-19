import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerAbilityProgram, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import {
    addPowerCounter,
    buildAbilityFeedback,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraMinion,
    removePowerCounter,
} from '../domain/abilityHelpers';
import { registerBaseVpModifier, registerProtection, registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { SU_EVENTS, type SmashUpCore, type SmashUpEvent } from '../domain/types';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../domain/ongoingModifiers';
import { getCardDef } from '../data/cards';

type ZhongguoPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type CounterTransferChoice = {
    amount?: number;
    value?: number;
};

type CounterTransferCandidate = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type CounterTransferContext = ZhongguoPromptContext & {
    reason: string;
    sourcePromptTitle: string;
    targetPromptTitle: string;
    amountPromptTitle: string;
    allowSkip?: boolean;
    fixedAmount?: number;
    allowedAddBaseIndex?: number;
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
    sourceCounterAmount?: number;
    targetMinionUid?: string;
    targetBaseIndex?: number;
};

type AncientChineseArtModeContext = ZhongguoPromptContext & {
    cardUid: string;
    baseIndex: number;
};

type LetsGetItOnContext = ZhongguoPromptContext & {
    sourceMinionUid?: string;
    sourceBaseIndex?: number;
    sourcePower?: number;
};

type EverybodyKnewContext = ZhongguoPromptContext;

type ABitFrighteningContext = ZhongguoPromptContext & {
    referenceMinionUid?: string;
    referenceBaseIndex?: number;
    referencePower?: number;
};

type OhHohHohHoahContext = ZhongguoPromptContext & {
    baseIndex: number;
};

function createPromptContext<TExtra extends object>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): ZhongguoPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function collectAllMinions(state: SmashUpCore): CounterTransferCandidate[] {
    const result: CounterTransferCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        }
    }
    return result;
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): CounterTransferCandidate[] {
    return collectAllMinions(state).filter((candidate) => {
        const minion = state.bases[candidate.baseIndex]?.minions.find(entry => entry.uid === candidate.uid);
        return minion?.controller === playerId;
    });
}

function collectCounterTransferSources(state: SmashUpCore): CounterTransferCandidate[] {
    const result: CounterTransferCandidate[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            const powerCounters = minion.powerCounters ?? 0;
            if (powerCounters <= 0) continue;
            const name = getCardDef(minion.defId)?.name ?? minion.defId;
            result.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${name}（指示物 ${powerCounters}）`,
            });
        }
    }
    return result;
}

function collectCounterTransferTargets(
    state: SmashUpCore,
    sourceMinionUid: string,
    allowedAddBaseIndex?: number,
): CounterTransferCandidate[] {
    return collectAllMinions(state).filter((candidate) => {
        if (candidate.uid === sourceMinionUid) return false;
        if (allowedAddBaseIndex !== undefined && candidate.baseIndex !== allowedAddBaseIndex) return false;
        return true;
    });
}

function resolveTransferAmount(
    selected: CounterTransferChoice,
    maxAmount: number,
): number {
    const raw = typeof selected.amount === 'number'
        ? selected.amount
        : typeof selected.value === 'number'
            ? selected.value
            : maxAmount;
    const normalized = Math.floor(raw);
    return Math.max(1, Math.min(normalized, maxAmount));
}

function performCounterTransfer(
    sourceUid: string,
    sourceBaseIndex: number,
    targetUid: string,
    targetBaseIndex: number,
    amount: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    return [
        removePowerCounter(sourceUid, sourceBaseIndex, amount, reason, now),
        addPowerCounter(targetUid, targetBaseIndex, amount, reason, now),
    ];
}

const kungFuCounterTransferAmountPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_amount',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_amount_${context.now}`,
            context.playerId,
            context.amountPromptTitle,
            [{
                id: 'confirm-transfer',
                label: '确认转移',
                labelKey: 'ui.kung_fu_fighters_counter_transfer_confirm_option',
                value: {
                    amount: context.sourceCounterAmount,
                    value: context.sourceCounterAmount,
                },
                displayMode: 'button' as const,
            }],
            {
                sourceId: 'kung_fu_counter_transfer_amount',
                targetType: 'button',
            },
        );
        (interaction.data as Record<string, unknown>).slider = {
            min: 1,
            max: context.sourceCounterAmount,
            step: 1,
            defaultValue: context.sourceCounterAmount,
            confirmOptionId: 'confirm-transfer',
        };
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if (
            !context.sourceMinionUid
            || context.sourceBaseIndex === undefined
            || !context.targetMinionUid
            || context.targetBaseIndex === undefined
        ) {
            return { events: [] };
        }
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        const target = state.core.bases[context.targetBaseIndex]?.minions.find(minion => minion.uid === context.targetMinionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || !target || sourcePowerCounters <= 0) {
            return { events: [] };
        }
        const amount = resolveTransferAmount(value as CounterTransferChoice, sourcePowerCounters);
        return {
            events: performCounterTransfer(
                source.uid,
                context.sourceBaseIndex,
                target.uid,
                context.targetBaseIndex,
                amount,
                context.reason,
                timestamp,
            ),
        };
    },
});

const kungFuCounterTransferTargetPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_target',
    buildInteraction: (context) => {
        const targets = collectCounterTransferTargets(
            context.matchState.core,
            context.sourceMinionUid ?? '',
            context.allowedAddBaseIndex,
        );
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_target_${context.now}`,
            context.playerId,
            context.targetPromptTitle,
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_counter_transfer_target',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !context.sourceMinionUid || context.sourceBaseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(minion => minion.uid === context.sourceMinionUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || !target || source.uid === target.uid || sourcePowerCounters <= 0) {
            return { events: [] };
        }

        const fixedAmount = context.fixedAmount ?? (sourcePowerCounters === 1 ? 1 : undefined);
        if (fixedAmount !== undefined) {
            return {
                events: performCounterTransfer(
                    source.uid,
                    context.sourceBaseIndex,
                    target.uid,
                    selected.baseIndex,
                    fixedAmount,
                    context.reason,
                    timestamp,
                ),
            };
        }

        return {
            events: [],
            context: {
                ...context,
                targetMinionUid: target.uid,
                targetBaseIndex: selected.baseIndex,
                sourceCounterAmount: sourcePowerCounters,
            },
            nextProgram: kungFuCounterTransferAmountPromptProgram,
        };
    },
});

const kungFuCounterTransferSourcePromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_counter_transfer_source',
    buildInteraction: (context) => {
        const sourceOptions = buildMinionTargetOptions(
            collectCounterTransferSources(context.matchState.core),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            },
        );
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_counter_transfer_source_${context.now}`,
            context.playerId,
            context.sourcePromptTitle,
            context.allowSkip ? [createSkipOption(), ...sourceOptions] : sourceOptions,
            {
                sourceId: 'kung_fu_counter_transfer_source',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value }) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip) {
            return { events: [] };
        }
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        const sourcePowerCounters = source?.powerCounters ?? 0;
        if (!source || sourcePowerCounters <= 0) {
            return { events: [] };
        }
        const targets = collectCounterTransferTargets(state.core, source.uid, context.allowedAddBaseIndex);
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] };
        }
        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: source.uid,
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount: sourcePowerCounters,
            },
            nextProgram: kungFuCounterTransferTargetPromptProgram,
        };
    },
});

const ancientChineseArtModePromptProgram = createPromptProgram<AncientChineseArtModeContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_ancient_chinese_art_mode',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const canAdd = (base?.minions.length ?? 0) > 0;
        const canTransfer = collectCounterTransferSources(context.matchState.core).length > 0
            && collectAllMinions(context.matchState.core).length > 1;
        const options = [];
        if (canAdd) {
            options.push({
                id: 'add-counter',
                label: '放置 1 枚指示物',
                labelKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_add_option',
                value: { mode: 'add' },
                displayMode: 'button' as const,
            });
        }
        if (canTransfer) {
            options.push({
                id: 'transfer-counters',
                label: '转移指示物',
                labelKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_transfer_option',
                value: { mode: 'transfer' },
                displayMode: 'button' as const,
            });
        }
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_ancient_chinese_art_mode_${context.now}`,
            context.playerId,
            '古老的中国艺术：选择要发动的效果',
            options,
            {
                sourceId: 'kung_fu_fighters_ancient_chinese_art_mode',
                targetType: 'button',
                titleKey: 'ui.kung_fu_fighters_ancient_chinese_art_mode_title',
            },
        );
    },
    onResolve: ({ context, state, value, playerId, timestamp }) => {
        const selected = value as { mode?: 'add' | 'transfer' } | undefined;
        if (selected?.mode === 'add') {
            const base = state.core.bases[context.baseIndex];
            const targets = (base?.minions ?? []).map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
            if (targets.length === 0) {
                return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
            }
            return {
                events: [],
                context: createPromptContext(state, playerId, timestamp, {
                    reason: 'kung_fu_fighters_ancient_chinese_art',
                    sourcePromptTitle: '',
                    targetPromptTitle: '古老的中国艺术：选择本基地一个随从放置 1 枚指示物',
                    amountPromptTitle: '',
                    fixedAmount: 1,
                    allowedAddBaseIndex: context.baseIndex,
                    sourceMinionUid: '__virtual_counter_source__',
                    sourceBaseIndex: context.baseIndex,
                    sourceCounterAmount: 1,
                }),
                nextProgram: ancientChineseArtAddCounterPromptProgram,
            };
        }
        if (selected?.mode === 'transfer') {
            return runCounterTransferProgram(
                state,
                playerId,
                timestamp,
                {
                    reason: 'kung_fu_fighters_ancient_chinese_art',
                    sourcePromptTitle: '古老的中国艺术：选择要转出指示物的随从',
                    targetPromptTitle: '古老的中国艺术：选择接收指示物的另一个随从',
                    amountPromptTitle: '古老的中国艺术：选择要转移的指示物数量',
                },
            );
        }
        return { events: [] };
    },
});

const ancientChineseArtAddCounterPromptProgram = createPromptProgram<CounterTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_ancient_chinese_art_add_counter',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.allowedAddBaseIndex ?? -1];
        const targets = (base?.minions ?? []).map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: context.allowedAddBaseIndex ?? 0,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_ancient_chinese_art_add_counter_${context.now}`,
            context.playerId,
            context.targetPromptTitle,
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_ancient_chinese_art_add_counter',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 1, context.reason, timestamp)],
        };
    },
});

const everybodyKnewPromptProgram = createPromptProgram<EverybodyKnewContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_everybody_knew_their_part',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_everybody_knew_their_part_${context.now}`,
        context.playerId,
        '各尽其责：选择你的一个随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            },
        ),
        {
            sourceId: 'kung_fu_fighters_everybody_knew_their_part',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_everybody_knew_their_part_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || source.controller !== playerId) {
            return { events: [] };
        }
        const powerMax = getMinionPower(state.core, source, selected.baseIndex) - 1;
        if (powerMax < 0) {
            return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [
                grantContextualExtraMinion(
                    { playerId, now: timestamp, matchState: state },
                    'kung_fu_fighters_everybody_knew_their_part',
                    selected.baseIndex,
                    { powerMax },
                ),
            ],
        };
    },
});

const aLittleBitFrighteningRewardPromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_reward',
    buildInteraction: (context) => {
        const baseIndex = context.referenceBaseIndex ?? -1;
        const ownMinions = (context.matchState.core.bases[baseIndex]?.minions ?? [])
            .filter((minion) => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_reward_${context.now}`,
            context.playerId,
            '有些胆寒：选择该处你的一个随从放置 2 枚指示物',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_reward',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_reward_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target || target.controller !== context.playerId || selected.baseIndex !== context.referenceBaseIndex) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 2, 'kung_fu_fighters_a_little_bit_frightening', timestamp)],
        };
    },
});

const aLittleBitFrighteningDestroyPromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_destroy',
    buildInteraction: (context) => {
        const baseIndex = context.referenceBaseIndex ?? -1;
        const threshold = context.referencePower ?? 0;
        const targets = (context.matchState.core.bases[baseIndex]?.minions ?? [])
            .filter((minion) => minion.uid !== context.referenceMinionUid && getMinionPower(context.matchState.core, minion, baseIndex) < threshold)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, baseIndex)}）`,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_destroy_${context.now}`,
            context.playerId,
            '有些胆寒：选择该基地一个更低战力的随从消灭',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_destroy',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_destroy_title',
            },
        );
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || context.referenceBaseIndex === undefined) {
            return { events: [] };
        }
        const base = state.core.bases[context.referenceBaseIndex];
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!base || !target || selected.baseIndex !== context.referenceBaseIndex) {
            return { events: [] };
        }
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'kung_fu_fighters_a_little_bit_frightening',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'kung_fu_fighters_a_little_bit_frightening',
            sourceControllerId: playerId,
            sourceBaseIndex: context.referenceBaseIndex,
        });
        if (!destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)) {
            return { events: destroyEvents };
        }
        const ownMinions = base.minions.filter((minion) => minion.controller === playerId);
        if (ownMinions.length === 0) {
            return { events: destroyEvents };
        }
        if (ownMinions.length === 1) {
            return {
                events: [
                    ...destroyEvents,
                    addPowerCounter(ownMinions[0].uid, context.referenceBaseIndex, 2, 'kung_fu_fighters_a_little_bit_frightening', timestamp),
                ],
            };
        }
        return {
            events: destroyEvents,
            context,
            nextProgram: aLittleBitFrighteningRewardPromptProgram,
        };
    },
});

const aLittleBitFrighteningReferencePromptProgram = createPromptProgram<ABitFrighteningContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_a_little_bit_frightening_reference',
    buildInteraction: (context) => {
        const candidates = collectAllMinions(context.matchState.core).filter((candidate) => {
            const base = context.matchState.core.bases[candidate.baseIndex];
            const reference = base?.minions.find((minion) => minion.uid === candidate.uid);
            if (!base || !reference) return false;
            const referencePower = getMinionPower(context.matchState.core, reference, candidate.baseIndex);
            const hasLowerPowerTarget = base.minions.some((minion) =>
                minion.uid !== reference.uid && getMinionPower(context.matchState.core, minion, candidate.baseIndex) < referencePower,
            );
            const hasOwnRecipient = base.minions.some((minion) => minion.controller === context.playerId);
            return hasLowerPowerTarget && hasOwnRecipient;
        }).map((candidate) => {
            const minion = context.matchState.core.bases[candidate.baseIndex]?.minions.find((entry) => entry.uid === candidate.uid);
            const power = minion ? getMinionPower(context.matchState.core, minion, candidate.baseIndex) : 0;
            return {
                ...candidate,
                label: `${candidate.label}（力量 ${power}）`,
            };
        });
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_a_little_bit_frightening_reference_${context.now}`,
            context.playerId,
            '有些胆寒：选择一个随从作为参照',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            }),
            {
                sourceId: 'kung_fu_fighters_a_little_bit_frightening_reference',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_a_little_bit_frightening_reference_title',
            },
        );
    },
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const reference = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!reference) {
            return { events: [] };
        }
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                referenceMinionUid: reference.uid,
                referenceBaseIndex: selected.baseIndex,
                referencePower: getMinionPower(state.core, reference, selected.baseIndex),
            }),
            nextProgram: aLittleBitFrighteningDestroyPromptProgram,
        };
    },
});

const letsGetItOnChooseTargetsPromptProgram = createPromptProgram<LetsGetItOnContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_lets_get_it_on_targets',
    buildInteraction: (context) => {
        const baseIndex = context.sourceBaseIndex ?? -1;
        const base = context.matchState.core.bases[baseIndex];
        const threshold = context.sourcePower ?? 0;
        const targets = (base?.minions ?? [])
            .filter((minion) => getMinionPower(context.matchState.core, minion, baseIndex) <= threshold)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, baseIndex)}）`,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_lets_get_it_on_targets_${context.now}`,
            context.playerId,
            '让我们躁起来：选择一个或多个要消灭的随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_lets_get_it_on_targets',
                targetType: 'minion',
                multi: { min: 1, max: Math.max(1, targets.length) },
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_lets_get_it_on_targets_title',
            },
        );
    },
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selections = Array.isArray(value) ? value as MinionChoice[] : [];
        const uniqueSelections = new Map<string, MinionChoice>();
        for (const selection of selections) {
            if (!selection.minionUid || selection.baseIndex === undefined) continue;
            uniqueSelections.set(`${selection.baseIndex}:${selection.minionUid}`, selection);
        }
        if (uniqueSelections.size === 0) {
            return { events: [] };
        }
        const events: SmashUpEvent[] = [];
        for (const selection of uniqueSelections.values()) {
            const target = state.core.bases[selection.baseIndex!]?.minions.find((minion) => minion.uid === selection.minionUid);
            if (!target) continue;
            events.push(...buildValidatedDestroyEvents(state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: selection.baseIndex!,
                destroyerId: playerId,
                reason: 'kung_fu_fighters_lets_get_it_on',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'kung_fu_fighters_lets_get_it_on',
                sourceControllerId: playerId,
                sourceBaseIndex: selection.baseIndex,
            }));
        }
        return { events };
    },
});

const letsGetItOnChooseSourcePromptProgram = createPromptProgram<LetsGetItOnContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_lets_get_it_on_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `kung_fu_fighters_lets_get_it_on_source_${context.now}`,
        context.playerId,
        '让我们躁起来：选择你的一个随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
            },
        ),
        {
            sourceId: 'kung_fu_fighters_lets_get_it_on_source',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.kung_fu_fighters_lets_get_it_on_source_title',
        },
    ),
    onResolve: ({ state, value, playerId, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const source = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || source.controller !== playerId) {
            return { events: [] };
        }
        const sourcePower = getMinionPower(state.core, source, selected.baseIndex);
        const targetCount = state.core.bases[selected.baseIndex]?.minions.filter((minion) =>
            getMinionPower(state.core, minion, selected.baseIndex!) <= sourcePower,
        ).length ?? 0;
        if (targetCount === 0) {
            return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', timestamp)] };
        }
        return {
            events: [],
            context: createPromptContext(state, playerId, timestamp, {
                sourceMinionUid: source.uid,
                sourceBaseIndex: selected.baseIndex,
                sourcePower,
            }),
            nextProgram: letsGetItOnChooseTargetsPromptProgram,
        };
    },
});

const ohHohHohHoahPromptProgram = createPromptProgram<OhHohHohHoahContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'kung_fu_fighters_oh_hoh_hoh_hoah',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const ownMinions = (base?.minions ?? [])
            .filter((minion) => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_oh_hoh_hoh_hoah_${context.now}`,
            context.playerId,
            '哦-厚-厚-厚-厚：选择你的一个随从放置 1 枚指示物',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }),
            {
                sourceId: 'kung_fu_fighters_oh_hoh_hoh_hoah',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_oh_hoh_hoh_hoah_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!target || target.controller !== context.playerId) {
            return { events: [] };
        }
        return {
            events: [addPowerCounter(target.uid, selected.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', timestamp)],
        };
    },
});

const cricketOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) =>
    runCounterTransferProgram(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        {
            reason: 'kung_fu_fighters_cricket',
            sourcePromptTitle: '蟋蟀：选择要转出 1 枚指示物的随从',
            targetPromptTitle: '蟋蟀：选择接收该指示物的另一个随从',
            amountPromptTitle: '',
            allowSkip: true,
            fixedAmount: 1,
        },
    ));

const dragonWarriorTalentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) =>
    runCounterTransferProgram(
        ctx.matchState,
        ctx.playerId,
        ctx.now,
        {
            reason: 'kung_fu_fighters_dragon_warrior',
            sourcePromptTitle: '神龙武者：选择要转出指示物的随从',
            targetPromptTitle: '神龙武者：选择接收指示物的另一个随从',
            amountPromptTitle: '神龙武者：选择要转移的指示物数量',
        },
    ));

const ancientChineseArtTalentProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const base = ctx.state.bases[ctx.baseIndex];
    const canAdd = (base?.minions.length ?? 0) > 0;
    const canTransfer = collectCounterTransferSources(ctx.state).length > 0
        && collectAllMinions(ctx.state).length > 1;
    if (!canAdd && !canTransfer) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (canAdd && !canTransfer) {
        const onlyTargets = (base?.minions ?? []);
        if (onlyTargets.length === 1) {
            return { events: [addPowerCounter(onlyTargets[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_ancient_chinese_art', ctx.now)] };
        }
        const result = executeAbilityProgram(
            ancientChineseArtAddCounterPromptProgram,
            createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                reason: 'kung_fu_fighters_ancient_chinese_art',
                sourcePromptTitle: '',
                targetPromptTitle: '古老的中国艺术：选择本基地一个随从放置 1 枚指示物',
                amountPromptTitle: '',
                allowedAddBaseIndex: ctx.baseIndex,
            }),
        );
        return { events: result.events, matchState: result.matchState };
    }
    if (!canAdd && canTransfer) {
        return runCounterTransferProgram(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            {
                reason: 'kung_fu_fighters_ancient_chinese_art',
                sourcePromptTitle: '古老的中国艺术：选择要转出指示物的随从',
                targetPromptTitle: '古老的中国艺术：选择接收指示物的另一个随从',
                amountPromptTitle: '古老的中国艺术：选择要转移的指示物数量',
            },
        );
    }
    const result = executeAbilityProgram(
        ancientChineseArtModePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            cardUid: ctx.cardUid,
            baseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
});

const everybodyKnewOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        everybodyKnewPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const aLittleBitFrighteningOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const hasReference = collectAllMinions(ctx.state).some((candidate) => {
        const base = ctx.state.bases[candidate.baseIndex];
        const reference = base?.minions.find((minion) => minion.uid === candidate.uid);
        if (!base || !reference) return false;
        const referencePower = getMinionPower(ctx.state, reference, candidate.baseIndex);
        const hasLowerPowerTarget = base.minions.some((minion) =>
            minion.uid !== reference.uid && getMinionPower(ctx.state, minion, candidate.baseIndex) < referencePower,
        );
        const hasOwnRecipient = base.minions.some((minion) => minion.controller === ctx.playerId);
        return hasLowerPowerTarget && hasOwnRecipient;
    });
    if (!hasReference) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        aLittleBitFrighteningReferencePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

const letsGetItOnOnPlayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        letsGetItOnChooseSourcePromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
});

function runCounterTransferProgram(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    config: Omit<CounterTransferContext, 'matchState' | 'playerId' | 'now'>,
): AbilityResult {
    const sources = collectCounterTransferSources(matchState.core);
    if (sources.length === 0 || collectAllMinions(matchState.core).length < 2) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)] };
    }
    const result = executeAbilityProgram(
        kungFuCounterTransferSourcePromptProgram,
        createPromptContext(matchState, playerId, now, config),
    );
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function drunkenMasterTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) {
        return { events: [] };
    }
    if ((self.powerCounters ?? 0) > 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    return {
        events: [addPowerCounter(self.uid, ctx.baseIndex, 1, 'kung_fu_fighters_drunken_master', ctx.now)],
    };
}

function ladyWhirlwindTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) {
        return { events: [] };
    }
    if (self.powerCounters > 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    const selfPower = getMinionPower(ctx.state, self, ctx.baseIndex);
    const targets = ctx.state.bases[ctx.baseIndex]?.minions
        .filter((minion) => minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) < selfPower)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(ctx.state, minion, ctx.baseIndex)}）`,
        })) ?? [];
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (targets.length === 1) {
        const target = targets[0];
        const destroyEvents = buildValidatedDestroyEvents(ctx.matchState, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: ctx.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'kung_fu_fighters_lady_whirlwind',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'kung_fu_fighters_lady_whirlwind',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        });
        return {
            events: [
                ...destroyEvents,
                ...(destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? [addPowerCounter(self.uid, ctx.baseIndex, 1, 'kung_fu_fighters_lady_whirlwind', ctx.now)]
                    : []),
            ],
        };
    }
    const result = executeAbilityProgram(
        ladyWhirlwindPromptProgram,
        createPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            selfUid: ctx.cardUid,
            selfBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

const ladyWhirlwindPromptProgram = createPromptProgram<
    ZhongguoPromptContext & { selfUid: string; selfBaseIndex: number },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'kung_fu_fighters_lady_whirlwind',
    buildInteraction: (context) => {
        const self = context.matchState.core.bases[context.selfBaseIndex]?.minions.find((minion) => minion.uid === context.selfUid);
        const selfPower = self ? getMinionPower(context.matchState.core, self, context.selfBaseIndex) : 0;
        const targets = context.matchState.core.bases[context.selfBaseIndex]?.minions
            .filter((minion) => minion.uid !== context.selfUid && getMinionPower(context.matchState.core, minion, context.selfBaseIndex) < selfPower)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.selfBaseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(context.matchState.core, minion, context.selfBaseIndex)}）`,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `kung_fu_fighters_lady_whirlwind_${context.now}`,
            context.playerId,
            '旋风女侠：选择要消灭的更低战力随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            {
                sourceId: 'kung_fu_fighters_lady_whirlwind',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.kung_fu_fighters_lady_whirlwind_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { events: [] };
        }
        const self = state.core.bases[context.selfBaseIndex]?.minions.find((minion) => minion.uid === context.selfUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!self || !target || self.controller !== context.playerId) {
            return { events: [] };
        }
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: target.uid,
            minionDefId: target.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'kung_fu_fighters_lady_whirlwind',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.selfUid,
            sourceDefId: 'kung_fu_fighters_lady_whirlwind',
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.selfBaseIndex,
            sourceKind: 'nonAction',
        });
        return {
            events: [
                ...destroyEvents,
                ...(destroyEvents.some((event) => event.type === SU_EVENTS.MINION_DESTROYED)
                    ? [addPowerCounter(self.uid, context.selfBaseIndex, 1, 'kung_fu_fighters_lady_whirlwind', timestamp)]
                    : []),
            ],
        };
    },
});

function canTriggerOhHohHohHoah(ctx: TriggerContext): boolean {
    if (ctx.baseIndex === undefined || ctx.sourceControllerId === undefined) {
        return false;
    }
    if (ctx.playerId === ctx.sourceControllerId) {
        return false;
    }
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) {
        return false;
    }
    return base.minions.some((minion) => minion.controller === ctx.sourceControllerId);
}

function ohHohHohHoahTrigger(
    ctx: TriggerContext,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    if (!canTriggerOhHohHohHoah(ctx) || ctx.baseIndex === undefined || ctx.sourceControllerId === undefined) {
        return [];
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const ownMinions = base?.minions.filter((minion) => minion.controller === ctx.sourceControllerId) ?? [];
    if (ownMinions.length === 0) {
        return [];
    }
    if (ownMinions.length === 1) {
        return {
            events: [addPowerCounter(ownMinions[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', ctx.now)],
        };
    }
    if (!ctx.matchState) {
        return {
            events: [addPowerCounter(ownMinions[0].uid, ctx.baseIndex, 1, 'kung_fu_fighters_oh_hoh_hoh_hoah', ctx.now)],
        };
    }
    const result = executeAbilityProgram(
        ohHohHohHoahPromptProgram,
        createPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            baseIndex: ctx.baseIndex,
        }),
    );
    return {
        events: result.events,
        matchState: result.matchState ?? ctx.matchState,
    };
}

function ancientDojoOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const played = ctx.minionUid ? base?.minions.find((minion) => minion.uid === ctx.minionUid) : undefined;
    if (!base || !played) {
        return { events: [] };
    }
    const playedPower = getEffectivePower(ctx.state, played, ctx.baseIndex);
    const targets = base.minions.filter((minion) =>
        minion.uid !== played.uid
        && minion.controller === ctx.playerId
        && getEffectivePower(ctx.state, minion, ctx.baseIndex) < playedPower,
    );
    return {
        events: targets.map((minion) => addPowerCounter(minion.uid, ctx.baseIndex, 1, 'base_ancient_dojo', ctx.now)),
    };
}

export function registerZhongguoAbilities(): void {
    registerAbilityProgram('kung_fu_fighters_cricket', 'onPlay', {
        program: cricketOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_dragon_warrior', 'talent', {
        program: dragonWarriorTalentProgram,
        validateUse: (ctx) => {
            const hasSource = collectCounterTransferSources(ctx.state).length > 0;
            const hasTarget = collectAllMinions(ctx.state).length > 1;
            return hasSource && hasTarget ? null : '当前没有可转移指示物的有效目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_drunken_master', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(drunkenMasterTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            return (self.powerCounters ?? 0) === 0 ? null : '此随从上已有 +1 战力标记';
        },
    });
    registerAbilityProgram('kung_fu_fighters_lady_whirlwind', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(ladyWhirlwindTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find((minion) => minion.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            if (self.powerCounters > 0) return '此随从上已有 +1 战力标记';
            const selfPower = getMinionPower(ctx.state, self, ctx.baseIndex);
            const hasTarget = ctx.state.bases[ctx.baseIndex]?.minions.some((minion) =>
                minion.uid !== ctx.cardUid && getMinionPower(ctx.state, minion, ctx.baseIndex) < selfPower,
            ) ?? false;
            return hasTarget ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_ancient_chinese_art', 'talent', {
        program: ancientChineseArtTalentProgram,
        validateUse: (ctx) => {
            const baseHasMinion = (ctx.state.bases[ctx.baseIndex]?.minions.length ?? 0) > 0;
            const canTransfer = collectCounterTransferSources(ctx.state).length > 0
                && collectAllMinions(ctx.state).length > 1;
            return baseHasMinion || canTransfer ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('kung_fu_fighters_everybody_knew_their_part', 'onPlay', {
        program: everybodyKnewOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_a_little_bit_frightening', 'onPlay', {
        program: aLittleBitFrighteningOnPlayProgram,
    });
    registerAbilityProgram('kung_fu_fighters_lets_get_it_on', 'onPlay', {
        program: letsGetItOnOnPlayProgram,
    });

    registerProtection('kung_fu_fighters_dragon_warrior', 'destroy', (ctx) => ctx.targetMinion.defId === 'kung_fu_fighters_dragon_warrior');
    registerTrigger('kung_fu_fighters_oh_hoh_hoh_hoah', 'onMinionPlayed', ohHohHohHoahTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerOhHohHohHoah,
    });

    registerBaseAbility('base_ancient_dojo', 'onMinionPlayed', ancientDojoOnMinionPlayed);
    registerBaseVpModifier('base_tournament_site', (state, baseIndex, playerId, currentVp) => {
        if (currentVp <= 0) return 0;
        const base = state.bases[baseIndex];
        if (!base) return 0;
        const powers = state.turnOrder.map((candidatePlayerId) => ({
            playerId: candidatePlayerId,
            power: getPlayerEffectivePowerOnBase(state, base, baseIndex, candidatePlayerId),
        }));
        const highestPower = Math.max(...powers.map((entry) => entry.power), 0);
        if (highestPower <= 0) return 0;
        const leaders = powers.filter((entry) => entry.power === highestPower);
        if (leaders.length !== 1 || leaders[0]?.playerId !== playerId) return 0;
        return powers.filter((entry) => entry.power <= 0).length;
    });
}
