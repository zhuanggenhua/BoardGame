import type { PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerBaseAbility, type BaseAbilityContext, type BaseAbilityResult } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext, type TriggerResult } from '../domain/ongoingEffects';
import {
    addTempPower,
    buildAbilityFeedback,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    inspectDeck,
    revealDeckTop,
} from '../domain/abilityHelpers';
import {
    appendPendingPostScoringActions,
    getDeferredReplacementBaseDefId,
    isScoringSessionAwaitingDeferredResolution,
} from '../domain/scoringSession';
import { getBaseDef, getCardDef, getMinionDef } from '../data/cards';
import {
    SU_EVENTS,
    type CardInstance,
    type CardToDeckBottomEvent,
    type CardsDrawnEvent,
    type DeckReorderedEvent,
    type MinionMetadataUpdatedEvent,
    type MinionOnBase,
    type MinionPlayedEvent,
    type PendingPostScoringAction,
    type SmashUpCore,
    type SmashUpEvent,
    type TitanPlayedEvent,
} from '../domain/types';

type MinionMoveChoice = {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
    toBaseIndex: number;
    toBaseDefId?: string;
};
type CardChoice = { cardUid?: string; defId?: string; skip?: boolean };
type WishChoice = { mode: 'titan' | 'buff'; baseIndex: number; baseDefId?: string; skip?: boolean };
type ApartChoice = { minionUid: string; minionDefId: string; baseIndex: number };

const BABY = 'penguins_baby_penguin';
const COMMAND = 'penguins_command_penguin';
const DISGUISE = 'penguins_disguise_penguin';
const DANCING = 'penguins_dancing_penguin';
const HATCHING = 'penguins_the_hatching';
const SNAZZY = 'penguins_snazzy_penguin';
const REGURGITATING = 'penguins_regurgitating_penguin';
const SURFING = 'penguins_surfing_penguin';
const WISH = 'penguins_a_wish_for_wings_that_work';
const LEAPING = 'penguins_leaping_aboard';
const APART = 'penguins_i_cant_tell_them_apart';
const PEBBLE = 'penguins_pebble_gift';
const UNDER = 'penguins_under_the_ice';
const ICE_SLIDE = 'penguins_ice_slide';
const ICE_FLOE = 'base_ice_floe';
const COLONY = 'base_the_colony';
const EMPEROR = 'penguins_emperor_penguin';

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(core: SmashUpCore, baseIndex: number): string {
    return getBaseDef(core.bases[baseIndex]?.defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function isMinionCard(card: CardInstance): boolean {
    return card.type === 'minion' || getCardDef(card.defId)?.type === 'minion';
}

function isActionCard(card: CardInstance): boolean {
    return card.type === 'action' || getCardDef(card.defId)?.type === 'action';
}

function minionPower(defId: string): number {
    return getMinionDef(defId)?.power ?? 0;
}

function deckReordered(playerId: PlayerId, deckUids: string[], now: number): DeckReorderedEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids },
        timestamp: now,
    };
}

function cardToDeckBottom(
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    reason: string,
    now: number,
    source?: { sourcePlayerId?: PlayerId; sourceCardUid?: string; sourceDefId?: string; sourceControllerId?: PlayerId; sourceBaseIndex?: number },
): CardToDeckBottomEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
        payload: {
            cardUid,
            defId,
            ownerId,
            reason,
            ...(source?.sourcePlayerId ? { sourcePlayerId: source.sourcePlayerId } : {}),
            ...(source?.sourceCardUid ? { sourceCardUid: source.sourceCardUid } : {}),
            ...(source?.sourceDefId ? { sourceDefId: source.sourceDefId } : {}),
            ...(source?.sourceControllerId ? { sourceControllerId: source.sourceControllerId } : {}),
            ...(source?.sourceBaseIndex !== undefined ? { sourceBaseIndex: source.sourceBaseIndex } : {}),
        },
        timestamp: now,
    };
}

function minionMetadataUpdated(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: { minionUid, baseIndex, metadataUpdate, reason },
        timestamp: now,
    };
}

function playMinionEvent(
    state: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
): MinionPlayedEvent | undefined {
    const base = state.bases[baseIndex];
    if (!base || !isMinionCard(card)) return undefined;
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            baseIndex,
            baseDefId: base.defId,
            power: minionPower(card.defId),
            fromDeck: true,
            consumesNormalLimit: false,
            discardPlaySourceId: reason,
        },
        timestamp: now,
    };
}

function revealUntilMinionFromDeck(params: {
    state: SmashUpCore;
    random: RandomFn;
    playerId: PlayerId;
    baseIndex: number;
    reason: string;
    now: number;
}): { events: SmashUpEvent[]; picked?: CardInstance; missed: CardInstance[] } {
    const { state, random, playerId, baseIndex, reason, now } = params;
    const player = state.players[playerId];
    if (!player) return { events: [], missed: [] };

    let deckSim = [...player.deck];
    let discardSim = [...player.discard];
    const revealed: CardInstance[] = [];
    const missed: CardInstance[] = [];
    let picked: CardInstance | undefined;

    while (!picked) {
        if (deckSim.length === 0) {
            if (discardSim.length === 0) break;
            deckSim = random.shuffle([...discardSim]);
            discardSim = [];
        }
        const card = deckSim[0];
        if (!card) break;
        deckSim = deckSim.slice(1);
        revealed.push(card);
        if (isMinionCard(card)) {
            picked = card;
            break;
        }
        missed.push(card);
    }

    if (revealed.length === 0) return { events: [], missed: [] };

    const remainingDeck = picked
        ? [picked, ...random.shuffle([...deckSim, ...missed])]
        : random.shuffle([...deckSim, ...missed]);
    const play = picked ? playMinionEvent(state, playerId, picked, baseIndex, reason, now) : undefined;
    const events: SmashUpEvent[] = [
        inspectDeck(playerId, playerId, revealed.length, reason, now),
        revealDeckTop(playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, reason, now, playerId),
        deckReordered(playerId, remainingDeck.map(card => card.uid), now),
        ...(play ? [play] : [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)]),
    ];

    return { events, picked, missed };
}

function revealTopAndPlayRandomMinion(params: {
    state: SmashUpCore;
    random: RandomFn;
    playerId: PlayerId;
    baseIndex: number;
    count: number;
    reason: string;
    now: number;
}): SmashUpEvent[] {
    const { state, random, playerId, baseIndex, count, reason, now } = params;
    const player = state.players[playerId];
    if (!player) return [];

    const revealed = player.deck.slice(0, count);
    if (revealed.length === 0) return [];
    const minions = revealed.filter(isMinionCard);
    const picked = minions.length > 0 ? minions[random.range(0, minions.length - 1)] : undefined;
    const missed = revealed.filter(card => card.uid !== picked?.uid);
    const rest = player.deck.slice(revealed.length);
    const nextDeck = [...rest, ...missed];
    const play = picked ? playMinionEvent(state, playerId, picked, baseIndex, reason, now) : undefined;

    return [
        inspectDeck(playerId, playerId, revealed.length, reason, now),
        revealDeckTop(playerId, 'all', revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, reason, now, playerId),
        deckReordered(playerId, picked ? [picked.uid, ...nextDeck.map(card => card.uid)] : nextDeck.map(card => card.uid), now),
        ...(play ? [play] : [buildAbilityFeedback(playerId, 'feedback.no_valid_targets', now)]),
    ];
}

function targetBaseIndex(ctx: AbilityContext): number {
    return ctx.targetBaseIndex ?? ctx.baseIndex;
}

function playTopDeckMinionOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: revealUntilMinionFromDeck({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            baseIndex: targetBaseIndex(ctx),
            reason: ctx.defId,
            now: ctx.now,
        }).events,
    };
}

function commandPenguin(ctx: AbilityContext): AbilityResult {
    return {
        events: revealUntilMinionFromDeck({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            baseIndex: ctx.baseIndex,
            reason: COMMAND,
            now: ctx.now,
        }).events,
    };
}

function babyPenguin(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (self?.metadata?.playedFrom !== 'deck') return { events: [] };
    return {
        events: [
            // 这里是“从手牌额外打出力量 3 或更低的随从”，不继承 fromDeck。
            ...[],
        ],
        matchState: queueInteraction(ctx.matchState, createSimpleChoice<CardChoice>(
            `${BABY}_${ctx.cardUid}_${ctx.now}`,
            ctx.playerId,
            '企鹅宝宝：选择一张力量 3 或更低的随从额外打出到这里',
            [
                createSkipOption('不打出随从', 'ui.skip_option') as PromptOption<CardChoice>,
                ...ctx.state.players[ctx.playerId].hand
                    .filter(card => isMinionCard(card) && minionPower(card.defId) <= 3)
                    .map((card, index) => ({
                        id: `minion-${index}`,
                        label: cardLabel(card.defId),
                        value: { cardUid: card.uid, defId: card.defId },
                        displayMode: 'card' as const,
                    })),
            ],
            {
                sourceId: BABY,
                targetType: 'card',
                responseValidationMode: 'live',
                autoResolveIfSingle: false,
                continuationContext: { baseIndex: ctx.baseIndex },
            },
        )),
    };
}

function snazzyPenguin(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.cardUid);
    if (self?.metadata?.playedFrom !== 'deck') return { events: [] };
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
}

function disguisePenguin(ctx: AbilityContext): AbilityResult {
    const sourceBase = ctx.state.bases[ctx.baseIndex];
    const self = sourceBase?.minions.find(minion => minion.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };
    return {
        events: [
            cardToDeckBottom(ctx.cardUid, ctx.defId, self.owner, DISGUISE, ctx.now, {
                sourcePlayerId: ctx.playerId,
                sourceCardUid: ctx.cardUid,
                sourceDefId: DISGUISE,
                sourceControllerId: ctx.playerId,
                sourceBaseIndex: ctx.baseIndex,
            }),
            ...revealUntilMinionFromDeck({
                state: ctx.state,
                random: ctx.random,
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
                reason: DISGUISE,
                now: ctx.now,
            }).events,
        ],
    };
}

function surfingPenguin(ctx: AbilityContext): AbilityResult {
    const sourceBase = ctx.state.bases[ctx.baseIndex];
    if (!sourceBase) return { events: [] };
    const options: PromptOption<MinionMoveChoice>[] = sourceBase.minions.flatMap((minion) =>
        ctx.state.bases
            .map((base, toBaseIndex) => ({ base, toBaseIndex }))
            .filter(({ toBaseIndex }) => toBaseIndex !== ctx.baseIndex)
            .map(({ base, toBaseIndex }) => ({
                id: `${minion.uid}-${toBaseIndex}`,
                label: `${cardLabel(minion.defId)} → ${baseLabel(ctx.state, toBaseIndex)}`,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    fromBaseIndex: ctx.baseIndex,
                    toBaseIndex,
                    toBaseDefId: base.defId,
                },
                displayMode: 'card' as const,
            })),
    );
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionMoveChoice>(
        `${SURFING}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '冲浪企鹅：移动一个这里的随从到另一个基地',
        options,
        {
            sourceId: SURFING,
            targetType: 'minion',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function regurgitatingPenguin(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const revealed = player.deck.slice(0, 3);
    if (revealed.length === 0) return { events: [] };
    const actions = revealed.filter(isActionCard);
    if (actions.length === 0) {
        return {
            events: [
                inspectDeck(ctx.playerId, ctx.playerId, revealed.length, REGURGITATING, ctx.now),
                revealDeckTop(ctx.playerId, ctx.playerId, revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, REGURGITATING, ctx.now, ctx.playerId),
            ],
        };
    }
    const interaction = createSimpleChoice<CardChoice>(
        `${REGURGITATING}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '反刍企鹅：选择展示牌中的一张行动加入手牌',
        [
            createSkipOption('不拿行动', 'ui.skip_option') as PromptOption<CardChoice>,
            ...actions.map((card, index) => ({
                id: `action-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: REGURGITATING,
            targetType: 'card',
            responseValidationMode: 'snapshot',
            autoResolveIfSingle: false,
            continuationContext: { revealed: revealed.map(card => ({ uid: card.uid, defId: card.defId })) },
        },
    );
    return {
        events: [
            inspectDeck(ctx.playerId, ctx.playerId, revealed.length, REGURGITATING, ctx.now),
            revealDeckTop(ctx.playerId, ctx.playerId, revealed.map(card => ({ uid: card.uid, defId: card.defId })), revealed.length, REGURGITATING, ctx.now, ctx.playerId),
        ],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function secretMission(ctx: AbilityContext): AbilityResult {
    const hand = ctx.state.players[ctx.playerId]?.hand.filter(card => card.uid !== ctx.cardUid) ?? [];
    if (hand.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `penguins_secret_mission_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '秘密任务：选择任意数量手牌放到牌库底',
        [
            createSkipOption('不放牌', 'ui.skip_option') as PromptOption<CardChoice>,
            ...hand.map((card, index) => ({
                id: `hand-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'penguins_secret_mission',
            targetType: 'card',
            multi: { min: 0, max: hand.length },
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function wish(ctx: AbilityContext): AbilityResult {
    const baseIndex = targetBaseIndex(ctx);
    const titan = ctx.state.titans?.find(candidate =>
        candidate.defId === EMPEROR
        && candidate.controllerId === ctx.playerId
        && candidate.location.zone === 'setaside',
    );
    const ownMinions = ctx.state.bases[baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    const options: PromptOption<WishChoice>[] = [
        ...(titan ? [{
            id: 'titan',
            label: '打出企鹅帝皇到这里',
            labelKey: 'ui.penguins_wish_play_titan_option',
            value: { mode: 'titan' as const, baseIndex, baseDefId: ctx.state.bases[baseIndex]?.defId },
            displayMode: 'button' as const,
        }] : []),
        ...(ownMinions.length > 0 ? [{
            id: 'buff',
            label: '这里你的所有随从本回合 +1 力量',
            labelKey: 'ui.penguins_wish_buff_option',
            value: { mode: 'buff' as const, baseIndex, baseDefId: ctx.state.bases[baseIndex]?.defId },
            displayMode: 'button' as const,
        }] : []),
    ];
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<WishChoice>(
        `${WISH}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '渴望飞翔的工作：选择一个效果',
        options,
        {
            sourceId: WISH,
            targetType: 'generic',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function apart(ctx: AbilityContext): AbilityResult {
    const baseIndex = targetBaseIndex(ctx);
    const ownMinions = ctx.state.bases[baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
    if (ownMinions.length === 0) return { events: [] };
    const interaction = createSimpleChoice<ApartChoice>(
        `${APART}_${ctx.cardUid}_${ctx.now}`,
        ctx.playerId,
        '我不能区分他们：选择任意数量这里的己方随从洗回牌库',
        ownMinions.map((minion, index) => ({
            id: `minion-${index}`,
            label: cardLabel(minion.defId),
            value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex },
            displayMode: 'card' as const,
        })),
        {
            sourceId: APART,
            targetType: 'minion',
            multi: { min: 1, max: ownMinions.length },
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function underTheIce(ctx: AbilityContext): AbilityResult {
    return {
        events: revealTopAndPlayRandomMinion({
            state: ctx.state,
            random: ctx.random,
            playerId: ctx.playerId,
            baseIndex: targetBaseIndex(ctx),
            count: 5,
            reason: UNDER,
            now: ctx.now,
        }),
    };
}

function hasDeckPlayedMinion(ctx: TriggerContext, sourceId: string): boolean {
    return ctx.timing === 'onMinionPlayed'
        && ctx.baseIndex !== undefined
        && ctx.triggerMinion?.metadata?.playedFrom === 'deck'
        && ctx.triggerMinion.controller === ctx.playerId
        && ctx.sourceDefId === sourceId;
}

function pebbleGift(ctx: TriggerContext): SmashUpEvent[] {
    if (!hasDeckPlayedMinion(ctx, PEBBLE)) return [];
    return buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
}

function colony(ctx: BaseAbilityContext): BaseAbilityResult {
    if (ctx.minionUid === undefined || ctx.minionDefId === undefined) return { events: [] };
    if (ctx.baseIndex === undefined) return { events: [] };
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || ctx.playerId === undefined) return { events: [] };
    const played = base.minions.find(minion => minion.uid === ctx.minionUid);
    if (!played || played.controller !== ctx.playerId) return { events: [] };
    if (Number(played.metadata?.penguinsColonyExtraTriggeredTurn ?? -1) === ctx.state.turnNumber) return { events: [] };
    if ((ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) > 1) return { events: [] };
    return {
        events: [
            minionMetadataUpdated(ctx.minionUid, ctx.baseIndex, { penguinsColonyExtraTriggeredTurn: ctx.state.turnNumber }, COLONY, ctx.now),
            ...revealUntilMinionFromDeck({
                state: ctx.state,
                random: ctx.random!,
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
                reason: COLONY,
                now: ctx.now,
            }).events,
        ],
    };
}

function iceFloe(ctx: BaseAbilityContext): BaseAbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const ownMinions = base.minions.filter(minion => minion.controller === ctx.playerId);
    if (ownMinions.length === 0) return { events: [] };
    const interaction = createSimpleChoice<ApartChoice>(
        `${ICE_FLOE}_${ctx.playerId}_${ctx.now}`,
        ctx.playerId,
        '浮冰：选择一个这里的己方随从放到牌库底',
        [
            createSkipOption('不发动浮冰', 'ui.skip_option') as PromptOption<ApartChoice>,
            ...ownMinions.map((minion, index) => ({
                id: `minion-${index}`,
                label: cardLabel(minion.defId),
                value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex: ctx.baseIndex },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: ICE_FLOE,
            targetType: 'minion',
            responseValidationMode: 'live',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: ctx.matchState ? queueInteraction(ctx.matchState, interaction) : undefined };
}

function iceSlide(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || ctx.sourceDefId !== ICE_SLIDE) return [];
    const count = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId).length ?? 0;
    return buildStandardDrawEvents(ctx.state, ctx.playerId, count, ctx.random, ctx.now);
}

function leapingAboard(ctx: TriggerContext): TriggerResult {
    if (ctx.baseIndex === undefined || ctx.sourceDefId !== LEAPING) return { events: [] };
    const top = revealUntilMinionFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        baseIndex: ctx.baseIndex,
        reason: LEAPING,
        now: ctx.now,
    });
    if (!top.picked || !ctx.matchState) return { events: top.events };
    if (!isScoringSessionAwaitingDeferredResolution(ctx.matchState)) return { events: top.events };
    const targetBaseDefId = getDeferredReplacementBaseDefId(ctx.matchState);
    if (!targetBaseDefId) return { events: top.events };
    const pendingAction: PendingPostScoringAction = {
        kind: 'playMinionOnReplacementBase',
        playerId: ctx.playerId,
        cardUid: top.picked.uid,
        defId: top.picked.defId,
        ownerId: top.picked.owner,
        baseIndex: ctx.baseIndex,
        targetBaseDefId,
        power: minionPower(top.picked.defId),
    };
    return {
        events: top.events.filter(event => event.type !== SU_EVENTS.MINION_PLAYED),
        matchState: appendPendingPostScoringActions(ctx.matchState, [pendingAction]),
    };
}

function dancingPenguin(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || ctx.triggerMinionDefId === DANCING) return [];
    const player = ctx.state.players[ctx.playerId];
    const dancing = player?.hand.find(card => card.defId === DANCING);
    const played = ctx.triggerMinion;
    if (!player || !dancing || !played || played.controller !== ctx.playerId) return [];
    const play = playMinionEvent(ctx.state, ctx.playerId, dancing, ctx.baseIndex, DANCING, ctx.now);
    if (!play) return [];
    return [
        cardToDeckBottom(played.uid, played.defId, played.owner, DANCING, ctx.now, {
            sourcePlayerId: ctx.playerId,
            sourceCardUid: dancing.uid,
            sourceDefId: DANCING,
            sourceControllerId: ctx.playerId,
            sourceBaseIndex: ctx.baseIndex,
        }),
        {
            ...play,
            payload: {
                ...play.payload,
                fromDeck: undefined,
                consumesNormalLimit: false,
            },
        } as MinionPlayedEvent,
    ];
}

export function registerPenguinsAbilities(): void {
    registerAbility(SURFING, 'onPlay', surfingPenguin);
    registerAbility(COMMAND, 'onPlay', commandPenguin);
    registerAbility(DISGUISE, 'talent', disguisePenguin);
    registerAbility(SNAZZY, 'onPlay', snazzyPenguin);
    registerAbility(BABY, 'onPlay', babyPenguin);
    registerAbility(REGURGITATING, 'onPlay', regurgitatingPenguin);
    registerAbility('penguins_secret_mission', 'onPlay', secretMission);
    registerAbility(HATCHING, 'onPlay', playTopDeckMinionOnPlay);
    registerAbility(WISH, 'onPlay', wish);
    registerAbility(APART, 'onPlay', apart);
    registerAbility(UNDER, 'onPlay', underTheIce);

    registerTrigger(DANCING, 'onMinionPlayed', dancingPenguin, {
        optional: true,
        global: true,
        globalZones: ['hand'],
        playerContext: 'eventPlayer',
    });
    registerTrigger(PEBBLE, 'onMinionPlayed', pebbleGift, {
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger(ICE_SLIDE, 'afterScoring', iceSlide, {
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        perInstance: true,
    });
    registerTrigger(LEAPING, 'afterScoring', leapingAboard, {
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        perInstance: true,
    });

    registerBaseAbility(ICE_FLOE, 'onTurnStart', iceFloe, { mandatory: false });
    registerBaseAbility(COLONY, 'onMinionPlayed', colony, { mandatory: false });

    registerInteractionHandler(BABY, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const baseIndex = (data as { continuationContext?: { baseIndex?: number } } | undefined)?.continuationContext?.baseIndex;
        if (!selected?.cardUid || !selected.defId || baseIndex === undefined || selected.skip) return { state, events: [] };
        const card = state.core.players[playerId]?.hand.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        if (!card || !isMinionCard(card) || minionPower(card.defId) > 3) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: card.owner,
                    baseIndex,
                    baseDefId: state.core.bases[baseIndex]?.defId,
                    power: minionPower(card.defId),
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    });

    registerInteractionHandler(SURFING, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionMoveChoice | undefined;
        if (!selected?.minionUid || selected.toBaseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedMoveEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId,
                fromBaseIndex: selected.fromBaseIndex,
                toBaseIndex: selected.toBaseIndex,
                toBaseDefId: selected.toBaseDefId,
                reason: SURFING,
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: SURFING,
                sourceControllerId: playerId,
                sourceBaseIndex: selected.fromBaseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    registerInteractionHandler(REGURGITATING, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const revealed = ((data as { continuationContext?: { revealed?: Array<{ uid: string; defId: string }> } } | undefined)?.continuationContext?.revealed ?? []);
        const player = state.core.players[playerId];
        if (!player || selected?.skip) return { state, events: [] };
        const selectedUid = selected?.cardUid;
        const revealedUids = new Set(revealed.map(card => card.uid));
        const chosen = selectedUid ? player.deck.find(card => card.uid === selectedUid && revealedUids.has(card.uid) && isActionCard(card)) : undefined;
        const remaining = player.deck.filter(card => !revealedUids.has(card.uid) || card.uid === selectedUid);
        return {
            state,
            events: [
                ...(chosen ? [{
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [chosen.uid] },
                    timestamp,
                } as CardsDrawnEvent] : []),
                deckReordered(playerId, [
                    ...revealed
                        .filter(card => card.uid !== chosen?.uid)
                        .map(card => card.uid),
                    ...remaining.filter(card => card.uid !== chosen?.uid).map(card => card.uid),
                ], timestamp),
            ],
        };
    });

    registerInteractionHandler('penguins_secret_mission', (state, playerId, value, _data, random, timestamp) => {
        const selectedValues = Array.isArray(value) ? value as CardChoice[] : value ? [value as CardChoice] : [];
        const selected = selectedValues.filter(choice => choice.cardUid && !choice.skip);
        const player = state.core.players[playerId];
        if (!player || selected.length === 0) return { state, events: [] };
        const selectedCards = selected
            .map(choice => player.hand.find(card => card.uid === choice.cardUid && card.defId === choice.defId))
            .filter((card): card is CardInstance => card !== undefined);
        const drawn = player.deck.slice(0, selectedCards.length);
        const remainingDeck = player.deck.slice(drawn.length);
        const shuffledAfterDraw = random.shuffle([
            ...remainingDeck,
            ...selectedCards,
        ]);
        return {
            state,
            events: [
                ...selectedCards.map(card => cardToDeckBottom(card.uid, card.defId, card.owner, 'penguins_secret_mission', timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: 'penguins_secret_mission',
                    sourceControllerId: playerId,
                })),
                ...(drawn.length > 0 ? [{
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: drawn.length, cardUids: drawn.map(card => card.uid) },
                    timestamp,
                } as CardsDrawnEvent] : []),
                deckReordered(playerId, shuffledAfterDraw.map(card => card.uid), timestamp),
            ],
        };
    });

    registerInteractionHandler(WISH, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as WishChoice | undefined;
        if (!selected || selected.skip) return { state, events: [] };
        if (selected.mode === 'titan') {
            const titan = state.core.titans?.find(candidate =>
                candidate.defId === EMPEROR
                && candidate.controllerId === playerId
                && candidate.location.zone === 'setaside',
            );
            if (!titan) return { state, events: [] };
            return {
                state,
                events: [{
                    type: SU_EVENTS.TITAN_PLAYED,
                    payload: {
                        titanUid: titan.uid,
                        defId: titan.defId,
                        ownerId: titan.ownerId,
                        controllerId: playerId,
                        baseIndex: selected.baseIndex,
                        baseDefId: selected.baseDefId,
                        reason: WISH,
                    },
                    timestamp,
                } as TitanPlayedEvent],
            };
        }
        const base = state.core.bases[selected.baseIndex];
        return {
            state,
            events: base?.minions
                .filter(minion => minion.controller === playerId)
                .map(minion => addTempPower(minion.uid, selected.baseIndex, 1, WISH, timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: WISH,
                    sourceControllerId: playerId,
                    sourceBaseIndex: selected.baseIndex,
                })) ?? [],
        };
    });

    registerInteractionHandler(APART, (state, playerId, value, _data, random, timestamp) => {
        const selectedValues = Array.isArray(value) ? value as ApartChoice[] : value ? [value as ApartChoice] : [];
        const selected = selectedValues.filter(choice => choice.minionUid);
        if (selected.length === 0) return { state, events: [] };
        const baseIndex = selected[0].baseIndex;
        const returned = selected
            .map(choice => state.core.bases[choice.baseIndex]?.minions.find(minion => minion.uid === choice.minionUid && minion.controller === playerId))
            .filter((minion): minion is MinionOnBase => minion !== undefined);
        const player = state.core.players[playerId];
        if (!player || returned.length === 0) return { state, events: [] };
        const reshuffled = random.shuffle([
            ...player.deck,
            ...returned.map(minion => ({ uid: minion.uid, defId: minion.defId, type: 'minion' as const, owner: minion.owner })),
        ]);
        const playedEvents = Array.from({ length: returned.length }).flatMap(() =>
            revealUntilMinionFromDeck({
                state: {
                    ...state.core,
                    players: {
                        ...state.core.players,
                        [playerId]: {
                            ...player,
                            deck: reshuffled,
                        },
                    },
                },
                random,
                playerId,
                baseIndex,
                reason: APART,
                now: timestamp,
            }).events,
        );
        return {
            state,
            events: [
                ...returned.map(minion => cardToDeckBottom(minion.uid, minion.defId, minion.owner, APART, timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: APART,
                    sourceControllerId: playerId,
                    sourceBaseIndex: baseIndex,
                })),
                deckReordered(playerId, reshuffled.map(card => card.uid), timestamp),
                ...playedEvents,
            ],
        };
    });

    registerInteractionHandler(ICE_FLOE, (state, playerId, value, _data, random, timestamp) => {
        const selected = value as ApartChoice | undefined;
        if (!selected?.minionUid || selected.skip) return { state, events: [] };
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate => candidate.uid === selected.minionUid && candidate.controller === playerId);
        if (!minion) return { state, events: [] };
        return {
            state,
            events: [
                cardToDeckBottom(minion.uid, minion.defId, minion.owner, ICE_FLOE, timestamp, {
                    sourcePlayerId: playerId,
                    sourceDefId: ICE_FLOE,
                    sourceControllerId: playerId,
                    sourceBaseIndex: selected.baseIndex,
                }),
                ...revealUntilMinionFromDeck({
                    state: state.core,
                    random,
                    playerId,
                    baseIndex: selected.baseIndex,
                    reason: ICE_FLOE,
                    now: timestamp,
                }).events,
            ],
        };
    });
}
