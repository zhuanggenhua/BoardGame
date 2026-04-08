import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, getCurrentTrackedCardTopSnapshot, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import {
    addTempPower,
    buildActionMinionTargetOptions,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
    inspectDeck,
    moveTitan,
} from '../domain/abilityHelpers';
import { registerBaseAbility, registerExtended } from '../domain/baseAbilities';
import { isMinionProtected, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { canStartDuel, isMinionInActiveDuel, startDuel } from '../domain/duel';
import { validateActionPlaySemantics, validateDeckTopRegularMinionPlaySemantics } from '../domain/playLegality';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion } from '../domain/utils';
import { execute } from '../domain/reducer';
import { reduce } from '../domain/reduce';
import type {
    CardsDrawnEvent,
    CardInstance,
    DeckReorderedEvent,
    MinionOnBase,
    MinionMetadataUpdatedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';

type MinionChoice = { minionUid: string; baseIndex: number; defId?: string };
type FriendlyChoice = MinionChoice;
type DuelContinuation = {
    friendlyMinionUid: string;
    casterPlayerId: PlayerId;
    sourceId: string;
};
type StagecoachSourceContinuation = {
    sourceBaseIndex: number;
};
type StagecoachCardChoice = {
    kind: 'minion' | 'titan' | 'ongoing_base' | 'buried';
    uid: string;
    defId: string;
    baseIndex: number;
    ownerId?: PlayerId;
    trueOwnerId?: PlayerId;
};
type StagecoachDestinationContinuation = {
    sourceBaseIndex: number;
    selectedCards: StagecoachCardChoice[];
};
type GoldChoice = { cardUid: string; defId: string };
type GoldModeChoice = { mode: 'hand' | 'play' };
type GoldOrderChoice = { topCardUid: string; cardUid?: string; defId?: string };
type GoldPromptContext = {
    chosenCard: CardInstance;
    remainingCards: CardInstance[];
};

function getCurrentDeckTopSnapshotCards<T extends { uid: string; defId: string }>(
    core: SmashUpCore,
    playerId: PlayerId,
    trackedCards: T[],
): T[] {
    return getCurrentTrackedCardTopSnapshot(core.players[playerId]?.deck ?? [], trackedCards);
}

function buildGoldTopCardOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    topCards: CardInstance[],
) {
    return getCurrentDeckTopSnapshotCards(core, playerId, topCards).map((card, index) => ({
        id: `top-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'deck' as const,
        displayMode: 'card' as const,
    }));
}

function buildGoldOrderOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    context: GoldPromptContext,
) {
    const snapshot = getCurrentDeckTopSnapshotCards(core, playerId, [context.chosenCard, ...context.remainingCards]);
    const currentChosen = snapshot.find((card) => card.uid === context.chosenCard.uid);
    if (!currentChosen) {
        return [];
    }
    const remainingUidSet = new Set(context.remainingCards.map((card) => card.uid));
    return snapshot
        .filter((card) => remainingUidSet.has(card.uid))
        .map((card, index) => ({
            id: `gold-order-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { topCardUid: card.uid, cardUid: card.uid, defId: card.defId },
            _source: 'static' as const,
            displayMode: 'card' as const,
        }));
}

function isDynamiteSurpriseDefId(defId: string): boolean {
    return defId === 'cowboys_dynamite_surprise' || defId === 'cowboys_dynamite_surprise_pod';
}

export function registerCowboysAbilities(): void {
    registerAbility('cowboys_gunfighter', 'onPlay', cowboysGunfighterOnPlay);
    registerAbility('cowboys_quick_draw', 'onPlay', cowboysQuickDrawOnPlay);
    registerAbility('cowboys_high_noon', 'onPlay', cowboysHighNoonOnPlay);
    registerAbility('cowboys_run_em_off', 'onPlay', cowboysRunEmOffOnPlay);
    registerAbility('cowboys_gold_in_them_thar_hills', 'onPlay', cowboysGoldInThemTharHillsOnPlay);
    registerAbility('cowboys_stagecoach', 'onPlay', cowboysStagecoachOnPlay);
    registerAbility('cowboys_form_a_posse', 'onPlay', cowboysFormAPosseOnPlay);
    registerAbility('cowboys_dynamite_surprise', 'special', cowboysDynamiteSurpriseSpecial);

    registerTrigger('cowboys_sheriff', 'beforeScoring', cowboysSheriffBeforeScoring, {
        optional: true,
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('cowboys_gold_strike', 'onMinionPlayed', cowboysGoldStrikeOnMinionPlayed, {
        perInstance: true,
        sourceScope: 'triggerBase',
    });
    registerTrigger('cowboys_dynamite_surprise', 'onDeckInspected', cowboysDynamiteSurpriseSeenTrigger, {
        global: true,
        globalZones: ['hand', 'deck'],
    });

    registerBaseAbility('base_so_so_corral', 'onMinionPlayed', cowboysBaseSoSoCorralOnMinionPlayed, { mandatory: false });
    registerExtended('base_saloon', 'onMinionDestroyed', cowboysBaseSaloonOnMinionDestroyed, { mandatory: true });
}

export function registerCowboysInteractionHandlers(): void {
    registerInteractionHandler('cowboys_gunfighter', handleGunfighterTarget);
    registerInteractionHandler('cowboys_quick_draw', handleQuickDraw);
    registerInteractionHandler('cowboys_high_noon_friendly', handleHighNoonFriendly);
    registerInteractionHandler('cowboys_high_noon_enemy', handleHighNoonEnemy);
    registerInteractionHandler('cowboys_run_em_off_friendly', handleRunEmOffFriendly);
    registerInteractionHandler('cowboys_run_em_off_enemy', handleRunEmOffEnemy);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills', handleGoldInThemTharHills);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills_order', handleGoldInThemTharHillsOrder);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills_mode', handleGoldInThemTharHillsMode);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills_minion_base', handleGoldInThemTharHillsMinionBase);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills_action_base', handleGoldInThemTharHillsActionBase);
    registerInteractionHandler('cowboys_gold_in_them_thar_hills_action_minion', handleGoldInThemTharHillsActionMinion);
    registerInteractionHandler('cowboys_stagecoach_source', handleStagecoachSource);
    registerInteractionHandler('cowboys_stagecoach_cards', handleStagecoachCards);
    registerInteractionHandler('cowboys_stagecoach_destination', handleStagecoachDestination);
    registerInteractionHandler('cowboys_dynamite_surprise', handleDynamiteSurprise);
    registerInteractionHandler('cowboys_dynamite_surprise_seen', handleDynamiteSurpriseSeen);
    registerInteractionHandler('cowboys_sheriff_before_scoring', handleSheriffBeforeScoring);
    registerInteractionHandler('base_so_so_corral', handleBaseSoSoCorral);
}

function cowboysGunfighterOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    return queueEnemyDuelPrompt(
        ctx.matchState,
        ctx.state,
        ctx.playerId,
        ctx.cardUid,
        ctx.now,
        'cowboys_gunfighter',
        '枪手：你可以令此随从与这里另一位玩家的一个随从决斗',
    );
}

function cowboysQuickDrawOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `cowboys_quick_draw_${ctx.now}`,
        ctx.playerId,
        '拔枪术：选择你的一个随从获得力量加成',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId }) as any[],
        { sourceId: 'cowboys_quick_draw', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysHighNoonOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const options = collectFriendlyDuelStarters(ctx.state, ctx.playerId, { respectActionProtection: true });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `cowboys_high_noon_friendly_${ctx.now}`,
        ctx.playerId,
        '正午决斗：选择你的一个随从开始决斗',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId }) as any[],
        { sourceId: 'cowboys_high_noon_friendly', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysRunEmOffOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const options = collectFriendlyDuelStarters(ctx.state, ctx.playerId, { respectActionProtection: true });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `cowboys_run_em_off_friendly_${ctx.now}`,
        ctx.playerId,
        '赶走他们：选择你的一个随从开始决斗',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId }) as any[],
        { sourceId: 'cowboys_run_em_off_friendly', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysGoldInThemTharHillsOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return { events: [] };
    const topCards = player.deck.slice(0, 3);
    const options = topCards.map((card, index) => ({
        id: `top-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId },
        _source: 'deck' as const,
        displayMode: 'card' as const,
    }));
    const interaction = createSimpleChoice(
        `cowboys_gold_in_them_thar_hills_${ctx.now}`,
        ctx.playerId,
        '那山里有金子：从牌库顶三张牌中选择一张抓到手里',
        options,
        { sourceId: 'cowboys_gold_in_them_thar_hills', targetType: 'generic', responseValidationMode: 'live' },
    );
    (interaction.data as any).continuationContext = {
        topCards,
    };
    (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>, data: any) => {
        const topSnapshot = (data?.continuationContext as { topCards?: CardInstance[] } | undefined)?.topCards ?? [];
        return buildGoldTopCardOptions(nextState.core, ctx.playerId, topSnapshot);
    };
    return {
        events: [inspectDeck(ctx.playerId, ctx.playerId, topCards.length, 'cowboys_gold_in_them_thar_hills', ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function cowboysStagecoachOnPlay(ctx: AbilityContext): AbilityResult {
    const sourceBases = collectStagecoachSourceBases(ctx.state, ctx.playerId);
    if (sourceBases.length === 0 || ctx.state.bases.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `cowboys_stagecoach_source_${ctx.now}`,
        ctx.playerId,
        '驿站马车：选择要搬运卡牌的来源基地',
        buildBaseTargetOptions(sourceBases, ctx.state),
        { sourceId: 'cowboys_stagecoach_source', targetType: 'base' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysFormAPosseOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) return { events: [] };
    const currentTurn = ctx.state.turnNumber ?? 0;
    const events: SmashUpEvent[] = [];
    for (const target of ownMinions) {
        events.push(addTempPower(target.uid, target.baseIndex, 1, 'cowboys_form_a_posse', ctx.now));
        events.push({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: {
                minionUid: target.uid,
                baseIndex: target.baseIndex,
                metadataUpdate: {
                    tempProtectDestroyUntilTurnNumber: currentTurn,
                    tempProtectMoveUntilTurnNumber: currentTurn,
                    tempProtectAffectUntilTurnNumber: currentTurn,
                },
                reason: 'cowboys_form_a_posse',
            },
            timestamp: ctx.now,
        } as MinionMetadataUpdatedEvent);
    }
    return { events };
}

function cowboysDynamiteSurpriseSpecial(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const hasOwnMinion = base.minions.some(minion => minion.controller === ctx.playerId);
    if (!hasOwnMinion || isWinningOnBase(ctx.state, ctx.baseIndex, ctx.playerId)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const targets = base.minions
        .filter(minion => getMinionPower(ctx.state, minion, ctx.baseIndex) <= 4)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
        }));
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const targetOptions = buildActionMinionTargetOptions(targets, {
        state: ctx.state,
        sourcePlayerId: ctx.playerId, sourceDefId: ctx.defId,
        effectType: 'destroy',
    });
    if (targetOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const interaction = createSimpleChoice(
        `cowboys_dynamite_surprise_${ctx.now}`,
        ctx.playerId,
        '炸药惊喜：选择一个力量4或以下的随从消灭',
        targetOptions as any[],
        { sourceId: 'cowboys_dynamite_surprise', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysDynamiteSurpriseSeenTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.inspectionCards?.length || !ctx.inspectionZone || !ctx.inspectionCausePlayerId) {
        return { events: [] };
    }

    const ownerPlayerId = (ctx.inspectionTargetPlayerIds ?? []).find((candidate) => {
        const player = ctx.state.players[candidate];
        if (!player) return false;
        const zoneCards = ctx.inspectionZone === 'hand' ? player.hand : player.deck;
        return ctx.inspectionCards!.some(card => (
            isDynamiteSurpriseDefId(card.defId) && zoneCards.some(entry => entry.uid === card.uid)
        ));
    });
    if (!ownerPlayerId || ownerPlayerId === ctx.inspectionCausePlayerId) return { events: [] };

    const exposedCard = ctx.inspectionCards.find((card) => {
        if (!isDynamiteSurpriseDefId(card.defId)) return false;
        const player = ctx.state.players[ownerPlayerId];
        const zoneCards = ctx.inspectionZone === 'hand' ? player.hand : player.deck;
        return zoneCards.some(entry => entry.uid === card.uid);
    });
    if (!exposedCard) return { events: [] };

    const targets = collectDynamiteSeenTargets(ctx.state, ctx.inspectionCausePlayerId);
    if (targets.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `cowboys_dynamite_surprise_seen_${ctx.now}_${exposedCard.uid}`,
        ownerPlayerId,
        '炸药惊喜：你可以打出这张牌，消灭其中一个力量 4 或以下的随从',
        [createSkipOption('跳过（不打出）'), ...buildActionMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ownerPlayerId,
            effectType: 'destroy',
        })] as any[],
        { sourceId: 'cowboys_dynamite_surprise_seen', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        cardUid: exposedCard.uid,
        ownerPlayerId,
        sourceZone: ctx.inspectionZone,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysSheriffBeforeScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return { events: [] };
    }
    if (!canStartDuel(ctx.state)) return { events: [] };
    const interaction = createSimpleChoice(
        `cowboys_sheriff_before_scoring_${ctx.now}_${ctx.sourceCardUid}`,
        ctx.sourceControllerId,
        '警长：你可以令此随从与这里另一位玩家的一个随从决斗',
        [createSkipOption('跳过（不决斗）'), ...buildEnemyMinionOptions(ctx.state, ctx.baseIndex, ctx.sourceControllerId)] as any[],
        { sourceId: 'cowboys_sheriff_before_scoring', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: 'cowboys_sheriff_before_scoring',
        friendlyMinionUid: ctx.sourceCardUid,
        casterPlayerId: ctx.sourceControllerId,
    } satisfies DuelContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysGoldStrikeOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceControllerId || ctx.playerId !== ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function cowboysBaseSoSoCorralOnMinionPlayed(ctx: any): AbilityResult {
    if (!ctx.matchState || !ctx.minionUid || ctx.baseIndex === undefined) return { events: [] };
    if (!canStartDuel(ctx.state)) return { events: [] };
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find((entry: MinionOnBase) => entry.uid === ctx.minionUid);
    if (!minion) return { events: [] };
    const enemyOptions = buildEnemyMinionOptions(ctx.state, ctx.baseIndex, minion.controller);
    if (enemyOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `base_so_so_corral_${ctx.now}_${ctx.minionUid}`,
        minion.controller,
        '小镇：你可以令刚打出的随从与这里另一位玩家的一个随从决斗',
        [createSkipOption('跳过（不决斗）'), ...enemyOptions] as any[],
        { sourceId: 'base_so_so_corral', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: 'base_so_so_corral',
        friendlyMinionUid: ctx.minionUid,
        casterPlayerId: minion.controller,
    } satisfies DuelContinuation;
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function cowboysBaseSaloonOnMinionDestroyed(ctx: any): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const playerIds = Array.from(new Set(base.minions.map((minion: MinionOnBase) => minion.controller)));
    return {
        events: playerIds.flatMap((playerId) => buildStandardDrawEvents(ctx.state, playerId, 1, dummyRandom, ctx.now)),
    };
}

function queueEnemyDuelPrompt(
    matchState: MatchState<SmashUpCore>,
    state: SmashUpCore,
    playerId: PlayerId,
    friendlyMinionUid: string,
    now: number,
    sourceId: string,
    title: string,
): AbilityResult {
    const found = state.bases.findIndex(base => base.minions.some(minion => minion.uid === friendlyMinionUid));
    if (found < 0) return { events: [] };
    const enemyOptions = buildEnemyMinionOptions(state, found, playerId);
    if (enemyOptions.length === 0) {
        return { events: [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)] };
    }
    const interaction = createSimpleChoice(
        `${sourceId}_${now}_${friendlyMinionUid}`,
        playerId,
        title,
        [createSkipOption('跳过（不决斗）'), ...enemyOptions] as any[],
        { sourceId, targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId,
        friendlyMinionUid,
        casterPlayerId: playerId,
    } satisfies DuelContinuation;
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

const handleGunfighterTarget = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { skip?: boolean; minionUid?: string };
    if (selected?.skip || !selected?.minionUid) return { state, events: [] };
    const ctx = data?.continuationContext as DuelContinuation | undefined;
    if (!ctx) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: ctx.sourceId,
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'destroy_loser',
            destroyReason: ctx.sourceId,
        }, now),
        events: [],
    };
};

const handleQuickDraw = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, _data: any, _random: RandomFn, now: number) => {
    const selected = value as FriendlyChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    const inDuel = isMinionInActiveDuel(state.core, selected.minionUid);
    return {
        state,
        events: [addTempPower(selected.minionUid, selected.baseIndex, inDuel ? 4 : 2, 'cowboys_quick_draw', now)],
    };
};

const handleHighNoonFriendly = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, _data: any, _random: RandomFn, now: number) => {
    const selected = value as FriendlyChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    const options = buildEnemyMinionOptions(state.core, selected.baseIndex, playerId, { respectActionProtection: true });
    if (options.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `cowboys_high_noon_enemy_${now}`,
        playerId,
        '正午决斗：选择要决斗的对手随从',
        options,
        { sourceId: 'cowboys_high_noon_enemy', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: 'cowboys_high_noon_enemy',
        friendlyMinionUid: selected.minionUid,
        casterPlayerId: playerId,
    } satisfies DuelContinuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleHighNoonEnemy = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as DuelContinuation | undefined;
    if (!ctx || !selected?.minionUid) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'cowboys_high_noon',
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'high_noon',
            destroyReason: 'cowboys_high_noon',
        }, now),
        events: [],
    };
};

const handleRunEmOffFriendly = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, _data: any, _random: RandomFn, now: number) => {
    const selected = value as FriendlyChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
    const options = buildEnemyMinionOptions(state.core, selected.baseIndex, playerId, { respectActionProtection: true });
    if (options.length === 0) return { state, events: [] };
    const interaction = createSimpleChoice(
        `cowboys_run_em_off_enemy_${now}`,
        playerId,
        '赶走他们：选择要决斗的对手随从',
        options,
        { sourceId: 'cowboys_run_em_off_enemy', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = {
        sourceId: 'cowboys_run_em_off_enemy',
        friendlyMinionUid: selected.minionUid,
        casterPlayerId: playerId,
    } satisfies DuelContinuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleRunEmOffEnemy = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as MinionChoice | undefined;
    const ctx = data?.continuationContext as DuelContinuation | undefined;
    if (!ctx || !selected?.minionUid) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'cowboys_run_em_off',
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'run_em_off',
        }, now),
        events: [],
    };
};

const handleGoldInThemTharHills = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { cardUid?: string; defId?: string } | undefined;
    const topCards = ((data?.continuationContext as any)?.topCards ?? []) as CardInstance[];
    if (!selected?.cardUid || topCards.length === 0) return { state, events: [] };
    const currentTopCards = getCurrentDeckTopSnapshotCards(state.core, playerId as PlayerId, topCards);
    const chosen = topCards.find(card => card.uid === selected.cardUid);
    const currentChosen = currentTopCards.find(card => card.uid === selected.cardUid);
    if (!chosen || !currentChosen) return { state, events: [] };
    const remaining = currentTopCards.filter(card => card.uid !== currentChosen.uid);
    if (remaining.length > 1) {
        const interaction = createSimpleChoice(
            `cowboys_gold_in_them_thar_hills_order_${now}`,
            playerId,
            '那山里有金子：选择其余牌放回牌库顶的顺序',
            buildGoldOrderOptions(state.core, playerId as PlayerId, { chosenCard: currentChosen, remainingCards: remaining }),
            { sourceId: 'cowboys_gold_in_them_thar_hills_order', targetType: 'generic', responseValidationMode: 'live' },
        );
        (interaction.data as any).continuationContext = { chosenCard: currentChosen, remainingCards: remaining } satisfies GoldPromptContext;
        (interaction.data as any).optionsGenerator = (nextState: MatchState<SmashUpCore>, interactionData: any) => {
            const ctx = (interactionData?.continuationContext ?? {}) as GoldPromptContext;
            return buildGoldOrderOptions(nextState.core, playerId as PlayerId, ctx);
        };
        return { state: queueInteraction(state, interaction), events: [] };
    }
    return queueGoldModePrompt(state, playerId as PlayerId, currentChosen, remaining, now);
};

const handleGoldInThemTharHillsOrder = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as GoldOrderChoice | undefined;
    const ctx = data?.continuationContext as GoldPromptContext | undefined;
    if (!selected?.topCardUid || !ctx) return { state, events: [] };
    const snapshot = getCurrentDeckTopSnapshotCards(state.core, playerId as PlayerId, [ctx.chosenCard, ...ctx.remainingCards]);
    const currentChosen = snapshot.find(card => card.uid === ctx.chosenCard.uid);
    if (!currentChosen) return { state, events: [] };
    const currentRemaining = snapshot.filter(card => card.uid !== ctx.chosenCard.uid);
    const topCard = currentRemaining.find(card => card.uid === selected.topCardUid);
    if (!topCard) return { state, events: [] };
    const orderedRemaining = [topCard, ...currentRemaining.filter(card => card.uid !== selected.topCardUid)];
    return queueGoldModePrompt(state, playerId as PlayerId, currentChosen, orderedRemaining, now);
};

const handleGoldInThemTharHillsMode = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, random: RandomFn, now: number) => {
    const selected = value as GoldModeChoice | undefined;
    const ctx = data?.continuationContext as GoldPromptContext | undefined;
    if (!selected?.mode || !ctx) return { state, events: [] };
    if (selected.mode === 'hand') {
        return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, ctx.chosenCard, ctx.remainingCards, now) };
    }
    return queueGoldPlayTargetPrompt(state, playerId, ctx.chosenCard, ctx.remainingCards, random, now);
};

const handleGoldInThemTharHillsMinionBase = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, random: RandomFn, now: number) => {
    const selected = value as { baseIndex?: number } | undefined;
    const ctx = data?.continuationContext as GoldPromptContext | undefined;
    if (selected?.baseIndex === undefined || !ctx) return { state, events: [] };
    return playGoldCard(state, playerId, ctx.chosenCard, ctx.remainingCards, { baseIndex: selected.baseIndex }, random, now);
};

const handleGoldInThemTharHillsActionBase = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, random: RandomFn, now: number) => {
    const selected = value as { baseIndex?: number } | undefined;
    const ctx = data?.continuationContext as GoldPromptContext | undefined;
    if (selected?.baseIndex === undefined || !ctx) return { state, events: [] };
    return playGoldCard(state, playerId, ctx.chosenCard, ctx.remainingCards, { targetBaseIndex: selected.baseIndex }, random, now);
};

const handleGoldInThemTharHillsActionMinion = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, random: RandomFn, now: number) => {
    const selected = value as { minionUid?: string } | undefined;
    const ctx = data?.continuationContext as GoldPromptContext | undefined;
    if (!selected?.minionUid || !ctx) return { state, events: [] };
    return playGoldCard(state, playerId, ctx.chosenCard, ctx.remainingCards, { targetMinionUid: selected.minionUid }, random, now);
};

const handleStagecoachSource = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, _data: any, _random: RandomFn, now: number) => {
    const selected = value as { baseIndex?: number } | undefined;
    if (selected?.baseIndex === undefined) return { state, events: [] };
    const sourceBase = state.core.bases[selected.baseIndex];
    if (!sourceBase) return { state, events: [] };

    const movableCards = collectStagecoachCardsOnBase(state.core, playerId as PlayerId, selected.baseIndex);
    if (movableCards.length === 0) {
        return { state, events: [] };
    }

    const interaction = createSimpleChoice(
        `cowboys_stagecoach_cards_${now}`,
        playerId,
        '驿站马车：选择 1-2 张要搬运到另一个基地的牌',
        movableCards.map((card, index) => ({
            id: `stagecoach-card-${index}`,
            label: card.label,
            value: {
                kind: card.kind,
                uid: card.uid,
                defId: card.defId,
                baseIndex: card.baseIndex,
                ownerId: card.ownerId,
                trueOwnerId: card.trueOwnerId,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'cowboys_stagecoach_cards',
            targetType: 'generic',
            multi: { min: 1, max: Math.min(2, movableCards.length) },
        },
    );
    (interaction.data as any).continuationContext = {
        sourceBaseIndex: selected.baseIndex,
    } satisfies StagecoachSourceContinuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleStagecoachCards = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const ctx = (data?.continuationContext ?? {}) as StagecoachSourceContinuation;
    const selected = (Array.isArray(value) ? value : []) as StagecoachCardChoice[];
    if (ctx.sourceBaseIndex === undefined || selected.length === 0) return { state, events: [] };

    const destinationBases = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? base.defId }))
        .filter(base => base.baseIndex !== ctx.sourceBaseIndex);
    if (destinationBases.length === 0) return { state, events: [] };

    const interaction = createSimpleChoice(
        `cowboys_stagecoach_destination_${now}`,
        playerId,
        '驿站马车：选择目标基地',
        buildBaseTargetOptions(destinationBases, state.core),
        { sourceId: 'cowboys_stagecoach_destination', targetType: 'base' },
    );
    (interaction.data as any).continuationContext = {
        sourceBaseIndex: ctx.sourceBaseIndex,
        selectedCards: selected
            .filter(choice => choice.uid && choice.defId)
            .map(choice => ({
                kind: choice.kind,
                uid: choice.uid,
                defId: choice.defId,
                baseIndex: choice.baseIndex,
                ownerId: choice.ownerId,
                trueOwnerId: choice.trueOwnerId,
            })),
    } satisfies StagecoachDestinationContinuation;
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleStagecoachDestination = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
    const ctx = (data?.continuationContext ?? {}) as StagecoachDestinationContinuation;
    if (selected?.baseIndex === undefined || ctx.sourceBaseIndex === undefined || !ctx.selectedCards?.length) {
        return { state, events: [] };
    }

    const nextCore = relocateStagecoachStaticCards(state.core, ctx.sourceBaseIndex, selected.baseIndex, ctx.selectedCards);
    return {
        state: nextCore === state.core ? state : { ...state, core: nextCore },
        events: ctx.selectedCards.flatMap((card) => {
            if (card.kind === 'minion') {
                return buildValidatedMoveEvents(state, {
                    minionUid: card.uid,
                    minionDefId: card.defId,
                    fromBaseIndex: ctx.sourceBaseIndex,
                    toBaseIndex: selected.baseIndex!,
                    toBaseDefId: selected.baseDefId,
                    reason: 'cowboys_stagecoach',
                    now,
                });
            }
            if (card.kind === 'titan') {
                return [moveTitan(
                    card.uid,
                    card.defId,
                    ctx.sourceBaseIndex,
                    selected.baseIndex!,
                    'cowboys_stagecoach',
                    now,
                    selected.baseDefId,
                )];
            }
            return [];
        }),
    };
};

const handleDynamiteSurprise = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, _data: any, _random: RandomFn, now: number) => {
    const selected = value as MinionChoice | undefined;
    if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
    return {
        state,
        events: buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'cowboys_dynamite_surprise',
            now,
        }),
    };
};

const handleDynamiteSurpriseSeen = (state: MatchState<SmashUpCore>, playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; defId?: string } | undefined;
    if (selected?.skip) return { state, events: [] };
    if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };

    const ctx = (data?.continuationContext ?? {}) as {
        cardUid?: string;
        ownerPlayerId?: PlayerId;
        sourceZone?: 'hand' | 'deck';
    };
    if (!ctx.cardUid || !ctx.ownerPlayerId || !ctx.sourceZone) return { state, events: [] };

    const owner = state.core.players[ctx.ownerPlayerId];
    if (!owner) return { state, events: [] };
    const sourceCards = ctx.sourceZone === 'hand' ? owner.hand : owner.deck;
    const playedCard = sourceCards.find(card => card.uid === ctx.cardUid && isDynamiteSurpriseDefId(card.defId));
    if (!playedCard) return { state, events: [] };

    const remainingSourceCards = sourceCards.filter(card => card.uid !== ctx.cardUid);
    const nextCore: SmashUpCore = {
        ...state.core,
        players: {
            ...state.core.players,
            [ctx.ownerPlayerId]: {
                ...owner,
                ...(ctx.sourceZone === 'hand' ? { hand: remainingSourceCards } : { deck: remainingSourceCards }),
                discard: [...owner.discard, playedCard],
            },
        },
    };

    return {
        state: { ...state, core: nextCore },
        events: buildValidatedDestroyEvents(nextCore, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId as PlayerId,
            reason: 'cowboys_dynamite_surprise_seen',
            now,
        }),
    };
};

const handleSheriffBeforeScoring = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { skip?: boolean; minionUid?: string } | undefined;
    if (selected?.skip || !selected?.minionUid) return { state, events: [] };
    const ctx = data?.continuationContext as DuelContinuation | undefined;
    if (!ctx) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'cowboys_sheriff_before_scoring',
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'destroy_loser',
            destroyReason: 'cowboys_sheriff_before_scoring',
        }, now),
        events: [],
    };
};

const handleBaseSoSoCorral = (state: MatchState<SmashUpCore>, _playerId: string, value: unknown, data: any, _random: RandomFn, now: number) => {
    const selected = value as { skip?: boolean; minionUid?: string } | undefined;
    if (selected?.skip || !selected?.minionUid) return { state, events: [] };
    const ctx = data?.continuationContext as DuelContinuation | undefined;
    if (!ctx) return { state, events: [] };
    return {
        state: startDuel(state, {
            sourceId: 'base_so_so_corral',
            sourcePlayerId: ctx.casterPlayerId,
            challengerMinionUid: ctx.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: 'destroy_loser',
            destroyReason: 'base_so_so_corral',
        }, now),
        events: [],
    };
};

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const results: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            results.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            });
        });
    });
    return results;
}

function collectFriendlyDuelStarters(
    state: SmashUpCore,
    playerId: PlayerId,
    options?: { respectActionProtection?: boolean },
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    return collectOwnMinions(state, playerId).filter(({ baseIndex }) => (
        buildEnemyMinionOptions(state, baseIndex, playerId, options).length > 0
    ));
}

function collectStagecoachSourceBases(state: SmashUpCore, playerId: PlayerId): Array<{ baseIndex: number; label: string }> {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? base.defId,
            movableCount: collectStagecoachCardsOnBase(state, playerId, baseIndex).length,
        }))
        .filter(base => base.movableCount > 0)
        .map(({ baseIndex, label }) => ({ baseIndex, label }));
}

function collectStagecoachCardsOnBase(
    state: SmashUpCore,
    playerId: PlayerId,
    baseIndex: number,
): Array<StagecoachCardChoice & { label: string }> {
    const base = state.bases[baseIndex];
    if (!base) return [];

    const minions = base.minions
        .filter(minion => minion.controller === playerId)
        .map((minion) => ({
            kind: 'minion' as const,
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));

    const titans = (state.titans ?? [])
        .filter(titan => titan.controllerId === playerId && titan.location.zone === 'base' && titan.location.baseIndex === baseIndex)
        .map((titan) => ({
            kind: 'titan' as const,
            uid: titan.uid,
            defId: titan.defId,
            baseIndex,
            label: getCardDef(titan.defId)?.name ?? titan.defId,
        }));

    const ongoingActions = base.ongoingActions
        .filter(action => action.ownerId === playerId)
        .map((action) => ({
            kind: 'ongoing_base' as const,
            uid: action.uid,
            defId: action.defId,
            baseIndex,
            ownerId: action.ownerId,
            label: `${getCardDef(action.defId)?.name ?? action.defId}（持续行动）`,
        }));

    const buriedCards = (base.buriedCards ?? [])
        .filter(card => card.controllerId === playerId)
        .map((card) => ({
            kind: 'buried' as const,
            uid: card.uid,
            defId: card.defId,
            baseIndex,
            trueOwnerId: card.trueOwnerId,
            label: `${getCardDef(card.defId)?.name ?? card.defId}（埋葬）`,
        }));

    return [...minions, ...titans, ...ongoingActions, ...buriedCards];
}

function relocateStagecoachStaticCards(
    state: SmashUpCore,
    sourceBaseIndex: number,
    targetBaseIndex: number,
    selectedCards: StagecoachCardChoice[],
): SmashUpCore {
    const ongoingUids = new Set(selectedCards.filter(card => card.kind === 'ongoing_base').map(card => card.uid));
    const buriedUids = new Set(selectedCards.filter(card => card.kind === 'buried').map(card => card.uid));
    if (ongoingUids.size === 0 && buriedUids.size === 0) return state;

    const sourceBase = state.bases[sourceBaseIndex];
    const targetBase = state.bases[targetBaseIndex];
    if (!sourceBase || !targetBase) return state;

    const movedOngoing = sourceBase.ongoingActions.filter(action => ongoingUids.has(action.uid));
    const movedBuried = (sourceBase.buriedCards ?? []).filter(card => buriedUids.has(card.uid));
    if (movedOngoing.length === 0 && movedBuried.length === 0) return state;

    const nextBases = state.bases.map((base, index) => {
        if (index === sourceBaseIndex) {
            return {
                ...base,
                ongoingActions: base.ongoingActions.filter(action => !ongoingUids.has(action.uid)),
                buriedCards: (base.buriedCards ?? []).filter(card => !buriedUids.has(card.uid)),
            };
        }
        if (index === targetBaseIndex) {
            return {
                ...base,
                ongoingActions: [...base.ongoingActions, ...movedOngoing],
                buriedCards: [...(base.buriedCards ?? []), ...movedBuried],
            };
        }
        return base;
    });

    return { ...state, bases: nextBases };
}

function collectDynamiteSeenTargets(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const results: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions.forEach((minion) => {
            if (minion.controller !== targetPlayerId) return;
            if (getMinionPower(state, minion, baseIndex) > 4) return;
            results.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            });
        });
    });
    return results;
}

function buildEnemyMinionOptions(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    options?: { respectActionProtection?: boolean },
): any[] {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const respectActionProtection = options?.respectActionProtection ?? false;
    return buildMinionTargetOptions(
        base.minions
            .filter(minion => minion.controller !== sourcePlayerId)
            .filter(minion => !respectActionProtection || !isMinionProtected(state, minion, baseIndex, sourcePlayerId, 'action'))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            })),
        { state, sourcePlayerId, effectType: 'destroy' },
    );
}

function queueGoldModePrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const options = [{
        id: 'gold-keep',
        label: '抓到手里',
        value: { mode: 'hand' as const },
        displayMode: 'button' as const,
    }];
    if (canOfferGoldExtraPlay(state.core, playerId, chosenCard)) {
        options.push({
            id: 'gold-play',
            label: '作为额外牌打出',
            value: { mode: 'play' as const },
            displayMode: 'button' as const,
        });
    }
    if (options.length === 1) {
        return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
    }
    const interaction = createSimpleChoice(
        `cowboys_gold_in_them_thar_hills_mode_${now}`,
        playerId,
        '那山里有金子：选择把这张牌抓到手里，或立刻作为额外牌打出',
        options,
        { sourceId: 'cowboys_gold_in_them_thar_hills_mode', targetType: 'button' },
    );
    (interaction.data as any).continuationContext = { chosenCard, remainingCards } satisfies GoldPromptContext;
    return { state: queueInteraction(state, interaction), events: [] };
}

function queueGoldPlayTargetPrompt(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    if (chosenCard.type === 'minion') {
        const options = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateDeckTopRegularMinionPlaySemantics(state.core, playerId, {
                baseIndex: base.baseIndex,
                cardUid: chosenCard.uid,
                defId: chosenCard.defId,
            }).valid);
        if (options.length === 0) {
            return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
        }
        const interaction = createSimpleChoice(
            `cowboys_gold_in_them_thar_hills_minion_base_${now}`,
            playerId,
            '那山里有金子：选择这张额外随从要打到哪个基地',
            buildBaseTargetOptions(options, state.core),
            { sourceId: 'cowboys_gold_in_them_thar_hills_minion_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = { chosenCard, remainingCards } satisfies GoldPromptContext;
        return { state: queueInteraction(state, interaction), events: [] };
    }

    if (chosenCard.type !== 'action') {
        return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
    }

    const actionDef = getCardDef(chosenCard.defId) as any;
    if (!actionDef || actionDef.subtype === 'special') {
        return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
    }

    if (actionLikeNeedsPlayMinion(actionDef)) {
        const minionOptions = state.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => !isMinionProtected(state.core, minion, baseIndex, playerId, 'action'))
                .filter(minion => validateActionPlaySemantics(state.core, playerId, {
                    defId: chosenCard.defId,
                    targetBaseIndex: baseIndex,
                    targetMinionUid: minion.uid,
                }).valid)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                }))
        ));
        if (minionOptions.length === 0) {
            return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
        }
        const interaction = createSimpleChoice(
            `cowboys_gold_in_them_thar_hills_action_minion_${now}`,
            playerId,
            '那山里有金子：选择这张额外行动的目标随从',
            buildMinionTargetOptions(minionOptions, { state: state.core, sourcePlayerId: playerId, sourceDefId: chosenCard.defId }) as any[],
            { sourceId: 'cowboys_gold_in_them_thar_hills_action_minion', targetType: 'minion' },
        );
        (interaction.data as any).continuationContext = { chosenCard, remainingCards } satisfies GoldPromptContext;
        return { state: queueInteraction(state, interaction), events: [] };
    }

    if (actionLikeNeedsPlayBase(actionDef) || actionDef.subtype === 'ongoing') {
        const baseOptions = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateActionPlaySemantics(state.core, playerId, {
                defId: chosenCard.defId,
                targetBaseIndex: base.baseIndex,
            }).valid);
        if (baseOptions.length === 0) {
            return { state, events: buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now) };
        }
        const interaction = createSimpleChoice(
            `cowboys_gold_in_them_thar_hills_action_base_${now}`,
            playerId,
            '那山里有金子：选择这张额外行动的目标基地',
            buildBaseTargetOptions(baseOptions, state.core),
            { sourceId: 'cowboys_gold_in_them_thar_hills_action_base', targetType: 'base' },
        );
        (interaction.data as any).continuationContext = { chosenCard, remainingCards } satisfies GoldPromptContext;
        return { state: queueInteraction(state, interaction), events: [] };
    }

    return playGoldCard(state, playerId, chosenCard, remainingCards, {}, random, now);
}

function buildGoldDrawAndDeckEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    now: number,
): SmashUpEvent[] {
    const restOfDeck = core.players[playerId]?.deck.filter(card => card.uid !== chosenCard.uid && !remainingCards.some(entry => entry.uid === card.uid)) ?? [];
    return [
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [chosenCard.uid] },
            timestamp: now,
        } as CardsDrawnEvent,
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: [...remainingCards.map(card => card.uid), ...restOfDeck.map(card => card.uid)] },
            timestamp: now,
        } as DeckReorderedEvent,
    ];
}

function canOfferGoldExtraPlay(core: SmashUpCore, playerId: PlayerId, chosenCard: CardInstance): boolean {
    if (chosenCard.type === 'minion') {
        return core.bases.some((_, baseIndex) => validateDeckTopRegularMinionPlaySemantics(core, playerId, {
            baseIndex,
            cardUid: chosenCard.uid,
            defId: chosenCard.defId,
        }).valid);
    }
    if (chosenCard.type !== 'action') return false;
    const actionDef = getCardDef(chosenCard.defId) as any;
    if (!actionDef || actionDef.subtype === 'special') return false;
    if (actionLikeNeedsPlayMinion(actionDef)) {
        return core.bases.some((base, baseIndex) => base.minions.some(minion => validateActionPlaySemantics(core, playerId, {
            defId: chosenCard.defId,
            targetBaseIndex: baseIndex,
            targetMinionUid: minion.uid,
        }).valid));
    }
    if (actionLikeNeedsPlayBase(actionDef) || actionDef.subtype === 'ongoing') {
        return core.bases.some((_, baseIndex) => validateActionPlaySemantics(core, playerId, {
            defId: chosenCard.defId,
            targetBaseIndex: baseIndex,
        }).valid);
    }
    return validateActionPlaySemantics(core, playerId, { defId: chosenCard.defId }).valid;
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

function playGoldCard(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    targets: { baseIndex?: number; targetBaseIndex?: number; targetMinionUid?: string },
    random: RandomFn,
    now: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const prefixEvents = buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now);
    let simulatedCore = state.core;
    for (const event of prefixEvents) simulatedCore = reduce(simulatedCore, event);
    const simulatedState: MatchState<SmashUpCore> = {
        ...state,
        core: simulatedCore,
        sys: cloneSysForSimulatedExecute(state),
    };

    const command = chosenCard.type === 'minion'
        ? {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid: chosenCard.uid, baseIndex: targets.baseIndex ?? 0 },
        }
        : {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: {
                cardUid: chosenCard.uid,
                ...(targets.targetBaseIndex !== undefined ? { targetBaseIndex: targets.targetBaseIndex } : {}),
                ...(targets.targetMinionUid ? { targetMinionUid: targets.targetMinionUid } : {}),
            },
        };

    const playEvents = execute(simulatedState, command as any, random).map((event) => {
        if (event.type === SU_EVENTS.MINION_PLAYED && chosenCard.type === 'minion' && (event as any).payload.cardUid === chosenCard.uid) {
            return {
                ...event,
                payload: { ...(event as any).payload, consumesNormalLimit: false },
            } as SmashUpEvent;
        }
        if (event.type === SU_EVENTS.ACTION_PLAYED && chosenCard.type === 'action' && (event as any).payload.cardUid === chosenCard.uid) {
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
        events: [...prefixEvents, ...playEvents],
    };
}

function isWinningOnBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    const totals = new Map<PlayerId, number>();
    for (const minion of base.minions) {
        totals.set(minion.controller, (totals.get(minion.controller) ?? 0) + getMinionPower(state, minion, baseIndex));
    }
    const ownPower = totals.get(playerId) ?? 0;
    for (const [pid, power] of totals) {
        if (pid === playerId) continue;
        if (power >= ownPower) return false;
    }
    return ownPower > 0;
}

const dummyRandom: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};
