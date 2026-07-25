import type { MatchState, PlayerId } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility, resolveTalent, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler, type InteractionHandler } from '../domain/abilityInteractionHandlers';
import { startDuel } from '../domain/duel';
import { registerInterceptor, registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { reduce } from '../domain/reduce';
import {
    addPowerCounter,
    addTitanPowerCounter,
    addTempPower,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    destroyMinion,
    findMinionByAttachedCard,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraAction,
    playTitan,
    removeTitanFromPlay,
} from '../domain/abilityHelpers';
import { getCardDef } from '../data/cards';
import type {
    CardInstance,
    CardsDiscardedEvent,
    MinionCardDef,
    MinionOnBase,
    MinionPlayedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
    TitanPlayedEvent,
    TitanRemovedFromPlayEvent,
    TitanState,
} from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';

const SERAPHIM_DEF_ID = 'paladins_seraphim';
const DEFAULT_RANDOM: AbilityContext['random'] = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function withContinuation<TData extends object>(
    data: TData,
    continuationContext: Record<string, unknown>,
): void {
    Object.assign(data, { continuationContext });
}

function getMinionBasePower(defId: string): number {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def as MinionCardDef).power : 0;
}

function getOwnSeraphimInPlay(state: SmashUpCore, playerId: PlayerId): TitanState | undefined {
    return (state.titans ?? []).find(titan =>
        titan.defId === SERAPHIM_DEF_ID
        && titan.controllerId === playerId
        && titan.location.zone === 'base',
    );
}

function getSetAsideSeraphim(state: SmashUpCore, playerId: PlayerId): TitanState | undefined {
    return (state.titans ?? []).find(titan =>
        titan.defId === SERAPHIM_DEF_ID
        && titan.ownerId === playerId
        && titan.location.zone === 'setaside',
    );
}

function playSeraphimHere(
    ctx: Pick<AbilityContext, 'state' | 'matchState' | 'playerId' | 'baseIndex' | 'now' | 'random'> & Partial<Pick<AbilityContext, 'cardUid'>>,
    reason: string,
    options?: { currentTalentMinionUid?: string },
): AbilityResult {
    if (getOwnSeraphimInPlay(ctx.state, ctx.playerId)) return { events: [] };
    const titan = getSetAsideSeraphim(ctx.state, ctx.playerId);
    const base = ctx.state.bases[ctx.baseIndex];
    if (!titan || !base) return { events: [] };
    const playEvent = playTitan(titan, ctx.playerId, ctx.baseIndex, reason, ctx.now, base.defId);
    const sourceMinion = ctx.cardUid ? findMinionOnBases(ctx.state, ctx.cardUid)?.minion : undefined;
    const currentTalentMinionUid = options?.currentTalentMinionUid
        ?? (sourceMinion?.controller === ctx.playerId ? sourceMinion.uid : undefined);
    const events = [
        playEvent,
        ...buildSeraphimEnterEvents(ctx.state, playEvent.payload, ctx.now, ctx.random, currentTalentMinionUid),
    ];
    const destroyTargets = getSeraphimDestroyTargets(ctx.state, ctx.baseIndex);
    if (destroyTargets.length <= 1) return { events };

    const interaction = createSimpleChoice(
        `paladins_seraphim_destroy_${titan.uid}_${ctx.now}`,
        ctx.playerId,
        'paladins_seraphim.choose_minion',
        buildMinionTargetOptions(destroyTargets, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'paladins_seraphim', targetType: 'minion' },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function hasOwnTitanAtBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): boolean {
    return (state.titans ?? []).some(titan =>
        titan.controllerId === playerId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex,
    );
}

function getHostForAttachedTalent(ctx: AbilityContext): { minion: MinionOnBase; baseIndex: number } | undefined {
    const found = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    if (!found || found.baseIndex !== ctx.baseIndex) return undefined;
    if (found.minion.controller !== ctx.playerId) return undefined;
    return found;
}

function countOtherTalentsUsedHereThisTurn(state: SmashUpCore, baseIndex: number, playerId: PlayerId, currentOngoingUid?: string): number {
    const base = state.bases[baseIndex];
    if (!base) return 0;
    let count = 0;
    for (const minion of base.minions) {
        if (minion.controller === playerId && minion.talentUsed) count += 1;
        for (const action of minion.attachedActions) {
            if (action.ownerId === playerId && action.uid !== currentOngoingUid && action.talentUsed) count += 1;
        }
    }
    for (const action of base.ongoingActions) {
        if (action.ownerId === playerId && action.uid !== currentOngoingUid && action.talentUsed) count += 1;
    }
    for (const titan of state.titans ?? []) {
        if (
            titan.controllerId === playerId
            && titan.location.zone === 'base'
            && titan.location.baseIndex === baseIndex
            && titan.talentUsed
        ) {
            count += 1;
        }
    }
    return count;
}

function makeOngoingDetachedEvent(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    sourcePlayerId: PlayerId,
    reason: string,
    now: number,
): OngoingDetachedEvent {
    return {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceDefId: defId,
        },
        timestamp: now,
    } as OngoingDetachedEvent;
}

function makeCardReturnedToHandEvent(cardUid: string, ownerId: PlayerId, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
        payload: { playerId: ownerId, cardUids: [cardUid], reason: 'paladins_climb_the_holy_stairs_return' },
        timestamp: now,
    } as SmashUpEvent;
}

function applyEventsToCore(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((core, event) => reduce(core, event), state);
}

function makeCardsDiscardedEvent(playerId: PlayerId, cardUids: string[], now: number): CardsDiscardedEvent {
    return {
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: { playerId, cardUids },
        timestamp: now,
    };
}

function buildHandDiscardOption(card: CardInstance) {
    return {
        id: `discard-${card.uid}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        displayMode: 'card' as const,
        previewDefId: card.defId,
    };
}

function readStringSet(value: unknown): Set<string> | undefined {
    if (!Array.isArray(value)) return undefined;
    return new Set(value.filter((entry): entry is string => typeof entry === 'string'));
}

function paladinsRoland(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found || found.baseIndex !== ctx.baseIndex) return { events: [] };
    if (getMinionPower(ctx.state, found.minion, ctx.baseIndex) <= 8) return { events: [] };
    return playSeraphimHere(ctx, 'paladins_roland');
}

function paladinsDevoutPastor(ctx: AbilityContext): AbilityResult {
    if (hasOwnTitanAtBase(ctx.state, ctx.playerId, ctx.baseIndex)) return { events: [] };
    const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    const projectedCore = applyEventsToCore(ctx.state, drawEvents);
    const handAfterDraw = projectedCore.players[ctx.playerId]?.hand ?? [];
    if (handAfterDraw.length === 0) return { events: drawEvents };

    if (ctx.matchState) {
        const interaction = createSimpleChoice(
            `paladins_devout_pastor_discard_${ctx.cardUid}_${ctx.now}`,
            ctx.playerId,
            '虔诚的牧师：选择一张手牌弃掉',
            handAfterDraw.map(buildHandDiscardOption),
            {
                sourceId: 'paladins_devout_pastor_discard',
                targetType: 'hand',
                responseValidationMode: 'live',
                titleKey: 'ui.paladins_devout_pastor_discard_title',
            },
        );
        interaction.data.allowedCardUids = handAfterDraw.map(card => card.uid);
        return {
            events: drawEvents,
            matchState: queueInteraction(ctx.matchState, interaction),
        };
    }

    return {
        events: [
            ...drawEvents,
            makeCardsDiscardedEvent(ctx.playerId, [handAfterDraw[0].uid], ctx.now),
        ],
    };
}

function paladinsSeniorMentor(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const options = base.minions
        .filter(minion => (minion.powerCounters ?? 0) === 0)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (options.length === 0) return { events: [] };
    if (options.length === 1) {
        return { events: [addPowerCounter(options[0].uid, ctx.baseIndex, 1, 'paladins_senior_mentor', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `paladins_senior_mentor_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        'paladins_senior_mentor.choose_minion',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'paladins_senior_mentor', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function paladinsDurandal(ctx: AbilityContext): AbilityResult {
    const host = getHostForAttachedTalent(ctx);
    if (!host) return { events: [] };
    if (countOtherTalentsUsedHereThisTurn(ctx.state, ctx.baseIndex, ctx.playerId, ctx.cardUid) >= 3) {
        return { events: [] };
    }
    return playSeraphimHere(ctx, 'paladins_durandal', { currentTalentMinionUid: host.minion.uid });
}

function paladinsKnightsDuel(ctx: AbilityContext): AbilityResult {
    const sourceUid = ctx.targetMinionUid ?? ctx.cardUid;
    const found = findMinionOnBases(ctx.state, sourceUid);
    if (!found || found.minion.controller !== ctx.playerId) return { events: [] };
    const base = ctx.state.bases[found.baseIndex];
    const enemyOptions = base.minions
        .filter(minion => minion.controller !== ctx.playerId)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: found.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (enemyOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `paladins_knights_duel_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        'paladins_knights_duel.choose_opponent',
        buildMinionTargetOptions(enemyOptions, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'paladins_knights_duel', targetType: 'minion' },
    );
    withContinuation(interaction.data, {
        challengerMinionUid: found.minion.uid,
    });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function paladinsBattleCry(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let baseIndex = 0; baseIndex < ctx.state.bases.length; baseIndex += 1) {
        for (const minion of ctx.state.bases[baseIndex].minions) {
            if (minion.controller !== ctx.playerId) continue;
            events.push(addTempPower(minion.uid, baseIndex, 1, 'paladins_battle_cry', ctx.now));
            if (minion.talentUsed) {
                events.push(addTempPower(minion.uid, baseIndex, 1, 'paladins_battle_cry_talent', ctx.now));
            }
        }
    }
    return { events };
}

function paladinsHolyLightBlessing(ctx: AbilityContext): AbilityResult {
    const host = getHostForAttachedTalent(ctx);
    if (!host) return { events: [] };
    return { events: [addTempPower(host.minion.uid, host.baseIndex, 3, 'paladins_holy_light_blessing', ctx.now)] };
}

function collectOngoingActionTargets(state: SmashUpCore) {
    return state.bases.flatMap((base, baseIndex) => [
        ...base.ongoingActions.map(action => ({
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex,
            label: getCardDef(action.defId)?.name ?? action.defId,
        })),
        ...base.minions.flatMap(minion => minion.attachedActions.map(action => ({
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex,
            label: getCardDef(action.defId)?.name ?? action.defId,
        }))),
    ]);
}

function paladinsExpel(ctx: AbilityContext): AbilityResult {
    const targets = collectOngoingActionTargets(ctx.state);
    if (targets.length === 0) return { events: [] };
    if (targets.length === 1) {
        const target = targets[0];
        return {
            events: [{
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: target.uid,
                    defId: target.defId,
                    ownerId: target.ownerId,
                    reason: 'paladins_expel',
                    sourcePlayerId: ctx.playerId,
                    sourceDefId: ctx.defId,
                },
                timestamp: ctx.now,
            } as OngoingDetachedEvent],
        };
    }
    const interaction = createSimpleChoice(
        `paladins_expel_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        'paladins_expel.choose_action',
        targets.map(target => ({
            id: `ongoing-${target.uid}`,
            label: target.label,
            value: { cardUid: target.uid },
            displayMode: 'button' as const,
        })),
        { sourceId: 'paladins_expel', targetType: 'button' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function paladinsSpreadTheOracle(ctx: AbilityContext): AbilityResult {
    if (!getHostForAttachedTalent(ctx)) return { events: [] };
    return { events: [grantContextualExtraAction(ctx, 'paladins_spread_the_oracle')] };
}

function paladinsClimbTheHolyStairs(ctx: AbilityContext): AbilityResult {
    const host = getHostForAttachedTalent(ctx);
    if (!host) return { events: [] };
    if ((host.minion.powerCounters ?? 0) <= 4) return { events: [] };
    const result = playSeraphimHere(ctx, 'paladins_climb_the_holy_stairs', { currentTalentMinionUid: host.minion.uid });
    const events = result.events;
    if (events.length === 0) return { events: [] };
    events.push(
        makeOngoingDetachedEvent(ctx.cardUid, ctx.defId, ctx.playerId, ctx.playerId, 'paladins_climb_the_holy_stairs_return', ctx.now),
        makeCardReturnedToHandEvent(ctx.cardUid, ctx.playerId, ctx.now),
    );
    return { ...result, events };
}

function buildPlayMinionEvent(
    card: CardInstance,
    playerId: PlayerId,
    baseIndex: number,
    now: number,
): SmashUpEvent {
    const def = getCardDef(card.defId);
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            baseIndex,
            power: def?.type === 'minion' ? def.power : 0,
            consumesNormalLimit: false,
        },
        sourceCommandType: SU_COMMANDS.PLAY_MINION,
        timestamp: now,
    } as SmashUpEvent;
}

function queueHeavenlyTalentPrompt(state: MatchState<SmashUpCore>, playerId: PlayerId, baseIndex: number, now: number): MatchState<SmashUpCore> {
    const base = state.core.bases[baseIndex];
    const talentMinions = (base?.minions ?? []).filter(minion =>
        minion.controller === playerId
        && !minion.talentUsed
        && !!resolveTalent(minion.defId),
    );
    if (talentMinions.length === 0) return state;
    const interaction = createSimpleChoice(
        `paladins_heavenly_soldiers_descend_talent_${now}`,
        playerId,
        'paladins_heavenly_soldiers_descend.choose_talent',
        buildMinionTargetOptions(talentMinions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        })), { state: state.core, sourcePlayerId: playerId }),
        { sourceId: 'paladins_heavenly_soldiers_descend_talent', targetType: 'minion' },
    );
    return queueInteraction(state, interaction);
}

function paladinsHeavenlySoldiersDescend(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionCards = player?.hand.filter(card => card.type === 'minion') ?? [];
    if (minionCards.length === 0) {
        return {
            events: [],
            matchState: queueHeavenlyTalentPrompt(ctx.matchState, ctx.playerId, ctx.baseIndex, ctx.now),
        };
    }
    const interaction = createSimpleChoice(
        `paladins_heavenly_soldiers_descend_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        'paladins_heavenly_soldiers_descend.choose_minion',
        [
            ...minionCards.map(card => ({
                id: `minion-${card.uid}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
            {
                id: 'skip',
                label: '跳过额外随从',
                labelKey: 'ui.paladins_heavenly_soldiers_descend_skip_minion_option',
                value: { skip: true },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'paladins_heavenly_soldiers_descend', targetType: 'hand' },
    );
    withContinuation(interaction.data, { baseIndex: ctx.baseIndex });
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function paladinsNoviceKnightOnTalentUsed(ctx: TriggerContext) {
    if (!ctx.triggerMinionUid || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    if (ctx.triggerMinion.talentUsed) return [];
    if (ctx.sourceCardUid === ctx.triggerMinionUid) return [];
    if (ctx.sourceBaseIndex !== ctx.baseIndex || ctx.sourceBaseIndex === undefined) return [];
    return [addPowerCounter(ctx.sourceCardUid!, ctx.sourceBaseIndex, 1, 'paladins_novice_knight', ctx.now)];
}

function paladinsClimbOnTalentUsed(ctx: TriggerContext) {
    if (!ctx.sourceCardUid || !ctx.triggerMinionUid || ctx.sourceBaseIndex === undefined) return [];
    const found = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!found || found.baseIndex !== ctx.sourceBaseIndex || found.minion.uid !== ctx.triggerMinionUid) return [];
    return [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'paladins_climb_the_holy_stairs', ctx.now)];
}

function paladinsKnightsDuelResolved(ctx: TriggerContext) {
    if (ctx.duelSourceId !== 'paladins_knights_duel') return [];
    if (ctx.duelTie || !ctx.duelWinner || !ctx.duel) return [];
    if (ctx.duelWinner.uid !== ctx.duel.challengerMinionUid) return [];
    if (ctx.duel.sourcePlayerId !== ctx.duelWinner.controller) return [];
    const found = findMinionOnBases(ctx.state, ctx.duelWinner.uid);
    if (!found) return [];
    return [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'paladins_knights_duel', ctx.now)];
}

function countOwnMinionsThatUsedTalentThisTurn(state: SmashUpCore, playerId: PlayerId, currentTalentMinionUid?: string): number {
    const usedCount = state.bases.reduce((count, base) => count + base.minions.filter(minion =>
        minion.controller === playerId && minion.talentUsed
    ).length, 0);
    if (!currentTalentMinionUid) return usedCount;
    const currentMinion = findMinionOnBases(state, currentTalentMinionUid)?.minion;
    if (!currentMinion || currentMinion.controller !== playerId || currentMinion.talentUsed) return usedCount;
    return usedCount + 1;
}

function getSeraphimDestroyTargets(state: SmashUpCore, baseIndex: number) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    return base.minions
        .filter(minion => getMinionPower(state, minion, baseIndex) <= 4)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            owner: minion.owner,
            baseIndex,
            power: getMinionPower(state, minion, baseIndex),
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }))
        .sort((a, b) => a.power - b.power || a.label.localeCompare(b.label));
}

function buildSeraphimEnterEvents(
    state: SmashUpCore,
    payload: TitanPlayedEvent['payload'],
    now: number,
    random: AbilityContext['random'],
    currentTalentMinionUid?: string,
): SmashUpEvent[] {
    if (payload.defId !== SERAPHIM_DEF_ID) return [];
    const events: SmashUpEvent[] = [
        ...buildStandardDrawEvents(state, payload.controllerId, 2, random, now),
    ];
    const talentCount = countOwnMinionsThatUsedTalentThisTurn(state, payload.controllerId, currentTalentMinionUid);
    if (talentCount > 0) {
        events.push(addTitanPowerCounter(payload.titanUid, talentCount, 'paladins_seraphim_talents_used', now));
    }
    const destroyTargets = getSeraphimDestroyTargets(state, payload.baseIndex);
    if (destroyTargets.length === 1) {
        const destroyTarget = destroyTargets[0];
        events.push(destroyMinion(
            destroyTarget.uid,
            destroyTarget.defId,
            destroyTarget.baseIndex,
            destroyTarget.owner,
            payload.controllerId,
            'paladins_seraphim',
            now,
        ));
    }
    return events;
}

function paladinsSeraphimOnTurnEnd(ctx: TriggerContext): SmashUpEvent[] {
    const titan = (ctx.state.titans ?? []).find(candidate =>
        candidate.uid === ctx.sourceCardUid
        && candidate.defId === SERAPHIM_DEF_ID
        && candidate.location.zone === 'base'
        && candidate.controllerId === ctx.playerId,
    );
    return titan ? [removeTitanFromPlay(titan, 'paladins_seraphim_turn_end', ctx.now)] : [];
}

function paladinsTitanBaseInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent[] | undefined {
    if (event.type === SU_EVENTS.TITAN_PLAYED) {
        const payload = (event as TitanPlayedEvent).payload;
        const base = state.bases[payload.baseIndex];
        if (base?.defId !== 'base_paladins_monastery') return undefined;
        return [
            event,
            ...buildStandardDrawEvents(state, payload.ownerId, 1, DEFAULT_RANDOM, event.timestamp),
        ];
    }

    if (event.type !== SU_EVENTS.TITAN_REMOVED_FROM_PLAY) return undefined;
    const payload = (event as TitanRemovedFromPlayEvent).payload;
    if (payload.reason !== 'titan_clash' || payload.fromBaseIndex === undefined) return undefined;
    const base = state.bases[payload.fromBaseIndex];
    if (base?.defId !== 'base_paladins_roncesvalles_gorge') return undefined;
    const winner = (state.titans ?? []).find(titan =>
        titan.uid !== payload.titanUid
        && titan.location.zone === 'base'
        && titan.location.baseIndex === payload.fromBaseIndex,
    );
    if (!winner) return undefined;
    return [
        event,
        {
            type: SU_EVENTS.VP_AWARDED,
            payload: { playerId: winner.controllerId, amount: 1, reason: 'base_paladins_roncesvalles_gorge' },
            timestamp: event.timestamp,
        } as SmashUpEvent,
    ];
}

function handleSeniorMentor(state: MatchState<SmashUpCore>, _playerId: PlayerId, value: unknown, _data: unknown, _random: unknown, timestamp: number) {
    const selected = value as { minionUid?: string; uid?: string } | undefined;
    const minionUid = selected?.minionUid ?? selected?.uid;
    const found = minionUid ? findMinionOnBases(state.core, minionUid) : undefined;
    if (!found || (found.minion.powerCounters ?? 0) !== 0) return { state, events: [] };
    return { state, events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'paladins_senior_mentor', timestamp)] };
}

function handleDevoutPastorDiscard(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as { cardUid?: string } | undefined;
    const cardUid = selected?.cardUid;
    if (!cardUid) return { state, events: [] };
    const allowedCardUids = readStringSet(data?.allowedCardUids);
    if (!allowedCardUids?.has(cardUid)) return { state, events: [] };
    const player = state.core.players[playerId];
    if (!player?.hand.some(card => card.uid === cardUid)) return { state, events: [] };
    return { state, events: [makeCardsDiscardedEvent(playerId, [cardUid], timestamp)] };
}

function handleKnightsDuel(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as { minionUid?: string; uid?: string } | undefined;
    const challengedMinionUid = selected?.minionUid ?? selected?.uid;
    const continuation = data?.continuationContext as { challengerMinionUid?: string } | undefined;
    if (!continuation?.challengerMinionUid || !challengedMinionUid) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'paladins_knights_duel',
            sourcePlayerId: playerId,
            challengerMinionUid: continuation.challengerMinionUid,
            challengedMinionUid,
            outcome: 'destroy_loser',
        }, timestamp),
        events: [],
    };
}

function handleExpel(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: unknown, _random: unknown, timestamp: number) {
    const selected = value as { cardUid?: string } | undefined;
    const target = collectOngoingActionTargets(state.core).find(candidate => candidate.uid === selected?.cardUid);
    if (!target) return { state, events: [] };
    return {
        state,
        events: [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: target.uid,
                defId: target.defId,
                ownerId: target.ownerId,
                reason: 'paladins_expel',
                sourcePlayerId: playerId,
                sourceDefId: 'paladins_expel',
            },
            timestamp,
        } as OngoingDetachedEvent],
    };
}

function handleSeraphimDestroy(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: unknown, _random: unknown, timestamp: number) {
    const selected = value as { minionUid?: string; uid?: string; baseIndex?: number } | undefined;
    const minionUid = selected?.minionUid ?? selected?.uid;
    const found = minionUid ? findMinionOnBases(state.core, minionUid) : undefined;
    if (!found || selected?.baseIndex !== undefined && selected.baseIndex !== found.baseIndex) return { state, events: [] };
    if (getMinionPower(state.core, found.minion, found.baseIndex) > 4) return { state, events: [] };
    return {
        state,
        events: [destroyMinion(
            found.minion.uid,
            found.minion.defId,
            found.baseIndex,
            found.minion.owner,
            playerId,
            'paladins_seraphim',
            timestamp,
        )],
    };
}

function handleHeavenlyMinion(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) {
    const selected = value as { skip?: boolean; cardUid?: string; defId?: string } | undefined;
    const continuation = data?.continuationContext as { baseIndex?: number } | undefined;
    const baseIndex = continuation?.baseIndex;
    if (baseIndex === undefined || !state.core.bases[baseIndex]) return { state, events: [] };
    const events: SmashUpEvent[] = [];
    if (!selected?.skip && selected?.cardUid && selected.defId) {
        const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId && candidate.type === 'minion');
        if (card) events.push(buildPlayMinionEvent(card, playerId, baseIndex, timestamp));
    }
    const nextCore = events.reduce((core, event) => {
        // The pipeline will reduce these events after the handler returns; this local snapshot is only for prompt availability.
        if (event.type !== SU_EVENTS.MINION_PLAYED) return core;
        const payload = (event as MinionPlayedEvent).payload;
        return {
            ...core,
            bases: core.bases.map((base, index) => index === baseIndex
                ? {
                    ...base,
                    minions: [...base.minions, {
                        uid: payload.cardUid,
                        defId: payload.defId,
                        controller: playerId,
                        owner: playerId,
                        basePower: getMinionBasePower(payload.defId),
                        powerModifier: 0,
                        talentUsed: false,
                        attachedActions: [],
                    }],
                }
                : base),
        };
    }, state.core);
    const promptState = queueHeavenlyTalentPrompt({ ...state, core: nextCore }, playerId, baseIndex, timestamp);
    return {
        state: { ...promptState, core: state.core },
        events,
    };
}

function handleHeavenlyTalent(state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: unknown, random: AbilityContext['random'], timestamp: number) {
    const selected = value as { minionUid?: string; uid?: string } | undefined;
    const minionUid = selected?.minionUid ?? selected?.uid;
    const found = minionUid ? findMinionOnBases(state.core, minionUid) : undefined;
    if (!found || found.minion.controller !== playerId || found.minion.talentUsed) return { state, events: [] };
    const executor = resolveTalent(found.minion.defId);
    if (!executor) return { state, events: [] };
    const result = executor({
        state: state.core,
        matchState: state,
        playerId,
        cardUid: found.minion.uid,
        defId: found.minion.defId,
        baseIndex: found.baseIndex,
        random,
        now: timestamp,
    });
    return {
        state: result.matchState ?? state,
        events: [{
            type: SU_EVENTS.TALENT_USED,
            payload: { playerId, minionUid: found.minion.uid, defId: found.minion.defId, baseIndex: found.baseIndex },
            sourceCommandType: SU_COMMANDS.USE_TALENT,
            timestamp,
        } as SmashUpEvent, ...result.events],
    };
}

export function registerPaladinAbilities(): void {
    registerAbility('paladins_roland', 'talent', paladinsRoland);
    registerAbility('paladins_devout_pastor', 'talent', paladinsDevoutPastor);
    registerAbility('paladins_senior_mentor', 'talent', paladinsSeniorMentor);
    registerAbility('paladins_durandal', 'talent', paladinsDurandal);
    registerAbility('paladins_knights_duel', 'onPlay', paladinsKnightsDuel);
    registerAbility('paladins_battle_cry', 'onPlay', paladinsBattleCry);
    registerAbility('paladins_holy_light_blessing', 'talent', paladinsHolyLightBlessing);
    registerAbility('paladins_expel', 'onPlay', paladinsExpel);
    registerAbility('paladins_spread_the_oracle', 'talent', paladinsSpreadTheOracle);
    registerAbility('paladins_climb_the_holy_stairs', 'talent', paladinsClimbTheHolyStairs);
    registerAbility('paladins_heavenly_soldiers_descend', 'special', paladinsHeavenlySoldiersDescend);

    registerTrigger('paladins_novice_knight', 'onTalentUsed', paladinsNoviceKnightOnTalentUsed, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('paladins_climb_the_holy_stairs', 'onTalentUsed', paladinsClimbOnTalentUsed, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('paladins_knights_duel', 'onDuelResolved', paladinsKnightsDuelResolved, {
        global: true,
        globalZones: ['discard'],
        playerContext: 'sourceController',
        baseScoped: false,
    });
    registerTrigger(SERAPHIM_DEF_ID, 'onTurnEnd', paladinsSeraphimOnTurnEnd, {
    });
    registerInterceptor('base_paladins_monastery', paladinsTitanBaseInterceptor);
    registerInterceptor('base_paladins_roncesvalles_gorge', paladinsTitanBaseInterceptor);

    registerInteractionHandler('paladins_senior_mentor', handleSeniorMentor as InteractionHandler);
    registerInteractionHandler('paladins_devout_pastor_discard', handleDevoutPastorDiscard as InteractionHandler);
    registerInteractionHandler('paladins_knights_duel', handleKnightsDuel as InteractionHandler);
    registerInteractionHandler('paladins_expel', handleExpel as InteractionHandler);
    registerInteractionHandler('paladins_seraphim', handleSeraphimDestroy as InteractionHandler);
    registerInteractionHandler('paladins_heavenly_soldiers_descend', handleHeavenlyMinion as InteractionHandler);
    registerInteractionHandler('paladins_heavenly_soldiers_descend_talent', handleHeavenlyTalent as InteractionHandler);
}
