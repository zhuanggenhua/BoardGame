import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerSimpleAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    findMinionOnBases,
    getMinionPower,
    grantContextualExtraAction,
    grantContextualExtraMinion,
    inspectDeck,
} from '../domain/abilityHelpers';
import { registerBaseAbility, type BaseAbilityContext } from '../domain/baseAbilities';
import { registerTrigger, type TriggerContext } from '../domain/ongoingEffects';
import { registerPowerModifier } from '../domain/ongoingModifiers';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import type {
    BaseMetadataUpdatedEvent,
    CardInstance,
    CardToDeckTopEvent,
    CardTransferredEvent,
    DeckReorderedEvent,
    MinionPlayedEvent,
    MinionOnBase,
    SmashUpCore,
    SmashUpEvent,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type CardZone = 'hand' | 'deck' | 'discard';
type CardChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    zone?: CardZone;
    mode?: 'toHand' | 'play';
    baseIndex?: number;
    skip?: boolean;
};
type MinionChoice = { minionUid?: string; defId?: string; minionDefId?: string; baseIndex?: number; skip?: boolean };
type BaseChoice = { baseIndex?: number; skip?: boolean };
type PairChoice = { minionUids?: [string, string]; minionDefIds?: [string, string]; baseIndex?: number; skip?: boolean };
type WoodsmanChoice = {
    mode?: 'destroyAction' | 'destroyWolf';
    actionUid?: string;
    minionUid?: string;
    defId?: string;
    minionDefId?: string;
    ownerId?: PlayerId;
    baseIndex?: number;
};

type BreadcrumbsContext = {
    selectedMinions: Array<{ minionUid: string; minionDefId: string }>;
    fromBaseIndex: number;
};

type BaseCardContext = {
    baseIndex: number;
    baseInstanceId?: string;
};

type PlayDiscardMinionContext = {
    baseIndex: number;
    sourceCardUid?: string;
    sourceDefId: string;
    sourceOwnerId?: PlayerId;
};

type PlayDeckMinionContext = {
    baseIndex: number;
    sourceDefId: string;
};

const GRIMMS_NAMED_MINION_REFERENCES: Record<string, string[]> = {
    grimms_fairy_tales_hansel: ['grimms_fairy_tales_gretel'],
    grimms_fairy_tales_gretel: ['grimms_fairy_tales_hansel'],
    grimms_fairy_tales_the_other_snow_white: ['grimms_fairy_tales_rose_red'],
    grimms_fairy_tales_rose_red: ['grimms_fairy_tales_the_other_snow_white'],
    grimms_fairy_tales_red_riding_hood: ['grimms_fairy_tales_big_bad_wolf'],
    grimms_fairy_tales_big_bad_wolf: ['grimms_fairy_tales_red_riding_hood'],
    grimms_fairy_tales_prince_charming: ['grimms_fairy_tales_charming_princess'],
    grimms_fairy_tales_charming_princess: ['grimms_fairy_tales_prince_charming'],
};

function cardLabel(defId: string): string {
    return getCardDef(defId)?.name ?? defId;
}

function baseLabel(core: SmashUpCore, baseIndex: number): string {
    const defId = core.bases[baseIndex]?.defId;
    return getBaseDef(defId ?? '')?.name ?? `基地 ${baseIndex + 1}`;
}

function cardToDeckTop(card: CardInstance, ownerId: PlayerId, reason: string, now: number, sourcePlayerId: PlayerId): CardToDeckTopEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            ownerId,
            reason,
            sourcePlayerId,
            sourceDefId: reason,
            sourceControllerId: sourcePlayerId,
        },
        timestamp: now,
    };
}

function cardTransferredToSelf(card: CardInstance, playerId: PlayerId, reason: string, now: number): CardTransferredEvent {
    return {
        type: SU_EVENTS.CARD_TRANSFERRED,
        payload: {
            cardUid: card.uid,
            defId: card.defId,
            fromPlayerId: playerId,
            toPlayerId: playerId,
            ownerId: card.owner,
            reason,
        },
        timestamp: now,
    };
}

function playDiscardMinionEvent(
    core: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
): MinionPlayedEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            baseIndex,
            baseDefId: core.bases[baseIndex]?.defId,
            power: getMinionLikePower(card.defId) ?? 0,
            fromDiscard: true,
            consumesNormalLimit: false,
            discardPlaySourceId: reason,
        },
        timestamp: now,
    };
}

function playMinionFromZoneEvent(
    core: SmashUpCore,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    reason: string,
    now: number,
    zone: CardZone,
): MinionPlayedEvent {
    return {
        type: SU_EVENTS.MINION_PLAYED,
        payload: {
            playerId,
            cardUid: card.uid,
            defId: card.defId,
            ownerId: card.owner,
            baseIndex,
            baseDefId: core.bases[baseIndex]?.defId,
            power: getMinionLikePower(card.defId) ?? 0,
            ...(zone === 'deck' ? { fromDeck: true } : {}),
            ...(zone === 'discard' ? { fromDiscard: true } : {}),
            consumesNormalLimit: false,
            discardPlaySourceId: reason,
        },
        timestamp: now,
    };
}

function baseMetadataUpdated(
    core: SmashUpCore,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    now: number,
): BaseMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.BASE_METADATA_UPDATED,
        payload: {
            baseIndex,
            baseInstanceId: core.bases[baseIndex]?.instanceId,
            metadataUpdate,
            reason,
        },
        timestamp: now,
    };
}

function isMinionCard(card: CardInstance): boolean {
    return getCardDef(card.defId)?.type === 'minion';
}

function isActionCard(card: CardInstance): boolean {
    return getCardDef(card.defId)?.type === 'action';
}

function deckSearchToTop(
    ctx: AbilityContext,
    sourceId: string,
    title: string,
    predicate: (card: CardInstance) => boolean,
    titleKey: string,
): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const candidates = player.deck.filter(predicate);
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        title,
        candidates.map((card, index) => ({
            id: `${sourceId}_${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
            displayMode: 'card' as const,
        })),
        {
            sourceId,
            targetType: 'deck',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey,
        },
    );
    return {
        events: [inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, sourceId, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function fairyGodmothersBlessing(ctx: AbilityContext): AbilityResult {
    return deckSearchToTop(
        ctx,
        'grimms_fairy_tales_fairy_godmothers_blessing',
        '仙女教母的祝福：选择牌库中的一个随从放到牌库顶',
        isMinionCard,
        'ui.grimms_fairy_tales_fairy_godmothers_blessing_title',
    );
}

function basketOfGoodies(ctx: AbilityContext): AbilityResult {
    return deckSearchToTop(
        ctx,
        'grimms_fairy_tales_basket_of_goodies',
        '一篮子好东西：选择牌库中的一个行动放到牌库顶',
        isActionCard,
        'ui.grimms_fairy_tales_basket_of_goodies_title',
    );
}

function rumpelstiltskin(ctx: AbilityContext): AbilityResult {
    return deckSearchToTop(
        ctx,
        'grimms_fairy_tales_rumpelstiltskin',
        '侏儒怪：选择牌库中的一张牌放到牌库顶',
        () => true,
        'ui.grimms_fairy_tales_rumpelstiltskin_title',
    );
}

function anotherStory(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.discard.length === 0) return { events: [] };
    const options = [
        createSkipOption('不洗回牌库', 'ui.grimms_fairy_tales_skip_shuffle_option'),
        ...player.discard.map((card, index) => ({
            id: `discard-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner } satisfies CardChoice,
            displayMode: 'card' as const,
        })),
    ];
    const interaction = createSimpleChoice<CardChoice>(
        `grimms_fairy_tales_another_story_${ctx.now}`,
        ctx.playerId,
        '另一个故事：选择至多三张弃牌洗回牌库',
        options,
        {
            sourceId: 'grimms_fairy_tales_another_story',
            targetType: 'discard',
            multi: { min: 0, max: Math.min(3, player.discard.length) },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function breadcrumbs(ctx: AbilityContext): AbilityResult {
    if (ctx.state.bases.length <= 1) return { events: [] };
    const candidates = ctx.state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => minion.controller === ctx.playerId)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${cardLabel(minion.defId)} @ ${baseLabel(ctx.state, baseIndex)}`,
            }))
    ));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `grimms_fairy_tales_breadcrumbs_${ctx.now}`,
        ctx.playerId,
        '面包屑：选择至多两个同一基地上的你的随从',
        [
            createSkipOption('不移动随从', 'ui.grimms_fairy_tales_skip_move_minion_option'),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'grimms_fairy_tales_breadcrumbs',
                sourceKind: 'action',
                semanticRole: 'reference',
                effectType: 'move',
            }),
        ],
        {
            sourceId: 'grimms_fairy_tales_breadcrumbs',
            targetType: 'minion',
            multi: { min: 0, max: Math.min(2, candidates.length) },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function mouseBirdAndSausage(ctx: AbilityContext): AbilityResult {
    const candidates = ctx.state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => Boolean(getCardDef(minion.defId)?.faction))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${cardLabel(minion.defId)} @ ${baseLabel(ctx.state, baseIndex)}`,
            }))
    ));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `grimms_fairy_tales_mouse_bird_and_sausage_${ctx.now}`,
        ctx.playerId,
        '老鼠、鸟和香肠：选择同一基地同派系的至多两个随从',
        [
            createSkipOption('不加力量', 'ui.grimms_fairy_tales_skip_power_option'),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'grimms_fairy_tales_mouse_bird_and_sausage',
                sourceKind: 'action',
                semanticRole: 'reference',
                effectType: 'buff',
            }),
        ],
        {
            sourceId: 'grimms_fairy_tales_mouse_bird_and_sausage',
            targetType: 'minion',
            multi: { min: 0, max: Math.min(2, candidates.length) },
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function collectBaseOngoingActionTargets(core: SmashUpCore): WoodsmanChoice[] {
    return core.bases.flatMap((base, baseIndex) => (
        base.ongoingActions.map(action => ({
            mode: 'destroyAction' as const,
            actionUid: action.uid,
            defId: action.defId,
            ownerId: action.ownerId,
            baseIndex,
        }))
    ));
}

function collectBigBadWolfTargets(core: SmashUpCore): WoodsmanChoice[] {
    return core.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => minion.defId === 'grimms_fairy_tales_big_bad_wolf')
            .map(minion => ({
                mode: 'destroyWolf' as const,
                minionUid: minion.uid,
                defId: minion.defId,
                minionDefId: minion.defId,
                ownerId: minion.owner,
                baseIndex,
            }))
    ));
}

function theWoodsmansAxe(ctx: AbilityContext): AbilityResult {
    const actionTargets = collectBaseOngoingActionTargets(ctx.state);
    const wolfTargets = collectBigBadWolfTargets(ctx.state)
        .filter(() => ctx.state.players[ctx.playerId]?.deck.some(isMinionCard));
    const options = [
        ...actionTargets.map((target, index) => ({
            id: `action-${index}`,
            label: `${cardLabel(target.defId ?? '')} @ ${baseLabel(ctx.state, target.baseIndex ?? 0)}：销毁并额外打出行动`,
            value: target,
            displayMode: 'card' as const,
        })),
        ...wolfTargets.map((target, index) => ({
            id: `wolf-${index}`,
            label: `${cardLabel(target.defId ?? '')} @ ${baseLabel(ctx.state, target.baseIndex ?? 0)}：销毁并从牌库额外打出随从`,
            value: target,
            displayMode: 'card' as const,
        })),
    ];
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<WoodsmanChoice>(
        `grimms_fairy_tales_the_woodsmans_axe_${ctx.now}`,
        ctx.playerId,
        '樵夫的斧子：选择要销毁的基地行动或大灰狼',
        options,
        {
            sourceId: 'grimms_fairy_tales_the_woodsmans_axe',
            targetType: 'card',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function playerHasOwnedMinionDef(core: SmashUpCore, playerId: PlayerId, defId: string): boolean {
    const player = core.players[playerId];
    return Boolean(
        player?.hand.some(card => card.owner === playerId && card.defId === defId)
        || player?.deck.some(card => card.owner === playerId && card.defId === defId)
        || player?.discard.some(card => card.owner === playerId && card.defId === defId)
        || core.bases.some(base => base.minions.some(minion => minion.owner === playerId && minion.defId === defId)),
    );
}

function getBaseOngoingActionControllerId(action: { ownerId: PlayerId; metadata?: Record<string, unknown> }): PlayerId {
    return (action.metadata?.sourceControllerId as PlayerId | undefined) ?? action.ownerId;
}

function activeGrimmsBlessingHasName(core: SmashUpCore, baseIndex: number, playerId: PlayerId, defId: string): boolean {
    const base = core.bases[baseIndex];
    if (!base || !playerHasOwnedMinionDef(core, playerId, defId)) return false;
    const ownMinionsHere = base.minions.filter(minion => minion.controller === playerId).length;
    if (ownMinionsHere < 2) return false;
    return base.ongoingActions.some(action =>
        action.defId === 'grimms_fairy_tales_grimms_blessing'
        && getBaseOngoingActionControllerId(action) === playerId);
}

function hasNamedMinionAtBase(core: SmashUpCore, baseIndex: number, controller: PlayerId, namedDefId: string): boolean {
    return Boolean(
        core.bases[baseIndex]?.minions.some(minion =>
            minion.controller === controller && minion.defId === namedDefId)
        || activeGrimmsBlessingHasName(core, baseIndex, controller, namedDefId),
    );
}

function findMinionChoice(core: SmashUpCore, choice: MinionChoice | undefined): { minion: MinionOnBase; baseIndex: number } | undefined {
    if (!choice?.minionUid || choice.baseIndex === undefined) return undefined;
    const minion = core.bases[choice.baseIndex]?.minions.find(candidate =>
        candidate.uid === choice.minionUid && candidate.defId === (choice.defId ?? choice.minionDefId));
    return minion ? { minion, baseIndex: choice.baseIndex } : undefined;
}

function getTeamworkReferencedDefIds(minionDefId: string): string[] {
    return GRIMMS_NAMED_MINION_REFERENCES[minionDefId] ?? [];
}

function collectTeamworkSearchCards(core: SmashUpCore, playerId: PlayerId, selectedMinionDefId: string): Array<CardInstance & { zone: CardZone }> {
    const references = new Set(getTeamworkReferencedDefIds(selectedMinionDefId));
    if (references.size === 0) return [];
    const player = core.players[playerId];
    if (!player) return [];
    return [
        ...player.hand.map(card => ({ ...card, zone: 'hand' as const })),
        ...player.deck.map(card => ({ ...card, zone: 'deck' as const })),
        ...player.discard.map(card => ({ ...card, zone: 'discard' as const })),
    ].filter(card => references.has(card.defId) && getMinionLikePower(card.defId) !== undefined);
}

function buildTeamworkCardOptions(core: SmashUpCore, cards: Array<CardInstance & { zone: CardZone }>) {
    const playBases = core.bases.map((_base, baseIndex) => ({ baseIndex, label: baseLabel(core, baseIndex) }));
    return cards.flatMap((card, index) => {
        const zoneLabel = card.zone === 'hand' ? '手牌' : card.zone === 'deck' ? '牌库' : '弃牌堆';
        const handOption = card.zone === 'hand'
            ? []
            : [{
                id: `card-${index}-hand`,
                label: `${cardLabel(card.defId)}（${zoneLabel}）：加入手牌`,
                value: {
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: card.owner,
                    zone: card.zone,
                    mode: 'toHand' as const,
                },
                displayMode: 'card' as const,
            }];
        const playOptions = playBases.map(base => ({
            id: `card-${index}-play-${base.baseIndex}`,
            label: `${cardLabel(card.defId)}（${zoneLabel}）：额外打到${base.label}`,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                zone: card.zone,
                mode: 'play' as const,
                baseIndex: base.baseIndex,
            },
            displayMode: 'card' as const,
        }));
        return [...handOption, ...playOptions];
    });
}

function teamwork(ctx: AbilityContext): AbilityResult {
    const candidates = ctx.state.bases.flatMap((base, baseIndex) => (
        base.minions
            .filter(minion => collectTeamworkSearchCards(ctx.state, ctx.playerId, minion.defId).length > 0)
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${cardLabel(minion.defId)} @ ${baseLabel(ctx.state, baseIndex)}`,
            }))
    ));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `grimms_fairy_tales_teamwork_${ctx.now}`,
        ctx.playerId,
        '团队合作：选择一个场上的随从',
        buildMinionTargetOptions(candidates, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'grimms_fairy_tales_teamwork',
            sourceKind: 'action',
            semanticRole: 'reference',
            effectType: 'affect',
        }),
        {
            sourceId: 'grimms_fairy_tales_teamwork',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function princeCharming(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!live || live.minion.controller !== ctx.playerId) return { events: [] };
    const hasPrincess = hasNamedMinionAtBase(ctx.state, live.baseIndex, ctx.playerId, 'grimms_fairy_tales_charming_princess');
    return hasPrincess
        ? { events: [grantContextualExtraAction(ctx, 'grimms_fairy_tales_prince_charming')] }
        : { events: [] };
}

function charmingPrincess(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!live || live.minion.controller !== ctx.playerId) return { events: [] };
    const hasPrince = hasNamedMinionAtBase(ctx.state, live.baseIndex, ctx.playerId, 'grimms_fairy_tales_prince_charming');
    return hasPrince
        ? { events: [grantContextualExtraMinion(ctx, 'grimms_fairy_tales_charming_princess', live.baseIndex)] }
        : { events: [] };
}

function bigBadWolf(ctx: AbilityContext): AbilityResult {
    const live = findMinionOnBases(ctx.state, ctx.cardUid);
    const baseIndex = live?.baseIndex ?? ctx.baseIndex;
    const redRidingHoodInPlay = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.defId === 'grimms_fairy_tales_red_riding_hood'));
    if (redRidingHoodInPlay) return { events: [] };
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const candidates = base.minions
        .filter(minion => getMinionPower(ctx.state, minion, baseIndex) <= 4)
        .map(minion => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: cardLabel(minion.defId),
        }));
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<MinionChoice>(
        `grimms_fairy_tales_big_bad_wolf_${ctx.now}`,
        ctx.playerId,
        '大灰狼：可以消灭这里一个力量 4 或以下的随从',
        [
            createSkipOption('不消灭随从', 'ui.grimms_fairy_tales_skip_destroy_minion_option'),
            ...buildMinionTargetOptions(candidates, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: 'grimms_fairy_tales_big_bad_wolf',
                sourceKind: 'nonAction',
                effectType: 'destroy',
            }),
        ],
        {
            sourceId: 'grimms_fairy_tales_big_bad_wolf',
            targetType: 'minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildDiscardMinionOptions(core: SmashUpCore, playerId: PlayerId, excludedCardUid?: string) {
    return (core.players[playerId]?.discard ?? [])
        .filter(card => card.uid !== excludedCardUid && getMinionLikePower(card.defId) !== undefined)
        .map((card, index) => ({
            id: `discard-minion-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner } satisfies CardChoice,
            displayMode: 'card' as const,
        }));
}

function bigBadWolfDestroyed(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceControllerId || ctx.baseIndex === undefined) return { events: [] };
    if (!ctx.sourceCardUid || ctx.triggerMinionUid !== ctx.sourceCardUid) return { events: [] };
    const options = buildDiscardMinionOptions(ctx.state, ctx.sourceControllerId, ctx.sourceCardUid);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `grimms_fairy_tales_big_bad_wolf_destroyed_${ctx.now}`,
        ctx.sourceControllerId,
        '大灰狼：从弃牌堆额外打出另一个随从到这里',
        options,
        {
            sourceId: 'grimms_fairy_tales_big_bad_wolf_destroyed',
            targetType: 'discard_minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: PlayDiscardMinionContext }).continuationContext = {
        baseIndex: ctx.baseIndex,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'grimms_fairy_tales_big_bad_wolf',
        sourceOwnerId: ctx.sourceOwnerPlayerId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function frogPrinceTrigger(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceControllerId || ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid) {
        return { events: [] };
    }
    if (ctx.triggerMinionUid === ctx.sourceCardUid || ctx.playerId !== ctx.sourceControllerId) return { events: [] };
    const options = buildDiscardMinionOptions(ctx.state, ctx.sourceControllerId);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `grimms_fairy_tales_the_frog_prince_${ctx.sourceCardUid}_${ctx.now}`,
        ctx.sourceControllerId,
        '青蛙王子：可以将其洗入牌库，从弃牌堆额外打出一个随从到这里',
        [createSkipOption('不使用青蛙王子', 'ui.grimms_fairy_tales_skip_frog_prince_option'), ...options],
        {
            sourceId: 'grimms_fairy_tales_the_frog_prince',
            targetType: 'discard_minion',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: PlayDiscardMinionContext }).continuationContext = {
        baseIndex: ctx.sourceBaseIndex,
        sourceCardUid: ctx.sourceCardUid,
        sourceDefId: 'grimms_fairy_tales_the_frog_prince',
        sourceOwnerId: ctx.sourceOwnerPlayerId,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function sameBaseFaction(minions: Array<{ minion: MinionOnBase; baseIndex: number }>): boolean {
    if (minions.length === 0) return false;
    const firstFaction = getCardDef(minions[0].minion.defId)?.faction;
    if (!firstFaction) return false;
    return minions.every(entry =>
        entry.baseIndex === minions[0].baseIndex
        && getCardDef(entry.minion.defId)?.faction === firstFaction);
}

function findSelectedMinions(core: SmashUpCore, choices: MinionChoice[]): Array<{ minion: MinionOnBase; baseIndex: number }> {
    const selectedUids = new Set(choices.map(choice => choice.minionUid).filter((uid): uid is string => Boolean(uid)));
    const result: Array<{ minion: MinionOnBase; baseIndex: number }> = [];
    for (const [baseIndex, base] of core.bases.entries()) {
        for (const minion of base.minions) {
            if (selectedUids.has(minion.uid)) result.push({ minion, baseIndex });
        }
    }
    return result;
}

function hasCounterpartAtBase(core: SmashUpCore, baseIndex: number, controller: PlayerId, counterpartDefId: string): boolean {
    return hasNamedMinionAtBase(core, baseIndex, controller, counterpartDefId);
}

function redRidingHoodModifier(ctx: { state: SmashUpCore; base: { minions: MinionOnBase[] }; minion: MinionOnBase }): number {
    const wolfInPlay = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.defId === 'grimms_fairy_tales_big_bad_wolf'));
    if (wolfInPlay) return 0;
    const hoodHere = ctx.base.minions.some(minion =>
        minion.defId === 'grimms_fairy_tales_red_riding_hood'
        && minion.controller === ctx.minion.controller);
    return hoodHere ? 1 : 0;
}

function gingerbreadHouse(ctx: BaseAbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base || !ctx.matchState) return { events: [] };
    const own = base.minions.filter(minion => minion.controller === ctx.playerId);
    const options: Array<{
        id: string;
        label: string;
        value: PairChoice;
        displayMode: 'button';
    }> = [];
    for (let i = 0; i < own.length; i += 1) {
        for (let j = i + 1; j < own.length; j += 1) {
            if (getMinionPower(ctx.state, own[i], ctx.baseIndex) !== getMinionPower(ctx.state, own[j], ctx.baseIndex)) continue;
            options.push({
                id: `pair-${own[i].uid}-${own[j].uid}`,
                label: `${cardLabel(own[i].defId)} + ${cardLabel(own[j].defId)}`,
                value: {
                    minionUids: [own[i].uid, own[j].uid],
                    minionDefIds: [own[i].defId, own[j].defId],
                    baseIndex: ctx.baseIndex,
                },
                displayMode: 'button',
            });
        }
    }
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice<PairChoice>(
        `base_gingerbread_house_${ctx.playerId}_${ctx.now}`,
        ctx.playerId,
        '姜饼屋：选择两个同力量随从直到回合结束各 +2',
        [createSkipOption('不加力量', 'ui.grimms_fairy_tales_skip_power_option'), ...options],
        {
            sourceId: 'base_gingerbread_house',
            targetType: 'button',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function woodlandCottage(ctx: BaseAbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!player || !base || !ctx.matchState) return { events: [] };
    const usedKey = `woodlandCottageUsedTurn_${ctx.playerId}`;
    if (base.metadata?.[usedKey] === ctx.state.turnNumber) return { events: [] };
    const candidates = player.deck.filter(card => {
        const power = getMinionLikePower(card.defId);
        return power !== undefined && power <= 3;
    });
    if (candidates.length === 0) return { events: [] };
    const interaction = createSimpleChoice<CardChoice>(
        `base_woodland_cottage_${ctx.playerId}_${ctx.now}`,
        ctx.playerId,
        '林中小屋：可以从牌库将一个力量 3 或以下随从加入手牌',
        [
            createSkipOption('不检索随从', 'ui.grimms_fairy_tales_skip_search_minion_option'),
            ...candidates.map((card, index) => ({
                id: `deck-minion-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner },
                displayMode: 'card' as const,
            })),
        ],
        {
            sourceId: 'base_woodland_cottage',
            targetType: 'deck',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as typeof interaction.data & { continuationContext?: BaseCardContext }).continuationContext = {
        baseIndex: ctx.baseIndex,
        baseInstanceId: base.instanceId,
    };
    return {
        events: [inspectDeck(ctx.playerId, ctx.playerId, player.deck.length, 'base_woodland_cottage', ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

export function registerGrimmsFairyTalesAbilities(): void {
    registerSimpleAbility('grimms_fairy_tales_fairy_godmothers_blessing', 'onPlay', fairyGodmothersBlessing);
    registerSimpleAbility('grimms_fairy_tales_another_story', 'onPlay', anotherStory);
    registerSimpleAbility('grimms_fairy_tales_breadcrumbs', 'onPlay', breadcrumbs);
    registerSimpleAbility('grimms_fairy_tales_mouse_bird_and_sausage', 'onPlay', mouseBirdAndSausage);
    registerSimpleAbility('grimms_fairy_tales_the_woodsmans_axe', 'onPlay', theWoodsmansAxe);
    registerSimpleAbility('grimms_fairy_tales_teamwork', 'onPlay', teamwork);
    registerSimpleAbility('grimms_fairy_tales_basket_of_goodies', 'onPlay', basketOfGoodies);
    registerSimpleAbility('grimms_fairy_tales_big_bad_wolf', 'onPlay', bigBadWolf);
    registerSimpleAbility('grimms_fairy_tales_rumpelstiltskin', 'onPlay', rumpelstiltskin);
    registerSimpleAbility('grimms_fairy_tales_prince_charming', 'talent', princeCharming);
    registerSimpleAbility('grimms_fairy_tales_charming_princess', 'talent', charmingPrincess);

    registerPowerModifier('grimms_fairy_tales_hansel', (ctx) => (
        ctx.minion.defId === 'grimms_fairy_tales_hansel'
        && hasCounterpartAtBase(ctx.state, ctx.baseIndex, ctx.minion.controller, 'grimms_fairy_tales_gretel')
            ? 2
            : 0
    ), { variantPolicy: 'baseOnly' });
    registerPowerModifier('grimms_fairy_tales_gretel', (ctx) => (
        ctx.minion.defId === 'grimms_fairy_tales_gretel'
        && hasCounterpartAtBase(ctx.state, ctx.baseIndex, ctx.minion.controller, 'grimms_fairy_tales_hansel')
            ? 2
            : 0
    ), { variantPolicy: 'baseOnly' });
    registerPowerModifier('grimms_fairy_tales_the_other_snow_white', (ctx) => (
        ctx.minion.defId === 'grimms_fairy_tales_the_other_snow_white'
        && hasCounterpartAtBase(ctx.state, ctx.baseIndex, ctx.minion.controller, 'grimms_fairy_tales_rose_red')
            ? 2
            : 0
    ), { variantPolicy: 'baseOnly' });
    registerPowerModifier('grimms_fairy_tales_rose_red', (ctx) => (
        ctx.minion.defId === 'grimms_fairy_tales_rose_red'
        && hasCounterpartAtBase(ctx.state, ctx.baseIndex, ctx.minion.controller, 'grimms_fairy_tales_the_other_snow_white')
            ? 2
            : 0
    ), { variantPolicy: 'baseOnly' });
    registerPowerModifier('grimms_fairy_tales_red_riding_hood', redRidingHoodModifier, { variantPolicy: 'baseOnly' });

    registerBaseAbility('base_gingerbread_house', 'beforeScoring', gingerbreadHouse, {
        mandatory: false,
        canTrigger: ctx => {
            const own = ctx.state.bases[ctx.baseIndex]?.minions.filter(minion => minion.controller === ctx.playerId) ?? [];
            return own.some((left, leftIndex) => own.some((right, rightIndex) =>
                rightIndex > leftIndex
                && getMinionPower(ctx.state, left, ctx.baseIndex) === getMinionPower(ctx.state, right, ctx.baseIndex)));
        },
    });
    registerBaseAbility('base_woodland_cottage', 'onMinionPlayed', woodlandCottage, {
        mandatory: false,
        canTrigger: ctx => {
            const base = ctx.state.bases[ctx.baseIndex];
            const usedKey = `woodlandCottageUsedTurn_${ctx.playerId}`;
            const player = ctx.state.players[ctx.playerId];
            return Boolean(
                player
                && base
                && base.metadata?.[usedKey] !== ctx.state.turnNumber
                && player.deck.some(card => {
                    const power = getMinionLikePower(card.defId);
                    return power !== undefined && power <= 3;
                }),
            );
        },
    });

    registerTrigger('grimms_fairy_tales_big_bad_wolf', 'onMinionDestroyed', bigBadWolfDestroyed, {
        perInstance: true,
        playerContext: 'sourceController',
        baseScoped: false,
        canTrigger: ctx => ctx.triggerMinionUid === ctx.sourceCardUid,
    });
    registerTrigger('grimms_fairy_tales_the_frog_prince', 'onMinionPlayed', frogPrinceTrigger, {
        perInstance: true,
        optional: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: ctx => (
            ctx.triggerMinionUid !== ctx.sourceCardUid
            && ctx.playerId === ctx.sourceControllerId
            && (ctx.state.players[ctx.sourceControllerId]?.discard ?? [])
                .some(card => getMinionLikePower(card.defId) !== undefined)
        ),
    });
}

function findPlayerZoneCard(core: SmashUpCore, playerId: PlayerId, selected: CardChoice | undefined): CardInstance | undefined {
    if (!selected?.cardUid || !selected.defId || !selected.zone) return undefined;
    const player = core.players[playerId];
    if (!player) return undefined;
    const zoneCards = selected.zone === 'hand'
        ? player.hand
        : selected.zone === 'deck'
            ? player.deck
            : player.discard;
    return zoneCards.find(card => card.uid === selected.cardUid && card.defId === selected.defId);
}
export function registerGrimmsFairyTalesInteractionHandlers(): void {
    const topDeckSources = new Set([
        'grimms_fairy_tales_fairy_godmothers_blessing',
        'grimms_fairy_tales_basket_of_goodies',
        'grimms_fairy_tales_rumpelstiltskin',
    ]);

    for (const sourceId of topDeckSources) {
        registerInteractionHandler(sourceId, (state, playerId, value, _data, _random, timestamp) => {
            const selected = value as CardChoice | undefined;
            if (!selected?.cardUid || !selected.defId) return { state, events: [] };
            const card = state.core.players[playerId]?.deck.find(candidate =>
                candidate.uid === selected.cardUid && candidate.defId === selected.defId);
            if (!card) return { state, events: [] };
            return { state, events: [cardToDeckTop(card, card.owner, sourceId, timestamp, playerId)] };
        });
    }


    registerInteractionHandler('grimms_fairy_tales_the_woodsmans_axe', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as WoodsmanChoice | undefined;
        if (!selected?.mode || selected.baseIndex === undefined || !selected.defId) return { state, events: [] };
        if (selected.mode === 'destroyAction') {
            if (!selected.actionUid) return { state, events: [] };
            const detachEvents = buildValidatedOngoingDetachEvents(state, {
                cardUid: selected.actionUid,
                defId: selected.defId,
                ownerId: selected.ownerId,
                expectedLocation: 'base',
                reason: 'grimms_fairy_tales_the_woodsmans_axe',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'grimms_fairy_tales_the_woodsmans_axe',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
            });
            if (detachEvents.length === 0) return { state, events: [] };
            return {
                state,
                events: [
                    ...detachEvents,
                    grantContextualExtraAction({ playerId, now: timestamp, matchState: state }, 'grimms_fairy_tales_the_woodsmans_axe'),
                ],
            };
        }

        if (!selected.minionUid || selected.minionDefId !== 'grimms_fairy_tales_big_bad_wolf') return { state, events: [] };
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.minionDefId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: playerId,
            reason: 'grimms_fairy_tales_the_woodsmans_axe',
            now: timestamp,
            sourcePlayerId: playerId,
            sourceDefId: 'grimms_fairy_tales_the_woodsmans_axe',
            sourceControllerId: playerId,
            sourceBaseIndex: selected.baseIndex,
            sourceKind: 'action',
        });
        if (destroyEvents.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        const candidates = player?.deck.filter(isMinionCard) ?? [];
        if (!player || candidates.length === 0) return { state, events: destroyEvents };
        const interaction = createSimpleChoice<CardChoice>(
            `grimms_fairy_tales_the_woodsmans_axe_deck_${timestamp}`,
            playerId,
            '樵夫的斧子：从牌库选择一个随从额外打到大灰狼所在基地',
            candidates.map((card, index) => ({
                id: `deck-minion-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId, ownerId: card.owner, zone: 'deck' as const, mode: 'play' as const },
                displayMode: 'card' as const,
            })),
            {
                sourceId: 'grimms_fairy_tales_the_woodsmans_axe_deck',
                targetType: 'deck',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        (interaction.data as typeof interaction.data & { continuationContext?: PlayDeckMinionContext }).continuationContext = {
            baseIndex: selected.baseIndex,
            sourceDefId: 'grimms_fairy_tales_the_woodsmans_axe',
        };
        return {
            state: queueInteraction(state, interaction),
            events: [
                ...destroyEvents,
                inspectDeck(playerId, playerId, player.deck.length, 'grimms_fairy_tales_the_woodsmans_axe', timestamp),
            ],
        };
    });

    registerInteractionHandler('grimms_fairy_tales_the_woodsmans_axe_deck', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const context = (data as { continuationContext?: PlayDeckMinionContext } | undefined)?.continuationContext;
        if (!context) return { state, events: [] };
        const card = findPlayerZoneCard(state.core, playerId, selected ? { ...selected, zone: 'deck' } : undefined);
        if (!card || getMinionLikePower(card.defId) === undefined || !state.core.bases[context.baseIndex]) {
            return { state, events: [] };
        }
        return {
            state,
            events: [playMinionFromZoneEvent(state.core, playerId, card, context.baseIndex, context.sourceDefId, timestamp, 'deck')],
        };
    });

    registerInteractionHandler('grimms_fairy_tales_teamwork', (state, playerId, value, _data, _random, timestamp) => {
        const selected = findMinionChoice(state.core, value as MinionChoice | undefined);
        if (!selected) return { state, events: [] };
        const cards = collectTeamworkSearchCards(state.core, playerId, selected.minion.defId);
        const options = buildTeamworkCardOptions(state.core, cards);
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<CardChoice>(
            `grimms_fairy_tales_teamwork_card_${timestamp}`,
            playerId,
            `团队合作：选择与${cardLabel(selected.minion.defId)}能力文字匹配的随从`,
            options,
            {
                sourceId: 'grimms_fairy_tales_teamwork_card',
                targetType: 'card',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        const events = cards.some(card => card.zone === 'deck')
            ? [inspectDeck(playerId, playerId, state.core.players[playerId]?.deck.length ?? 0, 'grimms_fairy_tales_teamwork', timestamp)]
            : [];
        return { state: queueInteraction(state, interaction), events };
    });

    registerInteractionHandler('grimms_fairy_tales_teamwork_card', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        const card = findPlayerZoneCard(state.core, playerId, selected);
        if (!card || !selected?.zone || !selected.mode || getMinionLikePower(card.defId) === undefined) {
            return { state, events: [] };
        }
        if (selected.mode === 'toHand') {
            return selected.zone === 'hand'
                ? { state, events: [] }
                : { state, events: [cardTransferredToSelf(card, playerId, 'grimms_fairy_tales_teamwork', timestamp)] };
        }
        if (selected.baseIndex === undefined || !state.core.bases[selected.baseIndex]) return { state, events: [] };
        return {
            state,
            events: [playMinionFromZoneEvent(state.core, playerId, card, selected.baseIndex, 'grimms_fairy_tales_teamwork', timestamp, selected.zone)],
        };
    });
    registerInteractionHandler('grimms_fairy_tales_another_story', (state, playerId, value, _data, random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        if (choices.some(choice => choice?.skip)) return { state, events: [] };
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const selectedUids = new Set(choices.map(choice => choice.cardUid).filter((uid): uid is string => Boolean(uid)));
        const selected = player.discard.filter(card => selectedUids.has(card.uid)).slice(0, 3);
        if (selected.length === 0) return { state, events: [] };
        return {
            state,
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: { playerId, deckUids: random.shuffle([...player.deck, ...selected]).map(card => card.uid) },
                timestamp,
            } as DeckReorderedEvent],
        };
    });

    registerInteractionHandler('grimms_fairy_tales_breadcrumbs', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        if (choices.some(choice => choice?.skip)) return { state, events: [] };
        const selected = findSelectedMinions(state.core, choices)
            .filter(entry => entry.minion.controller === playerId)
            .slice(0, 2);
        if (selected.length === 0) return { state, events: [] };
        if (!selected.every(entry => entry.baseIndex === selected[0].baseIndex)) return { state, events: [] };
        const fromBaseIndex = selected[0].baseIndex;
        const destinations = state.core.bases
            .map((base, baseIndex) => ({ base, baseIndex }))
            .filter(entry => entry.baseIndex !== fromBaseIndex)
            .map(entry => ({ baseIndex: entry.baseIndex, label: baseLabel(state.core, entry.baseIndex) }));
        if (destinations.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice<BaseChoice>(
            `grimms_fairy_tales_breadcrumbs_destination_${timestamp}`,
            playerId,
            '面包屑：选择移动到的基地',
            buildBaseTargetOptions(destinations, state.core),
            {
                sourceId: 'grimms_fairy_tales_breadcrumbs_destination',
                targetType: 'base',
                responseValidationMode: 'live',
            },
        );
        (interaction.data as typeof interaction.data & { continuationContext?: BreadcrumbsContext }).continuationContext = {
            selectedMinions: selected.map(entry => ({ minionUid: entry.minion.uid, minionDefId: entry.minion.defId })),
            fromBaseIndex,
        };
        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('grimms_fairy_tales_breadcrumbs_destination', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const context = (data as { continuationContext?: BreadcrumbsContext } | undefined)?.continuationContext;
        if (selected?.baseIndex === undefined || !context) return { state, events: [] };
        const events = context.selectedMinions.flatMap(minion =>
            buildValidatedMoveEvents(state, {
                minionUid: minion.minionUid,
                minionDefId: minion.minionDefId,
                fromBaseIndex: context.fromBaseIndex,
                toBaseIndex: selected.baseIndex!,
                reason: 'grimms_fairy_tales_breadcrumbs',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'grimms_fairy_tales_breadcrumbs',
                sourceControllerId: playerId,
                sourceBaseIndex: context.fromBaseIndex,
                sourceKind: 'action',
            }),
        );
        return { state, events };
    });

    registerInteractionHandler('grimms_fairy_tales_mouse_bird_and_sausage', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        if (choices.some(choice => choice?.skip)) return { state, events: [] };
        const selected = findSelectedMinions(state.core, choices).slice(0, 2);
        if (!sameBaseFaction(selected)) return { state, events: [] };
        return {
            state,
            events: selected.map(entry => addTempPower(
                entry.minion.uid,
                entry.baseIndex,
                2,
                'grimms_fairy_tales_mouse_bird_and_sausage',
                timestamp,
                {
                    sourcePlayerId: playerId,
                    sourceDefId: 'grimms_fairy_tales_mouse_bird_and_sausage',
                    sourceControllerId: playerId,
                    sourceBaseIndex: entry.baseIndex,
                },
            )),
        };
    });

    registerInteractionHandler('base_gingerbread_house', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as PairChoice | undefined;
        if (selected?.skip || !selected?.minionUids || selected.baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[selected.baseIndex];
        const pair = selected.minionUids
            .map(uid => base?.minions.find(minion => minion.uid === uid && minion.controller === playerId))
            .filter((minion): minion is MinionOnBase => Boolean(minion));
        if (pair.length !== 2) return { state, events: [] };
        if (getMinionPower(state.core, pair[0], selected.baseIndex) !== getMinionPower(state.core, pair[1], selected.baseIndex)) {
            return { state, events: [] };
        }
        return {
            state,
            events: pair.map(minion => addTempPower(
                minion.uid,
                selected.baseIndex!,
                2,
                'base_gingerbread_house',
                timestamp,
                {
                    sourcePlayerId: playerId,
                    sourceDefId: 'base_gingerbread_house',
                    sourceControllerId: playerId,
                    sourceBaseIndex: selected.baseIndex,
                },
            )),
        };
    });

    registerInteractionHandler('base_woodland_cottage', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) return { state, events: [] };
        const context = (data as { continuationContext?: BaseCardContext } | undefined)?.continuationContext;
        const player = state.core.players[playerId];
        const card = player?.deck.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        const power = selected.defId ? getMinionLikePower(selected.defId) : undefined;
        if (!player || !card || power === undefined || power > 3 || context?.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                cardTransferredToSelf(card, playerId, 'base_woodland_cottage', timestamp),
                baseMetadataUpdated(
                    state.core,
                    context.baseIndex,
                    { [`woodlandCottageUsedTurn_${playerId}`]: state.core.turnNumber },
                    'base_woodland_cottage',
                    timestamp,
                ),
            ],
        };
    });

    registerInteractionHandler('grimms_fairy_tales_big_bad_wolf', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as MinionChoice | undefined;
        if (selected?.skip || !selected?.minionUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const minion = state.core.bases[selected.baseIndex]?.minions.find(candidate => candidate.uid === selected.minionUid);
        if (!minion || getMinionPower(state.core, minion, selected.baseIndex) > 4) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'grimms_fairy_tales_big_bad_wolf',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'grimms_fairy_tales_big_bad_wolf',
                sourceControllerId: playerId,
                sourceBaseIndex: selected.baseIndex,
                sourceKind: 'nonAction',
            }),
        };
    });

    const playDiscardMinionHandler = (
        state: MatchState<SmashUpCore>,
        playerId: PlayerId,
        value: unknown,
        data: Record<string, unknown> | undefined,
        random: RandomFn,
        timestamp: number,
    ) => {
        const selected = value as CardChoice | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId) return { state, events: [] };
        const context = (data as { continuationContext?: PlayDiscardMinionContext } | undefined)?.continuationContext;
        if (!context) return { state, events: [] };
        const player = state.core.players[playerId];
        const card = player?.discard.find(candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId);
        const power = selected.defId ? getMinionLikePower(selected.defId) : undefined;
        if (!player || !card || power === undefined || !state.core.bases[context.baseIndex]) {
            return { state, events: [] };
        }
        const events: SmashUpEvent[] = [];
        if (context.sourceDefId === 'grimms_fairy_tales_the_frog_prince') {
            const source = context.sourceCardUid
                ? findMinionOnBases(state.core, context.sourceCardUid)
                : undefined;
            if (!source) return { state, events: [] };
            const ownerId = context.sourceOwnerId ?? source.minion.owner;
            events.push(cardToDeckTop(
                {
                    uid: source.minion.uid,
                    defId: source.minion.defId,
                    type: 'minion',
                    owner: ownerId,
                },
                ownerId,
                'grimms_fairy_tales_the_frog_prince',
                timestamp,
                playerId,
            ));
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: random.shuffle([
                        ...(state.core.players[ownerId]?.deck ?? []).map(deckCard => deckCard.uid),
                        source.minion.uid,
                    ]),
                },
                timestamp,
            } as DeckReorderedEvent);
        }
        events.push(playDiscardMinionEvent(state.core, playerId, card, context.baseIndex, context.sourceDefId, timestamp));
        return { state, events };
    };

    registerInteractionHandler('grimms_fairy_tales_big_bad_wolf_destroyed', playDiscardMinionHandler);
    registerInteractionHandler('grimms_fairy_tales_the_frog_prince', playDiscardMinionHandler);
}
