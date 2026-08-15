import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { getCurrentTrackedCardTopSnapshot } from '../../../engine/systems/InteractionSystem';
import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildActionMinionTargetOptions,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildSemanticOngoingAttachEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
    inspectDeck,
    moveTitan,
} from '../domain/abilityHelpers';
import { registerBaseAbility, registerExtended, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { canStartDuel, isMinionInActiveDuel, startDuelWithEvents } from '../domain/duel';
import { validateActionPlaySemantics, validateDeckTopRegularMinionPlaySemantics } from '../domain/playLegality';
import { actionLikeNeedsPlayBase, actionLikeNeedsPlayMinion } from '../domain/utils';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import type {
    CardsDrawnEvent,
    CardInstance,
    DeckReorderedEvent,
    DuelOutcomeKind,
    MinionOnBase,
    MinionMetadataUpdatedEvent,
    MinionPlayedEvent,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type MinionChoice = { minionUid: string; baseIndex: number; defId?: string };
type FriendlyChoice = MinionChoice;
type CowboysPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};
type CowboysDuelPromptContext = CowboysPromptContext & {
    visibleSourceId: string;
    title: string;
    titleKey?: string;
    friendlyMinionUid: string;
    sourceBaseIndex: number;
    casterPlayerId: PlayerId;
    duelSourceId: string;
    outcome: DuelOutcomeKind;
    destroyReason?: string;
    respectActionProtection?: boolean;
};
type CowboysFriendlyDuelPromptContext = CowboysPromptContext & {
    visibleSourceId: string;
    title: string;
    titleKey?: string;
    nextVisibleSourceId: string;
    nextTitle: string;
    nextTitleKey?: string;
    duelSourceId: string;
    outcome: DuelOutcomeKind;
    destroyReason?: string;
    respectActionProtection?: boolean;
};
type CowboysDynamitePromptContext = CowboysPromptContext & {
    baseIndex: number;
    defId: string;
};
type CowboysDynamiteSeenPromptContext = CowboysPromptContext & {
    cardUid: string;
    ownerPlayerId: PlayerId;
    targetPlayerId: PlayerId;
    sourceZone: 'hand' | 'deck';
};
type StagecoachSourceContinuation = {
    sourceBaseIndex: number;
};
type StagecoachCardChoice = {
    kind: 'minion' | 'titan' | 'ongoing_base' | 'buried';
    uid: string;
    defId: string;
    baseIndex: number;
    baseDefId: string;
    ownerId?: PlayerId;
    trueOwnerId?: PlayerId;
};
type StagecoachDestinationContinuation = {
    sourceBaseIndex: number;
    selectedCards: StagecoachCardChoice[];
};
type GoldModeChoice = { mode: 'hand' | 'play' };
type GoldOrderChoice = { topCardUid: string; cardUid?: string; defId?: string };
type GoldPromptContext = {
    chosenCard: CardInstance;
    remainingCards: CardInstance[];
};
type GoldSelectPromptContext = CowboysPromptContext & {
    topCards: CardInstance[];
    random: RandomFn;
};
type GoldRuntimePromptContext = CowboysPromptContext & GoldPromptContext & {
    random: RandomFn;
};
type StagecoachSourcePromptContext = CowboysPromptContext;
type StagecoachCardsPromptContext = CowboysPromptContext & StagecoachSourceContinuation;
type StagecoachDestinationPromptContext = CowboysPromptContext & StagecoachDestinationContinuation;

function createCowboysPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): CowboysPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

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

function canTriggerCowboysDynamiteSurpriseSeen(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.inspectionZone || !ctx.inspectionCausePlayerId) {
        return false;
    }
    if (ctx.sourceControllerId === ctx.inspectionCausePlayerId) {
        return false;
    }
    if (!(ctx.inspectionTargetPlayerIds ?? []).includes(ctx.sourceControllerId)) {
        return false;
    }
    const player = ctx.state.players[ctx.sourceControllerId];
    if (!player) return false;
    const zoneCards = ctx.inspectionZone === 'hand' ? player.hand : player.deck;
    const exposed = ctx.inspectionCards ?? [];
    return exposed.some(card =>
        isDynamiteSurpriseDefId(card.defId) && card.uid === ctx.sourceCardUid,
    ) && zoneCards.some(card =>
        isDynamiteSurpriseDefId(card.defId) && card.uid === ctx.sourceCardUid,
    );
}

export function registerCowboysAbilities(): void {
    registerAbilityProgram('cowboys_gunfighter', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysGunfighterOnPlay),
    });
    registerAbilityProgram('cowboys_quick_draw', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysQuickDrawOnPlay),
    });
    registerAbilityProgram('cowboys_high_noon', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysHighNoonOnPlay),
    });
    registerAbilityProgram('cowboys_run_em_off', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysRunEmOffOnPlay),
    });
    registerAbilityProgram('cowboys_gold_in_them_thar_hills', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysGoldInThemTharHillsOnPlay),
    });
    registerAbilityProgram('cowboys_stagecoach', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysStagecoachOnPlay),
    });
    registerAbility('cowboys_form_a_posse', 'onPlay', cowboysFormAPosseOnPlay);
    registerAbilityProgram('cowboys_dynamite_surprise', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(cowboysDynamiteSurpriseSpecial),
    });

    registerTrigger('cowboys_sheriff', 'beforeScoring', cowboysSheriffBeforeScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('cowboys_gold_strike', 'onMinionPlayed', cowboysGoldStrikeOnMinionPlayed, {
        perInstance: true,
        sourceScope: 'triggerBase',
        canTrigger: ctx => ctx.sourceControllerId === ctx.playerId,
    });
    registerTrigger('cowboys_dynamite_surprise', 'onDeckInspected', cowboysDynamiteSurpriseSeenTrigger, {
        global: true,
        globalZones: ['hand', 'deck'],
        playerContext: 'sourceController',
        canTrigger: canTriggerCowboysDynamiteSurpriseSeen,
    });

    registerBaseAbility('base_so_so_corral', 'onMinionPlayed', cowboysBaseSoSoCorralOnMinionPlayed, {
        mandatory: false,
    });
    registerExtended('base_saloon', 'onMinionDestroyed', cowboysBaseSaloonOnMinionDestroyed, {
        mandatory: true,
    });
}

export function registerCowboysInteractionHandlers(): void {
}

function cowboysGunfighterOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const enemyOptions = buildEnemyMinionOptions(ctx.state, ctx.baseIndex, ctx.playerId);
    if (enemyOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        cowboysOptionalDuelPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            visibleSourceId: 'cowboys_gunfighter',
            title: '枪手：你可以令此随从与这里另一位玩家的一个随从决斗',
            titleKey: 'ui.cowboys_gunfighter_duel_title',
            friendlyMinionUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
            casterPlayerId: ctx.playerId,
            duelSourceId: 'cowboys_gunfighter',
            outcome: 'destroy_loser' as DuelOutcomeKind,
            destroyReason: 'cowboys_gunfighter',
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysQuickDrawOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        cowboysQuickDrawPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysHighNoonOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const options = collectFriendlyDuelStarters(ctx.state, ctx.playerId, { respectActionProtection: true });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        cowboysFriendlyDuelPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            visibleSourceId: 'cowboys_high_noon_friendly',
            title: '正午决斗：选择你的一个随从开始决斗',
            titleKey: 'ui.cowboys_high_noon_friendly_title',
            nextVisibleSourceId: 'cowboys_high_noon_enemy',
            nextTitle: '正午决斗：选择要决斗的对手随从',
            nextTitleKey: 'ui.cowboys_high_noon_enemy_title',
            duelSourceId: 'cowboys_high_noon',
            outcome: 'high_noon' as DuelOutcomeKind,
            destroyReason: 'cowboys_high_noon',
            respectActionProtection: true,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysRunEmOffOnPlay(ctx: AbilityContext): AbilityResult {
    if (!canStartDuel(ctx.state) || ctx.duel) return { events: [] };
    const options = collectFriendlyDuelStarters(ctx.state, ctx.playerId, { respectActionProtection: true });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        cowboysFriendlyDuelPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            visibleSourceId: 'cowboys_run_em_off_friendly',
            title: '赶走他们：选择你的一个随从开始决斗',
            titleKey: 'ui.cowboys_run_em_off_friendly_title',
            nextVisibleSourceId: 'cowboys_run_em_off_enemy',
            nextTitle: '赶走他们：选择要决斗的对手随从',
            nextTitleKey: 'ui.cowboys_run_em_off_enemy_title',
            duelSourceId: 'cowboys_run_em_off',
            outcome: 'run_em_off' as DuelOutcomeKind,
            respectActionProtection: true,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysGoldInThemTharHillsOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.deck.length === 0) return { events: [] };
    const topCards = player.deck.slice(0, 3);
    const result = executeAbilityProgram(
        cowboysGoldSelectPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now, { topCards, random: ctx.random }),
    );
    return {
        events: [inspectDeck(ctx.playerId, ctx.playerId, topCards.length, 'cowboys_gold_in_them_thar_hills', ctx.now)],
        matchState: result.matchState,
    };
}

function cowboysStagecoachOnPlay(ctx: AbilityContext): AbilityResult {
    const sourceBases = collectStagecoachSourceBases(ctx.state, ctx.playerId);
    if (sourceBases.length === 0 || ctx.state.bases.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        cowboysStagecoachSourcePromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
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
    const result = executeAbilityProgram(
        cowboysDynamiteSurprisePromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            baseIndex: ctx.baseIndex,
            defId: ctx.defId,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysDynamiteSurpriseSeenTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.inspectionCards?.length || !ctx.inspectionZone || !ctx.inspectionCausePlayerId) {
        return { events: [] };
    }

    const queuedSourceCardUid = ctx.sourceCardUid;
    const ownerPlayerId = (ctx.inspectionTargetPlayerIds ?? []).find((candidate) => {
        const player = ctx.state.players[candidate];
        if (!player) return false;
        const zoneCards = ctx.inspectionZone === 'hand' ? player.hand : player.deck;
        if (queuedSourceCardUid) {
            return zoneCards.some(entry => entry.uid === queuedSourceCardUid);
        }
        return ctx.inspectionCards!.some(card =>
            isDynamiteSurpriseDefId(card.defId) && zoneCards.some(entry => entry.uid === card.uid)
        );
    });
    if (!ownerPlayerId || ownerPlayerId === ctx.inspectionCausePlayerId) return { events: [] };

    const player = ctx.state.players[ownerPlayerId];
    const zoneCards = ctx.inspectionZone === 'hand' ? player?.hand ?? [] : player?.deck ?? [];
    const exposedCard = queuedSourceCardUid
        ? ctx.inspectionCards.find(card =>
            card.uid === queuedSourceCardUid
            && isDynamiteSurpriseDefId(card.defId)
            && zoneCards.some(entry => entry.uid === card.uid)
        )
        : ctx.inspectionCards.find(card =>
            isDynamiteSurpriseDefId(card.defId)
            && zoneCards.some(entry => entry.uid === card.uid)
        );
    if (!exposedCard) return { events: [] };

    const targets = collectDynamiteSeenTargets(ctx.state, ctx.inspectionCausePlayerId);
    if (targets.length === 0) return { events: [] };

    const result = executeAbilityProgram(
        cowboysDynamiteSurpriseSeenPromptProgram,
        createCowboysPromptContext(ctx.matchState, ownerPlayerId, ctx.now, {
            cardUid: exposedCard.uid,
            ownerPlayerId,
            targetPlayerId: ctx.inspectionCausePlayerId,
            sourceZone: ctx.inspectionZone,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysSheriffBeforeScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return { events: [] };
    }
    if (!canStartDuel(ctx.state)) return { events: [] };
    const enemyOptions = buildEnemyMinionOptions(ctx.state, ctx.baseIndex, ctx.sourceControllerId);
    if (enemyOptions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        cowboysOptionalDuelPromptProgram,
        createCowboysPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            visibleSourceId: 'cowboys_sheriff_before_scoring',
            title: '警长：你可以令此随从与这里另一位玩家的一个随从决斗',
            titleKey: 'ui.cowboys_sheriff_before_scoring_title',
            friendlyMinionUid: ctx.sourceCardUid,
            sourceBaseIndex: ctx.baseIndex,
            casterPlayerId: ctx.sourceControllerId,
            duelSourceId: 'cowboys_sheriff_before_scoring',
            outcome: 'destroy_loser' as DuelOutcomeKind,
            destroyReason: 'cowboys_sheriff_before_scoring',
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysGoldStrikeOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.sourceControllerId || ctx.playerId !== ctx.sourceControllerId) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function cowboysBaseSoSoCorralOnMinionPlayed(ctx: BaseAbilityContext): AbilityResult {
    if (!ctx.matchState || !ctx.minionUid || ctx.baseIndex === undefined) return { events: [] };
    if (!canStartDuel(ctx.state)) return { events: [] };
    const minion = ctx.state.bases[ctx.baseIndex]?.minions.find((entry: MinionOnBase) => entry.uid === ctx.minionUid);
    if (!minion) return { events: [] };
    const enemyOptions = buildEnemyMinionOptions(ctx.state, ctx.baseIndex, minion.controller);
    if (enemyOptions.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        cowboysOptionalDuelPromptProgram,
        createCowboysPromptContext(ctx.matchState, minion.controller, ctx.now, {
            visibleSourceId: 'base_so_so_corral',
            title: '小镇：你可以令刚打出的随从与这里另一位玩家的一个随从决斗',
            titleKey: 'ui.base_so_so_corral_duel_title',
            friendlyMinionUid: ctx.minionUid,
            sourceBaseIndex: ctx.baseIndex,
            casterPlayerId: minion.controller,
            duelSourceId: 'base_so_so_corral',
            outcome: 'destroy_loser' as DuelOutcomeKind,
            destroyReason: 'base_so_so_corral',
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function cowboysBaseSaloonOnMinionDestroyed(ctx: any): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const playerIds = Array.from(new Set(base.minions.map((minion: MinionOnBase) => minion.controller)));
    return {
        events: playerIds.flatMap((playerId) => buildStandardDrawEvents(ctx.state, playerId, 1, dummyRandom, ctx.now)),
    };
}

const cowboysOptionalDuelPromptProgram = createPromptProgram<CowboysDuelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_optional_duel_target',
    interactionSourceIds: ['cowboys_gunfighter', 'cowboys_sheriff_before_scoring', 'base_so_so_corral'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.visibleSourceId}_${context.now}_${context.friendlyMinionUid}`,
        context.playerId,
        context.title,
        [
            createSkipOption('跳过（不决斗）', 'ui.cowboys_skip_duel_option'),
            ...buildEnemyMinionOptions(
                context.matchState.core,
                context.sourceBaseIndex,
                context.casterPlayerId,
                context.respectActionProtection ? { respectActionProtection: true } : undefined,
            ),
        ] as any[],
        { sourceId: context.visibleSourceId, targetType: 'minion', ...(context.titleKey ? { titleKey: context.titleKey } : {}) },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean; minionUid?: string } | undefined;
        if (selected?.skip || !selected?.minionUid) return { events: [] };
        const duelStarted = startDuelWithEvents(state, {
            sourceId: context.duelSourceId,
            sourcePlayerId: context.casterPlayerId,
            challengerMinionUid: context.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: context.outcome,
            ...(context.destroyReason ? { destroyReason: context.destroyReason } : {}),
        }, timestamp);
        return {
            events: duelStarted.events,
            matchState: duelStarted.state,
        };
    },
});

const cowboysFriendlyDuelPromptProgram = createPromptProgram<CowboysFriendlyDuelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_friendly_duel_select',
    interactionSourceIds: ['cowboys_high_noon_friendly', 'cowboys_run_em_off_friendly'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.visibleSourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(
            collectFriendlyDuelStarters(
                context.matchState.core,
                context.playerId,
                context.respectActionProtection ? { respectActionProtection: true } : undefined,
            ),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.duelSourceId,
            },
        ) as any[],
        { sourceId: context.visibleSourceId, targetType: 'minion', ...(context.titleKey ? { titleKey: context.titleKey } : {}) },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as FriendlyChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                visibleSourceId: context.nextVisibleSourceId,
                title: context.nextTitle,
                titleKey: context.nextTitleKey,
                friendlyMinionUid: selected.minionUid,
                sourceBaseIndex: selected.baseIndex,
                casterPlayerId: context.playerId,
                duelSourceId: context.duelSourceId,
                outcome: context.outcome,
                ...(context.destroyReason ? { destroyReason: context.destroyReason } : {}),
                respectActionProtection: context.respectActionProtection,
            }),
            nextProgram: cowboysEnemyDuelPromptProgram,
        };
    },
});

const cowboysEnemyDuelPromptProgram = createPromptProgram<CowboysDuelPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_enemy_duel_target',
    interactionSourceIds: ['cowboys_high_noon_enemy', 'cowboys_run_em_off_enemy'],
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.visibleSourceId}_${context.now}`,
        context.playerId,
        context.title,
        buildEnemyMinionOptions(
            context.matchState.core,
            context.sourceBaseIndex,
            context.casterPlayerId,
            context.respectActionProtection ? { respectActionProtection: true } : undefined,
        ) as any[],
        { sourceId: context.visibleSourceId, targetType: 'minion' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid) return { events: [] };
        const duelStarted = startDuelWithEvents(state, {
            sourceId: context.duelSourceId,
            sourcePlayerId: context.casterPlayerId,
            challengerMinionUid: context.friendlyMinionUid,
            challengedMinionUid: selected.minionUid,
            outcome: context.outcome,
            ...(context.destroyReason ? { destroyReason: context.destroyReason } : {}),
        }, timestamp);
        return {
            events: duelStarted.events,
            matchState: duelStarted.state,
        };
    },
});

const cowboysQuickDrawPromptProgram = createPromptProgram<CowboysPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_quick_draw',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cowboys_quick_draw_${context.now}`,
        context.playerId,
        '拔枪术：选择你的一个随从获得力量加成',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'cowboys_quick_draw',
            },
        ) as any[],
        { sourceId: 'cowboys_quick_draw', targetType: 'minion', titleKey: 'ui.cowboys_quick_draw_title' },
    ),
    onResolve: ({ state, value, timestamp }) => {
        const selected = value as FriendlyChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const inDuel = isMinionInActiveDuel(state.core, selected.minionUid);
        return {
            events: [addTempPower(selected.minionUid, selected.baseIndex, inDuel ? 4 : 2, 'cowboys_quick_draw', timestamp)],
        };
    },
});

const cowboysDynamiteSurprisePromptProgram = createPromptProgram<CowboysDynamitePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_dynamite_surprise',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const targets = !base
            ? []
            : base.minions
                .filter(minion => getMinionPower(context.matchState.core, minion, context.baseIndex) <= 4)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: context.baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId}`,
                }));
        return createAbilityRuntimeSimpleChoice(
            `cowboys_dynamite_surprise_${context.now}`,
            context.playerId,
            '炸药惊喜：选择一个力量4或以下的随从消灭',
            buildActionMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.defId,
                effectType: 'destroy',
            }) as any[],
            { sourceId: 'cowboys_dynamite_surprise', targetType: 'minion', titleKey: 'ui.cowboys_dynamite_surprise_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.defId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.baseIndex,
                reason: 'cowboys_dynamite_surprise',
                now: timestamp,
            }),
        };
    },
});

const cowboysDynamiteSurpriseSeenPromptProgram = createPromptProgram<CowboysDynamiteSeenPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_dynamite_surprise_seen',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cowboys_dynamite_surprise_seen_${context.now}_${context.cardUid}`,
        context.playerId,
        '炸药惊喜：你可以打出这张牌，消灭其中一个力量 4 或以下的随从',
        [
            createSkipOption('跳过（不打出）', 'ui.cowboys_skip_play_option'),
            ...buildActionMinionTargetOptions(
                collectDynamiteSeenTargets(context.matchState.core, context.targetPlayerId),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.ownerPlayerId,
                    effectType: 'destroy',
                },
            ),
        ] as any[],
        { sourceId: 'cowboys_dynamite_surprise_seen', targetType: 'minion', titleKey: 'ui.cowboys_dynamite_surprise_seen_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; defId?: string } | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { events: [] };
        }

        const owner = state.core.players[context.ownerPlayerId];
        if (!owner) return { events: [] };
        const sourceCards = context.sourceZone === 'hand' ? owner.hand : owner.deck;
        const playedCard = sourceCards.find(card => card.uid === context.cardUid && isDynamiteSurpriseDefId(card.defId));
        if (!playedCard) return { events: [] };

        const sourceRemovalEvent: SmashUpEvent = context.sourceZone === 'hand'
            ? {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: context.ownerPlayerId,
                    cardUids: [context.cardUid],
                },
                timestamp,
            }
            : {
                type: SU_EVENTS.CARDS_MILLED,
                payload: {
                    playerId: context.ownerPlayerId,
                    cardUids: [context.cardUid],
                    reason: 'cowboys_dynamite_surprise_seen',
                },
                timestamp,
            };

        return {
            events: [
                sourceRemovalEvent,
                ...buildValidatedDestroyEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    destroyerId: context.ownerPlayerId,
                    sourcePlayerId: context.ownerPlayerId,
                    sourceDefId: playedCard.defId,
                    sourceControllerId: context.ownerPlayerId,
                    reason: 'cowboys_dynamite_surprise_seen',
                    now: timestamp,
                }),
            ],
        };
    },
});

const cowboysGoldSelectPromptProgram = createPromptProgram<GoldSelectPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cowboys_gold_in_them_thar_hills_${context.now}`,
        context.playerId,
        '那山里有金子：从牌库顶三张牌中选择一张抓到手里',
        buildGoldTopCardOptions(context.matchState.core, context.playerId, context.topCards),
        {
            sourceId: 'cowboys_gold_in_them_thar_hills',
            targetType: 'generic',
            responseValidationMode: 'live',
            titleKey: 'ui.cowboys_gold_select_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { cardUid?: string } | undefined;
        if (!selected?.cardUid || context.topCards.length === 0) return { events: [] };
        const currentTopCards = getCurrentDeckTopSnapshotCards(state.core, context.playerId, context.topCards);
        const currentChosen = currentTopCards.find(card => card.uid === selected.cardUid);
        if (!currentChosen) return { events: [] };
        const remaining = currentTopCards.filter(card => card.uid !== currentChosen.uid);
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                chosenCard: currentChosen,
                remainingCards: remaining,
                random: context.random,
            }),
            nextProgram: remaining.length > 1 ? cowboysGoldOrderPromptProgram : cowboysGoldPostOrderProgram,
        };
    },
});

const cowboysGoldOrderPromptProgram = createPromptProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills_order',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `cowboys_gold_in_them_thar_hills_order_${context.now}`,
            context.playerId,
            '那山里有金子：选择其余牌放回牌库顶的顺序',
            buildGoldOrderOptions(context.matchState.core, context.playerId, context),
            {
                sourceId: 'cowboys_gold_in_them_thar_hills_order',
                targetType: 'generic',
                responseValidationMode: 'live',
                titleKey: 'ui.cowboys_gold_order_title',
            },
        );
        (interaction.data as Record<string, unknown>).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
        ) => buildGoldOrderOptions(latestState.core, context.playerId, context);
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as GoldOrderChoice | undefined;
        if (!selected?.topCardUid) return { events: [] };
        const snapshot = getCurrentDeckTopSnapshotCards(state.core, context.playerId, [context.chosenCard, ...context.remainingCards]);
        const currentChosen = snapshot.find(card => card.uid === context.chosenCard.uid);
        if (!currentChosen) return { events: [] };
        const currentRemaining = snapshot.filter(card => card.uid !== context.chosenCard.uid);
        const topCard = currentRemaining.find(card => card.uid === selected.topCardUid);
        if (!topCard) return { events: [] };
        const orderedRemaining = [topCard, ...currentRemaining.filter(card => card.uid !== selected.topCardUid)];
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                chosenCard: currentChosen,
                remainingCards: orderedRemaining,
                random: context.random,
            }),
            nextProgram: cowboysGoldPostOrderProgram,
        };
    },
});

const cowboysGoldPostOrderProgram = createEffectProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>((context) => {
    if (!canOfferGoldExtraPlay(context.matchState.core, context.playerId, context.chosenCard)) {
        return {
            events: buildGoldDrawAndDeckEvents(
                context.matchState.core,
                context.playerId,
                context.chosenCard,
                context.remainingCards,
                context.now,
            ),
        };
    }
    return {
        events: [],
        context,
        nextProgram: cowboysGoldModePromptProgram,
    };
});

const cowboysGoldModePromptProgram = createPromptProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills_mode',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cowboys_gold_in_them_thar_hills_mode_${context.now}`,
        context.playerId,
        '那山里有金子：选择把这张牌抓到手里，或立刻作为额外牌打出',
        [
            {
                id: 'gold-keep',
                label: '抓到手里',
                labelKey: 'ui.cowboys_gold_keep_option',
                value: { mode: 'hand' as const },
                displayMode: 'button' as const,
            },
            {
                id: 'gold-play',
                label: '作为额外牌打出',
                labelKey: 'ui.cowboys_gold_play_option',
                value: { mode: 'play' as const },
                displayMode: 'button' as const,
            },
        ],
        { sourceId: 'cowboys_gold_in_them_thar_hills_mode', targetType: 'button', titleKey: 'ui.cowboys_gold_mode_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as GoldModeChoice | undefined;
        if (!selected?.mode) return { events: [] };
        if (selected.mode === 'hand') {
            return {
                events: buildGoldDrawAndDeckEvents(state.core, context.playerId, context.chosenCard, context.remainingCards, timestamp),
            };
        }
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                chosenCard: context.chosenCard,
                remainingCards: context.remainingCards,
                random: context.random,
            }),
            nextProgram: cowboysGoldPlayResolverProgram,
        };
    },
});

const cowboysGoldPlayResolverProgram = createEffectProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>((context) => {
    if (context.chosenCard.type === 'minion') {
        const options = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateDeckTopRegularMinionPlaySemantics(context.matchState.core, context.playerId, {
                baseIndex: base.baseIndex,
                cardUid: context.chosenCard.uid,
                defId: context.chosenCard.defId,
            }).valid);
        if (options.length === 0) {
            return {
                events: buildGoldDrawAndDeckEvents(
                    context.matchState.core,
                    context.playerId,
                    context.chosenCard,
                    context.remainingCards,
                    context.now,
                ),
            };
        }
        return { events: [], context, nextProgram: cowboysGoldMinionBasePromptProgram };
    }

    if (context.chosenCard.type !== 'action') {
        return {
            events: buildGoldDrawAndDeckEvents(
                context.matchState.core,
                context.playerId,
                context.chosenCard,
                context.remainingCards,
                context.now,
            ),
        };
    }

    const actionDef = getCardDef(context.chosenCard.defId) as any;
    if (!actionDef || actionDef.subtype === 'special') {
        return {
            events: buildGoldDrawAndDeckEvents(
                context.matchState.core,
                context.playerId,
                context.chosenCard,
                context.remainingCards,
                context.now,
            ),
        };
    }

    if (actionLikeNeedsPlayMinion(actionDef)) {
        const minionOptions = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => validateActionPlaySemantics(context.matchState.core, context.playerId, {
                    defId: context.chosenCard.defId,
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
            return {
                events: buildGoldDrawAndDeckEvents(
                    context.matchState.core,
                    context.playerId,
                    context.chosenCard,
                    context.remainingCards,
                    context.now,
                ),
            };
        }
        return { events: [], context, nextProgram: cowboysGoldActionMinionPromptProgram };
    }

    if (actionLikeNeedsPlayBase(actionDef) || actionDef.subtype === 'ongoing') {
        const baseOptions = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateActionPlaySemantics(context.matchState.core, context.playerId, {
                defId: context.chosenCard.defId,
                targetBaseIndex: base.baseIndex,
            }).valid);
        if (baseOptions.length === 0) {
            return {
                events: buildGoldDrawAndDeckEvents(
                    context.matchState.core,
                    context.playerId,
                    context.chosenCard,
                    context.remainingCards,
                    context.now,
                ),
            };
        }
        return { events: [], context, nextProgram: cowboysGoldActionBasePromptProgram };
    }

    return playGoldCard(
        context.matchState,
        context.playerId,
        context.chosenCard,
        context.remainingCards,
        {},
        context.random,
        context.now,
    );
});

const cowboysGoldMinionBasePromptProgram = createPromptProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills_minion_base',
    buildInteraction: (context) => {
        const options = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateDeckTopRegularMinionPlaySemantics(context.matchState.core, context.playerId, {
                baseIndex: base.baseIndex,
                cardUid: context.chosenCard.uid,
                defId: context.chosenCard.defId,
            }).valid);
        return createAbilityRuntimeSimpleChoice(
            `cowboys_gold_in_them_thar_hills_minion_base_${context.now}`,
            context.playerId,
            '那山里有金子：选择这张额外随从要打到哪个基地',
            buildBaseTargetOptions(options, context.matchState.core),
            { sourceId: 'cowboys_gold_in_them_thar_hills_minion_base', targetType: 'base', titleKey: 'ui.cowboys_gold_minion_base_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return playGoldCard(
            state,
            context.playerId,
            context.chosenCard,
            context.remainingCards,
            { baseIndex: selected.baseIndex },
            context.random,
            timestamp,
        );
    },
});

const cowboysGoldActionBasePromptProgram = createPromptProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills_action_base',
    buildInteraction: (context) => {
        const options = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                baseDefId: base.defId,
                label: getBaseDef(base.defId)?.name ?? base.defId,
            }))
            .filter(base => validateActionPlaySemantics(context.matchState.core, context.playerId, {
                defId: context.chosenCard.defId,
                targetBaseIndex: base.baseIndex,
            }).valid);
        return createAbilityRuntimeSimpleChoice(
            `cowboys_gold_in_them_thar_hills_action_base_${context.now}`,
            context.playerId,
            '那山里有金子：选择这张额外行动的目标基地',
            buildBaseTargetOptions(options, context.matchState.core),
            { sourceId: 'cowboys_gold_in_them_thar_hills_action_base', targetType: 'base', titleKey: 'ui.cowboys_gold_action_base_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return playGoldCard(
            state,
            context.playerId,
            context.chosenCard,
            context.remainingCards,
            { targetBaseIndex: selected.baseIndex },
            context.random,
            timestamp,
        );
    },
});

const cowboysGoldActionMinionPromptProgram = createPromptProgram<GoldRuntimePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_gold_in_them_thar_hills_action_minion',
    buildInteraction: (context) => {
        const minionOptions = context.matchState.core.bases.flatMap((base, baseIndex) => (
            base.minions
                .filter(minion => validateActionPlaySemantics(context.matchState.core, context.playerId, {
                    defId: context.chosenCard.defId,
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
        return createAbilityRuntimeSimpleChoice(
            `cowboys_gold_in_them_thar_hills_action_minion_${context.now}`,
            context.playerId,
            '那山里有金子：选择这张额外行动的目标随从',
            buildMinionTargetOptions(
                minionOptions,
                { state: context.matchState.core, sourcePlayerId: context.playerId, sourceDefId: context.chosenCard.defId },
            ) as any[],
            { sourceId: 'cowboys_gold_in_them_thar_hills_action_minion', targetType: 'minion', titleKey: 'ui.cowboys_gold_action_minion_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string } | undefined;
        if (!selected?.minionUid) return { events: [] };
        return playGoldCard(
            state,
            context.playerId,
            context.chosenCard,
            context.remainingCards,
            { targetMinionUid: selected.minionUid },
            context.random,
            timestamp,
        );
    },
});

const cowboysStagecoachSourcePromptProgram = createPromptProgram<StagecoachSourcePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_stagecoach_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `cowboys_stagecoach_source_${context.now}`,
        context.playerId,
        '驿站马车：选择要搬运卡牌的来源基地',
        buildBaseTargetOptions(collectStagecoachSourceBases(context.matchState.core, context.playerId), context.matchState.core),
        { sourceId: 'cowboys_stagecoach_source', targetType: 'base', titleKey: 'ui.cowboys_stagecoach_source_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const movableCards = collectStagecoachCardsOnBase(state.core, context.playerId, selected.baseIndex);
        if (movableCards.length === 0) return { events: [] };
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                sourceBaseIndex: selected.baseIndex,
            }),
            nextProgram: cowboysStagecoachCardsPromptProgram,
        };
    },
});

const cowboysStagecoachCardsPromptProgram = createPromptProgram<StagecoachCardsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_stagecoach_cards',
    buildInteraction: (context) => {
        const movableCards = collectStagecoachCardsOnBase(context.matchState.core, context.playerId, context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `cowboys_stagecoach_cards_${context.now}`,
            context.playerId,
            '驿站马车：选择 1-2 张要搬运到另一个基地的牌',
            movableCards.map((card, index) => ({
                id: `stagecoach-card-${index}`,
                label: card.label,
                value: {
                    kind: card.kind,
                    uid: card.uid,
                    defId: card.defId,
                    baseIndex: card.baseIndex,
                    baseDefId: card.baseDefId,
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
                titleKey: 'ui.cowboys_stagecoach_cards_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = (Array.isArray(value) ? value : []) as StagecoachCardChoice[];
        if (selected.length === 0) return { events: [] };
        const sanitizedCards = selected
            .filter(choice => choice.uid && choice.defId)
            .map(choice => ({
                kind: choice.kind,
                uid: choice.uid,
                defId: choice.defId,
                baseIndex: choice.baseIndex,
                baseDefId: choice.baseDefId,
                ownerId: choice.ownerId,
                trueOwnerId: choice.trueOwnerId,
            }));
        if (sanitizedCards.length === 0) return { events: [] };
        return {
            events: [],
            context: createCowboysPromptContext(state, context.playerId, timestamp, {
                sourceBaseIndex: context.sourceBaseIndex,
                selectedCards: sanitizedCards,
            }),
            nextProgram: cowboysStagecoachDestinationPromptProgram,
        };
    },
});

const cowboysStagecoachDestinationPromptProgram = createPromptProgram<StagecoachDestinationPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'cowboys_stagecoach_destination',
    buildInteraction: (context) => {
        const destinationBases = context.matchState.core.bases
            .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? base.defId }))
            .filter(base => base.baseIndex !== context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `cowboys_stagecoach_destination_${context.now}`,
            context.playerId,
            '驿站马车：选择目标基地',
            buildBaseTargetOptions(destinationBases, context.matchState.core),
            { sourceId: 'cowboys_stagecoach_destination', targetType: 'base', titleKey: 'ui.cowboys_stagecoach_destination_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number; baseDefId?: string } | undefined;
        if (selected?.baseIndex === undefined || !context.selectedCards.length) return { events: [] };
        const nextCore = relocateStagecoachStaticCards(state.core, context.sourceBaseIndex, selected.baseIndex, context.selectedCards);
        return {
            matchState: nextCore === state.core ? state : { ...state, core: nextCore },
            events: context.selectedCards.flatMap((card) => {
                if (card.kind === 'minion') {
                    return buildValidatedMoveEvents(state, {
                        minionUid: card.uid,
                        minionDefId: card.defId,
                        fromBaseIndex: context.sourceBaseIndex,
                        toBaseIndex: selected.baseIndex!,
                        toBaseDefId: selected.baseDefId,
                        sourcePlayerId: context.playerId,
                        sourceDefId: 'cowboys_stagecoach',
                        sourceControllerId: context.playerId,
                        sourceBaseIndex: context.sourceBaseIndex,
                        reason: 'cowboys_stagecoach',
                        now: timestamp,
                    });
                }
                if (card.kind === 'titan') {
                    return [moveTitan(
                        card.uid,
                        card.defId,
                        context.sourceBaseIndex,
                        selected.baseIndex!,
                        'cowboys_stagecoach',
                        timestamp,
                        selected.baseDefId,
                    )];
                }
                return [];
            }),
        };
    },
});

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
            baseDefId: base.defId,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));

    const titans = (state.titans ?? [])
        .filter(titan => titan.controllerId === playerId && titan.location.zone === 'base' && titan.location.baseIndex === baseIndex)
        .map((titan) => ({
            kind: 'titan' as const,
            uid: titan.uid,
            defId: titan.defId,
            baseIndex,
            baseDefId: base.defId,
            label: getCardDef(titan.defId)?.name ?? titan.defId,
        }));

    const ongoingActions = base.ongoingActions
        .filter(action => ((action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId) === playerId)
        .map((action) => ({
            kind: 'ongoing_base' as const,
            uid: action.uid,
            defId: action.defId,
            baseIndex,
            baseDefId: base.defId,
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
            baseDefId: base.defId,
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
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            })),
        {
            state,
            sourcePlayerId,
            sourceKind: respectActionProtection ? 'action' : undefined,
            effectType: 'destroy',
            respectActionProtection,
        },
    );
}

function buildGoldDrawAndDeckEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    now: number,
): SmashUpEvent[] {
    const restOfDeck = core.players[playerId]?.deck.filter(card => card.uid !== chosenCard.uid && !remainingCards.some(entry => entry.uid === card.uid)) ?? [];
    const sourceRemaining = remainingCards.filter(card => card.owner === playerId || !core.players[card.owner]);
    const borrowedByOwner = new Map<PlayerId, CardInstance[]>();
    for (const card of remainingCards) {
        if (card.owner === playerId || !core.players[card.owner]) continue;
        borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
    }
    return [
        {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [chosenCard.uid] },
            timestamp: now,
        } as CardsDrawnEvent,
        ...Array.from(borrowedByOwner.entries()).map(([ownerId, cards]) => ({
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: [...cards.map(card => card.uid), ...core.players[ownerId].deck.map(card => card.uid)],
                sourcePlayerId: playerId,
            },
            timestamp: now,
        }) as DeckReorderedEvent),
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: [...sourceRemaining.map(card => card.uid), ...restOfDeck.map(card => card.uid)] },
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

function playGoldCard(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    chosenCard: CardInstance,
    remainingCards: CardInstance[],
    targets: { baseIndex?: number; targetBaseIndex?: number; targetMinionUid?: string },
    random: RandomFn,
    now: number,
): { matchState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const prefixEvents = buildGoldDrawAndDeckEvents(state.core, playerId, chosenCard, remainingCards, now);
    if (chosenCard.type === 'minion') {
        const baseIndex = targets.baseIndex ?? 0;
        const minionDef = getCardDef(chosenCard.defId) as { power?: number } | undefined;
        return {
            matchState: state,
            events: [
                ...prefixEvents,
                {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: {
                        playerId,
                        cardUid: chosenCard.uid,
                        defId: chosenCard.defId,
                        ownerId: chosenCard.owner,
                        baseIndex,
                        baseDefId: state.core.bases[baseIndex]?.defId,
                        power: minionDef?.power ?? 0,
                        consumesNormalLimit: false,
                    },
                    timestamp: now,
                } as MinionPlayedEvent,
            ],
        };
    }

    if (chosenCard.type !== 'action') {
        return { matchState: state, events: prefixEvents };
    }

    const actionDef = getCardDef(chosenCard.defId) as { subtype?: string } | undefined;
    const actionEvents: SmashUpEvent[] = [
        ...prefixEvents,
        buildActionPlayedEvent({
            playerId,
            cardUid: chosenCard.uid,
            defId: chosenCard.defId,
            ownerId: chosenCard.owner,
            isExtraAction: true,
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            timestamp: now,
        }) as SmashUpEvent,
    ];

    if (actionDef?.subtype === 'ongoing' && targets.targetBaseIndex !== undefined) {
        actionEvents.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: chosenCard.uid,
            defId: chosenCard.defId,
            ownerId: chosenCard.owner,
            ...(chosenCard.owner !== playerId ? { sourcePlayerId: playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: targets.targetBaseIndex,
            targetMinionUid: targets.targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now,
        }));
    }

    const appended = appendResolvedActionAbility({
        state,
        events: actionEvents,
        playerId,
        cardUid: chosenCard.uid,
        defId: chosenCard.defId,
        random,
        timestamp: now,
        baseIndex: targets.targetBaseIndex ?? 0,
        targetBaseIndex: targets.targetBaseIndex,
        targetMinionUid: targets.targetMinionUid,
    });
    return { matchState: appended.state, events: appended.events };
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
