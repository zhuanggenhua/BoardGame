import type { MatchState, PlayerId } from '../../../engine/types';
import { registerAbilityProgram, registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { createAbilityRuntimeSimpleChoice, createEffectProgram, createPromptProgram, executeAbilityProgram } from '../domain/abilityRuntime';
import {
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    peekDeckTop,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { registerInterceptor, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getBaseDef, getCardDef } from '../data/cards';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, DeckReorderedEvent, OngoingDetachedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';

type ButtonChoice = {
    choice?: 'draw' | 'buff' | 'play_extra_action' | 'move_to_bottom';
    skip?: boolean;
};

type MinionChoice = {
    minionUid?: string;
    baseIndex?: number;
    defId?: string;
    skip?: boolean;
};

type CardChoice = {
    cardUid?: string;
    defId?: string;
};

type BaseChoice = {
    baseIndex?: number;
    baseDefId?: string;
};

type PrincessesRuntimePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceDefId: string;
};

type PrincessesDestroyMinionPromptContext = PrincessesRuntimePromptContext & {
    sourceId: 'princesses_apricot' | 'princesses_skillet' | 'princesses_skillet_pod';
    title: string;
    reason: 'princesses_apricot' | 'princesses_skillet' | 'princesses_skillet_pod';
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    drawCount?: number;
};

type PrincessesDiscardSelectionPromptContext = PrincessesRuntimePromptContext & {
    sourceId: 'princesses_direct_to_dvd_sequel' | 'princesses_griselda';
    title: string;
    reason: 'princesses_direct_to_dvd_sequel' | 'princesses_griselda';
    mode: 'shuffle_draw' | 'recover';
    options: Array<{ cardUid: string; defId: string; label: string }>;
};

type PrincessesMovePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: 'princesses_true_loves_kiss' | 'princesses_some_day_my_prince_will_come';
    sourceDefId: string;
    title: string;
    destinationTitle: string;
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
    reason: string;
    selectedTarget?: { minionUid: string; defId: string; fromBaseIndex: number };
};

type PrincessesFairyGodmotherPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    sourceId: 'princesses_fairy_godmother' | 'princesses_fairy_godmother_pod';
    sourceDefId: string;
    title: string;
    drawCount: number;
    buffAmount: number;
};

type PrincessesSnowWhitePromptContext = PrincessesRuntimePromptContext & {
    destinationBaseIndex: number;
    title: string;
    targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }>;
};

type PrincessesWoodlandHelpersPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    cardName: string;
};

type PrincessesGriseldaPodPromptContext = PrincessesRuntimePromptContext & {
    options: Array<{ cardUid: string; defId: string; label: string }>;
};

let princessesRuntimePromptCounter = 0;

function collectAllMinions(core: SmashUpCore) {
    const targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < core.bases.length; baseIndex++) {
        const base = core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            targets.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${baseName}`,
            });
        }
    }
    return targets;
}

function getOtherBaseChoices(core: SmashUpCore, fromBaseIndex: number) {
    return core.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter(candidate => candidate.baseIndex !== fromBaseIndex);
}

function shuffleCardIntoDeck(
    core: SmashUpCore,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    random: AbilityContext['random'] | TriggerContext['random'],
    now: number,
    reason: string,
    source?: {
        sourcePlayerId?: PlayerId;
        sourceCardUid?: string;
        sourceDefId?: string;
        sourceControllerId?: PlayerId;
        sourceBaseIndex?: number;
    },
): SmashUpEvent[] {
    const player = core.players[playerId];
    if (!player) return [];
    const existingDeck = player.deck.filter(card => card.uid !== cardUid);
    const shuffled = random.shuffle([
        ...existingDeck,
        {
            uid: cardUid,
            defId,
            type: (getCardDef(defId)?.type ?? 'minion') as 'minion' | 'action' | 'fusion' | 'titan',
            owner: playerId,
        },
    ]);
    return [
        ...buildValidatedCardToDeckBottomEvents(core, {
            cardUid,
            defId,
            ownerId: playerId,
            ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid !== undefined ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId !== undefined ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId !== undefined ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
            reason,
            now,
            expectedLocation: 'any',
        }),
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: shuffled.map(card => card.uid),
                ...(source?.sourcePlayerId !== undefined ? { sourcePlayerId: source.sourcePlayerId } : {}),
            },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function parseActionCardUid(sourceEventId?: string): string | undefined {
    if (!sourceEventId) return undefined;
    const match = /^action-played:([^:]+):/.exec(sourceEventId);
    return match?.[1];
}

function buildPrincessesDiscardCardOptions(
    cards: Array<{ cardUid: string; defId: string; label: string }>,
) {
    return cards.map((card, index) => ({
        id: `discard-${index}`,
        label: card.label,
        value: { cardUid: card.cardUid, defId: card.defId },
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function princessesHappilyEverAfter(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const scoringOwnerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.rankings?.some(ranking => ranking.playerId === scoringOwnerId && ranking.vp > 0) !== true) {
        return [];
    }
    return [{
        type: SU_EVENTS.VP_AWARDED,
        payload: {
            playerId: scoringOwnerId,
            amount: 1,
            reason: 'princesses_happily_ever_after',
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function princessesWoodlandHelpers(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const helperControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.playerId !== helperControllerId) return [];
    if (!ctx.matchState) return [];
    const cardUid = parseActionCardUid(ctx.sourceEventId);
    if (!cardUid) return [];

    const discardOwnerEntry = Object.entries(ctx.state.players).find(([, player]) =>
        player.discard.some(entry => entry.uid === cardUid && entry.type === 'action'),
    );
    const discardOwnerId = discardOwnerEntry?.[0] as PlayerId | undefined;
    const card = discardOwnerEntry?.[1].discard.find(entry => entry.uid === cardUid);
    if (!discardOwnerId || !card || card.type !== 'action') return [];

    const result = executeAbilityProgram(princessesWoodlandHelpersPromptProgram, {
        matchState: ctx.matchState,
        playerId: helperControllerId,
        now: ctx.now,
        cardUid,
        defId: card.defId,
        ownerId: discardOwnerId,
        cardName: getCardDef(card.defId)?.name ?? card.defId,
    } satisfies PrincessesWoodlandHelpersPromptContext);
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function princessesWoodlandHelpersPod(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    const helperControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.playerId !== helperControllerId) return [];
    if (!ctx.matchState) return [];
    const cardUid = parseActionCardUid(ctx.sourceEventId);
    if (!cardUid) return [];

    const discardOwnerEntry = Object.entries(ctx.state.players).find(([, player]) =>
        player.discard.some(entry => entry.uid === cardUid && entry.type === 'action'),
    );
    const discardOwnerId = discardOwnerEntry?.[0] as PlayerId | undefined;
    const card = discardOwnerEntry?.[1].discard.find(entry => entry.uid === cardUid);
    const cardDef = card ? getCardDef(card.defId) : undefined;
    if (!discardOwnerId || !card || card.type !== 'action' || cardDef?.type !== 'action' || cardDef.subtype !== 'standard') {
        return [];
    }

    const result = executeAbilityProgram(princessesWoodlandHelpersPromptProgram, {
        matchState: ctx.matchState,
        playerId: helperControllerId,
        now: ctx.now,
        cardUid,
        defId: card.defId,
        ownerId: discardOwnerId,
        cardName: getCardDef(card.defId)?.name ?? card.defId,
    } satisfies PrincessesWoodlandHelpersPromptContext);
    return {
        events: result.events,
        matchState: result.matchState,
    };
}

function canTriggerPrincessesWoodlandHelpers(ctx: TriggerContext, standardOnly = false): boolean {
    const helperControllerId = ctx.sourceControllerId ?? ctx.playerId;
    if (ctx.playerId !== helperControllerId || !ctx.matchState) return false;
    const cardUid = parseActionCardUid(ctx.sourceEventId);
    if (!cardUid) return false;

    const discardOwnerEntry = Object.entries(ctx.state.players).find(([, player]) =>
        player.discard.some(entry => entry.uid === cardUid && entry.type === 'action'),
    );
    const card = discardOwnerEntry?.[1].discard.find(entry => entry.uid === cardUid);
    if (!card || card.type !== 'action') return false;
    if (!standardOnly) return true;
    const cardDef = getCardDef(card.defId);
    return cardDef?.type === 'action' && cardDef.subtype === 'standard';
}

function princessesSleepingBeautyOnDestroyed(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.triggerMinion?.uid !== ctx.sourceCardUid || !ctx.triggerMinionDefId || ctx.baseIndex === undefined) {
        return [];
    }
    return shuffleCardIntoDeck(
        ctx.state,
        ctx.triggerMinion.owner,
        ctx.triggerMinion.uid,
        ctx.triggerMinionDefId,
        ctx.random,
        ctx.now,
        'princesses_sleeping_beauty',
        {
            sourcePlayerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceCardUid: ctx.sourceCardUid ?? ctx.triggerMinion.uid,
            sourceDefId: ctx.sourceDefId ?? ctx.triggerMinionDefId,
            sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
    );
}

function princessesSleepingBeautyOnDiscarded(ctx: TriggerContext): TriggerResult | SmashUpEvent[] {
    if (ctx.triggerMinionDefId !== 'princesses_sleeping_beauty' && ctx.triggerMinionDefId !== 'princesses_sleeping_beauty_pod') {
        return [];
    }
    if (!ctx.triggerMinionUid || !ctx.triggerMinionDefId) return [];
    const discardEntry = Object.entries(ctx.state.players).find(([, player]) =>
        player.discard.some(card => card.uid === ctx.triggerMinionUid && card.defId === ctx.triggerMinionDefId),
    );
    const discardSourcePlayerId = discardEntry?.[0] as PlayerId | undefined;
    const discardCard = discardEntry?.[1].discard.find(card =>
        card.uid === ctx.triggerMinionUid && card.defId === ctx.triggerMinionDefId,
    );
    const ownerId = ctx.triggerMinion?.owner
        ?? discardCard?.owner
        ?? ctx.playerId;

    return shuffleCardIntoDeck(
        ctx.state,
        ownerId,
        ctx.triggerMinionUid,
        ctx.triggerMinionDefId,
        ctx.random,
        ctx.now,
        'princesses_sleeping_beauty',
        {
            sourcePlayerId: discardSourcePlayerId ?? ctx.sourceControllerId ?? ctx.playerId,
            sourceCardUid: ctx.sourceCardUid ?? ctx.triggerMinionUid,
            sourceDefId: ctx.sourceDefId ?? ctx.triggerMinionDefId,
            sourceControllerId: ctx.sourceControllerId ?? ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        },
    );
}

function princessesHeirloomInterceptor(_state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = (event as OngoingDetachedEvent).payload;
    if (payload.defId !== 'princesses_heirloom' && payload.defId !== 'princesses_heirloom_pod') return undefined;
    if (!payload.reason.includes('destroy')) return undefined;
    return null;
}

function princessesMarieDeGraw(ctx: AbilityContext): AbilityResult {
    const peeked = peekDeckTop(ctx.state, ctx.random, ctx.playerId, 'all', 'princesses_marie_degraw', ctx.now);
    if (!peeked) return { events: [] };
    if (peeked.card.type === 'minion') {
        return {
            events: [
                ...peeked.events,
                ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            ],
        };
    }
    return {
        events: [
            ...peeked.events,
            ...buildValidatedCardToDeckBottomEvents(ctx.state, {
                cardUid: peeked.card.uid,
                defId: peeked.card.defId,
                ownerId: peeked.card.owner,
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
                reason: 'princesses_marie_degraw',
                now: ctx.now,
                expectedLocation: 'deck',
            }),
        ],
    };
}

function princessesTaleAsOldAsTime(ctx: AbilityContext): AbilityResult {
    if (!ctx.state.bases[ctx.baseIndex]) return { events: [] };
    return {
        events: collectAllMinions(ctx.state)
            .filter(target => target.baseIndex !== ctx.baseIndex)
            .filter(target => ctx.state.bases[target.baseIndex]?.minions.some(
                minion => minion.uid === target.uid && minion.controller === ctx.playerId,
            ))
            .flatMap(target => buildValidatedMoveEvents(ctx.matchState, {
                minionUid: target.uid,
                minionDefId: target.defId,
                fromBaseIndex: target.baseIndex,
                toBaseIndex: ctx.baseIndex,
                toBaseDefId: ctx.state.bases[ctx.baseIndex]?.defId,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                sourceControllerId: ctx.playerId,
                reason: 'princesses_tale_as_old_as_time',
                now: ctx.now,
            })),
    };
}

export function registerPrincessesAbilities(): void {
    registerSimpleAbility('princesses_marie_degraw', 'talent', princessesMarieDeGraw);
    registerSimpleAbility('princesses_tale_as_old_as_time', 'onPlay', princessesTaleAsOldAsTime);
    registerAbilityProgram('princesses_apricot', 'talent', {
        program: princessesApricotProgram,
        createContext: createPrincessesApricotContext,
    });
    registerAbilityProgram('princesses_direct_to_dvd_sequel', 'onPlay', {
        program: princessesDirectToDvdSequelProgram,
        createContext: createPrincessesDirectToDvdSequelContext,
    });
    registerAbilityProgram('princesses_fairy_godmother', 'onPlay', {
        program: princessesFairyGodmotherPromptProgram,
        createContext: createPrincessesFairyGodmotherContext,
    });
    registerAbilityProgram('princesses_fairy_godmother_pod', 'onPlay', {
        program: princessesFairyGodmotherPromptProgram,
        createContext: createPrincessesFairyGodmotherContext,
    });
    registerAbilityProgram('princesses_skillet', 'onPlay', {
        program: princessesSkilletProgram,
        createContext: createPrincessesSkilletContext,
    });
    registerAbilityProgram('princesses_skillet_pod', 'onPlay', {
        program: princessesSkilletProgram,
        createContext: createPrincessesSkilletContext,
    });
    registerAbilityProgram('princesses_true_loves_kiss', 'onPlay', {
        program: princessesTrueLovesKissProgram,
        createContext: createPrincessesTrueLovesKissContext,
    });
    registerAbilityProgram('princesses_some_day_my_prince_will_come', 'special', {
        program: princessesSomeDayMyPrinceWillComeProgram,
        createContext: createPrincessesSomeDayMyPrinceWillComeContext,
    });
    registerAbilityProgram('princesses_snow_white', 'talent', {
        program: princessesSnowWhiteProgram,
        createContext: createPrincessesSnowWhiteContext,
    });
    registerAbilityProgram('princesses_griselda', 'talent', {
        program: princessesGriseldaProgram,
        createContext: createPrincessesGriseldaContext,
    });
    registerAbilityProgram('princesses_griselda_pod', 'talent', {
        program: princessesGriseldaPodProgram,
        createContext: createPrincessesGriseldaPodContext,
    });

    registerTrigger('princesses_happily_ever_after', 'afterScoring', princessesHappilyEverAfter, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('princesses_woodland_helpers', 'onActionPlayed', princessesWoodlandHelpers, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: canTriggerPrincessesWoodlandHelpers,
    });
    registerTrigger('princesses_woodland_helpers_pod', 'onActionPlayed', princessesWoodlandHelpersPod, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => canTriggerPrincessesWoodlandHelpers(ctx, true),
    });
    registerTrigger('princesses_sleeping_beauty', 'onMinionDestroyed', princessesSleepingBeautyOnDestroyed, {
        phase: 'replacement',
        perInstance: true,
    });
    registerTrigger('princesses_sleeping_beauty', 'onMinionDiscardedFromBase', princessesSleepingBeautyOnDiscarded, {
        global: true,
        globalZones: ['discard'],
        playerContext: 'eventPlayer',
    });
    registerInterceptor('princesses_heirloom', princessesHeirloomInterceptor);
}

function createPrincessesApricotContext(ctx: AbilityContext): PrincessesDestroyMinionPromptContext {
    const base = ctx.state.bases[ctx.baseIndex];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        sourceId: 'princesses_apricot',
        title: '杏子公主：选择这里另一个玩家的一个力量为 2 或更小的仆从',
        reason: 'princesses_apricot',
        targets: base
            ? base.minions
                .filter(minion => minion.controller !== ctx.playerId)
                .filter(minion => getMinionPower(ctx.state, minion, ctx.baseIndex) <= 2)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: ctx.baseIndex,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                }))
            : [],
    };
}

function createPrincessesDirectToDvdSequelContext(ctx: AbilityContext): PrincessesDiscardSelectionPromptContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        sourceId: 'princesses_direct_to_dvd_sequel',
        title: '直出结局：选择你弃牌堆中的一个仆从',
        reason: 'princesses_direct_to_dvd_sequel',
        mode: 'shuffle_draw',
        options: (player?.discard ?? [])
            .filter(card => card.type === 'minion')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                label: getCardDef(card.defId)?.name ?? card.defId,
            })),
    };
}

function createPrincessesFairyGodmotherContext(ctx: AbilityContext): PrincessesFairyGodmotherPromptContext {
    const isPod = ctx.defId === 'princesses_fairy_godmother_pod';
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: isPod ? 'princesses_fairy_godmother_pod' : 'princesses_fairy_godmother',
        sourceDefId: ctx.defId,
        title: isPod
            ? '妖精奶奶：抽两张牌，或者让一个仆从获得 +3 力量直到回合结束'
            : '妖精奶奶：抽一张牌，或者让一个仆从获得 +2 力量直到回合结束',
        drawCount: isPod ? 2 : 1,
        buffAmount: isPod ? 3 : 2,
    };
}

function createPrincessesSkilletContext(ctx: AbilityContext): PrincessesDestroyMinionPromptContext {
    const isPod = ctx.defId === 'princesses_skillet_pod';
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        sourceId: 'princesses_skillet',
        title: '平底锅：选择一个力量为 2 或更小的仆从',
        reason: isPod ? 'princesses_skillet_pod' : 'princesses_skillet',
        drawCount: isPod ? 1 : 3,
        targets: collectAllMinions(ctx.state)
            .filter(target => {
                const live = ctx.state.bases[target.baseIndex]?.minions.find(minion => minion.uid === target.uid);
                return !!live && getMinionPower(ctx.state, live, target.baseIndex) <= 2;
            }),
    };
}

function createPrincessesTrueLovesKissContext(ctx: AbilityContext): PrincessesMovePromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'princesses_true_loves_kiss',
        sourceDefId: ctx.defId,
        title: '真爱之吻：选择一个仆从移动到另一个基地',
        destinationTitle: '真爱之吻：选择要移动到的基地',
        targets: collectAllMinions(ctx.state),
        reason: 'princesses_true_loves_kiss',
    };
}

function createPrincessesSomeDayMyPrinceWillComeContext(ctx: AbilityContext): PrincessesMovePromptContext {
    const base = ctx.state.bases[ctx.baseIndex];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceId: 'princesses_some_day_my_prince_will_come',
        sourceDefId: ctx.defId,
        title: '总有一天我的王子会来的：选择一个仆从从这里移动到另一个基地',
        destinationTitle: '总有一天我的王子会来的：选择要移动到的基地',
        targets: (base?.minions ?? []).map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        })),
        reason: 'princesses_some_day_my_prince_will_come',
    };
}

function createPrincessesSnowWhiteContext(ctx: AbilityContext): PrincessesSnowWhitePromptContext {
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        destinationBaseIndex: ctx.baseIndex,
        title: '白雪公主：选择另一个基地上的一个仆从移动到这里',
        targets: collectAllMinions(ctx.state).filter(target => target.baseIndex !== ctx.baseIndex),
    };
}

function createPrincessesGriseldaContext(ctx: AbilityContext): PrincessesDiscardSelectionPromptContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        sourceId: 'princesses_griselda',
        title: '格丽泽尔达：选择你弃牌堆中的一张传家宝回到手牌',
        reason: 'princesses_griselda',
        mode: 'recover',
        options: (player?.discard ?? [])
            .filter(card => card.defId === 'princesses_heirloom' || card.defId === 'princesses_heirloom_pod')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                label: getCardDef(card.defId)?.name ?? card.defId,
            })),
    };
}

function createPrincessesGriseldaPodContext(ctx: AbilityContext): PrincessesGriseldaPodPromptContext {
    const player = ctx.state.players[ctx.playerId];
    return {
        matchState: ctx.matchState,
        playerId: ctx.playerId,
        now: ctx.now,
        sourceDefId: ctx.defId,
        options: (player?.discard ?? [])
            .filter(card => card.defId === 'princesses_heirloom' || card.defId === 'princesses_heirloom_pod')
            .map(card => ({
                cardUid: card.uid,
                defId: card.defId,
                label: getCardDef(card.defId)?.name ?? card.defId,
            })),
    };
}

const princessesDestroyMinionPromptProgram = createPromptProgram<
    PrincessesDestroyMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_apricot',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'destroy',
        }),
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: (args) => {
        const { context, state, playerId, value, timestamp } = args;
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [
                ...buildValidatedDestroyEvents(state, {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                    destroyerId: playerId,
                    sourcePlayerId: playerId,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: playerId,
                    reason: context.reason,
                    now: timestamp,
                }),
                ...(context.drawCount ? buildStandardDrawEventsFromRuntimeContext(args, playerId, context.drawCount) : []),
            ],
        };
    },
});

const princessesApricotProgram = createEffectProgram<
    PrincessesDestroyMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.targets.length === 0
        ? { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] }
        : { events: [], nextProgram: princessesDestroyMinionPromptProgram }
));

const princessesSkilletProgram = createEffectProgram<
    PrincessesDestroyMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.targets.length === 0
        ? { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] }
        : { events: [], nextProgram: princessesDestroyMinionPromptProgram }
));

function resolvePrincessesDirectToDvdSequelSelection(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    random: AbilityContext['random'],
    timestamp: number,
) {
    const selected = value as CardChoice | undefined;
    if (!selected?.cardUid || !selected.defId) {
        return { matchState: state, events: [] };
    }
    const player = state.core.players[playerId];
    const card = player?.discard.find(entry => entry.uid === selected.cardUid && entry.defId === selected.defId);
    if (!player || !card) {
        return { matchState: state, events: [] };
    }

    const ownerId = card.owner;
    const owner = state.core.players[ownerId];
    if (!owner) {
        return { matchState: state, events: [] };
    }

    const shuffledDeck = random.shuffle([
        ...owner.deck.filter(entry => entry.uid !== card.uid),
        { ...card, owner: ownerId },
    ]);
    const events: SmashUpEvent[] = [
        ...buildValidatedCardToDeckBottomEvents(state.core, {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            reason: 'princesses_direct_to_dvd_sequel',
            now: timestamp,
            expectedLocation: 'discard',
        }),
        {
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId: ownerId,
                deckUids: shuffledDeck.map(entry => entry.uid),
                ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
            },
            timestamp,
        } as DeckReorderedEvent,
    ];

    if (ownerId === playerId) {
        const drawCard = shuffledDeck[0];
        if (drawCard) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId,
                    count: 1,
                    cardUids: [drawCard.uid],
                },
                timestamp,
            } as CardsDrawnEvent);
        }
    } else {
        events.push(...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp));
    }
    return { matchState: state, events };
}

const princessesDirectToDvdSequelPromptProgram = createPromptProgram<
    PrincessesDiscardSelectionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_direct_to_dvd_sequel',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_direct_to_dvd_sequel_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        buildPrincessesDiscardCardOptions(context.options),
        {
            sourceId: 'princesses_direct_to_dvd_sequel',
            targetType: 'generic',
            autoRefresh: 'discard',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, random, timestamp }) => (
        resolvePrincessesDirectToDvdSequelSelection(state, playerId, value, random, timestamp)
    ),
});

const princessesGriseldaPromptProgram = createPromptProgram<
    PrincessesDiscardSelectionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_griselda',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_griselda_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        buildPrincessesDiscardCardOptions(context.options),
        {
            sourceId: 'princesses_griselda',
            targetType: 'generic',
            autoRefresh: 'discard',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as CardChoice | undefined;
        if (!selected?.cardUid) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [recoverCardsFromDiscard(playerId, [selected.cardUid], 'princesses_griselda', timestamp)],
        };
    },
});

const princessesGriseldaPodPromptProgram = createPromptProgram<
    PrincessesGriseldaPodPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_griselda_pod',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_griselda_pod_${princessesRuntimePromptCounter++}`,
        context.playerId,
        '格丽泽尔达：取回一张传家宝，或额外打出一张传家宝行动',
        [
            ...buildPrincessesDiscardCardOptions(context.options),
            {
                id: 'extra-action',
                label: '额外打出一张传家宝行动',
                labelKey: 'ui.princesses_griselda_pod_extra_action_option',
                value: { choice: 'play_extra_action' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: 'princesses_griselda_pod',
            titleKey: 'ui.princesses_griselda_pod_title',
            targetType: 'generic',
            autoRefresh: 'discard',
            responseValidationMode: 'live',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as (CardChoice & ButtonChoice) | undefined;
        if (selected?.choice === 'play_extra_action') {
            return {
                matchState: state,
                events: [grantContextualExtraAction(
                    { playerId, now: timestamp, matchState: state },
                    'princesses_griselda_pod',
                    { restrictToCardDefId: 'princesses_heirloom_pod' },
                )],
            };
        }
        if (!selected?.cardUid) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [recoverCardsFromDiscard(playerId, [selected.cardUid], 'princesses_griselda_pod', timestamp)],
        };
    },
});

const princessesDirectToDvdSequelProgram = createEffectProgram<
    PrincessesDiscardSelectionPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.options.length === 0
        ? { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] }
        : { events: [], nextProgram: princessesDirectToDvdSequelPromptProgram }
));

const princessesGriseldaProgram = createEffectProgram<
    PrincessesDiscardSelectionPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.options.length === 0
        ? { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] }
        : { events: [], nextProgram: princessesGriseldaPromptProgram }
));

const princessesGriseldaPodProgram = createEffectProgram<
    PrincessesGriseldaPodPromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.options.length === 0
        ? {
            events: [grantContextualExtraAction(context, 'princesses_griselda_pod')],
        }
        : { events: [], nextProgram: princessesGriseldaPodPromptProgram }
));

const princessesTrueLovesKissProgram = createEffectProgram<
    PrincessesMovePromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (context.matchState.core.bases.length < 2) {
        return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] };
    }
    if (context.targets.length === 0) {
        return { events: [] };
    }
    return { events: [], nextProgram: princessesMovePromptProgram };
});

const princessesSomeDayMyPrinceWillComeProgram = createEffectProgram<
    PrincessesMovePromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    if (context.matchState.core.bases.length < 2) {
        return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] };
    }
    if (context.targets.length === 0) {
        return { events: [] };
    }
    return { events: [], nextProgram: princessesMovePromptProgram };
});

const princessesSnowWhitePromptProgram = createPromptProgram<
    PrincessesSnowWhitePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_snow_white',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_snow_white_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        {
            sourceId: 'princesses_snow_white',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: context.destinationBaseIndex,
                toBaseDefId: state.core.bases[context.destinationBaseIndex]?.defId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                sourceBaseIndex: context.destinationBaseIndex,
                reason: 'princesses_snow_white',
                now: timestamp,
            }),
        };
    },
});

const princessesSnowWhiteProgram = createEffectProgram<
    PrincessesSnowWhitePromptContext,
    SmashUpCore,
    SmashUpEvent
>((context) => (
    context.targets.length === 0
        ? { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', context.now)] }
        : { events: [], nextProgram: princessesSnowWhitePromptProgram }
));

const princessesWoodlandHelpersPromptProgram = createPromptProgram<
    PrincessesWoodlandHelpersPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_woodland_helpers',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_woodland_helpers_${context.cardUid}_${princessesRuntimePromptCounter++}`,
        context.playerId,
        `丛林帮手：你可以将 ${context.cardName} 放到牌库底而不是留在弃牌堆`,
        [
            {
                id: 'move-bottom',
                label: '放到牌库底',
                labelKey: 'ui.princesses_woodland_helpers_move_bottom_option',
                value: { choice: 'move_to_bottom' },
                displayMode: 'button' as const,
            },
            createSkipOption('留在弃牌堆', 'ui.princesses_woodland_helpers_leave_discard_option'),
        ],
        {
            sourceId: 'princesses_woodland_helpers',
            targetType: 'button',
            displayCard: { defId: context.defId, cardUid: context.cardUid },
            autoResolveIfSingle: false,
            titleKey: 'ui.princesses_woodland_helpers_title',
            titleParams: { cardName: context.cardName },
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as ButtonChoice | undefined;
        if (selected?.skip || selected?.choice !== 'move_to_bottom') {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedCardToDeckBottomEvents(state, {
                cardUid: context.cardUid,
                defId: context.defId,
                ownerId: context.ownerId,
                sourcePlayerId: context.playerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'princesses_woodland_helpers',
                sourceControllerId: context.playerId,
                reason: 'princesses_woodland_helpers',
                now: timestamp,
                expectedLocation: 'discard',
            }),
        };
    },
});

const princessesMoveDestinationPromptProgram = createPromptProgram<
    PrincessesMovePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_true_loves_kiss_base',
    buildInteraction: (context) => {
        const selectedTarget = context.selectedTarget;
        if (!selectedTarget) {
            throw new Error(`Princesses move runtime 缺少 selectedTarget: ${context.sourceId}`);
        }
        return createAbilityRuntimeSimpleChoice(
            `${context.sourceId}_base_${princessesRuntimePromptCounter++}`,
            context.playerId,
            context.destinationTitle,
            buildBaseTargetOptions(
                getOtherBaseChoices(context.matchState.core, selectedTarget.fromBaseIndex),
                context.matchState.core,
            ),
            {
                sourceId: `${context.sourceId}_base`,
                targetType: 'base',
                autoResolveIfSingle: false,
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as BaseChoice | undefined;
        const selectedTarget = context.selectedTarget;
        if (selected?.baseIndex === undefined || !selectedTarget) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selectedTarget.minionUid,
                minionDefId: selectedTarget.defId,
                fromBaseIndex: selectedTarget.fromBaseIndex,
                toBaseIndex: selected.baseIndex,
                toBaseDefId: selected.baseDefId,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
                sourceControllerId: context.playerId,
                reason: context.reason,
                now: timestamp,
            }),
        };
    },
});

const princessesMovePromptProgram = createPromptProgram<
    PrincessesMovePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_true_loves_kiss',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `${context.sourceId}_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        buildMinionTargetOptions(context.targets, {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'move',
        }),
        {
            sourceId: context.sourceId,
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ context, state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined || !selected.defId) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
                selectedTarget: {
                    minionUid: selected.minionUid,
                    defId: selected.defId,
                    fromBaseIndex: selected.baseIndex,
                },
            },
            nextProgram: princessesMoveDestinationPromptProgram,
        };
    },
});

const princessesFairyGodmotherTargetPromptProgram = createPromptProgram<
    PrincessesFairyGodmotherPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_fairy_godmother_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_fairy_godmother_target_${princessesRuntimePromptCounter++}`,
        context.playerId,
        `妖精奶奶：选择一个仆从获得 +${context.buffAmount} 力量直到回合结束`,
        buildMinionTargetOptions(collectAllMinions(context.matchState.core), {
            state: context.matchState.core,
            sourcePlayerId: context.playerId,
            sourceDefId: context.sourceDefId,
            effectType: 'power_change',
        }),
        {
            sourceId: 'princesses_fairy_godmother_target',
            targetType: 'minion',
            autoResolveIfSingle: false,
            titleKey: 'ui.princesses_fairy_godmother_target_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const selected = value as MinionChoice | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [
                addTempPower(
                    selected.minionUid,
                    selected.baseIndex,
                    context.buffAmount,
                    context.sourceId,
                    timestamp,
                ),
            ],
        };
    },
});

const princessesFairyGodmotherPromptProgram = createPromptProgram<
    PrincessesFairyGodmotherPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'princesses_fairy_godmother',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `princesses_fairy_godmother_${princessesRuntimePromptCounter++}`,
        context.playerId,
        context.title,
        [
            {
                id: 'draw',
                label: `抽${context.drawCount}张牌`,
                labelKey: 'ui.princesses_fairy_godmother_draw_option',
                value: { choice: 'draw' },
                displayMode: 'button' as const,
            },
            {
                id: 'buff',
                label: `给予 +${context.buffAmount} 力量`,
                labelKey: 'ui.princesses_fairy_godmother_buff_option',
                value: { choice: 'buff' },
                displayMode: 'button' as const,
            },
        ],
        {
            sourceId: context.sourceId,
            targetType: 'button',
            autoResolveIfSingle: false,
            titleKey: 'ui.princesses_fairy_godmother_title',
        },
    ),
    onResolve: (args) => {
        const { context, state, playerId, value } = args;
        const { timestamp } = args;
        const selected = value as ButtonChoice | undefined;
        if (selected?.choice === 'draw') {
            return {
                matchState: state,
                events: buildStandardDrawEventsFromRuntimeContext(args, playerId, context.drawCount),
            };
        }
        if (selected?.choice !== 'buff') {
            return { matchState: state, events: [] };
        }
        if (collectAllMinions(state.core).length === 0) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
            events: [],
            context: {
                ...context,
                matchState: state,
                playerId,
                now: timestamp,
            },
            nextProgram: princessesFairyGodmotherTargetPromptProgram,
        };
    },
});
