/**
 * 大杀四方 - 巫师派系能力
 *
 * 主题：抽牌、额外打出行动卡
 */

import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantContextualExtraAction,
    grantContextualExtraMinion,
    shuffleHandIntoDeck,
    getMinionPower,
    buildMinionTargetOptions,
    buildBaseTargetOptions,
    revealDeckTop,
    buildAbilityFeedback,
    findCardInPlayerZone,
    resolveExtraPlayTiming,
    peekDeckTop,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
    buildSemanticOngoingAttachEvents,
    buildValidatedDestroyEvents,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, SmashUpEvent, DeckReorderedEvent, MinionCardDef, CardToDeckTopEvent, ActionCardDef, SmashUpCore } from '../domain/types';
import { getOpponentLabel } from '../domain/utils';
import { registerTrigger } from '../domain/ongoingEffects';
import { getCurrentTrackedCardTopSnapshot } from '../../../engine/systems/InteractionSystem';
import type { InteractionDescriptor, PromptOption } from '../../../engine/systems/InteractionSystem';
import { getCardDef, getBaseDef } from '../data/cards';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { validateActionPlaySemantics } from '../domain/playLegality';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { createCardObjectRef, createCardTransferEvent } from '../domain/objectProvenance';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
} from '../domain/abilityRuntime';

function getCurrentDeckTopSnapshotCards<T extends { uid: string; defId: string }>(
    state: SmashUpCore,
    playerId: string,
    trackedCards: T[],
): T[] {
    return getCurrentTrackedCardTopSnapshot(state.players[playerId]?.deck ?? [], trackedCards);
}

type WizardMassEnchantmentCandidate = {
    uid: string;
    defId: string;
    pid: string;
    label: string;
};

function buildWizardMassEnchantmentOptions(
    state: SmashUpCore,
    trackedCandidates: WizardMassEnchantmentCandidate[],
) {
    return trackedCandidates
        .filter((candidate) => {
            const topCard = state.players[candidate.pid]?.deck[0];
            return !!topCard && topCard.uid === candidate.uid && topCard.defId === candidate.defId && topCard.type === 'action';
        })
        .map((candidate, index) => ({
            id: `card-${index}`,
            label: candidate.label,
            value: { cardUid: candidate.uid, defId: candidate.defId, pid: candidate.pid },
            _source: 'static' as const,
            displayMode: 'card' as const,
        }));
}

function buildWizardScryOptions(
    state: SmashUpCore,
    playerId: string,
) {
    const player = state.players[playerId];
    if (!player) return [];

    return player.deck
        .filter((card) => card.type === 'action')
        .map((card, index) => {
            const def = getCardDef(card.defId);
            const name = def?.name ?? card.defId;
            return {
                id: `card-${index}`,
                label: name,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'static' as const,
                displayMode: 'card' as const,
            };
        });
}

type WizardPortalOrderContext = {
    remaining: { uid: string; defId: string }[];
    ordered: { uid: string; defId: string }[];
    trackedAll?: { uid: string; defId: string }[];
    pickedToHandUids?: string[];
};

function resolveWizardPortalOrderSnapshot(
    state: SmashUpCore,
    playerId: string,
    ctx: WizardPortalOrderContext,
) {
    const trackedCards = ctx.trackedAll ?? [...ctx.ordered, ...ctx.remaining];
    const snapshot = getCurrentDeckTopSnapshotCards(state, playerId, trackedCards);

    if (ctx.trackedAll) {
        const snapshotByUid = new Set(snapshot.map((card) => card.uid));
        const ordered = ctx.ordered.filter((card) => snapshotByUid.has(card.uid));
        const orderedUidSet = new Set(ordered.map((card) => card.uid));
        const pickedUidSet = new Set(ctx.pickedToHandUids ?? []);

        return {
            ordered,
            remaining: snapshot.filter((card) => !pickedUidSet.has(card.uid) && !orderedUidSet.has(card.uid)),
        };
    }

    const orderedCount = Math.min(ctx.ordered.length, snapshot.length);
    return {
        ordered: snapshot.slice(0, orderedCount),
        remaining: snapshot.slice(orderedCount),
    };
}

function buildWizardPortalOrderOptions(
    state: SmashUpCore,
    playerId: string,
    ctx: WizardPortalOrderContext,
) {
    return resolveWizardPortalOrderSnapshot(state, playerId, ctx).remaining.map((card, index) => {
        const def = getCardDef(card.defId);
        const name = def?.name ?? card.defId;
        return {
            id: `card-${index}`,
            label: name,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'static' as const,
            displayMode: 'card' as const,
        };
    });
}

function buildWizardPortalOrderCardOptions(cards: { uid: string; defId: string }[]) {
    return cards.map((card, index) => {
        const def = getCardDef(card.defId);
        const name = def?.name ?? card.defId;
        return {
            id: `card-${index}`,
            label: name,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'static' as const,
            displayMode: 'card' as const,
        };
    });
}

function buildWizardPortalReturnToDeckTopEvent(
    state: SmashUpCore,
    sourcePlayerId: PlayerId,
    cardUid: string,
    defId: string,
    timestamp: number,
): CardToDeckTopEvent {
    const sourceDeckCard = state.players[sourcePlayerId]?.deck.find((card) => card.uid === cardUid && card.defId === defId);
    const ownerId = sourceDeckCard?.owner ?? sourcePlayerId;
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid,
            defId,
            ownerId,
            ...(ownerId !== sourcePlayerId ? { sourcePlayerId } : {}),
            reason: 'wizard_portal',
        },
        timestamp,
    } as CardToDeckTopEvent;
}

/** 时间法师 onPlay：额外打出一个行动*/
function wizardChronomage(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'wizard_chronomage')] };
}

/** 大法师 POD talent：额外打出一个行动 */
function wizardArchmagePodTalent(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, 'wizard_archmage_pod')] };
}

/** 女巫 onPlay：抽一张牌 */
function wizardEnchantress(ctx: AbilityContext): AbilityResult {
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    return events.length > 0
        ? { events }
        : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
}

/** 秘术学习 onPlay：抽两张）?*/
function wizardMysticStudies(ctx: AbilityContext): AbilityResult {
    const events = buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now);
    return events.length > 0
        ? { events }
        : { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
}

/** 召唤 onPlay：额外打出一个随从*/
function wizardSummon(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraMinion(ctx, 'wizard_summon')] };
}

/** 时间圆环 onPlay：额外打出两个行动*/
function wizardTimeLoop(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'wizard_time_loop'),
            grantContextualExtraAction(ctx, 'wizard_time_loop'),
        ],
    };
}

type ExternalActionPlayMode =
    | 'immediate'
    | 'ongoing-base'
    | 'ongoing-minion'
    | 'special-base'
    | 'standard-base'
    | 'standard-minion';

function getExternalActionPlayMode(def?: ActionCardDef): ExternalActionPlayMode {
    if (!def) return 'immediate';
    if (def.subtype === 'ongoing') {
        return (def.ongoingTarget ?? 'base') === 'minion' ? 'ongoing-minion' : 'ongoing-base';
    }
    if (def.subtype === 'special' && def.specialNeedsBase) {
        return 'special-base';
    }
    if (def.playNeedsMinion) {
        return 'standard-minion';
    }
    if (def.playNeedsBase) {
        return 'standard-base';
    }
    return 'immediate';
}

function getValidExternalActionBaseCandidates(
    state: AbilityContext['matchState'],
    playerId: string,
    defId: string,
    effectiveHandSize: number,
): Array<{ baseIndex: number; label: string }> {
    return state.core.bases
        .map((base, i) => {
            const baseDef = getBaseDef(base.defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        })
        .filter(candidate => validateActionPlaySemantics(state.core, playerId, {
            defId,
            targetBaseIndex: candidate.baseIndex,
            effectiveHandSize,
        }).valid);
}

function buildWizardMinionTargetOptions(state: SmashUpCore, sourcePlayerId: string) {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const minion of base.minions) {
            const minionDef = getCardDef(minion.defId) as MinionCardDef | undefined;
            const minionName = minionDef?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: i,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }
    return buildMinionTargetOptions(candidates, { state, sourcePlayerId });
}

function getValidExternalActionMinionOptions(
    state: AbilityContext['matchState'],
    playerId: string,
    defId: string,
    effectiveHandSize: number,
) {
    return buildWizardMinionTargetOptions(state.core, playerId).filter((option) => {
        const value = option.value as { baseIndex: number; minionUid: string };
        return validateActionPlaySemantics(state.core, playerId, {
            defId,
            targetBaseIndex: value.baseIndex,
            targetMinionUid: value.minionUid,
            effectiveHandSize,
        }).valid;
    });
}

function canPlayExternalAction(
    state: AbilityContext['matchState'],
    playerId: string,
    defId: string,
    effectiveHandSize: number,
): boolean {
    const def = getCardDef(defId) as ActionCardDef | undefined;
    const playMode = getExternalActionPlayMode(def);
    if (playMode === 'ongoing-base' || playMode === 'special-base' || playMode === 'standard-base') {
        return getValidExternalActionBaseCandidates(state, playerId, defId, effectiveHandSize).length > 0;
    }
    if (playMode === 'ongoing-minion' || playMode === 'standard-minion') {
        return getValidExternalActionMinionOptions(state, playerId, defId, effectiveHandSize).length > 0;
    }
    return validateActionPlaySemantics(state.core, playerId, {
        defId,
        effectiveHandSize,
    }).valid;
}

type WizardPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    random: AbilityContext['random'];
    sourceDefId: string;
};

type WizardTopCardContext = {
    uid: string;
    defId: string;
    type: string;
    name: string;
};

type WizardNeophyteContext = WizardPromptContext & {
    playedCardUid: string;
    topCard?: WizardTopCardContext;
};

type WizardMassEnchantmentContext = WizardPromptContext & {
    candidates: WizardMassEnchantmentCandidate[];
};

type WizardExternalActionContext = WizardPromptContext & {
    cardUid: string;
    defId: string;
    cardName: string;
    origin: 'wizard_neophyte' | 'wizard_mass_enchantment';
    sourcePlayerId?: PlayerId;
};

type WizardPortalTopCard = {
    uid: string;
    defId: string;
    type: string;
};

type WizardPortalContext = WizardPromptContext & {
    topCards: WizardPortalTopCard[];
};

type WizardPortalOrderPromptContext = WizardPromptContext & {
    orderContext: WizardPortalOrderContext;
};

type WizardSacrificeCandidate = {
    uid: string;
    defId: string;
    power: number;
    baseIndex: number;
    ownerId: string;
    label: string;
};

type WizardActionChoiceValue = { action: 'to_hand' | 'play_extra' };
type WizardMassChoiceValue = { cardUid: string; defId: string; pid: string };
type WizardBaseChoiceValue = { baseIndex: number };
type WizardMinionChoiceValue = { baseIndex: number; minionUid: string };
type WizardCardChoiceValue = { cardUid: string; defId: string };
type WizardSacrificeChoiceValue = { minionUid?: string; baseIndex?: number; __cancel__?: true };

function createWizardPromptContext(ctx: AbilityContext): WizardPromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        random: ctx.random,
        sourceDefId: ctx.defId,
    };
}

function attachOptionsGenerator<T>(
    interaction: InteractionDescriptor<T>,
    optionsGenerator: (
        nextState: { core: SmashUpCore },
        interactionData: Record<string, unknown> | undefined,
    ) => unknown[],
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            optionsGenerator,
        },
    };
}

function getWizardActionChoice(value: unknown): WizardActionChoiceValue['action'] | null {
    if (typeof value !== 'object' || value === null) return null;
    const action = (value as { action?: unknown }).action;
    return action === 'to_hand' || action === 'play_extra' ? action : null;
}

function getWizardMassChoice(value: unknown): WizardMassChoiceValue | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as { cardUid?: unknown; defId?: unknown; pid?: unknown };
    if (typeof record.cardUid !== 'string' || typeof record.defId !== 'string' || typeof record.pid !== 'string') {
        return null;
    }
    return { cardUid: record.cardUid, defId: record.defId, pid: record.pid };
}

function getWizardBaseChoice(value: unknown): WizardBaseChoiceValue | null {
    if (typeof value !== 'object' || value === null) return null;
    const baseIndex = (value as { baseIndex?: unknown }).baseIndex;
    return typeof baseIndex === 'number' ? { baseIndex } : null;
}

function getWizardMinionChoice(value: unknown): WizardMinionChoiceValue | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as { baseIndex?: unknown; minionUid?: unknown };
    if (typeof record.baseIndex !== 'number' || typeof record.minionUid !== 'string') return null;
    return { baseIndex: record.baseIndex, minionUid: record.minionUid };
}

function getWizardCardChoice(value: unknown): WizardCardChoiceValue | null {
    if (typeof value !== 'object' || value === null) return null;
    const record = value as { cardUid?: unknown; defId?: unknown };
    if (typeof record.cardUid !== 'string' || typeof record.defId !== 'string') return null;
    return { cardUid: record.cardUid, defId: record.defId };
}

function getWizardSelectedCardUids(value: unknown): string[] {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    return selected
        .map((item) => (typeof item === 'object' && item !== null ? (item as { cardUid?: unknown }).cardUid : undefined))
        .filter((cardUid): cardUid is string => typeof cardUid === 'string');
}

function isWizardCancelChoice(value: unknown): value is { __cancel__: true } {
    return typeof value === 'object' && value !== null && '__cancel__' in value;
}

function buildWizardPortalPickOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    trackedTopCards: WizardPortalTopCard[],
): PromptOption<WizardCardChoiceValue>[] {
    return getCurrentDeckTopSnapshotCards(state, playerId, trackedTopCards)
        .filter((card) => card.type === 'minion')
        .map((card, index) => ({
            id: `minion-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            displayMode: 'card' as const,
        }));
}

function buildWizardSacrificeCandidates(
    state: SmashUpCore,
    playerId: PlayerId,
): WizardSacrificeCandidate[] {
    const candidates: WizardSacrificeCandidate[] = [];
    for (let index = 0; index < state.bases.length; index += 1) {
        for (const minion of state.bases[index].minions) {
            if (minion.controller !== playerId) continue;
            const power = getMinionPower(state, minion, index);
            const def = getCardDef(minion.defId) as MinionCardDef | undefined;
            const name = def?.name ?? minion.defId;
            const baseName = getBaseDef(state.bases[index].defId)?.name ?? `基地 ${index + 1}`;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                power,
                baseIndex: index,
                ownerId: minion.owner,
                label: `${name} (力量 ${power}) @ ${baseName}`,
            });
        }
    }
    return candidates;
}

function buildWizardSacrificeOptions(
    state: SmashUpCore,
    playerId: PlayerId,
    sourceDefId: string,
): PromptOption<WizardSacrificeChoiceValue>[] {
    return buildMinionTargetOptions(
        buildWizardSacrificeCandidates(state, playerId).map((candidate) => ({
            uid: candidate.uid,
            defId: candidate.defId,
            baseIndex: candidate.baseIndex,
            label: candidate.label,
        })),
        { state, sourcePlayerId: playerId, sourceDefId },
    ) as PromptOption<WizardSacrificeChoiceValue>[];
}

function ensureWizardMassTransferSource(context: WizardExternalActionContext): PlayerId {
    if (context.origin !== 'wizard_mass_enchantment' || !context.sourcePlayerId) {
        throw new Error(`wizard_mass_enchantment 缺少 sourcePlayerId: ${context.defId}`);
    }
    return context.sourcePlayerId;
}

function findWizardExternalActionSourceCard(
    state: SmashUpCore,
    context: WizardExternalActionContext,
) {
    if (context.origin === 'wizard_mass_enchantment') {
        return findCardInPlayerZone(
            state,
            ensureWizardMassTransferSource(context),
            'deck',
            context.cardUid,
            context.defId,
        );
    }
    return findCardInPlayerZone(state, context.playerId, 'deck', context.cardUid, context.defId);
}

function buildWizardExternalActionBaseOptions(
    context: WizardExternalActionContext,
): PromptOption<WizardBaseChoiceValue>[] {
    return buildBaseTargetOptions(
        getValidExternalActionBaseCandidates(
            context.matchState,
            context.playerId,
            context.defId,
            getExternalActionEffectiveHandSize(context.matchState, context.playerId),
        ),
        context.matchState.core,
    ) as PromptOption<WizardBaseChoiceValue>[];
}

function buildWizardExternalActionMinionOptions(
    context: WizardExternalActionContext,
): PromptOption<WizardMinionChoiceValue>[] {
    return getValidExternalActionMinionOptions(
        context.matchState,
        context.playerId,
        context.defId,
        getExternalActionEffectiveHandSize(context.matchState, context.playerId),
    ) as PromptOption<WizardMinionChoiceValue>[];
}

function getWizardExternalActionResolutionPlan(
    context: WizardExternalActionContext,
): 'invalid' | 'immediate' | 'base' | 'minion' {
    const cardDef = getCardDef(context.defId) as ActionCardDef | undefined;
    const playMode = getExternalActionPlayMode(cardDef);
    const effectiveHandSize = getExternalActionEffectiveHandSize(context.matchState, context.playerId);
    if (playMode === 'ongoing-base' || playMode === 'special-base' || playMode === 'standard-base') {
        return getValidExternalActionBaseCandidates(
            context.matchState,
            context.playerId,
            context.defId,
            effectiveHandSize,
        ).length > 0 ? 'base' : 'invalid';
    }
    if (playMode === 'ongoing-minion' || playMode === 'standard-minion') {
        return getValidExternalActionMinionOptions(
            context.matchState,
            context.playerId,
            context.defId,
            effectiveHandSize,
        ).length > 0 ? 'minion' : 'invalid';
    }
    return validateActionPlaySemantics(context.matchState.core, context.playerId, {
        defId: context.defId,
        effectiveHandSize,
    }).valid ? 'immediate' : 'invalid';
}

function buildWizardExternalActionSetupEvents(
    context: WizardExternalActionContext,
    playMode: ExternalActionPlayMode,
    timestamp: number,
): SmashUpEvent[] {
    if (context.origin === 'wizard_mass_enchantment') {
        const sourcePlayerId = ensureWizardMassTransferSource(context);
        return [createCardTransferEvent({
            card: createCardObjectRef({
                uid: context.cardUid,
                defId: context.defId,
                ownerId: sourcePlayerId,
            }),
            fromPlayerId: sourcePlayerId,
            toPlayerId: context.playerId,
            reason: 'wizard_mass_enchantment',
            timestamp,
        }) as SmashUpEvent];
    }
    if (playMode === 'ongoing-base' || playMode === 'ongoing-minion') {
        return [{
            type: SU_EVENTS.CARD_REMOVED_FROM_DECK,
            payload: { playerId: context.playerId, cardUid: context.cardUid, defId: context.defId, reason: 'wizard_neophyte' },
            timestamp,
        } as SmashUpEvent];
    }
    return [{
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: context.playerId, count: 1, cardUids: [context.cardUid] },
        timestamp,
    } as SmashUpEvent];
}

function resolveWizardExternalActionPlay(params: {
    context: WizardExternalActionContext;
    random: AbilityContext['random'];
    timestamp: number;
    targetBaseIndex?: number;
    targetMinionUid?: string;
}): { events: SmashUpEvent[]; matchState: MatchState<SmashUpCore> } {
    const { context, random, timestamp, targetBaseIndex, targetMinionUid } = params;
    const sourceCard = findWizardExternalActionSourceCard(context.matchState.core, context);
    if (!sourceCard) {
        return { events: [], matchState: context.matchState };
    }

    const cardDef = getCardDef(context.defId) as ActionCardDef | undefined;
    const playMode = getExternalActionPlayMode(cardDef);
    const effectiveHandSize = getExternalActionEffectiveHandSize(context.matchState, context.playerId);
    const validation = validateActionPlaySemantics(context.matchState.core, context.playerId, {
        defId: context.defId,
        targetBaseIndex,
        targetMinionUid,
        effectiveHandSize,
    });
    if (!validation.valid) {
        return { events: [], matchState: context.matchState };
    }

    const events = buildWizardExternalActionSetupEvents(context, playMode, timestamp);
    events.push(buildActionPlayedEvent({
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        ownerId: sourceCard.owner,
        isExtraAction: true,
        ...(typeof targetBaseIndex === 'number' ? { targetBaseIndex } : {}),
        ...(targetMinionUid ? { targetMinionUid } : {}),
        timestamp,
    }));

    if (playMode === 'ongoing-base' || playMode === 'ongoing-minion') {
        if (typeof targetBaseIndex !== 'number') {
            return { events: [], matchState: context.matchState };
        }
        if (playMode === 'ongoing-minion' && !targetMinionUid) {
            return { events: [], matchState: context.matchState };
        }
        events.push(...buildSemanticOngoingAttachEvents(context.matchState, {
            cardUid: context.cardUid,
            defId: context.defId,
            ownerId: sourceCard.owner,
            ...(sourceCard.owner !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
            targetBaseIndex,
            ...(targetMinionUid ? { targetMinionUid } : {}),
            onBlockedSourceDestination: 'discard',
            now: timestamp,
        }));
    }

    const appended = appendResolvedActionAbility({
        state: context.matchState,
        events,
        playerId: context.playerId,
        cardUid: context.cardUid,
        defId: context.defId,
        random,
        timestamp,
        baseIndex: typeof targetBaseIndex === 'number' ? targetBaseIndex : 0,
        targetMinionUid,
        handSizeAfterPlay: context.matchState.core.players[context.playerId]?.hand.length ?? 0,
    });
    return {
        events: appended.events,
        matchState: appended.state,
    };
}

function attachContinuationData<T>(
    interaction: InteractionDescriptor<T>,
    continuationContext: Record<string, unknown>,
): InteractionDescriptor<T> {
    return {
        ...interaction,
        data: {
            ...(interaction.data ?? {}),
            continuationContext,
        },
    };
}

function createWizardNeophyteContext(ctx: AbilityContext): WizardNeophyteContext {
    const topCard = ctx.state.players[ctx.playerId]?.deck[0];
    return {
        ...createWizardPromptContext(ctx),
        playedCardUid: ctx.cardUid,
        ...(topCard ? {
            topCard: {
                uid: topCard.uid,
                defId: topCard.defId,
                type: topCard.type,
                name: getCardDef(topCard.defId)?.name ?? topCard.defId,
            },
        } : {}),
    };
}

function createWizardMassEnchantmentContext(ctx: AbilityContext): WizardMassEnchantmentContext {
    const candidates: WizardMassEnchantmentCandidate[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const topCard = ctx.state.players[pid]?.deck[0];
        if (!topCard || topCard.type !== 'action') continue;
        const name = getCardDef(topCard.defId)?.name ?? topCard.defId;
        candidates.push({ uid: topCard.uid, defId: topCard.defId, pid, label: `${name}（来自${getOpponentLabel(pid)}）` });
    }
    return {
        ...createWizardPromptContext(ctx),
        candidates,
    };
}

function createWizardPortalContext(ctx: AbilityContext): WizardPortalContext {
    return {
        ...createWizardPromptContext(ctx),
        topCards: (ctx.state.players[ctx.playerId]?.deck ?? []).slice(0, 5).map((card) => ({
            uid: card.uid,
            defId: card.defId,
            type: card.type,
        })),
    };
}

function createWizardScryContext(ctx: AbilityContext): WizardPromptContext {
    return createWizardPromptContext(ctx);
}

function createWizardSacrificeContext(ctx: AbilityContext): WizardPromptContext {
    return createWizardPromptContext(ctx);
}

const wizardNeophyteChooseBasePromptProgram = createPromptProgram<WizardExternalActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_neophyte_choose_base',
    buildInteraction: (context) => attachOptionsGenerator(
        attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_neophyte_choose_base_${context.now}`,
                context.playerId,
                `选择「${context.cardName}」的目标基地`,
                buildWizardExternalActionBaseOptions(context),
                { sourceId: 'wizard_neophyte_choose_base', targetType: 'base', displayCard: { defId: context.defId } },
            ),
            { cardUid: context.cardUid, defId: context.defId },
        ),
        (nextState) => buildWizardExternalActionBaseOptions({ ...context, matchState: { ...context.matchState, core: nextState.core } }),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardBaseChoice(value);
        if (!choice) return { events: [], matchState: state };
        return resolveWizardExternalActionPlay({
            context: { ...context, matchState: state, now: timestamp },
            random,
            timestamp,
            targetBaseIndex: choice.baseIndex,
        });
    },
});

const wizardNeophyteChooseMinionPromptProgram = createPromptProgram<WizardExternalActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_neophyte_choose_minion',
    buildInteraction: (context) => attachOptionsGenerator(
        attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_neophyte_choose_minion_${context.now}`,
                context.playerId,
                `选择「${context.cardName}」的目标随从`,
                buildWizardExternalActionMinionOptions(context),
                { sourceId: 'wizard_neophyte_choose_minion', targetType: 'minion', displayCard: { defId: context.defId } },
            ),
            { cardUid: context.cardUid, defId: context.defId },
        ),
        (nextState) => buildWizardExternalActionMinionOptions({ ...context, matchState: { ...context.matchState, core: nextState.core } }),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardMinionChoice(value);
        if (!choice) return { events: [], matchState: state };
        return resolveWizardExternalActionPlay({
            context: { ...context, matchState: state, now: timestamp },
            random,
            timestamp,
            targetBaseIndex: choice.baseIndex,
            targetMinionUid: choice.minionUid,
        });
    },
});

const wizardMassEnchantmentChooseBasePromptProgram = createPromptProgram<WizardExternalActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_mass_enchantment_choose_base',
    buildInteraction: (context) => attachOptionsGenerator(
        attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_mass_enchantment_choose_base_${context.now}`,
                context.playerId,
                `选择「${context.cardName}」的目标基地`,
                buildWizardExternalActionBaseOptions(context),
                { sourceId: 'wizard_mass_enchantment_choose_base', targetType: 'base', displayCard: { defId: context.defId } },
            ),
            { cardUid: context.cardUid, defId: context.defId, ...(context.sourcePlayerId ? { pid: context.sourcePlayerId } : {}) },
        ),
        (nextState) => buildWizardExternalActionBaseOptions({ ...context, matchState: { ...context.matchState, core: nextState.core } }),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardBaseChoice(value);
        if (!choice) return { events: [], matchState: state };
        return resolveWizardExternalActionPlay({
            context: { ...context, matchState: state, now: timestamp },
            random,
            timestamp,
            targetBaseIndex: choice.baseIndex,
        });
    },
});

const wizardMassEnchantmentChooseMinionPromptProgram = createPromptProgram<WizardExternalActionContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_mass_enchantment_choose_minion',
    buildInteraction: (context) => attachOptionsGenerator(
        attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_mass_enchantment_choose_minion_${context.now}`,
                context.playerId,
                `选择「${context.cardName}」的目标随从`,
                buildWizardExternalActionMinionOptions(context),
                { sourceId: 'wizard_mass_enchantment_choose_minion', targetType: 'minion', displayCard: { defId: context.defId } },
            ),
            { cardUid: context.cardUid, defId: context.defId, ...(context.sourcePlayerId ? { pid: context.sourcePlayerId } : {}) },
        ),
        (nextState) => buildWizardExternalActionMinionOptions({ ...context, matchState: { ...context.matchState, core: nextState.core } }),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardMinionChoice(value);
        if (!choice) return { events: [], matchState: state };
        return resolveWizardExternalActionPlay({
            context: { ...context, matchState: state, now: timestamp },
            random,
            timestamp,
            targetBaseIndex: choice.baseIndex,
            targetMinionUid: choice.minionUid,
        });
    },
});

const wizardNeophytePromptProgram = createPromptProgram<WizardNeophyteContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_neophyte',
    buildInteraction: (context) => {
        const topCard = context.topCard;
        if (!topCard) {
            throw new Error('wizard_neophyte prompt 缺少 topCard');
        }
        const effectiveHandSize = getExternalActionEffectiveHandSize(context.matchState, context.playerId);
        const options: PromptOption<WizardActionChoiceValue>[] = [
            {
                id: 'to_hand',
                label: '放入手牌',
                labelKey: 'ui.wizard_neophyte_to_hand_option',
                value: { action: 'to_hand' },
                displayMode: 'button',
            },
        ];
        if (canPlayExternalAction(context.matchState, context.playerId, topCard.defId, effectiveHandSize)) {
            options.push({
                id: 'play_extra',
                label: '作为额外行动打出',
                labelKey: 'ui.wizard_neophyte_play_extra_option',
                value: { action: 'play_extra' },
                displayMode: 'button',
            });
        }
        return attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_neophyte_${context.now}`,
                context.playerId,
                `牌库顶是行动卡「${topCard.name}」，选择处理方式`,
                options,
                { sourceId: 'wizard_neophyte', targetType: 'button', displayCard: { defId: topCard.defId } },
            ),
            { cardUid: topCard.uid, defId: topCard.defId },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const action = getWizardActionChoice(value);
        const topCard = context.topCard;
        if (!action || !topCard) return { events: [], matchState: state };
        const deckCard = findCardInPlayerZone(state.core, context.playerId, 'deck', topCard.uid, topCard.defId);
        if (!deckCard) return { events: [], matchState: state };
        if (action === 'to_hand') {
            return {
                events: [{
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: context.playerId, count: 1, cardUids: [topCard.uid] },
                    timestamp,
                } as SmashUpEvent],
                matchState: state,
            };
        }
        const playContext: WizardExternalActionContext = {
            matchState: state,
            playerId: context.playerId,
            now: timestamp,
            random: context.random,
            sourceDefId: context.sourceDefId,
            cardUid: topCard.uid,
            defId: topCard.defId,
            cardName: topCard.name,
            origin: 'wizard_neophyte',
        };
        const resolutionPlan = getWizardExternalActionResolutionPlan(playContext);
        if (resolutionPlan === 'invalid') return { events: [], matchState: state };
        if (resolutionPlan === 'immediate') {
            return resolveWizardExternalActionPlay({ context: playContext, random, timestamp });
        }
        return {
            events: [],
            matchState: state,
            context: playContext,
            nextProgram: resolutionPlan === 'base'
                ? wizardNeophyteChooseBasePromptProgram
                : wizardNeophyteChooseMinionPromptProgram,
        };
    },
});

const wizardMassEnchantmentPromptProgram = createPromptProgram<WizardMassEnchantmentContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_mass_enchantment',
    buildInteraction: (context) => attachOptionsGenerator(
        attachContinuationData(
            createAbilityRuntimeSimpleChoice(
                `wizard_mass_enchantment_${context.now}`,
                context.playerId,
                '选择一张行动卡作为额外行动打出',
                buildWizardMassEnchantmentOptions(context.matchState.core, context.candidates),
                {
                    sourceId: 'wizard_mass_enchantment',
                    targetType: 'generic',
                    responseValidationMode: 'live',
                    titleKey: 'ui.wizard_mass_enchantment_title',
                },
            ),
            { candidates: context.candidates },
        ),
        (nextState, interactionData) => buildWizardMassEnchantmentOptions(
            nextState.core,
            ((interactionData?.continuationContext as { candidates?: WizardMassEnchantmentCandidate[] } | undefined)?.candidates) ?? context.candidates,
        ),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardMassChoice(value);
        if (!choice) return { events: [], matchState: state };
        const validChoice = buildWizardMassEnchantmentOptions(state.core, context.candidates)
            .find((option) => {
                const candidate = option.value as WizardMassChoiceValue;
                return candidate.cardUid === choice.cardUid && candidate.defId === choice.defId && candidate.pid === choice.pid;
            });
        if (!validChoice) return { events: [], matchState: state };
        const playContext: WizardExternalActionContext = {
            matchState: state,
            playerId: context.playerId,
            now: timestamp,
            random: context.random,
            sourceDefId: context.sourceDefId,
            cardUid: choice.cardUid,
            defId: choice.defId,
            cardName: getCardDef(choice.defId)?.name ?? choice.defId,
            origin: 'wizard_mass_enchantment',
            sourcePlayerId: choice.pid,
        };
        const resolutionPlan = getWizardExternalActionResolutionPlan(playContext);
        if (resolutionPlan === 'invalid') return { events: [], matchState: state };
        if (resolutionPlan === 'immediate') {
            return resolveWizardExternalActionPlay({ context: playContext, random, timestamp });
        }
        return {
            events: [],
            matchState: state,
            context: playContext,
            nextProgram: resolutionPlan === 'base'
                ? wizardMassEnchantmentChooseBasePromptProgram
                : wizardMassEnchantmentChooseMinionPromptProgram,
        };
    },
});

const wizardPortalPickPromptProgram = createPromptProgram<WizardPortalContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_portal_pick',
    buildInteraction: (context) => {
        const options = buildWizardPortalPickOptions(context.matchState.core, context.playerId, context.topCards);
        return attachOptionsGenerator(
            attachContinuationData(
                createAbilityRuntimeSimpleChoice(
                    `wizard_portal_pick_${context.now}`,
                    context.playerId,
                    '传送：选择要放入手牌的随从（可以不选）',
                    options,
                    {
                        sourceId: 'wizard_portal_pick',
                        targetType: 'hand',
                        multi: { min: 0, max: options.length },
                        titleKey: 'ui.wizard_portal_pick_title',
                    },
                ),
                { allTopCards: context.topCards },
            ),
            (nextState) => buildWizardPortalPickOptions(nextState.core, context.playerId, context.topCards),
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const currentTopCards = getCurrentDeckTopSnapshotCards(state.core, context.playerId, context.topCards);
        const currentTopCardUids = new Set(currentTopCards.map((card) => card.uid));
        const validPickedUids = getWizardSelectedCardUids(value).filter((uid) => currentTopCardUids.has(uid));
        const validPickedUidSet = new Set(validPickedUids);
        const events: SmashUpEvent[] = [];
        if (validPickedUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: validPickedUids.length, cardUids: validPickedUids },
                timestamp,
            } as CardsDrawnEvent);
        }
        const remaining = currentTopCards
            .filter((card) => !validPickedUidSet.has(card.uid))
            .map((card) => ({ uid: card.uid, defId: card.defId }));
        if (remaining.length === 0) {
            return { events, matchState: state };
        }
        if (remaining.length === 1) {
            return {
                events: [
                    ...events,
                    buildWizardPortalReturnToDeckTopEvent(state.core, context.playerId, remaining[0].uid, remaining[0].defId, timestamp),
                ],
                matchState: state,
            };
        }
        return {
            events,
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                orderContext: {
                    remaining,
                    ordered: [],
                    trackedAll: currentTopCards.map((card) => ({ uid: card.uid, defId: card.defId })),
                    pickedToHandUids: validPickedUids,
                },
            } as WizardPortalOrderPromptContext,
            nextProgram: wizardPortalOrderPromptProgram,
        };
    },
});

const wizardPortalOrderPromptProgram = createPromptProgram<WizardPortalOrderPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_portal_order',
    buildInteraction: (context) => {
        const snapshot = resolveWizardPortalOrderSnapshot(context.matchState.core, context.playerId, context.orderContext);
        const title = snapshot.ordered.length === 0
            ? '传送：选择放回牌库顶的第一张牌（最先选的在最上面）'
            : `传送：选择下一张放回牌库顶的牌（已选 ${snapshot.ordered.length} 张）`;
        return attachOptionsGenerator(
            attachContinuationData(
                createAbilityRuntimeSimpleChoice(
                    `wizard_portal_order_${context.now}`,
                    context.playerId,
                    title,
                    buildWizardPortalOrderCardOptions(snapshot.remaining),
                    { sourceId: 'wizard_portal_order', targetType: 'generic', responseValidationMode: 'live' },
                ),
                context.orderContext as unknown as Record<string, unknown>,
            ),
            (nextState, interactionData) => buildWizardPortalOrderOptions(
                nextState.core,
                context.playerId,
                (interactionData?.continuationContext as WizardPortalOrderContext | undefined) ?? context.orderContext,
            ),
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = getWizardCardChoice(value);
        if (!choice) return { events: [], matchState: state };
        const snapshot = resolveWizardPortalOrderSnapshot(state.core, context.playerId, context.orderContext);
        const selectedCard = snapshot.remaining.find((card) => card.uid === choice.cardUid && card.defId === choice.defId);
        if (!selectedCard) return { events: [], matchState: state };
        const ordered = [...snapshot.ordered, { uid: selectedCard.uid, defId: selectedCard.defId }];
        const remaining = snapshot.remaining.filter((card) => card.uid !== selectedCard.uid);
        if (remaining.length <= 1) {
            const allCards = remaining.length === 1 ? [...ordered, remaining[0]] : ordered;
            const events: SmashUpEvent[] = [];
            for (let index = allCards.length - 1; index >= 0; index -= 1) {
                events.push(buildWizardPortalReturnToDeckTopEvent(
                    state.core,
                    context.playerId,
                    allCards[index].uid,
                    allCards[index].defId,
                    timestamp,
                ));
            }
            return { events, matchState: state };
        }
        return {
            events: [],
            matchState: state,
            context: {
                ...context,
                matchState: state,
                now: timestamp,
                orderContext: {
                    remaining,
                    ordered,
                    trackedAll: context.orderContext.trackedAll,
                    pickedToHandUids: context.orderContext.pickedToHandUids,
                },
            },
            nextProgram: wizardPortalOrderPromptProgram,
        };
    },
});

const wizardScryPromptProgram = createPromptProgram<WizardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_scry',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `wizard_scry_${context.now}`,
            context.playerId,
            '占卜：选择一张行动卡放入手牌',
            buildWizardScryOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'wizard_scry',
                targetType: 'generic',
                autoRefresh: 'deck',
                responseValidationMode: 'live',
                titleKey: 'ui.wizard_scry_title',
            },
        ),
        (nextState) => buildWizardScryOptions(nextState.core, context.playerId),
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const choice = getWizardCardChoice(value);
        if (!choice) return { events: [], matchState: state };
        const player = state.core.players[context.playerId];
        const selectedCard = findCardInPlayerZone(state.core, context.playerId, 'deck', choice.cardUid, choice.defId);
        if (!player || !selectedCard || selectedCard.type !== 'action') {
            return { events: [], matchState: state };
        }
        const remainingDeck = player.deck.filter((card) => card.uid !== choice.cardUid);
        const shuffled = random.shuffle([...remainingDeck]);
        return {
            events: [
                {
                    type: SU_EVENTS.REVEAL_HAND,
                    payload: {
                        targetPlayerId: context.playerId,
                        viewerPlayerId: 'all',
                        cards: [{ uid: choice.cardUid, defId: choice.defId }],
                        sourcePlayerId: context.playerId,
                        reason: 'wizard_scry',
                    },
                    timestamp,
                } as SmashUpEvent,
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId: context.playerId, count: 1, cardUids: [choice.cardUid] },
                    timestamp,
                } as SmashUpEvent,
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId: context.playerId, deckUids: shuffled.map((card) => card.uid) },
                    timestamp,
                } as DeckReorderedEvent,
            ],
            matchState: state,
        };
    },
});

const wizardSacrificePromptProgram = createPromptProgram<WizardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'wizard_sacrifice',
    buildInteraction: (context) => attachOptionsGenerator(
        createAbilityRuntimeSimpleChoice(
            `wizard_sacrifice_${context.now}`,
            context.playerId,
            '选择要牺牲的随从（抽取等量力量的牌）',
            buildWizardSacrificeOptions(context.matchState.core, context.playerId, context.sourceDefId),
            {
                sourceId: 'wizard_sacrifice',
                targetType: 'minion',
                autoCancelOption: true,
                titleKey: 'ui.wizard_sacrifice_title',
            },
        ),
        (nextState) => buildWizardSacrificeOptions(nextState.core, context.playerId, context.sourceDefId),
    ),
    onResolve: (args) => {
        const { context, state, value, timestamp } = args;
        if (isWizardCancelChoice(value)) {
            return { events: [], matchState: state };
        }
        const choice = getWizardMinionChoice(value);
        if (!choice) return { events: [], matchState: state };
        const minion = state.core.bases[choice.baseIndex]?.minions.find((candidate) => candidate.uid === choice.minionUid);
        if (!minion || minion.controller !== context.playerId) {
            return { events: [], matchState: state };
        }
        const power = getMinionPower(state.core, minion, choice.baseIndex);
        const events: SmashUpEvent[] = [];
        if (power > 0) {
            events.push(...buildStandardDrawEventsFromRuntimeContext(args, context.playerId, power));
        }
        events.push(...buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: choice.baseIndex,
            destroyerId: context.playerId,
            reason: 'wizard_sacrifice',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: 'wizard_sacrifice',
            sourceControllerId: context.playerId,
            sourceKind: 'action',
        }));
        return { events, matchState: state };
    },
});

const wizardNeophyteProgram = createEffectProgram<WizardNeophyteContext, SmashUpCore, SmashUpEvent>((context) => {
    let topCard = context.topCard;
    const events: SmashUpEvent[] = [];
    if (!topCard) {
        const peek = peekDeckTop(
            context.matchState.core,
            context.random,
            context.playerId,
            'all',
            'wizard_neophyte',
            context.now,
            context.playerId,
        );
        if (!peek) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.deck_empty', context.now)] };
        }
        events.push(...peek.events);
        topCard = {
            uid: peek.card.uid,
            defId: peek.card.defId,
            type: peek.card.type,
            name: getCardDef(peek.card.defId)?.name ?? peek.card.defId,
        };
    }
    if (context.topCard) {
        events.push(revealDeckTop(
            context.playerId,
            'all',
            [{ uid: topCard.uid, defId: topCard.defId }],
            1,
            'wizard_neophyte',
            context.now,
            context.playerId,
        ));
    }
    if (topCard.type !== 'action') {
        return { events };
    }
    return {
        events,
        context: { ...context, topCard },
        nextProgram: wizardNeophytePromptProgram,
    };
});

const wizardMassEnchantmentProgram = createEffectProgram<WizardMassEnchantmentContext, SmashUpCore, SmashUpEvent>((context) => {
    const events: SmashUpEvent[] = [];
    for (const pid of context.matchState.core.turnOrder) {
        if (pid === context.playerId) continue;
        const topCard = context.matchState.core.players[pid]?.deck[0];
        if (!topCard) continue;
        events.push(revealDeckTop(
            pid,
            'all',
            [{ uid: topCard.uid, defId: topCard.defId }],
            1,
            'wizard_mass_enchantment',
            context.now,
            context.playerId,
        ));
    }
    if (context.candidates.length === 0) {
        return { events };
    }
    return {
        events,
        nextProgram: wizardMassEnchantmentPromptProgram,
    };
});

const wizardPortalProgram = createEffectProgram<WizardPortalContext, SmashUpCore, SmashUpEvent>((context) => {
    if (context.topCards.length === 0) {
        return { events: [buildAbilityFeedback(context.playerId, 'feedback.deck_empty', context.now)] };
    }
    const revealEvent = revealDeckTop(
        context.playerId,
        'all',
        context.topCards.map((card) => ({ uid: card.uid, defId: card.defId })),
        context.topCards.length,
        'wizard_portal',
        context.now,
        context.playerId,
    );
    const minionOptions = buildWizardPortalPickOptions(context.matchState.core, context.playerId, context.topCards);
    if (minionOptions.length > 0) {
        return {
            events: [revealEvent],
            nextProgram: wizardPortalPickPromptProgram,
        };
    }
    const remaining = context.topCards.map((card) => ({ uid: card.uid, defId: card.defId }));
    if (remaining.length === 1) {
        return {
            events: [
                revealEvent,
                buildWizardPortalReturnToDeckTopEvent(
                    context.matchState.core,
                    context.playerId,
                    remaining[0].uid,
                    remaining[0].defId,
                    context.now,
                ),
            ],
        };
    }
    return {
        events: [revealEvent],
        context: {
            ...context,
            orderContext: { remaining, ordered: [] },
        } as WizardPortalOrderPromptContext,
        nextProgram: wizardPortalOrderPromptProgram,
    };
});

const wizardScryProgram = createEffectProgram<WizardPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    const options = buildWizardScryOptions(context.matchState.core, context.playerId);
    if (options.length === 0) {
        const player = context.matchState.core.players[context.playerId];
        const shuffled = context.random.shuffle([...(player?.deck ?? [])]);
        return {
            events: [
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: { playerId: context.playerId, deckUids: shuffled.map((card) => card.uid) },
                    timestamp: context.now,
                } as DeckReorderedEvent,
                buildAbilityFeedback(context.playerId, 'feedback.deck_search_no_match', context.now),
            ],
        };
    }
    return {
        events: [],
        nextProgram: wizardScryPromptProgram,
    };
});

const wizardSacrificeProgram = createEffectProgram<WizardPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    if (buildWizardSacrificeCandidates(context.matchState.core, context.playerId).length === 0) {
        return { events: [] };
    }
    return {
        events: [],
        nextProgram: wizardSacrificePromptProgram,
    };
});

/** 注册巫师派系所有能力 */
export function registerWizardAbilities(): void {
    const abilities: Array<[string, (ctx: AbilityContext) => AbilityResult]> = [
        ['wizard_chronomage', wizardChronomage],
        ['wizard_enchantress', wizardEnchantress],
        ['wizard_mystic_studies', wizardMysticStudies],
        ['wizard_summon', wizardSummon],
        ['wizard_time_loop', wizardTimeLoop],
        ['wizard_winds_of_change', wizardWindsOfChange],
        ['wizard_archmage_pod', wizardArchmagePodTalent],
    ];

    for (const [id, handler] of abilities) {
        const timing = id === 'wizard_archmage_pod' ? 'talent' : 'onPlay';
        registerSimpleAbility(id, timing, handler);
    }

    registerAbilityProgram('wizard_neophyte', 'onPlay', {
        program: wizardNeophyteProgram,
        createContext: createWizardNeophyteContext,
    });
    registerAbilityProgram('wizard_mass_enchantment', 'onPlay', {
        program: wizardMassEnchantmentProgram,
        createContext: createWizardMassEnchantmentContext,
    });
    registerAbilityProgram('wizard_portal', 'onPlay', {
        program: wizardPortalProgram,
        createContext: createWizardPortalContext,
    });
    registerAbilityProgram('wizard_scry', 'onPlay', {
        program: wizardScryProgram,
        createContext: createWizardScryContext,
    });
    registerAbilityProgram('wizard_sacrifice', 'onPlay', {
        program: wizardSacrificeProgram,
        createContext: createWizardSacrificeContext,
    });

    registerWizardOngoingEffects();
}

/** 变化之风 onPlay：洗手牌回牌库抽5张，额外打出一个行动*/
function wizardWindsOfChange(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // 1. 手牌洗入牌库
    // 注意：当前打出的行动卡（ctx.cardUid）会?ACTION_PLAYED reducer 从手牌移除，
    // 所以这里排除它
    const remainingHand = player.hand.filter(c => c.uid !== ctx.cardUid);
    const allCards = [...remainingHand, ...player.deck];
    const shuffled = ctx.random.shuffle([...allCards]);
    events.push(shuffleHandIntoDeck(
        ctx.playerId,
        shuffled.map(c => c.uid),
        'wizard_winds_of_change',
        ctx.now
    ));

    // 2. ?张牌（基于洗牌后的牌库）
    const drawCount = Math.min(5, shuffled.length);
    if (drawCount > 0) {
        const drawnUids = shuffled.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 3. 额外打出一个行动
    events.push(grantContextualExtraAction(ctx, 'wizard_winds_of_change'));

    return { events };
}

// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册巫师派系?ongoing 拦截?*/
function registerWizardOngoingEffects(): void {
    // 大法师：打出当回合也给予额外行动（官方 FAQ 明确说明）
    // "You get the extra action on each of your turns, including the one when Archmage is played."
    registerTrigger('wizard_archmage', 'onMinionPlayed', (trigCtx) => {
        // 只有打出的是大法师本身时才触发
        if (trigCtx.triggerMinionDefId !== 'wizard_archmage') return [];
        // 只在控制者的回合触发（打出者就是控制者）
        return [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: trigCtx.playerId,
                limitType: 'action' as const,
                delta: 1,
                reason: trigCtx.triggerMinionDefId,
                playTiming: resolveExtraPlayTiming(trigCtx.matchState),
            },
            timestamp: trigCtx.now,
        }];
    }, {
        canTrigger: (ctx) => ctx.triggerMinionDefId === 'wizard_archmage',
    });
}
