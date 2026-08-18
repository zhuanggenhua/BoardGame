import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { buildBuryCardEvents, uncoverBuriedCard } from '../domain/bury';
import { addPowerCounter, buildAbilityFeedback, buildBaseTargetOptions, buildFieldSourceTargetPromptConfig, buildFieldSourceToBaseTargetOptions, buildStandardDrawEvents, createSkipOption } from '../domain/abilityHelpers';
import { createEffectProgram, executeAbilityProgram } from '../domain/abilityRuntime';
import { registerDiscardSpecialProvider } from '../domain/discardSpecialAbilities';
import { getBaseDef, getCardDef } from '../data/cards';
import { SU_EVENTS } from '../domain/types';
import type { CardInstance, CardsDiscardedEvent, DiscardAbilityUsedEvent, MinionCardDef, MinionMetadataUpdatedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';

type CardChoice = { cardUid?: string; defId?: string; buriedFrom?: 'hand' | 'discard' | 'play'; skip?: boolean };
type BaseChoice = { baseIndex?: number; skip?: boolean };
type BuriedChoice = { cardUid?: string; defId?: string; baseIndex?: number; skip?: boolean };
type ModeChoice = { mode?: 'bury' | 'uncover' | 'to_base' | 'from_base' | 'extra_bury'; skip?: boolean };
type CounterChoice = { apply?: boolean; skip?: boolean };
type GraveGoodsAfterFirstBuryContext = { matchState?: MatchState<SmashUpCore>; playerId: PlayerId; now: number };
type GraveGoodsEmitFirstBuryContext = GraveGoodsAfterFirstBuryContext & { events: SmashUpEvent[] };
type SequentialUncoverPick = { cardUid: string; baseIndex: number };
type SequentialUncoverContext = {
    matchState?: MatchState<SmashUpCore>;
    playerId: PlayerId;
    picks: SequentialUncoverPick[];
    random?: TriggerContext['random'];
    now: number;
    reason: string;
};

const SKELETONS_REVENANT_USAGE_SOURCE = 'skeletons_revenant';
const SKELETONS_GRAVETENDER_TRIGGERED_TURN_META = 'skeletonsGravetenderTriggeredTurn';

function isMinionDefId(defId: string): boolean {
    return getCardDef(defId)?.type === 'minion';
}

function getMinionBasePower(defId: string): number {
    const def = getCardDef(defId) as MinionCardDef | undefined;
    return def?.type === 'minion' ? def.power : 0;
}

function isLowPowerMinionDefId(defId: string, maxPower: number = 3): boolean {
    const def = getCardDef(defId) as MinionCardDef | undefined;
    return !!def && def.type === 'minion' && def.power <= maxPower;
}

function getHandCards(state: SmashUpCore, playerId: PlayerId): CardInstance[] {
    return state.players[playerId]?.hand ?? [];
}

function getHandCardOwner(state: SmashUpCore, playerId: PlayerId, cardUid: string): PlayerId {
    return getHandCards(state, playerId).find(card => card.uid === cardUid)?.owner ?? playerId;
}

function getBuryChoiceTrueOwner(state: SmashUpCore, playerId: PlayerId, choice: CardChoice): PlayerId {
    if (!choice.cardUid) return playerId;
    if (choice.buriedFrom === 'hand') {
        return getHandCardOwner(state, playerId, choice.cardUid);
    }
    if (choice.buriedFrom === 'discard') {
        return state.players[playerId]?.discard.find(card => card.uid === choice.cardUid)?.owner ?? playerId;
    }
    if (choice.buriedFrom === 'play') {
        for (const base of state.bases) {
            const minion = base.minions.find(card => card.uid === choice.cardUid);
            if (minion) return minion.owner;
            const ongoing = (base.ongoingActions ?? []).find(card => card.uid === choice.cardUid);
            if (ongoing) return ongoing.ownerId;
            for (const host of base.minions) {
                const attached = (host.attachedActions ?? []).find(card => card.uid === choice.cardUid);
                if (attached) return attached.ownerId;
            }
        }
    }
    return playerId;
}

function getDiscardMinions(state: SmashUpCore, playerId: PlayerId, maxPower?: number): CardInstance[] {
    const discard = state.players[playerId]?.discard ?? [];
    return discard.filter(card => card.type === 'minion' && (maxPower === undefined || isLowPowerMinionDefId(card.defId, maxPower)));
}

function buildHandCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `hand-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, buriedFrom: 'hand' as const },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildDiscardCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `discard-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, buriedFrom: 'discard' as const },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function buildBuriedOptions(state: SmashUpCore, options?: { baseIndex?: number; excludeUid?: string; controllerId?: PlayerId }) {
    return state.bases.flatMap((base, baseIndex) => {
        if (options?.baseIndex !== undefined && options.baseIndex !== baseIndex) return [];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return (base.buriedCards ?? [])
            .filter(card => (options?.controllerId === undefined || card.controllerId === options.controllerId) && card.uid !== options?.excludeUid)
            .map((card, index) => ({
                id: `buried-${baseIndex}-${index}`,
                label: `${getCardDef(card.defId)?.name ?? card.defId} @ ${baseName}`,
                value: { cardUid: card.uid, defId: card.defId, baseIndex },
                _source: 'static' as const,
                displayMode: 'card' as const,
            }));
    });
}

function buildOwnedBuriedOptions(state: SmashUpCore, playerId: PlayerId, options?: { baseIndex?: number; excludeUid?: string }) {
    return buildBuriedOptions(state, { ...options, controllerId: playerId });
}

function getBaseOptions(state: SmashUpCore) {
    return state.bases.map((base, baseIndex) => ({
        baseIndex,
        label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
    }));
}

function buildDiscardBuryEvents(state: SmashUpCore, playerId: PlayerId, cardUid: string, defId: string, baseIndex: number, random: TriggerContext['random'], now: number) {
    const trueOwnerId = state.players[playerId]?.discard.find(card => card.uid === cardUid)?.owner ?? playerId;
    return buildBuryCardEvents({
        core: state,
        playerId,
        cardUid,
        defId,
        baseIndex,
        trueOwnerId,
        buriedFrom: 'discard',
        reason: 'skeletons_bury_from_discard',
        random,
        now,
    });
}

const sequentialUncoverProgram = createEffectProgram<
    SequentialUncoverContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('sequential uncover continuation 缺少正式 matchState');
    }
    if (!context.random) {
        throw new Error('sequential uncover continuation 缺少随机源');
    }
    const [pick, ...remainingPicks] = context.picks;
    if (!pick) return { events: [] };
    const result = uncoverBuriedCard({
        matchState: context.matchState,
        playerId: context.playerId,
        cardUid: pick.cardUid,
        baseIndex: pick.baseIndex,
        random: context.random,
        now: context.now,
        reason: context.reason,
    });
    return {
        events: result.events,
        matchState: result.state,
        ...(remainingPicks.length > 0
            ? {
                context: {
                    ...context,
                    matchState: result.state,
                    picks: remainingPicks,
                } satisfies SequentialUncoverContext,
                nextProgram: sequentialUncoverProgram,
            }
            : {}),
    };
});

function runSequentialUncover(matchState: MatchState<SmashUpCore>, playerId: PlayerId, picks: SequentialUncoverPick[], random: TriggerContext['random'], now: number, reason: string): AbilityResult {
    const result = executeAbilityProgram(sequentialUncoverProgram, {
        matchState,
        playerId,
        picks,
        random,
        now,
        reason,
    });
    return {
        events: result.events as SmashUpEvent[],
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function moveBuriedCards(state: any, sourceBaseIndex: number, targetBaseIndex: number, cardUids: string[]) {
    if (sourceBaseIndex === targetBaseIndex || cardUids.length === 0) return state;
    const uidSet = new Set(cardUids);
    const moved = (state.core.bases[sourceBaseIndex]?.buriedCards ?? []).filter((card: any) => uidSet.has(card.uid));
    if (moved.length === 0) return state;
    return {
        ...state,
        core: {
            ...state.core,
            bases: state.core.bases.map((base: any, baseIndex: number) => {
                if (baseIndex === sourceBaseIndex) return { ...base, buriedCards: (base.buriedCards ?? []).filter((card: any) => !uidSet.has(card.uid)) };
                if (baseIndex === targetBaseIndex) return { ...base, buriedCards: [...(base.buriedCards ?? []), ...moved] };
                return base;
            }),
        },
    };
}

function buildMetadataUpdatedEvent(minionUid: string, baseIndex: number, metadataUpdate: Record<string, unknown>, reason: string, timestamp: number): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp,
    };
}

function buildOptionalCounterPrompt(
    interactionId: string,
    playerId: PlayerId,
    title: string,
    titleKey: string,
    sourceId: 'skeletons_graveyard_counter' | 'skeletons_grave_goods_counter',
    targetMinionUid: string,
    targetBaseIndex: number,
    matchState: any,
) {
    const options = [
        { id: 'apply', label: '放置指示物', labelKey: 'ui.place_counter', value: { apply: true }, displayMode: 'button' as const },
        createSkipOption(),
    ] as any[];
    const interaction = sourceId === 'skeletons_graveyard_counter'
        ? createSimpleChoice(
            interactionId,
            playerId,
            title,
            options,
            { sourceId: 'skeletons_graveyard_counter', targetType: 'button', buttonIntent: 'confirm-known-object', titleKey },
        )
        : createSimpleChoice(
            interactionId,
            playerId,
            title,
            options,
            { sourceId: 'skeletons_grave_goods_counter', targetType: 'button', buttonIntent: 'confirm-known-object', titleKey },
        );
    (interaction.data as any).continuationContext = { targetMinionUid, targetBaseIndex };
    return queueInteraction(matchState, interaction);
}

function queueSkeletonsGraveGoodsAfterFirstBury(state: MatchState<SmashUpCore>, playerId: PlayerId, now: number): MatchState<SmashUpCore> | undefined {
    const remainingHand = getHandCards(state.core, playerId);
    const buried = buildOwnedBuriedOptions(state.core, playerId);
    const canExtraBury = remainingHand.length >= 2;
    const canUncover = buried.length > 0;
    if (!canExtraBury && !canUncover) return undefined;
    if (canExtraBury && !canUncover) {
        const interaction = createSimpleChoice(`skeletons_grave_goods_discard_${now}`, playerId, '殉葬品：选择要弃掉的手牌', buildHandCardOptions(remainingHand), { sourceId: 'skeletons_grave_goods_discard', targetType: 'hand', titleKey: 'ui.skeletons_grave_goods_discard_title' });
        return queueInteraction(state, interaction);
    }
    if (!canExtraBury && canUncover) {
        const interaction = createSimpleChoice(`skeletons_grave_goods_uncover_${now}`, playerId, '殉葬品：选择一张你埋葬的牌', buried, { sourceId: 'skeletons_grave_goods_uncover', targetType: 'generic', titleKey: 'ui.skeletons_grave_goods_uncover_title' });
        return queueInteraction(state, interaction);
    }
    const interaction = createSimpleChoice(`skeletons_grave_goods_mode_${now}`, playerId, '殉葬品：你可以弃一张牌，再额外埋葬另一张牌，或挖掘一张你的埋葬牌', [
        { id: 'extra-bury', label: '弃一张，再额外埋葬', labelKey: 'ui.skeletons_grave_goods_mode_extra_bury_option', value: { mode: 'extra_bury' }, displayMode: 'button' as const },
        { id: 'uncover', label: '挖掘一张埋葬牌', labelKey: 'ui.skeletons_grave_goods_mode_uncover_option', value: { mode: 'uncover' }, displayMode: 'button' as const },
    ], { sourceId: 'skeletons_grave_goods_mode', targetType: 'button', titleKey: 'ui.skeletons_grave_goods_mode_title' });
    return queueInteraction(state, interaction);
}

const resolveGraveGoodsAfterFirstBuryProgram = createEffectProgram<
    GraveGoodsAfterFirstBuryContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (!context.matchState) {
        throw new Error('skeletons_grave_goods continuation 缺少正式 matchState');
    }
    const matchState = queueSkeletonsGraveGoodsAfterFirstBury(context.matchState, context.playerId, context.now);
    return {
        events: [],
        ...(matchState ? { matchState } : {}),
    };
});

const emitGraveGoodsFirstBuryThenContinueProgram = createEffectProgram<
    GraveGoodsEmitFirstBuryContext,
    SmashUpCore,
    SmashUpEvent
>((context) => ({
    events: context.events,
    context: {
        matchState: context.matchState,
        playerId: context.playerId,
        now: context.now,
    } satisfies GraveGoodsAfterFirstBuryContext,
    nextProgram: resolveGraveGoodsAfterFirstBuryProgram,
}));

function skeletonsReturnedOneOnPlay(ctx: AbilityContext): AbilityResult {
    const options: any[] = [
        createSkipOption('跳过（不埋葬）', 'ui.skeletons_returned_one_skip_bury_option'),
        { id: 'bury-self', label: getCardDef(ctx.defId)?.name ?? ctx.defId, value: { cardUid: ctx.cardUid, defId: ctx.defId, buriedFrom: 'play' as const }, _source: 'play' as const, displayMode: 'card' as const },
    ];
    const interaction = createSimpleChoice(`skeletons_returned_one_${ctx.now}`, ctx.playerId, '轮回者：你可以将这张随从埋葬到这里', options, { sourceId: 'skeletons_returned_one', targetType: 'generic', titleKey: 'ui.skeletons_returned_one_title' });
    (interaction.data as any).continuationContext = { targetBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsReturnedOneAfterUncover(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return { events: [] };
    if (!ctx.triggerMinion || ctx.triggerMinionUid !== ctx.sourceCardUid || ctx.baseIndex !== ctx.sourceBaseIndex) return { events: [] };
    if (ctx.triggerMinion.defId !== 'skeletons_returned_one') return { events: [] };
    if (ctx.triggerMinion.metadata?.playedFrom !== 'buried') return { events: [] };

    const buried = buildOwnedBuriedOptions(ctx.state, ctx.triggerMinion.controller, { baseIndex: ctx.sourceBaseIndex, excludeUid: ctx.sourceCardUid });
    if (buried.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `skeletons_returned_one_uncover_${ctx.now}`,
        ctx.triggerMinion.controller,
        '轮回者：你可以再挖掘这里另一张你埋葬的牌',
        [createSkipOption(), ...buried] as any[],
        { sourceId: 'skeletons_returned_one_uncover', targetType: 'generic', titleKey: 'ui.skeletons_returned_one_uncover_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsPlaceEmDownOnPlay(ctx: AbilityContext): AbilityResult {
    if (getDiscardMinions(ctx.state, ctx.playerId).length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_place_em_down_base_${ctx.now}`, ctx.playerId, '往下埋：选择要埋葬到的基地', buildBaseTargetOptions(getBaseOptions(ctx.state), ctx.state), { sourceId: 'skeletons_place_em_down_base', targetType: 'base', titleKey: 'ui.skeletons_place_em_down_base_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsDigEmUpOnPlay(ctx: AbilityContext): AbilityResult {
    const bases = ctx.state.bases.map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`, count: (base.buriedCards ?? []).filter(card => card.controllerId === ctx.playerId).length })).filter(base => base.count > 0);
    if (bases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_dig_em_up_base_${ctx.now}`, ctx.playerId, '他们出来了：选择一个基地', buildBaseTargetOptions(bases.map(({ baseIndex, label }) => ({ baseIndex, label })), ctx.state), { sourceId: 'skeletons_dig_em_up_base', targetType: 'base', titleKey: 'ui.skeletons_dig_em_up_base_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsBurstForthSpecial(ctx: AbilityContext): AbilityResult {
    const buried = buildOwnedBuriedOptions(ctx.state, ctx.playerId, { baseIndex: ctx.baseIndex });
    if (buried.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_burst_forth_${ctx.now}`, ctx.playerId, '墓地爆发：挖掘你埋葬在此基地的一张牌', buried, { sourceId: 'skeletons_burst_forth', targetType: 'generic', titleKey: 'ui.skeletons_burst_forth_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsGraveyardTalent(ctx: AbilityContext): AbilityResult {
    const buried = buildOwnedBuriedOptions(ctx.state, ctx.playerId, { baseIndex: ctx.baseIndex });
    if (buried.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_graveyard_${ctx.now}`, ctx.playerId, '墓园：挖掘这里一张你的埋葬牌', buried, { sourceId: 'skeletons_graveyard', targetType: 'generic', titleKey: 'ui.skeletons_graveyard_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsLordOfBonesTalent(ctx: AbilityContext): AbilityResult {
    const hand = getHandCards(ctx.state, ctx.playerId);
    const buried = buildBuriedOptions(ctx.state, { baseIndex: ctx.baseIndex });
    if (hand.length === 0 && buried.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (hand.length === 0) {
        const interaction = createSimpleChoice(`skeletons_lord_of_bones_uncover_${ctx.now}`, ctx.playerId, '骸骨之王：挖掘这里一张埋葬牌', buried, { sourceId: 'skeletons_lord_of_bones_uncover', targetType: 'generic', titleKey: 'ui.skeletons_lord_of_bones_uncover_title' });
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (buried.length === 0) {
        const interaction = createSimpleChoice(`skeletons_lord_of_bones_bury_${ctx.now}`, ctx.playerId, '骸骨之王：从手牌埋葬一张牌到这里', [createSkipOption(), ...buildHandCardOptions(hand)] as any[], { sourceId: 'skeletons_lord_of_bones_bury', targetType: 'hand', titleKey: 'ui.skeletons_lord_of_bones_bury_title' });
        (interaction.data as any).continuationContext = { targetBaseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    const interaction = createSimpleChoice(`skeletons_lord_of_bones_mode_${ctx.now}`, ctx.playerId, '骸骨之王：选择埋葬手牌或挖掘这里的一张埋葬牌', [
        { id: 'bury', label: '埋葬手牌', labelKey: 'ui.skeletons_lord_of_bones_mode_bury_option', value: { mode: 'bury' }, displayMode: 'button' as const },
        { id: 'uncover', label: '挖掘这里', labelKey: 'ui.skeletons_lord_of_bones_mode_uncover_option', value: { mode: 'uncover' }, displayMode: 'button' as const },
    ], { sourceId: 'skeletons_lord_of_bones_mode', targetType: 'button', buttonIntent: 'mode', titleKey: 'ui.skeletons_lord_of_bones_mode_title' });
    (interaction.data as any).continuationContext = { targetBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsSpookyScaryOnPlay(ctx: AbilityContext): AbilityResult {
    const discard = getDiscardMinions(ctx.state, ctx.playerId, 3);
    if (discard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_spooky_scary_base_${ctx.now}`, ctx.playerId, '诡异。可怕。：选择埋葬到的基地', buildBaseTargetOptions(getBaseOptions(ctx.state), ctx.state), { sourceId: 'skeletons_spooky_scary_base', targetType: 'base', titleKey: 'ui.skeletons_spooky_scary_base_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsGraveGoodsOnPlay(ctx: AbilityContext): AbilityResult {
    const hand = getHandCards(ctx.state, ctx.playerId);
    if (hand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(`skeletons_grave_goods_base_${ctx.now}`, ctx.playerId, '殉葬品：选择埋葬到的基地', buildBaseTargetOptions(getBaseOptions(ctx.state), ctx.state), { sourceId: 'skeletons_grave_goods_base', targetType: 'base', titleKey: 'ui.skeletons_grave_goods_base_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsHearseFleetOnPlay(ctx: AbilityContext): AbilityResult {
    const buried = buildBuriedOptions(ctx.state);
    if (buried.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const sourceBases = getBaseOptions(ctx.state).filter(base => (ctx.state.bases[base.baseIndex].buriedCards ?? []).length > 0);
    const interaction = createSimpleChoice(`skeletons_hearse_fleet_base_${ctx.now}`, ctx.playerId, '灵车队伍：选择要移出埋葬牌的基地', buildBaseTargetOptions(sourceBases, ctx.state), { sourceId: 'skeletons_hearse_fleet_base', targetType: 'base', titleKey: 'ui.skeletons_hearse_fleet_base_title' });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsHearseFleetSpecial(ctx: AbilityContext): AbilityResult {
    const sameBase = buildOwnedBuriedOptions(ctx.state, ctx.playerId, { baseIndex: ctx.baseIndex });
    const otherBase = buildOwnedBuriedOptions(ctx.state, ctx.playerId).filter(option => option.value.baseIndex !== ctx.baseIndex);
    if (sameBase.length === 0 && otherBase.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (sameBase.length === 0) {
        const interaction = createSimpleChoice(`skeletons_hearse_fleet_special_into_${ctx.now}`, ctx.playerId, '灵车队伍：选择至多两张埋葬牌移入这个基地', otherBase, { sourceId: 'skeletons_hearse_fleet_special_into', targetType: 'generic', multi: { min: 0, max: Math.min(2, otherBase.length) }, titleKey: 'ui.skeletons_hearse_fleet_special_into_title' });
        (interaction.data as any).continuationContext = { fixedBaseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (otherBase.length === 0) {
        const interaction = createSimpleChoice(`skeletons_hearse_fleet_special_from_${ctx.now}`, ctx.playerId, '灵车队伍：选择至多两张埋葬牌移出这个基地', sameBase, { sourceId: 'skeletons_hearse_fleet_special_from', targetType: 'generic', multi: { min: 0, max: Math.min(2, sameBase.length) }, titleKey: 'ui.skeletons_hearse_fleet_special_from_title' });
        (interaction.data as any).continuationContext = { fixedBaseIndex: ctx.baseIndex };
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    const interaction = createSimpleChoice(`skeletons_hearse_fleet_special_mode_${ctx.now}`, ctx.playerId, '灵车队伍：选择把埋葬牌移入或移出这个基地', [
        { id: 'to-base', label: '移入这个基地', labelKey: 'ui.skeletons_hearse_fleet_special_mode_into_option', value: { mode: 'to_base' }, displayMode: 'button' as const },
        { id: 'from-base', label: '移出这个基地', labelKey: 'ui.skeletons_hearse_fleet_special_mode_from_option', value: { mode: 'from_base' }, displayMode: 'button' as const },
    ], { sourceId: 'skeletons_hearse_fleet_special_mode', targetType: 'button', titleKey: 'ui.skeletons_hearse_fleet_special_mode_title' });
    (interaction.data as any).continuationContext = { fixedBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsLordOfBonesOnUncovered(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.baseIndex === undefined) return { events: [] };
    if (!ctx.buriedCardUid || !ctx.buriedCardDefId || !isMinionDefId(ctx.buriedCardDefId)) return { events: [] };
    if (ctx.buriedCardUid === ctx.sourceCardUid) return { events: [] };

    const interaction = createSimpleChoice(
        `skeletons_lord_of_bones_ongoing_${ctx.now}_${ctx.buriedCardUid}`,
        ctx.sourceControllerId ?? ctx.playerId,
        '骸骨之王：你可以在该随从上放置 1 个 +1 力量指示物',
        [
            { id: 'apply', label: '放置 +1 指示物', labelKey: 'ui.skeletons_place_plus_one_counter_option', value: { apply: true }, displayMode: 'button' as const },
            createSkipOption(),
        ] as any[],
        { sourceId: 'skeletons_lord_of_bones_ongoing', targetType: 'button', buttonIntent: 'confirm-known-object', titleKey: 'ui.skeletons_lord_of_bones_counter_title' },
    );
    (interaction.data as any).continuationContext = { targetMinionUid: ctx.buriedCardUid, targetBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsGravestonesOnUncovered(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || ctx.sourceBaseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return { events: [] };
    if (!ctx.buriedCardUid || !ctx.buriedCardDefId || !isMinionDefId(ctx.buriedCardDefId)) return { events: [] };

    const interaction = createSimpleChoice(
        `skeletons_gravestones_counter_${ctx.now}_${ctx.buriedCardUid}`,
        ctx.sourceControllerId ?? ctx.playerId,
        '墓碑：你可以在该随从上放置 1 个 +1 力量指示物',
        [
            { id: 'apply', label: '放置 +1 指示物', labelKey: 'ui.skeletons_place_plus_one_counter_option', value: { apply: true }, displayMode: 'button' as const },
            createSkipOption(),
        ] as any[],
        { sourceId: 'skeletons_gravestones_counter', targetType: 'button', buttonIntent: 'confirm-known-object', titleKey: 'ui.skeletons_gravestones_counter_title' },
    );
    (interaction.data as any).continuationContext = { targetMinionUid: ctx.buriedCardUid, targetBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsGravestonesAfterScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.sourceCardUid) return { events: [] };
    const interaction = createSimpleChoice(
        `skeletons_gravestones_after_scoring_${ctx.now}`,
        ctx.sourceControllerId,
        '墓碑：选择把这张牌埋葬到的基地',
        buildFieldSourceToBaseTargetOptions(
            {
                type: 'ongoing',
                uid: ctx.sourceCardUid,
                defId: 'skeletons_gravestones',
                fromBaseIndex: ctx.sourceBaseIndex,
            },
            getBaseOptions(ctx.state).filter(base => base.baseIndex !== ctx.sourceBaseIndex),
            ctx.state,
        ),
        buildFieldSourceTargetPromptConfig({ sourceId: 'skeletons_gravestones_after_scoring', titleKey: 'ui.skeletons_gravestones_after_scoring_title' }),
    );
    (interaction.data as any).continuationContext = { sourceBaseIndex: ctx.sourceBaseIndex, sourceCardUid: ctx.sourceCardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function skeletonsGravetenderTriggered(ctx: TriggerContext): AbilityResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return { events: [] };
    if (!ctx.buriedCardUid || ctx.buriedCardUid === ctx.sourceCardUid) return { events: [] };
    if (ctx.buriedCardControllerId !== ctx.sourceControllerId) return { events: [] };

    const gravetender = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!gravetender) return { events: [] };

    const usedTurn = Number(gravetender.metadata?.[SKELETONS_GRAVETENDER_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return { events: [] };

    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now),
            buildMetadataUpdatedEvent(
                ctx.sourceCardUid,
                ctx.sourceBaseIndex,
                { [SKELETONS_GRAVETENDER_TRIGGERED_TURN_META]: ctx.state.turnNumber },
                'skeletons_gravetender_once_per_turn',
                ctx.now,
            ),
        ],
    };
}

function skeletonsRevenantSpecial(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    if (player.usedDiscardPlayAbilities?.includes(SKELETONS_REVENANT_USAGE_SOURCE)) return { events: [] };
    const discardCard = player.discard.find(card => card.uid === ctx.cardUid && card.defId === ctx.defId);
    if (!discardCard) return { events: [] };
    const markUsedEvent: DiscardAbilityUsedEvent = {
        type: SU_EVENTS.DISCARD_ABILITY_USED,
        payload: {
            playerId: ctx.playerId,
            sourceId: SKELETONS_REVENANT_USAGE_SOURCE,
        },
        timestamp: ctx.now,
    };
    return {
        events: [
            markUsedEvent,
            ...buildDiscardBuryEvents(ctx.state, ctx.playerId, discardCard.uid, discardCard.defId, ctx.baseIndex, ctx.random, ctx.now),
        ],
    };
}

export function registerSkeletonAbilities(): void {
    registerAbility('skeletons_returned_one', 'onPlay', skeletonsReturnedOneOnPlay);
    registerAbility('skeletons_place_em_down', 'onPlay', skeletonsPlaceEmDownOnPlay);
    registerAbility('skeletons_dig_em_up', 'onPlay', skeletonsDigEmUpOnPlay);
    registerAbility('skeletons_burst_forth', 'special', skeletonsBurstForthSpecial);
    registerAbility('skeletons_graveyard', 'talent', {
        execute: skeletonsGraveyardTalent,
        validateUse: (ctx) => buildOwnedBuriedOptions(ctx.state, ctx.playerId, { baseIndex: ctx.baseIndex }).length > 0 ? null : '这里没有可挖掘的埋葬牌',
    });
    registerAbility('skeletons_lord_of_bones', 'talent', {
        execute: skeletonsLordOfBonesTalent,
        validateUse: (ctx) =>
            getHandCards(ctx.state, ctx.playerId).length > 0
            || buildBuriedOptions(ctx.state, { baseIndex: ctx.baseIndex }).length > 0
                ? null
                : '没有可埋葬或可挖掘的牌',
    });
    registerAbility('skeletons_spooky_scary', 'onPlay', skeletonsSpookyScaryOnPlay);
    registerAbility('skeletons_grave_goods', 'onPlay', skeletonsGraveGoodsOnPlay);
    registerAbility('skeletons_hearse_fleet', 'onPlay', skeletonsHearseFleetOnPlay);
    registerAbility('skeletons_hearse_fleet', 'special', skeletonsHearseFleetSpecial);
    registerAbility('skeletons_gravestones', 'special', () => ({ events: [] }));
    registerAbility('skeletons_gravetender', 'ongoing', () => ({ events: [] }));
    registerAbility('skeletons_revenant', 'special', skeletonsRevenantSpecial);
    registerDiscardSpecialProvider({
        id: 'skeletons_revenant',
        getActivatableCards(core, playerId) {
            const currentTurnPlayerId = core.turnOrder[core.currentPlayerIndex];
            if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return [];
            const player = core.players[playerId];
            if (!player) return [];
            if (player.usedDiscardPlayAbilities?.includes(SKELETONS_REVENANT_USAGE_SOURCE)) return [];
            return player.discard
                .filter(card => card.defId === 'skeletons_revenant')
                .map(card => ({
                    card,
                    allowedBaseIndices: 'all' as const,
                    sourceId: SKELETONS_REVENANT_USAGE_SOURCE,
                    defId: card.defId,
                    name: getCardDef(card.defId)?.name ?? card.defId,
                }));
        },
    });

    registerTrigger('skeletons_gravetender', 'onCardBuried', skeletonsGravetenderTriggered, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('skeletons_gravetender', 'onBuriedCardUncovered', skeletonsGravetenderTriggered, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('skeletons_returned_one', 'onMinionPlayed', skeletonsReturnedOneAfterUncover, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('skeletons_lord_of_bones', 'onBuriedCardUncovered', skeletonsLordOfBonesOnUncovered, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('skeletons_gravestones', 'onBuriedCardUncovered', skeletonsGravestonesOnUncovered, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('skeletons_gravestones', 'afterScoring', skeletonsGravestonesAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
}

const handleSkeletonsReturnedOne: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as CardChoice;
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    if (selected.skip || !selected.cardUid || !selected.defId || continuation?.targetBaseIndex === undefined) return { state, events: [] };
    return { state, events: buildBuryCardEvents({ core: state.core, matchState: state, playerId, cardUid: selected.cardUid, defId: selected.defId, baseIndex: continuation.targetBaseIndex, trueOwnerId: getBuryChoiceTrueOwner(state.core, playerId, selected), buriedFrom: selected.buriedFrom ?? 'hand', reason: 'skeletons_returned_one', random, now }) };
};

const handleSkeletonsReturnedOneUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice;
    if (selected.skip || !selected.cardUid || selected.baseIndex === undefined) return { state, events: [] };
    return uncoverBuriedCard({ matchState: state, playerId, cardUid: selected.cardUid, baseIndex: selected.baseIndex, random, now, reason: 'skeletons_returned_one' });
};

const handleSkeletonsPlaceEmDownBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    const interaction = createSimpleChoice(`skeletons_place_em_down_cards_${now}`, playerId, '往下埋：选择至多三张随从，总力量 6 或更少', buildDiscardCardOptions(getDiscardMinions(state.core, playerId)), { sourceId: 'skeletons_place_em_down_cards', targetType: 'generic', genericIntent: 'composite-context', multi: { min: 0, max: Math.min(3, getDiscardMinions(state.core, playerId).length) }, titleKey: 'ui.skeletons_place_em_down_cards_title' });
    (interaction.data as any).continuationContext = { targetBaseIndex: selected.baseIndex };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsPlaceEmDownCards: InteractionHandler = (state, playerId, value, data, random, now) => {
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    if (continuation?.targetBaseIndex === undefined) return { state, events: [] };
    const picks = (Array.isArray(value) ? value : [value]) as CardChoice[];
    const selectedCards = picks.filter(pick => pick.cardUid && pick.defId).slice(0, 3);
    if (selectedCards.reduce((sum, pick) => sum + getMinionBasePower(pick.defId!), 0) > 6) return { state, events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)] };
    return { state, events: selectedCards.flatMap(card => buildDiscardBuryEvents(state.core, playerId, card.cardUid!, card.defId!, continuation.targetBaseIndex!, random, now)) };
};

const handleSkeletonsDigEmUpBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    const buried = buildOwnedBuriedOptions(state.core, playerId, { baseIndex: selected.baseIndex });
    const interaction = createSimpleChoice(`skeletons_dig_em_up_cards_${now}`, playerId, '他们出来了：选择至多三张埋葬牌挖掘', buried, { sourceId: 'skeletons_dig_em_up_cards', targetType: 'generic', multi: { min: 0, max: Math.min(3, buried.length) }, titleKey: 'ui.skeletons_dig_em_up_cards_title' });
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsDigEmUpCards: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const picks = (Array.isArray(value) ? value : [value]) as BuriedChoice[];
    const selectedCards = picks.filter(pick => pick.cardUid && pick.baseIndex !== undefined).slice(0, 3).map(pick => ({ cardUid: pick.cardUid!, baseIndex: pick.baseIndex! }));
    if (selectedCards.length === 0) return { state, events: [] };
    const result = runSequentialUncover(state, playerId, selectedCards, random, now, 'skeletons_dig_em_up');
    return { state: result.matchState ?? state, events: result.events };
};

const handleSkeletonsBurstForth: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice;
    if (!selected.cardUid || selected.baseIndex === undefined) return { state, events: [] };
    return uncoverBuriedCard({ matchState: state, playerId, cardUid: selected.cardUid, baseIndex: selected.baseIndex, random, now, reason: 'skeletons_burst_forth' });
};

const handleSkeletonsGraveyard: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice;
    if (!selected.cardUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const result = uncoverBuriedCard({ matchState: state, playerId, cardUid: selected.cardUid, baseIndex: selected.baseIndex, random, now, reason: 'skeletons_graveyard' });
    if (!isMinionDefId(selected.defId)) return result;
    return {
        state: buildOptionalCounterPrompt(
            `skeletons_graveyard_counter_${now}`,
            playerId,
            '墓园：你可以在该仆从上放置 1 个 +1 力量指示物',
            'ui.skeletons_graveyard_counter_title',
            'skeletons_graveyard_counter',
            selected.cardUid,
            selected.baseIndex,
            result.state,
        ),
        events: result.events,
    };
};

const handleSkeletonsLordOfBonesMode: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as ModeChoice;
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    if (continuation?.targetBaseIndex === undefined) return { state, events: [] };
    if (selected.mode === 'bury') {
        const interaction = createSimpleChoice(`skeletons_lord_of_bones_bury_${now}`, playerId, '骸骨之王：从手牌埋葬一张牌到这里', [createSkipOption(), ...buildHandCardOptions(getHandCards(state.core, playerId))] as any[], { sourceId: 'skeletons_lord_of_bones_bury', targetType: 'hand', titleKey: 'ui.skeletons_lord_of_bones_bury_title' });
        (interaction.data as any).continuationContext = continuation;
        return { state: queueInteraction(state, interaction), events: [] };
    }
    const interaction = createSimpleChoice(`skeletons_lord_of_bones_uncover_${now}`, playerId, '骸骨之王：挖掘这里一张埋葬牌', buildBuriedOptions(state.core, { baseIndex: continuation.targetBaseIndex }), { sourceId: 'skeletons_lord_of_bones_uncover', targetType: 'generic', titleKey: 'ui.skeletons_lord_of_bones_uncover_title' });
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsLordOfBonesBury: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as CardChoice;
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    if (selected.skip || !selected.cardUid || !selected.defId || continuation?.targetBaseIndex === undefined) return { state, events: [] };
    return { state, events: buildBuryCardEvents({ core: state.core, matchState: state, playerId, cardUid: selected.cardUid, defId: selected.defId, baseIndex: continuation.targetBaseIndex, trueOwnerId: getHandCardOwner(state.core, playerId, selected.cardUid), buriedFrom: 'hand', reason: 'skeletons_lord_of_bones', random, now }) };
};

const handleSkeletonsLordOfBonesUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice;
    if (!selected.cardUid || selected.baseIndex === undefined) return { state, events: [] };
    return uncoverBuriedCard({ matchState: state, playerId, cardUid: selected.cardUid, baseIndex: selected.baseIndex, random, now, reason: 'skeletons_lord_of_bones' });
};

const handleSkeletonsSpookyScaryBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    const discard = getDiscardMinions(state.core, playerId, 3);
    const interaction = createSimpleChoice(`skeletons_spooky_scary_card_${now}`, playerId, '诡异。可怕。：选择一张力量 3 或以下随从', buildDiscardCardOptions(discard), { sourceId: 'skeletons_spooky_scary_card', targetType: 'generic', genericIntent: 'composite-context', titleKey: 'ui.skeletons_spooky_scary_card_title' });
    (interaction.data as any).continuationContext = { targetBaseIndex: selected.baseIndex };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsSpookyScaryCard: InteractionHandler = (state, playerId, value, data, random, now) => {
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    const selected = value as CardChoice;
    if (!selected.cardUid || !selected.defId || continuation?.targetBaseIndex === undefined) return { state, events: [] };
    return { state, events: [...buildDiscardBuryEvents(state.core, playerId, selected.cardUid, selected.defId, continuation.targetBaseIndex, random, now), ...buildStandardDrawEvents(state.core, playerId, 1, random, now)] };
};

const handleSkeletonsGraveGoodsMode: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as ModeChoice;
    if (selected.mode === 'extra_bury') {
        const interaction = createSimpleChoice(`skeletons_grave_goods_discard_${now}`, playerId, '殉葬品：选择要弃掉的手牌', buildHandCardOptions(getHandCards(state.core, playerId)), { sourceId: 'skeletons_grave_goods_discard', targetType: 'hand', titleKey: 'ui.skeletons_grave_goods_discard_title' });
        return { state: queueInteraction(state, interaction), events: [] };
    }
    const interaction = createSimpleChoice(`skeletons_grave_goods_uncover_${now}`, playerId, '殉葬品：选择一张你埋葬的牌', buildOwnedBuriedOptions(state.core, playerId), { sourceId: 'skeletons_grave_goods_uncover', targetType: 'generic', titleKey: 'ui.skeletons_grave_goods_uncover_title' });
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsGraveGoodsBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    const interaction = createSimpleChoice(`skeletons_grave_goods_bury_${now}`, playerId, '殉葬品：从手牌埋葬一张牌', buildHandCardOptions(getHandCards(state.core, playerId)), { sourceId: 'skeletons_grave_goods_bury', targetType: 'hand', titleKey: 'ui.skeletons_grave_goods_bury_title' });
    (interaction.data as any).continuationContext = { targetBaseIndex: selected.baseIndex };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsGraveGoodsBury: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as CardChoice;
    const continuation = data?.continuationContext as { targetBaseIndex?: number } | undefined;
    if (!selected.cardUid || !selected.defId || continuation?.targetBaseIndex === undefined) return { state, events: [] };
    const firstEvents = buildBuryCardEvents({ core: state.core, matchState: state, playerId, cardUid: selected.cardUid, defId: selected.defId, baseIndex: continuation.targetBaseIndex, trueOwnerId: getHandCardOwner(state.core, playerId, selected.cardUid), buriedFrom: 'hand', reason: 'skeletons_grave_goods', random: _random, now });
    const result = executeAbilityProgram(emitGraveGoodsFirstBuryThenContinueProgram, {
        matchState: state,
        playerId,
        now,
        events: firstEvents,
    });
    return { state: result.matchState ?? state, events: result.events as SmashUpEvent[] };
};

const handleSkeletonsGraveGoodsDiscard: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as CardChoice;
    if (selected.skip || !selected.cardUid) return { state, events: [] };
    const remainingHand = getHandCards(state.core, playerId).filter(card => card.uid !== selected.cardUid);
    if (remainingHand.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(`skeletons_grave_goods_bonus_${now}`, playerId, '殉葬品：选择要额外埋葬的另一张手牌', buildHandCardOptions(remainingHand), { sourceId: 'skeletons_grave_goods_bonus', targetType: 'hand', titleKey: 'ui.skeletons_grave_goods_bonus_title' });
    (interaction.data as any).continuationContext = { discardCardUid: selected.cardUid };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsGraveGoodsBonus: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as CardChoice;
    const continuation = data?.continuationContext as { discardCardUid?: string } | undefined;
    if (selected.skip || !selected.cardUid || !selected.defId || !continuation?.discardCardUid) return { state, events: [] };
    const interaction = createSimpleChoice(`skeletons_grave_goods_bonus_base_${now}`, playerId, '殉葬品：选择额外埋葬到的基地', buildBaseTargetOptions(getBaseOptions(state.core), state.core), { sourceId: 'skeletons_grave_goods_bonus_base', targetType: 'base', titleKey: 'ui.skeletons_grave_goods_bonus_base_title' });
    (interaction.data as any).continuationContext = {
        discardCardUid: continuation.discardCardUid,
        buryCardUid: selected.cardUid,
        buryDefId: selected.defId,
    };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsGraveGoodsBonusBase: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as BaseChoice;
    const continuation = data?.continuationContext as { discardCardUid?: string; buryCardUid?: string; buryDefId?: string } | undefined;
    if (selected.baseIndex === undefined || !continuation?.discardCardUid || !continuation.buryCardUid || !continuation.buryDefId) return { state, events: [] };
    const discardEvent: CardsDiscardedEvent = { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids: [continuation.discardCardUid] }, timestamp: now };
    return {
        state,
        events: [
            discardEvent,
            ...buildBuryCardEvents({ core: state.core, matchState: state, playerId, cardUid: continuation.buryCardUid, defId: continuation.buryDefId, baseIndex: selected.baseIndex, trueOwnerId: getHandCardOwner(state.core, playerId, continuation.buryCardUid), buriedFrom: 'hand', reason: 'skeletons_grave_goods_bonus', random, now }),
        ],
    };
};

const handleSkeletonsGraveGoodsUncover: InteractionHandler = (state, playerId, value, _data, random, now) => {
    const selected = value as BuriedChoice;
    if (!selected.cardUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    const result = uncoverBuriedCard({ matchState: state, playerId, cardUid: selected.cardUid, baseIndex: selected.baseIndex, random, now, reason: 'skeletons_grave_goods' });
    if (!isMinionDefId(selected.defId)) return result;
    return {
        state: buildOptionalCounterPrompt(
            `skeletons_grave_goods_counter_${now}`,
            playerId,
            '殉葬品：你可以在该仆从上放置 2 个 +1 力量指示物',
            'ui.skeletons_grave_goods_counter_title',
            'skeletons_grave_goods_counter',
            selected.cardUid,
            selected.baseIndex,
            result.state,
        ),
        events: result.events,
    };
};

const handleSkeletonsHearseFleetBase: InteractionHandler = (state, playerId, value, _data, _random, now) => {
    const selected = value as BaseChoice;
    if (selected.baseIndex === undefined) return { state, events: [] };
    const interaction = createSimpleChoice(
        `skeletons_hearse_fleet_target_${now}`,
        playerId,
        '灵车队伍：选择要移动到的基地',
        buildBaseTargetOptions(getBaseOptions(state.core).filter(base => base.baseIndex !== selected.baseIndex), state.core),
        { sourceId: 'skeletons_hearse_fleet_target', targetType: 'base', titleKey: 'ui.skeletons_hearse_fleet_target_title' },
    );
    (interaction.data as any).continuationContext = { sourceBaseIndex: selected.baseIndex };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsHearseFleetTarget: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as BaseChoice;
    const continuation = data?.continuationContext as { sourceBaseIndex?: number } | undefined;
    if (selected.baseIndex === undefined || continuation?.sourceBaseIndex === undefined) return { state, events: [] };
    const buried = buildBuriedOptions(state.core, { baseIndex: continuation.sourceBaseIndex });
    const interaction = createSimpleChoice(
        `skeletons_hearse_fleet_cards_${now}`,
        playerId,
        '灵车队伍：选择要移动的埋葬牌',
        buried,
        { sourceId: 'skeletons_hearse_fleet_cards', targetType: 'generic', genericIntent: 'buried-card', multi: { min: 0, max: buried.length }, titleKey: 'ui.skeletons_hearse_fleet_cards_title' },
    );
    (interaction.data as any).continuationContext = {
        sourceBaseIndex: continuation.sourceBaseIndex,
        targetBaseIndex: selected.baseIndex,
    };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsHearseFleetCards: InteractionHandler = (state, _playerId, value, data, _random, _now) => {
    const continuation = data?.continuationContext as { sourceBaseIndex?: number; targetBaseIndex?: number } | undefined;
    if (continuation?.sourceBaseIndex === undefined || continuation.targetBaseIndex === undefined) return { state, events: [] };
    const picks = (Array.isArray(value) ? value : [value]) as BuriedChoice[];
    let nextState = state;
    for (const pick of picks.filter(pick => pick.cardUid && pick.baseIndex === continuation.sourceBaseIndex)) {
        nextState = moveBuriedCards(nextState, continuation.sourceBaseIndex, continuation.targetBaseIndex, [pick.cardUid!]);
    }
    return { state: nextState, events: [] };
};

const handleSkeletonsHearseFleetSpecialMode: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const selected = value as ModeChoice;
    const continuation = data?.continuationContext as { fixedBaseIndex?: number } | undefined;
    if (continuation?.fixedBaseIndex === undefined) return { state, events: [] };
    if (selected.mode === 'to_base') {
        const buried = buildOwnedBuriedOptions(state.core, playerId).filter(option => option.value.baseIndex !== continuation.fixedBaseIndex);
        const interaction = createSimpleChoice(
            `skeletons_hearse_fleet_special_into_${now}`,
            playerId,
            '灵车队伍：选择至多两张埋葬牌移入这个基地',
            buried,
            { sourceId: 'skeletons_hearse_fleet_special_into', targetType: 'generic', multi: { min: 0, max: Math.min(2, buried.length) }, titleKey: 'ui.skeletons_hearse_fleet_special_into_title' },
        );
        (interaction.data as any).continuationContext = continuation;
        return { state: queueInteraction(state, interaction), events: [] };
    }
    const buried = buildOwnedBuriedOptions(state.core, playerId, { baseIndex: continuation.fixedBaseIndex });
    const interaction = createSimpleChoice(
        `skeletons_hearse_fleet_special_from_${now}`,
        playerId,
        '灵车队伍：选择至多两张埋葬牌移出这个基地',
        buried,
        { sourceId: 'skeletons_hearse_fleet_special_from', targetType: 'generic', multi: { min: 0, max: Math.min(2, buried.length) }, titleKey: 'ui.skeletons_hearse_fleet_special_from_title' },
    );
    (interaction.data as any).continuationContext = continuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsHearseFleetSpecialInto: InteractionHandler = (state, _playerId, value, data, _random, _now) => {
    const continuation = data?.continuationContext as { fixedBaseIndex?: number } | undefined;
    if (continuation?.fixedBaseIndex === undefined) return { state, events: [] };
    const picks = (Array.isArray(value) ? value : [value]) as BuriedChoice[];
    let nextState = state;
    for (const pick of picks.filter(pick => pick.cardUid && pick.baseIndex !== undefined).slice(0, 2)) nextState = moveBuriedCards(nextState, pick.baseIndex!, continuation.fixedBaseIndex, [pick.cardUid!]);
    return { state: nextState, events: [] };
};

const handleSkeletonsHearseFleetSpecialFrom: InteractionHandler = (state, playerId, value, data, _random, now) => {
    const continuation = data?.continuationContext as { fixedBaseIndex?: number } | undefined;
    if (continuation?.fixedBaseIndex === undefined) return { state, events: [] };
    const picks = (Array.isArray(value) ? value : [value]) as BuriedChoice[];
    const selectedCards = picks.filter(pick => pick.cardUid && pick.baseIndex !== undefined).slice(0, 2);
    if (selectedCards.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(`skeletons_hearse_fleet_special_from_target_${now}`, playerId, '灵车队伍：选择移到的基地', buildBaseTargetOptions(getBaseOptions(state.core).filter(base => base.baseIndex !== continuation.fixedBaseIndex), state.core), { sourceId: 'skeletons_hearse_fleet_special_from_target', targetType: 'base', titleKey: 'ui.skeletons_hearse_fleet_special_from_target_title' });
    (interaction.data as any).continuationContext = { fixedBaseIndex: continuation.fixedBaseIndex, cardUids: selectedCards.map(card => card.cardUid!) };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleSkeletonsHearseFleetSpecialFromTarget: InteractionHandler = (state, _playerId, value, data, _random, _now) => {
    const selected = value as BaseChoice;
    const continuation = data?.continuationContext as { fixedBaseIndex?: number; cardUids?: string[] } | undefined;
    if (selected.baseIndex === undefined || continuation?.fixedBaseIndex === undefined || !continuation.cardUids?.length) return { state, events: [] };
    return { state: moveBuriedCards(state, continuation.fixedBaseIndex, selected.baseIndex, continuation.cardUids), events: [] };
};

const handleSkeletonsLordOfBonesOngoing: InteractionHandler = (state, _playerId, value, data, _random, now) => {
    const selected = value as CounterChoice;
    const continuation = data?.continuationContext as { targetMinionUid?: string; targetBaseIndex?: number } | undefined;
    if (!selected.apply || !continuation?.targetMinionUid || continuation.targetBaseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addPowerCounter(continuation.targetMinionUid, continuation.targetBaseIndex, 1, 'skeletons_lord_of_bones', now)],
    };
};

const handleSkeletonsGravestonesCounter: InteractionHandler = (state, _playerId, value, data, _random, now) => {
    const selected = value as CounterChoice;
    const continuation = data?.continuationContext as { targetMinionUid?: string; targetBaseIndex?: number } | undefined;
    if (!selected.apply || !continuation?.targetMinionUid || continuation.targetBaseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addPowerCounter(continuation.targetMinionUid, continuation.targetBaseIndex, 1, 'skeletons_gravestones', now)],
    };
};

const handleSkeletonsGravestonesAfterScoring: InteractionHandler = (state, playerId, value, data, random, now) => {
    const selected = value as BaseChoice;
    const continuation = data?.continuationContext as { sourceBaseIndex?: number; sourceCardUid?: string } | undefined;
    if (selected.baseIndex === undefined || continuation?.sourceBaseIndex === undefined) return { state, events: [] };
    const actionCard = state.core.bases[continuation.sourceBaseIndex]?.ongoingActions.find(action =>
        action.uid === continuation.sourceCardUid
        && action.defId === 'skeletons_gravestones'
        && ((action.metadata?.sourceControllerId ?? action.ownerId) === playerId),
    );
    if (!actionCard) return { state, events: [] };
    return {
        state,
        events: buildBuryCardEvents({
            core: state.core,
            matchState: state,
            playerId,
            cardUid: actionCard.uid,
            defId: actionCard.defId,
            baseIndex: selected.baseIndex,
            trueOwnerId: actionCard.ownerId,
            buriedFrom: 'play',
            reason: 'skeletons_gravestones',
            random,
            now,
        }),
    };
};

const handleSkeletonsGraveyardCounter: InteractionHandler = (state, _playerId, value, data, _random, now) => {
    const selected = value as CounterChoice;
    const continuation = data?.continuationContext as { targetMinionUid?: string; targetBaseIndex?: number } | undefined;
    if (!selected.apply || !continuation?.targetMinionUid || continuation.targetBaseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addPowerCounter(continuation.targetMinionUid, continuation.targetBaseIndex, 1, 'skeletons_graveyard', now)],
    };
};

const handleSkeletonsGraveGoodsCounter: InteractionHandler = (state, _playerId, value, data, _random, now) => {
    const selected = value as CounterChoice;
    const continuation = data?.continuationContext as { targetMinionUid?: string; targetBaseIndex?: number } | undefined;
    if (!selected.apply || !continuation?.targetMinionUid || continuation.targetBaseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [addPowerCounter(continuation.targetMinionUid, continuation.targetBaseIndex, 2, 'skeletons_grave_goods', now)],
    };
};

export function registerSkeletonInteractionHandlers(): void {
    registerInteractionHandler('skeletons_returned_one', handleSkeletonsReturnedOne);
    registerInteractionHandler('skeletons_returned_one_uncover', handleSkeletonsReturnedOneUncover);
    registerInteractionHandler('skeletons_place_em_down_base', handleSkeletonsPlaceEmDownBase);
    registerInteractionHandler('skeletons_place_em_down_cards', handleSkeletonsPlaceEmDownCards);
    registerInteractionHandler('skeletons_dig_em_up_base', handleSkeletonsDigEmUpBase);
    registerInteractionHandler('skeletons_dig_em_up_cards', handleSkeletonsDigEmUpCards);
    registerInteractionHandler('skeletons_burst_forth', handleSkeletonsBurstForth);
    registerInteractionHandler('skeletons_graveyard', handleSkeletonsGraveyard);
    registerInteractionHandler('skeletons_graveyard_counter', handleSkeletonsGraveyardCounter);
    registerInteractionHandler('skeletons_lord_of_bones_mode', handleSkeletonsLordOfBonesMode);
    registerInteractionHandler('skeletons_lord_of_bones_bury', handleSkeletonsLordOfBonesBury);
    registerInteractionHandler('skeletons_lord_of_bones_uncover', handleSkeletonsLordOfBonesUncover);
    registerInteractionHandler('skeletons_spooky_scary_base', handleSkeletonsSpookyScaryBase);
    registerInteractionHandler('skeletons_spooky_scary_card', handleSkeletonsSpookyScaryCard);
    registerInteractionHandler('skeletons_grave_goods_mode', handleSkeletonsGraveGoodsMode);
    registerInteractionHandler('skeletons_grave_goods_base', handleSkeletonsGraveGoodsBase);
    registerInteractionHandler('skeletons_grave_goods_bury', handleSkeletonsGraveGoodsBury);
    registerInteractionHandler('skeletons_grave_goods_discard', handleSkeletonsGraveGoodsDiscard);
    registerInteractionHandler('skeletons_grave_goods_bonus', handleSkeletonsGraveGoodsBonus);
    registerInteractionHandler('skeletons_grave_goods_bonus_base', handleSkeletonsGraveGoodsBonusBase);
    registerInteractionHandler('skeletons_grave_goods_uncover', handleSkeletonsGraveGoodsUncover);
    registerInteractionHandler('skeletons_grave_goods_counter', handleSkeletonsGraveGoodsCounter);
    registerInteractionHandler('skeletons_hearse_fleet_base', handleSkeletonsHearseFleetBase);
    registerInteractionHandler('skeletons_hearse_fleet_target', handleSkeletonsHearseFleetTarget);
    registerInteractionHandler('skeletons_hearse_fleet_cards', handleSkeletonsHearseFleetCards);
    registerInteractionHandler('skeletons_hearse_fleet_special_mode', handleSkeletonsHearseFleetSpecialMode);
    registerInteractionHandler('skeletons_hearse_fleet_special_into', handleSkeletonsHearseFleetSpecialInto);
    registerInteractionHandler('skeletons_hearse_fleet_special_from', handleSkeletonsHearseFleetSpecialFrom);
    registerInteractionHandler('skeletons_hearse_fleet_special_from_target', handleSkeletonsHearseFleetSpecialFromTarget);
    registerInteractionHandler('skeletons_lord_of_bones_ongoing', handleSkeletonsLordOfBonesOngoing);
    registerInteractionHandler('skeletons_gravestones_counter', handleSkeletonsGravestonesCounter);
    registerInteractionHandler('skeletons_gravestones_after_scoring', handleSkeletonsGravestonesAfterScoring);
}
