import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerAbilityProgram, registerSimpleAbility, resolveTalent } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildFieldSourceTargetPromptConfig,
    buildFieldSourceToBaseTargetOptions,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    buildSemanticOngoingAttachEvents,
    changeMinionController,
    createSkipOption,
    grantExtraAction,
    grantExtraMinion,
    inspectDeck,
    recoverCardsFromDiscard,
    revealDeckTop,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { createEffectProgram } from '../domain/abilityRuntime';
import {
    registerBaseAbilitySuppression,
    registerBaseScoringSuppression,
    registerProtection,
    registerRestriction,
    registerTrigger,
    type TriggerContext,
    type TriggerResult,
} from '../domain/ongoingEffects';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerDiscardActionPlayProvider } from '../domain/discardActionPlayability';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { createCardObjectRef, createCardTransferEvent } from '../domain/objectProvenance';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    isSameNameDefId,
    matchesDefId,
} from '../domain/utils';
import type {
    ActionCardDef,
    CardInstance,
    BaseDeckReorderedEvent,
    CardTransferredEvent,
    CardToDeckTopEvent,
    CardsDiscardedEvent,
    CardsMilledEvent,
    ExtraTurnQueuedEvent,
    FusionCardDef,
    DeckReorderedEvent,
    AttachedActionOnMinion,
    MinionCardDef,
    MinionOnBase,
    MinionPlayedEvent,
    OngoingDetachedEvent,
    OngoingActionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getMinionPower } from '../domain/abilityHelpers';
import { SHAYU_TRIGGER_CONTRACT } from './shayu_common';

type LocatedMinion = {
    minion: MinionOnBase;
    baseIndex: number;
};

export const COPYCAT_EXPLICIT_COPIED_TRIGGER_DEF_IDS = ['time_travelers_jumper'] as const;
export const CELLULAR_BONDING_EXPLICIT_COPIED_TRIGGER_DEF_IDS = [
    'cyborg_apes_missing_uplink',
    'cyborg_apes_flying_monkey',
] as const;
export const CELLULAR_BONDING_EXPLICIT_COPIED_PROTECTION_DEF_IDS = [
    'shapeshifters_shell_game',
    'cyborg_apes_shielding',
] as const;

type LocatedInPlayCard = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    type: 'minion' | 'ongoing' | 'attached';
    baseIndex: number;
    label: string;
};

function buildAbilityEffectSource(
    ctx: AbilityContext,
    options?: {
        sourceKind?: 'action' | 'nonAction';
        sourceBaseIndex?: number;
    },
) {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: options?.sourceBaseIndex ?? ctx.baseIndex,
        ...(options?.sourceKind !== undefined ? { sourceKind: options.sourceKind } : {}),
    };
}

function buildTriggerEffectSource(
    ctx: TriggerContext,
    options?: {
        sourceKind?: 'action' | 'nonAction';
        fallbackSourceDefId?: string;
        fallbackSourceBaseIndex?: number;
    },
) {
    return {
        sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
        ...(ctx.sourceCardUid !== undefined ? { sourceCardUid: ctx.sourceCardUid } : {}),
        sourceDefId: ctx.sourceDefId ?? options?.fallbackSourceDefId ?? ctx.triggerMinionDefId,
        sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
        ...(ctx.sourceBaseIndex !== undefined || options?.fallbackSourceBaseIndex !== undefined
            ? { sourceBaseIndex: ctx.sourceBaseIndex ?? options?.fallbackSourceBaseIndex }
            : {}),
        ...(options?.sourceKind !== undefined ? { sourceKind: options.sourceKind } : {}),
    };
}

function locateMinion(core: SmashUpCore, minionUid: string | undefined): LocatedMinion | undefined {
    if (!minionUid) return undefined;
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex += 1) {
        const minion = core.bases[baseIndex]?.minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function allMinions(core: SmashUpCore): LocatedMinion[] {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions.map(minion => ({ minion, baseIndex })),
    );
}

function allCardsInPlay(core: SmashUpCore): LocatedInPlayCard[] {
    return core.bases.flatMap((base, baseIndex) => [
        ...base.minions.map(minion => ({
            cardUid: minion.uid,
            defId: minion.defId,
            ownerId: minion.owner,
            type: 'minion' as const,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        })),
        ...base.ongoingActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            type: 'ongoing' as const,
            baseIndex,
            label: getCardDef(action.defId)?.name ?? action.defId,
        })),
        ...base.minions.flatMap(minion => minion.attachedActions.map(action => ({
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            type: 'attached' as const,
            baseIndex,
            label: getCardDef(action.defId)?.name ?? action.defId,
        }))),
    ]);
}

function locateCardInPlay(core: SmashUpCore, cardUid: string | undefined): LocatedInPlayCard | undefined {
    if (!cardUid) return undefined;
    return allCardsInPlay(core).find(card => card.cardUid === cardUid);
}

function getPrintedPower(defId: string): number {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? ((def as MinionCardDef).power ?? 0) : 0;
}

function isMinionCard(card: CardInstance): boolean {
    return card.type === 'minion' || getCardDef(card.defId)?.type === 'minion';
}

function isActionCard(card: CardInstance): boolean {
    return card.type === 'action' || getCardDef(card.defId)?.type === 'action';
}

function buildPlayMinionFromZoneEvent(params: {
    playerId: PlayerId;
    card: CardInstance;
    baseIndex: number;
    baseDefId?: string;
    now: number;
    fromDeck?: boolean;
    fromDiscard?: boolean;
    consumesNormalLimit?: boolean;
    skipOnPlayAbility?: boolean;
}): MinionPlayedEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId: params.playerId,
            cardUid: params.card.uid,
            defId: params.card.defId,
            baseIndex: params.baseIndex,
            baseDefId: params.baseDefId,
            power: getPrintedPower(params.card.defId),
            fromDeck: params.fromDeck,
            fromDiscard: params.fromDiscard,
            consumesNormalLimit: params.consumesNormalLimit ?? false,
            skipOnPlayAbility: params.skipOnPlayAbility,
        },
        timestamp: params.now,
    };
}

function deckReordered(playerId: PlayerId, deckUids: string[], now: number, sourcePlayerId?: PlayerId): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids,
            ...(sourcePlayerId !== undefined && sourcePlayerId !== playerId ? { sourcePlayerId } : {}),
        },
        timestamp: now,
    };
}

function extraTurnQueued(playerId: PlayerId, returnToPlayerIndex: number, reason: string, now: number): ExtraTurnQueuedEvent {
    return {
        type: SU_EVENTS.EXTRA_TURN_QUEUED,
        payload: { playerId, returnToPlayerIndex, reason },
        timestamp: now,
    };
}

function drawSpecificCards(playerId: PlayerId, cardUids: string[], now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: cardUids.length, cardUids },
        timestamp: now,
    } as SmashUpEvent;
}

function cardToDeckTop(
    card: CardInstance,
    ownerId: PlayerId,
    reason: string,
    now: number,
    sourcePlayerId?: PlayerId,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            ...(sourcePlayerId !== undefined ? { sourcePlayerId } : {}),
        },
        timestamp: now,
    };
}

function discardFromHand(playerId: PlayerId, cardUids: string[], now: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids },
        timestamp: now,
    };
}

function returnCardInPlayToOwnerHand(card: LocatedInPlayCard, reason: string, now: number): CardTransferredEvent {
    return createCardTransferEvent({
        card: createCardObjectRef({
            uid: card.cardUid,
            defId: card.defId,
            ownerId: card.ownerId,
            type: card.type === 'minion' ? 'minion' : 'action',
        }),
        fromPlayerId: card.ownerId,
        toPlayerId: card.ownerId,
        reason,
        timestamp: now,
    });
}

function millFromDeck(playerId: PlayerId, cardUids: string[], reason: string, now: number): CardsMilledEvent {
    return {
        type: SU_EVENTS.CARDS_MILLED,
        payload: { playerId, cardUids, reason },
        timestamp: now,
    };
}

function detachOngoing(cardUid: string, defId: string, ownerId: PlayerId, reason: string, now: number): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({
        cardUid,
        defId,
        ownerId,
        reason,
        now,
    });
}

function chooseTargetMinion(ctx: AbilityContext, predicate: (located: LocatedMinion) => boolean): LocatedMinion | undefined {
    const direct = locateMinion(ctx.state, ctx.targetMinionUid);
    if (direct && predicate(direct)) return direct;
    return allMinions(ctx.state).find(predicate);
}

function shapeshiftersBactaTheFuture(ctx: AbilityContext): AbilityResult {
    const target = chooseTargetMinion(ctx, () => true);
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const source = buildAbilityEffectSource(ctx, { sourceKind: 'action' });
    return {
        events: [
            ...buildValidatedDestroyEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'shapeshifters_bacta_the_future',
                now: ctx.now,
                sourcePlayerId: source.sourcePlayerId,
                sourceCardUid: source.sourceCardUid,
                sourceDefId: source.sourceDefId,
                sourceControllerId: source.sourceControllerId,
                sourceBaseIndex: source.sourceBaseIndex,
                sourceKind: source.sourceKind,
            }),
            grantExtraMinion(target.minion.owner, 'shapeshifters_bacta_the_future', ctx.now, undefined, { playTiming: 'immediate' }),
        ],
    };
}

function buildGeneticShiftAllEvents(state: SmashUpCore, playerId: PlayerId, now: number): SmashUpEvent[] {
    return allMinions(state)
        .filter(({ minion }) => minion.controller === playerId)
        .map(({ minion, baseIndex }) =>
            addTempPower(minion.uid, baseIndex, 1, 'shapeshifters_genetic_shift', now),
        );
}

function shapeshiftersGeneticShift(ctx: AbilityContext): AbilityResult {
    const target = locateMinion(ctx.state, ctx.targetMinionUid);
    if (target?.minion.controller === ctx.playerId) {
        return { events: [addTempPower(target.minion.uid, target.baseIndex, 3, 'shapeshifters_genetic_shift', ctx.now)] };
    }
    if (target) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (ctx.matchState) {
        const options: PromptOption<GeneticShiftChoice>[] = [
            {
                id: 'all-own-minions',
                label: '你的所有仆从 +1',
                labelKey: 'ui.shapeshifters_genetic_shift_all_option',
                value: { mode: 'all' },
                displayMode: 'button',
            },
            ...allMinions(ctx.state)
                .filter(({ minion }) => minion.controller === ctx.playerId)
                .map(({ minion }) =>
                    buildMinionPromptOption(minion, { mode: 'single', minionUid: minion.uid }),
                ),
        ];
        const interaction = createSimpleChoice(
            `shapeshifters_genetic_shift_choose_${ctx.now}`,
            ctx.playerId,
            '基因转变：选择强化模式',
            options,
            {
                sourceId: 'shapeshifters_genetic_shift_choose',
                targetType: 'generic',
                titleKey: 'ui.shapeshifters_genetic_shift_choose_title',
            },
        );
        interaction.data.allowedMinionUids = allMinions(ctx.state)
            .filter(({ minion }) => minion.controller === ctx.playerId)
            .map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return {
        events: buildGeneticShiftAllEvents(ctx.state, ctx.playerId, ctx.now),
    };
}

function shapeshiftersTransmogrify(ctx: AbilityContext): AbilityResult {
    const target = chooseTargetMinion(ctx, located => located.minion.controller === ctx.playerId);
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const targetPower = getMinionPower(ctx.state, target.minion, target.baseIndex);
    const source = buildAbilityEffectSource(ctx, { sourceKind: 'action' });
    const search = queueDeckMinionSearch(
        ctx,
        'shapeshifters_transmogrify_search',
        '变形：从牌库选择要额外打出的仆从',
        {
            baseIndex: target.baseIndex,
            reason: 'shapeshifters_transmogrify',
            maxPower: targetPower,
        },
        'ui.shapeshifters_transmogrify_search_title',
    );
    return {
        events: [
            ...buildValidatedDestroyEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'shapeshifters_transmogrify',
                now: ctx.now,
                sourcePlayerId: source.sourcePlayerId,
                sourceCardUid: source.sourceCardUid,
                sourceDefId: source.sourceDefId,
                sourceControllerId: source.sourceControllerId,
                sourceBaseIndex: source.sourceBaseIndex,
                sourceKind: source.sourceKind,
            }),
            ...search.events,
        ],
        matchState: search.matchState,
    };
}

function shapeshiftersReally(ctx: AbilityContext): AbilityResult {
    const target = chooseTargetMinion(ctx, located => located.minion.controller === ctx.playerId);
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const targetPower = getMinionPower(ctx.state, target.minion, target.baseIndex);
    const source = buildAbilityEffectSource(ctx, { sourceKind: 'action' });
    const search = queueDiscardMinionSearch(
        ctx,
        'shapeshifters_really_search',
        '...你确定？：从弃牌堆选择要额外打出的仆从',
        {
            reason: 'shapeshifters_really',
            maxPower: targetPower,
        },
        'ui.shapeshifters_really_search_title',
    );
    return {
        events: [
            ...buildValidatedDestroyEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'shapeshifters_really',
                now: ctx.now,
                sourcePlayerId: source.sourcePlayerId,
                sourceCardUid: source.sourceCardUid,
                sourceDefId: source.sourceDefId,
                sourceControllerId: source.sourceControllerId,
                sourceBaseIndex: source.sourceBaseIndex,
                sourceKind: source.sourceKind,
            }),
            ...search.events,
        ],
        matchState: search.matchState,
    };
}

function shapeshiftersMitosis(ctx: AbilityContext): AbilityResult {
    const target = chooseTargetMinion(ctx, located => located.minion.controller === ctx.playerId);
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const player = ctx.state.players[ctx.playerId];
    const sameNameCards = player?.hand.filter(card => isSameNameDefId(card.defId, target.minion.defId) && isMinionCard(card)) ?? [];
    if (ctx.matchState && sameNameCards.length > 0) {
        const options: PromptOption<SameNameHandMinionChoice>[] = [
            ...sameNameCards.map(card => buildCardPromptOption(card, {
                cardUid: card.uid,
                baseIndex: target.baseIndex,
                sameNameDefId: target.minion.defId,
            })),
            buildSkipSearchOption<SameNameHandMinionChoice>(),
        ];
        const interaction = createSimpleChoice(
            `shapeshifters_mitosis_choose_${ctx.now}`,
            ctx.playerId,
            '有丝分裂：选择要额外打出的同名仆从',
            options,
            {
                sourceId: 'shapeshifters_mitosis_choose',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.shapeshifters_mitosis_choose_title',
            },
        );
        interaction.data.allowedCardUids = sameNameCards.map(card => card.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events: sameNameCards.length > 0 ? [] : [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function shapeshiftersGelf(ctx: AbilityContext): AbilityResult {
    const located = locateMinion(ctx.state, ctx.cardUid);
    if (!located) return { events: [] };
    const search = queueDeckMinionSearch(
        ctx,
        'shapeshifters_gelf_search',
        'G.E.L.F.：从牌库选择力量 4 或以下且非 G.E.L.F. 的仆从',
        {
            baseIndex: located.baseIndex,
            reason: 'shapeshifters_gelf',
            maxPower: 4,
            excludeDefId: 'shapeshifters_gelf',
            extraDeckUidsForShuffle: [located.minion.uid],
        },
        'ui.shapeshifters_gelf_search_title',
    );
    return {
        events: [
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: located.minion.uid,
                defId: located.minion.defId,
                ownerId: located.minion.owner,
                sourcePlayerId: located.minion.owner !== ctx.playerId ? ctx.playerId : undefined,
                reason: 'shapeshifters_gelf',
                now: ctx.now,
                expectedLocation: 'bases',
            }),
            ...search.events,
        ],
        matchState: search.matchState,
    };
}

function shapeshiftersDoppelganger(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (ctx.triggerMinionDefId !== 'shapeshifters_doppelganger') return [];
    if (ctx.baseIndex === undefined) return [];
    const search = queueDeckMinionSearch(
        ctx,
        'shapeshifters_doppelganger_search',
        '相似者：从牌库选择要额外打出的仆从',
        {
            baseIndex: ctx.baseIndex,
            reason: 'shapeshifters_doppelganger',
        },
        'ui.shapeshifters_doppelganger_search_title',
    );
    return search.matchState ? search : search.events;
}

function canTriggerShapeshiftersDoppelganger(ctx: TriggerContext): boolean {
    if (ctx.triggerMinionDefId !== 'shapeshifters_doppelganger') return false;
    if (ctx.baseIndex === undefined || !ctx.matchState) return false;
    return buildDeckMinionSearchOptions(ctx.state, ctx.playerId, {
        baseIndex: ctx.baseIndex,
        reason: 'shapeshifters_doppelganger',
    }).length > 0;
}

function shapeshiftersCopycat(ctx: AbilityContext): AbilityResult {
    const candidates = allMinions(ctx.state).filter(located => located.minion.controller !== ctx.playerId);
    const direct = locateMinion(ctx.state, ctx.targetMinionUid);
    const target = direct
        ? candidates.find(candidate => candidate.minion.uid === direct.minion.uid)
        : undefined;
    if (ctx.matchState && !direct && candidates.length > 0) {
        const interaction = createSimpleChoice(
            `shapeshifters_copycat_choose_${ctx.now}`,
            ctx.playerId,
            '模仿者：选择要复制能力的其他玩家仆从',
            candidates.map(({ minion }) => buildMinionPromptOption(minion, { minionUid: minion.uid })),
            {
                sourceId: 'shapeshifters_copycat_choose',
                targetType: 'minion',
                titleKey: 'ui.shapeshifters_copycat_choose_title',
                autoResolveIfSingle: false,
            },
        );
        interaction.data.copycatUid = ctx.cardUid;
        interaction.data.allowedMinionUids = candidates.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!direct && !ctx.matchState && candidates.length > 0) return { events: [] };
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: [{
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: ctx.cardUid,
                baseIndex: ctx.baseIndex,
                metadataUpdate: {
                    copiedAbilityDefId: target.minion.defId,
                    copiedAbilityUntilTurn: ctx.state.turnNumber,
                },
                reason: 'shapeshifters_copycat',
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function shapeshiftersCellularBonding(ctx: AbilityContext): AbilityResult {
    const directHost = locateMinion(ctx.state, ctx.targetMinionUid) ?? locateAttachedActionHost(ctx.state, ctx.cardUid);
    const host = directHost?.minion.attachedActions.some(action => action.uid !== ctx.cardUid) ? directHost : undefined;
    if (!host) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const candidates = host.minion.attachedActions.filter(action => action.uid !== ctx.cardUid);
    if (ctx.matchState && candidates.length > 0) {
        const interaction = createSimpleChoice(
            `shapeshifters_cellular_bonding_choose_${ctx.now}`,
            ctx.playerId,
            '细胞结合：选择要复制能力的附着行动',
            candidates.map(action => buildAttachedActionPromptOption(action, { actionUid: action.uid, cardUid: action.uid })),
            {
                sourceId: 'shapeshifters_cellular_bonding_choose',
                targetType: 'ongoing',
                titleKey: 'ui.shapeshifters_cellular_bonding_choose_title',
                autoResolveIfSingle: false,
            },
        );
        interaction.data.hostMinionUid = host.minion.uid;
        interaction.data.hostBaseIndex = host.baseIndex;
        interaction.data.bondingCardUid = ctx.cardUid;
        interaction.data.allowedActionUids = candidates.map(action => action.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!ctx.matchState && candidates.length > 0) return { events: [] };
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function getCopycatCopiedDefId(minion: MinionOnBase, state: SmashUpCore): string | undefined {
    if (!matchesDefId(minion.defId, 'shapeshifters_copycat')) return undefined;
    if (minion.metadata?.copiedAbilityUntilTurn !== state.turnNumber) return undefined;
    const copiedDefId = minion.metadata?.copiedAbilityDefId;
    return typeof copiedDefId === 'string' && copiedDefId !== 'shapeshifters_copycat' ? copiedDefId : undefined;
}

function shapeshiftersCopycatTalent(ctx: AbilityContext): AbilityResult {
    const located = locateMinion(ctx.state, ctx.cardUid);
    const copiedDefId = located ? getCopycatCopiedDefId(located.minion, ctx.state) : undefined;
    if (!copiedDefId) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const copiedTalent = resolveTalent(copiedDefId);
    if (!copiedTalent) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return copiedTalent({ ...ctx, defId: copiedDefId });
}

function locateAttachedActionHost(core: SmashUpCore, cardUid: string | undefined): LocatedMinion | undefined {
    if (!cardUid) return undefined;
    return allMinions(core).find(({ minion }) =>
        minion.attachedActions.some(action => action.uid === cardUid),
    );
}

function getCellularBondingCopiedDefId(host: MinionOnBase, cardUid: string | undefined): string | undefined {
    if (!cardUid) return undefined;
    const copiedDefId = host.metadata?.cellularBondingCopiedActionDefId;
    if (typeof copiedDefId !== 'string' || copiedDefId === 'shapeshifters_cellular_bonding') return undefined;
    const hasBonding = host.attachedActions.some(action => action.uid === cardUid && action.defId === 'shapeshifters_cellular_bonding');
    return hasBonding ? copiedDefId : undefined;
}

function shapeshiftersCellularBondingTalent(ctx: AbilityContext): AbilityResult {
    const host = locateAttachedActionHost(ctx.state, ctx.cardUid);
    const copiedDefId = host ? getCellularBondingCopiedDefId(host.minion, ctx.cardUid) : undefined;
    if (!copiedDefId) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (copiedDefId === 'cyborg_apes_monkey_on_your_back') {
        return cyborgApesMonkeyOnYourBack(ctx);
    }
    const copiedTalent = resolveTalent(copiedDefId);
    if (!copiedTalent) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return copiedTalent({ ...ctx, defId: copiedDefId });
}

function cyborgApesBaboom(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantExtraAction(ctx.playerId, 'cyborg_apes_baboom', ctx.now, {
            playTiming: 'immediate',
            restrictToBase: ctx.baseIndex,
            restrictToMinionUid: ctx.cardUid,
        })],
    };
}

function getOngoingActionControllerId(action: { ownerId: PlayerId; metadata?: { sourceControllerId?: PlayerId } }): PlayerId {
    return action.metadata?.sourceControllerId ?? action.ownerId;
}

function locateMonkeyOnYourBackHost(state: SmashUpCore, playerId: PlayerId, actionUid: string | undefined): LocatedMinion | undefined {
    if (!actionUid) return undefined;
    return allMinions(state).find(({ minion }) =>
        minion.attachedActions.some(action =>
            action.uid === actionUid
            && getOngoingActionControllerId(action) === playerId,
        ),
    );
}

function getMonkeyOnYourBackTargets(state: SmashUpCore, playerId: PlayerId, hostBaseIndex: number): LocatedMinion[] {
    return allMinions(state).filter(located =>
        located.baseIndex === hostBaseIndex
        && located.minion.controller !== playerId
        && getMinionPower(state, located.minion, located.baseIndex) <= 4,
    );
}

function buildMonkeyOnYourBackEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    actionUid: string | undefined,
    targetMinionUid: string | undefined,
    now: number,
): SmashUpEvent[] {
    const host = locateMonkeyOnYourBackHost(state, playerId, actionUid);
    if (!host || !targetMinionUid) return [];
    const target = getMonkeyOnYourBackTargets(state, playerId, host.baseIndex)
        .find(candidate => candidate.minion.uid === targetMinionUid);
    if (!target) return [];
    const action = host.minion.attachedActions.find(attached => attached.uid === actionUid);
    const sourceControllerId = action ? getOngoingActionControllerId(action) : playerId;
    return [
        ...buildValidatedDestroyEvents(state, {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            destroyerId: playerId,
            reason: 'cyborg_apes_monkey_on_your_back',
            now,
            sourcePlayerId: sourceControllerId,
            sourceCardUid: action?.uid,
            sourceDefId: action?.defId ?? 'cyborg_apes_monkey_on_your_back',
            sourceControllerId,
            sourceBaseIndex: host.baseIndex,
            sourceKind: 'action',
        }),
        ...(action ? buildValidatedCardToDeckBottomEvents(state, {
            cardUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            sourcePlayerId: action.ownerId !== playerId ? playerId : undefined,
            reason: 'cyborg_apes_monkey_on_your_back',
            now,
            expectedLocation: 'bases',
        }) : []),
    ];
}

function cyborgApesMonkeyOnYourBack(ctx: AbilityContext): AbilityResult {
    const host = locateMonkeyOnYourBackHost(ctx.state, ctx.playerId, ctx.cardUid);
    if (!host) return { events: [] };
    const targets = getMonkeyOnYourBackTargets(ctx.state, ctx.playerId, host.baseIndex);
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (targets.length > 0 && ctx.matchState) {
        const interaction = createSimpleChoice(
            `cyborg_apes_monkey_on_your_back_choose_${ctx.now}`,
            ctx.playerId,
            '猴子在你的背上：选择要摧毁的随从',
            targets.map(({ minion, baseIndex }) => ({
                id: minion.uid,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(ctx.state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
                value: { minionUid: minion.uid },
                displayMode: 'card' as const,
            })),
            {
                sourceId: 'cyborg_apes_monkey_on_your_back_choose',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.cyborg_apes_monkey_on_your_back_choose_title',
            },
        );
        interaction.data.actionUid = ctx.cardUid;
        interaction.data.allowedMinionUids = targets.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!ctx.matchState) return { events: [] };
    return { events: [] };
}
function cyborgApesGoingBananas(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const baseActionEvents = base.ongoingActions
        .filter(action => getOngoingActionControllerId(action) !== ctx.playerId)
        .map(action =>
            detachOngoing(action.uid, action.defId, action.ownerId, 'cyborg_apes_going_bananas', ctx.now),
        );
    const minionActionEvents = base.minions.flatMap(minion =>
        minion.attachedActions
            .filter(action => getOngoingActionControllerId(action) !== ctx.playerId)
            .map(action =>
                detachOngoing(action.uid, action.defId, action.ownerId, 'cyborg_apes_going_bananas', ctx.now),
            ),
    );
    const events = [...baseActionEvents, ...minionActionEvents];
    return events.length > 0 ? { events } : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function cyborgApesShielding(ctx: AbilityContext): AbilityResult {
    const host = chooseTargetMinion(ctx, () => true);
    if (!host) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const events = host.minion.attachedActions
        .filter(action => getOngoingActionControllerId(action) !== ctx.playerId && action.uid !== ctx.cardUid)
        .map(action => detachOngoing(action.uid, action.defId, action.ownerId, 'cyborg_apes_shielding', ctx.now));
    return { events };
}

function cyborgApesMonkeySeeMonkeyDo(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealed = player.deck.slice(0, 5);
    const actions = revealed.filter(isActionCard);
    if (ctx.matchState && actions.length > 0) {
        const interaction = createSimpleChoice(
            `cyborg_apes_monkey_see_monkey_do_choose_${ctx.now}`,
            ctx.playerId,
            '猴子见，猴子做：选择要加入手牌的行动',
            actions.map(card => buildCardPromptOption(card, { cardUid: card.uid })),
            {
                sourceId: 'cyborg_apes_monkey_see_monkey_do_choose',
                targetType: 'generic',
                multi: { min: 0, max: actions.length },
                responseValidationMode: 'live',
                titleKey: 'ui.cyborg_apes_monkey_see_monkey_do_choose_title',
            },
        );
        interaction.data.inspectedUids = revealed.map(card => card.uid);
        interaction.data.allowedCardUids = actions.map(card => card.uid);
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'cyborg_apes_monkey_see_monkey_do', ctx.now),
                revealDeckTop(ctx.playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'cyborg_apes_monkey_see_monkey_do', ctx.now, ctx.playerId),
            ],
            matchState: queueInteraction(ctx.matchState, interaction),
        };
    }
    const remainingDeck = player.deck.filter(card => !actions.some(action => action.uid === card.uid));
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'cyborg_apes_monkey_see_monkey_do', ctx.now),
            revealDeckTop(ctx.playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'cyborg_apes_monkey_see_monkey_do', ctx.now, ctx.playerId),
            ...(actions.length > 0 ? [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: actions.length, cardUids: actions.map(card => card.uid) },
                timestamp: ctx.now,
            } as SmashUpEvent] : []),
            deckReordered(ctx.playerId, ctx.random.shuffle(remainingDeck).map(card => card.uid), ctx.now),
        ],
    };
}

function cyborgApesMissingUplink(ctx: TriggerContext): SmashUpEvent[] {
    const ownerId = ctx.sourceControllerId ?? ctx.playerId;
    let count = 0;
    for (const base of ctx.state.bases) {
        for (const minion of base.minions) {
            for (const action of minion.attachedActions) {
                if (
                    (action.defId === 'cyborg_apes_missing_uplink' || action.defId === 'cyborg_apes_missing_uplink_pod')
                    && getOngoingActionControllerId(action) === ownerId
                ) {
                    count += 1;
                }
            }
        }
    }
    if (count === 0) return [];
    const drawEvents = buildStandardDrawEvents(ctx.state, ownerId, count, ctx.random, ctx.now);
    return drawEvents.length > 0
        ? drawEvents
        : [buildAbilityFeedback(ownerId, 'feedback.deck_empty', ctx.now)];
}

function cyborgApesFlyingMonkeyAfterScoring(ctx: TriggerContext): TriggerResult {
    if (ctx.baseIndex === undefined) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const sourceHost = ctx.sourceCardUid
        ? base.minions.find(minion => minion.attachedActions.some(attached => attached.uid === ctx.sourceCardUid))
        : undefined;
    const sourceAction = sourceHost?.attachedActions.find(attached => attached.uid === ctx.sourceCardUid);
    const sourceCandidates = sourceHost && sourceAction
        ? [{ minion: sourceHost, action: sourceAction }]
        : base.minions
            .map(minion => ({
                minion,
                action: minion.attachedActions.find(attached => attached.defId === 'cyborg_apes_flying_monkey'),
            }))
            .filter((entry): entry is { minion: MinionOnBase; action: OngoingActionOnBase | AttachedActionOnMinion } => Boolean(entry.action));
    for (const { minion, action } of sourceCandidates) {
        const destinations = ctx.state.bases
            .map((candidate, index) => ({ base: candidate, index }))
            .filter(candidate => candidate.index !== ctx.baseIndex);
        if (destinations.length === 0 || !ctx.matchState) return { events: [] };
        return queueFlyingMonkeyMoveInteraction({
            matchState: ctx.matchState,
            state: ctx.state,
            minion,
            action,
            fromBaseIndex: ctx.baseIndex,
            destinations,
            now: ctx.now,
            title: '飞猴：选择要移动到的另一基地',
            titleKey: 'ui.cyborg_apes_flying_monkey_move_title',
            reason: 'cyborg_apes_flying_monkey',
            interactionIdPrefix: 'cyborg_apes_flying_monkey_move',
        });
    }
    return { events: [] };
}

function canTriggerCyborgApesFlyingMonkeyAfterScoring(ctx: TriggerContext): boolean {
    if (!ctx.matchState || ctx.baseIndex === undefined) return false;
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const sourceHost = ctx.sourceCardUid
        ? base.minions.find(minion => minion.attachedActions.some(attached => attached.uid === ctx.sourceCardUid))
        : undefined;
    const sourceAction = sourceHost?.attachedActions.find(attached => attached.uid === ctx.sourceCardUid);
    const hasSourceCandidate = sourceHost && sourceAction
        ? true
        : base.minions.some(minion =>
            minion.attachedActions.some(attached => attached.defId === 'cyborg_apes_flying_monkey'),
        );
    return hasSourceCandidate && ctx.state.bases.some((_candidate, index) => index !== ctx.baseIndex);
}

function cellularBondingCopiesAttachedAction(
    minion: MinionOnBase,
    copiedDefId: string,
): boolean {
    return minion.attachedActions.some(action =>
        action.defId === 'shapeshifters_cellular_bonding'
        && minion.metadata?.cellularBondingCardUid === action.uid
        && minion.metadata?.cellularBondingCopiedActionDefId === copiedDefId,
    );
}

function shapeshiftersCellularBondingMissingUplink(ctx: TriggerContext): SmashUpEvent[] {
    const ownerId = ctx.sourceControllerId ?? ctx.playerId;
    let count = 0;
    for (const base of ctx.state.bases) {
        for (const minion of base.minions) {
            for (const action of minion.attachedActions) {
                if (action.defId !== 'shapeshifters_cellular_bonding') continue;
                if (getOngoingActionControllerId(action) !== ownerId) continue;
                if (getCellularBondingCopiedDefId(minion, action.uid) === 'cyborg_apes_missing_uplink') {
                    count += 1;
                }
            }
        }
    }
    if (count === 0) return [];
    const drawEvents = buildStandardDrawEvents(ctx.state, ownerId, count, ctx.random, ctx.now);
    return drawEvents.length > 0 ? drawEvents : [buildAbilityFeedback(ownerId, 'feedback.deck_empty', ctx.now)];
}

function shapeshiftersCellularBondingFlyingMonkey(ctx: TriggerContext): TriggerResult {
    if (ctx.baseIndex === undefined) return { events: [] };
    const host = locateAttachedActionHost(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex) return { events: [] };
    if (getCellularBondingCopiedDefId(host.minion, ctx.sourceCardUid) !== 'cyborg_apes_flying_monkey') return { events: [] };
    const bondingAction = host.minion.attachedActions.find(action => action.uid === ctx.sourceCardUid);
    if (!bondingAction) return { events: [] };
    const destinations = ctx.state.bases
        .map((candidate, index) => ({ base: candidate, index }))
        .filter(candidate => candidate.index !== ctx.baseIndex);
    if (destinations.length === 0 || !ctx.matchState) return { events: [] };
    return queueFlyingMonkeyMoveInteraction({
        matchState: ctx.matchState,
        state: ctx.state,
        minion: host.minion,
        action: bondingAction,
        fromBaseIndex: host.baseIndex,
        destinations,
        now: ctx.now,
        title: '细胞结合-飞猴：选择要移动到的另一基地',
        titleKey: 'ui.shapeshifters_cellular_bonding_flying_monkey_move_title',
        reason: 'shapeshifters_cellular_bonding_flying_monkey',
        interactionIdPrefix: 'shapeshifters_cellular_bonding_flying_monkey_move',
    });
}

function canTriggerShapeshiftersCellularBondingFlyingMonkey(ctx: TriggerContext): boolean {
    if (!ctx.matchState || ctx.baseIndex === undefined) return false;
    const host = locateAttachedActionHost(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex) return false;
    if (getCellularBondingCopiedDefId(host.minion, ctx.sourceCardUid) !== 'cyborg_apes_flying_monkey') return false;
    const bondingAction = host.minion.attachedActions.find(action => action.uid === ctx.sourceCardUid);
    return !!bondingAction && ctx.state.bases.some((_candidate, index) => index !== ctx.baseIndex);
}

function superSpiesSpy(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const revealed = player?.deck.slice(0, 3) ?? [];
    if (revealed.length === 0) return { events: [] };
    const events = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'super_spies_spy', ctx.now),
        revealDeckTop(ctx.playerId, ctx.playerId, revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'super_spies_spy', ctx.now, ctx.playerId),
    ];
    if (!ctx.matchState) {
        return { events };
    }
    const interaction = createSimpleChoice(
        `super_spies_spy_reorder_${ctx.now}`,
        ctx.playerId,
        '间谍：将这几张牌按任意顺序放回牌库顶/底',
        buildIsiSwinginPadReorderOptions(ctx.playerId, revealed),
        {
            sourceId: 'super_spies_spy_reorder',
            targetType: 'generic',
            titleKey: 'ui.super_spies_spy_reorder_title',
            autoResolveIfSingle: false,
        },
    );
    attachDeckReorderContext(interaction, ctx.playerId, revealed);
    return {
        events,
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function superSpiesOperative(ctx: AbilityContext): AbilityResult {
    const playerOptions = ctx.state.turnOrder
        .filter(playerId => Boolean(ctx.state.players[playerId]?.deck[0]))
        .map(playerId => ({
            id: `player-${playerId}`,
            label: `玩家 ${playerId}`,
            value: { targetPlayerId: playerId },
            displayMode: 'button' as const,
        }));
    if (!ctx.matchState || playerOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `super_spies_operative_players_${ctx.now}`,
        ctx.playerId,
        '密探：选择要查看牌库顶牌的玩家',
        playerOptions,
        {
            sourceId: 'super_spies_operative_players',
            targetType: 'player',
            multi: { min: 0, max: playerOptions.length },
            responseValidationMode: 'live',
            titleKey: 'ui.super_spies_operative_players_title',
        },
    );
    interaction.data.allowedPlayerIds = playerOptions.map(option => option.value.targetPlayerId);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function superSpiesLiveAndLetChum(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = allMinions(ctx.state).filter(located =>
        located.baseIndex === baseIndex && getMinionPower(ctx.state, located.minion, located.baseIndex) <= 3,
    );
    const direct = locateMinion(ctx.state, ctx.targetMinionUid);
    const target = direct && candidates.some(candidate => candidate.minion.uid === direct.minion.uid)
        ? direct
        : undefined;
    const source = buildAbilityEffectSource(ctx, { sourceKind: 'action', sourceBaseIndex: baseIndex });
    if (ctx.matchState && !direct && candidates.length > 0) {
        const interaction = createSimpleChoice(
            `super_spies_live_and_let_chum_choose_${ctx.now}`,
            ctx.playerId,
            '让对手鱼饵：选择要摧毁的低力量随从',
            candidates.map(({ minion }) => buildMinionPromptOption(minion, { minionUid: minion.uid })),
            {
                sourceId: 'super_spies_live_and_let_chum_choose',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.super_spies_live_and_let_chum_choose_title',
            },
        );
        interaction.data.baseIndex = baseIndex;
        interaction.data.allowedMinionUids = candidates.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!direct && !ctx.matchState && candidates.length > 0) return { events: [] };
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: buildValidatedDestroyEvents(ctx.state, {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            destroyerId: ctx.playerId,
            reason: 'super_spies_live_and_let_chum',
            now: ctx.now,
            sourcePlayerId: source.sourcePlayerId,
            sourceCardUid: source.sourceCardUid,
            sourceDefId: source.sourceDefId,
            sourceControllerId: source.sourceControllerId,
            sourceBaseIndex: source.sourceBaseIndex,
            sourceKind: source.sourceKind,
        }),
    };
}

function superSpiesTheSpyWhoDitchedMe(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    for (const playerId of ctx.state.turnOrder) {
        if (playerId === ctx.playerId) continue;
        const player = ctx.state.players[playerId];
        if (!player) continue;
        const minionCards = player.hand.filter(isMinionCard);
        if (minionCards.length > 0) {
            if (matchState) {
                const interaction = createSimpleChoice(
                    `super_spies_the_spy_who_ditched_me_discard_${playerId}_${ctx.now}`,
                    playerId,
                    '抛弃我的间谍：选择一张随从牌弃掉',
                    minionCards.map(card => buildCardPromptOption(card, { cardUid: card.uid })),
                    {
                        sourceId: 'super_spies_the_spy_who_ditched_me_discard',
                        targetType: 'hand',
                        autoResolveIfSingle: false,
                        titleKey: 'ui.super_spies_the_spy_who_ditched_me_discard_title',
                    },
                );
                interaction.data.allowedCardUids = minionCards.map(card => card.uid);
                matchState = queueInteraction(matchState, interaction);
            }
        } else {
            events.push(revealHandForPlayer(playerId, ctx.playerId, player.hand, 'super_spies_the_spy_who_ditched_me', ctx.now));
        }
    }
    return { events, matchState };
}

function revealHandForPlayer(
    targetPlayerId: PlayerId,
    viewerPlayerId: PlayerId,
    cards: CardInstance[],
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.REVEAL_HAND,
        payload: {
            targetPlayerId,
            viewerPlayerId,
            cards: cards.map(card => ({ uid: card.uid, defId: card.defId })),
            reason,
            sourcePlayerId: viewerPlayerId,
        },
        timestamp: now,
    };
}

function superSpiesPermitToKill(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    for (const playerId of ctx.state.turnOrder) {
        if (playerId === ctx.playerId) continue;
        const revealed = ctx.state.players[playerId]?.deck.slice(0, 2) ?? [];
        if (revealed.length === 0) continue;
        events.push(inspectDeck(playerId, ctx.playerId, revealed.length, 'super_spies_permit_to_kill', ctx.now));
        events.push(revealDeckTop(playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'super_spies_permit_to_kill', ctx.now, ctx.playerId));
        const revealedMinions = revealed.filter(isMinionCard);
        if (revealedMinions.length > 0) {
            events.push(millFromDeck(playerId, revealedMinions.map(card => card.uid), 'super_spies_permit_to_kill', ctx.now));
        }
        const rest = revealed.filter(card => !isMinionCard(card));
        if (matchState && rest.length > 1) {
            const interaction = createSimpleChoice(
                `super_spies_permit_to_kill_order_${playerId}_${ctx.now}`,
                ctx.playerId,
                '杀戮许可：选择其余牌回到牌库顶的顺序',
                buildDeckTopOrderOptions(playerId, rest, 'permit-kill-order'),
                {
                    sourceId: 'super_spies_permit_to_kill_order',
                    targetType: 'generic',
                    titleKey: 'ui.super_spies_permit_to_kill_order_title',
                },
            );
            attachDeckReorderContext(interaction, playerId, rest);
            matchState = queueInteraction(matchState, interaction);
        }
    }
    return { events, matchState };
}

function superSpiesForMyEyesOnly(ctx: AbilityContext): AbilityResult {
    const revealed = ctx.state.players[ctx.playerId]?.deck.slice(0, 5) ?? [];
    const events: SmashUpEvent[] = [
        inspectDeck(ctx.playerId, ctx.playerId, revealed.length, 'super_spies_for_my_eyes_only', ctx.now),
        revealDeckTop(ctx.playerId, ctx.playerId, revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'super_spies_for_my_eyes_only', ctx.now, ctx.playerId),
    ];
    if (revealed.length === 0 || !ctx.matchState) return { events };
    const interaction = createSimpleChoice(
        `super_spies_for_my_eyes_only_reorder_${ctx.now}`,
        ctx.playerId,
        '只为我的眼睛：选择牌库顶/牌库底顺序',
        buildIsiSwinginPadReorderOptions(ctx.playerId, revealed),
        {
            sourceId: 'super_spies_for_my_eyes_only_reorder',
            targetType: 'generic',
            titleKey: 'ui.super_spies_for_my_eyes_only_reorder_title',
            autoResolveIfSingle: false,
        },
    );
    attachDeckReorderContext(interaction, ctx.playerId, revealed);
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function markTemporaryControlUntilTurnEnd(
    minionUid: string,
    baseIndex: number,
    originalController: PlayerId,
    controller: PlayerId,
    turnNumber: number,
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid,
            baseIndex,
            metadataUpdate: {
                temporaryControlOriginalController: originalController,
                temporaryControlPlayerId: controller,
                temporaryControlTurn: turnNumber,
            },
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function superSpiesTheBaseIsNotEnough(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const candidates = allMinions(ctx.state).filter(located =>
        located.baseIndex === baseIndex
        && getMinionPower(ctx.state, located.minion, located.baseIndex) <= 4,
    );
    const direct = locateMinion(ctx.state, ctx.targetMinionUid);
    const target = direct && candidates.some(candidate => candidate.minion.uid === direct.minion.uid)
        ? direct
        : undefined;
    if (ctx.matchState && !direct && candidates.length > 0) {
        const interaction = createSimpleChoice(
            `super_spies_the_base_is_not_enough_choose_${ctx.now}`,
            ctx.playerId,
            '基地永远不够：选择要控制的低力量随从',
            candidates.map(({ minion }) => buildMinionPromptOption(minion, { minionUid: minion.uid })),
            {
                sourceId: 'super_spies_the_base_is_not_enough_choose',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.super_spies_the_base_is_not_enough_choose_title',
            },
        );
        interaction.data.baseIndex = baseIndex;
        interaction.data.allowedMinionUids = candidates.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!direct && !ctx.matchState && candidates.length > 0) return { events: [] };
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: [
            changeMinionController(
                target.minion.uid,
                target.minion.defId,
                target.baseIndex,
                target.minion.owner,
                target.minion.controller,
                ctx.playerId,
                ctx.playerId,
                'super_spies_the_base_is_not_enough',
                ctx.now,
            ),
            markTemporaryControlUntilTurnEnd(
                target.minion.uid,
                target.baseIndex,
                target.minion.controller,
                ctx.playerId,
                ctx.state.turnNumber,
                'super_spies_the_base_is_not_enough',
                ctx.now,
            ),
        ],
    };
}

function superSpiesFromQWithLove(ctx: AbilityContext): AbilityResult {
    const drawCards = ctx.state.players[ctx.playerId]?.deck.slice(0, 3) ?? [];
    const projectedHand = [
        ...(ctx.state.players[ctx.playerId]?.hand ?? []),
        ...drawCards,
    ].filter(card => card.uid !== ctx.cardUid);
    const discardCount = Math.min(2, projectedHand.length);
    if (ctx.matchState && discardCount > 0) {
        const options = projectedHand.map(card => buildCardPromptOption(card, { cardUid: card.uid }));
        const interaction = createSimpleChoice(
            `super_spies_from_q_with_love_discard_${ctx.now}`,
            ctx.playerId,
            '来自Q的爱：选择要弃掉的两张牌',
            options,
            {
                sourceId: 'super_spies_from_q_with_love_discard',
                targetType: 'hand',
                multi: { min: discardCount, max: discardCount },
                responseValidationMode: 'live',
                titleKey: 'ui.super_spies_from_q_with_love_discard_title',
            },
        );
        interaction.data.allowedCardUids = projectedHand.map(card => card.uid);
        interaction.data.discardCount = discardCount;
        return {
            events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now),
            matchState: queueInteraction(ctx.matchState, interaction),
        };
    }
    return {
        events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now),
    };
}

function superSpiesDiscardsAreForever(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of ctx.state.turnOrder) {
        const player = ctx.state.players[playerId];
        if (!player) continue;
        const revealed: CardInstance[] = [];
        for (const card of player.deck) {
            revealed.push(card);
            if (isMinionCard(card)) break;
        }
        if (revealed.length === 0) continue;
        events.push(revealDeckTop(playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, 'super_spies_discards_are_forever', ctx.now, ctx.playerId));
        events.push(millFromDeck(playerId, revealed.map(card => card.uid), 'super_spies_discards_are_forever', ctx.now));
    }
    return { events };
}

function superSpiesMole(ctx: AbilityContext): AbilityResult {
    return {
        events: [grantExtraAction(ctx.playerId, 'super_spies_mole', ctx.now, {
            playTiming: 'immediate',
            restrictToBase: ctx.baseIndex,
            specialActionWindow: 'meFirst',
        })],
    };
}

function superSpiesSecretAgent(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    const actionPlayerId = ctx.playerId;
    if (!actionPlayerId) return [];
    const hasSecretAgent = allMinions(ctx.state).some(({ minion }) =>
        minion.defId === 'super_spies_secret_agent' && minion.controller !== actionPlayerId,
    );
    if (!hasSecretAgent) return [];
    const hand = ctx.state.players[actionPlayerId]?.hand ?? [];
    if (hand.length === 0) return [];
    if (ctx.matchState && hand.length > 0) {
        const interaction = createSimpleChoice(
            `super_spies_secret_agent_discard_${ctx.now}`,
            actionPlayerId,
            '秘密特工：选择要弃掉的手牌',
            hand.map(card => buildCardPromptOption(card, { cardUid: card.uid })),
            {
                sourceId: 'super_spies_secret_agent_discard',
                targetType: 'hand',
                autoResolveIfSingle: false,
                titleKey: 'ui.super_spies_secret_agent_discard_title',
            },
        );
        interaction.data.allowedCardUids = hand.map(card => card.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return [];
}

function canTriggerSuperSpiesSecretAgent(ctx: TriggerContext): boolean {
    const actionPlayerId = ctx.playerId;
    if (!actionPlayerId || !ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId) return false;
    if (ctx.sourceControllerId === actionPlayerId) return false;
    const source = allMinions(ctx.state).some(({ minion }) =>
        minion.uid === ctx.sourceCardUid
        && minion.defId === 'super_spies_secret_agent'
        && minion.controller === ctx.sourceControllerId,
    );
    if (!source) return false;
    return (ctx.state.players[actionPlayerId]?.hand.length ?? 0) > 0;
}

function timeTravelersTimeRaider(ctx: AbilityContext): AbilityResult {
    const discard = ctx.state.players[ctx.playerId]?.discard ?? [];
    if (discard.length > 0 && ctx.matchState) {
        const interaction = createSimpleChoice(
            `time_travelers_time_raider_choose_${ctx.now}`,
            ctx.playerId,
            '时间掠夺者：选择弃牌堆一张牌放到牌库底',
            discard.map(card => ({
                id: card.uid,
                label: cardLabel(card),
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            })),
            {
                sourceId: 'time_travelers_time_raider_choose',
                targetType: 'discard',
                autoResolveIfSingle: false,
                titleKey: 'ui.time_travelers_time_raider_choose_title',
            },
        );
        interaction.data.allowedCardUids = discard.map(card => card.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (discard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return { events: [] };
}

function timeTravelersRepeaterPerfect(ctx: AbilityContext): AbilityResult {
    const actions = ctx.state.players[ctx.playerId]?.discard.filter(isActionCard) ?? [];
    if (actions.length > 0 && ctx.matchState) {
        const interaction = createSimpleChoice(
            `time_travelers_repeater_perfect_choose_${ctx.now}`,
            ctx.playerId,
            '往复时间者：选择弃牌堆一个行动放到牌库顶',
            actions.map(card => ({
                id: card.uid,
                label: cardLabel(card),
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            })),
            {
                sourceId: 'time_travelers_repeater_perfect_choose',
                targetType: 'discard',
                autoResolveIfSingle: false,
                titleKey: 'ui.time_travelers_repeater_perfect_choose_title',
            },
        );
        interaction.data.allowedCardUids = actions.map(card => card.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (actions.length > 0 && !ctx.matchState) return { events: [] };
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
}

function timeTravelersDoctorWhen(ctx: AbilityContext): AbilityResult {
    const candidates = allMinions(ctx.state).filter(located =>
        located.minion.controller === ctx.playerId && located.minion.uid !== ctx.cardUid,
    );
    const direct = locateMinion(ctx.state, ctx.targetMinionUid);
    const target = direct && candidates.some(candidate => candidate.minion.uid === direct.minion.uid)
        ? direct
        : undefined;
    if (ctx.matchState && !target && candidates.length > 1) {
        const interaction = createSimpleChoice(
            `time_travelers_doctor_when_choose_${ctx.now}`,
            ctx.playerId,
            '时间博士：选择要返回手牌的另一个己方随从',
            [
                createSkipOption('不返回随从', 'ui.time_travelers_doctor_when_skip_option'),
                ...candidates.map(({ minion }) => buildMinionPromptOption(minion, { minionUid: minion.uid })),
            ],
            {
                sourceId: 'time_travelers_doctor_when_choose',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.time_travelers_doctor_when_choose_title',
            },
        );
        interaction.data.doctorUid = ctx.cardUid;
        interaction.data.allowedMinionUids = candidates.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (ctx.matchState && !target && candidates.length === 1) {
        const interaction = createSimpleChoice(
            `time_travelers_doctor_when_choose_${ctx.now}`,
            ctx.playerId,
            '时间博士：选择是否返回另一个己方随从',
            [
                createSkipOption('不返回随从', 'ui.time_travelers_doctor_when_skip_option'),
                buildMinionPromptOption(candidates[0].minion, { minionUid: candidates[0].minion.uid }),
            ],
            {
                sourceId: 'time_travelers_doctor_when_choose',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.time_travelers_doctor_when_optional_title',
            },
        );
        interaction.data.doctorUid = ctx.cardUid;
        interaction.data.allowedMinionUids = candidates.map(({ minion }) => minion.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    if (!ctx.matchState && !target) return { events: [] };
    if (!target) return { events: [] };
    return {
        events: [
            ...buildValidatedReturnEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                reason: 'time_travelers_doctor_when',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
            }),
            grantExtraMinion(ctx.playerId, 'time_travelers_doctor_when', ctx.now, undefined, {
                sameNameDefId: target.minion.defId,
                specificCardUid: target.minion.uid,
                playTiming: 'immediate',
            }),
        ],
    };
}

function timeTravelersItsAstounding(ctx: AbilityContext): AbilityResult {
    const actions = (ctx.state.players[ctx.playerId]?.discard.filter(isActionCard) ?? [])
        .filter(card => buildDiscardActionTargetOptions(ctx.state, ctx.playerId, card).length > 0);
    if (ctx.matchState && actions.length > 0) {
        const interaction = createSimpleChoice(
            `time_travelers_its_astounding_choose_${ctx.now}`,
            ctx.playerId,
            '令人震惊：选择从弃牌堆打出的行动',
            actions.map(card => buildCardPromptOption(card, { cardUid: card.uid })),
            {
                sourceId: 'time_travelers_its_astounding_choose',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.time_travelers_its_astounding_choose_title',
            },
        );
        interaction.data.allowedCardUids = actions.map(card => card.uid);
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events: [] };
}

function timeTravelersIntoTheTimeSlip(ctx: AbilityContext): AbilityResult {
    const target = locateCardInPlay(ctx.state, ctx.targetMinionUid);
    if (target) {
        return {
            events: [returnCardInPlayToOwnerHand(target, 'time_travelers_into_the_time_slip', ctx.now)],
        };
    }
    const inPlay = allCardsInPlay(ctx.state);
    if (inPlay.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (!ctx.matchState) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `time_travelers_into_the_time_slip_choose_${ctx.now}`,
        ctx.playerId,
        '时间流动：选择一张场上的牌返回其拥有者手牌',
        inPlay.map(card => ({
            id: card.cardUid,
            label: card.label,
            value: card.type === 'minion'
                ? { cardUid: card.cardUid, minionUid: card.cardUid }
                : { cardUid: card.cardUid },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'time_travelers_into_the_time_slip_choose',
            targetType: 'board',
            autoResolveIfSingle: false,
            titleKey: 'ui.time_travelers_into_the_time_slip_choose_title',
        },
    );
    interaction.data.allowedCardUids = inPlay.map(card => card.cardUid);
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function timeTravelersGigawatts(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const actions = player.discard.filter(isActionCard);
    const minions = player.discard.filter(isMinionCard);
    if (actions.length > 0 && minions.length > 0 && ctx.matchState) {
        const allowedCardTypes = ['action', 'minion'];
        const interaction = createSimpleChoice(
            `time_travelers_1_21_gigawatts_choose_${ctx.now}`,
            ctx.playerId,
            '1.21 千兆瓦：选择把行动或仆从放回牌库',
            [
                { id: 'actions', label: '行动', labelKey: 'ui.time_travelers_1_21_gigawatts_action_option', value: { cardType: 'action' }, displayMode: 'button' as const },
                { id: 'minions', label: '仆从', labelKey: 'ui.time_travelers_1_21_gigawatts_minion_option', value: { cardType: 'minion' }, displayMode: 'button' as const },
            ],
            {
                sourceId: 'time_travelers_1_21_gigawatts_choose',
                targetType: 'button',
                titleKey: 'ui.time_travelers_1_21_gigawatts_choose_title',
            },
        );
        interaction.data.allowedCardTypes = allowedCardTypes;
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    const selected = actions.length > 0 ? actions : minions;
    if (selected.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    return {
        events: buildOwnerScopedDeckReorderedEventsFromDiscard(ctx.state, ctx.playerId, selected, ctx.random, ctx.now),
    };
}

function buildOwnerScopedDeckReorderedEventsFromDiscard(
    core: SmashUpCore,
    sourcePlayerId: PlayerId,
    selectedCards: CardInstance[],
    random: { shuffle: <T>(items: T[]) => T[] },
    now: number,
): DeckReorderedEvent[] {
    const cardsByOwner = new Map<PlayerId, CardInstance[]>();
    for (const card of selectedCards) {
        const ownerCards = cardsByOwner.get(card.owner) ?? [];
        ownerCards.push(card);
        cardsByOwner.set(card.owner, ownerCards);
    }
    const events: DeckReorderedEvent[] = [];
    for (const [ownerId, cards] of cardsByOwner) {
        const owner = core.players[ownerId];
        if (!owner) continue;
        events.push(deckReordered(
            ownerId,
            random.shuffle([...cards, ...owner.deck]).map(card => card.uid),
            now,
            ownerId !== sourcePlayerId ? sourcePlayerId : undefined,
        ));
    }
    return events;
}

function timeTravelersDoOver(ctx: AbilityContext): AbilityResult {
    const target = chooseTargetMinion(ctx, located => located.minion.controller === ctx.playerId);
    if (!target) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return {
        events: [
            ...buildValidatedReturnEvents(ctx.state, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                reason: 'time_travelers_do_over',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
            }),
            grantExtraMinion(ctx.playerId, 'time_travelers_do_over', ctx.now, undefined, {
                sameNameDefId: target.minion.defId,
                specificCardUid: target.minion.uid,
                playTiming: 'immediate',
            }),
        ],
    };
}

function timeTravelersTimeWalk(ctx: AbilityContext): AbilityResult {
    const ownerId = findCardOwnerAcrossPlayerZones(ctx.state, ctx.cardUid, ctx.defId, ctx.playerId);
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'time_travelers_time_walk', ctx.now),
            grantExtraAction(ctx.playerId, 'time_travelers_time_walk', ctx.now),
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now),
            {
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: ctx.cardUid,
                    defId: ctx.defId,
                    ownerId,
                    ...(ownerId !== ctx.playerId ? { sourcePlayerId: ctx.playerId } : {}),
                    reason: 'time_travelers_time_walk',
                },
                timestamp: ctx.now,
            } as SmashUpEvent,
        ],
    };
}

function reorderBaseDiscardTop(baseDefId: string, reason: string, now: number): BaseDeckReorderedEvent {
    return {
        type: SU_EVENTS.BASE_DECK_REORDERED,
        payload: {
            topDefIds: [baseDefId],
            reason,
        },
        timestamp: now,
    };
}

function timeTravelersTimeIsFleeting(ctx: AbilityContext): AbilityResult {
    const scoredBaseDefId = ctx.baseIndex !== undefined ? ctx.state.bases[ctx.baseIndex]?.defId : undefined;
    const baseDiscard = (ctx.state.baseDiscard ?? []).filter(defId => defId !== scoredBaseDefId);
    if (baseDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (!ctx.matchState) return { events: [] };
    const options: PromptOption<{ baseDefId: string }>[] = baseDiscard.map(defId => {
        const def = getBaseDef(defId);
        return {
            id: defId,
            label: def?.name ?? defId,
            value: { baseDefId: defId },
        };
    });
    const interaction = createSimpleChoice(
        `time_travelers_time_is_fleeting_choose_${ctx.now}`,
        ctx.playerId,
        '时间流逝：选择要放到基地牌库顶的基地',
        options,
        {
            sourceId: 'time_travelers_time_is_fleeting_choose',
            targetType: 'generic',
            autoResolveIfSingle: false,
            titleKey: 'ui.time_travelers_time_is_fleeting_choose_title',
        },
    );
    interaction.data.scoredBaseDefId = scoredBaseDefId;
    interaction.data.allowedBaseDefIds = baseDiscard;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function timeTravelersJumper(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerMinionDefId !== 'time_travelers_jumper' || !ctx.triggerMinionUid) return [];
    return recoverDiscardedJumperLikeMinion(ctx, 'time_travelers_jumper');
}

function isTempleOfGojuDeckBottomCandidate(ctx: TriggerContext, located: LocatedMinion): boolean {
    const base = ctx.state.bases[located.baseIndex];
    if (base?.defId !== 'base_temple_of_goju') return false;
    const controlledMinions = base.minions.filter(minion => minion.controller === located.minion.controller);
    if (controlledMinions.length === 0) return false;
    const highestPower = Math.max(...controlledMinions.map(minion => getMinionPower(ctx.state, minion, located.baseIndex)));
    return getMinionPower(ctx.state, located.minion, located.baseIndex) === highestPower;
}

function canRecoverDiscardedJumperLikeMinion(ctx: TriggerContext): boolean {
    if (!ctx.triggerMinionUid) return false;
    if (Object.values(ctx.state.players).some(player =>
        player.discard.some(card => card.uid === ctx.triggerMinionUid),
    )) {
        return true;
    }
    const located = locateMinion(ctx.state, ctx.triggerMinionUid);
    return Boolean(located && !isTempleOfGojuDeckBottomCandidate(ctx, located));
}

function recoverDiscardedJumperLikeMinion(ctx: TriggerContext, reason: string): SmashUpEvent[] {
    if (!ctx.triggerMinionUid) return [];
    const ownerId = ctx.triggerMinion?.owner
        ?? Object.values(ctx.state.players).find(player =>
            player.discard.some(card => card.uid === ctx.triggerMinionUid),
        )?.id;
    if (!ownerId) return [];
    const owner = ctx.state.players[ownerId];
    if (owner?.discard.some(card => card.uid === ctx.triggerMinionUid)) {
        return [recoverCardsFromDiscard(ownerId, [ctx.triggerMinionUid], reason, ctx.now)];
    }

    const located = locateMinion(ctx.state, ctx.triggerMinionUid);
    if (!located) return [];
    if (isTempleOfGojuDeckBottomCandidate(ctx, located)) return [];
    const source = buildTriggerEffectSource(ctx, { fallbackSourceDefId: reason, fallbackSourceBaseIndex: located.baseIndex });
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: ctx.triggerMinionUid,
        minionDefId: located.minion.defId,
        fromBaseIndex: located.baseIndex,
        toPlayerId: ownerId,
        reason,
        now: ctx.now,
        sourcePlayerId: source.sourcePlayerId,
        sourceCardUid: source.sourceCardUid,
        sourceDefId: source.sourceDefId,
        sourceControllerId: source.sourceControllerId,
        sourceBaseIndex: source.sourceBaseIndex,
        sourceKind: source.sourceKind,
    });
}

function isCopycatCopiedJumperActive(ctx: TriggerContext): boolean {
    if (ctx.triggerMinionDefId !== 'shapeshifters_copycat' || !ctx.triggerMinionUid) return false;
    const copiedDefId = ctx.triggerMinion?.metadata?.copiedAbilityDefId;
    const copiedUntilTurn = ctx.triggerMinion?.metadata?.copiedAbilityUntilTurn;
    return copiedDefId === 'time_travelers_jumper' && copiedUntilTurn === ctx.state.turnNumber;
}

function shapeshiftersCopycatCopiedJumper(ctx: TriggerContext): SmashUpEvent[] {
    if (!isCopycatCopiedJumperActive(ctx)) return [];
    return recoverDiscardedJumperLikeMinion(ctx, 'shapeshifters_copycat_copied_jumper');
}

function timeTravelersWormhole(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const playerMinions = base.minions.filter(minion => minion.controller === ctx.playerId);
    if (playerMinions.length === 0) return { events: [] };
    if (ctx.matchState) {
        const interaction = createSimpleChoice(
            `time_travelers_wormhole_choose_${ctx.now}`,
            ctx.playerId,
            '虫洞：选择要洗入各自牌库的己方随从',
            playerMinions.map(minion => buildMinionPromptOption(minion, { minionUid: minion.uid })),
            {
                sourceId: 'time_travelers_wormhole_choose',
                targetType: 'minion',
                multi: { min: 0, max: playerMinions.length },
                responseValidationMode: 'live',
                titleKey: 'ui.time_travelers_wormhole_choose_title',
            },
        );
        interaction.data.allowedMinionUids = playerMinions.map(minion => minion.uid);
        interaction.data.baseIndex = baseIndex;
        interaction.data.baseDefId = base.defId;
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events: buildTimeTravelersWormholeEvents(ctx.state, playerMinions, ctx.playerId, ctx.random, ctx.now) };
}

function buildTimeTravelersWormholeEvents(
    state: SmashUpCore,
    selectedMinions: MinionOnBase[],
    sourcePlayerId: PlayerId,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const byOwner = new Map<PlayerId, MinionOnBase[]>();
    for (const minion of selectedMinions) {
        byOwner.set(minion.owner, [...(byOwner.get(minion.owner) ?? []), minion]);
    }
    const events: SmashUpEvent[] = [];
    for (const [ownerId, minions] of byOwner.entries()) {
        const owner = state.players[ownerId];
        if (!owner) continue;
        for (const minion of minions) {
            events.push(...buildValidatedCardToDeckBottomEvents(state, {
                cardUid: minion.uid,
                defId: minion.defId,
                ownerId,
                sourcePlayerId: ownerId !== sourcePlayerId ? sourcePlayerId : undefined,
                reason: 'time_travelers_wormhole',
                now,
                expectedLocation: 'bases',
            }));
        }
        events.push(deckReordered(ownerId, random.shuffle([
            ...owner.deck.map(card => card.uid),
            ...minions.map(minion => minion.uid),
        ]), now));
    }
    return events;
}

function baseFacelessCity(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.minionDefId) return { events: [] };
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const matchingCards = player.deck.filter(card => isMinionCard(card) && isSameNameDefId(card.defId, ctx.minionDefId));
    if (ctx.matchState && matchingCards.length > 0) {
        const interaction = createSimpleChoice(
            `base_faceless_city_choose_${ctx.now}`,
            ctx.playerId,
            '无面之城：选择是否搜寻同名随从加入手牌',
            [
                createSkipOption('跳过搜寻', 'ui.base_faceless_city_skip_search_option'),
                ...matchingCards.map(card => buildCardPromptOption(card, { cardUid: card.uid })),
            ],
            {
                sourceId: 'base_faceless_city_choose',
                targetType: 'generic',
                autoResolveIfSingle: false,
                titleKey: 'ui.base_faceless_city_choose_title',
            },
        );
        interaction.data.allowedCardUids = matchingCards.map(card => card.uid);
        interaction.data.minionDefId = ctx.minionDefId;
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }
    const matching = matchingCards[0];
    if (!matching) return { events: [] };
    const remainingDeck = player.deck.filter(card => card.uid !== matching.uid);
    return {
        events: [
            revealDeckTop(ctx.playerId, 'all', [{ uid: matching.uid, defId: matching.defId }], 1, 'base_faceless_city', ctx.now, ctx.playerId),
            drawSpecificCards(ctx.playerId, [matching.uid], ctx.now),
            deckReordered(ctx.playerId, ctx.random?.shuffle(remainingDeck).map(card => card.uid) ?? remainingDeck.map(card => card.uid), ctx.now),
        ],
    };
}

function baseSecretVolcanoHeadquarters(ctx: BaseAbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of ctx.state.turnOrder) {
        const player = ctx.state.players[playerId];
        if (!player) continue;
        const revealed = player.deck.slice(0, 1);
        if (revealed.length === 0) continue;
        events.push(revealDeckTop(
            playerId,
            'all',
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            revealed.length,
            'base_secret_volcano_headquarters',
            ctx.now,
            ctx.playerId,
        ));
        for (const card of revealed.filter(isMinionCard)) {
            events.push(buildPlayMinionFromZoneEvent({
                playerId,
                card,
                baseIndex: ctx.baseIndex,
                baseDefId: ctx.baseDefId,
                now: ctx.now,
                fromDeck: true,
                consumesNormalLimit: false,
            }));
        }
    }
    return { events };
}

function baseTheNexus(ctx: BaseAbilityContext): AbilityResult {
    const winnerId = ctx.rankings?.[0]?.playerId;
    if (!winnerId) return { events: [] };
    const choices = ctx.state.baseDiscard ?? [];
    if (choices.length === 0 || !ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `base_the_nexus_choose_${ctx.now}`,
        winnerId,
        '联结点：选择一个基地放到基地牌库顶',
        [
            createSkipOption('跳过（照常抽新基地）', 'ui.base_the_nexus_skip_option'),
            ...choices.map(baseDefId => ({
                id: baseDefId,
                label: getBaseDef(baseDefId)?.name ?? baseDefId,
                value: { baseDefId },
                displayMode: 'button' as const,
            })),
        ],
        {
            sourceId: 'base_the_nexus_choose',
            targetType: 'button',
            buttonIntent: 'mode',
            titleKey: 'ui.base_the_nexus_choose_title',
        },
    );
    interaction.data.allowedBaseDefIds = choices;
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function basePrimatePark(ctx: BaseAbilityContext): AbilityResult {
    const winnerId = ctx.rankings?.[0]?.playerId;
    if (!winnerId) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    const attachedActions = base?.minions.flatMap(minion => minion.attachedActions.map(action => ({
        cardUid: action.uid,
        defId: action.defId,
        ownerId: action.ownerId,
        type: 'attached' as const,
        baseIndex: ctx.baseIndex,
        label: getCardDef(action.defId)?.name ?? action.defId,
    }))) ?? [];
    if (attachedActions.length === 0 || !ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `base_primate_park_return_${ctx.now}`,
        winnerId,
        '灵长类公园：选择要返回手牌的附着行动',
        attachedActions.map(card => ({
            id: card.cardUid,
            label: card.label,
            value: { cardUid: card.cardUid },
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'base_primate_park_return',
            targetType: 'ongoing',
            multi: { min: 0, max: attachedActions.length },
            responseValidationMode: 'live',
            titleKey: 'ui.base_primate_park_return_title',
        },
    );
    interaction.data.allowedCardUids = attachedActions.map(card => card.cardUid);
    interaction.data.baseIndex = ctx.baseIndex;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function basePortalRoom(ctx: BaseAbilityContext): AbilityResult {
    const winnerId = ctx.rankings?.[0]?.playerId;
    if (!winnerId) return { events: [] };
    const returnToPlayerIndex = (ctx.state.currentPlayerIndex + 1) % ctx.state.turnOrder.length;
    return {
        events: [extraTurnQueued(winnerId, returnToPlayerIndex, 'base_portal_room', ctx.now)],
    };
}

function scoringWinnerOwner(ctx: BaseAbilityContext): PlayerId | undefined {
    return ctx.rankings?.[0]?.playerId;
}

type TopBottomDeckReorderChoice = {
    targetPlayerId: PlayerId;
    topUids: string[];
    bottomUids: string[];
};
type DeckMinionSearchChoice = {
    cardUid: string;
    baseIndex: number;
    reason: string;
    maxPower?: number;
    excludeDefId?: string;
    skipOnPlayAbility?: boolean;
    extraDeckUidsForShuffle?: string[];
};

type DiscardActionPlayChoice = {
    cardUid: string;
    targetBaseIndex?: number;
    targetMinionUid?: string;
};
type DiscardMinionSearchChoice = {
    cardUid: string;
    baseIndex?: number;
    reason: string;
    maxPower?: number;
};
type CardUidChoice = { cardUid?: string };
type SameNameHandMinionChoice = CardUidChoice & { baseIndex?: number; sameNameDefId?: string; skip?: true };
type MinionUidChoice = { minionUid?: string };
type PlayerIdChoice = { targetPlayerId?: PlayerId };
type GeneticShiftChoice = { mode?: 'all' | 'single'; minionUid?: string };
type ActionUidChoice = { actionUid?: string };
type InPlayCardChoice = { cardUid?: string };
type ClydeDetachChoice = { returnToHand?: boolean };
type WormholeMinionChoice = { minionUid?: string };
type FlyingMonkeyMoveChoice = {
    minionUid?: string;
    actionUid?: string;
    cardUid?: string;
    ongoingUid?: string;
    fromBaseIndex?: number;
    sourceBaseIndex?: number;
    toBaseIndex?: number;
    targetBaseIndex?: number;
    reason?: string;
};
type FlyingMonkeyResolvedMove = {
    minionUid: string;
    actionUid: string;
    fromBaseIndex: number;
    toBaseIndex: number;
    reason?: string;
};
type OperativeBottomChoice = { targetPlayerId: PlayerId; cardUid: string };

function normalizeFlyingMonkeyMove(selected: FlyingMonkeyMoveChoice | undefined): FlyingMonkeyResolvedMove | undefined {
    if (!selected) return undefined;
    const actionUid = selected.actionUid ?? selected.cardUid ?? selected.ongoingUid;
    const fromBaseIndex = selected.fromBaseIndex ?? selected.sourceBaseIndex;
    const toBaseIndex = selected.toBaseIndex ?? selected.targetBaseIndex;
    if (!selected.minionUid || !actionUid || fromBaseIndex === undefined || toBaseIndex === undefined) {
        return undefined;
    }
    return {
        minionUid: selected.minionUid,
        actionUid,
        fromBaseIndex,
        toBaseIndex,
        reason: selected.reason,
    };
}

function buildFlyingMonkeyAllowedMoves(params: {
    minion: MinionOnBase;
    action: OngoingActionOnBase | AttachedActionOnMinion;
    fromBaseIndex: number;
    destinations: { index: number }[];
    reason: string;
}): FlyingMonkeyResolvedMove[] {
    return params.destinations.map(({ index }) => ({
        minionUid: params.minion.uid,
        actionUid: params.action.uid,
        fromBaseIndex: params.fromBaseIndex,
        toBaseIndex: index,
        reason: params.reason,
    }));
}

function queueFlyingMonkeyMoveInteraction(params: {
    matchState: MatchState<SmashUpCore>;
    state: SmashUpCore;
    minion: MinionOnBase;
    action: OngoingActionOnBase | AttachedActionOnMinion;
    fromBaseIndex: number;
    destinations: { base: SmashUpCore['bases'][number]; index: number }[];
    now: number;
    title: string;
    titleKey: string;
    reason: string;
    interactionIdPrefix: string;
}): TriggerResult {
    const allowedMoves = buildFlyingMonkeyAllowedMoves({
        minion: params.minion,
        action: params.action,
        fromBaseIndex: params.fromBaseIndex,
        destinations: params.destinations,
        reason: params.reason,
    });
    const interaction = createSimpleChoice(
        `${params.interactionIdPrefix}_${params.now}`,
        getOngoingActionControllerId(params.action),
        params.title,
        [
            createSkipOption('跳过（照常进入弃牌堆）', 'ui.cyborg_apes_flying_monkey_skip_discard_option'),
            ...buildFieldSourceToBaseTargetOptions(
                {
                    type: 'action',
                    uid: params.action.uid,
                    defId: params.action.defId,
                    fromBaseIndex: params.fromBaseIndex,
                },
                params.destinations.map(({ base, index }) => ({
                    baseIndex: index,
                    label: getBaseDef(base.defId)?.name ?? base.defId,
                })),
                params.state,
                {
                    minionUid: params.minion.uid,
                    actionUid: params.action.uid,
                    reason: params.reason,
                },
            ),
        ],
        buildFieldSourceTargetPromptConfig({
            sourceId: 'cyborg_apes_flying_monkey_move',
            titleKey: params.titleKey,
        }),
    );
    interaction.data.allowedFlyingMonkeyMoves = allowedMoves;
    return { events: [], matchState: queueInteraction(params.matchState, interaction) };
}

function isAllowedFlyingMonkeyMove(
    selected: FlyingMonkeyResolvedMove,
    interactionData: Record<string, unknown> | undefined,
): boolean {
    const allowedMoves = Array.isArray(interactionData?.allowedFlyingMonkeyMoves)
        ? interactionData.allowedFlyingMonkeyMoves
        : [];
    return allowedMoves.some((move): boolean => {
        if (!move || typeof move !== 'object') return false;
        const candidate = move as FlyingMonkeyResolvedMove;
        return candidate.minionUid === selected.minionUid
            && candidate.actionUid === selected.actionUid
            && candidate.fromBaseIndex === selected.fromBaseIndex
            && candidate.toBaseIndex === selected.toBaseIndex
            && candidate.reason === selected.reason;
    });
}

function normalizeChoiceArray<T extends Record<string, unknown>>(value: unknown): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') return [value as T];
    return [];
}

function readStringSet(value: unknown): Set<string> | undefined {
    if (!Array.isArray(value)) return undefined;
    return new Set(value.filter((item): item is string => typeof item === 'string'));
}

function hasDuplicateStrings(values: string[]): boolean {
    return new Set(values).size !== values.length;
}

function cardLabel(card: CardInstance): string {
    const def = getCardDef(card.defId);
    return def?.name ?? card.defId;
}

function findCardOwnerAcrossPlayerZones(
    state: SmashUpCore,
    cardUid: string,
    defId: string,
    fallbackPlayerId: PlayerId,
): PlayerId {
    for (const player of Object.values(state.players)) {
        const inHand = player.hand.find(card => card.uid === cardUid && card.defId === defId);
        if (inHand) return inHand.owner;
        const inDiscard = player.discard.find(card => card.uid === cardUid && card.defId === defId);
        if (inDiscard) return inDiscard.owner;
        const inDeck = player.deck.find(card => card.uid === cardUid && card.defId === defId);
        if (inDeck) return inDeck.owner;
    }
    return fallbackPlayerId;
}

function permuteCards(cards: CardInstance[]): CardInstance[][] {
    if (cards.length <= 1) return [cards];
    const result: CardInstance[][] = [];
    for (let index = 0; index < cards.length; index += 1) {
        const head = cards[index];
        const rest = [...cards.slice(0, index), ...cards.slice(index + 1)];
        for (const tail of permuteCards(rest)) {
            result.push([head, ...tail]);
        }
    }
    return result;
}

function buildDeckTopOrderOptions(
    targetPlayerId: PlayerId,
    inspected: CardInstance[],
    idPrefix: string,
): PromptOption<TopBottomDeckReorderChoice>[] {
    return permuteCards(inspected).map((permutation, index) => ({
        id: `${idPrefix}-${index + 1}`,
        label: `顶：${permutation.map(cardLabel).join(' / ')}`,
        value: {
            targetPlayerId,
            topUids: permutation.map(card => card.uid),
            bottomUids: [],
        },
    }));
}

function buildIsiSwinginPadReorderOptions(
    targetPlayerId: PlayerId,
    inspected: CardInstance[],
): PromptOption<TopBottomDeckReorderChoice>[] {
    const options: PromptOption<TopBottomDeckReorderChoice>[] = [];
    const seen = new Set<string>();
    for (const permutation of permuteCards(inspected)) {
        for (let split = 0; split <= permutation.length; split += 1) {
            const topCards = permutation.slice(0, split);
            const bottomCards = permutation.slice(split);
            const key = `${topCards.map(card => card.uid).join(',')}|${bottomCards.map(card => card.uid).join(',')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const topLabel = topCards.length > 0 ? topCards.map(cardLabel).join(' / ') : '无';
            const bottomLabel = bottomCards.length > 0 ? bottomCards.map(cardLabel).join(' / ') : '无';
            options.push({
                id: `isi-order-${seen.size}`,
                label: `顶：${topLabel}；底：${bottomLabel}`,
                value: {
                    targetPlayerId,
                    topUids: topCards.map(card => card.uid),
                    bottomUids: bottomCards.map(card => card.uid),
                },
            });
        }
    }
    return options;
}

function attachDeckReorderContext<T>(
    interaction: { data: Record<string, unknown> },
    targetPlayerId: PlayerId,
    inspected: CardInstance[],
): T {
    interaction.data.targetPlayerId = targetPlayerId;
    interaction.data.inspectedUids = inspected.map(card => card.uid);
    interaction.data.inspectedCards = inspected.map(card => ({
        uid: card.uid,
        defId: card.defId,
    }));
    return interaction as T;
}

function buildValidatedDeckReorderEvents(
    state: MatchState<SmashUpCore>,
    value: TopBottomDeckReorderChoice,
    interactionData: Record<string, unknown> | undefined,
    timestamp: number,
): SmashUpEvent[] {
    const contextTargetPlayerId = typeof interactionData?.targetPlayerId === 'string'
        ? interactionData.targetPlayerId
        : undefined;
    if (contextTargetPlayerId && value.targetPlayerId !== contextTargetPlayerId) return [];

    const inspectedUids = Array.isArray(interactionData?.inspectedUids)
        ? interactionData.inspectedUids.filter((uid): uid is string => typeof uid === 'string')
        : [];
    if (inspectedUids.length === 0) return [];

    const selectedUids = [...value.topUids, ...value.bottomUids];
    const selectedSet = new Set(selectedUids);
    if (selectedSet.size !== selectedUids.length) return [];
    if (selectedSet.size !== inspectedUids.length) return [];
    if (!inspectedUids.every(uid => selectedSet.has(uid))) return [];

    const deck = state.core.players[value.targetPlayerId]?.deck ?? [];
    if (!inspectedUids.every(uid => deck.some(card => card.uid === uid))) return [];
    const untouched = deck.filter(card => !selectedSet.has(card.uid)).map(card => card.uid);
    return [deckReordered(value.targetPlayerId, [...value.topUids, ...untouched, ...value.bottomUids], timestamp)];
}

function buildCardPromptOption<T extends { cardUid: string }>(
    card: CardInstance,
    value: T,
): PromptOption<T> & { previewDefId: string } {
    return {
        id: card.uid,
        label: cardLabel(card),
        value,
        displayMode: 'card',
        previewDefId: card.defId,
    };
}

function buildMinionPromptOption<T extends { minionUid: string }>(
    minion: MinionOnBase,
    value: T,
): PromptOption<T> & { previewDefId: string } {
    const def = getCardDef(minion.defId);
    return {
        id: minion.uid,
        label: def?.name ?? minion.defId,
        value,
        displayMode: 'card',
        previewDefId: minion.defId,
    };
}

function buildAttachedActionPromptOption<T extends { actionUid: string }>(
    action: MinionOnBase['attachedActions'][number],
    value: T,
): PromptOption<T> & { previewDefId: string } {
    const def = getCardDef(action.defId);
    return {
        id: action.uid,
        label: def?.name ?? action.defId,
        value,
        displayMode: 'card',
        previewDefId: action.defId,
    };
}

function matchesMinionSearch(card: CardInstance, params: { maxPower?: number; excludeDefId?: string }): boolean {
    if (!isMinionCard(card)) return false;
    if (params.excludeDefId && card.defId === params.excludeDefId) return false;
    if (params.maxPower !== undefined && getPrintedPower(card.defId) > params.maxPower) return false;
    return true;
}

function buildDeckMinionSearchOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    params: Omit<DeckMinionSearchChoice, 'cardUid'>,
): PromptOption<DeckMinionSearchChoice>[] {
    const player = core.players[playerId];
    if (!player) return [];
    return player.deck
        .filter(card => matchesMinionSearch(card, params))
        .map(card => buildCardPromptOption(card, {
            ...params,
            cardUid: card.uid,
        }));
}

function buildSkipSearchOption<T extends { skip?: true }>(label = '放弃这次选择'): PromptOption<T> {
    return {
        id: 'skip',
        label,
        value: { skip: true } as T,
        displayMode: 'button',
    };
}

function buildDiscardMinionSearchOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    params: Omit<DiscardMinionSearchChoice, 'cardUid'>,
): PromptOption<DiscardMinionSearchChoice>[] {
    const player = core.players[playerId];
    if (!player) return [];
    return player.discard
        .filter(card => matchesMinionSearch(card, params))
        .map(card => buildCardPromptOption(card, {
            ...params,
            cardUid: card.uid,
        }));
}

function buildDeckMinionSearchEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    selected: DeckMinionSearchChoice,
    random: { shuffle: <T>(items: T[]) => T[] },
    now: number,
): SmashUpEvent[] {
    if ((selected as DeckMinionSearchChoice & { skip?: true }).skip) return [];
    const player = state.players[playerId];
    if (!player) return [];
    const card = player.deck.find(candidate =>
        candidate.uid === selected.cardUid
        && matchesMinionSearch(candidate, {
            maxPower: selected.maxPower,
            excludeDefId: selected.excludeDefId,
        }),
    );
    if (!card) return [];
    const remainingDeck = player.deck.filter(candidate => candidate.uid !== card.uid);
    const remainingUids = new Set(remainingDeck.map(candidate => candidate.uid));
    const extraUids = (selected.extraDeckUidsForShuffle ?? [])
        .filter(uid => uid !== card.uid && !remainingUids.has(uid));
    return [
        buildPlayMinionFromZoneEvent({
            playerId,
            card,
            baseIndex: selected.baseIndex,
            baseDefId: state.bases[selected.baseIndex]?.defId,
            now,
            fromDeck: true,
            consumesNormalLimit: false,
            skipOnPlayAbility: selected.skipOnPlayAbility,
        }),
        deckReordered(playerId, random.shuffle([...remainingDeck.map(candidate => candidate.uid), ...extraUids]), now),
    ];
}

function buildDiscardMinionSearchEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    selected: DiscardMinionSearchChoice,
    now: number,
): SmashUpEvent[] {
    if ((selected as DiscardMinionSearchChoice & { skip?: true }).skip) return [];
    if (selected.baseIndex === undefined) return [];
    const player = state.players[playerId];
    if (!player) return [];
    const card = player.discard.find(candidate =>
        candidate.uid === selected.cardUid
        && matchesMinionSearch(candidate, { maxPower: selected.maxPower }),
    );
    if (!card) return [];
    return [
        buildPlayMinionFromZoneEvent({
            playerId,
            card,
            baseIndex: selected.baseIndex,
            baseDefId: state.bases[selected.baseIndex]?.defId,
            now,
            fromDiscard: true,
            consumesNormalLimit: false,
        }),
    ];
}

function buildDiscardMinionBaseOptions(
    state: SmashUpCore,
    selected: DiscardMinionSearchChoice,
): PromptOption<DiscardMinionSearchChoice>[] {
    return state.bases.map((base, baseIndex) => ({
        id: `base-${baseIndex}`,
        label: getBaseDef(base.defId)?.name ?? base.defId,
        value: { ...selected, baseIndex },
        displayMode: 'card' as const,
    }));
}

type DiscardActionTargetMode = 'none' | 'base' | 'minion';

function getDiscardActionTargetMode(card: CardInstance): DiscardActionTargetMode | undefined {
    const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) return undefined;
    const subtype = (def as FusionCardDef).type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef).subtype;

    if (subtype === 'ongoing') {
        const ongoingTarget = (def as FusionCardDef).type === 'fusion'
            ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
            : ((def as ActionCardDef).ongoingTarget ?? 'base');
        return ongoingTarget === 'minion' ? 'minion' : 'base';
    }
    if (actionLikeNeedsPlayMinion(def)) return 'minion';
    if (actionLikeNeedsPlayBase(def)) return 'base';
    return 'none';
}

function buildDiscardActionTargetOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
): PromptOption<DiscardActionPlayChoice>[] {
    const mode = getDiscardActionTargetMode(card);
    if (!mode) return [];
    if (mode === 'none') {
        const validation = validateActionPlaySemantics(state, playerId, { defId: card.defId });
        return validation.valid
            ? [{
                id: 'play',
                label: '直接打出',
                labelKey: 'ui.discard_action_play_direct_option',
                value: { cardUid: card.uid },
                displayMode: 'button' as const,
            }]
            : [];
    }

    if (mode === 'base') {
        return state.bases
            .map((base, targetBaseIndex) => ({ base, targetBaseIndex }))
            .filter(({ targetBaseIndex }) => validateActionPlaySemantics(state, playerId, {
                defId: card.defId,
                targetBaseIndex,
            }).valid)
            .map(({ base, targetBaseIndex }) => ({
                id: `base-${targetBaseIndex}`,
                label: getBaseDef(base.defId)?.name ?? base.defId,
                value: { cardUid: card.uid, targetBaseIndex },
                displayMode: 'card' as const,
            }));
    }

    return allMinions(state)
        .filter(({ minion, baseIndex }) => validateActionPlaySemantics(state, playerId, {
            defId: card.defId,
            targetBaseIndex: baseIndex,
            targetMinionUid: minion.uid,
        }).valid)
        .map(({ minion, baseIndex }) => {
            const baseName = getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
            return {
                id: `minion-${minion.uid}`,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
                value: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                displayMode: 'card' as const,
            };
        });
}

function buildDiscardActionPlayEvents(params: {
    state: MatchState<SmashUpCore>;
    playerId: PlayerId;
    card: CardInstance;
    timestamp: number;
    random: RandomFn;
    targetBaseIndex?: number;
    targetMinionUid?: string;
}): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const { state, playerId, card, timestamp, random, targetBaseIndex, targetMinionUid } = params;
    const validation = validateActionPlaySemantics(state.core, playerId, {
        defId: card.defId,
        targetBaseIndex,
        targetMinionUid,
        effectiveHandSize: state.core.players[playerId]?.hand.length ?? 0,
    });
    if (!validation.valid) return { state, events: [] };

    const mode = getDiscardActionTargetMode(card);
    if (mode === 'base' && targetBaseIndex === undefined) return { state, events: [] };
    if (mode === 'minion' && (targetBaseIndex === undefined || !targetMinionUid)) return { state, events: [] };

    const events: SmashUpEvent[] = [buildActionPlayedEvent({
        playerId,
        cardUid: card.uid,
        defId: card.defId,
        ownerId: card.owner,
        timestamp,
        isExtraAction: true,
        fromDiscard: true,
        targetBaseIndex,
        targetMinionUid,
    }) as SmashUpEvent];

    const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    const subtype = (def as FusionCardDef | undefined)?.type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef | undefined)?.subtype;
    if (subtype === 'ongoing') {
        if (targetBaseIndex === undefined) return { state, events: [] };
        events.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            ...(card.owner !== playerId ? { sourcePlayerId: playerId } : {}),
            targetBaseIndex,
            ...(targetMinionUid ? { targetMinionUid } : {}),
            onBlockedSourceDestination: 'discard',
            now: timestamp,
        }));
    }

    return appendResolvedActionAbility({
        state,
        events,
        playerId,
        cardUid: card.uid,
        defId: card.defId,
        random,
        timestamp,
        baseIndex: targetBaseIndex ?? 0,
        targetBaseIndex,
        targetMinionUid,
        fromDiscard: true,
    });
}

function resolveItsAstoundingAction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    cardUid: string | undefined,
    random: RandomFn,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === cardUid && isActionCard(candidate));
    if (!card) return { state, events: [] };

    const targetOptions = buildDiscardActionTargetOptions(state.core, playerId, card);
    if (targetOptions.length === 0) return { state, events: [] };
    const mode = getDiscardActionTargetMode(card);
    if (mode === 'none') {
        return buildDiscardActionPlayEvents({ state, playerId, card, timestamp, random });
    }
    const interaction = createSimpleChoice(
        `time_travelers_its_astounding_target_${timestamp}`,
        playerId,
        `令人震惊：选择「${cardLabel(card)}」的目标`,
        targetOptions,
        {
            sourceId: 'time_travelers_its_astounding_target',
            targetType: mode,
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey: 'ui.time_travelers_its_astounding_target_title',
            titleParams: { cardName: cardLabel(card) },
        },
    );
    interaction.data.cardUid = card.uid;
    interaction.data.allowedDiscardActionTargets = targetOptions.map(option => option.value);
    return { state: queueInteraction(state, interaction), events: [] };
}

function queueDiscardMinionBaseChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: DiscardMinionSearchChoice,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const options = buildDiscardMinionBaseOptions(state.core, selected);
    if (options.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `shapeshifters_really_base_${timestamp}`,
        playerId,
        '...你确定？：选择要打出该额外随从的基地',
        options,
        {
            sourceId: 'shapeshifters_really_base',
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey: 'ui.shapeshifters_really_base_title',
        },
    );
    interaction.data.selectedCardUid = selected.cardUid;
    interaction.data.allowedBaseIndices = options
        .map(option => option.value.baseIndex)
        .filter((baseIndex): baseIndex is number => typeof baseIndex === 'number');
    return { state: queueInteraction(state, interaction), events: [] };
}

function buildOperativeReveal(
    state: SmashUpCore,
    viewerId: PlayerId,
    targetPlayerIds: PlayerId[],
    now: number,
): { events: SmashUpEvent[]; options: PromptOption<OperativeBottomChoice>[]; revealedByPlayer: Record<string, string[]> } {
    const events: SmashUpEvent[] = [];
    const options: PromptOption<OperativeBottomChoice>[] = [];
    const revealedByPlayer: Record<string, string[]> = {};
    for (const playerId of targetPlayerIds) {
        const top = state.players[playerId]?.deck[0];
        if (!top) continue;
        revealedByPlayer[playerId] = [top.uid];
        events.push(inspectDeck(playerId, viewerId, 1, 'super_spies_operative', now));
        events.push(revealDeckTop(playerId, 'all', [{ uid: top.uid, defId: top.defId }], 1, 'super_spies_operative', now, viewerId));
        options.push(buildCardPromptOption(top, { targetPlayerId: playerId, cardUid: top.uid }));
    }
    return { events, options, revealedByPlayer };
}

function queueOperativeTopBottomChoice(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    options: PromptOption<OperativeBottomChoice>[],
    revealedByPlayer: Record<string, string[]>,
    timestamp: number,
): MatchState<SmashUpCore> {
    if (options.length === 0) return state;
    const interaction = createSimpleChoice(
        `super_spies_operative_top_bottom_${timestamp}`,
        playerId,
        '密探：选择要放到各自牌库底的牌（未选保持在顶）',
        options,
        {
            sourceId: 'super_spies_operative_top_bottom',
            targetType: 'generic',
            multi: { min: 0, max: options.length },
            responseValidationMode: 'live',
            titleKey: 'ui.super_spies_operative_top_bottom_title',
        },
    );
    interaction.data.revealedByPlayer = revealedByPlayer;
    return queueInteraction(state, interaction);
}

function queueDeckMinionSearch(
    ctx: Pick<AbilityContext, 'state' | 'matchState' | 'playerId' | 'random' | 'now'> | Pick<TriggerContext, 'state' | 'matchState' | 'playerId' | 'random' | 'now'>,
    sourceId: string,
    title: string,
    params: Omit<DeckMinionSearchChoice, 'cardUid'>,
    titleKey?: string,
): AbilityResult {
    const cardOptions = buildDeckMinionSearchOptions(ctx.state, ctx.playerId, params);
    const options = [...cardOptions, buildSkipSearchOption<DeckMinionSearchChoice & { skip?: true }>() as PromptOption<DeckMinionSearchChoice>];
    if (!ctx.matchState) {
        return { events: [] };
    }
    if (cardOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        title,
        options,
        {
            sourceId,
            targetType: 'generic',
            autoResolveIfSingle: false,
            autoRefresh: 'deck',
            responseValidationMode: 'live',
            titleKey,
        },
    );
    interaction.data.allowedCardUids = cardOptions.map(option => option.value.cardUid);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function queueDiscardMinionSearch(
    ctx: Pick<AbilityContext, 'state' | 'matchState' | 'playerId' | 'random' | 'now'>,
    sourceId: string,
    title: string,
    params: Omit<DiscardMinionSearchChoice, 'cardUid'>,
    titleKey?: string,
): AbilityResult {
    const cardOptions = buildDiscardMinionSearchOptions(ctx.state, ctx.playerId, params);
    const options = [...cardOptions, buildSkipSearchOption<DiscardMinionSearchChoice & { skip?: true }>() as PromptOption<DiscardMinionSearchChoice>];
    if (!ctx.matchState) {
        return { events: [] };
    }
    if (cardOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        title,
        options,
        {
            sourceId,
            targetType: 'generic',
            autoResolveIfSingle: false,
            autoRefresh: 'discard',
            responseValidationMode: 'live',
            titleKey,
        },
    );
    interaction.data.allowedCardUids = cardOptions.map(option => option.value.cardUid);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function baseIsiSwinginPad(ctx: BaseAbilityContext): AbilityResult {
    const winnerId = ctx.rankings?.[0]?.playerId;
    if (!winnerId || !ctx.matchState) return { events: [] };
    const inspected = ctx.state.players[winnerId]?.deck.slice(0, 3) ?? [];
    if (inspected.length === 0) return { events: [] };
    const events: SmashUpEvent[] = [
        inspectDeck(winnerId, winnerId, inspected.length, 'base_isis_swingin_pad', ctx.now),
        revealDeckTop(
            winnerId,
            winnerId,
            inspected.map(card => ({ uid: card.uid, defId: card.defId })),
            inspected.length,
            'base_isis_swingin_pad',
            ctx.now,
            winnerId,
        ),
    ];
    const interaction = createSimpleChoice(
        `base_isis_swingin_pad_reorder_${ctx.now}`,
        winnerId,
        "ISI摇摆据点：选择牌库顶顺序",
        buildIsiSwinginPadReorderOptions(winnerId, inspected),
        {
            sourceId: 'base_isis_swingin_pad_reorder',
            targetType: 'generic',
            titleKey: 'ui.base_isis_swingin_pad_reorder_title',
        },
    );
    attachDeckReorderContext(interaction, winnerId, inspected);
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function hasAttachedAction(minion: MinionOnBase, defId: string): boolean {
    return minion.attachedActions.some(action => action.defId === defId);
}

export function registerYuanhouAbilities(): void {
    registerSimpleAbility('shapeshifters_bacta_the_future', 'onPlay', shapeshiftersBactaTheFuture);
    registerSimpleAbility('shapeshifters_genetic_shift', 'onPlay', shapeshiftersGeneticShift);
    registerSimpleAbility('shapeshifters_transmogrify', 'onPlay', shapeshiftersTransmogrify);
    registerSimpleAbility('shapeshifters_really', 'onPlay', shapeshiftersReally);
    registerSimpleAbility('shapeshifters_mitosis', 'onPlay', shapeshiftersMitosis);
    registerSimpleAbility('shapeshifters_copycat', 'onPlay', shapeshiftersCopycat);
    registerSimpleAbility('shapeshifters_cellular_bonding', 'onPlay', shapeshiftersCellularBonding);
    registerAbilityProgram('shapeshifters_copycat', 'talent', {
        program: createEffectProgram(shapeshiftersCopycatTalent),
        validateUse: ctx => {
            const located = locateMinion(ctx.state, ctx.cardUid);
            const copiedDefId = located ? getCopycatCopiedDefId(located.minion, ctx.state) : undefined;
            return copiedDefId && resolveTalent(copiedDefId) ? null : '没有可复制的天赋能力';
        },
    });
    registerAbilityProgram('shapeshifters_cellular_bonding', 'talent', {
        program: createEffectProgram(shapeshiftersCellularBondingTalent),
        validateUse: ctx => {
            const host = locateAttachedActionHost(ctx.state, ctx.cardUid);
            const copiedDefId = host ? getCellularBondingCopiedDefId(host.minion, ctx.cardUid) : undefined;
            return copiedDefId && (copiedDefId === 'cyborg_apes_monkey_on_your_back' || resolveTalent(copiedDefId))
                ? null
                : '没有可复制的天赋能力';
        },
    });
    registerAbilityProgram('shapeshifters_gelf', 'talent', { program: createEffectProgram(shapeshiftersGelf) });
    registerTrigger('shapeshifters_doppelganger', 'onMinionDiscardedFromBase', shapeshiftersDoppelganger, {
        global: true,
        globalZones: ['discard'],
        playerContext: 'eventPlayer',
        canTrigger: canTriggerShapeshiftersDoppelganger,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('shapeshifters_copycat', 'onMinionDiscardedFromBase', shapeshiftersCopycatCopiedJumper, {
        optional: true,
        global: true,
        globalZones: ['discard'],
        playerContext: 'eventPlayer',
        canTrigger: (ctx) => isCopycatCopiedJumperActive(ctx) && canRecoverDiscardedJumperLikeMinion(ctx),
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerProtection('shapeshifters_shell_game', 'destroy', ctx =>
        hasAttachedAction(ctx.targetMinion, 'shapeshifters_shell_game'),
    );
    registerProtection('shapeshifters_cellular_bonding', 'destroy', ctx =>
        cellularBondingCopiesAttachedAction(ctx.targetMinion, 'shapeshifters_shell_game'),
    );
    registerProtection('shapeshifters_cellular_bonding', 'action', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && cellularBondingCopiesAttachedAction(ctx.targetMinion, 'cyborg_apes_shielding'),
    );
    registerProtection('shapeshifters_cellular_bonding', 'affect', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller
        && cellularBondingCopiesAttachedAction(ctx.targetMinion, 'cyborg_apes_shielding'),
    );
    registerTrigger('shapeshifters_cellular_bonding', 'onTurnEnd', shapeshiftersCellularBondingMissingUplink, {
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('shapeshifters_cellular_bonding', 'afterScoring', shapeshiftersCellularBondingFlyingMonkey, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerShapeshiftersCellularBondingFlyingMonkey,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });

    registerAbilityProgram('cyborg_apes_baboom', 'talent', { program: createEffectProgram(cyborgApesBaboom) });
    registerAbilityProgram('cyborg_apes_monkey_on_your_back', 'talent', { program: createEffectProgram(cyborgApesMonkeyOnYourBack) });
    registerSimpleAbility('cyborg_apes_going_bananas', 'onPlay', cyborgApesGoingBananas);
    registerSimpleAbility('cyborg_apes_shielding', 'onPlay', cyborgApesShielding);
    registerSimpleAbility('cyborg_apes_monkey_see_monkey_do', 'onPlay', cyborgApesMonkeySeeMonkeyDo);
    registerProtection('cyborg_apes_shielding', 'action', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller && hasAttachedAction(ctx.targetMinion, 'cyborg_apes_shielding'),
    );
    registerProtection('cyborg_apes_shielding', 'affect', ctx =>
        ctx.sourcePlayerId !== ctx.targetMinion.controller && hasAttachedAction(ctx.targetMinion, 'cyborg_apes_shielding'),
    );
    registerTrigger('cyborg_apes_missing_uplink', 'onTurnEnd', cyborgApesMissingUplink, {
        playerContext: 'sourceController',
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerTrigger('cyborg_apes_flying_monkey', 'afterScoring', cyborgApesFlyingMonkeyAfterScoring, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerCyborgApesFlyingMonkeyAfterScoring,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerDiscardActionPlayProvider({
        id: 'cyborg_apes_cyberback',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];

            const cyberbacks = allMinions(core).filter(({ minion }) =>
                minion.controller === playerId && matchesDefId(minion.defId, 'cyborg_apes_cyberback'),
            );
            if (cyberbacks.length === 0) return [];

            return player.discard
                .filter(isActionCard)
                .flatMap(card => {
                    const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
                    if (!def) return [];
                    const subtype = def.type === 'fusion' ? def.actionSubtype : def.subtype;
                    const ongoingTarget = def.type === 'fusion'
                        ? (def.actionOngoingTarget ?? 'base')
                        : (def.ongoingTarget ?? 'base');
                    if (subtype !== 'ongoing' || ongoingTarget !== 'minion') return [];

                    const legalTargets = cyberbacks.filter(({ minion, baseIndex }) =>
                        validateActionPlaySemantics(core, playerId, {
                            defId: card.defId,
                            targetBaseIndex: baseIndex,
                            targetMinionUid: minion.uid,
                            effectiveHandSize: player.hand.length,
                        }).valid,
                    );
                    if (legalTargets.length === 0) return [];

                    const allowedBaseIndices = [...new Set(legalTargets.map(({ baseIndex }) => baseIndex))];
                    return [{
                        card,
                        allowedBaseIndices,
                        allowedMinionUids: legalTargets.map(({ minion }) => minion.uid),
                        sourceId: 'cyborg_apes_cyberback',
                        defId: card.defId,
                        name: getCardDef(card.defId)?.name ?? card.defId,
                    }];
                });
        },
    });
    registerTrigger('cyborg_apes_clyde_2_0', 'onTurnEnd', () => [], { effectContract: SHAYU_TRIGGER_CONTRACT });
    registerTrigger('cyborg_apes_cyberback', 'onTurnEnd', () => [], { effectContract: SHAYU_TRIGGER_CONTRACT });

    registerSimpleAbility('super_spies_spy', 'onPlay', superSpiesSpy);
    registerSimpleAbility('super_spies_operative', 'onPlay', superSpiesOperative);
    registerSimpleAbility('super_spies_live_and_let_chum', 'special', superSpiesLiveAndLetChum);
    registerSimpleAbility('super_spies_the_spy_who_ditched_me', 'onPlay', superSpiesTheSpyWhoDitchedMe);
    registerSimpleAbility('super_spies_permit_to_kill', 'onPlay', superSpiesPermitToKill);
    registerSimpleAbility('super_spies_for_my_eyes_only', 'onPlay', superSpiesForMyEyesOnly);
    registerSimpleAbility('super_spies_the_base_is_not_enough', 'special', superSpiesTheBaseIsNotEnough);
    registerSimpleAbility('super_spies_from_q_with_love', 'onPlay', superSpiesFromQWithLove);
    registerSimpleAbility('super_spies_discards_are_forever', 'onPlay', superSpiesDiscardsAreForever);
    registerSimpleAbility('super_spies_mole', 'special', superSpiesMole);
    registerTrigger('super_spies_secret_agent', 'onActionPlayed', superSpiesSecretAgent, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canTriggerSuperSpiesSecretAgent,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerRestriction('super_spies_mindraker', 'play_action', ctx => {
        const activationWindow = ctx.extra?.activationWindow;
        if (activationWindow !== 'meFirst' && activationWindow !== 'afterScoring') return false;
        const base = ctx.state.bases[ctx.baseIndex];
        return Boolean(base?.ongoingActions.some(
            candidate => candidate.defId === 'super_spies_mindraker'
                && getOngoingActionControllerId(candidate) !== ctx.playerId,
        ));
    });

    registerAbilityProgram('time_travelers_time_raider', 'talent', { program: createEffectProgram(timeTravelersTimeRaider) });
    registerSimpleAbility('time_travelers_repeater_perfect', 'onPlay', timeTravelersRepeaterPerfect);
    registerSimpleAbility('time_travelers_doctor_when', 'onPlay', timeTravelersDoctorWhen);
    registerSimpleAbility('time_travelers_its_astounding', 'onPlay', timeTravelersItsAstounding);
    registerSimpleAbility('time_travelers_into_the_time_slip', 'onPlay', timeTravelersIntoTheTimeSlip);
    registerSimpleAbility('time_travelers_1_21_gigawatts', 'onPlay', timeTravelersGigawatts);
    registerSimpleAbility('time_travelers_do_over', 'onPlay', timeTravelersDoOver);
    registerSimpleAbility('time_travelers_time_walk', 'onPlay', timeTravelersTimeWalk);
    registerSimpleAbility('time_travelers_wormhole', 'special', timeTravelersWormhole);
    registerSimpleAbility('time_travelers_time_is_fleeting', 'special', timeTravelersTimeIsFleeting);
    registerTrigger('time_travelers_jumper', 'onMinionDiscardedFromBase', timeTravelersJumper, {
        optional: true,
        global: true,
        globalZones: ['discard'],
        playerContext: 'eventPlayer',
        canTrigger: canRecoverDiscardedJumperLikeMinion,
        effectContract: SHAYU_TRIGGER_CONTRACT,
    });
    registerBaseAbilitySuppression('time_travelers_stasis_field', (state, baseIndex) =>
        state.bases[baseIndex]?.ongoingActions.some(action => matchesDefId(action.defId, 'time_travelers_stasis_field')) ?? false,
    );
    registerBaseScoringSuppression('time_travelers_stasis_field', (state, baseIndex) =>
        state.bases[baseIndex]?.ongoingActions.some(action => matchesDefId(action.defId, 'time_travelers_stasis_field')) ?? false,
    );
    registerBaseAbility('base_faceless_city', 'onMinionPlayed', baseFacelessCity, {
        canTrigger: ctx => {
            if (!ctx.minionDefId) return false;
            const player = ctx.state.players[ctx.playerId];
            return player?.deck.some(card => isMinionCard(card) && isSameNameDefId(card.defId, ctx.minionDefId)) ?? false;
        },
    });
    registerBaseAbility('base_secret_volcano_headquarters', 'beforeScoring', baseSecretVolcanoHeadquarters, {
        canTrigger: ctx => ctx.state.turnOrder.some(playerId => (ctx.state.players[playerId]?.deck.length ?? 0) > 0),
    });
    registerBaseAbility('base_portal_room', 'afterScoring', basePortalRoom, {
        mandatory: false,
        ownerPlayerId: scoringWinnerOwner,
        canTrigger: ctx => Boolean(ctx.rankings?.[0]?.playerId),
    });
    registerBaseAbility('base_the_nexus', 'afterScoring', baseTheNexus, {
        mandatory: false,
        ownerPlayerId: scoringWinnerOwner,
        canTrigger: ctx => (ctx.state.baseDiscard?.length ?? 0) > 0 && Boolean(ctx.rankings?.[0]?.playerId),
    });
    registerBaseAbility('base_primate_park', 'afterScoring', basePrimatePark, {
        mandatory: false,
        ownerPlayerId: scoringWinnerOwner,
        canTrigger: ctx => {
            const winnerId = ctx.rankings?.[0]?.playerId;
            return Boolean(winnerId && ctx.state.bases[ctx.baseIndex]?.minions.some(minion => minion.attachedActions.length > 0));
        },
    });
    registerBaseAbility('base_isis_swingin_pad', 'afterScoring', baseIsiSwinginPad, {
        mandatory: false,
        ownerPlayerId: scoringWinnerOwner,
        canTrigger: ctx => {
            const winnerId = ctx.rankings?.[0]?.playerId;
            return Boolean(winnerId && (ctx.state.players[winnerId]?.deck.length ?? 0) > 0);
        },
    });

    const handleDeckMinionSearch = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _iData: Record<string, unknown> | undefined, random: RandomFn, timestamp: number) => {
        const selected = value as DeckMinionSearchChoice | undefined;
        if (!selected?.cardUid) return { state, events: [] };
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        if (!allowedCardUids?.has(selected.cardUid)) return { state, events: [] };
        return {
            state,
            events: buildDeckMinionSearchEvents(state.core, playerId, selected, random, timestamp),
        };
    };
    registerInteractionHandler('shapeshifters_transmogrify_search', handleDeckMinionSearch);
    registerInteractionHandler('shapeshifters_gelf_search', handleDeckMinionSearch);
    registerInteractionHandler('shapeshifters_doppelganger_search', handleDeckMinionSearch);

    registerInteractionHandler('shapeshifters_really_search', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as DiscardMinionSearchChoice | undefined;
        if (!selected?.cardUid) return { state, events: [] };
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        if (!allowedCardUids?.has(selected.cardUid)) return { state, events: [] };
        if (selected.baseIndex === undefined) {
            return queueDiscardMinionBaseChoice(state, playerId, selected, timestamp);
        }
        return {
            state,
            events: buildDiscardMinionSearchEvents(state.core, playerId, selected, timestamp),
        };
    });

    registerInteractionHandler('shapeshifters_really_base', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as DiscardMinionSearchChoice | undefined;
        const expectedCardUid = typeof iData?.selectedCardUid === 'string' ? iData.selectedCardUid : undefined;
        const allowedBaseIndices = Array.isArray(iData?.allowedBaseIndices)
            ? new Set(iData.allowedBaseIndices.filter((baseIndex): baseIndex is number => typeof baseIndex === 'number'))
            : undefined;
        if (!selected?.cardUid || selected.baseIndex === undefined || !expectedCardUid || !allowedBaseIndices || selected.cardUid !== expectedCardUid) {
            return { state, events: [] };
        }
        if (!allowedBaseIndices.has(selected.baseIndex)) return { state, events: [] };
        return {
            state,
            events: buildDiscardMinionSearchEvents(state.core, playerId, selected, timestamp),
        };
    });

    registerInteractionHandler('super_spies_from_q_with_love_discard', (state, playerId, value, iData, _random, timestamp) => {
        const choices = normalizeChoiceArray<CardUidChoice>(value);
        const cardUids = choices
            .map(choice => choice.cardUid)
            .filter((uid): uid is string => typeof uid === 'string');
        const discardCount = typeof iData?.discardCount === 'number' ? iData.discardCount : 0;
        if (discardCount <= 0 || cardUids.length !== choices.length || cardUids.length !== discardCount) return { state, events: [] };
        const selectedSet = new Set(cardUids);
        if (selectedSet.size !== cardUids.length) return { state, events: [] };
        const allowedCardUids = readStringSet(iData?.allowedCardUids);
        if (!allowedCardUids || cardUids.some(uid => !allowedCardUids.has(uid))) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player || cardUids.some(uid => !player.hand.some(card => card.uid === uid))) return { state, events: [] };
        return { state, events: [discardFromHand(playerId, cardUids, timestamp)] };
    });

    registerInteractionHandler('cyborg_apes_monkey_see_monkey_do_choose', (state, playerId, value, _iData, random, timestamp) => {
        const chosenUids = normalizeChoiceArray<CardUidChoice>(value)
            .map(choice => choice.cardUid)
            .filter((uid): uid is string => typeof uid === 'string');
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const inspectedUids = Array.isArray(_iData?.inspectedUids)
            ? new Set(_iData.inspectedUids.filter((uid): uid is string => typeof uid === 'string'))
            : new Set<string>();
        const allowedCardUids = Array.isArray(_iData?.allowedCardUids)
            ? new Set(_iData.allowedCardUids.filter((uid): uid is string => typeof uid === 'string'))
            : new Set<string>();
        const chosenSet = new Set(chosenUids);
        if (chosenSet.size !== chosenUids.length) return { state, events: [] };
        const allChosenValid = chosenUids.every(uid =>
            inspectedUids.has(uid)
            && allowedCardUids.has(uid)
            && player.deck.some(card => card.uid === uid && isActionCard(card)),
        );
        if (!allChosenValid) return { state, events: [] };
        const rest = player.deck.filter(card => !chosenSet.has(card.uid));
        const events: SmashUpEvent[] = [];
        if (chosenUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId, count: chosenUids.length, cardUids: chosenUids },
                timestamp,
            } as SmashUpEvent);
        }
        events.push(deckReordered(playerId, random.shuffle(rest.map(card => card.uid)), timestamp));
        return { state, events };
    });

    registerInteractionHandler('shapeshifters_copycat_choose', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid } = value as MinionUidChoice;
        const copycatUid = typeof iData?.copycatUid === 'string' ? iData.copycatUid : undefined;
        const allowedMinionUids = readStringSet(iData?.allowedMinionUids);
        if (!copycatUid || !minionUid || !allowedMinionUids?.has(minionUid)) return { state, events: [] };
        const target = locateMinion(state.core, minionUid);
        const copycat = locateMinion(state.core, copycatUid);
        if (
            !target
            || !copycat
            || !matchesDefId(copycat.minion.defId, 'shapeshifters_copycat')
            || copycat.minion.controller !== playerId
            || target.minion.controller === playerId
        ) {
            return { state, events: [] };
        }
        return {
            state,
            events: [{
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: copycatUid,
                    baseIndex: copycat.baseIndex,
                    metadataUpdate: {
                        copiedAbilityDefId: target.minion.defId,
                        copiedAbilityUntilTurn: state.core.turnNumber,
                    },
                    reason: 'shapeshifters_copycat',
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('shapeshifters_cellular_bonding_choose', (state, _playerId, value, iData, _random, timestamp) => {
        const { actionUid } = value as ActionUidChoice;
        const hostMinionUid = typeof iData?.hostMinionUid === 'string' ? iData.hostMinionUid : undefined;
        const hostBaseIndex = typeof iData?.hostBaseIndex === 'number' ? iData.hostBaseIndex : undefined;
        const bondingCardUid = typeof iData?.bondingCardUid === 'string' ? iData.bondingCardUid : undefined;
        const allowedActionUids = readStringSet(iData?.allowedActionUids);
        if (
            !actionUid
            || !hostMinionUid
            || hostBaseIndex === undefined
            || !bondingCardUid
            || !allowedActionUids?.has(actionUid)
        ) {
            return { state, events: [] };
        }
        const host = locateMinion(state.core, hostMinionUid);
        const bonding = host?.minion.attachedActions.find(action =>
            action.uid === bondingCardUid && action.defId === 'shapeshifters_cellular_bonding',
        );
        const copied = host?.minion.attachedActions.find(action => action.uid === actionUid && action.uid !== bondingCardUid);
        if (!host || host.baseIndex !== hostBaseIndex || !bonding || !copied) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.MINION_METADATA_UPDATED,
                payload: {
                    minionUid: host.minion.uid,
                    baseIndex: host.baseIndex,
                    metadataUpdate: {
                        cellularBondingCardUid: bondingCardUid,
                        cellularBondingCopiedActionDefId: copied.defId,
                    },
                    reason: 'shapeshifters_cellular_bonding',
                },
                timestamp,
            } as SmashUpEvent],
        };
    });

    registerInteractionHandler('cyborg_apes_monkey_on_your_back_choose', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid } = value as MinionUidChoice;
        const actionUid = typeof iData?.actionUid === 'string' ? iData.actionUid : undefined;
        const allowedMinionUids = readStringSet(iData?.allowedMinionUids);
        if (!actionUid || !minionUid || !allowedMinionUids?.has(minionUid)) return { state, events: [] };
        return {
            state,
            events: buildMonkeyOnYourBackEvents(state.core, playerId, actionUid, minionUid, timestamp),
        };
    });

    registerInteractionHandler('cyborg_apes_clyde_2_0_detach', (state, _playerId, value, iData, _random, timestamp) => {
        const detached = iData?.detached && typeof iData.detached === 'object'
            ? iData.detached as Record<string, unknown>
            : undefined;
        const cardUid = typeof detached?.cardUid === 'string' ? detached.cardUid : undefined;
        const defId = typeof detached?.defId === 'string' ? detached.defId : undefined;
        const ownerId = typeof detached?.ownerId === 'string' ? detached.ownerId as PlayerId : undefined;
        const reason = typeof detached?.reason === 'string' ? detached.reason : undefined;
        const baseIndex = typeof detached?.baseIndex === 'number' ? detached.baseIndex : undefined;
        const hostUid = typeof detached?.hostUid === 'string' ? detached.hostUid : undefined;
        const clydeControllerId = typeof detached?.clydeControllerId === 'string' ? detached.clydeControllerId as PlayerId : undefined;
        if (!cardUid || !defId || !ownerId || !reason || baseIndex === undefined || !hostUid || !clydeControllerId) {
            return { state, events: [] };
        }
        const base = state.core.bases[baseIndex];
        const host = base?.minions.find(minion => minion.uid === hostUid);
        const action = host?.attachedActions.find(attached => attached.uid === cardUid && attached.defId === defId);
        const clyde = base?.minions.find(minion =>
            minion.controller === clydeControllerId
            && minion.controller === host?.controller
            && matchesDefId(minion.defId, 'cyborg_apes_clyde_2_0'),
        );
        if (!base || base.defId === 'base_primate_park' || !host || !action || !clyde) {
            return { state, events: [] };
        }
        const selected = value as ClydeDetachChoice | undefined;
        return {
            state,
            events: [buildOngoingDetachedEvent({
                cardUid,
                defId,
                ownerId,
                reason,
                clydeReturnToHand: selected?.returnToHand === true,
                sourcePlayerId: detached.sourcePlayerId as PlayerId | undefined,
                sourceCardUid: detached.sourceCardUid as string | undefined,
                sourceDefId: detached.sourceDefId as string | undefined,
                sourceControllerId: detached.sourceControllerId as PlayerId | undefined,
                sourceBaseIndex: detached.sourceBaseIndex as number | undefined,
                now: typeof detached.timestamp === 'number' ? detached.timestamp : timestamp,
            })],
        };
    });

    registerInteractionHandler('shapeshifters_mitosis_choose', (state, playerId, value, iData, _random, timestamp) => {
        if ((value as { skip?: true } | undefined)?.skip) return { state, events: [] };
        const selected = value as { cardUid?: string; baseIndex?: number; sameNameDefId?: string } | undefined;
        const player = state.core.players[playerId];
        if (!player || !selected?.cardUid || selected.baseIndex === undefined || !selected.sameNameDefId) {
            return { state, events: [] };
        }
        const allowedCardUids = readStringSet(iData?.allowedCardUids);
        if (!allowedCardUids?.has(selected.cardUid)) return { state, events: [] };
        const card = player.hand.find(candidate =>
            candidate.uid === selected.cardUid
            && isSameNameDefId(candidate.defId, selected.sameNameDefId)
            && isMinionCard(candidate),
        );
        if (!card || !state.core.bases[selected.baseIndex]) return { state, events: [] };
        return {
            state,
            events: [
                buildPlayMinionFromZoneEvent({
                    playerId,
                    card,
                    baseIndex: selected.baseIndex,
                    baseDefId: state.core.bases[selected.baseIndex]?.defId,
                    now: timestamp,
                    consumesNormalLimit: false,
                }),
            ],
        };
    });

    registerInteractionHandler('shapeshifters_genetic_shift_choose', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as GeneticShiftChoice | undefined;
        if (selected?.mode === 'single' && selected.minionUid) {
            const allowedMinionUids = readStringSet(iData?.allowedMinionUids);
            if (!allowedMinionUids?.has(selected.minionUid)) return { state, events: [] };
            const target = locateMinion(state.core, selected.minionUid);
            if (!target || target.minion.controller !== playerId) return { state, events: [] };
            return {
                state,
                events: [addTempPower(target.minion.uid, target.baseIndex, 3, 'shapeshifters_genetic_shift', timestamp)],
            };
        }
        return { state, events: buildGeneticShiftAllEvents(state.core, playerId, timestamp) };
    });

    registerInteractionHandler('super_spies_the_spy_who_ditched_me_discard', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid } = value as CardUidChoice;
        const player = state.core.players[playerId];
        const allowedCardUids = readStringSet(iData?.allowedCardUids);
        if (
            !cardUid
            || !allowedCardUids
            || !allowedCardUids.has(cardUid)
            || !player?.hand.some(card => card.uid === cardUid && isMinionCard(card))
        ) {
            return { state, events: [] };
        }
        return { state, events: [discardFromHand(playerId, [cardUid], timestamp)] };
    });

    registerInteractionHandler('super_spies_secret_agent_discard', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid } = value as CardUidChoice;
        const player = state.core.players[playerId];
        const allowedCardUids = readStringSet(iData?.allowedCardUids);
        if (
            !cardUid
            || !allowedCardUids
            || !allowedCardUids.has(cardUid)
            || !player?.hand.some(card => card.uid === cardUid)
        ) {
            return { state, events: [] };
        }
        return { state, events: [discardFromHand(playerId, [cardUid], timestamp)] };
    });

    registerInteractionHandler('cyborg_apes_flying_monkey_move', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as FlyingMonkeyMoveChoice | { skip?: true } | undefined;
        if (!selected || 'skip' in selected) return { state, events: [] };
        const move = normalizeFlyingMonkeyMove(selected);
        if (!move || !isAllowedFlyingMonkeyMove(move, _iData)) return { state, events: [] };
        const minion = state.core.bases[move.fromBaseIndex]?.minions.find(candidate => candidate.uid === move.minionUid);
        const action = minion?.attachedActions.find(candidate => candidate.uid === move.actionUid);
        if (!minion || !action || move.toBaseIndex === move.fromBaseIndex || !state.core.bases[move.toBaseIndex]) {
            return { state, events: [] };
        }
        const reason = move.reason ?? 'cyborg_apes_flying_monkey';
        const sourceControllerId = getOngoingActionControllerId(action);
        return {
            state,
            events: [
                ...buildValidatedMoveEvents(state.core, {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: move.fromBaseIndex,
                    toBaseIndex: move.toBaseIndex,
                    toBaseDefId: state.core.bases[move.toBaseIndex]?.defId,
                    reason,
                    now: timestamp,
                    sourcePlayerId: sourceControllerId,
                    sourceDefId: action.defId,
                    sourceControllerId,
                    sourceBaseIndex: move.fromBaseIndex,
                }),
                detachOngoing(action.uid, action.defId, action.ownerId, reason, timestamp),
            ],
        };
    });

    registerInteractionHandler('super_spies_live_and_let_chum_choose', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid } = value as MinionUidChoice;
        const baseIndex = typeof iData?.baseIndex === 'number' ? iData.baseIndex : undefined;
        const allowedMinionUids = Array.isArray(iData?.allowedMinionUids)
            ? new Set(iData.allowedMinionUids.filter((uid): uid is string => typeof uid === 'string'))
            : undefined;
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        const target = locateMinion(state.core, minionUid);
        if (
            !target
            || target.baseIndex !== baseIndex
            || !allowedMinionUids?.has(target.minion.uid)
            || getMinionPower(state.core, target.minion, target.baseIndex) > 3
        ) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: target.minion.uid,
                minionDefId: target.minion.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: playerId,
                reason: 'super_spies_live_and_let_chum',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'super_spies_live_and_let_chum',
                sourceControllerId: playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('super_spies_the_base_is_not_enough_choose', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid } = value as MinionUidChoice;
        const baseIndex = typeof iData?.baseIndex === 'number' ? iData.baseIndex : undefined;
        const allowedMinionUids = Array.isArray(iData?.allowedMinionUids)
            ? new Set(iData.allowedMinionUids.filter((uid): uid is string => typeof uid === 'string'))
            : undefined;
        if (!minionUid || baseIndex === undefined) return { state, events: [] };
        const target = locateMinion(state.core, minionUid);
        if (
            !target
            || target.baseIndex !== baseIndex
            || !allowedMinionUids?.has(target.minion.uid)
            || getMinionPower(state.core, target.minion, target.baseIndex) > 4
        ) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                changeMinionController(
                    target.minion.uid,
                    target.minion.defId,
                    target.baseIndex,
                    target.minion.owner,
                    target.minion.controller,
                    playerId,
                    playerId,
                    'super_spies_the_base_is_not_enough',
                    timestamp,
                ),
                markTemporaryControlUntilTurnEnd(
                    target.minion.uid,
                    target.baseIndex,
                    target.minion.controller,
                    playerId,
                    state.core.turnNumber,
                    'super_spies_the_base_is_not_enough',
                    timestamp,
                ),
            ],
        };
    });

    registerInteractionHandler('time_travelers_doctor_when_choose', (state, playerId, value, iData, _random, timestamp) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { state, events: [] };
        const { minionUid } = value as MinionUidChoice;
        const doctorUid = typeof iData?.doctorUid === 'string' ? iData.doctorUid : undefined;
        const allowedMinionUids = readStringSet(iData?.allowedMinionUids);
        if (!doctorUid || !minionUid || minionUid === doctorUid || !allowedMinionUids?.has(minionUid)) {
            return { state, events: [] };
        }
        const target = locateMinion(state.core, minionUid);
        if (!target || target.minion.controller !== playerId) return { state, events: [] };
        return {
            state,
            events: [
                ...buildValidatedReturnEvents(state.core, {
                    minionUid: target.minion.uid,
                    minionDefId: target.minion.defId,
                    fromBaseIndex: target.baseIndex,
                    reason: 'time_travelers_doctor_when',
                    now: timestamp,
                    sourcePlayerId: playerId,
                }),
                grantExtraMinion(playerId, 'time_travelers_doctor_when', timestamp, undefined, {
                    sameNameDefId: target.minion.defId,
                    specificCardUid: target.minion.uid,
                    playTiming: 'immediate',
                }),
            ],
        };
    });

    registerInteractionHandler('time_travelers_its_astounding_choose', (state, playerId, value, _iData, random, timestamp) => {
        const { cardUid } = value as CardUidChoice;
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        if (!cardUid || !allowedCardUids?.has(cardUid)) return { state, events: [] };
        return resolveItsAstoundingAction(state, playerId, cardUid, random, timestamp);
    });

    registerInteractionHandler('time_travelers_its_astounding_target', (state, playerId, value, iData, random, timestamp) => {
        const selected = value as DiscardActionPlayChoice | undefined;
        const cardUid = typeof iData?.cardUid === 'string' ? iData.cardUid : selected?.cardUid;
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === cardUid && isActionCard(candidate));
        if (!card || selected?.cardUid !== card.uid) return { state, events: [] };
        const allowedTargets = Array.isArray(iData?.allowedDiscardActionTargets)
            ? iData.allowedDiscardActionTargets
            : [];
        const wasPromptCandidate = allowedTargets.some(target => {
            if (!target || typeof target !== 'object') return false;
            const candidate = target as DiscardActionPlayChoice;
            return candidate.cardUid === selected.cardUid
                && candidate.targetBaseIndex === selected.targetBaseIndex
                && candidate.targetMinionUid === selected.targetMinionUid;
        });
        if (!wasPromptCandidate) return { state, events: [] };
        const allowed = buildDiscardActionTargetOptions(state.core, playerId, card).some(option =>
            option.value.cardUid === selected.cardUid
            && option.value.targetBaseIndex === selected.targetBaseIndex
            && option.value.targetMinionUid === selected.targetMinionUid,
        );
        if (!allowed) return { state, events: [] };
        return buildDiscardActionPlayEvents({
            state,
            playerId,
            card,
            timestamp,
            random,
            targetBaseIndex: selected.targetBaseIndex,
            targetMinionUid: selected.targetMinionUid,
        });
    });

    registerInteractionHandler('time_travelers_into_the_time_slip_choose', (state, _playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as InPlayCardChoice;
        const allowedCardUids = Array.isArray(_iData?.allowedCardUids)
            ? _iData.allowedCardUids.filter((uid): uid is string => typeof uid === 'string')
            : [];
        if (!cardUid || !allowedCardUids.includes(cardUid)) return { state, events: [] };
        const card = locateCardInPlay(state.core, cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: [returnCardInPlayToOwnerHand(card, 'time_travelers_into_the_time_slip', timestamp)],
        };
    });

    registerInteractionHandler('base_the_nexus_choose', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { baseDefId?: string; skip?: true } | undefined;
        if (!selected?.baseDefId || selected.skip) return { state, events: [] };
        const allowedBaseDefIds = readStringSet(_iData?.allowedBaseDefIds);
        if (!allowedBaseDefIds?.has(selected.baseDefId)) return { state, events: [] };
        if (!state.core.baseDiscard?.includes(selected.baseDefId)) return { state, events: [] };
        return {
            state,
            events: [reorderBaseDiscardTop(selected.baseDefId, 'base_the_nexus', timestamp)],
        };
    });

    registerInteractionHandler('base_primate_park_return', (state, _playerId, value, _iData, _random, timestamp) => {
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        const baseIndex = typeof _iData?.baseIndex === 'number' ? _iData.baseIndex : undefined;
        if (!allowedCardUids || baseIndex === undefined) return { state, events: [] };

        const choices = normalizeChoiceArray<CardUidChoice>(value);
        const selectedCardUids = choices
            .map(choice => choice.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string');
        if (selectedCardUids.length !== choices.length || hasDuplicateStrings(selectedCardUids)) {
            return { state, events: [] };
        }

        const selectedCards: LocatedInPlayCard[] = [];
        for (const cardUid of selectedCardUids) {
            if (!allowedCardUids.has(cardUid)) return { state, events: [] };
            const card = locateCardInPlay(state.core, cardUid);
            if (!card || card.type !== 'attached' || card.baseIndex !== baseIndex) {
                return { state, events: [] };
            }
            selectedCards.push(card);
        }

        const events = selectedCards.map(card => returnCardInPlayToOwnerHand(card, 'base_primate_park', timestamp));
        return { state, events };
    });

    registerInteractionHandler('super_spies_permit_to_kill_order', (state, _playerId, value, iData, _random, timestamp) => {
        return {
            state,
            events: buildValidatedDeckReorderEvents(state, value as TopBottomDeckReorderChoice, iData, timestamp),
        };
    });

    registerInteractionHandler('base_faceless_city_choose', (state, playerId, value, _iData, random, timestamp) => {
        const selected = value as CardUidChoice | { skip?: true } | undefined;
        if (!selected || 'skip' in selected || !selected.cardUid) return { state, events: [] };
        const player = state.core.players[playerId];
        const allowedCardUids = Array.isArray(_iData?.allowedCardUids)
            ? new Set(_iData.allowedCardUids.filter((uid): uid is string => typeof uid === 'string'))
            : undefined;
        const minionDefId = typeof _iData?.minionDefId === 'string' ? _iData.minionDefId : undefined;
        if (!allowedCardUids || !minionDefId) return { state, events: [] };
        const card = player?.deck.find(candidate =>
            candidate.uid === selected.cardUid
            && isMinionCard(candidate)
            && allowedCardUids.has(candidate.uid)
            && isSameNameDefId(candidate.defId, minionDefId),
        );
        if (!player || !card) return { state, events: [] };
        const remainingDeck = player.deck.filter(candidate => candidate.uid !== card.uid);
        return {
            state,
            events: [
                revealDeckTop(playerId, 'all', [{ uid: card.uid, defId: card.defId }], 1, 'base_faceless_city', timestamp, playerId),
                drawSpecificCards(playerId, [card.uid], timestamp),
                deckReordered(playerId, random.shuffle(remainingDeck).map(candidate => candidate.uid), timestamp),
            ],
        };
    });

    registerInteractionHandler('super_spies_operative_top_bottom', (state, _playerId, value, _iData, _random, timestamp) => {
        const bottomChoices = normalizeChoiceArray<OperativeBottomChoice>(value);
        const revealedByPlayer = (_iData?.revealedByPlayer && typeof _iData.revealedByPlayer === 'object')
            ? _iData.revealedByPlayer as Record<string, string[]>
            : undefined;
        if (!revealedByPlayer) return { state, events: [] };
        const byPlayer = new Map<PlayerId, string[]>();
        for (const choice of bottomChoices) {
            if (!choice.targetPlayerId || !choice.cardUid) return { state, events: [] };
            if (!(revealedByPlayer[choice.targetPlayerId] ?? []).includes(choice.cardUid)) return { state, events: [] };
            byPlayer.set(choice.targetPlayerId, [...(byPlayer.get(choice.targetPlayerId) ?? []), choice.cardUid]);
        }
        const events: SmashUpEvent[] = [];
        for (const [targetPlayerId, bottomUids] of byPlayer.entries()) {
            const deck = state.core.players[targetPlayerId]?.deck ?? [];
            const bottomSet = new Set(bottomUids);
            if (bottomSet.size !== bottomUids.length) return { state, events: [] };
            const validBottomUids = bottomUids.filter(uid => deck.some(card => card.uid === uid));
            if (validBottomUids.length !== bottomUids.length) return { state, events: [] };
            if (validBottomUids.length === 0) continue;
            events.push(deckReordered(targetPlayerId, [
                ...deck.filter(card => !bottomSet.has(card.uid)).map(card => card.uid),
                ...validBottomUids,
            ], timestamp));
        }
        return { state, events };
    });

    registerInteractionHandler('super_spies_operative_players', (state, playerId, value, _iData, _random, timestamp) => {
        const allowedPlayerIds = readStringSet(_iData?.allowedPlayerIds);
        const choices = normalizeChoiceArray<PlayerIdChoice>(value);
        const selectedPlayerIds = choices
            .map(choice => choice.targetPlayerId)
            .filter((targetPlayerId): targetPlayerId is PlayerId => typeof targetPlayerId === 'string');
        if (
            selectedPlayerIds.length !== choices.length
            || selectedPlayerIds.some(targetPlayerId =>
                !allowedPlayerIds?.has(targetPlayerId)
                || !state.core.turnOrder.includes(targetPlayerId)
                || !state.core.players[targetPlayerId]?.deck[0],
            )
        ) {
            return { state, events: [] };
        }
        const uniquePlayerIds = Array.from(new Set(selectedPlayerIds));
        if (uniquePlayerIds.length !== selectedPlayerIds.length) return { state, events: [] };
        if (uniquePlayerIds.length === 0) return { state, events: [] };
        const { events, options, revealedByPlayer } = buildOperativeReveal(state.core, playerId, uniquePlayerIds, timestamp);
        return {
            state: queueOperativeTopBottomChoice(state, playerId, options, revealedByPlayer, timestamp),
            events,
        };
    });

    registerInteractionHandler('super_spies_for_my_eyes_only_reorder', (state, _playerId, value, iData, _random, timestamp) => {
        return {
            state,
            events: buildValidatedDeckReorderEvents(state, value as TopBottomDeckReorderChoice, iData, timestamp),
        };
    });

    registerInteractionHandler('super_spies_spy_reorder', (state, _playerId, value, iData, _random, timestamp) => {
        return {
            state,
            events: buildValidatedDeckReorderEvents(state, value as TopBottomDeckReorderChoice, iData, timestamp),
        };
    });

    registerInteractionHandler('time_travelers_time_is_fleeting_choose', (state, _playerId, value, _iData, _random, timestamp) => {
        const { baseDefId } = value as { baseDefId: string };
        const allowedBaseDefIds = readStringSet(_iData?.allowedBaseDefIds);
        if (!allowedBaseDefIds?.has(baseDefId)) return { state, events: [] };
        if (!state.core.baseDiscard?.includes(baseDefId)) return { state, events: [] };
        const scoredBaseDefId = typeof _iData?.scoredBaseDefId === 'string' ? _iData.scoredBaseDefId : undefined;
        if (scoredBaseDefId && baseDefId === scoredBaseDefId) return { state, events: [] };
        return {
            state,
            events: [reorderBaseDiscardTop(baseDefId, 'time_travelers_time_is_fleeting', timestamp)],
        };
    });

    registerInteractionHandler('time_travelers_wormhole_choose', (state, playerId, value, _iData, random, timestamp) => {
        const allowedMinionUids = readStringSet(_iData?.allowedMinionUids);
        const baseIndex = typeof _iData?.baseIndex === 'number' ? _iData.baseIndex : undefined;
        if (!allowedMinionUids || baseIndex === undefined) return { state, events: [] };

        const choices = normalizeChoiceArray<WormholeMinionChoice>(value);
        const selectedMinionUids = choices
            .map(choice => choice.minionUid)
            .filter((minionUid): minionUid is string => typeof minionUid === 'string');
        if (selectedMinionUids.length !== choices.length || hasDuplicateStrings(selectedMinionUids)) {
            return { state, events: [] };
        }

        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const selectedMinions: MinionOnBase[] = [];
        for (const minionUid of selectedMinionUids) {
            if (!allowedMinionUids.has(minionUid)) return { state, events: [] };
            const minion = base.minions.find(candidate => candidate.uid === minionUid);
            if (!minion || minion.controller !== playerId) return { state, events: [] };
            selectedMinions.push(minion);
        }

        return {
            state,
            events: buildTimeTravelersWormholeEvents(state.core, selectedMinions, playerId, random, timestamp),
        };
    });

    registerInteractionHandler('time_travelers_time_raider_choose', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        if (!allowedCardUids?.has(cardUid)) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === cardUid);
        if (!card) return { state, events: [] };
        return {
            state,
            events: buildValidatedCardToDeckBottomEvents(state.core, {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                sourcePlayerId: playerId,
                reason: 'time_travelers_time_raider',
                now: timestamp,
                locationPlayerId: playerId,
                expectedLocation: 'discard',
            }),
        };
    });

    registerInteractionHandler('time_travelers_repeater_perfect_choose', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        const allowedCardUids = readStringSet(_iData?.allowedCardUids);
        if (!allowedCardUids?.has(cardUid)) return { state, events: [] };
        const card = state.core.players[playerId]?.discard.find(candidate => candidate.uid === cardUid && isActionCard(candidate));
        if (!card) return { state, events: [] };
        return { state, events: [cardToDeckTop(card, card.owner, 'time_travelers_repeater_perfect', timestamp, playerId)] };
    });

    registerInteractionHandler('time_travelers_1_21_gigawatts_choose', (state, playerId, value, _iData, random, timestamp) => {
        const { cardType } = value as { cardType?: 'action' | 'minion' };
        const allowedCardTypes = readStringSet(_iData?.allowedCardTypes);
        if ((cardType !== 'action' && cardType !== 'minion') || !allowedCardTypes?.has(cardType)) {
            return { state, events: [] };
        }
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const selected = player.discard.filter(card => cardType === 'action' ? isActionCard(card) : isMinionCard(card));
        if (selected.length === 0) return { state, events: [] };
        return {
            state,
            events: buildOwnerScopedDeckReorderedEventsFromDiscard(state.core, playerId, selected, random, timestamp),
        };
    });

    registerInteractionHandler('base_isis_swingin_pad_reorder', (state, _playerId, value, iData, _random, timestamp) => {
        return {
            state,
            events: buildValidatedDeckReorderEvents(state, value as TopBottomDeckReorderChoice, iData, timestamp),
        };
    });
}
