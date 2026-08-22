import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import {
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    canControllerPlayTitan,
    createSkipOption,
    getMinionPower,
    getTitanByUid,
    grantContextualExtraAction,
    moveTitan,
    playTitan,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { isMinionTargetAllowed } from '../domain/effectSemantics';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInterceptor, registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import type {
    ActionCardDef,
    BaseReplacedEvent,
    CardInstance,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
    TitanState,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

const GORGODZOLLA = 'kaiju_gorgodzolla';

type JohnnyActionChoice = {
    cardUid?: string;
    defId?: string;
    fromBaseIndex?: number;
    skip?: boolean;
};

type KaijuDestroyContinuation = {
    sourcePlayerId: string;
    sourceCardUid?: string;
    sourceDefId: string;
    sourceControllerId: string;
    sourceBaseIndex: number;
};

function getTargetBaseIndex(ctx: AbilityContext): number {
    return ctx.targetBaseIndex ?? ctx.baseIndex;
}

function buildKaijuDestroyContinuation(ctx: AbilityContext): KaijuDestroyContinuation {
    return {
        sourcePlayerId: ctx.playerId,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceControllerId: ctx.playerId,
        sourceBaseIndex: getTargetBaseIndex(ctx),
    };
}

function getBaseLabel(core: SmashUpCore, baseIndex: number): string {
    const base = core.bases[baseIndex];
    return getBaseDef(base?.defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function getGorgodzolla(core: SmashUpCore, playerId: string): TitanState | undefined {
    return (core.titans ?? []).find(titan => titan.defId === GORGODZOLLA && titan.controllerId === playerId);
}

function buildMoveOrPlayGorgodzollaEvents(
    core: SmashUpCore,
    playerId: string,
    targetBaseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const titan = getGorgodzolla(core, playerId);
    const targetBase = core.bases[targetBaseIndex];
    if (!titan || !targetBase) return [];

    if (titan.location.zone === 'base') {
        if (titan.location.baseIndex === targetBaseIndex) return [];
        return [
            moveTitan(
                titan.uid,
                titan.defId,
                titan.location.baseIndex,
                targetBaseIndex,
                reason,
                now,
                targetBase.defId,
            ),
        ];
    }

    if (!canControllerPlayTitan(core, playerId, titan.uid)) return [];
    return [playTitan(titan, playerId, targetBaseIndex, reason, now, targetBase.defId)];
}

function buildBreakpointDelta(baseIndex: number, delta: number, reason: string, timestamp: number): SmashUpEvent {
    return {
        type: SU_EVENTS.BREAKPOINT_MODIFIED,
        payload: { baseIndex, delta, reason },
        timestamp,
    } as SmashUpEvent;
}

function buildTempBasePowerEvent(
    playerId: string,
    baseIndex: number,
    amount: number,
    reason: string,
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.TEMP_BASE_POWER_MODIFIED,
        payload: { playerId, baseIndex, amount, reason },
        timestamp,
    } as SmashUpEvent;
}

function buildDetachOngoingEvent(
    action: { uid: string; defId: string; ownerId: string },
    reason: string,
    source: AbilityContext,
    destination?: 'discard' | 'hand',
): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({
        cardUid: action.uid,
        defId: action.defId,
        ownerId: action.ownerId,
        reason,
        destination,
        sourcePlayerId: source.playerId,
        sourceCardUid: source.cardUid,
        sourceDefId: source.defId,
        sourceControllerId: source.playerId,
        sourceBaseIndex: getTargetBaseIndex(source),
        now: source.now,
    });
}

function getJohnnyActionChoices(core: SmashUpCore, playerId: string): JohnnyActionChoice[] {
    return core.bases.flatMap((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        return base.ongoingActions
            .filter(action => action.ownerId === playerId)
            .map(action => ({
                cardUid: action.uid,
                defId: action.defId,
                fromBaseIndex: baseIndex,
                label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${baseName}`,
            }));
    });
}

function getRecoverableBaseActions(discard: CardInstance[]): Array<{ cardUid: string; defId: string; label: string }> {
    return discard
        .filter(card => {
            const def = getCardDef(card.defId);
            return def?.type === 'action'
                && ((def as ActionCardDef).ongoingTarget === 'base' || (def as ActionCardDef).playNeedsBase === true);
        })
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            label: getCardDef(card.defId)?.name ?? card.defId,
        }));
}

function kaijuConflict(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'kaiju_kaiju_conflict'),
            grantContextualExtraAction(ctx, 'kaiju_kaiju_conflict'),
        ],
    };
}

function kaijuAlliance(ctx: AbilityContext): AbilityResult {
    return {
        events: ctx.state.bases.map((_base, baseIndex) =>
            buildBreakpointDelta(baseIndex, -4, 'kaiju_kaiju_alliance', ctx.now)),
    };
}

function kaijuStomp(ctx: AbilityContext): AbilityResult {
    return {
        events: [buildBreakpointDelta(getTargetBaseIndex(ctx), -3, 'kaiju_stomp', ctx.now)],
    };
}

function kaijuPickUpABus(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const choices = getRecoverableBaseActions(player?.discard ?? []);
    if (choices.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (choices.length === 1) {
        return { events: [recoverCardsFromDiscard(ctx.playerId, [choices[0].cardUid], 'kaiju_pick_up_a_bus', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `kaiju_pick_up_a_bus_${ctx.now}`,
        ctx.playerId,
        '拾起一辆巴士：选择弃牌堆中可打在基地上的行动牌',
        choices.map((choice, index) => ({
            id: `card-${index}`,
            label: choice.label,
            value: choice,
            displayCard: { defId: choice.defId, cardUid: choice.cardUid },
        })),
        { sourceId: 'kaiju_pick_up_a_bus', targetType: 'generic', titleKey: 'ui.kaiju_pick_up_a_bus_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function getDestroyableMinions(
    core: SmashUpCore,
    baseIndex: number,
    playerId: string,
    maxPower: number,
    controller: 'opponent' | 'any',
) {
    const base = core.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => controller === 'any' || minion.controller !== playerId)
        .filter(minion => getMinionPower(core, minion, baseIndex) <= maxPower)
        .filter(minion => isMinionTargetAllowed(core, minion, baseIndex, {
            sourcePlayerId: playerId,
            effectType: 'destroy',
            mode: 'preview',
        }))
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId} (${getMinionPower(core, minion, baseIndex)})`,
        }));
}

function queueDestroyMinionPrompt(
    ctx: AbilityContext,
    sourceId: string,
    targets: ReturnType<typeof getDestroyableMinions>,
    optional: boolean,
    multi?: { min: number; max: number },
): AbilityResult {
    if (targets.length === 0) {
        return { events: [] };
    }
    const options = buildMinionTargetOptions(targets, {
        state: ctx.state,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        effectType: 'destroy',
    });
    if (options.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        `${getCardDef(ctx.defId)?.name ?? ctx.defId}：选择要消灭的随从`,
        optional ? [createSkipOption(), ...options] : options,
        {
            sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
            ...(multi ? { multi } : {}),
        },
    );
    (interaction.data as { continuationContext?: KaijuDestroyContinuation }).continuationContext = buildKaijuDestroyContinuation(ctx);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function radioactiveBreath(ctx: AbilityContext): AbilityResult {
    const baseIndex = getTargetBaseIndex(ctx);
    const targets = getDestroyableMinions(ctx.state, baseIndex, ctx.playerId, 2, 'opponent');
    return queueDestroyMinionPrompt(ctx, 'kaiju_radioactive_breath', targets, true, {
        min: 0,
        max: targets.length,
    });
}

function tailSmash(ctx: AbilityContext): AbilityResult {
    const baseIndex = getTargetBaseIndex(ctx);
    const targets = getDestroyableMinions(ctx.state, baseIndex, ctx.playerId, 3, 'opponent');
    return queueDestroyMinionPrompt(ctx, 'kaiju_tail_smash', targets, false);
}

function wadeThroughBuildings(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[getTargetBaseIndex(ctx)];
    if (!base) return { events: [] };
    const events: SmashUpEvent[] = [];
    for (const action of base.ongoingActions) {
        if (action.ownerId !== ctx.playerId) {
            events.push(buildDetachOngoingEvent(action, 'kaiju_wade_through_the_buildings', ctx));
        }
    }
    for (const minion of base.minions) {
        for (const action of minion.attachedActions) {
            if (action.ownerId !== ctx.playerId) {
                events.push(buildDetachOngoingEvent(action, 'kaiju_wade_through_the_buildings', ctx));
            }
        }
    }
    return { events };
}

function kaijuOhNo(ctx: AbilityContext): AbilityResult {
    return {
        events: buildMoveOrPlayGorgodzollaEvents(ctx.state, ctx.playerId, getTargetBaseIndex(ctx), 'kaiju_oh_no', ctx.now),
    };
}

function tinyPriestesses(ctx: AbilityContext): AbilityResult {
    return {
        events: buildMoveOrPlayGorgodzollaEvents(ctx.state, ctx.playerId, ctx.baseIndex, 'kaiju_tiny_priestesses', ctx.now),
    };
}

function kaijuJohnny(ctx: AbilityContext): AbilityResult {
    const choices = getJohnnyActionChoices(ctx.state, ctx.playerId);
    if (choices.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `kaiju_johnny_${ctx.now}`,
        ctx.playerId,
        '约翰：选择一个你在基地上的行动牌返回手牌，并在本基地作为额外行动打出',
        [
            createSkipOption(),
            ...choices.map((choice, index) => ({
                id: `action-${index}`,
                label: (choice as JohnnyActionChoice & { label: string }).label,
                value: choice,
                displayCard: choice.defId ? { defId: choice.defId, cardUid: choice.cardUid } : undefined,
            })),
        ],
        {
            sourceId: 'kaiju_johnny',
            targetType: 'ongoing',
            autoResolveIfSingle: false,
            titleKey: 'ui.kaiju_johnny_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        targetBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function getMovableTitans(core: SmashUpCore) {
    return (core.titans ?? [])
        .filter(titan => titan.location.zone === 'base')
        .flatMap(titan => {
            if (titan.location.zone !== 'base') return [];
            const base = core.bases[titan.location.baseIndex];
            if (!base) return [];
            const destinations = core.bases
                .map((_candidate, baseIndex) => baseIndex)
                .filter(baseIndex => baseIndex !== titan.location.baseIndex);
            if (destinations.length === 0) return [];
            return [{
                titan,
                baseIndex: titan.location.baseIndex,
                label: `${getCardDef(titan.defId)?.name ?? titan.defId} @ ${getBaseDef(base.defId)?.name ?? base.defId}`,
            }];
        });
}

function theySayHesGotToGo(ctx: AbilityContext): AbilityResult {
    const titans = getMovableTitans(ctx.state);
    if (titans.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (titans.length === 1) {
        return queueTitanDestinationPrompt(ctx, titans[0].titan, titans[0].baseIndex, 'kaiju_they_say_hes_got_to_go_choose_base');
    }

    const interaction = createSimpleChoice(
        `kaiju_they_say_hes_got_to_go_choose_titan_${ctx.now}`,
        ctx.playerId,
        '他们说它该走了：选择一个泰坦',
        titans.map((entry, index) => ({
            id: `titan-${index}`,
            label: entry.label,
            value: { titanUid: entry.titan.uid, defId: entry.titan.defId, fromBaseIndex: entry.baseIndex },
        })),
        {
            sourceId: 'kaiju_they_say_hes_got_to_go_choose_titan',
            targetType: 'generic',
            titleKey: 'ui.kaiju_they_say_hes_got_to_go_choose_titan_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function queueTitanDestinationPrompt(
    ctx: AbilityContext,
    titan: TitanState,
    fromBaseIndex: number,
    sourceId: string,
): AbilityResult {
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(ctx.state, baseIndex) }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
    if (destinations.length === 0) return { events: [] };

    if (destinations.length === 1) {
        return {
            events: [
                moveTitan(
                    titan.uid,
                    titan.defId,
                    fromBaseIndex,
                    destinations[0].baseIndex,
                    'kaiju_they_say_hes_got_to_go',
                    ctx.now,
                    ctx.state.bases[destinations[0].baseIndex]?.defId,
                ),
            ],
        };
    }

    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        '他们说它该走了：选择目标基地',
        buildBaseTargetOptions(destinations, ctx.state),
        { sourceId, targetType: 'base', titleKey: 'ui.kaiju_choose_destination_base_title' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        defId: titan.defId,
        fromBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function thereGoesTokyo(ctx: AbilityContext): AbilityResult {
    const titan = getGorgodzolla(ctx.state, ctx.playerId);
    if (!titan || titan.location.zone !== 'base') return { events: [] };
    const fromBaseIndex = titan.location.baseIndex;
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: getBaseLabel(ctx.state, baseIndex) }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
    if (destinations.length === 0 || !ctx.state.baseDeck[0]) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const sourceId = 'kaiju_there_goes_tokyo_choose_base';
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        '东京毁灭：选择 Gorgodzolla 要移动到的基地',
        buildBaseTargetOptions(destinations, ctx.state),
        { sourceId, targetType: 'base', titleKey: 'ui.kaiju_there_goes_tokyo_choose_base_title' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        titanUid: titan.uid,
        defId: titan.defId,
        fromBaseIndex,
        oldBaseDefId: ctx.state.bases[fromBaseIndex]?.defId,
        newBaseDefId: ctx.state.baseDeck[0],
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function kaijuFollyProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base || ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    if (ctx.targetMinion.controller !== ctx.targetMinion.owner) return false;
    return base.ongoingActions.some(action =>
        action.defId === 'kaiju_the_folly_of_men'
        && action.ownerId === ctx.targetMinion.controller);
}

function kaijuFollyActionInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = (event as OngoingDetachedEvent).payload;
    if (!payload.sourcePlayerId || payload.sourcePlayerId === payload.ownerId) return undefined;

    for (const base of state.bases) {
        const hasFolly = base.ongoingActions.some(action =>
            action.defId === 'kaiju_the_folly_of_men'
            && action.ownerId === payload.ownerId
            && action.uid !== payload.cardUid);
        if (!hasFolly) continue;
        if (base.ongoingActions.some(action => action.uid === payload.cardUid && action.ownerId === payload.ownerId)) {
            return null;
        }
        if (base.minions.some(minion =>
            minion.controller === payload.ownerId
            && minion.attachedActions.some(action => action.uid === payload.cardUid && action.ownerId === payload.ownerId))) {
            return null;
        }
    }
    return undefined;
}

function tokyoOnActionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (ctx.actionTargetBaseIndex !== ctx.baseIndex) return { events: [] };
    return {
        events: [buildTempBasePowerEvent(ctx.playerId, ctx.baseIndex, 3, 'base_tokyo', ctx.now)],
    };
}

export function registerKaijuAbilities(): void {
    registerAbility('kaiju_there_goes_tokyo', 'onPlay', thereGoesTokyo);
    registerAbility('kaiju_kaiju_conflict', 'onPlay', kaijuConflict);
    registerAbility('kaiju_kaiju_alliance', 'onPlay', kaijuAlliance);
    registerAbility('kaiju_pick_up_a_bus', 'onPlay', kaijuPickUpABus);
    registerAbility('kaiju_they_say_hes_got_to_go', 'onPlay', theySayHesGotToGo);
    registerAbility('kaiju_oh_no', 'onPlay', kaijuOhNo);
    registerAbility('kaiju_radioactive_breath', 'onPlay', radioactiveBreath);
    registerAbility('kaiju_tail_smash', 'onPlay', tailSmash);
    registerAbility('kaiju_stomp', 'onPlay', kaijuStomp);
    registerAbility('kaiju_wade_through_the_buildings', 'onPlay', wadeThroughBuildings);
    registerAbility('kaiju_johnny', 'onPlay', kaijuJohnny);
    registerAbility('kaiju_tiny_priestesses', 'onPlay', tinyPriestesses);

    registerProtection('kaiju_the_folly_of_men', 'action', kaijuFollyProtection);
    registerInterceptor('kaiju_the_folly_of_men', kaijuFollyActionInterceptor);
    registerBaseAbility('base_tokyo', 'onActionPlayed', tokyoOnActionPlayed);
}

export function registerKaijuInteractionHandlers(): void {
    registerInteractionHandler('kaiju_pick_up_a_bus', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string } | undefined;
        if (!selected?.cardUid) return { state, events: [] };
        return { state, events: [recoverCardsFromDiscard(playerId, [selected.cardUid], 'kaiju_pick_up_a_bus', timestamp)] };
    });

    registerInteractionHandler('kaiju_radioactive_breath', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as { continuationContext?: KaijuDestroyContinuation } | undefined)?.continuationContext;
        const selections = (Array.isArray(value) ? value : [value]) as Array<{ skip?: boolean; minionUid?: string; defId?: string; baseIndex?: number }>;
        const events = selections
            .filter(selection => !selection.skip && selection.minionUid && selection.defId && selection.baseIndex !== undefined)
            .flatMap(selection => buildValidatedDestroyEvents(state.core, {
                minionUid: selection.minionUid!,
                minionDefId: selection.defId!,
                fromBaseIndex: selection.baseIndex!,
                destroyerId: playerId,
                reason: 'kaiju_radioactive_breath',
                now: timestamp,
                sourcePlayerId: continuation?.sourcePlayerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: continuation?.sourceDefId,
                sourceControllerId: continuation?.sourceControllerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
                sourceKind: 'action',
            }));
        return { state, events };
    });

    registerInteractionHandler('kaiju_tail_smash', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as { continuationContext?: KaijuDestroyContinuation } | undefined)?.continuationContext;
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'kaiju_tail_smash',
                now: timestamp,
                sourcePlayerId: continuation?.sourcePlayerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: continuation?.sourceDefId,
                sourceControllerId: continuation?.sourceControllerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('kaiju_johnny', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as JohnnyActionChoice | undefined;
        const continuation = (data as { continuationContext?: { targetBaseIndex?: number } } | undefined)?.continuationContext;
        if (
            selected?.skip
            || !selected?.cardUid
            || !selected.defId
            || selected.fromBaseIndex === undefined
            || continuation?.targetBaseIndex === undefined
        ) {
            return { state, events: [] };
        }

        const action = state.core.bases[selected.fromBaseIndex]?.ongoingActions
            .find(candidate => candidate.uid === selected.cardUid && candidate.ownerId === playerId);
        if (!action) return { state, events: [] };

        return {
            state,
            events: [
                buildOngoingDetachedEvent({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    reason: 'kaiju_johnny',
                    destination: 'hand',
                    sourcePlayerId: playerId,
                    sourceDefId: 'kaiju_johnny',
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation.targetBaseIndex,
                    now: timestamp,
                }),
                grantContextualExtraAction(
                    { playerId, now: timestamp, matchState: state },
                    'kaiju_johnny',
                    {
                        playTiming: 'immediate',
                        restrictToBase: continuation.targetBaseIndex,
                        restrictToCardUid: action.uid,
                        restrictToCardDefId: action.defId,
                    },
                ),
            ],
        };
    });

    registerInteractionHandler('kaiju_they_say_hes_got_to_go_choose_titan', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { titanUid?: string; fromBaseIndex?: number } | undefined;
        const titan = selected?.titanUid ? getTitanByUid(state.core, selected.titanUid) : undefined;
        if (!titan || titan.location.zone !== 'base') return { state, events: [] };
        const result = queueTitanDestinationPrompt({
            state: state.core,
            matchState: state,
            playerId,
            cardUid: '',
            defId: 'kaiju_they_say_hes_got_to_go',
            baseIndex: selected?.fromBaseIndex ?? titan.location.baseIndex,
            random: _random,
            now: timestamp,
        }, titan, titan.location.baseIndex, 'kaiju_they_say_hes_got_to_go_choose_base');
        return { state: result.matchState ?? state, events: result.events };
    });

    registerInteractionHandler('kaiju_they_say_hes_got_to_go_choose_base', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as { continuationContext?: { titanUid?: string; defId?: string; fromBaseIndex?: number } } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !continuation?.titanUid || !continuation.defId || continuation.fromBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [moveTitan(
                continuation.titanUid,
                continuation.defId,
                continuation.fromBaseIndex,
                selected.baseIndex,
                'kaiju_they_say_hes_got_to_go',
                timestamp,
                selected.baseDefId,
            )],
        };
    });

    registerInteractionHandler('kaiju_there_goes_tokyo_choose_base', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        const continuation = (data as {
            continuationContext?: {
                titanUid?: string;
                defId?: string;
                fromBaseIndex?: number;
                oldBaseDefId?: string;
                newBaseDefId?: string;
            };
        } | undefined)?.continuationContext;
        if (
            selected?.baseIndex === undefined
            || !continuation?.titanUid
            || !continuation.defId
            || continuation.fromBaseIndex === undefined
            || !continuation.oldBaseDefId
            || !continuation.newBaseDefId
        ) {
            return { state, events: [] };
        }

        return {
            state,
            events: [
                moveTitan(
                    continuation.titanUid,
                    continuation.defId,
                    continuation.fromBaseIndex,
                    selected.baseIndex,
                    'kaiju_there_goes_tokyo',
                    timestamp,
                    selected.baseDefId,
                ),
                {
                    type: SU_EVENTS.BASE_CLEARED,
                    payload: { baseIndex: continuation.fromBaseIndex, baseDefId: continuation.oldBaseDefId },
                    timestamp,
                } as SmashUpEvent,
                {
                    type: SU_EVENTS.BASE_REPLACED,
                    payload: {
                        baseIndex: continuation.fromBaseIndex,
                        oldBaseDefId: continuation.oldBaseDefId,
                        newBaseDefId: continuation.newBaseDefId,
                    },
                    timestamp,
                } as BaseReplacedEvent,
            ],
        };
    });
}
