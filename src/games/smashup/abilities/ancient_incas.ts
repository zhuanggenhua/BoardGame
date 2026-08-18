import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility, resolveOnPlay } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraAction,
    inspectDeck,
    revealDeckTop,
    shuffleBaseDeck,
} from '../domain/abilityHelpers';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import { registerBasePowerModifier, registerCustomBreakpointModifiers } from '../domain/ongoingModifiers';
import type {
    BaseMetadataUpdatedEvent,
    CardInstance,
    CardTransferredEvent,
    DeckReorderedEvent,
    MinionMetadataUpdatedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type CardZone = 'hand' | 'deck' | 'discard';

type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    zone?: CardZone;
    baseIndex?: number;
    sourceBaseIndex?: number;
    skip?: boolean;
};

type MinionChoice = {
    minionUid?: string;
    minionDefId?: string;
    defId?: string;
    baseIndex?: number;
    skip?: boolean;
};

type MoveChoice = {
    minionUid?: string;
    minionDefId?: string;
    fromBaseIndex?: number;
    toBaseIndex?: number;
    skip?: boolean;
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(core: SmashUpCore, baseIndex: number): string {
    const defId = core.bases[baseIndex]?.defId;
    return getBaseDef(defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function cardTransferredToSelf(
    card: CardInstance | { uid: string; defId: string; owner: PlayerId },
    playerId: PlayerId,
    reason: string,
    now: number,
): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId: playerId,
            toPlayerId: playerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    };
}

function deckReordered(playerId: PlayerId, deckCards: CardInstance[], random: RandomFn, reason: string, now: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: random.shuffle(deckCards).map(card => card.uid) },
        timestamp: now,
    };
}

function baseMetadataUpdated(
    core: SmashUpCore,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): BaseMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            baseInstanceId: core.bases[baseIndex]?.instanceId,
            metadataUpdate,
            reason,
        },
        timestamp: now,
    };
}

function minionMetadataUpdated(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function getOngoingController(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined)
        ?? (action.metadata?.sourcePlayerId as PlayerId | undefined)
        ?? action.ownerId;
}

function isActionPlayableOnBase(card: CardInstance): boolean {
    const def = getCardDef(card.defId);
    if (!def || def.type !== 'action') return false;
    if (def.subtype === 'special') return false;
    return def.playNeedsBase === true
        || def.ongoingTarget === 'base'
        || def.subtype === 'ongoing';
}

function isOngoingBaseAction(card: CardInstance | { defId: string }): boolean {
    const def = getCardDef(card.defId);
    return Boolean(
        def
        && def.type === 'action'
        && def.subtype === 'ongoing'
        && (def.ongoingTarget === 'base' || def.playNeedsBase === true),
    );
}

function findPlayerZoneCard(core: SmashUpCore, playerId: PlayerId, selected: CardChoice | undefined): CardInstance | undefined {
    if (!selected?.cardUid || !selected.defId || !selected.zone) return undefined;
    const player = core.players[playerId];
    if (!player) return undefined;
    const zoneCards = selected.zone === 'hand'
        ? player.hand
        : selected.zone === 'deck'
            ? player.deck
            : player.discard;
    return zoneCards.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
}

function collectDiscardBaseActions(core: SmashUpCore, playerId: PlayerId): Array<CardInstance & { zone: 'discard' }> {
    return (core.players[playerId]?.discard ?? [])
        .filter(isActionPlayableOnBase)
        .map(card => ({ ...card, zone: 'discard' as const }));
}

function collectSearchBaseActions(core: SmashUpCore, playerId: PlayerId): Array<CardInstance & { zone: CardZone }> {
    const player = core.players[playerId];
    if (!player) return [];
    return [
        ...player.deck.map(card => ({ ...card, zone: 'deck' as const })),
        ...player.discard.map(card => ({ ...card, zone: 'discard' as const })),
    ].filter(isActionPlayableOnBase);
}

function collectOwnBaseActions(core: SmashUpCore, playerId: PlayerId, options?: { excludeBaseIndex?: number; onlyBaseIndex?: number }): CardChoice[] {
    return core.bases.flatMap((base, baseIndex) => {
        if (options?.excludeBaseIndex !== undefined && baseIndex === options.excludeBaseIndex) return [];
        if (options?.onlyBaseIndex !== undefined && baseIndex !== options.onlyBaseIndex) return [];
        return base.ongoingActions
            .filter(action => getOngoingController(action) === playerId)
            .map(action => ({
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                sourceBaseIndex: baseIndex,
            }));
    });
}

function buildCardOptions(core: SmashUpCore, cards: Array<CardInstance & { zone: CardZone }>) {
    return cards.flatMap((card, cardIndex) => (
        core.bases.map((_base, baseIndex) => {
            const zoneLabel = card.zone === 'deck' ? '牌库' : card.zone === 'discard' ? '弃牌堆' : '手牌';
            return {
                id: `card-${cardIndex}-base-${baseIndex}`,
                label: `${cardLabel(card.defId)}（${zoneLabel}）：打到${baseLabel(core, baseIndex)}`,
                value: {
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: card.owner,
                    zone: card.zone,
                    baseIndex,
                } satisfies CardChoice,
                displayMode: 'card' as const,
            };
        })
    ));
}

function buildPlayBaseActionResult(params: {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    card: CardInstance;
    zone: CardZone;
    baseIndex: number;
    reason: string;
    random: RandomFn;
    now: number;
}): { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const events: SmashUpEvent[] = [
        buildActionPlayedEvent({
            playerId: params.playerId,
            cardUid: params.card.uid,
            defId: params.card.defId,
            ownerId: params.card.owner,
            isExtraAction: true,
            fromDiscard: params.zone === 'discard',
            targetBaseIndex: params.baseIndex,
            timestamp: params.now,
        }),
    ];

    if (isOngoingBaseAction(params.card)) {
        events.push(...buildSemanticOngoingAttachEvents(params.matchState, {
            cardUid: params.card.uid,
            defId: params.card.defId,
            ownerId: params.card.owner,
            sourcePlayerId: params.playerId,
            sourceKind: 'action',
            targetBaseIndex: params.baseIndex,
            removeFromDiscard: params.zone === 'discard',
            now: params.now,
        }));
    }

    const executor = resolveOnPlay(params.card.defId);
    if (!executor) return { events };

    const onPlay = executor({
        state: params.matchState.core,
        matchState: params.matchState,
        playerId: params.playerId,
        cardUid: params.card.uid,
        defId: params.card.defId,
        baseIndex: params.baseIndex,
        targetBaseIndex: params.baseIndex,
        random: params.random,
        now: params.now,
    });
    return {
        events: [...events, ...onPlay.events],
        ...(onPlay.matchState ? { matchState: onPlay.matchState } : {}),
    };
}

function queueCounterPrompt(params: {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    sourceId: string;
    title: string;
    baseIndex: number;
    now: number;
    optional?: boolean;
}): TriggerResult | AbilityResult {
    const base = params.matchState.core.bases[params.baseIndex];
    if (!base) return { events: [] };
    const candidates = base.minions
        .filter(minion => minion.controller === params.playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: params.baseIndex,
            label: cardLabel(minion.defId),
        }));
    if (candidates.length === 0) return { events: [] };
    if (candidates.length === 1 && !params.optional) {
        return {
            events: [addPowerCounter(candidates[0].uid, params.baseIndex, 1, params.sourceId, params.now, {
                sourcePlayerId: params.playerId,
                sourceDefId: params.sourceId,
                sourceBaseIndex: params.baseIndex,
            })],
        };
    }
    const options = [
        ...(params.optional ? [createSkipOption('不放置指示物', 'ui.ancient_incas_skip_place_counter_option')] : []),
        ...buildMinionTargetOptions(candidates, {
            state: params.matchState.core,
            sourcePlayerId: params.playerId,
            sourceDefId: params.sourceId,
            sourceKind: 'nonAction',
            semanticRole: 'reference',
            effectType: 'buff',
        }),
    ];
    const interaction = createSimpleChoice<MinionChoice>(
        `${params.sourceId}_${params.now}`,
        params.playerId,
        params.title,
        options,
        {
            sourceId: params.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(params.matchState, interaction) };
}

function queueRoyalHighwayMovePrompt(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    sourceBaseIndex: number,
    now: number,
    otherBaseIndex?: number,
): AbilityResult | TriggerResult {
    const options = collectRoyalHighwayMoves(matchState.core, playerId, sourceBaseIndex, otherBaseIndex);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MoveChoice>(
        `${sourceId}_${now}`,
        playerId,
        '皇家公路：选择一个己方随从移入或移出此基地',
        [
            createSkipOption('不移动随从', 'ui.ancient_incas_skip_move_minion_option'),
            ...options.map((move, index) => ({
                id: `move-${index}`,
                label: `${cardLabel(move.minionDefId ?? '')}：${baseLabel(matchState.core, move.fromBaseIndex ?? 0)} → ${baseLabel(matchState.core, move.toBaseIndex ?? 0)}`,
                value: move,
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function collectRoyalHighwayMoves(
    core: SmashUpCore,
    playerId: PlayerId,
    sourceBaseIndex: number,
    otherBaseIndex?: number,
): MoveChoice[] {
    const moves: MoveChoice[] = [];
    const allowedOtherBases = core.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== sourceBaseIndex)
        .filter(baseIndex => otherBaseIndex === undefined || baseIndex === otherBaseIndex);

    for (const toBaseIndex of allowedOtherBases) {
        for (const minion of core.bases[sourceBaseIndex]?.minions ?? []) {
            if (minion.controller !== playerId) continue;
            moves.push({
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: sourceBaseIndex,
                toBaseIndex,
            });
        }
    }

    for (const fromBaseIndex of allowedOtherBases) {
        for (const minion of core.bases[fromBaseIndex]?.minions ?? []) {
            if (minion.controller !== playerId) continue;
            moves.push({
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex,
                toBaseIndex: sourceBaseIndex,
            });
        }
    }

    return moves;
}

function quipuStrings(ctx: AbilityContext): AbilityResult {
    const cards = collectDiscardBaseActions(ctx.state, ctx.playerId);
    if (cards.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `ancient_incas_quipu_strings_${ctx.now}`,
        ctx.playerId,
        '结绳文字：从弃牌堆选择一个可打到基地的行动并额外打出',
        buildCardOptions(ctx.state, cards),
        {
            sourceId: 'ancient_incas_quipu_strings',
            targetType: 'card',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function llama(ctx: AbilityContext): AbilityResult {
    const options = collectOwnBaseActions(ctx.state, ctx.playerId, { excludeBaseIndex: ctx.baseIndex })
        .filter(option => isOngoingBaseAction({ defId: option.defId ?? '' }));
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `ancient_incas_llama_${ctx.now}`,
        ctx.playerId,
        `美洲驼：选择一个其它基地上的行动回手并额外打到${baseLabel(ctx.state, ctx.baseIndex)}`,
        [
            createSkipOption('不移动行动', 'ui.ancient_incas_skip_move_action_option'),
            ...options.map((option, index) => ({
                id: `action-${index}`,
                label: `${cardLabel(option.defId ?? '')} @ ${baseLabel(ctx.state, option.sourceBaseIndex ?? 0)}`,
                value: { ...option, baseIndex: ctx.baseIndex },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'ancient_incas_llama',
            targetType: 'generic',
            genericIntent: 'composite-context',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function incanEngineer(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return { events: [] };
    const foundIndex = player.deck.findIndex(isActionPlayableOnBase);
    const revealed = foundIndex >= 0 ? player.deck.slice(0, foundIndex + 1) : player.deck;
    const events: SmashUpEvent[] = [
        revealDeckTop(
            ctx.playerId,
            ctx.playerId,
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            revealed.length,
            'ancient_incas_incan_engineer',
            ctx.now,
            ctx.playerId,
        ),
        inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, 'ancient_incas_incan_engineer', ctx.now),
    ];
    if (foundIndex < 0) {
        events.push(deckReordered(ctx.playerId, player.deck, ctx.random, 'ancient_incas_incan_engineer', ctx.now));
        return { events };
    }
    const found = player.deck[foundIndex];
    events.push(cardTransferredToSelf(found, ctx.playerId, 'ancient_incas_incan_engineer', ctx.now));
    events.push(deckReordered(
        ctx.playerId,
        player.deck.filter(card => card.uid !== found.uid),
        ctx.random,
        'ancient_incas_incan_engineer',
        ctx.now,
    ));
    return { events };
}

function sapaInca(ctx: AbilityContext): AbilityResult {
    const cards = collectSearchBaseActions(ctx.state, ctx.playerId);
    if (cards.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `ancient_incas_sapa_inca_${ctx.now}`,
        ctx.playerId,
        '萨帕·印加：从牌库或弃牌堆选择一个可打到基地的行动加入手牌',
        cards.map((card, index) => {
            const zoneLabel = card.zone === 'deck' ? '牌库' : '弃牌堆';
            return {
                id: `card-${index}`,
                label: `${cardLabel(card.defId)}（${zoneLabel}）`,
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, zone: card.zone } satisfies CardChoice,
                displayMode: 'card' as const,
            };
        }),
        {
            sourceId: 'ancient_incas_sapa_inca',
            targetType: 'card',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return {
        events: cards.some(card => card.zone === 'deck')
            ? [inspectDeck(ctx.playerId, ctx.playerId, ctx.state.players[ctx.playerId]?.deck.length ?? 0, 'ancient_incas_sapa_inca', ctx.now)]
            : [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function fortressWalls(ctx: AbilityContext): AbilityResult {
    return queueCounterPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        sourceId: 'ancient_incas_fortress_walls',
        title: '防护墙：选择这里一个己方随从放置 +1 指示物',
        baseIndex: ctx.baseIndex,
        now: ctx.now,
    }) as AbilityResult;
}

function templeOfTheSun(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function signsInTheStars(ctx: AbilityContext): AbilityResult {
    const topBaseDefId = ctx.state.baseDeck?.[0];
    if (!topBaseDefId) return { events: [] };
    return {
        events: [baseMetadataUpdated(
            ctx.state,
            ctx.baseIndex,
            {
                signsInTheStarsFaceUpBaseDefId: topBaseDefId,
                signsInTheStarsRevealedTurn: ctx.state.turnNumber,
            },
            'ancient_incas_signs_in_the_stars',
            ctx.now,
        )],
    };
}

function signsInTheStarsTalent(ctx: AbilityContext): AbilityResult {
    const [top, ...rest] = ctx.state.baseDeck ?? [];
    if (!top) return { events: [] };
    return {
        events: [shuffleBaseDeck([...rest, top], 'ancient_incas_signs_in_the_stars', ctx.now)],
    };
}

function goldenCondor(ctx: AbilityContext): AbilityResult {
    const options = collectOwnBaseActions(ctx.state, ctx.playerId);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `ancient_incas_golden_condor_${ctx.now}`,
        ctx.playerId,
        '金色秃鹰：选择任意数量基地上的己方行动返回手牌',
        [
            createSkipOption('不返回行动', 'ui.ancient_incas_skip_return_action_option'),
            ...options.map((option, index) => ({
                id: `action-${index}`,
                label: `${cardLabel(option.defId ?? '')} @ ${baseLabel(ctx.state, option.sourceBaseIndex ?? 0)}`,
                value: option,
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'ancient_incas_golden_condor',
            targetType: 'card',
            multi: { min: 0, max: options.length },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function ashlarMasonry(ctx: AbilityContext): AbilityResult {
    const options = collectOwnBaseActions(ctx.state, ctx.playerId, { onlyBaseIndex: ctx.baseIndex });
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `ancient_incas_ashlar_masonry_${ctx.now}`,
        ctx.playerId,
        '方石砌体：选择一个这里的己方行动返回手牌，其余洗入牌库',
        options.map((option, index) => ({
            id: `action-${index}`,
            label: cardLabel(option.defId ?? ''),
            value: option,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'ancient_incas_ashlar_masonry',
            targetType: 'card',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function royalHighway(ctx: AbilityContext): AbilityResult {
    return queueRoyalHighwayMovePrompt(
        ctx.matchState,
        ctx.playerId,
        'ancient_incas_royal_highway',
        ctx.baseIndex,
        ctx.now,
    ) as AbilityResult;
}

function canSamePlayerActionOnSourceBase(ctx: TriggerContext): boolean {
    return ctx.actionTargetBaseIndex === ctx.sourceBaseIndex
        && ctx.playerId === ctx.sourceControllerId;
}

function canSamePlayerOtherActionOnSourceBase(ctx: TriggerContext): boolean {
    return canSamePlayerActionOnSourceBase(ctx)
        && ctx.triggerCardUid !== ctx.sourceCardUid;
}

function templeOfTheSunTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!canSamePlayerOtherActionOnSourceBase(ctx)) return [];
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function fortressWallsTrigger(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || !canSamePlayerOtherActionOnSourceBase(ctx)) return [];
    return queueCounterPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        sourceId: 'ancient_incas_fortress_walls_counter',
        title: '防护墙：选择这里一个己方随从放置 +1 指示物',
        baseIndex: ctx.sourceBaseIndex ?? ctx.actionTargetBaseIndex ?? 0,
        now: ctx.now,
        optional: true,
    }) as TriggerResult;
}

function childOfTheSunTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return [];
    if (!canSamePlayerActionOnSourceBase(ctx)) return [];
    const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!source) return [];
    if (Number(source.metadata?.ancientIncasChildOfTheSunTriggeredTurn ?? -1) === ctx.state.turnNumber) return [];
    return [
        grantContextualExtraAction({
            playerId: ctx.playerId,
            now: ctx.now,
            matchState: ctx.matchState,
        }, 'ancient_incas_child_of_the_sun'),
        minionMetadataUpdated(
            source.uid,
            ctx.sourceBaseIndex,
            { ancientIncasChildOfTheSunTriggeredTurn: ctx.state.turnNumber },
            'ancient_incas_child_of_the_sun',
            ctx.now,
        ),
    ];
}

function sapaIncaTrigger(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.actionTargetBaseIndex === undefined) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    return queueCounterPrompt({
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        sourceId: 'ancient_incas_sapa_inca_counter',
        title: '萨帕·印加：选择行动目标基地上的己方随从放置 +1 指示物',
        baseIndex: ctx.actionTargetBaseIndex,
        now: ctx.now,
    }) as TriggerResult;
}

function canSapaIncaTrigger(ctx: TriggerContext): boolean {
    if (ctx.actionTargetBaseIndex === undefined) return false;
    if (ctx.playerId !== ctx.sourceControllerId) return false;
    return ctx.state.bases[ctx.actionTargetBaseIndex]?.minions.some(minion => minion.controller === ctx.playerId) ?? false;
}

function royalHighwayTrigger(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (!ctx.matchState || ctx.sourceBaseIndex === undefined || ctx.actionTargetBaseIndex === undefined) return [];
    if (ctx.actionTargetBaseIndex === ctx.sourceBaseIndex) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    return queueRoyalHighwayMovePrompt(
        ctx.matchState,
        ctx.playerId,
        'ancient_incas_royal_highway_move',
        ctx.sourceBaseIndex,
        ctx.now,
        ctx.actionTargetBaseIndex,
    ) as TriggerResult;
}

function canRoyalHighwayTrigger(ctx: TriggerContext): boolean {
    if (ctx.sourceBaseIndex === undefined || ctx.actionTargetBaseIndex === undefined) return false;
    if (ctx.actionTargetBaseIndex === ctx.sourceBaseIndex) return false;
    if (ctx.playerId !== ctx.sourceControllerId) return false;
    return collectRoyalHighwayMoves(ctx.state, ctx.playerId, ctx.sourceBaseIndex, ctx.actionTargetBaseIndex).length > 0;
}

function machuPicchu(ctx: BaseAbilityContext): AbilityResult {
    if (ctx.actionTargetBaseIndex !== ctx.baseIndex) return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

export function registerAncientIncasAbilities(): void {
    registerBasePowerModifier('ancient_incas_armory', (ctx) => {
        if (!ctx.ongoing || getOngoingController(ctx.ongoing) !== ctx.playerId) return 0;
        const otherActions = ctx.base.ongoingActions.filter(action =>
            action.uid !== ctx.ongoing?.uid
            && getOngoingController(action) === ctx.playerId);
        return otherActions.length * 2;
    });
    registerCustomBreakpointModifiers([{
        sourceDefId: 'base_cuzcu',
        runtimeIdentity: 'synthetic',
        compute: (ctx) => {
            if (ctx.base.defId !== 'base_cuzcu') return 0;
            const attachedActions = ctx.base.minions.reduce((total, minion) => total + minion.attachedActions.length, 0);
            return -3 * (ctx.base.ongoingActions.length + attachedActions);
        },
    }]);

    registerSimpleAbility('ancient_incas_quipu_strings', 'onPlay', quipuStrings);
    registerSimpleAbility('ancient_incas_llama', 'onPlay', llama);
    registerSimpleAbility('ancient_incas_incan_engineer', 'onPlay', incanEngineer);
    registerSimpleAbility('ancient_incas_sapa_inca', 'onPlay', sapaInca);
    registerSimpleAbility('ancient_incas_fortress_walls', 'onPlay', fortressWalls);
    registerSimpleAbility('ancient_incas_temple_of_the_sun', 'onPlay', templeOfTheSun);
    registerSimpleAbility('ancient_incas_signs_in_the_stars', 'onPlay', signsInTheStars);
    registerSimpleAbility('ancient_incas_signs_in_the_stars', 'talent', signsInTheStarsTalent);
    registerSimpleAbility('ancient_incas_golden_condor', 'onPlay', goldenCondor);
    registerSimpleAbility('ancient_incas_ashlar_masonry', 'special', ashlarMasonry);
    registerSimpleAbility('ancient_incas_royal_highway', 'onPlay', royalHighway);

    registerTrigger('ancient_incas_temple_of_the_sun', 'onActionPlayed', templeOfTheSunTrigger, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
        canTrigger: canSamePlayerOtherActionOnSourceBase,
    });
    registerTrigger('ancient_incas_fortress_walls', 'onActionPlayed', fortressWallsTrigger, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
        canTrigger: canSamePlayerOtherActionOnSourceBase,
    });
    registerTrigger('ancient_incas_child_of_the_sun', 'onActionPlayed', childOfTheSunTrigger, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
        canTrigger: (ctx) => {
            if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined) return false;
            if (!canSamePlayerActionOnSourceBase(ctx)) return false;
            const source = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
            return Boolean(source)
                && Number(source?.metadata?.ancientIncasChildOfTheSunTriggeredTurn ?? -1) !== ctx.state.turnNumber;
        },
    });
    registerTrigger('ancient_incas_sapa_inca', 'onActionPlayed', sapaIncaTrigger, {
        perInstance: true,
        baseScoped: false,
        canTrigger: canSapaIncaTrigger,
    });
    registerTrigger('ancient_incas_royal_highway', 'onActionPlayed', royalHighwayTrigger, {
        optional: true,
        perInstance: true,
        baseScoped: false,
        canTrigger: canRoyalHighwayTrigger,
    });

    registerBaseAbility('base_machu_picchu', 'onActionPlayed', machuPicchu, {
        mandatory: true,
    });
}

export function registerAncientIncasInteractionHandlers(): void {
    registerInteractionHandler('ancient_incas_quipu_strings', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || selected?.baseIndex === undefined) return { state, events: [] };
        const card = findPlayerZoneCard(state.core, playerId, { ...selected, zone: 'discard' });
        if (!card || !isActionPlayableOnBase(card)) return { state, events: [] };
        const result = buildPlayBaseActionResult({
            matchState: state,
            playerId,
            card,
            zone: 'discard',
            baseIndex: selected.baseIndex,
            reason: 'ancient_incas_quipu_strings',
            random,
            now: timestamp,
        });
        return { state: result.matchState ?? state, events: result.events };
    });

    registerInteractionHandler('ancient_incas_llama', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || selected?.sourceBaseIndex === undefined || selected.baseIndex === undefined || !selected.cardUid || !selected.defId) {
            return { state, events: [] };
        }
        const ongoing = state.core.bases[selected.sourceBaseIndex]?.ongoingActions.find(action =>
            action.uid === selected.cardUid
            && action.defId === selected.defId
            && getOngoingController(action) === playerId);
        if (!ongoing) return { state, events: [] };
        const card: CardInstance = { uid: ongoing.uid, defId: ongoing.defId, type: 'action', owner: ongoing.ownerId };
        const play = buildPlayBaseActionResult({
            matchState: state,
            playerId,
            card,
            zone: 'hand',
            baseIndex: selected.baseIndex,
            reason: 'ancient_incas_llama',
            random,
            now: timestamp,
        });
        return {
            state: play.matchState ?? state,
            events: [
                cardTransferredToSelf(card, playerId, 'ancient_incas_llama', timestamp),
                ...play.events,
            ],
        };
    });

    registerInteractionHandler('ancient_incas_sapa_inca', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || !selected?.zone) return { state, events: [] };
        const card = findPlayerZoneCard(state.core, playerId, selected);
        if (!card || !isActionPlayableOnBase(card)) return { state, events: [] };
        return { state, events: [cardTransferredToSelf(card, playerId, 'ancient_incas_sapa_inca', timestamp)] };
    });

    registerInteractionHandler('ancient_incas_golden_condor', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const selected = choices.filter(choice => !choice?.skip && choice?.cardUid && choice.sourceBaseIndex !== undefined);
        const seen = new Set<string>();
        const events: SmashUpEvent[] = [];
        for (const choice of selected) {
            if (!choice.cardUid || !choice.defId || choice.sourceBaseIndex === undefined || seen.has(choice.cardUid)) continue;
            const ongoing = state.core.bases[choice.sourceBaseIndex]?.ongoingActions.find(action =>
                action.uid === choice.cardUid
                && action.defId === choice.defId
                && getOngoingController(action) === playerId);
            if (!ongoing) continue;
            seen.add(ongoing.uid);
            events.push(cardTransferredToSelf(
                { uid: ongoing.uid, defId: ongoing.defId, owner: ongoing.ownerId },
                playerId,
                'ancient_incas_golden_condor',
                timestamp,
            ));
        }
        for (let index = 0; index < seen.size; index += 1) {
            events.push(grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'ancient_incas_golden_condor'));
        }
        return { state, events };
    });

    registerInteractionHandler('ancient_incas_ashlar_masonry', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (!selected?.cardUid || !selected.defId || selected.sourceBaseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[selected.sourceBaseIndex];
        if (!base) return { state, events: [] };
        const selectedOngoing = base.ongoingActions.find(action =>
            action.uid === selected.cardUid
            && action.defId === selected.defId
            && getOngoingController(action) === playerId);
        if (!selectedOngoing) return { state, events: [] };
        const events: SmashUpEvent[] = [
            cardTransferredToSelf(
                { uid: selectedOngoing.uid, defId: selectedOngoing.defId, owner: selectedOngoing.ownerId },
                playerId,
                'ancient_incas_ashlar_masonry',
                timestamp,
            ),
        ];
        const rest = base.ongoingActions.filter(action =>
            action.uid !== selectedOngoing.uid
            && getOngoingController(action) === playerId);
        for (const action of rest) {
            events.push(...buildValidatedCardToDeckBottomEvents(state, {
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                expectedLocation: 'bases',
                sourcePlayerId: playerId,
                sourceDefId: 'ancient_incas_ashlar_masonry',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.sourceBaseIndex,
                reason: 'ancient_incas_ashlar_masonry',
                now: timestamp,
            }));
        }
        const owner = state.core.players[playerId];
        if (owner && rest.length > 0) {
            events.push(deckReordered(
                playerId,
                [
                    ...owner.deck,
                    ...rest.map(action => ({ uid: action.uid, defId: action.defId, type: 'action' as const, owner: action.ownerId })),
                ],
                random,
                'ancient_incas_ashlar_masonry',
                timestamp,
            ));
        }
        return { state, events };
    });

    const counterHandler = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: RandomFn, timestamp: number) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion =>
            minion.uid === selected.minionUid
            && minion.controller === playerId);
        if (!target) return { state, events: [] };
        return {
            state,
            events: [addPowerCounter(target.uid, selected.baseIndex, 1, 'ancient_incas_counter', timestamp, {
                sourcePlayerId: playerId,
                sourceDefId: 'ancient_incas_counter',
                sourceBaseIndex: selected.baseIndex,
            })],
        };
    };
    registerInteractionHandler('ancient_incas_fortress_walls', counterHandler);
    registerInteractionHandler('ancient_incas_fortress_walls_counter', counterHandler);
    registerInteractionHandler('ancient_incas_sapa_inca_counter', counterHandler);

    const royalHighwayHandler = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: RandomFn, timestamp: number) => {
        const selected = value as MoveChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.minionDefId || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
            return { state, events: [] };
        }
        const live = state.core.bases[selected.fromBaseIndex]?.minions.find(minion =>
            minion.uid === selected.minionUid
            && minion.defId === selected.minionDefId
            && minion.controller === playerId);
        if (!live) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: live.uid,
                minionDefId: live.defId,
                fromBaseIndex: selected.fromBaseIndex,
                toBaseIndex: selected.toBaseIndex,
                reason: 'ancient_incas_royal_highway',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'ancient_incas_royal_highway',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.fromBaseIndex,
                sourceKind: 'action',
            }),
        };
    };
    registerInteractionHandler('ancient_incas_royal_highway', royalHighwayHandler);
    registerInteractionHandler('ancient_incas_royal_highway_move', royalHighwayHandler);
}
