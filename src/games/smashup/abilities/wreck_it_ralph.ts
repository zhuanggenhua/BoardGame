import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildBaseTargetOptions,
    buildAbilityFeedback,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    grantContextualExtraAction,
    recoverCardsFromDiscard,
    shuffleBaseDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerActiveBaseAbility, registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import {
    registerCardAbilitySuppression,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import type {
    BaseReplacedEvent,
    CardSuppressedEvent,
    MinionMetadataUpdatedEvent,
    MinionOnBase,
    OngoingAttachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getMinionDef } from '../data/cards';
import {
    baseLabel,
    cardLabel,
    collectBaseModifiers,
    collectMinions,
    cardToDeckTop,
    firstOtherBaseIndex,
    getActionControllerId,
    isBaseModifier,
    moveMinionToBase,
    runtimeToAbilityResult,
} from './disney_shared';

const RALPH = 'wreck_it_ralph_wreck_it_ralph';
const FELIX = 'wreck_it_ralph_fix_it_felix_jr';
const VANELLOPE = 'wreck_it_ralph_vanellope_von_schweetz';
const CALHOUN = 'wreck_it_ralph_sergeant_calhoun';
const SUGAR_RUSH_RACER = 'wreck_it_ralph_sugar_rush_racer';
const SUGAR_RUSH_RACER_MOVE = 'wreck_it_ralph_sugar_rush_racer_move';
const CY_BUG_INFESTATION = 'wreck_it_ralph_cy_bug_infestation';
const ESCAPE_POD = 'wreck_it_ralph_escape_pod';
const IM_GONNA_WRECK_IT = 'wreck_it_ralph_i_m_gonna_wreck_it';
const KART_BAKERY = 'wreck_it_ralph_kart_bakery';
const KING_CANDY = 'wreck_it_ralph_king_candy';
const MINTS_ERUPTION = 'wreck_it_ralph_mints_eruption';
const RESEARCH_LAB_BEACON = 'wreck_it_ralph_research_lab_beacon';
const SUGAR_RUSH = 'wreck_it_ralph_sugar_rush';
const BASE_THE_DUMP = 'base_the_dump';
const BASE_THE_POWER_STRIP = 'base_the_power_strip';

type PowerStripMoveChoice = {
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    toBaseIndex?: number;
    skip?: true;
};

type PowerStripPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    baseIndex: number;
    now: number;
};

type BaseModifierChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
};

type RalphChoice =
    | (BaseModifierChoice & { mode: 'destroy' })
    | { mode: 'play'; cardUid: string; defId: string };

type BaseChoice = {
    baseIndex: number;
    baseDefId?: string;
};

type DiscardCardChoice = {
    cardUid: string;
    defId: string;
};

type BaseDiscardChoice = {
    baseDefId: string;
};

type MinionChoice = {
    minionUid: string;
    minionDefId: string;
    baseIndex: number;
};

type SkipChoice = {
    skip: true;
};

type SugarRushRacerMoveChoice = BaseChoice | SkipChoice;

type FactionChoice = {
    factionId: string;
};

type WreckPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    sourceCardUid: string;
    sourceDefId: string;
    sourceBaseIndex: number;
    now: number;
};

type MovePromptContext = WreckPromptContext & {
    reason: typeof ESCAPE_POD | typeof SUGAR_RUSH;
    maxCount: number;
    addTempPowerAfterMove: boolean;
    destinationBaseIndex?: number;
};

type KingCandyPromptContext = WreckPromptContext & {
    destinationBaseIndex?: number;
};

type WreckSourceContext = Pick<WreckPromptContext, 'playerId' | 'sourceCardUid' | 'sourceDefId' | 'sourceBaseIndex' | 'now'>;

function source(ctx: AbilityContext) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: ctx.baseIndex,
    };
}

function promptSource(context: WreckPromptContext) {
    return {
        sourcePlayerId: context.playerId,
        sourceCardUid: context.sourceCardUid,
        sourceDefId: context.sourceDefId,
        sourceControllerId: context.playerId,
        sourceBaseIndex: context.sourceBaseIndex,
    };
}

function firstOwnMinionHere(ctx: AbilityContext) {
    return ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.controller === ctx.playerId);
}

function collectBaseModifierPromptOptions(
    core: SmashUpCore,
    baseIndex: number,
): PromptOption<BaseModifierChoice>[] {
    return collectBaseModifiers(core, baseIndex).map((entry, index) => ({
        id: `base-modifier-${index}-${entry.action.uid}`,
        label: `${cardLabel(entry.action.defId)} @ ${baseLabel(core, baseIndex)}`,
        value: {
            cardUid: entry.action.uid,
            defId: entry.action.defId,
            ownerId: entry.action.ownerId,
            baseIndex,
        },
        displayMode: 'card' as const,
        _source: 'field' as const,
    }));
}

function collectDiscardBaseModifierOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<DiscardCardChoice>[] {
    return (core.players[playerId]?.discard ?? [])
        .filter(card => isBaseModifier(card.defId))
        .map(card => ({
            id: `discard-${card.uid}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'discard' as const,
        }));
}

function collectBaseDiscardOptions(core: SmashUpCore): PromptOption<BaseDiscardChoice>[] {
    return (core.baseDiscard ?? []).map((defId, index) => ({
        id: `base-discard-${index}-${defId}`,
        label: getBaseDef(defId)?.name ?? defId,
        value: { baseDefId: defId },
        displayMode: 'button' as const,
        _source: 'discard' as const,
    }));
}

function removeFirstBaseDefId(defIds: string[], targetDefId: string): string[] {
    const index = defIds.indexOf(targetDefId);
    if (index < 0) return defIds;
    return [...defIds.slice(0, index), ...defIds.slice(index + 1)];
}

function collectRalphOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): PromptOption<RalphChoice>[] {
    const destroyOptions: PromptOption<RalphChoice>[] = collectBaseModifiers(core, baseIndex).map((entry, index) => ({
        id: `destroy-${index}-${entry.action.uid}`,
        label: `消灭 ${cardLabel(entry.action.defId)} @ ${baseLabel(core, baseIndex)}`,
        value: {
            mode: 'destroy',
            cardUid: entry.action.uid,
            defId: entry.action.defId,
            ownerId: entry.action.ownerId,
            baseIndex,
        },
        displayMode: 'card' as const,
        _source: 'field' as const,
    }));
    const playOptions: PromptOption<RalphChoice>[] = (core.players[playerId]?.hand ?? [])
        .filter(card => isBaseModifier(card.defId))
        .map(card => ({
            id: `play-${card.uid}`,
            label: `额外打出 ${cardLabel(card.defId)}`,
            value: {
                mode: 'play',
                cardUid: card.uid,
                defId: card.defId,
            },
            displayMode: 'card' as const,
            _source: 'hand' as const,
        }));
    return [...destroyOptions, ...playOptions];
}

function collectOtherBaseOptions(core: SmashUpCore, baseIndex: number): PromptOption<BaseChoice>[] {
    return buildBaseTargetOptions(
        core.bases
            .map((base, index) => ({
                baseIndex: index,
                label: baseLabel(core, index),
                baseDefId: base.defId,
            }))
            .filter(base => base.baseIndex !== baseIndex),
        core,
    ) as PromptOption<BaseChoice>[];
}

function skipPromptOption(label = '跳过'): PromptOption<SkipChoice> {
    return {
        id: 'skip',
        label,
        labelKey: 'ui.skip',
        value: { skip: true },
        displayMode: 'button',
    };
}

function collectSugarRushRacerMoveOptions(ctx: TriggerContext): PromptOption<SugarRushRacerMoveChoice>[] {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const actionTargetBaseIndex = ctx.actionTargetBaseIndex;
    if (sourceBaseIndex === undefined || actionTargetBaseIndex === undefined) {
        return [];
    }
    const destinations = sourceBaseIndex === actionTargetBaseIndex
        ? collectOtherBaseOptions(ctx.state, sourceBaseIndex)
        : buildBaseTargetOptions([{
            baseIndex: actionTargetBaseIndex,
            label: baseLabel(ctx.state, actionTargetBaseIndex),
        }], ctx.state) as PromptOption<BaseChoice>[];
    return [skipPromptOption('不移动'), ...destinations];
}

function buildSugarRushRacerMoveEvents(
    state: MatchState<SmashUpCore> | SmashUpCore,
    core: SmashUpCore,
    racer: MinionOnBase,
    sourceBaseIndex: number,
    toBaseIndex: number,
    playerId: PlayerId,
    now: number,
): SmashUpEvent[] {
    if (sourceBaseIndex === toBaseIndex || !core.bases[toBaseIndex]) return [];
    return [
        ...moveMinionToBase(state, racer, sourceBaseIndex, toBaseIndex, playerId, SUGAR_RUSH_RACER, now),
        addTempPower(racer.uid, toBaseIndex, 1, SUGAR_RUSH_RACER, now, {
            sourcePlayerId: playerId,
            sourceCardUid: racer.uid,
            sourceDefId: SUGAR_RUSH_RACER,
            sourceControllerId: playerId,
            sourceBaseIndex,
        }),
    ];
}

function queueSugarRushRacerMovePrompt(ctx: TriggerContext, racer: MinionOnBase): TriggerResult {
    if (!ctx.matchState || !ctx.sourceControllerId || ctx.sourceBaseIndex === undefined) return { events: [] };
    const options = collectSugarRushRacerMoveOptions(ctx);
    if (options.length <= 1) return { events: [] };
    const interaction = createSimpleChoice<SugarRushRacerMoveChoice>(
        `${SUGAR_RUSH_RACER_MOVE}_${ctx.now}_${ctx.sourceCardUid}`,
        ctx.sourceControllerId,
        '甜蜜冲刺车手：选择是否移动此角色',
        options,
        {
            sourceId: SUGAR_RUSH_RACER_MOVE,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        sourceCardUid: racer.uid,
        sourceBaseIndex: ctx.sourceBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function collectMoveMinionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): PromptOption<MinionChoice | SkipChoice>[] {
    const candidates = (core.bases[baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getMinionDef(minion.defId)?.name ?? minion.defId,
        }));
    return [
        {
            id: 'skip',
            label: '跳过',
            labelKey: 'ui.skip',
            value: { skip: true },
            displayMode: 'button' as const,
        },
        ...(buildMinionTargetOptions(candidates, {
            state: core,
            sourcePlayerId: playerId,
            sourceKind: 'nonAction',
            semanticRole: 'reference',
        }) as PromptOption<MinionChoice>[]),
    ];
}

function collectKingCandyDestinationOptions(core: SmashUpCore, baseIndex: number): PromptOption<BaseChoice>[] {
    return buildBaseTargetOptions(
        core.bases
            .map((base, index) => ({
                baseIndex: index,
                label: baseLabel(core, index),
                baseDefId: base.defId,
                hasMinions: base.minions.length > 0,
            }))
            .filter(base => base.baseIndex !== baseIndex && base.hasMinions)
            .map(({ hasMinions: _hasMinions, ...base }) => base),
        core,
    ) as PromptOption<BaseChoice>[];
}

function collectMinionsAtBaseOptions(
    core: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId,
): PromptOption<MinionChoice>[] {
    return (core.bases[baseIndex]?.minions ?? []).map((minion, index) => ({
        id: `minion-${index}-${minion.uid}`,
        label: `${getMinionDef(minion.defId)?.name ?? minion.defId} @ ${baseLabel(core, baseIndex)}`,
        value: {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            baseIndex,
        },
        displayMode: 'card' as const,
        _source: 'field' as const,
    }));
}

function collectFactionOptions(core: SmashUpCore): PromptOption<FactionChoice>[] {
    const factions = new Map<string, string>();
    for (const base of core.bases) {
        for (const minion of base.minions) {
            const faction = getMinionDef(minion.defId)?.faction;
            if (faction && !factions.has(faction)) {
                factions.set(faction, faction);
            }
        }
    }
    return Array.from(factions.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([factionId, label]) => ({
            id: `faction-${factionId}`,
            label,
            value: { factionId },
            displayMode: 'button' as const,
        }));
}

const ralphPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: RALPH,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${RALPH}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '我要破坏它！：选择打出或消灭的基地修正牌',
        collectRalphOptions(context.matchState.core, context.playerId, context.sourceBaseIndex),
        {
            titleKey: 'ui.wreck_it_ralph_wreck_it_ralph_title',
            sourceId: RALPH,
            targetType: 'generic',
            genericIntent: 'mixed-card-and-control',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as RalphChoice | undefined;
        if (choice?.mode === 'destroy') {
            const target = collectBaseModifiers(state.core, context.sourceBaseIndex)
                .find(entry => entry.action.uid === choice.cardUid);
            if (!target) return { events: [] };
            return {
                events: buildValidatedOngoingDetachEvents(state.core, {
                    cardUid: target.action.uid,
                    defId: target.action.defId,
                    ownerId: target.action.ownerId,
                    reason: RALPH,
                    now: timestamp,
                    expectedLocation: 'base',
                    ...promptSource(context),
                }),
            };
        }

        if (choice?.mode === 'play') {
            const liveCard = state.core.players[context.playerId]?.hand.find(card =>
                card.uid === choice.cardUid && isBaseModifier(card.defId));
            if (!liveCard) return { events: [] };
            return {
                events: [grantContextualExtraAction({
                    playerId: context.playerId,
                    now: timestamp,
                    matchState: state,
                }, RALPH, {
                    restrictToBase: context.sourceBaseIndex,
                    restrictToCardUid: liveCard.uid,
                })],
            };
        }

        return { events: [] };
    },
});

const felixBaseModifierPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: FELIX,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${FELIX}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '阿修：选择要放回牌库顶的基地修正牌',
        collectBaseModifierPromptOptions(context.matchState.core, context.sourceBaseIndex),
        {
            titleKey: 'ui.wreck_it_ralph_fix_it_felix_jr_title',
            sourceId: FELIX,
            targetType: 'ongoing',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'field',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseModifierChoice | undefined;
        const target = collectBaseModifiers(state.core, context.sourceBaseIndex)
            .find(entry => entry.action.uid === choice?.cardUid);
        if (!target) return { events: [] };
        return {
            events: [cardToDeckTop(
                target.action.uid,
                target.action.defId,
                target.action.ownerId,
                FELIX,
                timestamp,
                context.playerId,
                context.sourceCardUid,
                context.sourceBaseIndex,
            )],
        };
    },
});

const felixDiscardRecoverPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: `${FELIX}_recover`,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${FELIX}_recover_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '阿修：选择弃牌堆中的基地修正牌加入手牌',
        collectDiscardBaseModifierOptions(context.matchState.core, context.playerId),
        {
            titleKey: 'ui.wreck_it_ralph_fix_it_felix_jr_recover_title',
            sourceId: `${FELIX}_recover`,
            targetType: 'discard',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'discard',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as DiscardCardChoice | undefined;
        const card = state.core.players[context.playerId]?.discard.find(candidate =>
            candidate.uid === choice?.cardUid
            && candidate.defId === choice?.defId
            && isBaseModifier(candidate.defId));
        return { events: card ? [recoverCardsFromDiscard(context.playerId, [card.uid], FELIX, timestamp)] : [] };
    },
});

const vanellopeDestinationPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: VANELLOPE,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${VANELLOPE}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '云妮洛普：选择要移动到的基地',
        collectOtherBaseOptions(context.matchState.core, context.sourceBaseIndex),
        {
            titleKey: 'ui.wreck_it_ralph_vanellope_von_schweetz_title',
            sourceId: VANELLOPE,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        const toBaseIndex = choice?.baseIndex;
        if (typeof toBaseIndex !== 'number' || toBaseIndex === context.sourceBaseIndex || !state.core.bases[toBaseIndex]) {
            return { events: [] };
        }
        const self = state.core.bases[context.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === context.sourceCardUid && minion.controller === context.playerId);
        if (!self) return { events: [] };
        return {
            events: [
                ...moveMinionToBase(state, self, context.sourceBaseIndex, toBaseIndex, context.playerId, VANELLOPE, timestamp),
                addPowerCounter(self.uid, toBaseIndex, 1, VANELLOPE, timestamp, promptSource(context)),
            ],
        };
    },
});

const moveDestinationPromptProgram = createPromptProgram<MovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wreck_it_ralph_choose_move_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `wreck_it_ralph_choose_move_destination_${context.reason}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        `${cardLabel(context.reason)}：选择目标基地`,
        collectOtherBaseOptions(context.matchState.core, context.sourceBaseIndex),
        {
            sourceId: 'wreck_it_ralph_choose_move_destination',
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        const toBaseIndex = choice?.baseIndex;
        if (typeof toBaseIndex !== 'number' || toBaseIndex === context.sourceBaseIndex || !state.core.bases[toBaseIndex]) {
            return { events: [] };
        }
        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                destinationBaseIndex: toBaseIndex,
            },
            nextProgram: moveMinionsPromptProgram,
        };
    },
});

const moveMinionsPromptProgram = createPromptProgram<MovePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wreck_it_ralph_choose_move_minions',
    buildInteraction: (context) => {
        const options = collectMoveMinionOptions(
            context.matchState.core,
            context.playerId,
            context.sourceBaseIndex,
        );
        const liveTargetCount = options.filter(option => !(option.value as SkipChoice).skip).length;
        const max = Math.min(context.maxCount, liveTargetCount);
        return createAbilityRuntimeSimpleChoice(
            `wreck_it_ralph_choose_move_minions_${context.reason}_${context.now}_${context.sourceCardUid}`,
            context.playerId,
            `${cardLabel(context.reason)}：选择至多 ${context.maxCount} 个己方角色移动`,
            options,
            {
                sourceId: 'wreck_it_ralph_choose_move_minions',
                targetType: 'minion',
                multi: context.maxCount > 1 ? { min: 0, max } : undefined,
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                autoRefresh: 'field',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        if (typeof context.destinationBaseIndex !== 'number') return { events: [] };
        const choices = (Array.isArray(value) ? value : [value]) as Array<MinionChoice | SkipChoice | undefined>;
        if (choices.some(choice => choice?.skip)) return { events: [] };
        const selected = Array.from(new Map(
            choices
                .filter((choice): choice is MinionChoice => !!choice && !(choice as SkipChoice).skip)
                .map(choice => [choice.minionUid, choice] as const),
        ).values()).slice(0, context.maxCount);
        const events: SmashUpEvent[] = [];
        for (const choice of selected) {
            const minion = state.core.bases[context.sourceBaseIndex]?.minions.find(candidate =>
                candidate.uid === choice.minionUid
                && candidate.defId === choice.minionDefId
                && candidate.controller === context.playerId);
            if (!minion) continue;
            events.push(...moveMinionToBase(
                state,
                minion,
                context.sourceBaseIndex,
                context.destinationBaseIndex,
                context.playerId,
                context.reason,
                timestamp,
            ));
            if (context.addTempPowerAfterMove) {
                events.push(addTempPower(
                    minion.uid,
                    context.destinationBaseIndex,
                    1,
                    context.reason,
                    timestamp,
                    promptSource(context),
                ));
            }
        }
        return { events };
    },
});

const kingCandyDestinationPromptProgram = createPromptProgram<KingCandyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wreck_it_ralph_king_candy_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${KING_CANDY}_destination_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '糖果国王：选择移动到的基地',
        collectKingCandyDestinationOptions(context.matchState.core, context.sourceBaseIndex),
        {
            titleKey: 'ui.wreck_it_ralph_king_candy_destination_title',
            sourceId: 'wreck_it_ralph_king_candy_destination',
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        const destinationBaseIndex = choice?.baseIndex;
        if (
            typeof destinationBaseIndex !== 'number'
            || destinationBaseIndex === context.sourceBaseIndex
            || !state.core.bases[destinationBaseIndex]
            || state.core.bases[destinationBaseIndex].minions.length === 0
        ) {
            return { events: [] };
        }
        return {
            events: [],
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                destinationBaseIndex,
            },
            nextProgram: kingCandyTargetPromptProgram,
        };
    },
});

function buildKingCandyEvents(
    state: SmashUpCore,
    context: KingCandyPromptContext,
    destinationBaseIndex: number,
    target: MinionChoice,
    timestamp: number,
): SmashUpEvent[] {
    const current = collectBaseModifiers(state, context.sourceBaseIndex)
        .find(entry => entry.action.uid === context.sourceCardUid);
    const liveTarget = state.bases[destinationBaseIndex]?.minions.find(minion =>
        minion.uid === target.minionUid && minion.defId === target.minionDefId);
    if (!current || !liveTarget) return [];
    return [
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: context.sourceCardUid,
                defId: context.sourceDefId,
                ownerId: current.action.ownerId,
                sourcePlayerId: context.playerId,
                targetType: 'base',
                targetBaseIndex: destinationBaseIndex,
                metadata: {
                    ...(current.action.metadata ?? {}),
                    kingCandyTargetMinionUid: liveTarget.uid,
                },
                talentUsed: true,
            },
            timestamp,
        } as OngoingAttachedEvent,
        ...liveTarget.attachedActions.map(action => ({
            type: SU_EVENTS.CARD_SUPPRESSED,
            payload: {
                cardUid: action.uid,
                baseIndex: destinationBaseIndex,
                suppressorPlayerId: context.playerId,
                cardType: 'attached',
                reason: KING_CANDY,
                ...promptSource(context),
            },
            timestamp,
        } as CardSuppressedEvent)),
        {
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: liveTarget.uid,
                baseIndex: destinationBaseIndex,
                metadataUpdate: {
                    kingCandyCounterSuppressedBy: context.sourceCardUid,
                    kingCandyCounterSuppressedByPlayerId: context.playerId,
                },
                reason: KING_CANDY,
            },
            timestamp,
        } as MinionMetadataUpdatedEvent,
    ];
}

const kingCandyTargetPromptProgram = createPromptProgram<KingCandyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wreck_it_ralph_king_candy_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${KING_CANDY}_target_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '糖果国王：选择该基地的角色',
        collectMinionsAtBaseOptions(context.matchState.core, context.destinationBaseIndex ?? context.sourceBaseIndex, context.playerId),
        {
            titleKey: 'ui.wreck_it_ralph_king_candy_target_title',
            sourceId: 'wreck_it_ralph_king_candy_target',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            autoRefresh: 'field',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (typeof context.destinationBaseIndex !== 'number' || choice?.baseIndex !== context.destinationBaseIndex) {
            return { events: [] };
        }
        return {
            events: buildKingCandyEvents(state.core, context, context.destinationBaseIndex, choice, timestamp),
        };
    },
});

const researchLabBeaconPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: RESEARCH_LAB_BEACON,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${RESEARCH_LAB_BEACON}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '研究灯塔：指定一个派系',
        collectFactionOptions(context.matchState.core),
        {
            titleKey: 'ui.wreck_it_ralph_research_lab_beacon_title',
            sourceId: RESEARCH_LAB_BEACON,
            targetType: 'generic',
            genericIntent: 'definition-choice',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as FactionChoice | undefined;
        const factionId = choice?.factionId;
        if (!factionId) return { events: [] };
        return {
            events: collectMinions(state.core, minion => getMinionDef(minion.defId)?.faction === factionId)
                .filter(entry => entry.baseIndex !== context.sourceBaseIndex)
                .flatMap(entry => buildValidatedMoveEvents(state, {
                    minionUid: entry.minion.uid,
                    minionDefId: entry.minion.defId,
                    fromBaseIndex: entry.baseIndex,
                    toBaseIndex: context.sourceBaseIndex,
                    ...promptSource(context),
                    sourceKind: 'action',
                    reason: RESEARCH_LAB_BEACON,
                    now: timestamp,
                })),
        };
    },
});

function buildMintsEruptionEvents(
    core: SmashUpCore,
    context: WreckSourceContext,
    replacementBaseDefId: string,
    timestamp: number,
): SmashUpEvent[] {
    const oldBaseDefId = core.bases[context.sourceBaseIndex]?.defId;
    if (!oldBaseDefId || !core.baseDiscard?.includes(replacementBaseDefId)) return [];
    return [
        {
            type: SU_EVENTS.BASE_REPLACED,
            payload: {
                baseIndex: context.sourceBaseIndex,
                oldBaseDefId,
                newBaseDefId: replacementBaseDefId,
                keepCards: true,
                allowMissingFromBaseDeck: true,
            },
            timestamp,
        } as BaseReplacedEvent,
        shuffleBaseDeck(core.baseDeck, MINTS_ERUPTION, timestamp, {
            newBaseDiscardDefIds: [
                ...removeFirstBaseDefId(core.baseDiscard ?? [], replacementBaseDefId),
                oldBaseDefId,
            ],
        }) as SmashUpEvent,
    ];
}

const mintsEruptionPromptProgram = createPromptProgram<WreckPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: MINTS_ERUPTION,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${MINTS_ERUPTION}_${context.now}_${context.sourceCardUid}`,
        context.playerId,
        '薄荷喷发：选择要交换的弃牌堆基地',
        collectBaseDiscardOptions(context.matchState.core),
        {
            titleKey: 'ui.wreck_it_ralph_mints_eruption_title',
            sourceId: MINTS_ERUPTION,
            targetType: 'generic',
            genericIntent: 'definition-choice',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseDiscardChoice | undefined;
        return {
            events: choice?.baseDefId
                ? buildMintsEruptionEvents(state.core, context, choice.baseDefId, timestamp)
                : [],
        };
    },
});

function ralphTalent(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        const options = collectRalphOptions(ctx.matchState.core, ctx.playerId, ctx.baseIndex);
        if (options.length === 0) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
        }
        return runtimeToAbilityResult(executeAbilityProgram(ralphPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }

    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)[0];
    if (baseModifier) {
        return {
            events: buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: baseModifier.action.uid,
                defId: baseModifier.action.defId,
                ownerId: baseModifier.action.ownerId,
                reason: RALPH,
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
        };
    }
    const handBaseModifier = ctx.state.players[ctx.playerId]?.hand.find(card => isBaseModifier(card.defId));
    if (!handBaseModifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [grantContextualExtraAction(ctx, RALPH, {
            restrictToBase: ctx.baseIndex,
            restrictToCardUid: handBaseModifier.uid,
        })],
    };
}

function felixOnPlay(ctx: AbilityContext): AbilityResult {
    const options = collectDiscardBaseModifierOptions(ctx.state, ctx.playerId);
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(felixDiscardRecoverPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }
    return { events: [] };
}

function felixTalent(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        const options = collectBaseModifierPromptOptions(ctx.matchState.core, ctx.baseIndex);
        if (options.length === 0) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
        }
        return runtimeToAbilityResult(executeAbilityProgram(felixBaseModifierPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }

    return { events: [] };
}

function vanellopeTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const self = base?.minions.find(minion => minion.uid === ctx.cardUid && minion.controller === ctx.playerId);
    if (!self) return { events: [] };
    const directToBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== ctx.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if (ctx.matchState && directToBaseIndex === undefined) {
        return runtimeToAbilityResult(executeAbilityProgram(vanellopeDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }
    if (directToBaseIndex === undefined) return { events: [] };
    return {
        events: [
            ...moveMinionToBase(ctx.matchState, self, ctx.baseIndex, directToBaseIndex, ctx.playerId, VANELLOPE, ctx.now),
            addPowerCounter(self.uid, directToBaseIndex, 1, VANELLOPE, ctx.now, source(ctx)),
        ],
    };
}

function calhounTalent(ctx: AbilityContext): AbilityResult {
    const hasBaseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex).length > 0;
    if (!hasBaseModifier) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
            .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
            .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, CALHOUN, ctx.now, source(ctx))),
    };
}

function sugarRushRacerOnBaseModifier(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.actionTargetBaseIndex === undefined) return [];
    if (!ctx.triggerCardDefId || !isBaseModifier(ctx.triggerCardDefId)) return [];
    const sourceBaseIndex = ctx.sourceBaseIndex;
    if (sourceBaseIndex === undefined) return [];
    const sourceBase = ctx.state.bases[sourceBaseIndex];
    const racer = sourceBase?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!racer) return [];
    if (ctx.matchState) return queueSugarRushRacerMovePrompt(ctx, racer);
    return [];
}

function cyBugInfestationTalent(ctx: AbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)
        .find(entry => entry.action.uid === ctx.cardUid);
    if (!baseModifier) return { events: [] };
    return {
        events: buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.cardUid,
            defId: ctx.defId,
            ownerId: baseModifier.action.ownerId,
            reason: CY_BUG_INFESTATION,
            now: ctx.now,
            expectedLocation: 'base',
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }),
    };
}

function escapePodMove(ctx: AbilityContext, maxCount: number): AbilityResult {
    const movableCount = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId).length;
    if (movableCount === 0) return { events: [] };
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(moveDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
            reason: ESCAPE_POD,
            maxCount,
            addTempPowerAfterMove: false,
        }));
    }
    return { events: [] };
}

function iAmGonnaWreckItTalent(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.BASE_ABILITY_SUPPRESSED,
            payload: {
                baseIndex: ctx.baseIndex,
                suppressorPlayerId: ctx.playerId,
                reason: IM_GONNA_WRECK_IT,
                ...source(ctx),
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function kartBakeryTalent(ctx: AbilityContext): AbilityResult {
    if (!firstOwnMinionHere(ctx)) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function kingCandyTalent(ctx: AbilityContext): AbilityResult {
    const current = collectBaseModifiers(ctx.state, ctx.baseIndex).find(entry => entry.action.uid === ctx.cardUid);
    if (!current) return { events: [] };
    if (ctx.matchState) {
        const options = collectKingCandyDestinationOptions(ctx.matchState.core, ctx.baseIndex);
        if (options.length === 0) return { events: [] };
        return runtimeToAbilityResult(executeAbilityProgram(kingCandyDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }
    return { events: [] };
}

function mintsEruption(ctx: AbilityContext): AbilityResult {
    const replacement = ctx.state.baseDiscard?.[0];
    if (!replacement) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(mintsEruptionPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }
    return { events: buildMintsEruptionEvents(ctx.state, {
        playerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex: ctx.baseIndex,
        now: ctx.now,
    }, replacement, ctx.now) };
}

function researchLabBeaconTalent(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        const options = collectFactionOptions(ctx.matchState.core);
        if (options.length === 0) return { events: [] };
        return runtimeToAbilityResult(executeAbilityProgram(researchLabBeaconPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
        }));
    }

    const sourceFaction = ctx.state.bases[ctx.baseIndex]?.minions[0]
        ? getMinionDef(ctx.state.bases[ctx.baseIndex].minions[0].defId)?.faction
        : undefined;
    if (!sourceFaction) return { events: [] };
    return {
        events: collectMinions(ctx.state, minion => getMinionDef(minion.defId)?.faction === sourceFaction)
            .filter(entry => entry.baseIndex !== ctx.baseIndex)
            .flatMap(entry => buildValidatedMoveEvents(ctx.matchState, {
                minionUid: entry.minion.uid,
                minionDefId: entry.minion.defId,
                fromBaseIndex: entry.baseIndex,
                toBaseIndex: ctx.baseIndex,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'action',
                reason: RESEARCH_LAB_BEACON,
                now: ctx.now,
            })),
    };
}

function researchLabBeaconSelfDestruct(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base || base.minions.length < 4) return [];
    return buildValidatedOngoingDetachEvents(ctx.state, {
        cardUid: ctx.sourceCardUid,
        defId: RESEARCH_LAB_BEACON,
        ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        reason: RESEARCH_LAB_BEACON,
        now: ctx.now,
        expectedLocation: 'base',
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: RESEARCH_LAB_BEACON,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    });
}

function sugarRushTalent(ctx: AbilityContext): AbilityResult {
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (toBaseIndex === undefined) return { events: [] };
    const movableCount = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId).length;
    if (movableCount === 0) return { events: [] };
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(moveDestinationPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
            now: ctx.now,
            reason: SUGAR_RUSH,
            maxCount: 2,
            addTempPowerAfterMove: true,
        }));
    }
    return { events: [] };
}

function theDumpAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const baseModifier = collectBaseModifiers(ctx.state, ctx.baseIndex)
        .find(entry => getActionControllerId(entry.action) === ctx.playerId);
    if (!baseModifier) return { events: [] };
    return {
        events: [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: baseModifier.action.uid,
                defId: baseModifier.action.defId,
                ownerId: baseModifier.action.ownerId,
                destination: 'hand',
                reason: BASE_THE_DUMP,
                sourcePlayerId: ctx.playerId,
                sourceDefId: BASE_THE_DUMP,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function collectPowerStripMoveOptions(core: SmashUpCore, playerId: string, baseIndex: number): PromptOption<PowerStripMoveChoice>[] {
    const options: PromptOption<PowerStripMoveChoice>[] = [];
    const sourceBase = core.bases[baseIndex];
    if (!sourceBase) return options;

    core.bases.forEach((base, fromBaseIndex) => {
        base.minions
            .filter(minion => minion.controller === playerId)
            .forEach((minion) => {
                const label = getMinionDef(minion.defId)?.name ?? minion.defId;
                if (fromBaseIndex === baseIndex) {
                    core.bases.forEach((destination, toBaseIndex) => {
                        if (toBaseIndex === baseIndex) return;
                        options.push({
                            id: `move-${minion.uid}-to-${toBaseIndex}`,
                            label: `${label} -> ${destination.defId}`,
                            value: {
                                minionUid: minion.uid,
                                minionDefId: minion.defId,
                                fromBaseIndex,
                                toBaseIndex,
                            },
                            _source: 'field',
                            displayMode: 'card',
                        });
                    });
                    return;
                }
                options.push({
                    id: `move-${minion.uid}-to-power-strip`,
                    label: `${label} -> ${sourceBase.defId}`,
                    value: {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        fromBaseIndex,
                        toBaseIndex: baseIndex,
                    },
                    _source: 'field',
                    displayMode: 'card',
                });
            });
    });

    return options;
}

const powerStripPromptProgram = createPromptProgram<PowerStripPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: BASE_THE_POWER_STRIP,
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${BASE_THE_POWER_STRIP}_${context.now}_${context.baseIndex}`,
        context.playerId,
        '电源插排：选择一个己方角色移入或移出此基地',
        [
            ...collectPowerStripMoveOptions(context.matchState.core, context.playerId, context.baseIndex),
            {
                id: 'skip',
                label: '跳过',
                labelKey: 'ui.common.skip',
                value: { skip: true },
                displayMode: 'button',
            },
        ],
        {
            titleKey: 'ui.base_the_power_strip_title',
            sourceId: BASE_THE_POWER_STRIP,
            targetType: 'minion',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, playerId, value, context, timestamp }) => {
        const choice = value as PowerStripMoveChoice | undefined;
        if (!choice?.minionUid || typeof choice.fromBaseIndex !== 'number' || typeof choice.toBaseIndex !== 'number') {
            return { events: [] };
        }
        const minion = state.core.bases[choice.fromBaseIndex]?.minions.find(candidate =>
            candidate.uid === choice.minionUid
            && candidate.defId === choice.minionDefId
            && candidate.controller === playerId,
        );
        if (!minion) return { events: [] };
        if (state.core.bases[context.baseIndex]?.defId !== BASE_THE_POWER_STRIP) return { events: [] };
        const fromIsPowerStrip = choice.fromBaseIndex === context.baseIndex;
        const toIsPowerStrip = choice.toBaseIndex === context.baseIndex;
        if (fromIsPowerStrip === toIsPowerStrip) return { events: [] };
        return {
            events: moveMinionToBase(state, minion, choice.fromBaseIndex, choice.toBaseIndex, playerId, BASE_THE_POWER_STRIP, timestamp),
        };
    },
});

function powerStripActive(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const options = collectPowerStripMoveOptions(ctx.state, ctx.playerId, ctx.baseIndex);
    if (options.length === 0) return { events: [] };
    const result = executeAbilityProgram(powerStripPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        now: ctx.now,
    });
    return { events: result.events, matchState: result.matchState };
}

export function registerWreckItRalphAbilities(): void {
    registerInteractionHandler(SUGAR_RUSH_RACER_MOVE, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as SugarRushRacerMoveChoice | undefined;
        if ((selected as SkipChoice | undefined)?.skip) return { state, events: [] };
        const source = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        const toBaseIndex = (selected as BaseChoice | undefined)?.baseIndex;
        if (!source?.sourceCardUid || source.sourceBaseIndex === undefined || typeof toBaseIndex !== 'number') {
            return { state, events: [] };
        }
        const racer = state.core.bases[source.sourceBaseIndex]?.minions.find(minion =>
            minion.uid === source.sourceCardUid && minion.controller === playerId);
        if (!racer) return { state, events: [] };
        return {
            state,
            events: buildSugarRushRacerMoveEvents(
                state,
                state.core,
                racer,
                source.sourceBaseIndex,
                toBaseIndex,
                playerId,
                timestamp,
            ),
        };
    });

    registerAbilityProgram(RALPH, 'talent', { program: createEffectProgram(ralphTalent) });
    registerAbilityProgram(FELIX, 'onPlay', { program: createEffectProgram(felixOnPlay) });
    registerAbilityProgram(FELIX, 'talent', { program: createEffectProgram(felixTalent) });
    registerAbilityProgram(VANELLOPE, 'talent', { program: createEffectProgram(vanellopeTalent) });
    registerAbilityProgram(CALHOUN, 'talent', { program: createEffectProgram(calhounTalent) });
    registerAbilityProgram(CY_BUG_INFESTATION, 'talent', { program: createEffectProgram(cyBugInfestationTalent) });
    registerAbilityProgram(ESCAPE_POD, 'onPlay', { program: createEffectProgram(ctx => escapePodMove(ctx, 2)) });
    registerAbilityProgram(ESCAPE_POD, 'special', { program: createEffectProgram(ctx => escapePodMove(ctx, 1)) });
    registerAbilityProgram(IM_GONNA_WRECK_IT, 'talent', { program: createEffectProgram(iAmGonnaWreckItTalent) });
    registerAbilityProgram(KART_BAKERY, 'talent', { program: createEffectProgram(kartBakeryTalent) });
    registerAbilityProgram(KING_CANDY, 'talent', { program: createEffectProgram(kingCandyTalent) });
    registerAbilityProgram(MINTS_ERUPTION, 'onPlay', { program: createEffectProgram(mintsEruption) });
    registerAbilityProgram(RESEARCH_LAB_BEACON, 'talent', { program: createEffectProgram(researchLabBeaconTalent) });
    registerAbilityProgram(SUGAR_RUSH, 'talent', { program: createEffectProgram(sugarRushTalent) });

    registerTrigger(SUGAR_RUSH_RACER, 'onActionPlayed', sugarRushRacerOnBaseModifier, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => !!ctx.triggerCardDefId && isBaseModifier(ctx.triggerCardDefId),
    });
    registerTrigger(RESEARCH_LAB_BEACON, 'onMinionPlayed', researchLabBeaconSelfDestruct, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerCardAbilitySuppression(KING_CANDY, (state) => {
        const suppressed: string[] = [];
        for (const base of state.bases) {
            const targets = new Set(base.ongoingActions
                .filter(action => action.defId === KING_CANDY)
                .map(action => action.metadata?.kingCandyTargetMinionUid)
                .filter((uid): uid is string => typeof uid === 'string'));
            if (targets.size === 0) continue;
            for (const minion of base.minions) {
                if (!targets.has(minion.uid)) continue;
                suppressed.push(...minion.attachedActions.map(action => action.uid));
            }
        }
        return suppressed;
    });

    registerBaseAbility(BASE_THE_DUMP, 'afterScoring', theDumpAfterScoring, { mandatory: false });
    registerActiveBaseAbility(BASE_THE_POWER_STRIP, powerStripActive, {
        oncePerTurn: false,
        canUse: ctx => collectPowerStripMoveOptions(ctx.state, ctx.playerId, ctx.baseIndex).length > 0,
    });
}
