import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import {
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    grantContextualExtraAction,
    grantContextualExtraMinion,
} from '../domain/abilityHelpers';
import { getBaseDef, getCardDef } from '../data/cards';
import { getSmashUpReactionWindowContext } from '../domain/reactionWindowState';
import { SU_EVENTS, type ActionCardDef, type BaseReplacedEvent, type CardInstance, type CardTransferredEvent, type MinionOnBase, type SmashUpCore, type SmashUpEvent } from '../domain/types';

type MinionChoice = { minionUid?: string; minionDefId?: string; baseIndex?: number; skip?: boolean };
type BaseChoice = { baseIndex?: number; baseDefId?: string; skip?: boolean };
type GrowthChoice =
    | { mode: 'extraMinion'; baseIndex: number; baseDefId?: string }
    | { mode: 'move'; minionUid: string; minionDefId: string; fromBaseIndex: number; toBaseIndex: number; toBaseDefId?: string }
    | { skip: true };
type TattooArtistChoice = { cardUid?: string; defId?: string; zone?: 'deck' | 'discard'; playNow?: boolean; skip?: boolean };

function baseLabel(core: SmashUpCore, baseIndex: number): string {
    return getBaseDef(core.bases[baseIndex]?.defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function cardTransferredToSelf(card: CardInstance, playerId: PlayerId, reason: string, now: number): CardTransferredEvent {
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

function ownMinions(core: SmashUpCore, playerId: PlayerId): Array<{ minion: MinionOnBase; baseIndex: number }> {
    return core.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === playerId)
            .map(minion => ({ minion, baseIndex })),
    );
}

function basesWithoutOwnMinions(core: SmashUpCore, playerId: PlayerId, excludedBaseIndex?: number): Array<{ baseIndex: number; label: string }> {
    return core.bases
        .map((base, baseIndex) => ({ base, baseIndex }))
        .filter(({ base, baseIndex }) =>
            baseIndex !== excludedBaseIndex
            && !base.minions.some(minion => minion.controller === playerId),
        )
        .map(({ baseIndex }) => ({ baseIndex, label: baseLabel(core, baseIndex) }));
}

function insertTopBase(core: SmashUpCore, now: number, reason: string): BaseReplacedEvent | undefined {
    const newBaseDefId = core.baseDeck[0];
    if (!newBaseDefId) return undefined;
    return {
        type: SU_EVENTS.BASE_REPLACED,
        payload: {
            baseIndex: core.bases.length,
            oldBaseDefId: '',
            newBaseDefId,
            allowMissingFromBaseDeck: false,
        },
        timestamp: now,
    } as BaseReplacedEvent;
}

function queueBaseChoice(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    title: string,
    bases: Array<{ baseIndex: number; label: string }>,
    now: number,
    optional = true,
): AbilityResult {
    if (bases.length === 0) return { events: [] };
    const options: PromptOption<BaseChoice>[] = [
        ...(optional ? [createSkipOption('不执行', 'ui.skip_option') as PromptOption<BaseChoice>] : []),
        ...buildBaseTargetOptions(bases, matchState.core),
    ];
    const interaction = createSimpleChoice<BaseChoice>(
        `${sourceId}_${now}`,
        playerId,
        title,
        options,
        { sourceId, targetType: 'base', autoResolveIfSingle: false, responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function moveSelfToEmptyBaseAndCounter(ctx: AbilityContext, sourceId: string): AbilityResult {
    const sourceBase = ctx.state.bases[ctx.baseIndex];
    const self = sourceBase?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const destinations = basesWithoutOwnMinions(ctx.state, ctx.playerId, ctx.baseIndex);
    if (destinations.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (destinations.length === 1) {
        return resolveMoveSelfToEmptyBase(ctx.matchState, ctx.playerId, sourceId, ctx.cardUid, ctx.defId, ctx.baseIndex, destinations[0].baseIndex, ctx.now);
    }
    const interaction = createSimpleChoice<BaseChoice>(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        `${cardLabel(ctx.defId)}：选择目标基地`,
        buildBaseTargetOptions(destinations, ctx.state),
        {
            sourceId,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            continuationContext: {
                minionUid: ctx.cardUid,
                minionDefId: ctx.defId,
                fromBaseIndex: ctx.baseIndex,
            },
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function resolveMoveSelfToEmptyBase(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    sourceId: string,
    minionUid: string,
    minionDefId: string,
    fromBaseIndex: number,
    toBaseIndex: number,
    now: number,
): AbilityResult {
    const moveEvents = buildValidatedMoveEvents(matchState.core, {
        minionUid,
        minionDefId,
        fromBaseIndex,
        toBaseIndex,
        reason: sourceId,
        now,
        sourcePlayerId: playerId,
        sourceDefId: sourceId,
        sourceControllerId: playerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'nonAction',
    });
    const moved = moveEvents.some(event => event.type === SU_EVENTS.MINION_MOVED);
    return {
        events: [
            ...moveEvents,
            ...(moved ? [addPowerCounter(minionUid, toBaseIndex, 1, sourceId, now, {
                sourcePlayerId: playerId,
                sourceDefId: sourceId,
                sourceControllerId: playerId,
                sourceBaseIndex: toBaseIndex,
            })] : []),
        ],
    };
}

function growthOfTheTribes(ctx: AbilityContext): AbilityResult {
    const destinationBases = basesWithoutOwnMinions(ctx.state, ctx.playerId);
    if (destinationBases.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const moves = ownMinions(ctx.state, ctx.playerId).flatMap(({ minion, baseIndex }) =>
        destinationBases
            .filter(destination => destination.baseIndex !== baseIndex)
            .map(destination => ({
                minion,
                fromBaseIndex: baseIndex,
                toBaseIndex: destination.baseIndex,
                label: `${cardLabel(minion.defId)}：${baseLabel(ctx.state, baseIndex)} -> ${destination.label}`,
            })),
    );
    const options: PromptOption<GrowthChoice>[] = [
        ...destinationBases.map((base, index) => ({
            id: `extra-${index}`,
            label: `在${base.label}额外打出随从`,
            value: { mode: 'extraMinion' as const, baseIndex: base.baseIndex, baseDefId: ctx.state.bases[base.baseIndex]?.defId },
            displayMode: 'button' as const,
        })),
        ...moves.map((move, index) => ({
            id: `move-${index}`,
            label: move.label,
            value: {
                mode: 'move' as const,
                minionUid: move.minion.uid,
                minionDefId: move.minion.defId,
                fromBaseIndex: move.fromBaseIndex,
                toBaseIndex: move.toBaseIndex,
                toBaseDefId: ctx.state.bases[move.toBaseIndex]?.defId,
            },
            displayMode: 'card' as const,
        })),
    ];
    const interaction = createSimpleChoice<GrowthChoice>(
        `polynesian_voyagers_growth_of_the_tribes_${ctx.now}`,
        ctx.playerId,
        '部落的成长：选择额外打出随从或移动己方随从',
        options,
        { sourceId: 'polynesian_voyagers_growth_of_the_tribes', targetType: 'generic', autoResolveIfSingle: false, responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function growthHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as GrowthChoice | undefined;
    if (!selected || 'skip' in selected) return { state, events: [] };
    if (selected.mode === 'extraMinion') {
        return { state, events: [grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'polynesian_voyagers_growth_of_the_tribes', selected.baseIndex)] };
    }
    return {
        state,
        events: buildValidatedMoveEvents(state.core, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.fromBaseIndex,
            toBaseIndex: selected.toBaseIndex,
            toBaseDefId: selected.toBaseDefId,
            reason: 'polynesian_voyagers_growth_of_the_tribes',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'polynesian_voyagers_growth_of_the_tribes',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.fromBaseIndex,
            sourceKind: 'action',
        }),
    };
}

function knowledgeOfTheTribes(ctx: AbilityContext): AbilityResult {
    const count = ctx.state.bases.filter(base => base.minions.some(minion => minion.controller === ctx.playerId)).length;
    if (count <= 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, count, ctx.random, ctx.now) };
}

function mauiOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const first = insertTopBase(ctx.state, ctx.now, 'polynesian_voyagers_maui');
    if (first) {
        events.push(first);
        const secondCore = { ...ctx.state, baseDeck: ctx.state.baseDeck.slice(1), bases: [...ctx.state.bases, { defId: first.payload.newBaseDefId, minions: [], ongoingActions: [] }] } as SmashUpCore;
        const second = insertTopBase(secondCore, ctx.now + 1, 'polynesian_voyagers_maui');
        if (second) events.push(second);
    }
    return { events };
}

function mauiTalent(ctx: AbilityContext): AbilityResult {
    const candidates = ownMinions(ctx.state, ctx.playerId);
    const destinations = basesWithoutOwnMinions(ctx.state, ctx.playerId);
    if (candidates.length === 0 || destinations.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options: PromptOption<GrowthChoice>[] = candidates.flatMap(({ minion, baseIndex }) =>
        destinations
            .filter(destination => destination.baseIndex !== baseIndex)
            .map((destination, index) => ({
                id: `${minion.uid}-${destination.baseIndex}-${index}`,
                label: `${cardLabel(minion.defId)}：${baseLabel(ctx.state, baseIndex)} -> ${destination.label}`,
                value: {
                    mode: 'move' as const,
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: baseIndex,
                    toBaseIndex: destination.baseIndex,
                    toBaseDefId: ctx.state.bases[destination.baseIndex]?.defId,
                },
                displayMode: 'card' as const,
            })),
    );
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice<GrowthChoice>(
        `polynesian_voyagers_maui_${ctx.now}`,
        ctx.playerId,
        '毛伊人：移动一个己方随从到没有你随从的基地',
        options,
        { sourceId: 'polynesian_voyagers_maui', targetType: 'minion', autoResolveIfSingle: false, responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function mauiHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    return growthHandler(state, playerId, value, _data, _random, timestamp);
}

function oceanTattooOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const hasOtherPlayerMinion = base.minions.some(minion => minion.controller !== ctx.playerId);
    if (hasOtherPlayerMinion) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    return { events: [] };
}

function oceanTattooTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const host = base?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.cardUid));
    if (!host || host.controller !== ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) }))
        .filter(base => base.baseIndex !== ctx.baseIndex);
    if (destinations.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (destinations.length === 1) {
        const moveEvents = buildValidatedMoveEvents(ctx.state, {
            minionUid: host.uid,
            minionDefId: host.defId,
            fromBaseIndex: ctx.baseIndex,
            toBaseIndex: destinations[0].baseIndex,
            reason: 'polynesian_voyagers_ocean_tattoo',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceCardUid: ctx.cardUid,
            sourceDefId: 'polynesian_voyagers_ocean_tattoo',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
            sourceKind: 'nonAction',
        });
        return { events: [...moveEvents, addPowerCounter(host.uid, destinations[0].baseIndex, 1, 'polynesian_voyagers_ocean_tattoo', ctx.now)] };
    }
    const interaction = createSimpleChoice<BaseChoice>(
        `polynesian_voyagers_ocean_tattoo_${ctx.now}`,
        ctx.playerId,
        '海洋纹身：选择目标基地',
        buildBaseTargetOptions(destinations, ctx.state),
        {
            sourceId: 'polynesian_voyagers_ocean_tattoo',
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            continuationContext: {
                sourceCardUid: ctx.cardUid,
                sourceBaseIndex: ctx.baseIndex,
            },
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function oceanTattooHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as BaseChoice | undefined;
    const context = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
    const sourceCardUid = context?.sourceCardUid;
    const sourceBaseIndex = context?.sourceBaseIndex;
    const fromBaseIndex = typeof sourceBaseIndex === 'number' ? sourceBaseIndex : state.core.bases.findIndex(base => base.minions.some(minion => minion.attachedActions.some(action => action.uid === sourceCardUid)));
    const host = state.core.bases[fromBaseIndex]?.minions.find(minion => minion.attachedActions.some(action => action.uid === sourceCardUid));
    if (!selected || selected.skip || typeof selected.baseIndex !== 'number' || !host) return { state, events: [] };
    const moveEvents = buildValidatedMoveEvents(state.core, {
        minionUid: host.uid,
        minionDefId: host.defId,
        fromBaseIndex,
        toBaseIndex: selected.baseIndex,
        reason: 'polynesian_voyagers_ocean_tattoo',
        now: timestamp,
        sourcePlayerId: playerId,
        sourceCardUid,
        sourceDefId: 'polynesian_voyagers_ocean_tattoo',
        sourceControllerId: playerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'nonAction',
    });
    return { state, events: [...moveEvents, addPowerCounter(host.uid, selected.baseIndex, 1, 'polynesian_voyagers_ocean_tattoo', timestamp)] };
}

function wayfinderHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as BaseChoice | undefined;
    const context = data?.continuationContext as { minionUid?: string; minionDefId?: string; fromBaseIndex?: number } | undefined;
    if (!selected || selected.skip || typeof selected.baseIndex !== 'number' || !context?.minionUid || context.fromBaseIndex === undefined) {
        return { state, events: [] };
    }
    const result = resolveMoveSelfToEmptyBase(
        state,
        playerId,
        'polynesian_voyagers_wayfinder',
        context.minionUid,
        context.minionDefId ?? 'polynesian_voyagers_wayfinder',
        context.fromBaseIndex,
        selected.baseIndex,
        timestamp,
    );
    return { state, events: result.events };
}

function isAttachableMinionAction(card: CardInstance): boolean {
    const def = getCardDef(card.defId) as ActionCardDef | undefined;
    return def?.type === 'action' && def.ongoingTarget === 'minion';
}

function tattooArtist(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const candidates: Array<{ card: CardInstance; zone: 'deck' | 'discard' }> = [
        ...player.deck.filter(isAttachableMinionAction).map(card => ({ card, zone: 'deck' as const })),
        ...player.discard.filter(isAttachableMinionAction).map(card => ({ card, zone: 'discard' as const })),
    ];
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options: PromptOption<TattooArtistChoice>[] = candidates.flatMap(({ card, zone }, index) => ([
        {
            id: `hand-${index}`,
            label: `${cardLabel(card.defId)} -> 手牌`,
            value: { cardUid: card.uid, defId: card.defId, zone },
            displayMode: 'card' as const,
        },
        {
            id: `play-${index}`,
            label: `${cardLabel(card.defId)} -> 作为额外行动`,
            value: { cardUid: card.uid, defId: card.defId, zone, playNow: true },
            displayMode: 'card' as const,
        },
    ]));
    const interaction = createSimpleChoice<TattooArtistChoice>(
        `polynesian_voyagers_tattoo_artist_${ctx.now}`,
        ctx.playerId,
        '纹身艺术家：选择可打在随从上的行动',
        [createSkipOption('不搜索', 'ui.skip_option') as PromptOption<TattooArtistChoice>, ...options],
        { sourceId: 'polynesian_voyagers_tattoo_artist', targetType: 'card', autoResolveIfSingle: false, responseValidationMode: 'live' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function tattooArtistHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as TattooArtistChoice | undefined;
    const player = state.core.players[playerId];
    if (!selected || selected.skip || !selected.cardUid || !player) return { state, events: [] };
    if (selected.playNow) {
        return { state, events: [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'polynesian_voyagers_tattoo_artist', { restrictToCardUid: selected.cardUid })] };
    }
    return {
        state,
        events: [cardTransferredToSelf({ uid: selected.cardUid, defId: selected.defId ?? '', owner: playerId, type: 'action' }, playerId, 'polynesian_voyagers_tattoo_artist', timestamp)],
    };
}

function unityOfTheTribes(ctx: AbilityContext): AbilityResult {
    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const targetBase = ctx.state.bases[targetBaseIndex];
    if (!targetBase?.minions.some(minion => minion.controller === ctx.playerId)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const events = ctx.state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => addTempPower(minion.uid, baseIndex, 2, 'polynesian_voyagers_unity_of_the_tribes', ctx.now)),
    );
    return { events };
}

function volcanicUprising(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const added = insertTopBase(ctx.state, ctx.now, 'polynesian_voyagers_volcanic_uprising');
    if (added) events.push(added);
    const destinations = added
        ? [{ baseIndex: ctx.state.bases.length, label: cardLabel(added.payload.newBaseDefId) }]
        : [];
    const own = ownMinions(ctx.state, ctx.playerId);
    if (added && own.length === 1) {
        events.push(...buildValidatedMoveEvents(ctx.state, {
            minionUid: own[0].minion.uid,
            minionDefId: own[0].minion.defId,
            fromBaseIndex: own[0].baseIndex,
            toBaseIndex: ctx.state.bases.length,
            toBaseDefId: added.payload.newBaseDefId,
            reason: 'polynesian_voyagers_volcanic_uprising',
            now: ctx.now,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'polynesian_voyagers_volcanic_uprising',
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: own[0].baseIndex,
            sourceKind: 'action',
            allowMissingTargetBase: true,
        }));
        return { events };
    }
    if (destinations.length > 0 && own.length > 1) {
        const options: PromptOption<MinionChoice>[] = [
            createSkipOption('不移动随从', 'ui.skip_option') as PromptOption<MinionChoice>,
            ...buildMinionTargetOptions(own.map(entry => ({ uid: entry.minion.uid, defId: entry.minion.defId, baseIndex: entry.baseIndex, label: `${cardLabel(entry.minion.defId)} @ ${baseLabel(ctx.state, entry.baseIndex)}` })), {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'polynesian_voyagers_volcanic_uprising',
                sourceKind: 'action',
                effectType: 'move',
            }),
        ];
        const interaction = createSimpleChoice<MinionChoice>(
            `polynesian_voyagers_volcanic_uprising_${ctx.now}`,
            ctx.playerId,
            '火山爆发：可以移动一个己方随从到新基地',
            options,
            {
                sourceId: 'polynesian_voyagers_volcanic_uprising',
                targetType: 'minion',
                responseValidationMode: 'live',
                continuationContext: { toBaseIndex: ctx.state.bases.length, toBaseDefId: added.payload.newBaseDefId },
            },
        );
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events };
}

function volcanicUprisingHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as MinionChoice | undefined;
    const context = data?.continuationContext as { toBaseIndex?: number; toBaseDefId?: string } | undefined;
    if (!selected || selected.skip || !selected.minionUid || selected.baseIndex === undefined || context?.toBaseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: buildValidatedMoveEvents(state.core, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId ?? '',
            fromBaseIndex: selected.baseIndex,
            toBaseIndex: context.toBaseIndex,
            toBaseDefId: context.toBaseDefId,
            reason: 'polynesian_voyagers_volcanic_uprising',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'polynesian_voyagers_volcanic_uprising',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
            sourceKind: 'action',
            allowMissingTargetBase: true,
        }),
    };
}

function sharkTattooOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    return { events: [addPowerCounter(target.uid, ctx.baseIndex, 1, 'polynesian_voyagers_shark_tattoo', ctx.now)] };
}

function sharkTattooTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return [];
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const host = base?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!base || !host || host.controller !== ctx.sourceControllerId) return [];
    const ownMinions = base.minions.filter(minion => minion.controller === ctx.sourceControllerId);
    if (ownMinions.length !== 1) return [];
    return [addPowerCounter(host.uid, ctx.sourceBaseIndex, 1, 'polynesian_voyagers_shark_tattoo', ctx.now)];
}

function sunTattooOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if ((target.attachedActions ?? []).length > 0 && ctx.fromDiscard !== true) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    if (getSmashUpReactionWindowContext(ctx.matchState)?.windowType !== 'afterScoring') {
        return { events: [] };
    }
    const destinations = ctx.state.bases
        .map((_candidate, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) }))
        .filter(destination => destination.baseIndex !== ctx.baseIndex);
    if (destinations.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (destinations.length === 1) {
        return {
            events: buildValidatedMoveEvents(ctx.state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex: destinations[0].baseIndex,
                reason: 'polynesian_voyagers_sun_tattoo',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: 'polynesian_voyagers_sun_tattoo',
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                sourceKind: 'action',
            }),
        };
    }
    const interaction = createSimpleChoice<BaseChoice>(
        `polynesian_voyagers_sun_tattoo_${ctx.now}`,
        ctx.playerId,
        '太阳纹身：将该随从移动到另一个基地',
        buildBaseTargetOptions(destinations, ctx.state),
        {
            sourceId: 'polynesian_voyagers_sun_tattoo',
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            continuationContext: {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: ctx.baseIndex,
            },
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function sunTattooHandler(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as BaseChoice | undefined;
    const context = data?.continuationContext as { minionUid?: string; minionDefId?: string; fromBaseIndex?: number } | undefined;
    if (!selected || selected.skip || typeof selected.baseIndex !== 'number' || !context?.minionUid || context.fromBaseIndex === undefined) {
        return { state, events: [] };
    }
    return {
        state,
        events: buildValidatedMoveEvents(state.core, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId ?? '',
            fromBaseIndex: context.fromBaseIndex,
            toBaseIndex: selected.baseIndex,
            reason: 'polynesian_voyagers_sun_tattoo',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'polynesian_voyagers_sun_tattoo',
            sourceControllerId: playerId,
            sourceBaseIndex: context.fromBaseIndex,
            sourceKind: 'action',
        }),
    };
}

function islandChainAfterScoring(ctx: BaseAbilityContext): BaseAbilityResult {
    const added = insertTopBase(ctx.state, ctx.now, 'base_island_chain');
    return { events: added ? [added] : [] };
}

function islandPeakTurnStart(ctx: BaseAbilityContext): BaseAbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const own = base.minions.filter(minion => minion.controller === ctx.playerId);
    if (own.length !== 1) return { events: [] };
    return { events: [addPowerCounter(own[0].uid, ctx.baseIndex, 1, 'base_island_peak', ctx.now)] };
}

export function registerPolynesianVoyagersAbilities(): void {
    registerAbility('polynesian_voyagers_growth_of_the_tribes', 'onPlay', growthOfTheTribes);
    registerAbility('polynesian_voyagers_knowledge_of_the_tribes', 'onPlay', knowledgeOfTheTribes);
    registerAbility('polynesian_voyagers_wayfinder', 'talent', ctx => moveSelfToEmptyBaseAndCounter(ctx, 'polynesian_voyagers_wayfinder'));
    registerAbility('polynesian_voyagers_maui', 'onPlay', mauiOnPlay);
    registerAbility('polynesian_voyagers_maui', 'talent', mauiTalent);
    registerAbility('polynesian_voyagers_ocean_tattoo', 'onPlay', oceanTattooOnPlay);
    registerAbility('polynesian_voyagers_ocean_tattoo', 'talent', oceanTattooTalent);
    registerAbility('polynesian_voyagers_tattoo_artist', 'onPlay', tattooArtist);
    registerAbility('polynesian_voyagers_unity_of_the_tribes', 'onPlay', unityOfTheTribes);
    registerAbility('polynesian_voyagers_volcanic_uprising', 'onPlay', volcanicUprising);
    registerAbility('polynesian_voyagers_shark_tattoo', 'onPlay', sharkTattooOnPlay);
    registerAbility('polynesian_voyagers_sun_tattoo', 'onPlay', sunTattooOnPlay);
    registerAbility('polynesian_voyagers_sun_tattoo', 'special', sunTattooOnPlay);

    registerTrigger('polynesian_voyagers_shark_tattoo', 'onTurnStart', sharkTattooTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerBaseAbility('base_island_chain', 'afterScoring', islandChainAfterScoring);
    registerBaseAbility('base_island_peak', 'onTurnStart', islandPeakTurnStart);

    registerInteractionHandler('polynesian_voyagers_growth_of_the_tribes', growthHandler);
    registerInteractionHandler('polynesian_voyagers_wayfinder', wayfinderHandler);
    registerInteractionHandler('polynesian_voyagers_maui', mauiHandler);
    registerInteractionHandler('polynesian_voyagers_ocean_tattoo', oceanTattooHandler);
    registerInteractionHandler('polynesian_voyagers_tattoo_artist', tattooArtistHandler);
    registerInteractionHandler('polynesian_voyagers_volcanic_uprising', volcanicUprisingHandler);
    registerInteractionHandler('polynesian_voyagers_sun_tattoo', sunTattooHandler);
}
