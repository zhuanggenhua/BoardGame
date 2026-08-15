import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, getCurrentTrackedCardTopSnapshot } from '../../../engine/systems/InteractionSystem';
import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerActiveBaseAbility, registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import {
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildStandardDrawEvents,
    buildSemanticOngoingAttachEvents,
    createSkipOption,
    findMinionOnBases,
    grantExtraAction,
    getMinionPower,
    inspectDeck,
    revealDeckTop,
    revealHand,
} from '../domain/abilityHelpers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import type {
    CardInstance,
    CardRemovedFromGameEvent,
    CardToDeckTopEvent,
    CardTransferredEvent,
    DeckReorderedEvent,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import { actionLikeNeedsPlayBase } from '../domain/utils';
import { createCardObjectRef, createCardTransferEvent } from '../domain/objectProvenance';
import {
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';

type PlayerChoice = { targetPlayerId: PlayerId };
type HandChoice = { cardUid: string; defId: string; ownerId: PlayerId };
type MinionChoice = { minionUid: string; baseIndex: number };
type CastRunesChoice = { topCardUid: string; cardUid?: string; defId?: string };
type RaidingPartyChoice = {
    cardUid: string;
    sourcePlayerId: PlayerId;
    ownerId: PlayerId;
    defId: string;
    type: 'action' | 'minion';
} | { skip: true };
type VikingPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};
type VikingBuffPromptContext = VikingPromptContext & {
    minionUid: string;
    baseIndex: number;
};
type VikingCastRunesOrderPromptContext = VikingPromptContext & {
    targetPlayerId: PlayerId;
    revealedCards: Array<{ uid: string; defId: string; owner: PlayerId }>;
};
type VikingRaidingPartyChoicePromptContext = VikingPromptContext & {
    targetPlayerId: PlayerId;
    revealedCards: Array<{ uid: string; defId: string; type: 'action' | 'minion'; owner: PlayerId }>;
};
type VikingRaidingPartyTargetPromptContext = VikingPromptContext & {
    selected: Exclude<RaidingPartyChoice, { skip: true }>;
    reorderEvent: SmashUpEvent;
};
type VikingBaseLonghouseMinionPromptContext = VikingPromptContext & {
    baseIndex: number;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
};
type VikingBerserkMinionPromptContext = VikingPromptContext & HandChoice;

function createVikingPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): VikingPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function getCurrentDeckTopSnapshotCards<T extends { uid: string; defId: string }>(
    state: SmashUpCore,
    playerId: PlayerId,
    trackedCards: T[],
): T[] {
    return getCurrentTrackedCardTopSnapshot(state.players[playerId]?.deck ?? [], trackedCards);
}

function buildCastTheRunesOrderOptions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    revealedCards: Array<{ uid: string; defId: string; owner: PlayerId }>,
) {
    return getCurrentDeckTopSnapshotCards(state, targetPlayerId, revealedCards).map((card, index) => ({
        id: `card-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { topCardUid: card.uid, cardUid: card.uid, defId: card.defId },
        _source: 'static' as const,
        displayMode: 'card' as const,
    }));
}

function buildRaidingPartyChoiceOptions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    revealedCards: Array<{ uid: string; defId: string; type: 'action' | 'minion'; owner: PlayerId }>,
) {
    const eligible = getCurrentDeckTopSnapshotCards(state, targetPlayerId, revealedCards)
        .filter((card) => isRaidingPartyPlayable(card as CardInstance))
        .map((card, index) => ({
            id: `play-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: {
                cardUid: card.uid,
                sourcePlayerId: targetPlayerId,
                ownerId: card.owner,
                defId: card.defId,
                type: card.type,
            },
            _source: 'static' as const,
            displayMode: 'card' as const,
        }));

    return [createSkipOption('不打出', 'ui.vikings_raiding_party_skip_play_option') as any, ...eligible] as Array<{
        id: string;
        label: string;
        value: RaidingPartyChoice;
        _source?: 'static';
        displayMode?: 'button' | 'card';
    }>;
}

export function registerVikingsAbilities(): void {
    registerAbilityProgram('vikings_huscarl', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsHuscarlTalent),
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player && player.hand.length > 0 ? null : '手牌为空，无法发动此天赋';
        },
    });
    registerAbilityProgram('vikings_shield_maiden', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsShieldMaidenOnPlay),
    });
    registerAbilityProgram('vikings_raider', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsRaiderTalent),
        validateUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            return player && player.hand.length > 0 ? null : '手牌为空，无法发动此天赋';
        },
    });
    registerAbilityProgram('vikings_valkyrie', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsValkyrieOnPlay),
    });
    registerAbilityProgram('vikings_ransack', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsRansackOnPlay),
    });
    registerAbilityProgram('vikings_pillage', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsPillageOnPlay),
    });
    registerAbilityProgram('vikings_cast_the_runes', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsCastTheRunesOnPlay),
    });
    registerAbilityProgram('vikings_raiding_party', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsRaidingPartyOnPlay),
    });
    registerAbilityProgram('vikings_berserk', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vikingsBerserkOnPlay),
    });
    registerAbility('vikings_tribute', 'onPlay', vikingsTributeOnPlay);
    registerAbility('vikings_combat_training', 'onPlay', vikingsCombatTrainingOnPlay);

    registerTrigger('vikings_viking_funeral', 'onMinionDestroyed', vikingsVikingFuneralTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('vikings_viking_funeral', 'onMinionDiscardedFromBase', vikingsVikingFuneralTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    registerBaseAbility('base_drakkar', 'onMinionPlayed', vikingsBaseDrakkarOnMinionPlayed, {
    });
    registerActiveBaseAbility('base_longhouse', vikingsBaseLonghouseDuringTurn, {
        canUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const minions = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
            return !!player && player.hand.length > 0 && minions.length > 0;
        },
    });
}

export function registerVikingsInteractionHandlers(): void {
    // 已迁移到 Smash Up ability runtime prompt，无需手工 handler 注册。
}

function vikingsHuscarlTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!source || !player || player.hand.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsHuscarlPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsShieldMaidenOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsShieldMaidenPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsRaiderTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!source || !player || player.hand.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsRaiderPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            minionUid: source.minion.uid,
            baseIndex: source.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsValkyrieOnPlay(ctx: AbilityContext): AbilityResult {
    const options = getOtherPlayers(ctx.state, ctx.playerId).flatMap(targetPlayerId => {
        const discard = ctx.state.players[targetPlayerId]?.discard ?? [];
        return discard
            .filter(card => card.type === 'minion')
            .map((card, index) => ({
                id: `discard-${targetPlayerId}-${index}`,
                label: `${getCardDef(card.defId)?.name ?? card.defId} (${targetPlayerId})`,
                value: { cardUid: card.uid, ownerId: targetPlayerId, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            }));
    });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsValkyriePromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsRansackOnPlay(ctx: AbilityContext): AbilityResult {
    const options = collectRansackTargets(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsRansackPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsPillageOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(pid => (ctx.state.players[pid]?.hand.length ?? 0) > 0);
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsPillagePromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsCastTheRunesOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => (ctx.state.players[pid]?.hand.length ?? 0) > 0 || getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsCastTheRunesPlayerPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsRaidingPartyOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsRaidingPartyPlayerPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsBerserkOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = getOwnMinions(ctx.state, ctx.playerId);
    if (!player || player.hand.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    if (minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vikingsBerserkCardPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsTributeOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 3, ctx.random, ctx.now) };
}

function vikingsCombatTrainingOnPlay(ctx: AbilityContext): AbilityResult {
    const events = getOwnMinions(ctx.state, ctx.playerId).map(({ minion, baseIndex }) => (
        addTempPower(minion.uid, baseIndex, 1, 'vikings_combat_training', ctx.now)
    ));
    return { events };
}

function vikingsVikingFuneralTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId || !ctx.triggerMinion || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return [];
    }
    const funeral = ctx.triggerMinion.attachedActions.find(
        action => action.uid === ctx.sourceCardUid && action.defId === 'vikings_viking_funeral',
    );
    if (!funeral) return [];

    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'vikings_viking_funeral' },
        timestamp: ctx.now,
    } as VpAwardedEvent];

    if (ctx.triggerMinion.controller === ctx.sourceControllerId) {
        events.push({
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: {
                playerId: ctx.triggerMinion.owner,
                cardUid: ctx.triggerMinion.uid,
                defId: ctx.triggerMinion.defId,
                reason: 'vikings_viking_funeral',
            },
            timestamp: ctx.now,
        } as CardRemovedFromGameEvent);
    }
    return events;
}

function vikingsBaseDrakkarOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (getTurnMinionsPlayedAtBase(ctx.state, ctx.baseIndex) !== 1) return { events: [] };
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => getTopDeckCardWithReshuffle(ctx.state, pid, DEFAULT_RANDOM, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        vikingsBaseDrakkarPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vikingsBaseLonghouseDuringTurn(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (!player || player.hand.length === 0 || minions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        vikingsBaseLonghouseCardPromptProgram,
        createVikingPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function resolveRevealAndStealTopCard(params: {
    state: MatchState<SmashUpCore>;
    actingPlayerId: PlayerId;
    targetPlayerId: PlayerId;
    reason: 'vikings_shield_maiden' | 'base_drakkar';
    random: RandomFn;
    timestamp: number;
}): AbilityResult {
    const deckInfo = prepareTopDeckForVikingPeek(params.state.core, params.targetPlayerId, params.random, params.timestamp);
    if (!deckInfo.card) return { events: deckInfo.events };
    const def = getCardDef(deckInfo.card.defId) as { power?: number } | undefined;
    const eligible = deckInfo.card.type === 'action' || (deckInfo.card.type === 'minion' && (def?.power ?? 99) <= 3);
    const events: SmashUpEvent[] = [
        ...deckInfo.events,
        inspectDeck(params.targetPlayerId, params.targetPlayerId, 1, params.reason, params.timestamp),
        revealDeckTop(
            params.targetPlayerId,
            'all',
            [{ uid: deckInfo.card.uid, defId: deckInfo.card.defId }],
            1,
            params.reason,
            params.timestamp,
            params.targetPlayerId,
        ),
    ];
    if (eligible) {
        events.push(
            transferCard(
                deckInfo.card.uid,
                deckInfo.card.defId,
                params.targetPlayerId,
                params.actingPlayerId,
                params.reason,
                params.timestamp,
                deckInfo.card.owner,
            ),
        );
    }
    return { events };
}

const vikingsHuscarlPromptProgram = createPromptProgram<VikingBuffPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_huscarl',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_huscarl_${context.now}`,
        context.playerId,
        '侍卫：选择一张手牌置于牌库顶，本随从在回合结束前 +2 力量',
        [createSkipOption('跳过（不放牌）', 'ui.vikings_huscarl_skip_option') as any, ...buildHandCardOptions(context.matchState.core.players[context.playerId]?.hand ?? [])] as any[],
        { sourceId: 'vikings_huscarl', targetType: 'generic', titleKey: 'ui.vikings_huscarl_title' },
    ),
    onResolve: ({ context, playerId, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as HandChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };
        return {
            events: [
                toDeckTop(playerId, selected.cardUid, selected.defId, 'vikings_huscarl', timestamp, selected.ownerId),
                addTempPower(context.minionUid, context.baseIndex, 2, 'vikings_huscarl', timestamp),
            ],
        };
    },
});

const vikingsShieldMaidenPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_shield_maiden',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_shield_maiden_${context.now}`,
        context.playerId,
        '盾女：选择另一位玩家，展示其牌库顶的一张牌',
        [
            createSkipOption('跳过（不揭示）', 'ui.vikings_shield_maiden_skip_option') as any,
            ...buildPlayerOptions(
                getOtherPlayers(context.matchState.core, context.playerId).filter(
                    pid => (context.matchState.core.players[pid]?.hand.length ?? 0) > 0
                        || (context.matchState.core.players[pid]?.deck.length ?? 0) > 0
                        || (context.matchState.core.players[pid]?.discard.length ?? 0) > 0,
                ),
                { state: context.matchState.core, sourcePlayerId: context.playerId, effectIntent: 'inspect' },
            ),
        ] as any[],
        { sourceId: 'vikings_shield_maiden', targetType: 'generic', titleKey: 'ui.vikings_shield_maiden_title' },
    ),
    onResolve: ({ state, context, value, random, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as PlayerChoice | undefined;
        if (!selected?.targetPlayerId) return { events: [] };
        return resolveRevealAndStealTopCard({
            state,
            actingPlayerId: context.playerId,
            targetPlayerId: selected.targetPlayerId,
            reason: 'vikings_shield_maiden',
            random,
            timestamp,
        });
    },
});

const vikingsRaiderPromptProgram = createPromptProgram<VikingBuffPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raider',
    buildInteraction: (context) => {
        const options = buildHandCardOptions(context.matchState.core.players[context.playerId]?.hand ?? []);
        return createSimpleChoice(
            `vikings_raider_${context.now}`,
            context.playerId,
            `袭击者：选择至多 ${Math.min(3, options.length)} 张手牌置于牌库顶，本随从每张 +1 力量`,
            options,
            { sourceId: 'vikings_raider', targetType: 'generic' },
            undefined,
            { min: 0, max: Math.min(3, options.length) },
        );
    },
    onResolve: ({ context, playerId, value, timestamp }) => {
        const selections = (Array.isArray(value) ? value : [value]) as HandChoice[];
        const valid = selections.filter(selection => selection?.cardUid && selection?.defId && selection?.ownerId).slice(0, 3);
        if (valid.length === 0) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const selection of [...valid].reverse()) {
            events.push(toDeckTop(playerId, selection.cardUid, selection.defId, 'vikings_raider', timestamp, selection.ownerId));
        }
        events.push(addTempPower(context.minionUid, context.baseIndex, valid.length, 'vikings_raider', timestamp));
        return { events };
    },
});

const vikingsValkyriePromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_valkyrie',
    buildInteraction: (context) => {
        const options = getOtherPlayers(context.matchState.core, context.playerId).flatMap(targetPlayerId => {
            const discard = context.matchState.core.players[targetPlayerId]?.discard ?? [];
            return discard
                .filter(card => card.type === 'minion')
                .map((card, index) => ({
                    id: `discard-${targetPlayerId}-${index}`,
                    label: `${getCardDef(card.defId)?.name ?? card.defId} (${targetPlayerId})`,
                    value: { cardUid: card.uid, sourcePlayerId: targetPlayerId, ownerId: card.owner, defId: card.defId },
                    _source: 'discard' as const,
                    displayMode: 'card' as const,
                }));
        });
        return createSimpleChoice(
            `vikings_valkyrie_${context.now}`,
            context.playerId,
            '女武神：选择另一位玩家弃牌堆中的一个随从',
            [createSkipOption('跳过（不取回）', 'ui.vikings_valkyrie_skip_option') as any, ...options] as any[],
            { sourceId: 'vikings_valkyrie', targetType: 'generic', titleKey: 'ui.vikings_valkyrie_title' },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { cardUid?: string; sourcePlayerId?: PlayerId; ownerId?: PlayerId; defId?: string } | undefined;
        if (!selected?.cardUid || !selected.sourcePlayerId || !selected.ownerId || !selected.defId) return { events: [] };
        return {
            events: [transferCard(selected.cardUid, selected.defId, selected.sourcePlayerId, context.playerId, 'vikings_valkyrie', timestamp, selected.ownerId)],
        };
    },
});

const vikingsRansackPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_ransack',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_ransack_${context.now}`,
        context.playerId,
        '洗劫：选择一个打出的行动牌或一张埋葬牌，将其置入你的手牌',
        collectRansackTargets(context.matchState.core),
        { sourceId: 'vikings_ransack', targetType: 'generic', titleKey: 'ui.vikings_ransack_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as {
            cardUid?: string;
            defId?: string;
            kind?: string;
            ownerId?: PlayerId;
            trueOwnerId?: PlayerId;
        } | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        if (selected.kind === 'buried' && selected.trueOwnerId) {
            return {
                events: [transferCard(selected.cardUid, selected.defId, selected.trueOwnerId, context.playerId, 'vikings_ransack', timestamp, selected.trueOwnerId)],
            };
        }
        if (selected.ownerId) {
            return {
                events: [
                    ...buildValidatedOngoingDetachEvents(state, {
                        cardUid: selected.cardUid,
                        defId: selected.defId,
                        ownerId: selected.ownerId,
                        reason: 'vikings_ransack',
                        now: timestamp,
                    }),
                    transferCard(selected.cardUid, selected.defId, selected.ownerId, context.playerId, 'vikings_ransack', timestamp, selected.ownerId),
                ],
            };
        }
        return { events: [] };
    },
});

const vikingsPillagePromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_pillage',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_pillage_${context.now}`,
        context.playerId,
        '掠夺：选择另一位玩家，随机拿走其一张手牌',
        buildPlayerOptions(
            getOtherPlayers(context.matchState.core, context.playerId).filter(pid => (context.matchState.core.players[pid]?.hand.length ?? 0) > 0),
            { state: context.matchState.core, sourcePlayerId: context.playerId, effectIntent: 'debuff' },
        ),
        { sourceId: 'vikings_pillage', targetType: 'generic', titleKey: 'ui.vikings_pillage_title' },
    ),
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as PlayerChoice | undefined;
        if (!selected?.targetPlayerId) return { events: [] };
        const target = state.core.players[selected.targetPlayerId];
        if (!target || target.hand.length === 0) return { events: [] };
        const card = random.shuffle([...target.hand])[0];
        return card
            ? { events: [transferCard(card.uid, card.defId, selected.targetPlayerId, context.playerId, 'vikings_pillage', timestamp, card.owner)] }
            : { events: [] };
    },
});

const vikingsCastTheRunesOrderPromptProgram = createPromptProgram<VikingCastRunesOrderPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_cast_the_runes_order',
    buildInteraction: (context) => {
        const interaction = createSimpleChoice(
            `vikings_cast_the_runes_order_${context.now}`,
            context.playerId,
            '掷卢恩符文：选择放回牌库顶的顺序',
            buildCastTheRunesOrderOptions(context.matchState.core, context.targetPlayerId, context.revealedCards),
            { sourceId: 'vikings_cast_the_runes_order', targetType: 'generic', responseValidationMode: 'live', titleKey: 'ui.vikings_cast_the_runes_order_title' },
        );
        (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>) =>
            buildCastTheRunesOrderOptions(nextState.core, context.targetPlayerId, context.revealedCards);
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as CastRunesChoice | undefined;
        if (!selected?.topCardUid) return { events: [] };
        const currentRevealed = getCurrentDeckTopSnapshotCards(state.core, context.targetPlayerId, context.revealedCards);
        if (currentRevealed.length === 0) return { events: [] };
        const topCard = currentRevealed.find(card => card.uid === selected.topCardUid);
        if (!topCard) return { events: [] };
        const rest = currentRevealed.filter(card => card.uid !== selected.topCardUid);
        const trackedUidSet = new Set(currentRevealed.map(card => card.uid));
        const liveRemainingDeck = (state.core.players[context.targetPlayerId]?.deck ?? [])
            .filter(card => !trackedUidSet.has(card.uid));
        const orderedCards = [topCard, ...rest];
        const sourceOwnedOrdered = orderedCards.filter(card => card.owner === context.targetPlayerId || !state.core.players[card.owner]);
        const borrowedByOwner = new Map<PlayerId, typeof orderedCards>();
        for (const card of orderedCards) {
            if (card.owner === context.targetPlayerId || !state.core.players[card.owner]) continue;
            borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
        }
        return {
            events: [
                ...Array.from(borrowedByOwner.entries()).map(([ownerId, cards]) => ({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: ownerId,
                        deckUids: [...cards.map(card => card.uid), ...(state.core.players[ownerId]?.deck ?? []).map(card => card.uid)],
                        sourcePlayerId: context.targetPlayerId,
                    },
                    timestamp,
                }) as DeckReorderedEvent),
                {
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: context.targetPlayerId,
                        deckUids: [...sourceOwnedOrdered.map(card => card.uid), ...liveRemainingDeck.map(card => card.uid)],
                    },
                    timestamp,
                } as DeckReorderedEvent,
            ],
        };
    },
});

const vikingsCastTheRunesPlayerPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_cast_the_runes_player',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_cast_the_runes_player_${context.now}`,
        context.playerId,
        '掷卢恩符文：选择另一位玩家',
        buildPlayerOptions(
            getOtherPlayers(context.matchState.core, context.playerId).filter(
                pid => (context.matchState.core.players[pid]?.hand.length ?? 0) > 0
                    || (context.matchState.core.players[pid]?.deck.length ?? 0) > 0
                    || (context.matchState.core.players[pid]?.discard.length ?? 0) > 0,
            ),
            { state: context.matchState.core, sourcePlayerId: context.playerId, effectIntent: 'inspect' },
        ),
        { sourceId: 'vikings_cast_the_runes_player', targetType: 'generic', titleKey: 'ui.vikings_cast_the_runes_player_title' },
    ),
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as PlayerChoice | undefined;
        if (!selected?.targetPlayerId) return { events: [] };
        const target = state.core.players[selected.targetPlayerId];
        if (!target) return { events: [] };
        const handReveal = revealHand(
            selected.targetPlayerId,
            context.playerId,
            target.hand.map(card => ({ uid: card.uid, defId: card.defId })),
            'vikings_cast_the_runes',
            timestamp,
        );
        const deckInfo = prepareTopDeckCards(state.core, selected.targetPlayerId, 2, random, timestamp);
        const events: SmashUpEvent[] = [handReveal, ...deckInfo.events, grantExtraAction(context.playerId, 'vikings_cast_the_runes', timestamp)];
        const revealedCards = deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId, owner: card.owner }));
        if (revealedCards.length > 0) {
            events.push(revealDeckTop(selected.targetPlayerId, 'all', revealedCards, revealedCards.length, 'vikings_cast_the_runes', timestamp));
        }
        if (revealedCards.length <= 1) {
            return { events };
        }
        return {
            events,
            context: createVikingPromptContext(state, context.playerId, timestamp, {
                targetPlayerId: selected.targetPlayerId,
                revealedCards,
            }),
            nextProgram: vikingsCastTheRunesOrderPromptProgram,
        };
    },
});

const vikingsRaidingPartyMinionBasePromptProgram = createPromptProgram<VikingRaidingPartyTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raiding_party_minion_base',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_raiding_party_minion_base_${context.now}`,
        context.playerId,
        '突袭队：选择该额外随从要打出的基地',
        buildBaseOptions(context.matchState.core),
        { sourceId: 'vikings_raiding_party_minion_base', targetType: 'base', titleKey: 'ui.vikings_raiding_party_minion_base_title' },
    ),
    onResolve: ({ state, context, playerId, value, random, timestamp }) => {
        const selectedBase = value as { baseIndex?: number } | undefined;
        if (selectedBase?.baseIndex === undefined) return { events: [] };
        return playRaidingPartyCard(state, playerId, context.selected, { baseIndex: selectedBase.baseIndex }, random, timestamp, [context.reorderEvent]);
    },
});

const vikingsRaidingPartyActionBasePromptProgram = createPromptProgram<VikingRaidingPartyTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raiding_party_action_base',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_raiding_party_action_base_${context.now}`,
        context.playerId,
        '突袭队：选择该额外行动的目标基地',
        buildBaseOptions(context.matchState.core),
        { sourceId: 'vikings_raiding_party_action_base', targetType: 'base', titleKey: 'ui.vikings_raiding_party_action_base_title' },
    ),
    onResolve: ({ state, context, playerId, value, random, timestamp }) => {
        const selectedBase = value as { baseIndex?: number } | undefined;
        if (selectedBase?.baseIndex === undefined) return { events: [] };
        return playRaidingPartyCard(state, playerId, context.selected, { targetBaseIndex: selectedBase.baseIndex }, random, timestamp, [context.reorderEvent]);
    },
});

const vikingsRaidingPartyActionMinionPromptProgram = createPromptProgram<VikingRaidingPartyTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raiding_party_action_minion',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_raiding_party_action_minion_${context.now}`,
        context.playerId,
        '突袭队：选择该额外行动的目标随从',
        getAllMinionOptions(context.matchState.core, context.playerId),
        { sourceId: 'vikings_raiding_party_action_minion', targetType: 'minion', titleKey: 'ui.vikings_raiding_party_action_minion_title' },
    ),
    onResolve: ({ state, context, playerId, value, random, timestamp }) => {
        const selectedMinion = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selectedMinion?.minionUid || selectedMinion.baseIndex === undefined) return { events: [] };
        return playRaidingPartyCard(
            state,
            playerId,
            context.selected,
            { targetBaseIndex: selectedMinion.baseIndex, targetMinionUid: selectedMinion.minionUid },
            random,
            timestamp,
            [context.reorderEvent],
        );
    },
});

const vikingsRaidingPartyChoicePromptProgram = createPromptProgram<VikingRaidingPartyChoicePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raiding_party_choice',
    buildInteraction: (context) => {
        const interaction = createSimpleChoice(
            `vikings_raiding_party_choice_${context.now}`,
            context.playerId,
            '突袭队：你可以选择一张可打出的牌',
            buildRaidingPartyChoiceOptions(context.matchState.core, context.targetPlayerId, context.revealedCards) as any[],
            { sourceId: 'vikings_raiding_party_choice', targetType: 'generic', responseValidationMode: 'live', titleKey: 'ui.vikings_raiding_party_choice_title' },
        );
        (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>) =>
            buildRaidingPartyChoiceOptions(nextState.core, context.targetPlayerId, context.revealedCards);
        return interaction;
    },
    onResolve: ({ state, context, playerId, value, random, timestamp }) => {
        const selected = value as RaidingPartyChoice | undefined;
        const currentRevealed = getCurrentDeckTopSnapshotCards(state.core, context.targetPlayerId, context.revealedCards);
        if (currentRevealed.length === 0) return { events: [] };
        const chosenUid = selected && 'cardUid' in selected ? selected.cardUid : undefined;
        const remaining = currentRevealed.filter(card => card.uid !== chosenUid);
        const trackedUidSet = new Set(currentRevealed.map(card => card.uid));
        const liveRemainingDeckUids = (state.core.players[context.targetPlayerId]?.deck ?? [])
            .filter(card => !trackedUidSet.has(card.uid))
            .map(card => card.uid);
        const reorderEvent: SmashUpEvent = {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: context.targetPlayerId, deckUids: [...remaining.map(card => card.uid), ...liveRemainingDeckUids] },
            timestamp,
        } as DeckReorderedEvent;

        if (!selected || 'skip' in selected) {
            return { events: [reorderEvent] };
        }

        if (selected.type === 'minion') {
            if (state.core.bases.length === 1) {
                return playRaidingPartyCard(state, playerId, selected, { baseIndex: 0 }, random, timestamp, [reorderEvent]);
            }
            return {
                events: [],
                context: createVikingPromptContext(state, playerId, timestamp, { selected, reorderEvent }),
                nextProgram: vikingsRaidingPartyMinionBasePromptProgram,
            };
        }

        const actionDef = getCardDef(selected.defId) as { subtype?: string; ongoingTarget?: string } | undefined;
        if (actionDef?.subtype === 'ongoing' && actionDef.ongoingTarget === 'minion') {
            if (getAllMinionOptions(state.core, playerId).length === 0) return { events: [reorderEvent] };
            return {
                events: [],
                context: createVikingPromptContext(state, playerId, timestamp, { selected, reorderEvent }),
                nextProgram: vikingsRaidingPartyActionMinionPromptProgram,
            };
        }

        if (actionDef && (actionDef.subtype === 'ongoing' || actionLikeNeedsPlayBase(actionDef))) {
            return {
                events: [],
                context: createVikingPromptContext(state, playerId, timestamp, { selected, reorderEvent }),
                nextProgram: vikingsRaidingPartyActionBasePromptProgram,
            };
        }

        return playRaidingPartyCard(state, playerId, selected, {}, random, timestamp, [reorderEvent]);
    },
});

const vikingsRaidingPartyPlayerPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_raiding_party_player',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_raiding_party_player_${context.now}`,
        context.playerId,
        '突袭队：选择另一位玩家，展示其牌库顶三张牌',
        buildPlayerOptions(
            getOtherPlayers(context.matchState.core, context.playerId).filter(
                pid => (context.matchState.core.players[pid]?.deck.length ?? 0) > 0 || (context.matchState.core.players[pid]?.discard.length ?? 0) > 0,
            ),
            { state: context.matchState.core, sourcePlayerId: context.playerId, effectIntent: 'inspect' },
        ),
        { sourceId: 'vikings_raiding_party_player', targetType: 'generic', titleKey: 'ui.vikings_raiding_party_player_title' },
    ),
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as PlayerChoice | undefined;
        if (!selected?.targetPlayerId) return { events: [] };
        const deckInfo = prepareTopDeckCards(state.core, selected.targetPlayerId, 3, random, timestamp);
        if (deckInfo.cards.length === 0) return { events: [] };
        const revealedCards = deckInfo.cards.map(card => ({
            uid: card.uid,
            defId: card.defId,
            type: card.type as 'action' | 'minion',
            owner: card.owner,
        }));
        const events: SmashUpEvent[] = [
            ...deckInfo.events,
            revealDeckTop(selected.targetPlayerId, 'all', revealedCards.map(card => ({ uid: card.uid, defId: card.defId })), revealedCards.length, 'vikings_raiding_party', timestamp),
        ];
        return {
            events,
            context: createVikingPromptContext(state, context.playerId, timestamp, {
                targetPlayerId: selected.targetPlayerId,
                revealedCards,
            }),
            nextProgram: vikingsRaidingPartyChoicePromptProgram,
        };
    },
});

const vikingsBerserkMinionPromptProgram = createPromptProgram<VikingBerserkMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_berserk_minion',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_berserk_minion_${context.now}`,
        context.playerId,
        '狂战：选择一个你的随从获得 +4 力量直到回合结束',
        buildMinionTargetOptions(
            getOwnMinions(context.matchState.core, context.playerId).map(({ minion, baseIndex }) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(context.matchState.core, minion, baseIndex)})`,
            })),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        { sourceId: 'vikings_berserk_minion', targetType: 'minion', titleKey: 'ui.vikings_berserk_minion_title' },
    ),
    onResolve: ({ context, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [
                toDeckTop(playerId, context.cardUid, context.defId, 'vikings_berserk', timestamp, context.ownerId),
                addTempPower(selected.minionUid, selected.baseIndex, 4, 'vikings_berserk', timestamp),
            ],
        };
    },
});

const vikingsBerserkCardPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vikings_berserk_card',
    buildInteraction: (context) => createSimpleChoice(
        `vikings_berserk_card_${context.now}`,
        context.playerId,
        '狂战：选择一张手牌置于牌库顶',
        buildHandCardOptions(context.matchState.core.players[context.playerId]?.hand ?? []),
        { sourceId: 'vikings_berserk_card', targetType: 'generic', titleKey: 'ui.vikings_berserk_card_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as HandChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };
        if (getOwnMinions(state.core, context.playerId).length === 0) return { events: [] };
        return {
            events: [],
            context: createVikingPromptContext(state, context.playerId, timestamp, {
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
            }),
            nextProgram: vikingsBerserkMinionPromptProgram,
        };
    },
});

const vikingsBaseDrakkarPromptProgram = createPromptProgram<VikingPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_drakkar',
    buildInteraction: (context) => createSimpleChoice(
        `base_drakkar_${context.now}`,
        context.playerId,
        '德拉卡尔号：选择另一位玩家，展示其牌库顶的一张牌',
        [
            createSkipOption('跳过（不揭示）', 'ui.base_drakkar_skip_option') as any,
            ...buildPlayerOptions(
                getOtherPlayers(context.matchState.core, context.playerId).filter(
                    pid => (context.matchState.core.players[pid]?.hand.length ?? 0) > 0
                        || (context.matchState.core.players[pid]?.deck.length ?? 0) > 0
                        || (context.matchState.core.players[pid]?.discard.length ?? 0) > 0,
                ),
                { state: context.matchState.core, sourcePlayerId: context.playerId, effectIntent: 'inspect' },
            ),
        ] as any[],
        { sourceId: 'base_drakkar', targetType: 'generic', titleKey: 'ui.base_drakkar_title' },
    ),
    onResolve: ({ state, context, value, random, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as PlayerChoice | undefined;
        if (!selected?.targetPlayerId) return { events: [] };
        return resolveRevealAndStealTopCard({
            state,
            actingPlayerId: context.playerId,
            targetPlayerId: selected.targetPlayerId,
            reason: 'base_drakkar',
            random,
            timestamp,
        });
    },
});

const vikingsBaseLonghouseMinionPromptProgram = createPromptProgram<VikingBaseLonghouseMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_longhouse_minion',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const minions = base?.minions.filter(minion => minion.controller === context.playerId) ?? [];
        return createSimpleChoice(
            `base_longhouse_minion_${context.now}`,
            context.playerId,
            '长屋：选择一个你在这里的随从获得 +2 力量直到回合结束',
            buildMinionTargetOptions(
                minions.map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: context.baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(context.matchState.core, minion, context.baseIndex)})`,
                })),
                { state: context.matchState.core, sourcePlayerId: context.playerId },
            ),
            { sourceId: 'base_longhouse_minion', targetType: 'minion', titleKey: 'ui.base_longhouse_minion_title' },
        );
    },
    onResolve: ({ context, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [
                toDeckTop(playerId, context.cardUid, context.defId, 'base_longhouse', timestamp, context.ownerId),
                addTempPower(selected.minionUid, selected.baseIndex, 2, 'base_longhouse', timestamp),
            ],
        };
    },
});

const vikingsBaseLonghouseCardPromptProgram = createPromptProgram<VikingPromptContext & { baseIndex: number }, SmashUpCore, SmashUpEvent>({
    sourceId: 'base_longhouse_card',
    buildInteraction: (context) => createSimpleChoice(
        `base_longhouse_card_${context.now}`,
        context.playerId,
        '长屋：你可以选择一张手牌置于牌库顶',
        [createSkipOption(), ...buildHandCardOptions(context.matchState.core.players[context.playerId]?.hand ?? [])] as any[],
        { sourceId: 'base_longhouse_card', targetType: 'generic', titleKey: 'ui.base_longhouse_card_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as HandChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { events: [] };
        const base = state.core.bases[context.baseIndex];
        const minions = base?.minions.filter(minion => minion.controller === context.playerId) ?? [];
        if (minions.length === 0) return { events: [] };
        return {
            events: [],
            context: createVikingPromptContext(state, context.playerId, timestamp, {
                baseIndex: context.baseIndex,
                cardUid: selected.cardUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
            }),
            nextProgram: vikingsBaseLonghouseMinionPromptProgram,
        };
    },
});

function getOtherPlayers(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    return state.turnOrder.filter(pid => pid !== playerId);
}

function getOwnMinions(state: SmashUpCore, playerId: PlayerId) {
    const result: Array<{ minion: SmashUpCore['bases'][number]['minions'][number]; baseIndex: number }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex++) {
        for (const minion of state.bases[baseIndex].minions) {
            if (minion.controller === playerId) result.push({ minion, baseIndex });
        }
    }
    return result;
}

function buildHandCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `hand-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildPlayerOptions(
    playerIds: PlayerId[],
    context: {
        state?: SmashUpCore;
        sourcePlayerId: PlayerId;
        effectIntent?: 'buff' | 'debuff' | 'inspect' | 'resource';
    },
) {
    return buildPlayerTargetOptions(
        playerIds.map((targetPlayerId, index) => ({
            id: `player-${index}`,
            label: `玩家 ${targetPlayerId}`,
            targetPlayerId,
            displayMode: 'button' as const,
        })),
        context,
    );
}

function buildBaseOptions(state: SmashUpCore) {
    return buildBaseTargetOptions(
        state.bases.map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        })),
        state,
    ) as any[];
}

function getAllMinionOptions(state: SmashUpCore, sourcePlayerId: PlayerId) {
    const candidates = state.bases.flatMap((base, baseIndex) => (
        base.minions.map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
        }))
    ));
    return buildMinionTargetOptions(candidates, { state, sourcePlayerId }) as any[];
}

function collectRansackTargets(state: SmashUpCore) {
    const options: any[] = [];
    for (const base of state.bases) {
        for (const ongoing of base.ongoingActions) {
            options.push({
                id: `ongoing-base-${ongoing.uid}`,
                label: `${getCardDef(ongoing.defId)?.name ?? ongoing.defId}（基地）`,
                value: { cardUid: ongoing.uid, ownerId: ongoing.ownerId, defId: ongoing.defId, kind: 'ongoing' },
                _source: 'field' as const,
                displayMode: 'card' as const,
            });
        }
        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                options.push({
                    id: `ongoing-minion-${attached.uid}`,
                    label: `${getCardDef(attached.defId)?.name ?? attached.defId}（附着行动）`,
                    value: { cardUid: attached.uid, ownerId: attached.ownerId, defId: attached.defId, kind: 'ongoing' },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                });
            }
        }
        for (const buried of base.buriedCards ?? []) {
            options.push({
                id: `buried-${buried.uid}`,
                label: `${getCardDef(buried.defId)?.name ?? buried.defId}（埋葬牌）`,
                value: { cardUid: buried.uid, trueOwnerId: buried.trueOwnerId, defId: buried.defId, kind: 'buried' },
                _source: 'field' as const,
                displayMode: 'card' as const,
            });
        }
    }
    return options;
}

function getTopDeckCardWithReshuffle(
    state: SmashUpCore,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): { events: SmashUpEvent[]; card?: CardInstance } {
    return prepareTopDeckForVikingPeek(state, playerId, random, now);
}

function prepareTopDeckForVikingPeek(
    state: SmashUpCore,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): { events: SmashUpEvent[]; card?: CardInstance; deckSnapshot: CardInstance[] } {
    const player = state.players[playerId];
    if (!player) return { events: [], deckSnapshot: [] };
    if (player.deck.length > 0) return { events: [], card: player.deck[0], deckSnapshot: [...player.deck] };
    if (player.discard.length === 0) return { events: [], deckSnapshot: [] };

    const shuffled = random.shuffle([...player.discard]);
    const sourceDeckCards = shuffled.filter(card => card.owner === playerId || !state.players[card.owner]);
    const borrowedByOwner = new Map<PlayerId, CardInstance[]>();
    for (const card of shuffled) {
        if (card.owner === playerId || !state.players[card.owner]) continue;
        borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
    }
    const events: SmashUpEvent[] = Array.from(borrowedByOwner.entries()).map(([ownerId, cards]) => ({
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId: ownerId,
            deckUids: [...(state.players[ownerId]?.deck ?? []).map(card => card.uid), ...cards.map(card => card.uid)],
            sourcePlayerId: playerId,
        },
        timestamp: now,
    }) as DeckReorderedEvent);
    if (sourceDeckCards.length > 0) {
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: sourceDeckCards.map(card => card.uid) },
            timestamp: now,
        } as DeckReorderedEvent);
    }

    return {
        events,
        card: sourceDeckCards[0],
        deckSnapshot: sourceDeckCards,
    };
}

function prepareTopDeckCards(
    state: SmashUpCore,
    playerId: PlayerId,
    count: number,
    random: RandomFn,
    now: number,
): { events: SmashUpEvent[]; cards: CardInstance[]; remainingDeckUids: string[] } {
    const player = state.players[playerId];
    if (!player) return { events: [], cards: [], remainingDeckUids: [] };
    let deck = [...player.deck];
    const events: SmashUpEvent[] = [];
    if (deck.length === 0 && player.discard.length > 0) {
        const prepared = prepareTopDeckForVikingPeek(state, playerId, random, now);
        deck = prepared.deckSnapshot;
        events.push(...prepared.events);
    }
    const cards = deck.slice(0, count);
    return {
        events,
        cards,
        remainingDeckUids: deck.slice(cards.length).map(card => card.uid),
    };
}

function isRaidingPartyPlayable(card: CardInstance): boolean {
    if (card.type === 'action') return true;
    if (card.type !== 'minion') return false;
    return ((getCardDef(card.defId) as any)?.power ?? 99) <= 4;
}

function playRaidingPartyCard(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    selected: Exclude<RaidingPartyChoice, { skip: true }>,
    targets: { baseIndex?: number; targetBaseIndex?: number; targetMinionUid?: string },
    random: RandomFn,
    timestamp: number,
    prefixEvents: SmashUpEvent[],
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const transferEvent = transferCard(
        selected.cardUid,
        selected.defId,
        selected.sourcePlayerId,
        playerId,
        'vikings_raiding_party',
        timestamp,
        selected.ownerId,
    );

    if (selected.type === 'minion') {
        const baseIndex = targets.baseIndex ?? 0;
        const minionDef = getCardDef(selected.defId) as { power?: number } | undefined;
        return {
            state,
            events: [
                transferEvent,
                ...prefixEvents,
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: selected.cardUid,
                        defId: selected.defId,
                        ownerId: selected.ownerId,
                        baseIndex,
                        baseDefId: state.core.bases[baseIndex]?.defId,
                        power: minionDef?.power ?? 0,
                        consumesNormalLimit: false,
                    },
                    timestamp,
                } as MinionPlayedEvent,
            ],
        };
    }

    const actionDef = getCardDef(selected.defId) as { subtype?: string } | undefined;
    const actionEvents: SmashUpEvent[] = [
        transferEvent,
        ...prefixEvents,
        buildActionPlayedEvent({
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId: selected.ownerId,
            isExtraAction: true,
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            timestamp,
        }) as SmashUpEvent,
    ];

    if (actionDef?.subtype === 'ongoing' && targets.targetBaseIndex !== undefined) {
        actionEvents.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId: selected.ownerId,
            ...(selected.ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now: timestamp,
        }));
    }

    const appended = appendResolvedActionAbility({
        state,
        events: actionEvents,
        playerId,
        cardUid: selected.cardUid,
        defId: selected.defId,
        random,
        timestamp,
        baseIndex: targets.targetBaseIndex ?? 0,
        targetBaseIndex: targets.targetBaseIndex,
        targetMinionUid: targets.targetMinionUid,
    });

    return {
        state: appended.state,
        events: appended.events,
    };
}

function transferCard(
    cardUid: string,
    defId: string,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    reason: string,
    timestamp: number,
    ownerId?: PlayerId,
): CardTransferredEvent {
    return createCardTransferEvent({
        card: createCardObjectRef({
            uid: cardUid,
            defId,
            ownerId: ownerId ?? fromPlayerId,
        }),
        fromPlayerId,
        toPlayerId,
        reason,
        timestamp,
    });
}

function toDeckTop(
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    reason: string,
    timestamp: number,
    ownerId = playerId,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid,
            defId,
            ownerId,
            ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            reason,
        },
        timestamp,
    };
}

function getTurnMinionsPlayedAtBase(state: SmashUpCore, baseIndex: number): number {
    return Object.values(state.players).reduce(
        (total, player) => total + (player.minionsPlayedPerBase?.[baseIndex] ?? 0),
        0,
    );
}

const DEFAULT_RANDOM: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};
