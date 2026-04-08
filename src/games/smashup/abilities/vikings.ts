import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, getCurrentTrackedCardTopSnapshot, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerActiveBaseAbility, registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import {
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    createSkipOption,
    findMinionOnBases,
    grantExtraAction,
    getMinionPower,
    peekDeckTop,
    revealDeckTop,
    revealHand,
} from '../domain/abilityHelpers';
import type {
    CardInstance,
    CardRemovedFromGameEvent,
    CardToDeckTopEvent,
    CardTransferredEvent,
    DeckReorderedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
} from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import { actionLikeNeedsPlayBase } from '../domain/utils';
import { execute } from '../domain/reducer';
import { reduce } from '../domain/reduce';

type PlayerChoice = { targetPlayerId: PlayerId };
type HandChoice = { cardUid: string; defId: string };
type MinionChoice = { minionUid: string; baseIndex: number };
type CastRunesChoice = { topCardUid: string; cardUid?: string; defId?: string };
type RaidingPartyChoice = { cardUid: string; ownerId: PlayerId; defId: string; type: 'action' | 'minion' } | { skip: true };

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
    revealedCards: Array<{ uid: string; defId: string }>,
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
    revealedCards: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>,
) {
    const eligible = getCurrentDeckTopSnapshotCards(state, targetPlayerId, revealedCards)
        .filter((card) => isRaidingPartyPlayable(card as CardInstance))
        .map((card, index) => ({
            id: `play-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, ownerId: targetPlayerId, defId: card.defId, type: card.type },
            _source: 'static' as const,
            displayMode: 'card' as const,
        }));

    return [createSkipOption('不打出') as any, ...eligible] as Array<{
        id: string;
        label: string;
        value: RaidingPartyChoice;
        _source?: 'static';
        displayMode?: 'button' | 'card';
    }>;
}

export function registerVikingsAbilities(): void {
    registerAbility('vikings_huscarl', 'talent', vikingsHuscarlTalent);
    registerAbility('vikings_shield_maiden', 'onPlay', vikingsShieldMaidenOnPlay);
    registerAbility('vikings_raider', 'talent', vikingsRaiderTalent);
    registerAbility('vikings_valkyrie', 'onPlay', vikingsValkyrieOnPlay);
    registerAbility('vikings_ransack', 'onPlay', vikingsRansackOnPlay);
    registerAbility('vikings_pillage', 'onPlay', vikingsPillageOnPlay);
    registerAbility('vikings_cast_the_runes', 'onPlay', vikingsCastTheRunesOnPlay);
    registerAbility('vikings_raiding_party', 'onPlay', vikingsRaidingPartyOnPlay);
    registerAbility('vikings_berserk', 'onPlay', vikingsBerserkOnPlay);
    registerAbility('vikings_tribute', 'onPlay', vikingsTributeOnPlay);
    registerAbility('vikings_combat_training', 'onPlay', vikingsCombatTrainingOnPlay);

    registerTrigger('vikings_viking_funeral', 'onMinionDestroyed', vikingsVikingFuneralTrigger, { perInstance: true });
    registerTrigger('vikings_viking_funeral', 'onMinionDiscardedFromBase', vikingsVikingFuneralTrigger, { perInstance: true });

    registerBaseAbility('base_drakkar', 'onMinionPlayed', vikingsBaseDrakkarOnMinionPlayed);
    registerActiveBaseAbility('base_longhouse', vikingsBaseLonghouseDuringTurn, {
        canUse: (ctx) => {
            const player = ctx.state.players[ctx.playerId];
            const minions = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
            return !!player && player.hand.length > 0 && minions.length > 0;
        },
    });
}

export function registerVikingsInteractionHandlers(): void {
    registerInteractionHandler('vikings_huscarl', handleVikingsHuscarl);
    registerInteractionHandler('vikings_shield_maiden', handleVikingsShieldMaiden);
    registerInteractionHandler('vikings_raider', handleVikingsRaider);
    registerInteractionHandler('vikings_valkyrie', handleVikingsValkyrie);
    registerInteractionHandler('vikings_ransack', handleVikingsRansack);
    registerInteractionHandler('vikings_pillage', handleVikingsPillage);
    registerInteractionHandler('vikings_cast_the_runes_player', handleVikingsCastTheRunesPlayer);
    registerInteractionHandler('vikings_cast_the_runes_order', handleVikingsCastTheRunesOrder);
    registerInteractionHandler('vikings_raiding_party_player', handleVikingsRaidingPartyPlayer);
    registerInteractionHandler('vikings_raiding_party_choice', handleVikingsRaidingPartyChoice);
    registerInteractionHandler('vikings_raiding_party_minion_base', handleVikingsRaidingPartyMinionBase);
    registerInteractionHandler('vikings_raiding_party_action_base', handleVikingsRaidingPartyActionBase);
    registerInteractionHandler('vikings_raiding_party_action_minion', handleVikingsRaidingPartyActionMinion);
    registerInteractionHandler('vikings_berserk_card', handleVikingsBerserkCard);
    registerInteractionHandler('vikings_berserk_minion', handleVikingsBerserkMinion);
    registerInteractionHandler('base_drakkar', handleBaseDrakkar);
    registerInteractionHandler('base_longhouse_card', handleBaseLonghouseCard);
    registerInteractionHandler('base_longhouse_minion', handleBaseLonghouseMinion);
}

function vikingsHuscarlTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!source || !player || player.hand.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_huscarl_${ctx.now}`,
        ctx.playerId,
        '侍卫：选择一张手牌置于牌库顶，本随从在回合结束前 +2 力量',
        [createSkipOption('跳过（不放牌）') as any, ...buildHandCardOptions(player.hand)] as any[],
        { sourceId: 'vikings_huscarl', targetType: 'generic' },
    );
    (interaction.data as any).continuationContext = { minionUid: source.minion.uid, baseIndex: source.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsShieldMaidenOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_shield_maiden_${ctx.now}`,
        ctx.playerId,
        '盾女：选择另一位玩家，展示其牌库顶的一张牌',
        [createSkipOption('跳过（不揭示）') as any, ...buildPlayerOptions(opponents)] as any[],
        { sourceId: 'vikings_shield_maiden', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsRaiderTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    const player = ctx.state.players[ctx.playerId];
    if (!source || !player || player.hand.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    }
    const options = buildHandCardOptions(player.hand);
    const interaction = createSimpleChoice(
        `vikings_raider_${ctx.now}`,
        ctx.playerId,
        `袭击者：选择至多 ${Math.min(3, options.length)} 张手牌置于牌库顶，本随从每张 +1 力量`,
        options,
        { sourceId: 'vikings_raider', targetType: 'generic' },
        undefined,
        { min: 0, max: Math.min(3, options.length) },
    );
    (interaction.data as any).continuationContext = { minionUid: source.minion.uid, baseIndex: source.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    const interaction = createSimpleChoice(
        `vikings_valkyrie_${ctx.now}`,
        ctx.playerId,
        '女武神：选择另一位玩家弃牌堆中的一个随从',
        [createSkipOption('跳过（不取回）') as any, ...options] as any[],
        { sourceId: 'vikings_valkyrie', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsRansackOnPlay(ctx: AbilityContext): AbilityResult {
    const options = collectRansackTargets(ctx.state);
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_ransack_${ctx.now}`,
        ctx.playerId,
        '洗劫：选择一个打出的行动牌或一张埋葬牌，将其置入你的手牌',
        options,
        { sourceId: 'vikings_ransack', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsPillageOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(pid => (ctx.state.players[pid]?.hand.length ?? 0) > 0);
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_pillage_${ctx.now}`,
        ctx.playerId,
        '掠夺：选择另一位玩家，随机拿走其一张手牌',
        buildPlayerOptions(opponents),
        { sourceId: 'vikings_pillage', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsCastTheRunesOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => (ctx.state.players[pid]?.hand.length ?? 0) > 0 || getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_cast_the_runes_player_${ctx.now}`,
        ctx.playerId,
        '掷卢恩符文：选择另一位玩家',
        buildPlayerOptions(opponents),
        { sourceId: 'vikings_cast_the_runes_player', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsRaidingPartyOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => getTopDeckCardWithReshuffle(ctx.state, pid, ctx.random, ctx.now).card !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `vikings_raiding_party_player_${ctx.now}`,
        ctx.playerId,
        '突袭队：选择另一位玩家，展示其牌库顶三张牌',
        buildPlayerOptions(opponents),
        { sourceId: 'vikings_raiding_party_player', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    const interaction = createSimpleChoice(
        `vikings_berserk_card_${ctx.now}`,
        ctx.playerId,
        '狂战：选择一张手牌置于牌库顶',
        buildHandCardOptions(player.hand),
        { sourceId: 'vikings_berserk_card', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
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
    if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId || ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return [];
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const minion = base?.minions.find(entry => entry.uid === ctx.triggerMinionUid);
    const funeral = minion?.attachedActions.find(action => action.uid === ctx.sourceCardUid && action.defId === 'vikings_viking_funeral');
    if (!funeral) return [];

    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'vikings_viking_funeral' },
        timestamp: ctx.now,
    } as VpAwardedEvent];

    if (minion.owner === ctx.sourceControllerId) {
        events.push({
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: {
                playerId: ctx.sourceControllerId,
                cardUid: minion.uid,
                defId: minion.defId,
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
    const interaction = createSimpleChoice(
        `base_drakkar_${ctx.now}`,
        ctx.playerId,
        '德拉卡尔号：选择另一位玩家，展示其牌库顶的一张牌',
        [createSkipOption('跳过（不揭示）') as any, ...buildPlayerOptions(opponents)] as any[],
        { sourceId: 'base_drakkar', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function vikingsBaseLonghouseDuringTurn(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minions = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (!player || player.hand.length === 0 || minions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `base_longhouse_card_${ctx.now}`,
        ctx.playerId,
        '长屋：你可以选择一张手牌置于牌库顶',
        [createSkipOption(), ...buildHandCardOptions(player.hand)] as any[],
        { sourceId: 'base_longhouse_card', targetType: 'generic' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

const handleVikingsHuscarl = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as HandChoice | undefined;
    const ctx = data?.continuationContext as { minionUid: string; baseIndex: number } | undefined;
    if (!selected?.cardUid || !selected.defId || ctx?.baseIndex === undefined) return { state, events: [] };
    return {
        state,
        events: [
            toDeckTop(playerId, selected.cardUid, selected.defId, 'vikings_huscarl', timestamp),
            addTempPower(ctx.minionUid, ctx.baseIndex, 2, 'vikings_huscarl', timestamp),
        ],
    };
};

const handleVikingsShieldMaiden = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, random: RandomFn, timestamp: number) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as PlayerChoice | undefined;
    if (!selected?.targetPlayerId) return { state, events: [] };
    const peek = peekDeckTop(state.core, random, selected.targetPlayerId, 'all', 'vikings_shield_maiden', timestamp);
    if (!peek) return { state, events: [] };
    const def = getCardDef(peek.card.defId) as any;
    const eligible = peek.card.type === 'action' || (peek.card.type === 'minion' && (def?.power ?? 99) <= 3);
    const events: SmashUpEvent[] = [...peek.events];
    if (eligible) {
        events.push(transferCard(peek.card.uid, peek.card.defId, selected.targetPlayerId, playerId, 'vikings_shield_maiden', timestamp));
    }
    return { state, events };
};

const handleVikingsRaider = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    const selections = (Array.isArray(value) ? value : [value]) as HandChoice[];
    const ctx = data?.continuationContext as { minionUid: string; baseIndex: number } | undefined;
    const valid = selections.filter(selection => selection?.cardUid && selection?.defId).slice(0, 3);
    if (!ctx || valid.length === 0) return { state, events: [] };
    const events: SmashUpEvent[] = [];
    for (const selection of [...valid].reverse()) {
        events.push(toDeckTop(playerId, selection.cardUid, selection.defId, 'vikings_raider', timestamp));
    }
    events.push(addTempPower(ctx.minionUid, ctx.baseIndex, valid.length, 'vikings_raider', timestamp));
    return { state, events };
};

const handleVikingsValkyrie = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, _random: RandomFn, timestamp: number) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as { cardUid?: string; ownerId?: PlayerId; defId?: string } | undefined;
    if (!selected?.cardUid || !selected.ownerId || !selected.defId) return { state, events: [] };
    return { state, events: [transferCard(selected.cardUid, selected.defId, selected.ownerId, playerId, 'vikings_valkyrie', timestamp)] };
};

const handleVikingsRansack = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, _random: RandomFn, timestamp: number) => {
    const selected = value as any;
    if (!selected?.cardUid || !selected?.defId) return { state, events: [] };
    if (selected.kind === 'buried' && selected.trueOwnerId) {
        return { state, events: [transferCard(selected.cardUid, selected.defId, selected.trueOwnerId, playerId, 'vikings_ransack', timestamp)] };
    }
    if (selected.ownerId) {
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: { cardUid: selected.cardUid, defId: selected.defId, ownerId: selected.ownerId, reason: 'vikings_ransack' },
                    timestamp,
                } as OngoingDetachedEvent,
                transferCard(selected.cardUid, selected.defId, selected.ownerId, playerId, 'vikings_ransack', timestamp),
            ],
        };
    }
    return { state, events: [] };
};

const handleVikingsPillage = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, random: RandomFn, timestamp: number) => {
    const selected = value as PlayerChoice | undefined;
    if (!selected?.targetPlayerId) return { state, events: [] };
    const target = state.core.players[selected.targetPlayerId];
    if (!target || target.hand.length === 0) return { state, events: [] };
    const card = random.shuffle([...target.hand])[0];
    return card
        ? { state, events: [transferCard(card.uid, card.defId, selected.targetPlayerId, playerId, 'vikings_pillage', timestamp)] }
        : { state, events: [] };
};

const handleVikingsCastTheRunesPlayer = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, random: RandomFn, timestamp: number) => {
    const selected = value as PlayerChoice | undefined;
    if (!selected?.targetPlayerId) return { state, events: [] };
    const target = state.core.players[selected.targetPlayerId];
    if (!target) return { state, events: [] };

    const handReveal = revealHand(
        selected.targetPlayerId,
        playerId,
        target.hand.map(card => ({ uid: card.uid, defId: card.defId })),
        'vikings_cast_the_runes',
        timestamp,
    );
    const deckInfo = prepareTopDeckCards(state.core, selected.targetPlayerId, 2, random, timestamp);
    const events: SmashUpEvent[] = [handReveal, ...deckInfo.events, grantExtraAction(playerId, 'vikings_cast_the_runes', timestamp)];
    if (deckInfo.cards.length > 0) {
        events.push(revealDeckTop(
            selected.targetPlayerId,
            'all',
            deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId })),
            deckInfo.cards.length,
            'vikings_cast_the_runes',
            timestamp,
        ));
    }
    if (deckInfo.cards.length <= 1) return { state, events };

    const interaction = createSimpleChoice(
        `vikings_cast_the_runes_order_${timestamp}`,
        playerId,
        '掷卢恩符文：选择放回牌库顶的顺序',
        buildCastTheRunesOrderOptions(state.core, selected.targetPlayerId, deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId }))),
        { sourceId: 'vikings_cast_the_runes_order', targetType: 'generic', responseValidationMode: 'live' },
    );
    (interaction.data as any).continuationContext = {
        targetPlayerId: selected.targetPlayerId,
        revealedCards: deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId })),
    };
    (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>, data: any) => {
        const ctx = data?.continuationContext as { targetPlayerId: PlayerId; revealedCards: Array<{ uid: string; defId: string }> } | undefined;
        if (!ctx) return [];
        return buildCastTheRunesOrderOptions(nextState.core, ctx.targetPlayerId, ctx.revealedCards);
    };
    return { state: queueInteraction(state, interaction), events };
};

const handleVikingsCastTheRunesOrder = (state: MatchState<SmashUpCore>, _playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    const selected = value as CastRunesChoice | undefined;
    const ctx = data?.continuationContext as { targetPlayerId: PlayerId; revealedCards: Array<{ uid: string; defId: string }> } | undefined;
    if (!selected?.topCardUid || !ctx) return { state, events: [] };
    const currentRevealed = getCurrentDeckTopSnapshotCards(state.core, ctx.targetPlayerId, ctx.revealedCards);
    if (currentRevealed.length === 0) return { state, events: [] };
    const topCard = currentRevealed.find(card => card.uid === selected.topCardUid);
    if (!topCard) return { state, events: [] };
    const rest = currentRevealed.filter(card => card.uid !== selected.topCardUid);
    const trackedUidSet = new Set(currentRevealed.map(card => card.uid));
    const liveRemainingDeckUids = (state.core.players[ctx.targetPlayerId]?.deck ?? [])
        .filter(card => !trackedUidSet.has(card.uid))
        .map(card => card.uid);
    return {
        state,
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId: ctx.targetPlayerId, deckUids: [topCard.uid, ...rest.map(card => card.uid), ...liveRemainingDeckUids] },
            timestamp,
        } as DeckReorderedEvent],
    };
};

const handleVikingsRaidingPartyPlayer = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, random: RandomFn, timestamp: number) => {
    const selected = value as PlayerChoice | undefined;
    if (!selected?.targetPlayerId) return { state, events: [] };
    const deckInfo = prepareTopDeckCards(state.core, selected.targetPlayerId, 3, random, timestamp);
    if (deckInfo.cards.length === 0) return { state, events: [] };

    const events: SmashUpEvent[] = [
        ...deckInfo.events,
        revealDeckTop(
            selected.targetPlayerId,
            'all',
            deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId })),
            deckInfo.cards.length,
            'vikings_raiding_party',
            timestamp,
        ),
    ];
    const interaction = createSimpleChoice(
        `vikings_raiding_party_choice_${timestamp}`,
        playerId,
        '突袭队：你可以选择一张可打出的牌',
        buildRaidingPartyChoiceOptions(
            state.core,
            selected.targetPlayerId,
            deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId, type: card.type as 'action' | 'minion' })),
        ) as any[],
        { sourceId: 'vikings_raiding_party_choice', targetType: 'generic', responseValidationMode: 'live' },
    );
    (interaction.data as any).continuationContext = {
        targetPlayerId: selected.targetPlayerId,
        revealedCards: deckInfo.cards.map(card => ({ uid: card.uid, defId: card.defId, type: card.type as 'action' | 'minion' })),
    };
    (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>, interactionData: any) => {
        const ctx = interactionData?.continuationContext as {
            targetPlayerId: PlayerId;
            revealedCards: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>;
        } | undefined;
        if (!ctx) return [];
        return buildRaidingPartyChoiceOptions(nextState.core, ctx.targetPlayerId, ctx.revealedCards);
    };
    return { state: queueInteraction(state, interaction), events };
};

const handleVikingsRaidingPartyChoice = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, random: RandomFn, timestamp: number) => {
    const selected = value as RaidingPartyChoice | undefined;
    const ctx = data?.continuationContext as {
        targetPlayerId: PlayerId;
        revealedCards: Array<{ uid: string; defId: string; type: 'action' | 'minion' }>;
    } | undefined;
    if (!ctx) return { state, events: [] };
    const currentRevealed = getCurrentDeckTopSnapshotCards(state.core, ctx.targetPlayerId, ctx.revealedCards);
    if (currentRevealed.length === 0) return { state, events: [] };
    const chosenUid = selected && 'cardUid' in selected ? selected.cardUid : undefined;
    const remaining = currentRevealed.filter(card => card.uid !== chosenUid);
    const trackedUidSet = new Set(currentRevealed.map(card => card.uid));
    const liveRemainingDeckUids = (state.core.players[ctx.targetPlayerId]?.deck ?? [])
        .filter(card => !trackedUidSet.has(card.uid))
        .map(card => card.uid);
    const reorderEvent: SmashUpEvent = {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId: ctx.targetPlayerId, deckUids: [...remaining.map(card => card.uid), ...liveRemainingDeckUids] },
        timestamp,
    } as DeckReorderedEvent;

    if (!selected || 'skip' in selected) {
        return { state, events: [reorderEvent] };
    }

    if (selected.type === 'minion') {
        if (state.core.bases.length === 1) {
            return playRaidingPartyCard(state, playerId, selected, { baseIndex: 0 }, random, timestamp, [reorderEvent]);
        }
        const interaction = createSimpleChoice(
            `vikings_raiding_party_minion_base_${timestamp}`,
            playerId,
            '突袭队：选择该额外随从要打出的基地',
            buildBaseOptions(state.core),
            { sourceId: 'vikings_raiding_party_minion_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = { selected, reorderEvent };
        return { state: queueInteraction(state, interaction), events: [] };
    }

    const actionDef = getCardDef(selected.defId) as any;
    if (actionDef?.subtype === 'ongoing' && actionDef?.ongoingTarget === 'minion') {
        const minionOptions = getAllMinionOptions(state.core, playerId);
        if (minionOptions.length === 0) return { state, events: [reorderEvent] };
        const interaction = createSimpleChoice(
            `vikings_raiding_party_action_minion_${timestamp}`,
            playerId,
            '突袭队：选择该额外行动的目标随从',
            minionOptions,
            { sourceId: 'vikings_raiding_party_action_minion', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = { selected, reorderEvent };
        return { state: queueInteraction(state, interaction), events: [] };
    }

    if (actionDef && (actionDef.subtype === 'ongoing' || actionLikeNeedsPlayBase(actionDef))) {
        const interaction = createSimpleChoice(
            `vikings_raiding_party_action_base_${timestamp}`,
            playerId,
            '突袭队：选择该额外行动的目标基地',
            buildBaseOptions(state.core),
            { sourceId: 'vikings_raiding_party_action_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = { selected, reorderEvent };
        return { state: queueInteraction(state, interaction), events: [] };
    }

    return playRaidingPartyCard(state, playerId, selected, {}, random, timestamp, [reorderEvent]);
};

const handleVikingsRaidingPartyMinionBase = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, random: RandomFn, timestamp: number) => {
    const selectedBase = value as { baseIndex?: number } | undefined;
    const ctx = data?.continuationContext as { selected: Exclude<RaidingPartyChoice, { skip: true }>; reorderEvent: SmashUpEvent } | undefined;
    if (selectedBase?.baseIndex === undefined || !ctx) return { state, events: [] };
    return playRaidingPartyCard(state, playerId, ctx.selected, { baseIndex: selectedBase.baseIndex }, random, timestamp, [ctx.reorderEvent]);
};

const handleVikingsRaidingPartyActionBase = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, random: RandomFn, timestamp: number) => {
    const selectedBase = value as { baseIndex?: number } | undefined;
    const ctx = data?.continuationContext as { selected: Exclude<RaidingPartyChoice, { skip: true }>; reorderEvent: SmashUpEvent } | undefined;
    if (selectedBase?.baseIndex === undefined || !ctx) return { state, events: [] };
    return playRaidingPartyCard(state, playerId, ctx.selected, { targetBaseIndex: selectedBase.baseIndex }, random, timestamp, [ctx.reorderEvent]);
};

const handleVikingsRaidingPartyActionMinion = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, random: RandomFn, timestamp: number) => {
    const selectedMinion = value as { minionUid?: string; baseIndex?: number } | undefined;
    const ctx = data?.continuationContext as { selected: Exclude<RaidingPartyChoice, { skip: true }>; reorderEvent: SmashUpEvent } | undefined;
    if (!selectedMinion?.minionUid || selectedMinion.baseIndex === undefined || !ctx) return { state, events: [] };
    return playRaidingPartyCard(
        state,
        playerId,
        ctx.selected,
        { targetBaseIndex: selectedMinion.baseIndex, targetMinionUid: selectedMinion.minionUid },
        random,
        timestamp,
        [ctx.reorderEvent],
    );
};

const handleVikingsBerserkCard = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, _random: RandomFn, timestamp: number) => {
    const selected = value as HandChoice | undefined;
    if (!selected?.cardUid || !selected.defId) return { state, events: [] };
    const minions = getOwnMinions(state.core, playerId);
    if (minions.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `vikings_berserk_minion_${timestamp}`,
        playerId,
        '狂战：选择一个你的随从获得 +4 力量直到回合结束',
        buildMinionTargetOptions(
            minions.map(({ minion, baseIndex }) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(state.core, minion, baseIndex)})`,
            })),
            { state: state.core, sourcePlayerId: playerId },
        ),
        { sourceId: 'vikings_berserk_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { cardUid: selected.cardUid, defId: selected.defId };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleVikingsBerserkMinion = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as HandChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined || !ctx?.cardUid || !ctx.defId) return { state, events: [] };
    return {
        state,
        events: [
            toDeckTop(playerId, ctx.cardUid, ctx.defId, 'vikings_berserk', timestamp),
            addTempPower(selected.minionUid, selected.baseIndex, 4, 'vikings_berserk', timestamp),
        ],
    };
};

const handleBaseDrakkar = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, _data: any, random: RandomFn, timestamp: number) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as PlayerChoice | undefined;
    if (!selected?.targetPlayerId) return { state, events: [] };
    const peek = peekDeckTop(state.core, random, selected.targetPlayerId, 'all', 'base_drakkar', timestamp);
    if (!peek) return { state, events: [] };
    const def = getCardDef(peek.card.defId) as any;
    const eligible = peek.card.type === 'action' || (peek.card.type === 'minion' && (def?.power ?? 99) <= 3);
    const events: SmashUpEvent[] = [...peek.events];
    if (eligible) {
        events.push(transferCard(peek.card.uid, peek.card.defId, selected.targetPlayerId, playerId, 'base_drakkar', timestamp));
    }
    return { state, events };
};

const handleBaseLonghouseCard = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    if ((value as any)?.skip) return { state, events: [] };
    const selected = value as HandChoice | undefined;
    const ctx = data?.continuationContext as { baseIndex: number } | undefined;
    if (!selected?.cardUid || !selected.defId || ctx?.baseIndex === undefined) return { state, events: [] };
    const base = state.core.bases[ctx.baseIndex];
    if (!base) return { state, events: [] };
    const minions = base.minions.filter(minion => minion.controller === playerId);
    if (minions.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `base_longhouse_minion_${timestamp}`,
        playerId,
        '长屋：选择一个你在这里的随从获得 +2 力量直到回合结束',
        buildMinionTargetOptions(
            minions.map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: ctx.baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getMinionPower(state.core, minion, ctx.baseIndex)})`,
            })),
            { state: state.core, sourcePlayerId: playerId },
        ),
        { sourceId: 'base_longhouse_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex, cardUid: selected.cardUid, defId: selected.defId };
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleBaseLonghouseMinion = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: any, _random: RandomFn, timestamp: number) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as { baseIndex: number; cardUid: string; defId: string } | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined || !ctx?.cardUid || !ctx.defId) return { state, events: [] };
    return {
        state,
        events: [
            toDeckTop(playerId, ctx.cardUid, ctx.defId, 'base_longhouse', timestamp),
            addTempPower(selected.minionUid, selected.baseIndex, 2, 'base_longhouse', timestamp),
        ],
    };
};

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
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'hand' as const,
        displayMode: 'card' as const,
    }));
}

function buildPlayerOptions(playerIds: PlayerId[]) {
    return playerIds.map((targetPlayerId, index) => ({
        id: `player-${index}`,
        label: `玩家 ${targetPlayerId}`,
        value: { targetPlayerId },
        displayMode: 'button' as const,
    }));
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
    const player = state.players[playerId];
    if (!player) return { events: [] };
    if (player.deck.length > 0) return { events: [], card: player.deck[0] };
    if (player.discard.length === 0) return { events: [] };
    const shuffled = random.shuffle([...player.discard]);
    return {
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: shuffled.map(card => card.uid) },
            timestamp: now,
        } as DeckReorderedEvent],
        card: shuffled[0],
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
        deck = random.shuffle([...player.discard]);
        events.push({
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: deck.map(card => card.uid) },
            timestamp: now,
        } as DeckReorderedEvent);
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

function cloneSysForSimulatedExecute(state: MatchState<SmashUpCore>) {
    return {
        ...state.sys,
        interaction: state.sys.interaction
            ? {
                ...state.sys.interaction,
                queue: [...(state.sys.interaction.queue ?? [])],
            }
            : { queue: [] },
    } as MatchState<SmashUpCore>['sys'];
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
    const transferEvent = transferCard(selected.cardUid, selected.defId, selected.ownerId, playerId, 'vikings_raiding_party', timestamp);
    const simulatedCore = reduce(state.core, transferEvent);
    const simulatedState: MatchState<SmashUpCore> = {
        ...state,
        core: simulatedCore,
        sys: cloneSysForSimulatedExecute(state),
    };

    const command = selected.type === 'minion'
        ? {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid: selected.cardUid, baseIndex: targets.baseIndex ?? 0 },
        }
        : {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: {
                cardUid: selected.cardUid,
                ...(targets.targetBaseIndex !== undefined ? { targetBaseIndex: targets.targetBaseIndex } : {}),
                ...(targets.targetMinionUid ? { targetMinionUid: targets.targetMinionUid } : {}),
            },
        };

    const playEvents = execute(simulatedState, command as any, random).map((event) => {
        if (event.type === SU_EVENTS.MINION_PLAYED && selected.type === 'minion' && (event as any).payload.cardUid === selected.cardUid) {
            return {
                ...event,
                payload: { ...(event as any).payload, consumesNormalLimit: false },
            } as SmashUpEvent;
        }
        if (event.type === SU_EVENTS.ACTION_PLAYED && selected.type === 'action' && (event as any).payload.cardUid === selected.cardUid) {
            return {
                ...event,
                payload: { ...(event as any).payload, isExtraAction: true },
            } as SmashUpEvent;
        }
        return event;
    });
    const currentInteractionId = state.sys.interaction?.current?.id;
    const nextInteractionId = simulatedState.sys.interaction?.current?.id;
    const hasNewInteraction = (
        !!nextInteractionId && nextInteractionId !== currentInteractionId
    ) || ((simulatedState.sys.interaction?.queue?.length ?? 0) > (state.sys.interaction?.queue?.length ?? 0));

    return {
        state: hasNewInteraction ? { ...state, sys: simulatedState.sys } : state,
        events: [transferEvent, ...prefixEvents, ...playEvents],
    };
}

function transferCard(
    cardUid: string,
    defId: string,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId,
    reason: string,
    timestamp: number,
): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: { cardUid, defId, fromPlayerId, toPlayerId, reason },
        timestamp,
    };
}

function toDeckTop(
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    reason: string,
    timestamp: number,
): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: { cardUid, defId, ownerId: playerId, reason },
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
