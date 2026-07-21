import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    addPermanentPower,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    canControllerPlayTitan,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    playTitan,
    recoverCardsFromDiscard,
    removePowerCounter,
} from '../domain/abilityHelpers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import { registerOngoingPowerModifier } from '../domain/ongoingModifiers';
import { registerInterceptor, registerProtection, type ProtectionCheckContext } from '../domain/ongoingEffects';
import type {
    CardToDeckTopEvent,
    CardsDrawnEvent,
    DeckReorderedEvent,
    MinionOnBase,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { matchesDefId } from '../domain/utils';

const WALKING_CASTLE = 'magical_girls_walking_castle';
const POWER_MAID = 'magical_girls_power_maid';
const LUNAR_CAPTAIN = 'magical_girls_lunar_captain';

function getVariantScopedDefId(sourceDefId: string, baseDefId: string): string {
    return sourceDefId.endsWith('_pod') ? `${baseDefId}_pod` : baseDefId;
}

type MinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type CardSearchChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    zone: 'deck' | 'discard';
    label: string;
};

type MoveChoice = {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    sourceCardUid?: string;
    sourceDefId?: string;
    sourceBaseIndex?: number;
};

type QPointCardChoice = {
    kind: 'minion' | 'ongoing' | 'attached_action';
    uid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    label: string;
    minionUid?: string;
    cardUid?: string;
};

type QPointContext = {
    baseIndex: number;
    playerIds: PlayerId[];
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(state: SmashUpCore, baseIndex: number): string {
    return getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
}

function noTargets(ctx: AbilityContext): AbilityResult {
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
}

function countOwnMinionsAtBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): number {
    return state.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId).length ?? 0;
}

function getWalkingCastle(state: SmashUpCore, playerId: PlayerId) {
    return (state.titans ?? []).find(candidate =>
        candidate.defId === WALKING_CASTLE && candidate.controllerId === playerId);
}

function getWalkingCastleEligibleBases(state: SmashUpCore, playerId: PlayerId) {
    return state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(state, baseIndex) }))
        .filter(candidate => countOwnMinionsAtBase(state, candidate.baseIndex, playerId) >= 2);
}

function buildPlayWalkingCastleEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    targetBaseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const titan = getWalkingCastle(state, playerId);
    const targetBase = state.bases[targetBaseIndex];
    if (!titan || !targetBase) return [];
    if (countOwnMinionsAtBase(state, targetBaseIndex, playerId) < 2) return [];
    if (!canControllerPlayTitan(state, playerId, titan.uid)) return [];
    return [playTitan(titan, playerId, targetBaseIndex, reason, now, targetBase.defId)];
}

function collectMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): MinionTarget[] {
    const targets: MinionTarget[] = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (!predicate(minion, baseIndex)) return;
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${cardLabel(minion.defId)} @ ${baseLabel(state, baseIndex)}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            });
        });
    });
    return targets;
}

function findMinion(state: SmashUpCore, minionUid: string): { minion: MinionOnBase; baseIndex: number } | undefined {
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const minion = state.bases[baseIndex]?.minions.find(candidate => candidate.uid === minionUid);
        if (minion) return { minion, baseIndex };
    }
    return undefined;
}

function buildBreakpointDelta(baseIndex: number, delta: number, reason: string, timestamp: number): SmashUpEvent {
    return {
        type: SU_EVENTS.BREAKPOINT_MODIFIED,
        payload: { baseIndex, delta, reason },
        timestamp,
    } as SmashUpEvent;
}

function buildCardToDeckTop(cardUid: string, defId: string, ownerId: PlayerId, reason: string, timestamp: number): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: { cardUid, defId, ownerId, reason },
        timestamp,
    };
}

function buildDrawCardFromDeck(playerId: PlayerId, cardUid: string, timestamp: number): CardsDrawnEvent {
    return {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId, count: 1, cardUids: [cardUid] },
        timestamp,
    };
}

function appendTimedPowerModifier(
    matchState: MatchState<SmashUpCore>,
    minionUid: string,
    amount: number,
    reason: string,
): MatchState<SmashUpCore> {
    const expiresOnTurnNumber = matchState.core.turnNumber + matchState.core.turnOrder.length;
    return {
        ...matchState,
        core: {
            ...matchState.core,
            timedPowerModifiers: [
                ...(matchState.core.timedPowerModifiers ?? []),
                { minionUid, amount, expiresOnTurnNumber, reason },
            ],
        },
    };
}

function queueMinionPrompt(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    targets: MinionTarget[],
    effectType: 'destroy' | 'move' | 'affect' | 'power_change',
    optional = false,
    titleKey?: string,
    titleParams?: Record<string, string | number>,
): AbilityResult {
    const options = buildMinionTargetOptions(targets, {
        state: ctx.state,
        sourcePlayerId: ctx.playerId,
        sourceDefId: ctx.defId,
        effectType: effectType === 'power_change' ? 'affect' : effectType,
    });
    if (options.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        title,
        optional ? [createSkipOption(), ...options] : options,
        { sourceId, targetType: 'minion', autoResolveIfSingle: !optional, titleKey, titleParams },
    );
    (interaction.data as {
        continuationContext?: {
            sourceCardUid?: string;
            sourceDefId?: string;
            sourceBaseIndex?: number;
        };
    }).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function coronetAttack(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const maxPower = countOwnMinionsAtBase(ctx.state, baseIndex, ctx.playerId);
    const targets = collectMinions(ctx.state, (minion, candidateBaseIndex) =>
        candidateBaseIndex === baseIndex
        && minion.controller !== ctx.playerId
        && getMinionPower(ctx.state, minion, candidateBaseIndex) <= maxPower);

    if (ctx.targetMinionUid) {
        const target = targets.find(candidate => candidate.uid === ctx.targetMinionUid);
        if (!target) return noTargets(ctx);
        return {
            events: buildValidatedDestroyEvents(ctx.state, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'magical_girls_coronet_attack',
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: baseIndex,
                sourceKind: 'action',
            }),
        };
    }

    return queueMinionPrompt(
        ctx,
        'magical_girls_coronet_attack',
        '冠冕攻击：选择不由你控制且力量不高于你这里随从数量的随从',
        targets,
        'destroy',
        false,
        'ui.magical_girls_coronet_attack_title',
    );
}

function recoverGroupedDiscardMinions(playerId: PlayerId, choices: Array<{ ownerId: PlayerId; cardUid: string }>, reason: string, timestamp: number): SmashUpEvent[] {
    const byOwner = new Map<PlayerId, string[]>();
    choices.forEach((choice) => {
        byOwner.set(choice.ownerId, [...(byOwner.get(choice.ownerId) ?? []), choice.cardUid]);
    });
    return Array.from(byOwner.entries()).map(([ownerId, cardUids]) =>
        recoverCardsFromDiscard(ownerId, cardUids, reason, timestamp));
}

function collectDiscardMinionChoices(state: SmashUpCore): CardSearchChoice[] {
    return Object.values(state.players).flatMap(player =>
        player.discard
            .filter(card => getCardDef(card.defId)?.type === 'minion')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                ownerId: player.id,
                zone: 'discard' as const,
                label: `${cardLabel(card.defId)}（玩家 ${player.id} 弃牌堆）`,
            })));
}

function lunarHealingLoveSpell(ctx: AbilityContext): AbilityResult {
    const choices = collectDiscardMinionChoices(ctx.state);
    if (choices.length === 0) return noTargets(ctx);

    const playersWithChoices = new Set(choices.map(choice => choice.ownerId));
    const interaction = createSimpleChoice(
        `magical_girls_lunar_healing_love_spell_${ctx.now}`,
        ctx.playerId,
        '爱的咒语：为每个玩家弃牌堆各选择一个随从返回拥有者手牌',
        choices.map((choice, index) => ({
            id: `card-${index}`,
            label: choice.label,
            value: choice,
            displayCard: { defId: choice.defId, cardUid: choice.cardUid },
        })),
        {
            sourceId: 'magical_girls_lunar_healing_love_spell',
            titleKey: 'ui.magical_girls_lunar_healing_love_spell_title',
            targetType: 'generic',
            multi: { min: playersWithChoices.size, max: playersWithChoices.size },
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function kissTheSkySpell(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = (player?.discard ?? []).filter(card => getCardDef(card.defId)?.type === 'minion');
    const extra = grantContextualExtraAction(ctx, 'magical_girls_kiss_the_sky_spell');
    if (minions.length === 0) {
        return { events: [extra, buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    if (minions.length === 1) {
        return { events: [recoverCardsFromDiscard(ctx.playerId, [minions[0].uid], 'magical_girls_kiss_the_sky_spell', ctx.now), extra] };
    }
    const interaction = createSimpleChoice(
        `magical_girls_kiss_the_sky_spell_${ctx.now}`,
        ctx.playerId,
        '快要接地：选择你弃牌堆中的一个随从加入手牌',
        minions.map((card, index) => ({
            id: `card-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: ctx.playerId },
            displayCard: { defId: card.defId, cardUid: card.uid },
        })),
        {
            sourceId: 'magical_girls_kiss_the_sky_spell',
            titleKey: 'ui.magical_girls_kiss_the_sky_spell_title',
            targetType: 'generic',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = { grantExtraAction: true };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function purgeTheDemon(ctx: AbilityContext): AbilityResult {
    const options: Array<{
        id: string;
        label: string;
        value: { mode: 'detach_action' | 'remove_counters'; cardUid?: string; defId?: string; ownerId?: PlayerId; minionUid?: string; baseIndex: number };
        displayCard?: { defId: string; cardUid: string };
    }> = [];

    ctx.state.bases.forEach((base, baseIndex) => {
        base.ongoingActions.forEach((action) => {
            options.push({
                id: `ongoing-${options.length}`,
                label: `摧毁 ${cardLabel(action.defId)} @ ${baseLabel(ctx.state, baseIndex)}`,
                value: { mode: 'detach_action', cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, baseIndex },
                displayCard: { defId: action.defId, cardUid: action.uid },
            });
        });
        base.minions.forEach((minion) => {
            minion.attachedActions.forEach((action) => {
                options.push({
                    id: `attached-${options.length}`,
                    label: `摧毁 ${cardLabel(action.defId)}（附着于 ${cardLabel(minion.defId)}）`,
                    value: { mode: 'detach_action', cardUid: action.uid, defId: action.defId, ownerId: action.ownerId, minionUid: minion.uid, baseIndex },
                    displayCard: { defId: action.defId, cardUid: action.uid },
                });
            });
            if ((minion.powerCounters ?? 0) > 0) {
                options.push({
                    id: `counters-${options.length}`,
                    label: `移除 ${cardLabel(minion.defId)} 上全部 ${minion.powerCounters} 个力量指示物`,
                    value: { mode: 'remove_counters', minionUid: minion.uid, defId: minion.defId, baseIndex },
                    displayCard: { defId: minion.defId, cardUid: minion.uid },
                });
            }
        });
    });

    if (options.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `magical_girls_purge_the_demon_${ctx.now}`,
        ctx.playerId,
        '净化恶魔：摧毁一张行动牌，或移除一张卡上的所有力量指示物',
        options,
        {
            sourceId: 'magical_girls_purge_the_demon',
            titleKey: 'ui.magical_girls_purge_the_demon_title',
            targetType: 'board',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function celestialTeleport(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectMinions(ctx.state, (minion) => minion.controller === ctx.playerId);
    if (ctx.targetMinionUid) {
        const chosen = ownMinions.find(target => target.uid === ctx.targetMinionUid);
        if (!chosen) return noTargets(ctx);
        return queueMoveDestination(ctx, 'magical_girls_celestial_teleport_destination', chosen);
    }
    return queueMinionPrompt(
        ctx,
        'magical_girls_celestial_teleport',
        '传送：选择你的一个随从',
        ownMinions,
        'move',
        false,
        'ui.magical_girls_celestial_teleport_title',
    );
}

function coordination(ctx: AbilityContext): AbilityResult {
    const titan = getWalkingCastle(ctx.state, ctx.playerId);
    const eligibleBases = getWalkingCastleEligibleBases(ctx.state, ctx.playerId);
    const canPlayWalkingCastle = !!titan
        && eligibleBases.length > 0
        && canControllerPlayTitan(ctx.state, ctx.playerId, titan.uid);
    if (!canPlayWalkingCastle) {
        return { events: [grantContextualExtraMinion(ctx, 'magical_girls_coordination')] };
    }

    const options = [
        {
            id: 'extra-minion',
            label: '额外打出一个随从',
            labelKey: 'ui.magical_girls_coordination_extra_minion_option',
            value: { choice: 'extra_minion' },
            displayMode: 'button' as const,
        },
        {
            id: 'walking-castle',
            label: '打出移动城堡泰坦',
            labelKey: 'ui.magical_girls_coordination_walk_castle_option',
            value: { choice: 'walking_castle', titanUid: titan.uid },
            displayMode: 'button' as const,
        },
    ];
    const interaction = createSimpleChoice(
        `magical_girls_coordination_${ctx.now}`,
        ctx.playerId,
        '和谐：额外打出一个随从，或打出移动城堡',
        options,
        {
            sourceId: 'magical_girls_coordination',
            titleKey: 'ui.magical_girls_coordination_title',
            targetType: 'button',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function silverShard(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    Object.values(ctx.state.players).forEach((player) => {
        const discardMinions = player.discard.filter(card => getCardDef(card.defId)?.type === 'minion');
        if (discardMinions.length === 0) return;
        const shuffled = ctx.random.shuffle([...player.deck, ...discardMinions]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: player.id,
                deckUids: shuffled.map(card => card.uid),
            },
            timestamp: ctx.now,
        } as DeckReorderedEvent);
    });
    return { events };
}

function lunarCaptain(ctx: AbilityContext): AbilityResult {
    const maxPower = countOwnMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
    const candidates = (ctx.state.players[ctx.playerId]?.discard ?? [])
        .filter(card => {
            const def = getCardDef(card.defId);
            return def?.type === 'minion' && (def.power ?? 0) <= maxPower;
        });
    if (candidates.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `magical_girls_lunar_captain_${ctx.now}`,
        ctx.playerId,
        '月球骑长：选择你弃牌堆中力量不高于你这里随从数量的随从',
        candidates.map((card, index) => ({
            id: `card-${index}`,
            label: `${cardLabel(card.defId)}（力量 ${getCardDef(card.defId)?.type === 'minion' ? getCardDef(card.defId)?.power : '?' }）`,
            value: { cardUid: card.uid, defId: card.defId, ownerId: ctx.playerId },
            displayCard: { defId: card.defId, cardUid: card.uid },
        })),
        {
            sourceId: 'magical_girls_lunar_captain',
            titleKey: 'ui.magical_girls_lunar_captain_title',
            targetType: 'generic',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function technomagicalLass(ctx: AbilityContext): AbilityResult {
    const maxPower = countOwnMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        baseIndex === ctx.baseIndex
        && minion.controller !== ctx.playerId
        && getMinionPower(ctx.state, minion, baseIndex) <= maxPower);
    return queueMinionPrompt(
        ctx,
        'magical_girls_technomagical_lass',
        'Technomagical Lass：消灭这里一个力量不高于你这里随从数量的敌方随从',
        targets,
        'destroy',
        false,
        'ui.magical_girls_technomagical_lass_title',
    );
}

function bewitchingGal(ctx: AbilityContext): AbilityResult {
    const amount = countOwnMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
    return { events: [buildBreakpointDelta(ctx.baseIndex, -amount, 'magical_girls_bewitching_gal', ctx.now)] };
}

function sakuraWarrior(ctx: AbilityContext): AbilityResult {
    const amount = countOwnMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
    const targets = collectMinions(ctx.state, (_minion, baseIndex) => baseIndex === ctx.baseIndex);
    const result = queueMinionPrompt(
        ctx,
        'magical_girls_sakura_warrior',
        `樱花战士：选择这里一个随从直到你的下回合开始时 -${amount} 力量`,
        targets,
        'power_change',
        false,
        'ui.magical_girls_sakura_warrior_title',
        { amount },
    );
    if (result.matchState) {
        (result.matchState.sys.interaction?.current?.data as { continuationContext?: unknown } | undefined)!.continuationContext = { amount };
    }
    return result;
}

function rainbowGirl(ctx: AbilityContext): AbilityResult {
    const events = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
        .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'magical_girls_rainbow_girl', ctx.now));
    return { events };
}

function collectNamedMinionSearchChoices(state: SmashUpCore, playerId: PlayerId, targetDefId: string): CardSearchChoice[] {
    const player = state.players[playerId];
    if (!player) return [];
    const fromDeck = player.deck
        .filter(card => card.defId === targetDefId)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: playerId,
            zone: 'deck' as const,
            label: `${cardLabel(card.defId)}（牌库）`,
        }));
    const fromDiscard = player.discard
        .filter(card => card.defId === targetDefId)
        .map(card => ({
            cardUid: card.uid,
            defId: card.defId,
            ownerId: playerId,
            zone: 'discard' as const,
            label: `${cardLabel(card.defId)}（弃牌堆）`,
        }));
    return [...fromDeck, ...fromDiscard];
}

function searchNamedMinion(ctx: AbilityContext, sourceBaseDefId: string, targetBaseDefId: string): AbilityResult {
    const sourceId = getVariantScopedDefId(ctx.defId, sourceBaseDefId);
    const targetDefId = getVariantScopedDefId(ctx.defId, targetBaseDefId);
    const choices = collectNamedMinionSearchChoices(ctx.state, ctx.playerId, targetDefId);
    if (choices.length === 0) return noTargets(ctx);
    if (choices.length === 1) {
        const choice = choices[0];
        return {
            events: choice.zone === 'deck'
                ? [buildDrawCardFromDeck(ctx.playerId, choice.cardUid, ctx.now)]
                : [recoverCardsFromDiscard(ctx.playerId, [choice.cardUid], sourceId, ctx.now)],
        };
    }
    const options = choices.map((choice, index) => ({
        id: `card-${index}`,
        label: choice.label,
        value: choice,
        displayCard: { defId: choice.defId, cardUid: choice.cardUid },
    }));
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        `${cardLabel(ctx.defId)}：搜索 ${cardLabel(targetDefId)} 加入手牌`,
        options,
        { sourceId, targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function whiteMagicat(ctx: AbilityContext): AbilityResult {
    return searchNamedMinion(ctx, 'magical_girls_white_magicat', POWER_MAID);
}

function blackMagicat(ctx: AbilityContext): AbilityResult {
    return searchNamedMinion(ctx, 'magical_girls_black_magicat', LUNAR_CAPTAIN);
}

function powerMaid(ctx: AbilityContext): AbilityResult {
    const maxPower = countOwnMinionsAtBase(ctx.state, ctx.baseIndex, ctx.playerId);
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        minion.uid !== ctx.cardUid
        && getMinionPower(ctx.state, minion, baseIndex) <= maxPower
        && ctx.state.bases.length > 1);
    return queueMinionPrompt(
        ctx,
        ctx.defId,
        '女仆：选择力量不高于你这里随从数量的随从，将其移入或移出这里',
        targets,
        'move',
        false,
        'ui.magical_girls_power_maid_title',
    );
}

function akihabaraHigh(ctx: BaseAbilityContext): AbilityResult {
    if (ctx.playerId === undefined || ctx.minionUid === undefined) return { events: [] };
    const events = (ctx.state.bases[ctx.baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.minionUid)
        .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'base_akihabara_high', ctx.now));
    return { events };
}

function collectQPointChoicesForPlayer(state: SmashUpCore, baseIndex: number, playerId: PlayerId): QPointCardChoice[] {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const choices: QPointCardChoice[] = [];
    base.minions.forEach((minion) => {
        if (minion.controller === playerId) {
            choices.push({
                kind: 'minion',
                uid: minion.uid,
                defId: minion.defId,
                ownerId: minion.owner,
                baseIndex,
                label: `${cardLabel(minion.defId)}（随从）`,
                minionUid: minion.uid,
            });
        }
        minion.attachedActions.forEach((action) => {
            if (action.ownerId !== playerId) return;
            choices.push({
                kind: 'attached_action',
                uid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                baseIndex,
                label: `${cardLabel(action.defId)}（附着行动）`,
                cardUid: action.uid,
            });
        });
    });
    base.ongoingActions.forEach((action) => {
        if (action.ownerId !== playerId) return;
        choices.push({
            kind: 'ongoing',
            uid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex,
            label: `${cardLabel(action.defId)}（基地行动）`,
            cardUid: action.uid,
        });
    });
    return choices;
}

function findNextQPointPlayer(state: SmashUpCore, context: QPointContext): PlayerId | undefined {
    return context.playerIds.find(playerId => collectQPointChoicesForPlayer(state, context.baseIndex, playerId).length > 1);
}

function queueQPointPrompt(matchState: MatchState<SmashUpCore>, context: QPointContext, playerId: PlayerId, timestamp: number): MatchState<SmashUpCore> {
    const choices = collectQPointChoicesForPlayer(matchState.core, context.baseIndex, playerId);
    const interaction = createSimpleChoice(
        `base_q_point_${playerId}_${timestamp}`,
        playerId,
        'Q Point：选择你在这里保留的一张牌，其余牌被摧毁',
        choices.map((choice, index) => ({
            id: `card-${index}`,
            label: choice.label,
            value: choice,
            displayCard: { defId: choice.defId, cardUid: choice.uid },
        })),
        {
            sourceId: 'base_q_point',
            titleKey: 'ui.magical_girls_q_point_title',
            targetType: 'board',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = context;
    return queueInteraction(matchState, interaction);
}

function qPointBeforeScoring(ctx: BaseAbilityContext): AbilityResult {
    const matchState = ctx.matchState;
    if (!matchState) return { events: [] };
    const context: QPointContext = {
        baseIndex: ctx.baseIndex,
        playerIds: Object.keys(ctx.state.players) as PlayerId[],
    };
    const nextPlayerId = findNextQPointPlayer(ctx.state, context);
    if (!nextPlayerId) return { events: [] };
    return { events: [], matchState: queueQPointPrompt(matchState, context, nextPlayerId, ctx.now) };
}

function qPointDestroyUnkept(state: SmashUpCore, playerId: PlayerId, keepUid: string, baseIndex: number, timestamp: number): SmashUpEvent[] {
    const choices = collectQPointChoicesForPlayer(state, baseIndex, playerId);
    const destroyMinions = choices.filter(choice => choice.kind === 'minion' && choice.uid !== keepUid);
    const destroyedMinionUids = new Set(destroyMinions.map(choice => choice.uid));
    const detachActions = choices.filter(choice =>
        choice.kind !== 'minion'
        && choice.uid !== keepUid
        && !state.bases[baseIndex]?.minions.some(minion =>
            destroyedMinionUids.has(minion.uid)
            && minion.attachedActions.some(action => action.uid === choice.uid)));

    return [
        ...destroyMinions.flatMap(choice => buildValidatedDestroyEvents(state, {
            minionUid: choice.uid,
            minionDefId: choice.defId,
            fromBaseIndex: baseIndex,
            reason: 'base_q_point',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'base_q_point',
            sourceControllerId: playerId,
            sourceBaseIndex: baseIndex,
            sourceKind: 'nonAction',
        })),
        ...detachActions.flatMap(choice => buildValidatedOngoingDetachEvents(state, {
            cardUid: choice.uid,
            defId: choice.defId,
            ownerId: choice.ownerId,
            reason: 'base_q_point',
            now: timestamp,
        })),
    ];
}

function queueMoveDestination(ctx: AbilityContext, sourceId: string, selected: MinionTarget): AbilityResult {
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) }))
        .filter(destination => destination.baseIndex !== selected.baseIndex);
    if (destinations.length === 0) return noTargets(ctx);
    if (destinations.length === 1) {
        return {
            events: buildValidatedMoveEvents(ctx.state, {
                minionUid: selected.uid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: destinations[0].baseIndex,
                reason: sourceId,
                now: ctx.now,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
            }),
        };
    }
    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        `${cardLabel(selected.defId)}：选择移动目的基地`,
        buildBaseTargetOptions(destinations, ctx.state),
        { sourceId, targetType: 'base' },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        minionUid: selected.uid,
        minionDefId: selected.defId,
        fromBaseIndex: selected.baseIndex,
        sourceCardUid: ctx.cardUid,
        sourceDefId: ctx.defId,
        sourceBaseIndex: ctx.targetBaseIndex ?? ctx.baseIndex,
    } satisfies MoveChoice;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function fancySuitLadProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base || ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return base.minions.some(minion =>
        matchesDefId(minion.defId, 'magical_girls_fancy_suit_lad')
        && minion.controller === ctx.targetMinion.controller
        && minion.uid !== ctx.targetMinion.uid);
}

function magicalStaffInterceptor(_state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = (event as OngoingDetachedEvent).payload;
    if (!matchesDefId(payload.defId, 'magical_girls_magical_staff')) return undefined;
    if (!payload.reason.includes('destroy') && !payload.reason.includes('discard')) return undefined;
    return buildCardToDeckTop(payload.cardUid, payload.defId, payload.ownerId, payload.defId, event.timestamp);
}

export function registerMagicalGirlsAbilities(): void {
    registerAbility('magical_girls_coronet_attack', 'onPlay', coronetAttack);
    registerAbility('magical_girls_lunar_healing_love_spell', 'onPlay', lunarHealingLoveSpell);
    registerAbility('magical_girls_kiss_the_sky_spell', 'onPlay', kissTheSkySpell);
    registerAbility('magical_girls_purge_the_demon', 'onPlay', purgeTheDemon);
    registerAbility('magical_girls_celestial_teleport', 'onPlay', celestialTeleport);
    registerAbility('magical_girls_coordination', 'onPlay', coordination);
    registerAbility('magical_girls_silver_shard', 'onPlay', silverShard);
    registerAbility('magical_girls_lunar_captain', 'talent', lunarCaptain);
    registerAbility('magical_girls_technomagical_lass', 'talent', technomagicalLass);
    registerAbility('magical_girls_bewitching_gal', 'talent', bewitchingGal);
    registerAbility('magical_girls_sakura_warrior', 'talent', sakuraWarrior);
    registerAbility('magical_girls_rainbow_girl', 'onPlay', rainbowGirl);
    registerAbility('magical_girls_white_magicat', 'onPlay', whiteMagicat);
    registerAbility('magical_girls_power_maid', 'talent', powerMaid);
    registerAbility('magical_girls_black_magicat', 'onPlay', blackMagicat);

    registerBaseAbility('base_akihabara_high', 'onMinionPlayed', akihabaraHigh);
    registerBaseAbility('base_q_point', 'beforeScoring', qPointBeforeScoring);

    registerOngoingPowerModifier('magical_girls_magical_staff', 'minion', 'self', 1);
    registerProtection('magical_girls_fancy_suit_lad', 'affect', fancySuitLadProtection);
    registerInterceptor('magical_girls_magical_staff', magicalStaffInterceptor);
}

export function registerMagicalGirlsInteractionHandlers(): void {
    registerInteractionHandler('magical_girls_coronet_attack', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as {
            continuationContext?: {
                sourceCardUid?: string;
                sourceDefId?: string;
                sourceBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number; skip?: boolean };
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'magical_girls_coronet_attack',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: continuation?.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
                sourceKind: 'action',
            }),
        };
    });

    registerInteractionHandler('magical_girls_lunar_healing_love_spell', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = Array.isArray(value) ? value as CardSearchChoice[] : [];
        const seen = new Set<PlayerId>();
        const deduped = selected.filter((choice) => {
            if (seen.has(choice.ownerId)) return false;
            seen.add(choice.ownerId);
            return true;
        });
        return { state, events: recoverGroupedDiscardMinions(_playerId, deduped, 'magical_girls_lunar_healing_love_spell', timestamp) };
    });

    registerInteractionHandler('magical_girls_kiss_the_sky_spell', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { cardUid?: string };
        const events: SmashUpEvent[] = [];
        if (selected.cardUid) {
            events.push(recoverCardsFromDiscard(playerId, [selected.cardUid], 'magical_girls_kiss_the_sky_spell', timestamp));
        }
        const shouldGrant = (data?.continuationContext as { grantExtraAction?: boolean } | undefined)?.grantExtraAction;
        if (shouldGrant) {
            events.push(grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'magical_girls_kiss_the_sky_spell'));
        }
        return { state, events };
    });

    registerInteractionHandler('magical_girls_purge_the_demon', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { mode?: string; cardUid?: string; defId?: string; ownerId?: PlayerId; minionUid?: string; baseIndex?: number };
        if (selected.mode === 'detach_action' && selected.cardUid && selected.defId && selected.ownerId) {
            return {
                state,
                events: buildValidatedOngoingDetachEvents(state, {
                    cardUid: selected.cardUid,
                    defId: selected.defId,
                    ownerId: selected.ownerId,
                    reason: 'magical_girls_purge_the_demon',
                    now: timestamp,
                }),
            };
        }
        if (selected.mode === 'remove_counters' && selected.minionUid && selected.baseIndex !== undefined) {
            const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate => candidate.uid === selected.minionUid);
            const amount = minion?.powerCounters ?? 0;
            return {
                state,
                events: amount > 0 ? [removePowerCounter(selected.minionUid, selected.baseIndex, amount, 'magical_girls_purge_the_demon', timestamp)] : [],
            };
        }
        return { state, events: [] };
    });

    registerInteractionHandler('magical_girls_celestial_teleport', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const found = findMinion(state.core, selected.minionUid);
        if (!found || found.minion.controller !== playerId) return { state, events: [] };
        const continuation = (data?.continuationContext as {
            sourceCardUid?: string;
            sourceDefId?: string;
            sourceBaseIndex?: number;
        } | undefined);
        const destinations = state.core.bases
            .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(state.core, baseIndex) }))
            .filter(destination => destination.baseIndex !== found.baseIndex);
        if (destinations.length === 1) {
            return {
                state,
                events: buildValidatedMoveEvents(state.core, {
                    minionUid: found.minion.uid,
                    minionDefId: found.minion.defId,
                    fromBaseIndex: found.baseIndex,
                    toBaseIndex: destinations[0].baseIndex,
                    reason: 'magical_girls_celestial_teleport',
                    now: timestamp,
                    sourcePlayerId: playerId,
                    sourceCardUid: continuation?.sourceCardUid,
                    sourceDefId: continuation?.sourceDefId,
                    sourceControllerId: playerId,
                    sourceBaseIndex: continuation?.sourceBaseIndex,
                }),
            };
        }
        const interaction = createSimpleChoice(
            `magical_girls_celestial_teleport_destination_${timestamp}`,
            playerId,
            `${cardLabel(found.minion.defId)}：选择移动目的基地`,
            buildBaseTargetOptions(destinations, state.core),
            { sourceId: 'magical_girls_celestial_teleport_destination', targetType: 'base' },
        );
        (interaction.data as { continuationContext?: unknown }).continuationContext = {
            minionUid: found.minion.uid,
            minionDefId: found.minion.defId,
            fromBaseIndex: found.baseIndex,
            sourceCardUid: continuation?.sourceCardUid,
            sourceDefId: continuation?.sourceDefId,
            sourceBaseIndex: continuation?.sourceBaseIndex,
        } satisfies MoveChoice;
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('magical_girls_celestial_teleport_destination', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number };
        const context = data?.continuationContext as MoveChoice | undefined;
        if (!context || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                reason: 'magical_girls_celestial_teleport',
                now: timestamp,
                sourcePlayerId: _playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: _playerId,
                sourceBaseIndex: context.sourceBaseIndex,
            }),
        };
    });

    registerInteractionHandler('magical_girls_coordination', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { choice?: string; titanUid?: string };
        if (selected.choice === 'extra_minion') {
            return { state, events: [grantContextualExtraMinion({ playerId, now: timestamp, matchState: state }, 'magical_girls_coordination')] };
        }
        if (selected.choice !== 'walking_castle' || !selected.titanUid) return { state, events: [] };
        const titan = getWalkingCastle(state.core, playerId);
        if (!titan || titan.uid !== selected.titanUid || !canControllerPlayTitan(state.core, playerId, titan.uid)) {
            return { state, events: [] };
        }

        const eligibleBases = getWalkingCastleEligibleBases(state.core, playerId);
        if (eligibleBases.length === 0) return { state, events: [] };
        if (eligibleBases.length === 1) {
            return {
                state,
                events: buildPlayWalkingCastleEvents(
                    state.core,
                    playerId,
                    eligibleBases[0].baseIndex,
                    'magical_girls_coordination',
                    timestamp,
                ),
            };
        }

        const interaction = createSimpleChoice(
            `magical_girls_coordination_base_${timestamp}`,
            playerId,
            '和谐：选择移动城堡要进入的基地',
            buildBaseTargetOptions(eligibleBases, state.core),
            {
                sourceId: 'magical_girls_coordination_base',
                titleKey: 'ui.magical_girls_coordination_base_title',
                targetType: 'base',
            },
        );
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('magical_girls_coordination_base', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildPlayWalkingCastleEvents(
                state.core,
                playerId,
                selected.baseIndex,
                'magical_girls_coordination',
                timestamp,
            ),
        };
    });

    registerInteractionHandler('magical_girls_lunar_captain', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { cardUid?: string };
        return {
            state,
            events: selected.cardUid ? [recoverCardsFromDiscard(playerId, [selected.cardUid], 'magical_girls_lunar_captain', timestamp)] : [],
        };
    });

    registerInteractionHandler('magical_girls_technomagical_lass', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as {
            continuationContext?: {
                sourceCardUid?: string;
                sourceDefId?: string;
                sourceBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'magical_girls_technomagical_lass',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: continuation?.sourceCardUid,
                sourceDefId: continuation?.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: continuation?.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('magical_girls_sakura_warrior', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        const amount = (data?.continuationContext as { amount?: number } | undefined)?.amount ?? 0;
        if (!selected.minionUid || selected.baseIndex === undefined || amount <= 0) return { state, events: [] };
        return {
            state: appendTimedPowerModifier(state, selected.minionUid, -amount, 'magical_girls_sakura_warrior'),
            events: [addPermanentPower(selected.minionUid, selected.baseIndex, -amount, 'magical_girls_sakura_warrior', timestamp)],
        };
    });

    registerInteractionHandler('magical_girls_white_magicat', resolveMagicatSearch('magical_girls_white_magicat'));
    registerInteractionHandler('magical_girls_black_magicat', resolveMagicatSearch('magical_girls_black_magicat'));

    registerInteractionHandler('magical_girls_power_maid', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        const continuation = (data?.continuationContext as {
            sourceCardUid?: string;
            sourceDefId?: string;
            sourceBaseIndex?: number;
        } | undefined);
        const source = continuation?.sourceCardUid
            ? findMinion(state.core, continuation.sourceCardUid)
            : findMinion(
                state.core,
                state.core.bases
                    .flatMap(base => base.minions)
                    .find(minion => matchesDefId(minion.defId, POWER_MAID) && minion.controller === playerId)?.uid ?? '',
            );
        const target = findMinion(state.core, selected.minionUid);
        if (
            !source
            || !target
            || source.minion.controller !== playerId
            || !matchesDefId(source.minion.defId, POWER_MAID)
            || (continuation?.sourceDefId !== undefined && source.minion.defId !== continuation.sourceDefId)
        ) {
            return { state, events: [] };
        }
        const destinations = state.core.bases
            .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(state.core, baseIndex) }))
            .filter(destination => target.baseIndex === source.baseIndex
                ? destination.baseIndex !== source.baseIndex
                : destination.baseIndex === source.baseIndex);
        if (destinations.length === 0) return { state, events: [] };
        const moveContext = {
            minionUid: target.minion.uid,
            minionDefId: target.minion.defId,
            fromBaseIndex: target.baseIndex,
            sourceCardUid: continuation?.sourceCardUid ?? source.minion.uid,
            sourceDefId: continuation?.sourceDefId ?? source.minion.defId,
            sourceBaseIndex: continuation?.sourceBaseIndex ?? source.baseIndex,
        } satisfies MoveChoice;
        if (destinations.length > 1) {
            const interaction = createSimpleChoice(
                `magical_girls_power_maid_destination_${timestamp}`,
                playerId,
                `${cardLabel(source.minion.defId)}：选择移动目的基地`,
                buildBaseTargetOptions(destinations, state.core),
                {
                    sourceId: 'magical_girls_power_maid_destination',
                    titleKey: 'ui.magical_girls_power_maid_destination_title',
                    targetType: 'base',
                },
            );
            (interaction.data as { continuationContext?: unknown }).continuationContext = moveContext;
            return { state: queueInteraction(state, interaction), events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: moveContext.minionUid,
                minionDefId: moveContext.minionDefId,
                fromBaseIndex: moveContext.fromBaseIndex,
                toBaseIndex: destinations[0].baseIndex,
                reason: moveContext.sourceDefId ?? source.minion.defId,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: moveContext.sourceCardUid,
                sourceDefId: moveContext.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: moveContext.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('magical_girls_power_maid_destination', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { baseIndex?: number } | undefined;
        const context = data?.continuationContext as MoveChoice | undefined;
        if (!context || selected?.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: context.minionUid,
                minionDefId: context.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                reason: context.sourceDefId ?? 'magical_girls_power_maid',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceCardUid: context.sourceCardUid,
                sourceDefId: context.sourceDefId,
                sourceControllerId: playerId,
                sourceBaseIndex: context.sourceBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler('base_q_point', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as QPointCardChoice | undefined;
        const context = data?.continuationContext as QPointContext | undefined;
        if (!selected || !context) return { state, events: [] };
        const events = qPointDestroyUnkept(state.core, playerId, selected.uid, context.baseIndex, timestamp);
        const nextContext = {
            ...context,
            playerIds: context.playerIds.filter(candidate => candidate !== playerId),
        };
        const nextPlayerId = findNextQPointPlayer(state.core, nextContext);
        const nextState = nextPlayerId
            ? queueQPointPrompt(state, nextContext, nextPlayerId, timestamp)
            : state;
        return { state: nextState, events };
    });
}

function resolveMagicatSearch(sourceId: string) {
    return (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) => {
        const selected = value as CardSearchChoice;
        if (!selected?.cardUid) return { state, events: [] };
        return {
            state,
            events: selected.zone === 'deck'
                ? [buildDrawCardFromDeck(playerId, selected.cardUid, timestamp)]
                : [recoverCardsFromDiscard(playerId, [selected.cardUid], sourceId, timestamp)],
        };
    };
}
