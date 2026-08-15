import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    createSkipOption,
    findMinionByAttachedCard,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraAction,
    revealHand,
} from '../domain/abilityHelpers';
import { createEffectProgram, executeAbilityProgram, type AbilityProgram } from '../domain/abilityRuntime';
import {
    appendResolvedActionAbility,
    getExternalActionEffectiveHandSize,
    type ExternalActionAbilityContinuationContext,
} from '../domain/externalActionPlay';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { registerProtection, registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { registerOngoingPowerModifier } from '../domain/ongoingModifiers';
import { collectLegalActionPlayTargets, validateActionPlaySemantics, validateImmediateHandExtraMinionPlaySemantics } from '../domain/playLegality';
import type { ActionCardDef, CardInstance, MinionOnBase, MinionPlayedEvent, OngoingDetachedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type MinionChoice = { minionUid?: string; defId?: string; baseIndex?: number; skip?: boolean };
type BaseChoice = { baseIndex?: number; baseDefId?: string; skip?: boolean };
type PlayerChoice = { playerId?: PlayerId; skip?: boolean };
type ActionPlayChoice = { mode?: 'play' | 'return'; targetBaseIndex?: number; targetMinionUid?: string; skip?: boolean };
type WoodForSheepChoice = ActionPlayChoice & { giveCardUid?: string; giveDefId?: string; playKind?: 'action' | 'minion' };

const sheepDrawAfterExternalActionProgram = createEffectProgram<
    ExternalActionAbilityContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('sheep_to_follow_or_not continuation 缺少正式 matchState');
    }
    if (!context.random) {
        throw new Error('sheep_to_follow_or_not continuation 缺少随机源');
    }
    return buildStandardDrawEvents(context.matchState.core, context.playerId, 1, context.random, context.timestamp);
});

interface SheepTransferredMinionContinuationContext {
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    reason: string;
    timestamp: number;
    targetBaseIndex: number;
    power: number;
}

interface SheepTransferredMinionSetupContext extends SheepTransferredMinionContinuationContext {
    setupEvents: SmashUpEvent[];
}

const sheepPlayTransferredMinionAfterSetupProgram = createEffectProgram<
    SheepTransferredMinionContinuationContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('sheep_wood_for_sheep minion continuation 缺少正式 matchState');
    }
    const validation = validateImmediateHandExtraMinionPlaySemantics(context.matchState.core, context.playerId, {
        cardUid: context.cardUid,
        baseIndex: context.targetBaseIndex,
    });
    if (!validation.valid) return [];

    return [{
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: context.playerId,
            cardUid: context.cardUid,
            defId: context.defId,
            ownerId: context.ownerId,
            baseIndex: context.targetBaseIndex,
            baseDefId: context.matchState.core.bases[context.targetBaseIndex]?.defId,
            power: context.power,
            consumesNormalLimit: false,
            discardPlaySourceId: context.reason,
        },
        timestamp: context.timestamp,
    } as MinionPlayedEvent];
});

const sheepEmitSetupThenPlayTransferredMinionProgram = createEffectProgram<
    SheepTransferredMinionSetupContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.setupEvents,
    context: {
        matchState: context.matchState,
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        ownerId: context.ownerId,
        reason: context.reason,
        timestamp: context.timestamp,
        targetBaseIndex: context.targetBaseIndex,
        power: context.power,
    } satisfies SheepTransferredMinionContinuationContext,
    nextProgram: sheepPlayTransferredMinionAfterSetupProgram,
}));

function otherBaseOptions(core: SmashUpCore, fromBaseIndex: number) {
    return buildBaseTargetOptions(
        core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            }))
            .filter(option => option.baseIndex !== fromBaseIndex),
        core,
    );
}

function firstOtherBaseIndex(core: SmashUpCore, fromBaseIndex: number): number | undefined {
    return core.bases.findIndex((_base, index) => index !== fromBaseIndex);
}

function ownMinionOptions(core: SmashUpCore, playerId: PlayerId, predicate?: (minion: MinionOnBase, baseIndex: number) => boolean) {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .filter(minion => !predicate || predicate(minion, baseIndex))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
    );
}

function playerChoices(ctx: AbilityContext): PlayerChoice[] {
    return ctx.state.turnOrder
        .filter(playerId => playerId !== ctx.playerId)
        .map(playerId => ({ playerId }));
}

function transferCardEvent(
    card: CardInstance,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId,
            toPlayerId,
            ownerId: card.owner,
            reason,
        },
        timestamp,
    } as SmashUpEvent;
}

function buildActionPlayDecisionOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    effectiveHandSize: number,
    idPrefix: string,
): Array<{ id: string; label: string; value: ActionPlayChoice; displayMode: 'button' }> {
    const def = getCardDef(card.defId) as ActionCardDef | undefined;
    if (def?.type !== 'action') return [];
    const actionName = def.name ?? card.defId;
    const targets = collectLegalActionPlayTargets(core, playerId, {
        defId: card.defId,
        effectiveHandSize,
    });

    if (targets.mode === 'none') {
        if (targets.firstError) return [];
        return [{
            id: `${idPrefix}_play`,
            label: `打出${actionName}`,
            value: { mode: 'play' },
            displayMode: 'button' as const,
        }];
    }

    if (targets.mode === 'base') {
        return targets.baseIndices.map(baseIndex => ({
            id: `${idPrefix}_base_${baseIndex}`,
            label: `打出${actionName} → ${getBaseDef(core.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
            value: { mode: 'play', targetBaseIndex: baseIndex },
            displayMode: 'button' as const,
        }));
    }

    const legalMinionUids = new Set(targets.minionUids);
    return core.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.minions
            .filter(minion => legalMinionUids.has(minion.uid))
            .map(minion => ({
                id: `${idPrefix}_minion_${minion.uid}`,
                label: `打出${actionName} → ${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
                value: { mode: 'play', targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                displayMode: 'button' as const,
            }));
    });
}

function buildMinionPlayDecisionOptions(
    core: SmashUpCore,
    card: CardInstance,
    idPrefix: string,
): Array<{ id: string; label: string; value: WoodForSheepChoice; displayMode: 'button' }> {
    const power = getMinionLikePower(card.defId);
    if (power === undefined) return [];
    const minionName = getCardDef(card.defId)?.name ?? card.defId;
    return core.bases.map((base, baseIndex) => ({
        id: `${idPrefix}_base_${baseIndex}`,
        label: `打出${minionName} → ${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
        value: { mode: 'play', targetBaseIndex: baseIndex, playKind: 'minion' as const },
        displayMode: 'button' as const,
    }));
}
function executeTransferredActionPlay(params: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    card: CardInstance;
    setupEvents: SmashUpEvent[];
    reason: string;
    timestamp: number;
    random: AbilityContext['random'];
    targetBaseIndex?: number;
    targetMinionUid?: string;
    effectiveHandSize: number;
    afterActionProgram?: AbilityProgram<ExternalActionAbilityContinuationContext, SmashUpCore, SmashUpEvent>;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const def = getCardDef(params.card.defId) as ActionCardDef | undefined;
    if (def?.type !== 'action') return { state: params.state, events: [] };
    const validation = validateActionPlaySemantics(params.state.core, params.playerId, {
        defId: params.card.defId,
        targetBaseIndex: params.targetBaseIndex,
        targetMinionUid: params.targetMinionUid,
        effectiveHandSize: params.effectiveHandSize,
    });
    if (!validation.valid) return { state: params.state, events: [] };

    const events: SmashUpEvent[] = [
        ...params.setupEvents,
        grantContextualExtraAction({ playerId: params.playerId, now: params.timestamp, matchState: params.state }, params.reason),
        buildActionPlayedEvent({
            playerId: params.playerId,
            cardUid: params.card.uid,
            defId: params.card.defId,
            ownerId: params.card.owner,
            isExtraAction: true,
            targetBaseIndex: params.targetBaseIndex,
            targetMinionUid: params.targetMinionUid,
            timestamp: params.timestamp,
        }) as SmashUpEvent,
    ];

    if (def.subtype === 'ongoing' && params.targetBaseIndex !== undefined) {
        events.push(...buildSemanticOngoingAttachEvents(params.state, {
            cardUid: params.card.uid,
            defId: params.card.defId,
            ownerId: params.card.owner,
            ...(params.card.owner !== params.playerId ? { sourcePlayerId: params.playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: params.targetBaseIndex,
            targetMinionUid: params.targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now: params.timestamp,
        }));
    }

    return appendResolvedActionAbility({
        state: params.state,
        events,
        playerId: params.playerId,
        cardUid: params.card.uid,
        defId: params.card.defId,
        random: params.random,
        timestamp: params.timestamp,
        baseIndex: params.targetBaseIndex ?? 0,
        targetBaseIndex: params.targetBaseIndex,
        targetMinionUid: params.targetMinionUid,
        afterActionProgram: params.afterActionProgram,
    });
}

function executeTransferredMinionPlay(params: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    card: CardInstance;
    setupEvents: SmashUpEvent[];
    reason: string;
    timestamp: number;
    targetBaseIndex?: number;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    if (params.targetBaseIndex === undefined) return { state: params.state, events: [] };
    const power = getMinionLikePower(params.card.defId);
    if (power === undefined) return { state: params.state, events: [] };

    const result = executeAbilityProgram(sheepEmitSetupThenPlayTransferredMinionProgram, {
        matchState: params.state,
        setupEvents: params.setupEvents,
        playerId: params.playerId,
        cardUid: params.card.uid,
        defId: params.card.defId,
        ownerId: params.card.owner,
        reason: params.reason,
        timestamp: params.timestamp,
        targetBaseIndex: params.targetBaseIndex,
        power,
    });

    return {
        state: result.matchState ?? params.state,
        events: result.events as SmashUpEvent[],
    };
}
const MOVE_OWN_MINION_TITLES: Record<string, string> = {
    sheep_little_bo_peep: '小小牧羊女：选择你的一个随从移动到这里',
    sheep_ewe_shall_pass: '母羊放行：选择你的一个随从移动',
    sheep_on_the_lamb: '一块羊肉：选择要带队移动的你的随从',
};

function queueMoveOwnMinion(ctx: AbilityContext, sourceId: string, predicate?: (minion: MinionOnBase, baseIndex: number) => boolean): AbilityResult {
    const candidates = ownMinionOptions(ctx.state, ctx.playerId, predicate);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        MOVE_OWN_MINION_TITLES[sourceId] ?? sourceId,
        [
            createSkipOption(),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: sourceId,
                sourceKind: 'action',
                semanticRole: 'reference',
                effectType: 'move',
            }),
        ],
        { sourceId, titleKey: `ui.${sourceId}_title`, targetType: 'minion', responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ramTalent(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!live || live.minion.controller !== ctx.playerId) return { events: [] };
    const options = otherBaseOptions(ctx.state, live.baseIndex);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `sheep_ram_${ctx.now}`,
        ctx.playerId,
        '公羊：选择要移动到的基地',
        options,
        { sourceId: 'sheep_ram', titleKey: 'ui.sheep_ram_title', targetType: 'base', responseValidationMode: 'live' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        minionUid: live.minion.uid,
        defId: live.minion.defId,
        fromBaseIndex: live.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function littleBoPeepTalent(ctx: AbilityContext): AbilityResult {
    return queueMoveOwnMinion(
        ctx,
        'sheep_little_bo_peep',
        (_minion, baseIndex) => baseIndex !== ctx.baseIndex,
    );
}

function eweShallPass(ctx: AbilityContext): AbilityResult {
    return queueMoveOwnMinion(ctx, 'sheep_ewe_shall_pass');
}

function onTheLamb(ctx: AbilityContext): AbilityResult {
    return queueMoveOwnMinion(
        ctx,
        'sheep_on_the_lamb',
        (_minion, baseIndex) => {
            const otherControllers = new Set(
                ctx.state.bases[baseIndex]?.minions
                    .filter(minion => minion.controller !== ctx.playerId)
                    .map(minion => minion.controller) ?? [],
            );
            return otherControllers.size > 0;
        },
    );
}

function shearingOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function toFollowOrNot(ctx: AbilityContext): AbilityResult {
    const options = playerChoices(ctx);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `sheep_to_follow_or_not_${ctx.now}`,
        ctx.playerId,
        '是不是要跟着？：选择另一位玩家',
        options.map(option => ({
            id: option.playerId!,
            label: option.playerId!,
            value: option,
            displayMode: 'button' as const,
        })),
        { sourceId: 'sheep_to_follow_or_not', titleKey: 'ui.sheep_to_follow_or_not_title', targetType: 'button' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function woodForSheep(ctx: AbilityContext): AbilityResult {
    const options = playerChoices(ctx);
    if (options.length === 0) return { events: [grantContextualExtraAction(ctx, 'sheep_wood_for_sheep')] };
    const interaction = createSimpleChoice(
        `sheep_wood_for_sheep_${ctx.now}`,
        ctx.playerId,
        '木材换羊：选择另一位玩家',
        options.map(option => ({
            id: option.playerId!,
            label: option.playerId!,
            value: option,
            displayMode: 'button' as const,
        })),
        { sourceId: 'sheep_wood_for_sheep', titleKey: 'ui.sheep_wood_for_sheep_title', targetType: 'button' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function helloDolly(_ctx: AbilityContext): AbilityResult {
    return { events: [] };
}

function helloDollyCopyTrigger(ctx: TriggerContext): AbilityResult {
    const playerId = ctx.sourceControllerId;
    const cardUid = ctx.sourceCardUid;
    const copiedDefId = ctx.triggerCardDefId;
    if (!ctx.matchState || !playerId || !cardUid || !copiedDefId || copiedDefId === 'sheep_hello_dolly') {
        return { events: [] };
    }
    const card = ctx.state.players[playerId]?.hand.find(candidate =>
        candidate.uid === cardUid && candidate.defId === 'sheep_hello_dolly');
    if (!card) return { events: [] };

    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId,
            cardUid,
            defId: 'sheep_hello_dolly',
            ownerId: card.owner,
            isExtraAction: true,
            timestamp: ctx.now,
        }) as SmashUpEvent,
    ];

    return appendResolvedActionAbility({
        state: ctx.matchState,
        events,
        playerId,
        cardUid,
        defId: copiedDefId,
        random: ctx.random,
        timestamp: ctx.now,
        baseIndex: ctx.actionTargetBaseIndex ?? ctx.baseIndex ?? 0,
        targetBaseIndex: ctx.actionTargetBaseIndex,
        targetMinionUid: ctx.actionTargetMinionUid,
    });
}

function moveToDestinationEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    minionUid: string,
    defId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    sourceDefId: string,
    now: number,
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid,
        minionDefId: defId,
        fromBaseIndex,
        toBaseIndex,
        reason: sourceDefId,
        now,
        sourcePlayerId: playerId,
        sourceDefId,
        sourceControllerId: playerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'action',
    });
}

function registerMoveInteractionHandlers(): void {
    registerInteractionHandler('sheep_little_bo_peep', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const sourceBaseIndex = (data as { baseIndex?: number } | undefined)?.baseIndex;
        const destination = typeof sourceBaseIndex === 'number'
            ? sourceBaseIndex
            : state.core.bases.findIndex(base => base.minions.some(minion =>
                minion.defId === 'sheep_little_bo_peep' && minion.controller === playerId));
        if (destination < 0 || destination === selected.baseIndex) return { state, events: [] };
        return {
            state,
            events: moveToDestinationEvents(state.core, playerId, selected.minionUid, selected.defId, selected.baseIndex, destination, 'sheep_little_bo_peep', timestamp),
        };
    });

    registerInteractionHandler('sheep_ewe_shall_pass', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const destination = firstOtherBaseIndex(state.core, selected.baseIndex);
        if (destination === undefined || destination < 0) return { state, events: [] };
        return {
            state,
            events: [
                ...moveToDestinationEvents(state.core, playerId, selected.minionUid, selected.defId, selected.baseIndex, destination, 'sheep_ewe_shall_pass', timestamp),
                ...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
                grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'sheep_ewe_shall_pass'),
            ],
        };
    });

    registerInteractionHandler('sheep_on_the_lamb', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const destination = firstOtherBaseIndex(state.core, selected.baseIndex);
        const sourceBase = state.core.bases[selected.baseIndex];
        if (destination === undefined || destination < 0 || !sourceBase) return { state, events: [] };
        const otherPlayer = sourceBase.minions.find(minion => minion.controller !== playerId)?.controller;
        const batchId = `sheep_on_the_lamb_${timestamp}`;
        const moving = sourceBase.minions.filter(minion =>
            minion.uid === selected.minionUid || minion.controller === otherPlayer);
        return {
            state,
            events: moving.flatMap(minion => buildValidatedMoveEvents(state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex!,
                toBaseIndex: destination,
                reason: 'sheep_on_the_lamb',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'sheep_on_the_lamb',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'action',
                batchId,
            })),
        };
    });

    registerInteractionHandler('sheep_ram', (state, playerId, value, data, _random, timestamp) => {
        const target = value as BaseChoice | undefined;
        const ctx = (data as { continuationContext?: MinionChoice & { fromBaseIndex?: number } } | undefined)?.continuationContext;
        if (!ctx?.minionUid || !ctx.defId || ctx.fromBaseIndex === undefined || target?.baseIndex === undefined) {
            return { state, events: [] };
        }
        const moveEvents = moveToDestinationEvents(state.core, playerId, ctx.minionUid, ctx.defId, ctx.fromBaseIndex, target.baseIndex, 'sheep_ram', timestamp);
        const targetBase = state.core.bases[target.baseIndex];
        const returnTarget = targetBase?.minions.find(minion => getMinionPower(state.core, minion, target.baseIndex!) <= 2);
        return {
            state,
            events: [
                ...moveEvents,
                ...(returnTarget ? buildValidatedReturnEvents(state, {
                    minionUid: returnTarget.uid,
                    minionDefId: returnTarget.defId,
                    fromBaseIndex: target.baseIndex,
                    reason: 'sheep_ram',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceDefId: 'sheep_ram',
                    sourceControllerId: playerId,
                    sourceBaseIndex: target.baseIndex,
                    sourceKind: 'nonAction',
                }) : []),
            ],
        };
    });

    registerInteractionHandler('sheep_to_follow_or_not', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as PlayerChoice | undefined;
        const targetId = selected?.playerId;
        const player = targetId ? state.core.players[targetId] : undefined;
        const action = player?.discard.filter(card => getCardDef(card.defId)?.type === 'action')
            .sort(() => random.random() - 0.5)[0];
        if (!targetId || !action) {
            return { state, events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp) };
        }

        const playOptions = buildActionPlayDecisionOptions(
            state.core,
            playerId,
            action,
            getExternalActionEffectiveHandSize(state, playerId, false),
            `sheep_to_follow_or_not_${action.uid}`,
        );
        const interaction = createSimpleChoice(
            `sheep_to_follow_or_not_resolve_${timestamp}`,
            playerId,
            '是不是要跟着？：选择打出随机行动或返回',
            [
                { id: 'return', label: '返回该牌', labelKey: 'ui.sheep_to_follow_or_not_return_option', value: { mode: 'return' } satisfies ActionPlayChoice, displayMode: 'button' as const },
                ...playOptions,
            ],
            {
                sourceId: 'sheep_to_follow_or_not_resolve',
                titleKey: 'ui.sheep_to_follow_or_not_resolve_title',
                targetType: 'button',
                displayCard: { defId: action.defId, cardUid: action.uid },
                responseValidationMode: 'live',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            targetPlayerId: targetId,
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.owner,
        };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('sheep_to_follow_or_not_resolve', (state, playerId, value, data, random, timestamp) => {
        const selected = value as ActionPlayChoice | undefined;
        const context = (data as {
            continuationContext?: { targetPlayerId?: PlayerId; cardUid?: string; defId?: string; ownerId?: PlayerId };
        } | undefined)?.continuationContext;
        const drawFromCurrentState = () => buildStandardDrawEvents(state.core, playerId, 1, random, timestamp);
        if (selected?.mode !== 'play' || !context?.targetPlayerId || !context.cardUid || !context.defId) {
            return { state, events: drawFromCurrentState() };
        }
        const target = state.core.players[context.targetPlayerId];
        const action = target?.discard.find(card => card.uid === context.cardUid && card.defId === context.defId);
        if (!target || !action) return { state, events: drawFromCurrentState() };

        const resolved = executeTransferredActionPlay({
            state,
            playerId,
            card: action,
            setupEvents: [transferCardEvent(action, context.targetPlayerId, playerId, 'sheep_to_follow_or_not', timestamp)],
            reason: 'sheep_to_follow_or_not',
            timestamp,
            random,
            targetBaseIndex: selected.targetBaseIndex,
            targetMinionUid: selected.targetMinionUid,
            effectiveHandSize: getExternalActionEffectiveHandSize(state, playerId, false),
            afterActionProgram: sheepDrawAfterExternalActionProgram,
        });
        if (resolved.events.length === 0) return { state, events: drawFromCurrentState() };
        return { state: resolved.state, events: resolved.events };
    });

    registerInteractionHandler('sheep_wood_for_sheep', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as PlayerChoice | undefined;
        const targetId = selected?.playerId;
        const targetHand = targetId ? state.core.players[targetId]?.hand ?? [] : [];
        const revealed = targetHand.length > 0 ? targetHand[Math.floor(random.random() * targetHand.length)] : undefined;
        if (!targetId || !revealed) return { state, events: [] };

        const revealEvent = revealHand(targetId, playerId, [{ uid: revealed.uid, defId: revealed.defId }], 'sheep_wood_for_sheep', timestamp, playerId);
        const ownHand = state.core.players[playerId]?.hand ?? [];
        const actionPlayOptions = buildActionPlayDecisionOptions(
            state.core,
            playerId,
            revealed,
            state.core.players[playerId]?.hand.length ?? 0,
            `sheep_wood_for_sheep_${revealed.uid}`,
        ).map(option => ({
            ...option,
            value: { ...(option.value as ActionPlayChoice), playKind: 'action' as const } satisfies WoodForSheepChoice,
        }));
        const minionPlayOptions = buildMinionPlayDecisionOptions(
            state.core,
            revealed,
            `sheep_wood_for_sheep_${revealed.uid}`,
        );
        const playOptions = [...actionPlayOptions, ...minionPlayOptions];
        const tradeOptions = ownHand.flatMap(giveCard => playOptions.map(option => ({
            ...option,
            id: `${option.id}_give_${giveCard.uid}`,
            label: `交出${getCardDef(giveCard.defId)?.name ?? giveCard.defId}，并${option.label}`,
            value: {
                ...(option.value as WoodForSheepChoice),
                giveCardUid: giveCard.uid,
                giveDefId: giveCard.defId,
            } satisfies WoodForSheepChoice,
        })));
        const interaction = createSimpleChoice(
            `sheep_wood_for_sheep_resolve_${timestamp}`,
            playerId,
            '木材换羊：选择交给对手的牌，或返回展示牌',
            [
                { id: 'return', label: '返回展示牌', labelKey: 'ui.sheep_wood_for_sheep_return_option', value: { mode: 'return' } satisfies WoodForSheepChoice, displayMode: 'button' as const },
                ...tradeOptions,
            ],
            {
                sourceId: 'sheep_wood_for_sheep_resolve',
                titleKey: 'ui.sheep_wood_for_sheep_resolve_title',
                targetType: 'button',
                displayCard: { defId: revealed.defId, cardUid: revealed.uid },
                responseValidationMode: 'live',
            },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            targetPlayerId: targetId,
            cardUid: revealed.uid,
            defId: revealed.defId,
            ownerId: revealed.owner,
        };
        return { state: queueInteraction(state, interaction), events: [revealEvent] };
    });

    registerInteractionHandler('sheep_wood_for_sheep_resolve', (state, playerId, value, data, random, timestamp) => {
        const selected = value as WoodForSheepChoice | undefined;
        const context = (data as {
            continuationContext?: { targetPlayerId?: PlayerId; cardUid?: string; defId?: string; ownerId?: PlayerId };
        } | undefined)?.continuationContext;
        if (selected?.mode !== 'play' || !selected.giveCardUid || !context?.targetPlayerId || !context.cardUid || !context.defId) {
            return { state, events: [] };
        }
        const player = state.core.players[playerId];
        const target = state.core.players[context.targetPlayerId];
        const giveCard = player?.hand.find(card => card.uid === selected.giveCardUid);
        const revealed = target?.hand.find(card => card.uid === context.cardUid && card.defId === context.defId);
        if (!player || !target || !giveCard || !revealed) return { state, events: [] };
        const setupEvents = [
            transferCardEvent(giveCard, playerId, context.targetPlayerId, 'sheep_wood_for_sheep_trade', timestamp),
            transferCardEvent(revealed, context.targetPlayerId, playerId, 'sheep_wood_for_sheep', timestamp),
        ];
        if (selected.playKind === 'minion') {
            const resolved = executeTransferredMinionPlay({
                state,
                playerId,
                card: revealed,
                setupEvents,
                reason: 'sheep_wood_for_sheep',
                timestamp,
                targetBaseIndex: selected.targetBaseIndex,
            });
            return { state: resolved.state, events: resolved.events };
        }
        if (selected.playKind !== 'action') return { state, events: [] };

        const resolved = executeTransferredActionPlay({
            state,
            playerId,
            card: revealed,
            setupEvents,
            reason: 'sheep_wood_for_sheep',
            timestamp,
            random,
            targetBaseIndex: selected.targetBaseIndex,
            targetMinionUid: selected.targetMinionUid,
            effectiveHandSize: player.hand.length,
        });
        return { state: resolved.state, events: resolved.events };
    });
}

function registerSheepTriggers(): void {
    registerTrigger('sheep_hello_dolly', 'onActionPlayed', helloDollyCopyTrigger, {
        global: true,
        globalZones: ['hand'],
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => !!ctx.sourceControllerId
            && ctx.sourceControllerId !== ctx.playerId
            && !!ctx.triggerCardDefId
            && ctx.triggerCardDefId !== 'sheep_hello_dolly',
    });

    registerTrigger('sheep_flock', 'onMinionMoved', (ctx) => {
        if (ctx.sourceCardUid === undefined || ctx.sourceBaseIndex === undefined || ctx.moveToBaseIndex === undefined) return [];
        if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];
        return buildValidatedMoveEvents(ctx.matchState ?? ctx.state, {
            minionUid: ctx.sourceCardUid,
            minionDefId: 'sheep_flock',
            fromBaseIndex: ctx.sourceBaseIndex,
            toBaseIndex: ctx.moveToBaseIndex,
            reason: 'sheep_flock',
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceDefId: 'sheep_flock',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceKind: 'nonAction',
        });
    }, {
        perInstance: true,
        mandatory: true,
        canTrigger: ctx => ctx.moveFromBaseIndex === ctx.sourceBaseIndex
            && ctx.moveToBaseIndex !== undefined
            && ctx.triggerMinionUid !== ctx.sourceCardUid,
    });

    registerTrigger('sheep_black_sheep', 'onMinionPlayed', (ctx) => {
        if (ctx.sourceCardUid === undefined || ctx.sourceBaseIndex === undefined) return [];
        const destination = firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex);
        if (destination === undefined || destination < 0) return [];
        return buildValidatedMoveEvents(ctx.matchState ?? ctx.state, {
            minionUid: ctx.sourceCardUid,
            minionDefId: 'sheep_black_sheep',
            fromBaseIndex: ctx.sourceBaseIndex,
            toBaseIndex: destination,
            reason: 'sheep_black_sheep',
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceDefId: 'sheep_black_sheep',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceKind: 'nonAction',
        });
    }, {
        perInstance: true,
        mandatory: true,
        canTrigger: ctx => ctx.baseIndex === ctx.sourceBaseIndex
            && ctx.triggerMinionUid !== ctx.sourceCardUid,
    });

    registerTrigger('sheep_counting_sheep', 'onMinionAffected', (ctx) => {
        const controller = ctx.sourceControllerId;
        const baseIndex = ctx.sourceBaseIndex;
        if (!controller || baseIndex === undefined) return [];
        return (ctx.state.bases[baseIndex]?.minions ?? [])
            .filter(minion => minion.controller === controller)
            .map(minion => addTempPower(minion.uid, baseIndex, 1, 'sheep_counting_sheep', ctx.now, {
                sourcePlayerId: controller,
                sourceDefId: 'sheep_counting_sheep',
                sourceControllerId: controller,
                sourceBaseIndex: baseIndex,
            }));
    }, {
        perInstance: true,
        mandatory: true,
        canTrigger: ctx => ctx.affectType === 'power_change'
            && (ctx.counterDelta ?? 0) > 0
            && ctx.baseIndex === ctx.sourceBaseIndex
            && ctx.controllerId !== ctx.sourceControllerId,
    });


    registerTrigger('sheep_shearing', 'onTurnStart', (ctx) => {
        const ownerId = ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId;
        if (!ctx.sourceCardUid || !ownerId) return [];
        return [buildOngoingDetachedEvent({
            cardUid: ctx.sourceCardUid,
            defId: 'sheep_shearing',
            ownerId,
            reason: 'sheep_shearing',
            destination: 'hand',
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceDefId: 'sheep_shearing',
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            now: ctx.now,
        }) as OngoingDetachedEvent];
    }, {
        perInstance: true,
        mandatory: true,
        playerContext: 'sourceController',
    });

    registerTrigger('sheep_in_sheeps_clothing', 'onMinionMoved', (ctx) => {
        if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.moveToBaseIndex === undefined) return [];
        const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
        if (!host || host.baseIndex !== ctx.moveFromBaseIndex || host.minion.uid === ctx.triggerMinionUid) return [];
        return [
            ...buildValidatedMoveEvents(ctx.matchState ?? ctx.state, {
                minionUid: host.minion.uid,
                minionDefId: host.minion.defId,
                fromBaseIndex: host.baseIndex,
                toBaseIndex: ctx.moveToBaseIndex,
                reason: 'sheep_in_sheeps_clothing',
                now: ctx.now,
                sourcePlayerId: ctx.sourceControllerId ?? host.minion.controller,
                sourceDefId: 'sheep_in_sheeps_clothing',
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: host.baseIndex,
                sourceKind: 'nonAction',
            }),
            buildOngoingDetachedEvent({
                cardUid: ctx.sourceCardUid,
                defId: 'sheep_in_sheeps_clothing',
                ownerId: ctx.sourceOwnerPlayerId ?? host.minion.owner,
                reason: 'sheep_in_sheeps_clothing',
                destination: 'discard',
                sourcePlayerId: ctx.sourceControllerId ?? host.minion.controller,
                sourceDefId: 'sheep_in_sheeps_clothing',
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: host.baseIndex,
                now: ctx.now,
            }),
        ];
    }, {
        perInstance: true,
        optional: true,
        canTrigger: ctx => ctx.moveFromBaseIndex === ctx.sourceBaseIndex
            && ctx.moveToBaseIndex !== undefined
            && ctx.triggerMinionUid !== undefined,
    });
}

export function registerSheepAbilities(): void {
    registerSimpleAbility('sheep_hello_dolly', 'special', helloDolly);
    registerSimpleAbility('sheep_ram', 'talent', ramTalent);
    registerSimpleAbility('sheep_little_bo_peep', 'talent', littleBoPeepTalent);
    registerSimpleAbility('sheep_to_follow_or_not', 'onPlay', toFollowOrNot);
    registerSimpleAbility('sheep_on_the_lamb', 'onPlay', onTheLamb);
    registerSimpleAbility('sheep_shearing', 'onPlay', shearingOnPlay);
    registerSimpleAbility('sheep_wood_for_sheep', 'onPlay', woodForSheep);
    registerSimpleAbility('sheep_ewe_shall_pass', 'onPlay', eweShallPass);

    registerOngoingPowerModifier('sheep_shearing', 'minion', 'self', -2);
    registerProtection('sheep_little_bo_peep', 'move', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && ctx.state.bases[ctx.targetBaseIndex]?.minions.some(minion =>
            minion.defId === 'sheep_little_bo_peep' && minion.controller !== ctx.sourcePlayerId) === true,
    );

    registerSheepTriggers();
}

export function registerSheepInteractionHandlers(): void {
    registerMoveInteractionHandlers();
}
