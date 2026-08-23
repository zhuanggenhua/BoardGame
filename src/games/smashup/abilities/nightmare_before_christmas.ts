import type { PlayerId } from '../../../engine/types';
import type { PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption, type SimpleChoiceConfig } from '../../../engine/systems/InteractionSystem';
import { registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    buildAbilityFeedback,
    createSkipOption,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedReturnEvents,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { createEffectProgram } from '../domain/abilityRuntime';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { getCardDef } from '../data/cards';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    registerBaseVpModifier,
    registerCardAbilitySuppression,
    registerTrigger,
} from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import type { CardInstance, CardToDeckBottomEvent, DeckReorderedEvent, OngoingDetachedEvent, OngoingAttachedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import {
    collectCharacterModifiers,
    firstOtherBaseIndex,
    getActionControllerId,
    getActionOwnerId,
    isCharacterModifier,
    revealTopAndDrawMatches,
} from './disney_shared';

const JACK = 'nightmare_before_christmas_jack_skellington';
const DR_FINKELSTEIN = 'nightmare_before_christmas_dr_finkelstein';
const SALLY = 'nightmare_before_christmas_sally';
const LOCK_SHOCK_BARREL = 'nightmare_before_christmas_lock_shock_and_barrel';
const ZERO = 'nightmare_before_christmas_zero';
const HALLOWEEN_TOWN_FOLKS = 'nightmare_before_christmas_halloween_town_folks';
const CHRISTMAS_WILL_BE_OURS = 'nightmare_before_christmas_christmas_will_be_ours';
const GHOSTLY_PRESENTS = 'nightmare_before_christmas_ghostly_presents';
const OOGIE_BOOGIE = 'nightmare_before_christmas_oogie_boogie';
const SANDY_CLAWS_COSTUME = 'nightmare_before_christmas_sandy_claws_costume';
const WINTER_SURPRISE = 'nightmare_before_christmas_winter_surprise';
const ZOMBIE_DUCK_TOY = 'nightmare_before_christmas_zombie_duck_toy';
const BASE_HALLOWEEN_TOWN = 'base_halloween_town';
const BASE_SPIRAL_HILL = 'base_spiral_hill';

type NightmareCardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    zone?: 'hand' | 'discard';
    skip?: boolean;
};

type NightmareModifierChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
    hostUid?: string;
    hostDefId?: string;
    targetBaseIndex?: number;
    targetBaseDefId?: string;
    targetMinionUid?: string;
    targetMinionDefId?: string;
    mode?: 'counter' | 'draw';
    skip?: boolean;
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function queueNightmarePrompt<T>(
    ctx: Pick<AbilityContext, 'matchState' | 'playerId' | 'now'>,
    sourceId: string,
    title: string,
    titleKey: string,
    options: PromptOption<T>[],
    targetType: 'generic' | 'hand' | 'discard' | 'minion' | 'base' = 'generic',
    continuationContext?: Record<string, unknown>,
    config: Partial<Pick<SimpleChoiceConfig, 'autoRefresh' | 'genericIntent' | 'multi' | 'responseValidationMode'>> = {},
): AbilityResult {
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        title,
        options,
        {
            ...config,
            titleKey,
            sourceId,
            targetType,
            autoResolveIfSingle: false,
            responseValidationMode: config.responseValidationMode ?? 'live',
            ...(targetType === 'generic' ? { genericIntent: 'card-pool' as const } : {}),
        },
    );
    if (continuationContext) {
        (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = continuationContext;
    }
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildCharacterModifierCardOptions(
    cards: CardInstance[],
    zone: 'hand' | 'discard',
): PromptOption<NightmareCardChoice>[] {
    return cards
        .filter(card => isCharacterModifier(card.defId))
        .map(card => ({
            id: `${zone}-${card.uid}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, zone },
            displayMode: 'card' as const,
            displayCard: { defId: card.defId, cardUid: card.uid },
        }));
}

function buildAttachedModifierOptions(
    state: SmashUpCore,
    baseIndex: number | undefined,
    ownerId?: PlayerId,
): PromptOption<NightmareModifierChoice>[] {
    return collectCharacterModifiers(state, baseIndex)
        .filter(entry => ownerId === undefined || getActionOwnerId(entry.action) === ownerId)
        .map(entry => ({
            id: `modifier-${entry.action.uid}`,
            label: `${cardLabel(entry.action.defId)} @ ${cardLabel(entry.host.defId)}`,
            value: {
                cardUid: entry.action.uid,
                defId: entry.action.defId,
                ownerId: getActionOwnerId(entry.action),
                baseIndex: entry.baseIndex,
                hostUid: entry.host.uid,
                hostDefId: entry.host.defId,
            },
            displayMode: 'card' as const,
            displayCard: { defId: entry.action.defId, cardUid: entry.action.uid },
        }));
}

function buildModifierMoveOptions(state: SmashUpCore): PromptOption<NightmareModifierChoice>[] {
    const modifiers = collectCharacterModifiers(state);
    const minions = state.bases.flatMap((base, baseIndex) =>
        base.minions.map(minion => ({ minion, baseIndex })));
    return modifiers.flatMap(entry =>
        minions
            .filter(destination => destination.minion.uid !== entry.host.uid)
            .map(destination => ({
                id: `move-${entry.action.uid}-${destination.minion.uid}`,
                label: `${cardLabel(entry.action.defId)} -> ${cardLabel(destination.minion.defId)}`,
                value: {
                    cardUid: entry.action.uid,
                    defId: entry.action.defId,
                    ownerId: getActionOwnerId(entry.action),
                    baseIndex: entry.baseIndex,
                    hostUid: entry.host.uid,
                    hostDefId: entry.host.defId,
                    targetBaseIndex: destination.baseIndex,
                    targetMinionUid: destination.minion.uid,
                    targetMinionDefId: destination.minion.defId,
                },
                displayMode: 'card' as const,
                displayCard: { defId: entry.action.defId, cardUid: entry.action.uid },
            })));
}

function findAttachedModifier(
    state: SmashUpCore,
    choice: NightmareModifierChoice,
) {
    if (!choice.cardUid || !choice.defId || choice.baseIndex === undefined || !choice.hostUid) return undefined;
    const host = state.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.hostUid);
    const action = host?.attachedActions.find(candidate =>
        candidate.uid === choice.cardUid
        && candidate.defId === choice.defId
        && (choice.ownerId === undefined || getActionOwnerId(candidate) === choice.ownerId));
    return host && action ? { host, action, baseIndex: choice.baseIndex } : undefined;
}

function jackOnPlay(ctx: AbilityContext): AbilityResult {
    const options = buildCharacterModifierCardOptions(ctx.state.players[ctx.playerId]?.discard ?? [], 'discard');
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    if (ctx.matchState) {
        return queueNightmarePrompt(
            ctx,
            `${JACK}_recover`,
            'Jack Skellington：选择弃牌堆中的角色修正牌加入手牌',
            'ui.nightmare_before_christmas_jack_skellington_recover_title',
            options,
            'discard',
        );
    }
    return { events: [] };
}

function jackOnCharacterModifierPlayed(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (ctx.triggerCardDefId === undefined || !isCharacterModifier(ctx.triggerCardDefId)) return [];
    if (ctx.playerId !== ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid) return [];
    if (ctx.matchState) {
        const minionOptions: PromptOption<NightmareModifierChoice>[] = ctx.state.bases.flatMap((base, baseIndex) =>
            base.minions.map(minion => ({
                id: `counter-${baseIndex}-${minion.uid}`,
                label: `${cardLabel(minion.defId)} @ ${cardLabel(base.defId)}`,
                value: { mode: 'counter' as const, baseIndex, targetMinionUid: minion.uid, targetMinionDefId: minion.defId },
                displayMode: 'card' as const,
            })));
        return queueNightmarePrompt(
            { matchState: ctx.matchState, playerId: ctx.sourceControllerId, now: ctx.now },
            `${JACK}_trigger`,
            'Jack Skellington：选择角色放置 +1 指示物，或抽 1 张牌',
            'ui.nightmare_before_christmas_jack_skellington_trigger_title',
            [
                { id: 'draw', label: '抽 1 张牌', labelKey: 'ui.nightmare_before_christmas_jack_skellington_draw_option', value: { mode: 'draw' }, displayMode: 'button' },
                ...minionOptions,
            ],
            'generic',
            { sourceCardUid: ctx.sourceCardUid, sourceBaseIndex: ctx.sourceBaseIndex },
        ) as TriggerResult;
    }
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const target = base?.minions.find(minion => minion.controller === ctx.sourceControllerId);
    if (!target) {
        return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    }
    return [{
        type: SU_EVENTS.POWER_COUNTER_ADDED,
        payload: {
            minionUid: target.uid,
            baseIndex: ctx.sourceBaseIndex,
            amount: 1,
            reason: JACK,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: JACK,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function drFinkelsteinTalent(ctx: AbilityContext): AbilityResult {
    const options = buildModifierMoveOptions(ctx.state);
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    if (ctx.matchState) {
        return queueNightmarePrompt(
            ctx,
            `${DR_FINKELSTEIN}_move_modifier`,
            'Dr. Finkelstein：选择要移动的角色修正牌和新角色',
            'ui.nightmare_before_christmas_dr_finkelstein_move_modifier_title',
            options,
        );
    }
    const selected = options[0].value;
    const modifier = findAttachedModifier(ctx.state, selected);
    const destination = selected.targetBaseIndex !== undefined && selected.targetMinionUid
        ? ctx.state.bases[selected.targetBaseIndex]?.minions.find(minion => minion.uid === selected.targetMinionUid)
        : undefined;
    if (!modifier || !destination || selected.targetBaseIndex === undefined) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    }
    return {
        events: [{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: getActionOwnerId(modifier.action),
                sourcePlayerId: ctx.playerId,
                targetType: 'minion',
                targetBaseIndex: selected.targetBaseIndex,
                targetMinionUid: destination.uid,
                metadata: modifier.action.metadata,
                talentUsed: modifier.action.talentUsed,
            },
            timestamp: ctx.now,
        } as OngoingAttachedEvent],
    };
}

function sallyTalent(ctx: AbilityContext): AbilityResult {
    const options = buildCharacterModifierCardOptions(ctx.state.players[ctx.playerId]?.hand ?? [], 'hand');
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    if (ctx.matchState) {
        return queueNightmarePrompt(
            ctx,
            `${SALLY}_play_modifier`,
            'Sally：选择要作为额外行动打出的角色修正牌',
            'ui.nightmare_before_christmas_sally_play_modifier_title',
            options,
            'hand',
        );
    }
    const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => isCharacterModifier(candidate.defId));
    if (!card) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return { events: [grantContextualExtraAction(ctx, SALLY, { restrictToCardUid: card.uid })] };
}

function lockShockBarrelSpecial(ctx: AbilityContext): AbilityResult {
    const options = buildCharacterModifierCardOptions(ctx.state.players[ctx.playerId]?.hand ?? [], 'hand');
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    if (ctx.matchState) {
        return queueNightmarePrompt(
            ctx,
            `${LOCK_SHOCK_BARREL}_play_modifier`,
            'Lock, Shock & Barrel：选择要打到计分基地的角色修正牌',
            'ui.nightmare_before_christmas_lock_shock_and_barrel_play_modifier_title',
            options,
            'hand',
            { baseIndex: ctx.baseIndex },
        );
    }
    const card = ctx.state.players[ctx.playerId]?.hand.find(candidate => isCharacterModifier(candidate.defId));
    if (!card) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_target', ctx.now)] };
    return {
        events: [grantContextualExtraAction(ctx, LOCK_SHOCK_BARREL, {
            playTiming: 'immediate',
            restrictToBase: ctx.baseIndex,
            restrictToCardUid: card.uid,
        })],
    };
}

function zeroAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    return buildValidatedReturnEvents(ctx.state, {
        minionUid: ctx.sourceCardUid,
        minionDefId: ZERO,
        fromBaseIndex: ctx.sourceBaseIndex,
        toPlayerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        reason: ZERO,
        now: ctx.now,
        sourcePlayerId: ctx.sourceControllerId,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: ZERO,
        sourceControllerId: ctx.sourceControllerId,
        sourceBaseIndex: ctx.sourceBaseIndex,
        sourceKind: 'nonAction',
    });
}

function halloweenTownFolks(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndDrawMatches({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            count: 3,
            maxPick: 1,
            predicate: card => isCharacterModifier(card.defId),
            reason: HALLOWEEN_TOWN_FOLKS,
            now: ctx.now,
        }).events,
    };
}

function christmasWillBeOurs(ctx: AbilityContext): AbilityResult {
    return { events: [grantContextualExtraAction(ctx, CHRISTMAS_WILL_BE_OURS)] };
}

function ghostlyPresents(ctx: AbilityContext): AbilityResult {
    const target = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) return { events: [] };
    return {
        events: [
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: ctx.cardUid,
                    defId: ctx.defId,
                    ownerId: ctx.playerId,
                    reason: GHOSTLY_PRESENTS,
                    sourcePlayerId: ctx.playerId,
                    sourceCardUid: ctx.cardUid,
                    sourceDefId: ctx.defId,
                    sourceControllerId: ctx.playerId,
                    sourceBaseIndex: ctx.baseIndex,
                },
                timestamp: ctx.now,
            } as OngoingDetachedEvent,
            grantContextualExtraMinion(ctx, GHOSTLY_PRESENTS, undefined, { powerMax: 3 }),
        ],
    };
}

function oogieBoogie(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.baseIndex);
    if (!target || toBaseIndex === undefined) return { events: [] };
    const options = ctx.state.bases
        .map((candidateBase, targetBaseIndex) => ({
            id: `base-${targetBaseIndex}`,
            label: cardLabel(candidateBase.defId),
            value: {
                baseIndex: ctx.baseIndex,
                hostUid: target.uid,
                hostDefId: target.defId,
                targetBaseIndex,
                targetBaseDefId: candidateBase.defId,
            },
            displayMode: 'button' as const,
        }))
        .filter(option => option.value.targetBaseIndex !== ctx.baseIndex);
    if (ctx.matchState) {
        return queueNightmarePrompt(
            ctx,
            `${OOGIE_BOOGIE}_move_character`,
            'Oogie Boogie：选择是否移动这个角色到另一个基地',
            'ui.nightmare_before_christmas_oogie_boogie_move_character_title',
            [createSkipOption('不移动', 'ui.skip') as PromptOption<NightmareModifierChoice>, ...options],
            'base',
            { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId },
            { autoRefresh: 'base' },
        );
    }
    return {
        events: [{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: ctx.baseIndex,
                toBaseIndex,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                reason: OOGIE_BOOGIE,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function winterSurprise(ctx: AbilityContext): AbilityResult {
    const options = buildCharacterModifierCardOptions(ctx.state.players[ctx.playerId]?.discard ?? [], 'discard');
    if (ctx.matchState && options.length > 0) {
        return queueNightmarePrompt(
            ctx,
            `${WINTER_SURPRISE}_play_modifier`,
            'Winter Surprise：选择弃牌堆中的角色修正牌作为额外行动打出',
            'ui.nightmare_before_christmas_winter_surprise_play_modifier_title',
            options,
            'discard',
            { sourceCardUid: ctx.cardUid, sourceDefId: ctx.defId, sourceBaseIndex: ctx.baseIndex },
        );
    }
    return {
        events: [
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: ctx.cardUid,
                defId: ctx.defId,
                ownerId: ctx.playerId,
                reason: WINTER_SURPRISE,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                expectedLocation: 'any',
            }),
        ],
    };
}

function sandyClawsAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const host = base?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!host) return [];
    return [
        ...buildValidatedReturnEvents(ctx.state, {
            minionUid: host.uid,
            minionDefId: host.defId,
            fromBaseIndex: ctx.sourceBaseIndex,
            toPlayerId: host.owner,
            reason: SANDY_CLAWS_COSTUME,
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: SANDY_CLAWS_COSTUME,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceKind: 'action',
        }),
        ...buildValidatedCardToDeckBottomEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            defId: SANDY_CLAWS_COSTUME,
            ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
            reason: SANDY_CLAWS_COSTUME,
            now: ctx.now,
            sourcePlayerId: ctx.sourceControllerId,
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: SANDY_CLAWS_COSTUME,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
            expectedLocation: 'bases',
        }).filter((event): event is CardToDeckBottomEvent => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM),
    ];
}

function halloweenTownAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const options = buildAttachedModifierOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (ctx.matchState && options.length > 0) {
        return queueNightmarePrompt(
            { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now },
            `${BASE_HALLOWEEN_TOWN}_modifiers`,
            'Halloween Town：选择要洗入牌库的角色修正牌',
            'ui.base_halloween_town_modifiers_title',
            options,
            'generic',
            { baseIndex: ctx.baseIndex },
            { multi: { min: 0, max: options.length }, responseValidationMode: 'live', genericIntent: 'card-pool' },
        );
    }
    const selected = base.minions.flatMap(minion =>
        minion.attachedActions
            .filter(action => isCharacterModifier(action.defId) && getActionOwnerId(action) === ctx.playerId)
            .map(action => ({ action, ownerId: getActionOwnerId(action) })));
    if (selected.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const selectedByOwner = new Map<PlayerId, string[]>();
    for (const { action, ownerId } of selected) {
        events.push(...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: action.uid,
            defId: action.defId,
            ownerId,
            reason: BASE_HALLOWEEN_TOWN,
            now: ctx.now,
            expectedLocation: 'minion',
            sourcePlayerId: ctx.playerId,
            sourceDefId: BASE_HALLOWEEN_TOWN,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }));
        selectedByOwner.set(ownerId, [...(selectedByOwner.get(ownerId) ?? []), action.uid]);
    }
    for (const [ownerId, cardUids] of selectedByOwner) {
        const owner = ctx.state.players[ownerId];
        if (!owner) continue;
        const deckUids = [
            ...owner.deck.map(card => card.uid),
            ...cardUids,
        ];
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: ctx.random ? ctx.random.shuffle(deckUids) : deckUids,
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
    }
    return { events };
}

function spiralHillAfterScoring(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const options: PromptOption<NightmareCardChoice | NightmareModifierChoice>[] = [
        createSkipOption('不返回角色修正牌', 'ui.skip') as PromptOption<NightmareCardChoice | NightmareModifierChoice>,
        ...buildCharacterModifierCardOptions(ctx.state.players[ctx.playerId]?.discard ?? [], 'discard'),
        ...buildAttachedModifierOptions(ctx.state, ctx.baseIndex, ctx.playerId),
    ];
    if (ctx.matchState && options.length > 1) {
        return queueNightmarePrompt(
            { matchState: ctx.matchState, playerId: ctx.playerId, now: ctx.now },
            `${BASE_SPIRAL_HILL}_modifier`,
            'Spiral Hill：选择要返回手牌的角色修正牌',
            'ui.base_spiral_hill_modifier_title',
            options,
            'generic',
            { baseIndex: ctx.baseIndex },
            { responseValidationMode: 'live', genericIntent: 'card-pool' },
        );
    }
    return { events: [] };
}

function zombieDuckToyVp(state: SmashUpCore, baseIndex: number, playerId: PlayerId, currentVp: number): number {
    if (currentVp <= 0) return 0;
    const base = state.bases[baseIndex];
    if (!base) return 0;
    let delta = 0;
    for (const host of base.minions) {
        for (const action of host.attachedActions) {
            if (action.defId !== ZOMBIE_DUCK_TOY) continue;
            const controllerId = getActionControllerId(action);
            if (host.controller === controllerId && playerId === controllerId) delta += 1;
            if (host.controller !== controllerId && playerId === host.controller) delta -= 1;
        }
    }
    return delta;
}

export function registerNightmareBeforeChristmasAbilities(): void {
    registerInteractionHandler(`${JACK}_recover`, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as NightmareCardChoice;
        const card = selected.cardUid && selected.defId
            ? state.core.players[playerId]?.discard.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isCharacterModifier(candidate.defId))
            : undefined;
        return {
            state,
            events: card
                ? [recoverCardsFromDiscard(playerId, [card.uid], JACK, timestamp)]
                : [],
        };
    });

    registerInteractionHandler(`${JACK}_trigger`, (state, playerId, value, data, random, timestamp) => {
        const selected = value as NightmareModifierChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined;
        if (selected.mode === 'draw') {
            return {
                state,
                events: buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
            };
        }
        const target = selected.baseIndex !== undefined && selected.targetMinionUid
            ? state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.targetMinionUid)
            : undefined;
        return {
            state,
            events: target && selected.baseIndex !== undefined
                ? [{
                    type: SU_EVENTS.POWER_COUNTER_ADDED,
                    payload: {
                        minionUid: target.uid,
                        baseIndex: selected.baseIndex,
                        amount: 1,
                        reason: JACK,
                        sourcePlayerId: playerId,
                        sourceCardUid: continuation?.sourceCardUid,
                        sourceDefId: JACK,
                        sourceControllerId: playerId,
                        sourceBaseIndex: continuation?.sourceBaseIndex,
                    },
                    timestamp,
                } as SmashUpEvent]
                : [],
        };
    });

    registerInteractionHandler(`${DR_FINKELSTEIN}_move_modifier`, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as NightmareModifierChoice;
        const modifier = findAttachedModifier(state.core, selected);
        const destination = selected.targetBaseIndex !== undefined && selected.targetMinionUid
            ? state.core.bases[selected.targetBaseIndex]?.minions.find(minion =>
                minion.uid === selected.targetMinionUid
                && minion.uid !== selected.hostUid)
            : undefined;
        return {
            state,
            events: modifier && destination && selected.targetBaseIndex !== undefined
                ? [{
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: {
                        cardUid: modifier.action.uid,
                        defId: modifier.action.defId,
                        ownerId: getActionOwnerId(modifier.action),
                        sourcePlayerId: playerId,
                        targetType: 'minion',
                        targetBaseIndex: selected.targetBaseIndex,
                        targetMinionUid: destination.uid,
                        metadata: modifier.action.metadata,
                        talentUsed: modifier.action.talentUsed,
                    },
                    timestamp,
                } as OngoingAttachedEvent]
                : [],
        };
    });

    registerInteractionHandler(`${SALLY}_play_modifier`, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as NightmareCardChoice;
        const card = selected.cardUid && selected.defId
            ? state.core.players[playerId]?.hand.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isCharacterModifier(candidate.defId))
            : undefined;
        return {
            state,
            events: card
                ? [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, SALLY, { restrictToCardUid: card.uid })]
                : [],
        };
    });

    registerInteractionHandler(`${LOCK_SHOCK_BARREL}_play_modifier`, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as NightmareCardChoice;
        const continuation = data?.continuationContext as { baseIndex?: number } | undefined;
        const card = selected.cardUid && selected.defId
            ? state.core.players[playerId]?.hand.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isCharacterModifier(candidate.defId))
            : undefined;
        return {
            state,
            events: card && continuation?.baseIndex !== undefined
                ? [grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, LOCK_SHOCK_BARREL, {
                    playTiming: 'immediate',
                    restrictToBase: continuation.baseIndex,
                    restrictToCardUid: card.uid,
                })]
                : [],
        };
    });

    registerInteractionHandler(`${OOGIE_BOOGIE}_move_character`, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as NightmareModifierChoice;
        if (selected.skip) return { state, events: [] };
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceDefId?: string } | undefined;
        const target = selected.baseIndex !== undefined && selected.hostUid
            ? state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.hostUid)
            : undefined;
        const destination = selected.targetBaseIndex !== undefined ? state.core.bases[selected.targetBaseIndex] : undefined;
        return {
            state,
            events: target && destination && selected.baseIndex !== undefined && selected.targetBaseIndex !== undefined && selected.targetBaseIndex !== selected.baseIndex
                ? [{
                    type: SU_EVENTS.MINION_MOVED,
                    payload: {
                        minionUid: target.uid,
                        minionDefId: target.defId,
                        fromBaseIndex: selected.baseIndex,
                        toBaseIndex: selected.targetBaseIndex,
                        sourcePlayerId: playerId,
                        sourceCardUid: continuation?.sourceCardUid,
                        sourceDefId: continuation?.sourceDefId ?? OOGIE_BOOGIE,
                        sourceControllerId: playerId,
                        sourceBaseIndex: selected.baseIndex,
                        reason: OOGIE_BOOGIE,
                    },
                    timestamp,
                } as SmashUpEvent]
                : [],
        };
    });

    registerInteractionHandler(`${WINTER_SURPRISE}_play_modifier`, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as NightmareCardChoice;
        const continuation = data?.continuationContext as { sourceCardUid?: string; sourceDefId?: string; sourceBaseIndex?: number } | undefined;
        const card = selected.cardUid && selected.defId
            ? state.core.players[playerId]?.discard.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isCharacterModifier(candidate.defId))
            : undefined;
        return {
            state,
            events: card && continuation?.sourceCardUid
                ? [
                    recoverCardsFromDiscard(playerId, [card.uid], WINTER_SURPRISE, timestamp),
                    grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, WINTER_SURPRISE, { restrictToCardUid: card.uid }),
                    ...buildValidatedCardToDeckBottomEvents(state.core, {
                        cardUid: continuation.sourceCardUid,
                        defId: continuation.sourceDefId ?? WINTER_SURPRISE,
                        ownerId: playerId,
                        reason: WINTER_SURPRISE,
                        now: timestamp,
                        sourcePlayerId: playerId,
                        sourceCardUid: continuation.sourceCardUid,
                        sourceDefId: continuation.sourceDefId ?? WINTER_SURPRISE,
                        sourceControllerId: playerId,
                        sourceBaseIndex: continuation.sourceBaseIndex,
                        expectedLocation: 'any',
                    }),
                ]
                : [],
        };
    });

    registerInteractionHandler(`${BASE_HALLOWEEN_TOWN}_modifiers`, (state, playerId, value, data, random, timestamp) => {
        const choices = (Array.isArray(value) ? value : value ? [value] : []) as NightmareModifierChoice[];
        const continuation = data?.continuationContext as { baseIndex?: number } | undefined;
        const selected = choices
            .map(choice => findAttachedModifier(state.core, { ...choice, baseIndex: continuation?.baseIndex ?? choice.baseIndex, ownerId: playerId }))
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        const events: SmashUpEvent[] = [];
        const selectedByOwner = new Map<PlayerId, string[]>();
        for (const { action, baseIndex } of selected) {
            const ownerId = getActionOwnerId(action);
            events.push(...buildValidatedOngoingDetachEvents(state.core, {
                cardUid: action.uid,
                defId: action.defId,
                ownerId,
                reason: BASE_HALLOWEEN_TOWN,
                now: timestamp,
                expectedLocation: 'minion',
                sourcePlayerId: playerId,
                sourceDefId: BASE_HALLOWEEN_TOWN,
                sourceControllerId: playerId,
                sourceBaseIndex: baseIndex,
            }));
            selectedByOwner.set(ownerId, [...(selectedByOwner.get(ownerId) ?? []), action.uid]);
        }
        for (const [ownerId, cardUids] of selectedByOwner) {
            const owner = state.core.players[ownerId];
            if (!owner) continue;
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: random.shuffle([...owner.deck.map(card => card.uid), ...cardUids]),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        return { state, events };
    });

    registerInteractionHandler(`${BASE_SPIRAL_HILL}_modifier`, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as NightmareCardChoice & NightmareModifierChoice;
        if (selected.skip) return { state, events: [] };
        const continuation = data?.continuationContext as { baseIndex?: number } | undefined;
        if (selected.zone === 'discard' && selected.cardUid && selected.defId) {
            const card = state.core.players[playerId]?.discard.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isCharacterModifier(candidate.defId));
            return {
                state,
                events: card ? [recoverCardsFromDiscard(playerId, [card.uid], BASE_SPIRAL_HILL, timestamp)] : [],
            };
        }
        const modifier = findAttachedModifier(state.core, { ...selected, baseIndex: continuation?.baseIndex ?? selected.baseIndex, ownerId: playerId });
        return {
            state,
            events: modifier
                ? buildValidatedOngoingDetachEvents(state.core, {
                    cardUid: modifier.action.uid,
                    defId: modifier.action.defId,
                    ownerId: playerId,
                    reason: BASE_SPIRAL_HILL,
                    now: timestamp,
                    expectedLocation: 'minion',
                    destination: 'hand',
                    sourcePlayerId: playerId,
                    sourceDefId: BASE_SPIRAL_HILL,
                    sourceControllerId: playerId,
                    sourceBaseIndex: modifier.baseIndex,
                })
                : [],
        };
    });

    registerAbilityProgram(JACK, 'onPlay', { program: createEffectProgram(jackOnPlay) });
    registerAbilityProgram(DR_FINKELSTEIN, 'talent', { program: createEffectProgram(drFinkelsteinTalent) });
    registerAbilityProgram(SALLY, 'talent', { program: createEffectProgram(sallyTalent) });
    registerAbilityProgram(LOCK_SHOCK_BARREL, 'special', { program: createEffectProgram(lockShockBarrelSpecial) });
    registerAbilityProgram(HALLOWEEN_TOWN_FOLKS, 'onPlay', { program: createEffectProgram(halloweenTownFolks) });
    registerAbilityProgram(CHRISTMAS_WILL_BE_OURS, 'onPlay', { program: createEffectProgram(christmasWillBeOurs) });
    registerAbilityProgram(GHOSTLY_PRESENTS, 'onPlay', { program: createEffectProgram(ghostlyPresents) });
    registerAbilityProgram(OOGIE_BOOGIE, 'onPlay', { program: createEffectProgram(oogieBoogie) });
    registerAbilityProgram(WINTER_SURPRISE, 'onPlay', { program: createEffectProgram(winterSurprise) });

    registerTrigger(JACK, 'onActionPlayed', jackOnCharacterModifierPlayed, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => ctx.playerId === ctx.sourceControllerId
            && !!ctx.triggerCardDefId
            && isCharacterModifier(ctx.triggerCardDefId),
    });
    registerTrigger(ZERO, 'afterScoring', zeroAfterScoring, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(SANDY_CLAWS_COSTUME, 'afterScoring', sandyClawsAfterScoring, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerCardAbilitySuppression(OOGIE_BOOGIE, (state) => collectCharacterModifiers(state)
        .filter(entry => entry.action.defId === OOGIE_BOOGIE)
        .map(entry => entry.host.uid));
    registerBaseVpModifier(ZOMBIE_DUCK_TOY, zombieDuckToyVp);
    registerBaseAbility(BASE_HALLOWEEN_TOWN, 'afterScoring', halloweenTownAfterScoring, {
        mandatory: false,
        canTrigger: ctx => collectCharacterModifiers(ctx.state, ctx.baseIndex).length > 0,
    });
    registerBaseAbility(BASE_SPIRAL_HILL, 'afterScoring', spiralHillAfterScoring, {
        mandatory: false,
        canTrigger: ctx => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base?.minions.length) return false;
            return collectCharacterModifiers(ctx.state, ctx.baseIndex).length > 0
                || Object.values(ctx.state.players).some(player => player.discard.some(card => isCharacterModifier(card.defId)));
        },
    });
}
