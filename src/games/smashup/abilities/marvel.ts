import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    getMinionPower,
    inspectDeck,
    queueMinionPlayEffect,
    revealAndPickFromDeck,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { getBaseDef, getCardDef } from '../data/cards';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { getSmashUpReactionWindowContext } from '../domain/reactionWindowState';
import {
    registerCardAbilitySuppression,
    registerProtection,
    registerTrigger,
    type TriggerContext,
} from '../domain/ongoingEffects';
import type {
    CardToDeckBottomEvent,
    CardToDeckTopEvent,
    CardInstance,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type MarvelPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type MarvelDrawContinuationContext = MarvelPromptContext & {
    random: RandomFn;
    drawCount: number;
};

type ShieldRescueMissionContext = MarvelDrawContinuationContext & {
    baseIndex: number;
};

type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type BaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type SuperiorFirepowerChoice = MinionChoice & {
    cardUid?: string;
    ownerId?: PlayerId;
    kind?: 'minion' | 'ongoing';
};

type SuperiorFirepowerOption = {
    id: string;
    label: string;
    value: SuperiorFirepowerChoice;
    _source?: 'board' | 'ongoing';
    displayMode?: 'card';
    displayCard?: { defId: string; cardUid?: string };
};

type ShieldReassignmentContext = MarvelPromptContext & {
    targetBaseIndex: number;
};

type MoveMinionContext = MarvelPromptContext & {
    sourceId: string;
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    reason: string;
};

type ScrambleSourceContext = MarvelPromptContext & {
    candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

type UltimatesMoveContext = MoveMinionContext & {
    powerBonus?: number;
};

type PowerAndSpeedContext = MarvelPromptContext & {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type HeroicLandingContext = MarvelPromptContext & {
    movedUids: string[];
};

type CoordinatedAttackContext = MarvelPromptContext & {
    targetBaseIndex: number;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
};

type DeckOrderChoice = {
    topUids?: string[];
    bottomUids?: string[];
};

type ViewFromAboveTypeChoice = {
    cardType?: 'minion' | 'action';
};

type SpiderVerseDeckSelectionContext = MarvelPromptContext & {
    sourceId: 'spider_verse_spider_reflexes' | 'spider_verse_ghost_spider';
    revealed: Array<{ uid: string; defId: string }>;
};

type SpiderVerseDeckOrderContext = MarvelPromptContext & {
    sourceId: 'spider_verse_spider_reflexes' | 'spider_verse_ghost_spider';
    remaining: Array<{ uid: string; defId: string }>;
};

type SpiderVerseGreatPowerContext = MarvelPromptContext & {
    amount: number;
    sourceBaseIndex?: number;
};

function runtimeToAbilityResult(result: {
    events: SmashUpEvent[];
    matchState?: MatchState<SmashUpCore>;
}): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function findMinion(
    state: SmashUpCore,
    minionUid: string,
): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex].minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function buildOwnMinionOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    options: { excludeBaseIndex?: number; includeBaseIndex?: number } = {},
) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        if (options.excludeBaseIndex !== undefined && baseIndex === options.excludeBaseIndex) continue;
        if (options.includeBaseIndex !== undefined && baseIndex !== options.includeBaseIndex) continue;
        for (const minion of state.bases[baseIndex].minions) {
            if (minion.controller !== playerId) continue;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        }
    }
    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: playerId,
        sourceKind: 'nonAction',
        effectType: 'affect',
    });
}

function buildMoveToBaseEvents(
    state: SmashUpCore,
    params: {
        playerId: PlayerId;
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
        toBaseIndex: number;
        reason: string;
        now: number;
        sourceDefId: string;
        sourceKind?: 'action' | 'nonAction';
    },
): SmashUpEvent[] {
    if (params.fromBaseIndex === params.toBaseIndex) return [];
    return buildValidatedMoveEvents(state, {
        minionUid: params.minionUid,
        minionDefId: params.minionDefId,
        fromBaseIndex: params.fromBaseIndex,
        toBaseIndex: params.toBaseIndex,
        reason: params.reason,
        now: params.now,
        sourcePlayerId: params.playerId,
        sourceControllerId: params.playerId,
        sourceDefId: params.sourceDefId,
        sourceBaseIndex: params.fromBaseIndex,
        sourceKind: params.sourceKind ?? 'action',
    });
}

const shieldReassignmentPromptProgram = createPromptProgram<ShieldReassignmentContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'shield_reassignment',
    buildInteraction: (context) => {
        const options = [
            ...buildOwnMinionOptions(context.matchState.core, context.playerId, {
                excludeBaseIndex: context.targetBaseIndex,
            }),
            createSkipOption(),
        ];
        return createAbilityRuntimeSimpleChoice(
            `shield_reassignment_${context.now}`,
            context.playerId,
            '调任：选择至多两个你的其他基地角色移动到目标基地',
            options,
            {
                sourceId: 'shield_reassignment',
                targetType: 'minion',
                titleKey: 'ui.shield_reassignment_title',
                multi: { min: 0, max: Math.min(2, options.length) },
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const events: SmashUpEvent[] = [];
        for (const choice of choices.slice(0, 2)) {
            if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) continue;
            const live = state.core.bases[choice.baseIndex]?.minions.find(
                minion => minion.uid === choice.minionUid && minion.controller === playerId,
            );
            if (!live || choice.baseIndex === context.targetBaseIndex) continue;
            events.push(...buildMoveToBaseEvents(state.core, {
                playerId,
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
                toBaseIndex: context.targetBaseIndex,
                reason: 'shield_reassignment',
                now: timestamp,
                sourceDefId: 'shield_reassignment',
            }));
        }
        return { events };
    },
});

const shieldSuperiorFirepowerPromptProgram = createPromptProgram<MarvelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'shield_superior_firepower',
    buildInteraction: (context) => {
        const minionTargets = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => getMinionPower(context.matchState.core, minion, baseIndex) <= 3)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                }))
        ));
        const minionOptions = buildMinionTargetOptions(minionTargets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceKind: 'action',
            effectType: 'destroy',
        }).map(option => ({
            ...option,
            value: { ...option.value, kind: 'minion' as const },
        }));
        const ongoingOptions = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.ongoingActions.map((ongoing, index) => ({
                id: `ongoing-${baseIndex}-${index}`,
                label: getCardDef(ongoing.defId)?.name ?? ongoing.defId,
                value: {
                    kind: 'ongoing' as const,
                    cardUid: ongoing.uid,
                    defId: ongoing.defId,
                    ownerId: ongoing.ownerId,
                    baseIndex,
                },
                _source: 'ongoing' as const,
                displayMode: 'card' as const,
            }))
        ));
        return createAbilityRuntimeSimpleChoice(
            `shield_superior_firepower_${context.now}`,
            context.playerId,
            '强大的火力：选择力量不超过3的角色或一个基地神器',
            [...minionOptions, ...ongoingOptions] as SuperiorFirepowerOption[],
            {
                sourceId: 'shield_superior_firepower',
                targetType: 'ongoing',
                titleKey: 'ui.shield_superior_firepower_title',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const choice = value as SuperiorFirepowerChoice | undefined;
        if (!choice) return { events: [] };
        if (choice.kind === 'ongoing' && choice.cardUid) {
            return {
                events: buildValidatedOngoingDetachEvents(state.core, {
                    cardUid: choice.cardUid,
                    defId: choice.defId,
                    ownerId: choice.ownerId,
                    expectedLocation: 'base',
                    reason: 'shield_superior_firepower',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'shield_superior_firepower',
                    sourceControllerId: playerId,
                    sourceBaseIndex: choice.baseIndex,
                }),
            };
        }
        if (!choice.minionUid || choice.baseIndex === undefined) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!live || getMinionPower(state.core, live, choice.baseIndex) > 3) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
                destroyerId: playerId,
                reason: 'shield_superior_firepower',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceControllerId: playerId,
                sourceDefId: 'shield_superior_firepower',
                sourceBaseIndex: choice.baseIndex,
                sourceKind: 'action',
            }),
        };
    },
});

const chooseMoveDestinationPromptProgram = createPromptProgram<MoveMinionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'marvel_move_destination',
    interactionSourceIds: [
        'ultimates_captain_marvel_move',
        'ultimates_spectrum_move',
        'ultimates_lift_and_carry_destination',
        'ultimates_scramble_destination',
    ],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择目标基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => candidate.baseIndex !== context.fromBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: context.sourceId,
            targetType: 'base',
            titleKey: 'ui.marvel_choose_base_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const live = state.core.bases[context.fromBaseIndex]?.minions.find(
            minion => minion.uid === context.minionUid,
        );
        if (!live) return { events: [] };
        return {
            events: buildMoveToBaseEvents(state.core, {
                playerId,
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                reason: context.reason,
                now: timestamp,
                sourceDefId: context.reason,
                sourceKind: context.reason.startsWith('ultimates_') && context.reason.includes('captain_marvel')
                    ? 'nonAction'
                    : 'action',
            }),
        };
    },
});

const scrambleSourcePromptProgram = createPromptProgram<ScrambleSourceContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_scramble_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ultimates_scramble_source_${context.now}`,
        context.playerId,
        '争夺：选择你的一个随从',
        buildMinionTargetOptions(context.candidates, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: 'ultimates_scramble',
            sourceKind: 'action',
            effectType: 'move',
            respectActionProtection: true,
        }),
        {
            sourceId: 'ultimates_scramble_source',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.ultimates_scramble_source_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion =>
            minion.uid === choice.minionUid && minion.controller === context.playerId);
        if (!live) return { events: [] };
        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: 'ultimates_scramble_destination',
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: choice.baseIndex,
                reason: 'ultimates_scramble',
            } satisfies MoveMinionContext,
            nextProgram: chooseMoveDestinationPromptProgram,
        };
    },
});

const ultimatesMoveDestinationPromptProgram = createPromptProgram<UltimatesMoveContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_move_with_bonus_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${context.now}`,
        context.playerId,
        '选择目标基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => candidate.baseIndex !== context.fromBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: context.sourceId,
            targetType: 'base',
            titleKey: 'ui.ultimates_move_with_bonus_destination_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const live = state.core.bases[context.fromBaseIndex]?.minions.find(
            minion => minion.uid === context.minionUid && minion.controller === playerId,
        );
        if (!live) return { events: [] };
        const events = buildMoveToBaseEvents(state.core, {
            playerId,
            minionUid: live.uid,
            minionDefId: live.defId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: choice.baseIndex,
            reason: context.reason,
            now: timestamp,
            sourceDefId: context.reason,
            sourceKind: 'nonAction',
        });
        if (context.powerBonus) {
            for (const minion of state.core.bases[choice.baseIndex]?.minions ?? []) {
                if (minion.controller !== playerId || minion.uid === live.uid) continue;
                events.push(addTempPower(
                    minion.uid,
                    choice.baseIndex,
                    context.powerBonus,
                    context.reason,
                    timestamp,
                    {
                        sourcePlayerId: playerId,
                        sourceDefId: context.reason,
                        sourceControllerId: playerId,
                        sourceBaseIndex: choice.baseIndex,
                    },
                ));
            }
        }
        return { events };
    },
});

const powerAndSpeedMovePromptProgram = createPromptProgram<PowerAndSpeedContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_power_and_speed_move',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ultimates_power_and_speed_move_${context.now}`,
        context.playerId,
        '力量与速度：可以将该角色移动到另一个基地',
        [
            ...buildBaseTargetOptions(
                context.matchState.core.bases
                    .map((base, baseIndex) => ({
                        baseIndex,
                        label: getBaseDef(base.defId)?.name ?? base.defId,
                    }))
                    .filter(candidate => candidate.baseIndex !== context.fromBaseIndex),
                context.matchState.core,
            ),
            createSkipOption(),
        ],
        {
            sourceId: 'ultimates_power_and_speed_move',
            targetType: 'base',
            titleKey: 'ui.ultimates_power_and_speed_move_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.skip || choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const live = state.core.bases[context.fromBaseIndex]?.minions.find(
            minion => minion.uid === context.minionUid && minion.controller === playerId,
        );
        if (!live) return { events: [] };
        return {
            events: buildMoveToBaseEvents(state.core, {
                playerId,
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: choice.baseIndex,
                reason: 'ultimates_power_and_speed',
                now: timestamp,
                sourceDefId: 'ultimates_power_and_speed',
            }),
        };
    },
});

const marvelDrawAfterCommittedProgram = createEffectProgram<MarvelDrawContinuationContext, SmashUpCore, SmashUpEvent>(
    (context) => ({
        events: buildStandardDrawEvents(
            context.matchState.core,
            context.playerId,
            context.drawCount,
            context.random,
            context.now,
        ),
    }),
);

const cosmicKnowledgePromptProgram = createPromptProgram<MarvelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_cosmic_knowledge',
    buildInteraction: (context) => {
        const hand = context.matchState.core.players[context.playerId]?.hand ?? [];
        return createAbilityRuntimeSimpleChoice(
            `ultimates_cosmic_knowledge_${context.now}`,
            context.playerId,
            '宇宙知识：选择任意数量手牌放到牌库底',
            hand.map((card, index) => ({
                id: `hand-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
                _source: 'hand' as const,
                displayMode: 'card' as const,
                displayCard: { defId: card.defId, cardUid: card.uid },
            })),
            {
                sourceId: 'ultimates_cosmic_knowledge',
                targetType: 'hand',
                titleKey: 'ui.ultimates_cosmic_knowledge_title',
                multi: { min: 0, max: hand.length },
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: (args) => {
        const { state, playerId, value, random, timestamp } = args;
        const choices = (Array.isArray(value) ? value : []) as CardChoice[];
        const selected = new Set(
            choices.map(choice => choice.cardUid).filter((uid): uid is string => !!uid),
        );
        const hand = state.core.players[playerId]?.hand ?? [];
        const selectedCards = hand.filter(card => selected.has(card.uid));
        const bottomEvents: CardToDeckBottomEvent[] = selectedCards.map(card => ({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                reason: 'ultimates_cosmic_knowledge',
                sourcePlayerId: playerId,
                sourceDefId: 'ultimates_cosmic_knowledge',
                sourceControllerId: playerId,
            },
            timestamp,
        }));
        return {
            events: bottomEvents,
            context: {
                matchState: state,
                playerId,
                random,
                now: timestamp,
                drawCount: selectedCards.length + 1,
            },
            nextProgram: marvelDrawAfterCommittedProgram,
        };
    },
});

const heroicLandingSourcePromptProgram = createPromptProgram<HeroicLandingContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_heroic_landing_source',
    buildInteraction: (context) => {
        const options = [
            ...buildOwnMinionOptions(context.matchState.core, context.playerId)
                .filter(option => !context.movedUids.includes(option.value.minionUid)),
            createSkipOption(),
        ];
        return createAbilityRuntimeSimpleChoice(
            `ultimates_heroic_landing_source_${context.movedUids.length}_${context.now}`,
            context.playerId,
            '英雄登场：选择一个你的角色移动，或跳过结束',
            options,
            {
                sourceId: 'ultimates_heroic_landing_source',
                targetType: 'minion',
                titleKey: 'ui.ultimates_heroic_landing_source_title',
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(
            minion => minion.uid === choice.minionUid && minion.controller === context.playerId,
        );
        if (!live) return { events: [] };
        return runtimeToAbilityResult(executeAbilityProgram(heroicLandingDestinationPromptProgram, {
            ...context,
            minionUid: live.uid,
            minionDefId: live.defId,
            fromBaseIndex: choice.baseIndex,
            movedUids: [...context.movedUids, live.uid],
            now: timestamp,
        }));
    },
});

const heroicLandingDestinationPromptProgram = createPromptProgram<
    HeroicLandingContext & { minionUid: string; minionDefId: string; fromBaseIndex: number },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'ultimates_heroic_landing_destination',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ultimates_heroic_landing_destination_${context.now}`,
        context.playerId,
        '英雄登场：选择目标基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => candidate.baseIndex !== context.fromBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: 'ultimates_heroic_landing_destination',
            targetType: 'base',
            titleKey: 'ui.ultimates_heroic_landing_destination_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined || choice.baseIndex === context.fromBaseIndex) return { events: [] };
        const live = state.core.bases[context.fromBaseIndex]?.minions.find(
            minion => minion.uid === context.minionUid && minion.controller === playerId,
        );
        if (!live) return { events: [] };
        const events = buildMoveToBaseEvents(state.core, {
            playerId,
            minionUid: live.uid,
            minionDefId: live.defId,
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: choice.baseIndex,
            reason: 'ultimates_heroic_landing',
            now: timestamp,
            sourceDefId: 'ultimates_heroic_landing',
        });
        return {
            events,
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                movedUids: context.movedUids,
            },
            nextProgram: heroicLandingSourcePromptProgram,
        };
    },
});

function buildCoordinatedAttackEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    choices: MinionChoice[],
    targetBaseIndex: number,
    now: number,
): SmashUpEvent[] {
    const batchId = `ultimates_coordinated_attack_${now}`;
    const events: SmashUpEvent[] = [];
    const selected = new Set<string>();
    for (const choice of choices) {
        if (choice?.skip || !choice?.minionUid || choice.baseIndex === undefined) continue;
        if (selected.has(choice.minionUid) || choice.baseIndex === targetBaseIndex) continue;
        selected.add(choice.minionUid);
        const live = state.bases[choice.baseIndex]?.minions.find(
            minion => minion.uid === choice.minionUid && minion.controller === playerId,
        );
        if (!live) continue;
        events.push(...buildValidatedMoveEvents(state, {
            minionUid: live.uid,
            minionDefId: live.defId,
            fromBaseIndex: choice.baseIndex,
            toBaseIndex: targetBaseIndex,
            reason: 'ultimates_coordinated_attack',
            now,
            sourcePlayerId: playerId,
            sourceControllerId: playerId,
            sourceDefId: 'ultimates_coordinated_attack',
            sourceBaseIndex: targetBaseIndex,
            sourceKind: 'action',
            batchId,
        }));
        events.push(addTempPower(live.uid, targetBaseIndex, 1, 'ultimates_coordinated_attack', now, {
            sourcePlayerId: playerId,
            sourceDefId: 'ultimates_coordinated_attack',
            sourceControllerId: playerId,
            sourceBaseIndex: targetBaseIndex,
        }));
    }
    return events;
}

const coordinatedAttackPromptProgram = createPromptProgram<CoordinatedAttackContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_coordinated_attack',
    buildInteraction: (context) => {
        const minionOptions = buildOwnMinionOptions(context.matchState.core, context.playerId, {
            excludeBaseIndex: context.targetBaseIndex,
        });
        return createAbilityRuntimeSimpleChoice(
            `ultimates_coordinated_attack_${context.now}`,
            context.playerId,
            '协同攻击：选择至多三个其他基地的己方角色移动到此基地',
            [...minionOptions, createSkipOption()],
            {
                sourceId: 'ultimates_coordinated_attack',
                targetType: 'minion',
                titleKey: 'ui.ultimates_coordinated_attack_title',
                multi: { min: 0, max: Math.min(3, minionOptions.length) },
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        return {
            events: buildCoordinatedAttackEvents(
                state.core,
                playerId,
                choices.slice(0, 3),
                context.targetBaseIndex,
                timestamp,
            ),
        };
    },
});

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)])
            .map(rest => [item, ...rest]),
    );
}

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function buildSpiderVerseDeckOrderOptions(remaining: Array<{ uid: string; defId: string }>) {
    return permutations(remaining).flatMap((ordered, permutationIndex) =>
        Array.from({ length: ordered.length + 1 }, (_unused, splitIndex) => {
            const top = ordered.slice(0, splitIndex);
            const bottom = ordered.slice(splitIndex);
            const topLabel = top.length > 0 ? top.map(card => cardLabel(card.defId)).join(' → ') : '无';
            const bottomLabel = bottom.length > 0 ? bottom.map(card => cardLabel(card.defId)).join(' → ') : '无';
            return {
                id: `order-${permutationIndex}-${splitIndex}`,
                label: `牌库顶：${topLabel}；牌库底：${bottomLabel}`,
                value: {
                    topUids: top.map(card => card.uid),
                    bottomUids: bottom.map(card => card.uid),
                } satisfies DeckOrderChoice,
            };
        }),
    );
}

function buildSpiderVerseDeckReorderEvent(
    state: SmashUpCore,
    playerId: PlayerId,
    remaining: Array<{ uid: string; defId: string }>,
    choice: DeckOrderChoice | undefined,
    timestamp: number,
): DeckReorderedEvent | undefined {
    const remainingUidSet = new Set(remaining.map(card => card.uid));
    const orderedUids = [...(choice?.topUids ?? []), ...(choice?.bottomUids ?? [])];
    if (
        orderedUids.length !== remainingUidSet.size
        || new Set(orderedUids).size !== remainingUidSet.size
        || orderedUids.some(uid => !remainingUidSet.has(uid))
    ) {
        return undefined;
    }
    const playerDeck = state.players[playerId]?.deck ?? [];
    const byUid = new Map(playerDeck.map(card => [card.uid, card]));
    const topCards = (choice?.topUids ?? []).map(uid => byUid.get(uid)).filter(Boolean) as CardInstance[];
    const bottomCards = (choice?.bottomUids ?? []).map(uid => byUid.get(uid)).filter(Boolean) as CardInstance[];
    if (topCards.length + bottomCards.length !== remainingUidSet.size) {
        return undefined;
    }
    const liveRest = playerDeck.filter(card => !remainingUidSet.has(card.uid));
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [
                ...topCards.map(card => card.uid),
                ...liveRest.map(card => card.uid),
                ...bottomCards.map(card => card.uid),
            ],
        },
        timestamp,
    };
}

const spiderVerseDeckOrderPromptProgram = createPromptProgram<SpiderVerseDeckOrderContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'spider_verse_deck_order',
    interactionSourceIds: ['spider_verse_spider_reflexes_order', 'spider_verse_ghost_spider_order'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_order_${context.now}`,
        context.playerId,
        '将剩余牌按任意顺序放到牌库顶和/或牌库底',
        buildSpiderVerseDeckOrderOptions(context.remaining),
        {
            sourceId: `${context.sourceId}_order`,
            targetType: 'generic',
            titleKey: 'ui.spider_verse_deck_order_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const reorder = buildSpiderVerseDeckReorderEvent(
            state.core,
            context.playerId,
            context.remaining,
            value as DeckOrderChoice | undefined,
            timestamp,
        );
        return { events: reorder ? [reorder] : [] };
    },
});

const spiderVerseDeckSelectionPromptProgram = createPromptProgram<SpiderVerseDeckSelectionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'spider_verse_deck_selection',
    interactionSourceIds: ['spider_verse_spider_reflexes_pick', 'spider_verse_ghost_spider_pick'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_pick_${context.now}`,
        context.playerId,
        '选择其中一张加入手牌',
        context.revealed.map((card, index) => ({
            id: `card-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
            _source: 'deck' as const,
        })),
        {
            sourceId: `${context.sourceId}_pick`,
            targetType: 'generic',
            titleKey: 'ui.spider_verse_deck_selection_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as CardChoice | undefined;
        const selected = choice?.cardUid
            ? context.revealed.find(card => card.uid === choice.cardUid)
            : undefined;
        if (!selected) return { events: [] };
        const drawEvent: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: {
                playerId: context.playerId,
                count: 1,
                cardUids: [selected.uid],
            },
            timestamp,
        };
        const remaining = context.revealed.filter(card => card.uid !== selected.uid);
        if (remaining.length === 0) return { events: [drawEvent] };
        return {
            events: [drawEvent],
            context: {
                ...context,
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                sourceId: context.sourceId,
                remaining,
            },
            nextProgram: spiderVerseDeckOrderPromptProgram,
        };
    },
});

const spiderVerseGreatPowerPromptProgram = createPromptProgram<SpiderVerseGreatPowerContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'spider_verse_with_great_power',
    buildInteraction: (context) => {
        const candidates = context.matchState.core.bases.flatMap((base, baseIndex) => {
            if (context.sourceBaseIndex !== undefined && baseIndex !== context.sourceBaseIndex) return [];
            return base.minions.map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        });
        return createAbilityRuntimeSimpleChoice(
            `spider_verse_with_great_power_${context.now}`,
            context.playerId,
            '能力越大…：选择获得力量的角色',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'spider_verse_with_great_power',
                sourceKind: 'action',
                effectType: 'buff',
            }),
            {
                sourceId: 'spider_verse_with_great_power',
                titleKey: 'ui.spider_verse_with_great_power_title',
                targetType: 'minion',
                responseValidationMode: 'live',
            },
        );
    },
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const choice = value as MinionChoice | undefined;
        if (!choice?.minionUid || choice.baseIndex === undefined) return { events: [] };
        if (context.sourceBaseIndex !== undefined && choice.baseIndex !== context.sourceBaseIndex) return { events: [] };
        const live = state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid);
        if (!live) return { events: [] };
        return {
            events: [addTempPower(live.uid, choice.baseIndex, context.amount, 'spider_verse_with_great_power', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'spider_verse_with_great_power',
                sourceControllerId: playerId,
                sourceBaseIndex: context.sourceBaseIndex ?? choice.baseIndex,
            })],
        };
    },
});

function buildViewFromAboveEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    declaredType: 'minion' | 'action',
    random: AbilityContext['random'],
    now: number,
): SmashUpEvent[] {
    const result = revealAndPickFromDeck({
        state,
        random,
        playerId,
        predicate: card => card.type === declaredType,
        maxPick: 1,
        missTarget: 'deck_bottom',
        revealTo: 'all',
        reason: 'spider_verse_view_from_above',
        now,
    });

    if (result.missed.length === 0) return result.events;
    const player = state.players[playerId];
    if (!player) return result.events;
    const pickedUids = new Set(result.picked.map(card => card.uid));
    const missedUids = new Set(result.missed.map(card => card.uid));
    const liveDeckRemainder = player.deck.filter(card => !pickedUids.has(card.uid) && !missedUids.has(card.uid));
    const shuffledMissed = random.shuffle([...result.missed]);
    const reorderIndex = result.events.findIndex(event => event.type === SU_EVENTS.DECK_REORDERED);
    if (reorderIndex === -1) return result.events;

    const shuffledReorder: DeckReorderedEvent = {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [
                ...liveDeckRemainder.map(card => card.uid),
                ...result.picked.map(card => card.uid),
                ...shuffledMissed.map(card => card.uid),
            ],
        },
        timestamp: now,
    };
    return [
        ...result.events.slice(0, reorderIndex),
        shuffledReorder,
        ...result.events.slice(reorderIndex + 1),
    ];
}

const spiderVerseViewFromAbovePromptProgram = createPromptProgram<MarvelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'spider_verse_view_from_above',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `spider_verse_view_from_above_${context.now}`,
        context.playerId,
        '高处不胜寒：声明要展示到的牌类型',
        [
            { id: 'minion', label: '角色', labelKey: 'ui.spider_verse_view_from_above_minion_option', value: { cardType: 'minion' } satisfies ViewFromAboveTypeChoice },
            { id: 'action', label: '法术', labelKey: 'ui.spider_verse_view_from_above_action_option', value: { cardType: 'action' } satisfies ViewFromAboveTypeChoice },
        ],
        {
            sourceId: 'spider_verse_view_from_above',
            targetType: 'generic',
            titleKey: 'ui.spider_verse_view_from_above_title',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => {
        const choice = value as ViewFromAboveTypeChoice | undefined;
        const declaredType = choice?.cardType;
        if (declaredType !== 'minion' && declaredType !== 'action') return { events: [] };
        return {
            events: buildViewFromAboveEvents(state.core, playerId, declaredType, random, timestamp),
        };
    },
});

const ultimatesFirstToArrivePromptProgram = createPromptProgram<MarvelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'ultimates_first_to_arrive',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `ultimates_first_to_arrive_${context.now}`,
        context.playerId,
        '率先抵达：选择一个没有己方角色的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, baseIndex) => ({
                    baseIndex,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                }))
                .filter(candidate => !context.matchState.core.bases[candidate.baseIndex]?.minions
                    .some(minion => minion.controller === context.playerId)),
            context.matchState.core,
        ),
        {
            sourceId: 'ultimates_first_to_arrive',
            targetType: 'base',
            titleKey: 'ui.ultimates_first_to_arrive_title',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as BaseChoice | undefined;
        if (choice?.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[choice.baseIndex];
        if (!base || base.minions.some(minion => minion.controller === context.playerId)) return { events: [] };
        return {
            events: [grantContextualExtraMinion(
                { playerId: context.playerId, now: timestamp, matchState: state },
                'ultimates_first_to_arrive',
                choice.baseIndex,
            )],
        };
    },
});

function extraMinion(ctx: AbilityContext, reason: string, restrictToBase?: number, powerMax?: number): AbilityResult {
    return {
        events: [grantContextualExtraMinion(ctx, reason, restrictToBase, powerMax === undefined ? undefined : { powerMax })],
    };
}

function shieldMissionDebriefing(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const count = ctx.state.bases[baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId).length ?? 0;
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, count, ctx.random, ctx.now),
    };
}

function shieldReassignment(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(shieldReassignmentPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        targetBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
        now: ctx.now,
    }));
}

function shieldSuperiorFirepower(ctx: AbilityContext): AbilityResult {
    if (ctx.targetMinionUid) {
        const found = findMinion(ctx.state, ctx.targetMinionUid);
        if (!found || getMinionPower(ctx.state, found.minion, found.baseIndex) > 3) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(ctx.state, {
                minionUid: found.minion.uid,
                minionDefId: found.minion.defId,
                fromBaseIndex: found.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'shield_superior_firepower',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceControllerId: ctx.playerId,
                sourceDefId: 'shield_superior_firepower',
                sourceBaseIndex: found.baseIndex,
                sourceKind: 'action',
            }),
        };
    }
    return runtimeToAbilityResult(executeAbilityProgram(shieldSuperiorFirepowerPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
}

function shieldTogether(ctx: AbilityContext): AbilityResult {
    const events = ctx.state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => addTempPower(
                minion.uid,
                baseIndex,
                1,
                'shield_together',
                ctx.now,
                {
                    sourcePlayerId: ctx.playerId,
                    sourceDefId: 'shield_together',
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: baseIndex,
                },
            ))
    ));
    return { events };
}

function ultimatesSelfMoveTalent(ctx: AbilityContext, sourceId: string, bonusAfterMove = 0): AbilityResult {
    const found = findMinion(ctx.state, ctx.cardUid);
    if (!found || found.minion.controller !== ctx.playerId) return { events: [] };
    const program = bonusAfterMove === 0 ? chooseMoveDestinationPromptProgram : ultimatesMoveDestinationPromptProgram;
    return runtimeToAbilityResult(executeAbilityProgram(program, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: `${sourceId}_move`,
        minionUid: found.minion.uid,
        minionDefId: found.minion.defId,
        fromBaseIndex: found.baseIndex,
        reason: sourceId,
        powerBonus: bonusAfterMove,
    }));
}

function ultimatesCoordinatedAttack(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const movable = ctx.state.bases.flatMap((base, baseIndex) => (
        baseIndex === targetBaseIndex
            ? []
            : base.minions
                .filter(minion => minion.controller === ctx.playerId)
                .map(minion => ({ minion, baseIndex }))
    ));
    if (movable.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(coordinatedAttackPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        targetBaseIndex,
    }));
}

function ultimatesCosmicKnowledge(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand ?? [];
    if (hand.length === 0) {
        return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
    }
    return runtimeToAbilityResult(executeAbilityProgram(cosmicKnowledgePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
}

function ultimatesFirstToArrive(ctx: AbilityContext): AbilityResult {
    const legalBaseIndexes = ctx.state.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ base }) => !base.minions.some(minion => minion.controller === ctx.playerId))
        .map(({ baseIndex }) => baseIndex);
    if (legalBaseIndexes.length === 0) return { events: [] };
    if (!ctx.matchState) {
        return extraMinion(ctx, 'ultimates_first_to_arrive', legalBaseIndexes[0]);
    }
    return runtimeToAbilityResult(executeAbilityProgram(ultimatesFirstToArrivePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
    }));
}

function ultimatesHeroicLanding(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(heroicLandingSourcePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        movedUids: [],
    }));
}

function ultimatesLiftAndCarry(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const found = findMinion(ctx.state, ctx.targetMinionUid);
    if (!found) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseMoveDestinationPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'ultimates_lift_and_carry_destination',
        minionUid: found.minion.uid,
        minionDefId: found.minion.defId,
        fromBaseIndex: found.baseIndex,
        reason: 'ultimates_lift_and_carry',
    }));
}

function ultimatesPowerAndSpeed(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const found = findMinion(ctx.state, ctx.targetMinionUid);
    if (!found || found.minion.controller !== ctx.playerId) return { events: [] };
    const powerEvent = addTempPower(found.minion.uid, found.baseIndex, 2, 'ultimates_power_and_speed', ctx.now, {
        sourcePlayerId: ctx.playerId,
        sourceDefId: 'ultimates_power_and_speed',
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: found.baseIndex,
    });
    const movePrompt = executeAbilityProgram(powerAndSpeedMovePromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        minionUid: found.minion.uid,
        minionDefId: found.minion.defId,
        fromBaseIndex: found.baseIndex,
    });
    return {
        events: [powerEvent],
        ...(movePrompt.matchState ? { matchState: movePrompt.matchState } : {}),
    };
}

function ultimatesScramble(ctx: AbilityContext): AbilityResult {
    const owned = ctx.state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => ({ minion, baseIndex }))
    ));
    if (!ctx.targetMinionUid && ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(scrambleSourcePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            candidates: owned.map(({ minion, baseIndex }) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
        }));
    }
    const selected = ctx.targetMinionUid
        ? owned.find(entry => entry.minion.uid === ctx.targetMinionUid)
        : owned[0];
    if (!selected) return { events: [] };
    return runtimeToAbilityResult(executeAbilityProgram(chooseMoveDestinationPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'ultimates_scramble_destination',
        minionUid: selected.minion.uid,
        minionDefId: selected.minion.defId,
        fromBaseIndex: selected.baseIndex,
        reason: 'ultimates_scramble',
    }));
}

function getSpiderVerseGreatPowerResponseBaseIndex(ctx: AbilityContext): number | undefined {
    const reactionWindow = getSmashUpReactionWindowContext(ctx.matchState);
    if (reactionWindow?.windowType !== 'meFirst') return undefined;
    return ctx.targetBaseIndex ?? reactionWindow.sourceBaseIndex;
}

function spiderVerseWithGreatPower(ctx: AbilityContext, special = false): AbilityResult {
    const found = ctx.targetMinionUid ? findMinion(ctx.state, ctx.targetMinionUid) : undefined;
    const sourceBaseIndex = special ? ctx.baseIndex : getSpiderVerseGreatPowerResponseBaseIndex(ctx);
    const amount = special || sourceBaseIndex !== undefined ? 2 : 3;
    if (!found) {
        if (!ctx.matchState) return { events: [] };
        return runtimeToAbilityResult(executeAbilityProgram(spiderVerseGreatPowerPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            amount,
            ...(sourceBaseIndex !== undefined ? { sourceBaseIndex } : {}),
        }));
    }
    if (sourceBaseIndex !== undefined && found.baseIndex !== sourceBaseIndex) return { events: [] };
    return {
        events: [addTempPower(found.minion.uid, found.baseIndex, amount, 'spider_verse_with_great_power', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'spider_verse_with_great_power',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: sourceBaseIndex ?? found.baseIndex,
        })],
    };
}

function spiderVerseSpiderSense(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
}

function spiderVerseDeckSelection(
    ctx: AbilityContext,
    sourceId: 'spider_verse_spider_reflexes' | 'spider_verse_ghost_spider',
): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealed = player.deck.slice(0, 3).map(card => ({ uid: card.uid, defId: card.defId }));
    if (revealed.length === 0) return { events: [] };
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, sourceId, ctx.now),
        revealDeckTop(ctx.playerId, ctx.playerId, revealed, revealed.length, sourceId, ctx.now, ctx.playerId),
    ];
    if (ctx.matchState) {
        const prompted = executeAbilityProgram(spiderVerseDeckSelectionPromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            sourceId,
            revealed,
        });
        return {
            events: [...events, ...prompted.events],
            ...(prompted.matchState ? { matchState: prompted.matchState } : {}),
        };
    }
    return {
        events: [
            ...events,
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: [revealed[0].uid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent,
        ],
    };
}

function spiderVerseSpiderReflexes(ctx: AbilityContext): AbilityResult {
    const selection = spiderVerseDeckSelection(ctx, 'spider_verse_spider_reflexes');
    return {
        events: [
            ...selection.events,
            grantContextualExtraAction(ctx, 'spider_verse_spider_reflexes'),
        ],
        ...(selection.matchState ? { matchState: selection.matchState } : {}),
    };
}

function spiderVerseGreatResponsibility(ctx: AbilityContext, special = false): AbilityResult {
    const events = [
        grantContextualExtraMinion(ctx, 'spider_verse_great_responsibility', special ? (ctx.targetBaseIndex ?? ctx.baseIndex) : undefined),
        queueMinionPlayEffect(ctx.playerId, 'addTempPower', -1, ctx.now, 'spider_verse_great_responsibility'),
    ];
    return { events };
}

function spiderVerseMilesMorales(ctx: AbilityContext): AbilityResult {
    const reactionWindow = getSmashUpReactionWindowContext(ctx.matchState);
    if (
        reactionWindow?.windowType !== 'meFirst'
        || reactionWindow.activePlayerId !== ctx.playerId
        || reactionWindow.sourceBaseIndex !== ctx.baseIndex
    ) {
        return { events: [] };
    }

    return {
        events: [addTempPower(ctx.cardUid, ctx.baseIndex, -1, 'spider_verse_miles_morales', ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'spider_verse_miles_morales',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        })],
    };
}

function spiderVerseGhostSpider(ctx: AbilityContext): AbilityResult {
    return spiderVerseDeckSelection(ctx, 'spider_verse_ghost_spider');
}

function spiderVerseViewFromAbove(ctx: AbilityContext): AbilityResult {
    if (ctx.matchState) {
        return runtimeToAbilityResult(executeAbilityProgram(spiderVerseViewFromAbovePromptProgram, {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
        }));
    }
    return {
        events: buildViewFromAboveEvents(ctx.state, ctx.playerId, 'minion', ctx.random, ctx.now),
    };
}

function shieldProvingGround(ctx: AbilityContext): AbilityResult {
    return extraMinion(ctx, 'shield_proving_ground', ctx.baseIndex, 3);
}

function ultimatesAidFromAllies(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function marvelCardToDeckTop(
    card: { uid: string; defId: string; owner: PlayerId },
    sourcePlayerId: PlayerId,
    sourceDefId: string,
    now: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            sourcePlayerId,
            sourceDefId,
            sourceControllerId: sourcePlayerId,
            reason: sourceDefId,
        },
        timestamp: now,
    };
}

const shieldRescueMissionProgram = createEffectProgram<ShieldRescueMissionContext, SmashUpCore, SmashUpEvent>(
    (context) => {
        const owned = context.matchState.core.bases[context.baseIndex]?.minions
            .filter(minion => minion.controller === context.playerId) ?? [];
        const topEvents = owned.map(minion => marvelCardToDeckTop(
            { uid: minion.uid, defId: minion.defId, owner: minion.owner },
            context.playerId,
            'shield_rescue_mission',
            context.now,
        ));
        return {
            events: topEvents,
            context: {
                matchState: context.matchState,
                playerId: context.playerId,
                random: context.random,
                now: context.now,
                drawCount: 1,
            },
            nextProgram: marvelDrawAfterCommittedProgram,
        };
    },
);

function shieldRescueMission(ctx: AbilityContext): AbilityResult {
    return runtimeToAbilityResult(executeAbilityProgram(shieldRescueMissionProgram, {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        random: ctx.random,
        now: ctx.now,
        drawCount: 1,
        baseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
    }));
}

function spiderVerseFriendlyNeighborhoodHero(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const selected = ctx.targetMinionUid
        ? findMinion(ctx.state, ctx.targetMinionUid)
        : undefined;
    const minion = selected?.baseIndex === baseIndex && selected.minion.controller === ctx.playerId
        ? selected.minion
        : ctx.state.bases[baseIndex]?.minions.find(candidate => candidate.controller === ctx.playerId);
    if (!minion) return { events: [] };
    return {
        events: [marvelCardToDeckTop(
            { uid: minion.uid, defId: minion.defId, owner: minion.owner },
            ctx.playerId,
            'spider_verse_friendly_neighborhood_hero',
            ctx.now,
        )],
    };
}

function shieldMariaHillTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.baseIndex !== ctx.sourceBaseIndex) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    return [addTempPower(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'shield_maria_hill', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceDefId: 'shield_maria_hill',
        sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function ultimatesAmericaChavezTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];
    const entered = ctx.moveToBaseIndex === ctx.sourceBaseIndex;
    const left = ctx.moveFromBaseIndex === ctx.sourceBaseIndex;
    if (!entered && !left) return [];
    return [addTempPower(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'ultimates_america_chavez', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceDefId: 'ultimates_america_chavez',
        sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function ultimatesBlueMarvelTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    if (ctx.moveFromBaseIndex === undefined || ctx.moveToBaseIndex === undefined) return [];
    if (ctx.moveFromBaseIndex === ctx.moveToBaseIndex) return [];
    return [addTempPower(ctx.sourceCardUid, ctx.moveToBaseIndex, 1, 'ultimates_blue_marvel', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceDefId: 'ultimates_blue_marvel',
        sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
        sourceBaseIndex: ctx.moveToBaseIndex,
    })];
}

function cardHasSpecialAbility(defId: string | undefined): boolean {
    if (!defId) return false;
    const def = getCardDef(defId);
    if (!def) return false;
    if (def.abilityTags?.includes('special')) return true;
    if (def.type === 'action') return Boolean(def.specialTiming ?? def.responseWindowTiming);
    if (def.type === 'minion') return def.beforeScoringPlayable === true;
    return false;
}

function spiderVerseSpiderManTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (ctx.sourceControllerId !== ctx.playerId) return [];
    if (!cardHasSpecialAbility(ctx.triggerCardDefId ?? ctx.triggerMinionDefId)) return [];
    return [addTempPower(ctx.sourceCardUid, ctx.sourceBaseIndex, 1, 'spider_verse_spider_man', ctx.now, {
        sourcePlayerId: ctx.sourceControllerId,
        sourceDefId: 'spider_verse_spider_man',
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
    })];
}

function ultimatesAidFromAlliesTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.moveToBaseIndex !== ctx.sourceBaseIndex) return [];
    if (ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];

    const batchKey = ctx.sourceEventId ?? ctx.simultaneousMoveBatchMinionUids?.join('|') ?? ctx.triggerMinionUid;
    const seen = ctx.triggerSharedState?.ultimatesAidFromAlliesBatches as Set<string> | undefined;
    const seenBatches = seen ?? new Set<string>();
    const key = `${ctx.sourceCardUid}:${batchKey ?? ctx.now}`;
    if (seenBatches.has(key)) return [];
    seenBatches.add(key);
    if (ctx.triggerSharedState) {
        ctx.triggerSharedState.ultimatesAidFromAlliesBatches = seenBatches;
    }

    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function spiderVerseWebbedUpSuppression(
    state: SmashUpCore,
    turnScopedSuppressedCardUids: ReadonlySet<string>,
): string[] {
    const suppressedMinionUids = new Set<string>();
    for (const base of state.bases) {
        for (const minion of base.minions) {
            const hasActiveWebbedUp = minion.attachedActions.some(action =>
                action.defId === 'spider_verse_webbed_up'
                && !turnScopedSuppressedCardUids.has(action.uid)
            );
            if (hasActiveWebbedUp) {
                suppressedMinionUids.add(minion.uid);
            }
        }
    }
    return Array.from(suppressedMinionUids);
}

export function registerMarvelAbilities(): void {
    registerSimpleAbility('shield_nick_fury', 'onPlay', ctx => extraMinion(ctx, 'shield_nick_fury', ctx.baseIndex));
    registerSimpleAbility('shield_phil_coulson', 'onPlay', ctx => extraMinion(ctx, 'shield_phil_coulson', ctx.baseIndex, 2));
    registerSimpleAbility('shield_entry_point', 'onPlay', ctx => extraMinion(ctx, 'shield_entry_point'));
    registerSimpleAbility('shield_mission_debriefing', 'onPlay', shieldMissionDebriefing);
    registerSimpleAbility('shield_proving_ground', 'talent', shieldProvingGround);
    registerSimpleAbility('shield_reassignment', 'onPlay', shieldReassignment);
    registerSimpleAbility('shield_rescue_mission', 'special', shieldRescueMission);
    registerSimpleAbility('shield_superior_firepower', 'onPlay', shieldSuperiorFirepower);
    registerSimpleAbility('shield_troop_drop', 'onPlay', ctx => extraMinion(ctx, 'shield_troop_drop', undefined, 3));
    registerSimpleAbility('shield_together', 'onPlay', shieldTogether);
    registerTrigger('shield_maria_hill', 'onMinionPlayed', shieldMariaHillTrigger, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });

    registerSimpleAbility('spider_verse_ghost_spider', 'onPlay', spiderVerseGhostSpider);
    registerSimpleAbility('spider_verse_friendly_neighborhood_hero', 'special', spiderVerseFriendlyNeighborhoodHero);
    registerSimpleAbility('spider_verse_great_responsibility', 'onPlay', ctx => spiderVerseGreatResponsibility(ctx, false));
    registerSimpleAbility('spider_verse_great_responsibility', 'special', ctx => spiderVerseGreatResponsibility(ctx, true));
    registerSimpleAbility('spider_verse_miles_morales', 'onPlay', spiderVerseMilesMorales);
    registerSimpleAbility('spider_verse_spider_reflexes', 'onPlay', spiderVerseSpiderReflexes);
    registerSimpleAbility('spider_verse_spider_sense', 'onPlay', spiderVerseSpiderSense);
    registerSimpleAbility('spider_verse_spider_sense', 'special', spiderVerseSpiderSense);
    registerSimpleAbility('spider_verse_view_from_above', 'onPlay', spiderVerseViewFromAbove);
    registerSimpleAbility('spider_verse_with_great_power', 'onPlay', ctx => spiderVerseWithGreatPower(ctx, false));
    registerSimpleAbility('spider_verse_with_great_power', 'special', ctx => spiderVerseWithGreatPower(ctx, true));
    registerCardAbilitySuppression('spider_verse_webbed_up', spiderVerseWebbedUpSuppression);
    registerTrigger('spider_verse_spider_man', 'onActionPlayed', spiderVerseSpiderManTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger('spider_verse_spider_man', 'onMinionPlayed', spiderVerseSpiderManTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerProtection('spider_verse_spider_man_2099', 'destroy', ctx => (
        ctx.targetMinion.defId === 'spider_verse_spider_man_2099'
        && ctx.sourcePlayerId !== ctx.targetMinion.controller
    ));

    registerSimpleAbility('ultimates_captain_marvel', 'talent', ctx => ultimatesSelfMoveTalent(ctx, 'ultimates_captain_marvel', 1));
    registerSimpleAbility('ultimates_spectrum', 'talent', ctx => ultimatesSelfMoveTalent(ctx, 'ultimates_spectrum'));
    registerSimpleAbility('ultimates_aid_from_allies', 'onPlay', ultimatesAidFromAllies);
    registerSimpleAbility('ultimates_coordinated_attack', 'onPlay', ultimatesCoordinatedAttack);
    registerSimpleAbility('ultimates_cosmic_knowledge', 'onPlay', ultimatesCosmicKnowledge);
    registerSimpleAbility('ultimates_first_to_arrive', 'onPlay', ultimatesFirstToArrive);
    registerSimpleAbility('ultimates_heroic_landing', 'onPlay', ultimatesHeroicLanding);
    registerSimpleAbility('ultimates_lift_and_carry', 'onPlay', ultimatesLiftAndCarry);
    registerSimpleAbility('ultimates_power_and_speed', 'onPlay', ultimatesPowerAndSpeed);
    registerSimpleAbility('ultimates_scramble', 'onPlay', ultimatesScramble);
    registerSimpleAbility('ultimates_scramble', 'special', ultimatesScramble);
    registerTrigger('ultimates_america_chavez', 'onMinionMoved', ultimatesAmericaChavezTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('ultimates_blue_marvel', 'onMinionMoved', ultimatesBlueMarvelTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('ultimates_aid_from_allies', 'onMinionMoved', ultimatesAidFromAlliesTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
    });
}
