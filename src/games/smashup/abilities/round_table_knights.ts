import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { PlayerId } from '../../../engine/types';
import { getBaseDef, getCardDef } from '../data/cards';
import { registerAbility, type AbilityContext, type AbilityResult } from '../domain/abilityRegistry';
import { registerActiveBaseAbility } from '../domain/baseAbilities';
import {
    registerInterceptor,
    registerProtection,
    registerTrigger,
    type ProtectionCheckContext,
    type TriggerContext,
    type TriggerResult,
} from '../domain/ongoingEffects';
import { buildValidatedOngoingDetachEvents, findLiveOngoingCardLocation } from '../domain/ongoingDetach';
import {
    addOngoingCardCounter,
    addPowerCounter,
    buildMinionTargetOptions,
    buildStandardDrawEvents,
    buildValidatedMoveEvents,
    createSkipOption,
    findMinionByAttachedCard,
    findMinionOnBases,
    grantExtraAction,
    grantExtraMinion,
} from '../domain/abilityHelpers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { BaseInPlay, CardInstance, CardsDrawnEvent, MinionOnBase, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

type LocatedMinion = { minion: MinionOnBase; baseIndex: number };
type BaseOngoing = BaseInPlay['ongoingActions'][number] & { baseIndex: number };
type CardChoice = { cardUid?: string; defId?: string; source?: 'discard' | 'deck' };
type GuinevereMoveChoice = { minionUid?: string; fromBaseIndex?: number; toBaseIndex?: number };
type BaseChoice = { baseIndex?: number; skip?: boolean };
type CamelotMoveChoice = { minionUid?: string; fromBaseIndex?: number; toBaseIndex?: number };
type ActionTransferChoice = { actionUid?: string; fromBaseIndex?: number; toBaseIndex?: number; skip?: boolean };
type MerlinsLibraryChoice = {
    mode?: 'extraMinion' | 'moveMinion' | 'transferSelf';
    minionUid?: string;
    fromBaseIndex?: number;
    toBaseIndex?: number;
};

const KING_ARTHUR = 'round_table_knights_king_arthur';
const GALAHAD = 'round_table_knights_galahad';
const GAWAIN = 'round_table_knights_gawain';
const GUINEVERE = 'round_table_knights_guinevere';
const LANCELOT = 'round_table_knights_lancelot';
const MERLIN = 'round_table_knights_merlin';
const PERCIVAL = 'round_table_knights_percival';
const A_QUESTING = 'round_table_knights_a_questing';
const EXCALIBUR = 'round_table_knights_excalibur';
const GOOD_DEED = 'round_table_knights_good_deed';
const MERLINS_LIBRARY = 'round_table_knights_merlins_library';
const NOBLE_STEED = 'round_table_knights_noble_steed';
const THE_FISHER_KING = 'round_table_knights_the_fisher_king';
const THE_GRAIL = 'round_table_knights_the_grail';
const THE_GREEN_KNIGHT = 'round_table_knights_the_green_knight';
const THE_LADY_OF_THE_LAKE = 'round_table_knights_the_lady_of_the_lake';
const THE_MISTS_OF_AVALON = 'round_table_knights_the_mists_of_avalon';
const THE_QUESTING_BEAST = 'round_table_knights_the_questing_beast';
const A_QUESTING_MOVE = 'round_table_knights_a_questing_move';
const GOOD_DEED_TRANSFER = 'round_table_knights_good_deed_transfer';
const GALAHAD_SPECIAL_TRANSFER = 'round_table_knights_galahad_special_transfer';
const NOBLE_STEED_MOVE = 'round_table_knights_noble_steed_move';
const QUESTING_BEAST_TRANSFER = 'round_table_knights_the_questing_beast_transfer';

function allMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): LocatedMinion[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({ minion, baseIndex })),
    );
}

function printedPower(defId: string): number {
    const def = getCardDef(defId);
    return def?.type === 'minion' ? (def.power ?? 0) : 0;
}

function livePowerWithoutOngoing(minion: MinionOnBase): number {
    return minion.basePower
        + (minion.powerCounters ?? 0)
        + (minion.powerModifier ?? 0)
        + (minion.tempPowerModifier ?? 0);
}

function firstOtherBaseIndex(state: SmashUpCore, fromBaseIndex: number): number | undefined {
    const index = state.bases.findIndex((_, candidateIndex) => candidateIndex !== fromBaseIndex);
    return index >= 0 ? index : undefined;
}

function firstOwnBaseAction(state: SmashUpCore, playerId: PlayerId, baseIndex?: number): BaseOngoing | undefined {
    for (const [index, base] of state.bases.entries()) {
        if (baseIndex !== undefined && index !== baseIndex) continue;
        const action = base.ongoingActions.find(candidate => candidate.ownerId === playerId);
        if (action) return { ...action, baseIndex: index };
    }
    return undefined;
}

function ownBaseActionByUid(state: SmashUpCore, playerId: PlayerId, baseIndex: number, cardUid: string): BaseOngoing | undefined {
    const action = state.bases[baseIndex]?.ongoingActions.find(candidate =>
        candidate.uid === cardUid && candidate.ownerId === playerId,
    );
    return action ? { ...action, baseIndex } : undefined;
}

function ownsActionOnBase(base: BaseInPlay, playerId: PlayerId): boolean {
    return base.ongoingActions.some(action => action.ownerId === playerId);
}

function moveMinion(
    state: SmashUpCore,
    minion: MinionOnBase,
    fromBaseIndex: number,
    toBaseIndex: number,
    playerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent[] {
    return buildValidatedMoveEvents(state, {
        minionUid: minion.uid,
        minionDefId: minion.defId,
        fromBaseIndex,
        toBaseIndex,
        reason,
        now,
        sourcePlayerId: playerId,
        sourceDefId: reason,
        sourceControllerId: playerId,
        sourceBaseIndex: fromBaseIndex,
        sourceKind: 'nonAction',
    });
}

function transferBaseAction(
    state: SmashUpCore,
    action: BaseOngoing,
    toBaseIndex: number,
    playerId: PlayerId,
    reason: string,
    now: number,
    metadataUpdate?: Record<string, unknown>,
): SmashUpEvent[] {
    if (toBaseIndex === action.baseIndex || !state.bases[toBaseIndex]) return [];
    const detach = buildValidatedOngoingDetachEvents(state, {
        cardUid: action.uid,
        reason,
        now,
        expectedLocation: 'base',
        sourcePlayerId: playerId,
        sourceCardUid: action.uid,
        sourceDefId: action.defId,
        sourceControllerId: playerId,
        sourceBaseIndex: action.baseIndex,
    });
    if (detach.length === 0) return [];
    return [
        ...detach,
        {
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                sourcePlayerId: playerId,
                targetType: 'base',
                targetBaseIndex: toBaseIndex,
                ...((action.metadata || metadataUpdate) ? { metadata: { ...(action.metadata ?? {}), ...(metadataUpdate ?? {}) } } : {}),
                ...(action.talentUsed !== undefined ? { talentUsed: action.talentUsed } : {}),
            },
            timestamp: now,
        } as SmashUpEvent,
    ];
}

function topDeckReorderedEvent(playerId: PlayerId, card: CardInstance, deck: CardInstance[], reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId,
            deckUids: [card.uid, ...deck.filter(candidate => candidate.uid !== card.uid).map(candidate => candidate.uid)],
            reason,
        },
        timestamp: now,
    } as SmashUpEvent;
}

function cardToDeckTop(card: CardInstance, ownerId: PlayerId, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_TO_DECK_TOP,
        payload: { cardUid: card.uid, defId: card.defId, ownerId, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function removeCardFromGame(playerId: PlayerId, cardUid: string, defId: string, reason: string, now: number): SmashUpEvent {
    return {
        type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
        payload: { playerId, cardUid, defId, reason },
        timestamp: now,
    } as SmashUpEvent;
}

function minionChoiceLabel(state: SmashUpCore, minion: MinionOnBase, baseIndex: number): string {
    const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
    const baseName = getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`;
    return `${minionName} @ ${baseName}`;
}

function queueKingArthurTargetPrompt(ctx: AbilityContext, source: LocatedMinion, candidates: LocatedMinion[]): AbilityResult {
    const options = buildMinionTargetOptions(
        candidates.map(candidate => ({
            uid: candidate.minion.uid,
            defId: candidate.minion.defId,
            baseIndex: candidate.baseIndex,
            label: minionChoiceLabel(ctx.state, candidate.minion, candidate.baseIndex),
        })),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: KING_ARTHUR,
            sourceKind: 'nonAction',
            effectType: 'move',
        },
    );
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${KING_ARTHUR}_${ctx.now}`,
        ctx.playerId,
        '亚瑟王：选择要移动到这里的随从',
        options,
        {
            titleKey: 'ui.round_table_knights_king_arthur_title',
            sourceId: KING_ARTHUR,
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    );
    (interaction.data as { continuationContext?: { sourceBaseIndex: number } }).continuationContext = {
        sourceBaseIndex: source.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function kingArthurTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidates = allMinions(ctx.state, (minion, baseIndex) =>
        minion.controller === ctx.playerId && baseIndex !== source.baseIndex,
    );
    const target = ctx.targetMinionUid
        ? candidates.find(candidate => candidate.minion.uid === ctx.targetMinionUid)
        : undefined;
    if (!target && ctx.matchState) return queueKingArthurTargetPrompt(ctx, source, candidates);
    if (!target && !ctx.matchState) return { events: [] };
    const resolvedTarget = target;
    if (!resolvedTarget) return { events: [] };
    const moveEvents = moveMinion(ctx.state, resolvedTarget.minion, resolvedTarget.baseIndex, source.baseIndex, ctx.playerId, 'round_table_knights_king_arthur', ctx.now);
    const events = [...moveEvents];
    if (ownsActionOnBase(ctx.state.bases[source.baseIndex], ctx.playerId)) {
        events.push(addPowerCounter(resolvedTarget.minion.uid, source.baseIndex, 1, 'round_table_knights_king_arthur_action_bonus', ctx.now));
    }
    return { events };
}

function galahadOnPlay(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const targets = deck.filter(isBaseOngoingAction);
    if (targets.length > 0 && ctx.matchState) return queueGalahadDeckPrompt(ctx, targets);
    if (targets.length > 0 && !ctx.matchState) return { events: [] };
    return { events: [] };
}

function queueGalahadSpecialPrompt(ctx: AbilityContext, actions: BaseOngoing[]): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const options = [
        createSkipOption('跳过（不转移行动）', 'ui.round_table_knights_galahad_special_transfer_skip_option'),
        ...actionTransferOptions(ctx.state, actions, ctx.baseIndex),
    ];
    if (options.length <= 1) return { events: [] };
    const interaction = createSimpleChoice(
        `${GALAHAD_SPECIAL_TRANSFER}_${ctx.now}`,
        ctx.playerId,
        '加拉哈德：选择要转移的己方行动和目标基地',
        options,
        {
            titleKey: 'ui.round_table_knights_galahad_special_transfer_title',
            sourceId: GALAHAD_SPECIAL_TRANSFER,
            targetType: 'generic',
            genericIntent: 'composite-context',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function galahadSpecial(ctx: AbilityContext): AbilityResult {
    const actions = (ctx.state.bases[ctx.baseIndex]?.ongoingActions ?? [])
        .filter(action => action.ownerId === ctx.playerId)
        .map(action => ({ ...action, baseIndex: ctx.baseIndex }));
    const directToBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== ctx.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if (ctx.matchState && (directToBaseIndex === undefined || actions.length !== 1)) return queueGalahadSpecialPrompt(ctx, actions);
    const action = actions.length === 1 ? actions[0] : undefined;
    if (!action || directToBaseIndex === undefined) return { events: [] };
    return { events: transferBaseAction(ctx.state, action, directToBaseIndex, ctx.playerId, 'round_table_knights_galahad', ctx.now) };
}

function buildGuinevereMoveOptions(state: SmashUpCore, source: LocatedMinion, playerId: PlayerId) {
    const candidates = state.bases[source.baseIndex].minions.filter(minion =>
        minion.uid !== source.minion.uid && minion.controller === playerId,
    );
    const destinations = state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== source.baseIndex);
    return candidates.flatMap((minion) => destinations.map((toBaseIndex) => ({
        id: `${minion.uid}-${toBaseIndex}`,
        label: `${getCardDef(minion.defId)?.name ?? minion.defId} -> ${getBaseDef(state.bases[toBaseIndex]?.defId)?.name ?? `基地 ${toBaseIndex + 1}`}`,
        value: { minionUid: minion.uid, fromBaseIndex: source.baseIndex, toBaseIndex } satisfies GuinevereMoveChoice,
        displayMode: 'button' as const,
    })));
}

function queueGuinevereTargetPrompt(ctx: AbilityContext, source: LocatedMinion): AbilityResult {
    const options = buildGuinevereMoveOptions(ctx.state, source, ctx.playerId);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${GUINEVERE}_${ctx.now}`,
        ctx.playerId,
        '格尼薇儿：选择要移动的随从和目标基地',
        options,
        {
            titleKey: 'ui.round_table_knights_guinevere_title',
            sourceId: GUINEVERE,
            targetType: 'generic',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function buildBaseChoiceOptions(state: SmashUpCore, baseIndices: number[]) {
    return baseIndices.map(baseIndex => ({
        id: `base-${baseIndex}`,
        label: getBaseDef(state.bases[baseIndex]?.defId)?.name ?? `基地 ${baseIndex + 1}`,
        value: { baseIndex },
        displayMode: 'button' as const,
    }));
}

function otherBaseIndices(state: SmashUpCore, fromBaseIndex: number): number[] {
    return state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== fromBaseIndex);
}

function actionTransferOptions(state: SmashUpCore, actions: BaseOngoing[], fromBaseIndex: number) {
    const destinations = otherBaseIndices(state, fromBaseIndex);
    return actions.flatMap(action => destinations.map(toBaseIndex => ({
        id: `${action.uid}-${toBaseIndex}`,
        label: `${getCardDef(action.defId)?.name ?? action.defId} -> ${getBaseDef(state.bases[toBaseIndex]?.defId)?.name ?? `基地 ${toBaseIndex + 1}`}`,
        value: { actionUid: action.uid, fromBaseIndex: action.baseIndex, toBaseIndex } satisfies ActionTransferChoice,
        displayMode: 'button' as const,
    })));
}

function queueMinionDestinationPrompt(
    matchState: NonNullable<AbilityContext['matchState']>,
    playerId: PlayerId,
    now: number,
    sourceId: string,
    title: string,
    titleKey: string,
    source: LocatedMinion,
    destinationBaseIndices: number[],
    options: { optional?: boolean; skipLabelText?: string; skipLabelKey?: string; continuationContext?: Record<string, unknown> } = {},
): AbilityResult {
    const baseOptions = buildBaseChoiceOptions(matchState.core, destinationBaseIndices);
    if (baseOptions.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${sourceId}_${now}`,
        playerId,
        title,
        [
            ...(options.optional ? [createSkipOption(options.skipLabelText ?? '跳过', options.skipLabelKey)] : []),
            ...baseOptions,
        ],
        {
            sourceId,
            titleKey,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        sourceMinionUid: source.minion.uid,
        sourceBaseIndex: source.baseIndex,
        ...(options.continuationContext ?? {}),
    };
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function queuePercivalDestinationPrompt(ctx: AbilityContext, source: LocatedMinion, candidateBaseIndices: number[]): AbilityResult {
    const options = buildBaseChoiceOptions(ctx.state, candidateBaseIndices);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${PERCIVAL}_${ctx.now}`,
        ctx.playerId,
        '帕西瓦尔：选择要移动到的己方行动牌基地',
        options,
        {
            titleKey: 'ui.round_table_knights_percival_title',
            sourceId: PERCIVAL,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: { sourceMinionUid: string; sourceBaseIndex: number } }).continuationContext = {
        sourceMinionUid: source.minion.uid,
        sourceBaseIndex: source.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function guinevereTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidates = ctx.state.bases[source.baseIndex].minions.filter(minion =>
        minion.uid !== source.minion.uid && minion.controller === ctx.playerId,
    );
    const target = ctx.targetMinionUid
        ? candidates.find(minion => minion.uid === ctx.targetMinionUid)
        : undefined;
    const toBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== source.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if ((!target || toBaseIndex === undefined) && ctx.matchState) return queueGuinevereTargetPrompt(ctx, source);
    if ((!target || toBaseIndex === undefined) && !ctx.matchState) return { events: [] };
    const resolvedTarget = target;
    const resolvedToBaseIndex = toBaseIndex;
    if (!resolvedTarget || resolvedToBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, resolvedTarget, source.baseIndex, resolvedToBaseIndex, ctx.playerId, 'round_table_knights_guinevere', ctx.now) };
}

function lancelotMoved(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.triggerMinion?.defId !== LANCELOT || ctx.moveToBaseIndex === undefined) return [];
    if (ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.moveToBaseIndex];
    if (!base || !ownsActionOnBase(base, ctx.triggerMinion.controller)) return [];
    return [addPowerCounter(ctx.triggerMinion.uid, ctx.moveToBaseIndex, 1, 'round_table_knights_lancelot', ctx.now)];
}

function merlinTalent(ctx: AbilityContext): AbilityResult {
    const deck = ctx.state.players[ctx.playerId]?.deck ?? [];
    const top = deck[0];
    if (!top) return { events: [] };
    const def = getCardDef(top.defId);
    if (def?.type !== 'action') {
        return {
            events: [{
                type: SU_EVENTS.REVEAL_DECK_TOP,
                payload: { playerId: ctx.playerId, cardUids: [top.uid], reason: 'round_table_knights_merlin' },
                timestamp: ctx.now,
            } as SmashUpEvent],
        };
    }
    return {
        events: [
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
            grantExtraAction(ctx.playerId, 'round_table_knights_merlin_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: top.uid,
            }),
        ],
    };
}

function percivalTalent(ctx: AbilityContext): AbilityResult {
    const source = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!source) return { events: [] };
    const candidateBaseIndices = ctx.state.bases
        .map((base, index) => ({ base, index }))
        .filter(({ base, index }) =>
        index !== source.baseIndex && ownsActionOnBase(base, ctx.playerId),
    )
        .map(({ index }) => index);
    if (ctx.matchState && ctx.targetBaseIndex === undefined) {
        return queuePercivalDestinationPrompt(ctx, source, candidateBaseIndices);
    }
    const toBaseIndex = ctx.targetBaseIndex !== undefined && candidateBaseIndices.includes(ctx.targetBaseIndex)
        ? ctx.targetBaseIndex
        : candidateBaseIndices[0];
    if (toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, source.minion, source.baseIndex, toBaseIndex, ctx.playerId, 'round_table_knights_percival', ctx.now) };
}

function aQuestingOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) return { events: [] };
    const target = findMinionOnBases(ctx.state, ctx.targetMinionUid);
    if (!target || target.minion.controller !== ctx.playerId) return { events: [] };
    const directToBaseIndex = ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== target.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if (ctx.matchState && directToBaseIndex === undefined) {
        return queueMinionDestinationPrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            A_QUESTING_MOVE,
            '踏上征途：选择是否移动宿主随从',
            'ui.round_table_knights_a_questing_move_title',
            target,
            otherBaseIndices(ctx.state, target.baseIndex),
            { optional: true, skipLabelText: '不移动此随从', skipLabelKey: 'ui.round_table_knights_a_questing_move_skip_option' },
        );
    }
    if (directToBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, target.minion, target.baseIndex, directToBaseIndex, ctx.playerId, 'round_table_knights_a_questing', ctx.now) };
}

function goodDeedOnPlay(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now) };
}

function queueGoodDeedTransferPrompt(ctx: TriggerContext, action: BaseOngoing, metadataUpdate: Record<string, unknown>): TriggerResult {
    const playerId = ctx.sourceControllerId;
    const destinations = otherBaseIndices(ctx.state, action.baseIndex);
    const options = [
        createSkipOption('跳过（不转移善行）', 'ui.round_table_knights_good_deed_transfer_skip_option'),
        ...buildBaseChoiceOptions(ctx.state, destinations),
    ];
    if (!ctx.matchState || !playerId || options.length <= 1) return { events: [] };
    const interaction = createSimpleChoice(
        `${GOOD_DEED_TRANSFER}_${ctx.now}_${ctx.sourceCardUid}`,
        playerId,
        '善行：选择是否转移到另一个基地',
        options,
        {
            titleKey: 'ui.round_table_knights_good_deed_transfer_title',
            sourceId: GOOD_DEED_TRANSFER,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        actionUid: action.uid,
        sourceBaseIndex: action.baseIndex,
        metadataUpdate,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function goodDeedOnMove(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const action = ownBaseActionByUid(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex, ctx.sourceCardUid);
    if (!action) return [];
    if (Number(action.metadata?.roundTableGoodDeedUsedTurn ?? -1) === ctx.state.turnNumber) return [];
    const metadataUpdate = { roundTableGoodDeedUsedTurn: ctx.state.turnNumber };
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex);
    if (ctx.matchState && toBaseIndex !== undefined) {
        return queueGoodDeedTransferPrompt(ctx, action, metadataUpdate);
    }
    if (toBaseIndex === undefined) {
        return [
            ...buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now),
            addOngoingCardCounter(action.uid, ctx.sourceBaseIndex, 0, 'round_table_knights_good_deed_once_per_turn', ctx.now, { metadataUpdate }),
        ];
    }
    return [];
}

function canTriggerGoodDeedOnMove(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return false;
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return false;
    const action = ownBaseActionByUid(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex, ctx.sourceCardUid);
    if (!action) return false;
    if (Number(action.metadata?.roundTableGoodDeedUsedTurn ?? -1) === ctx.state.turnNumber) return false;
    return firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex) === undefined || !!ctx.matchState;
}

function buildMerlinsLibraryOptions(ctx: AbilityContext) {
    const moveOptions = allMinions(ctx.state, (minion, baseIndex) =>
        minion.controller === ctx.playerId && baseIndex !== ctx.baseIndex,
    ).map(({ minion, baseIndex }) => ({
        id: `move-${minion.uid}`,
        label: `移动 ${minionChoiceLabel(ctx.state, minion, baseIndex)} 到这里`,
        value: { mode: 'moveMinion' as const, minionUid: minion.uid, fromBaseIndex: baseIndex, toBaseIndex: ctx.baseIndex } satisfies MerlinsLibraryChoice,
        displayMode: 'button' as const,
    }));
    const transferOptions = otherBaseIndices(ctx.state, ctx.baseIndex).map(toBaseIndex => ({
        id: `transfer-${toBaseIndex}`,
        label: `转移藏书馆到 ${getBaseDef(ctx.state.bases[toBaseIndex]?.defId)?.name ?? `基地 ${toBaseIndex + 1}`}`,
        value: { mode: 'transferSelf' as const, toBaseIndex } satisfies MerlinsLibraryChoice,
        displayMode: 'button' as const,
    }));
    return [
        {
            id: 'extra-minion',
            label: '额外打出一个随从到这里',
            labelKey: 'ui.round_table_knights_merlins_library_extra_minion_option',
            value: { mode: 'extraMinion' as const } satisfies MerlinsLibraryChoice,
            displayMode: 'button' as const,
        },
        ...moveOptions,
        ...transferOptions,
    ];
}

function queueMerlinsLibraryPrompt(ctx: AbilityContext): AbilityResult {
    if (!ctx.matchState) return { events: [] };
    const options = buildMerlinsLibraryOptions(ctx);
    if (options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${MERLINS_LIBRARY}_${ctx.now}`,
        ctx.playerId,
        '梅林藏书馆：选择天赋效果',
        options,
        {
            titleKey: 'ui.round_table_knights_merlins_library_title',
            sourceId: MERLINS_LIBRARY,
            targetType: 'generic',
            genericIntent: 'composite-context',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function merlinsLibraryTalent(ctx: AbilityContext): AbilityResult {
    const action = ownBaseActionByUid(ctx.state, ctx.playerId, ctx.baseIndex, ctx.cardUid);
    if (ctx.targetMinionUid) {
        const movable = allMinions(ctx.state, (minion, baseIndex) =>
            minion.controller === ctx.playerId
            && baseIndex !== ctx.baseIndex
            && minion.uid === ctx.targetMinionUid,
        )[0];
        if (movable) {
            return { events: moveMinion(ctx.state, movable.minion, movable.baseIndex, ctx.baseIndex, ctx.playerId, 'round_table_knights_merlins_library_move', ctx.now) };
        }
    }
    if (ctx.targetBaseIndex !== undefined) {
        if (!action || ctx.targetBaseIndex === ctx.baseIndex || !ctx.state.bases[ctx.targetBaseIndex]) return { events: [] };
        return { events: transferBaseAction(ctx.state, action, ctx.targetBaseIndex, ctx.playerId, 'round_table_knights_merlins_library_transfer', ctx.now) };
    }
    if (ctx.matchState) return queueMerlinsLibraryPrompt(ctx);
    return { events: [grantExtraMinion(ctx.playerId, 'round_table_knights_merlins_library_minion', ctx.now, ctx.baseIndex)] };
}

function nobleSteedTalent(ctx: AbilityContext): AbilityResult {
    const host = findMinionByAttachedCard(ctx.state, ctx.cardUid);
    const directToBaseIndex = host && ctx.targetBaseIndex !== undefined && ctx.targetBaseIndex !== host.baseIndex && ctx.state.bases[ctx.targetBaseIndex]
        ? ctx.targetBaseIndex
        : undefined;
    if (host && host.minion.controller === ctx.playerId && ctx.matchState && directToBaseIndex === undefined) {
        return queueMinionDestinationPrompt(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            NOBLE_STEED_MOVE,
            '高贵坐骑：选择目标基地',
            'ui.round_table_knights_noble_steed_move_title',
            host,
            otherBaseIndices(ctx.state, host.baseIndex),
        );
    }
    if (!host || directToBaseIndex === undefined || host.minion.controller !== ctx.playerId) return { events: [] };
    return { events: moveMinion(ctx.state, host.minion, host.baseIndex, directToBaseIndex, ctx.playerId, 'round_table_knights_noble_steed', ctx.now) };
}

function countDrawnCardsForPlayer(events: SmashUpEvent[], playerId: PlayerId): number {
    return events.reduce((count, event) => {
        if (event.type !== SU_EVENTS.CARDS_DRAWN) return count;
        const drawEvent = event as CardsDrawnEvent;
        if (drawEvent.payload.playerId !== playerId) return count;
        return count + (drawEvent.payload.cardUids?.length ?? drawEvent.payload.count ?? 0);
    }, 0);
}

function buildRoundTableDiscardCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `discard-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, source: 'discard' } satisfies CardChoice,
        _source: 'discard' as const,
        displayMode: 'card' as const,
    }));
}

function isBaseOngoingAction(card: CardInstance): boolean {
    const def = getCardDef(card.defId);
    return def?.type === 'action' && def.ongoingTarget === 'base';
}

function isMinionOngoingAction(card: CardInstance): boolean {
    const def = getCardDef(card.defId);
    return def?.type === 'action' && def.ongoingTarget === 'minion';
}

function buildRoundTableDeckCardOptions(cards: CardInstance[]) {
    return cards.map((card, index) => ({
        id: `deck-${index}`,
        label: getCardDef(card.defId)?.name ?? card.defId,
        value: { cardUid: card.uid, defId: card.defId, source: 'deck' } satisfies CardChoice,
        _source: 'deck' as const,
        displayMode: 'card' as const,
    }));
}

function queueGalahadDeckPrompt(ctx: AbilityContext, cards: CardInstance[]): AbilityResult {
    if (!ctx.matchState || cards.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${GALAHAD}_${ctx.now}`,
        ctx.playerId,
        '加拉哈德：选择牌库中一张可打到基地的行动置于牌库顶',
        buildRoundTableDeckCardOptions(cards),
        {
            titleKey: 'ui.round_table_knights_galahad_title',
            sourceId: GALAHAD,
            targetType: 'generic',
            genericIntent: 'card-pool',
            autoRefresh: 'deck',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function queueLadyOfTheLakePrompt(ctx: AbilityContext, discardCards: CardInstance[], deckCards: CardInstance[] = []): AbilityResult {
    const options = [
        ...buildRoundTableDiscardCardOptions(discardCards),
        ...buildRoundTableDeckCardOptions(deckCards),
    ];
    if (!ctx.matchState || options.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${THE_LADY_OF_THE_LAKE}_${ctx.now}`,
        ctx.playerId,
        deckCards.length > 0
            ? '湖中女神：选择牌库或弃牌堆中一张角色修正行动'
            : '湖中女神：选择弃牌堆中一张角色修正行动',
        options,
        {
            sourceId: THE_LADY_OF_THE_LAKE,
            targetType: deckCards.length > 0 ? 'generic' : 'discard',
            ...(deckCards.length > 0 ? { genericIntent: 'card-pool' as const } : {}),
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function queueMistsOfAvalonPrompt(ctx: AbilityContext, cards: CardInstance[]): AbilityResult {
    if (!ctx.matchState || cards.length === 0) return { events: [] };
    const interaction = createSimpleChoice(
        `${THE_MISTS_OF_AVALON}_${ctx.now}`,
        ctx.playerId,
        '阿瓦隆迷雾：选择至多三张弃牌堆角色放到牌库顶',
        buildRoundTableDiscardCardOptions(cards),
        {
            titleKey: 'ui.round_table_knights_the_mists_of_avalon_title',
            sourceId: THE_MISTS_OF_AVALON,
            targetType: 'discard',
            multi: { min: 0, max: Math.min(3, cards.length) },
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function fisherKingOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const events = buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
    const handCountAfterDraw = (ctx.state.players[ctx.sourceControllerId]?.hand.length ?? 0)
        + countDrawnCardsForPlayer(events, ctx.sourceControllerId);
    if (handCountAfterDraw >= 8) {
        events.push(
            ...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.sourceCardUid,
                reason: 'round_table_knights_the_fisher_king',
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.sourceControllerId,
                sourceDefId: THE_FISHER_KING,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
            }),
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_the_fisher_king' }, timestamp: ctx.now } as SmashUpEvent,
        );
    }
    return events;
}

function grailOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion?.controller !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    const count = base.minions.filter(minion => minion.controller === ctx.sourceControllerId && livePowerWithoutOngoing(minion) >= 4).length;
    if (count < 3) return [];
    return [
        ...buildValidatedOngoingDetachEvents(ctx.state, {
            cardUid: ctx.sourceCardUid,
            reason: 'round_table_knights_the_grail',
            now: ctx.now,
            expectedLocation: 'base',
            sourcePlayerId: ctx.sourceControllerId,
            sourceDefId: THE_GRAIL,
            sourceControllerId: ctx.sourceControllerId,
            sourceBaseIndex: ctx.sourceBaseIndex,
        }),
        removeCardFromGame(ctx.sourceControllerId, ctx.sourceCardUid, THE_GRAIL, 'round_table_knights_the_grail', ctx.now),
        { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 2, reason: 'round_table_knights_the_grail' }, timestamp: ctx.now } as SmashUpEvent,
    ];
}

function greenKnightOnMove(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinion) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const events: SmashUpEvent[] = [addPowerCounter(ctx.triggerMinion.uid, ctx.sourceBaseIndex, 1, 'round_table_knights_the_green_knight', ctx.now)];
    if (livePowerWithoutOngoing(ctx.triggerMinion) + 1 >= 7) {
        events.push(
            ...buildValidatedOngoingDetachEvents(ctx.state, {
                cardUid: ctx.sourceCardUid,
                reason: 'round_table_knights_the_green_knight',
                now: ctx.now,
                expectedLocation: 'base',
                sourcePlayerId: ctx.sourceControllerId,
                sourceDefId: THE_GREEN_KNIGHT,
                sourceControllerId: ctx.sourceControllerId,
                sourceBaseIndex: ctx.sourceBaseIndex,
            }),
            { type: SU_EVENTS.VP_AWARDED, payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_the_green_knight' }, timestamp: ctx.now } as SmashUpEvent,
        );
    }
    return events;
}

function ladyOfTheLake(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardCards = player?.discard.filter(isMinionOngoingAction) ?? [];
    const deckCards = player?.deck.filter(isMinionOngoingAction) ?? [];
    if ((discardCards.length > 0 || deckCards.length > 0) && ctx.matchState) {
        return queueLadyOfTheLakePrompt(ctx, discardCards, deckCards);
    }
    const discardCard = discardCards[0];
    if (discardCard) {
        return {
            events: [{
                type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                payload: { playerId: ctx.playerId, cardUids: [discardCard.uid], reason: THE_LADY_OF_THE_LAKE },
                timestamp: ctx.now,
            } as SmashUpEvent, grantExtraAction(ctx.playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: discardCard.uid,
            })],
        };
    }
    const deckCard = deckCards[0];
    if (!player || !deckCard) return { events: [] };
    return {
        events: [
            {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: [deckCard.uid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent,
            grantExtraAction(ctx.playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', ctx.now, {
                playTiming: 'immediate',
                restrictToCardUid: deckCard.uid,
            }),
        ],
    };
}

function mistsOfAvalon(ctx: AbilityContext): AbilityResult {
    const minions = (ctx.state.players[ctx.playerId]?.discard ?? [])
        .filter(card => card.type === 'minion')
    if (minions.length > 0 && ctx.matchState) return queueMistsOfAvalonPrompt(ctx, minions);
    return { events: [] };
}

function queueQuestingBeastTransferPrompt(ctx: TriggerContext, action: BaseOngoing): TriggerResult {
    const playerId = ctx.sourceControllerId;
    const sourceBaseIndex = ctx.sourceBaseIndex;
    if (!ctx.matchState || !ctx.triggerMinion || !playerId || sourceBaseIndex === undefined) return { events: [] };
    const destinations = otherBaseIndices(ctx.state, action.baseIndex);
    const options = buildBaseChoiceOptions(ctx.state, destinations);
    if (options.length === 0) return { events: [addPowerCounter(ctx.triggerMinion.uid, sourceBaseIndex, 1, 'round_table_knights_the_questing_beast', ctx.now)] };
    const interaction = createSimpleChoice(
        `${QUESTING_BEAST_TRANSFER}_${ctx.now}_${ctx.sourceCardUid}`,
        playerId,
        '追踪野兽：选择要转移到的基地',
        options,
        {
            titleKey: 'ui.round_table_knights_the_questing_beast_transfer_title',
            sourceId: QUESTING_BEAST_TRANSFER,
            targetType: 'base',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: Record<string, unknown> }).continuationContext = {
        actionUid: action.uid,
        sourceBaseIndex: action.baseIndex,
        triggerMinionUid: ctx.triggerMinion.uid,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function questingBeastOnMove(ctx: TriggerContext): SmashUpEvent[] | TriggerResult {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinion) return [];
    if (ctx.moveToBaseIndex !== ctx.sourceBaseIndex || ctx.triggerMinion.controller !== ctx.sourceControllerId) return [];
    const action = ownBaseActionByUid(ctx.state, ctx.sourceControllerId, ctx.sourceBaseIndex, ctx.sourceCardUid);
    const toBaseIndex = firstOtherBaseIndex(ctx.state, ctx.sourceBaseIndex);
    if (ctx.matchState && action && toBaseIndex !== undefined) {
        return queueQuestingBeastTransferPrompt(ctx, action);
    }
    return [
        addPowerCounter(ctx.triggerMinion.uid, ctx.sourceBaseIndex, 1, 'round_table_knights_the_questing_beast', ctx.now),
    ];
}

function canTriggerQuestingBeastOnMove(ctx: TriggerContext): boolean {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || !ctx.sourceControllerId || !ctx.triggerMinion) return false;
    return ctx.moveToBaseIndex === ctx.sourceBaseIndex
        && ctx.triggerMinion.controller === ctx.sourceControllerId;
}

function excaliburAfterScoring(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || !ctx.sourceControllerId || ctx.baseIndex === undefined) return [];
    const host = findMinionByAttachedCard(ctx.state, ctx.sourceCardUid);
    if (!host || host.baseIndex !== ctx.baseIndex || host.minion.defId !== KING_ARTHUR) return [];
    return [{
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.sourceControllerId, amount: 1, reason: 'round_table_knights_excalibur_king_arthur' },
        timestamp: ctx.now,
    } as SmashUpEvent];
}

function camelotSelectedMinion(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): MinionOnBase | undefined {
    const minions = ctx.state.bases[ctx.baseIndex]?.minions ?? [];
    return ctx.targetMinionUid
        ? minions.find(candidate => candidate.uid === ctx.targetMinionUid && candidate.controller === ctx.playerId)
        : minions.find(candidate => candidate.controller === ctx.playerId);
}

function camelotDestinationBaseIndex(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): number | undefined {
    if (ctx.targetBaseIndex !== undefined) {
        return ctx.targetBaseIndex !== ctx.baseIndex && ctx.state.bases[ctx.targetBaseIndex] ? ctx.targetBaseIndex : undefined;
    }
    return firstOtherBaseIndex(ctx.state, ctx.baseIndex);
}

function buildCamelotMoveOptions(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]) {
    const ownMinions = ctx.state.bases[ctx.baseIndex]?.minions
        .filter(minion => minion.controller === ctx.playerId) ?? [];
    const destinations = ctx.state.bases
        .map((_base, baseIndex) => baseIndex)
        .filter(baseIndex => baseIndex !== ctx.baseIndex);
    return ownMinions.flatMap(minion => destinations.map(toBaseIndex => ({
        id: `${minion.uid}-${toBaseIndex}`,
        label: `${getCardDef(minion.defId)?.name ?? minion.defId} -> ${getBaseDef(ctx.state.bases[toBaseIndex]?.defId)?.name ?? `基地 ${toBaseIndex + 1}`}`,
        value: { minionUid: minion.uid, fromBaseIndex: ctx.baseIndex, toBaseIndex } satisfies CamelotMoveChoice,
        displayMode: 'button' as const,
    })));
}

function queueCamelotMovePrompt(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): AbilityResult {
    const options = buildCamelotMoveOptions(ctx);
    if (options.length === 0 || !ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `base_camelot_${ctx.now}`,
        ctx.playerId,
        '卡美洛：选择要移动的己方随从和目标基地',
        options,
        {
            titleKey: 'ui.base_camelot_title',
            sourceId: 'base_camelot',
            targetType: 'generic',
            genericIntent: 'composite-context',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: { sourceBaseIndex: number } }).continuationContext = {
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function camelotCanUse(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): boolean {
    return Boolean(camelotSelectedMinion(ctx) && camelotDestinationBaseIndex(ctx) !== undefined);
}

function camelotActive(ctx: Parameters<Parameters<typeof registerActiveBaseAbility>[1]>[0]): AbilityResult {
    if (ctx.matchState && (!ctx.targetMinionUid || ctx.targetBaseIndex === undefined)) {
        return queueCamelotMovePrompt(ctx);
    }
    if (!ctx.matchState && (!ctx.targetMinionUid || ctx.targetBaseIndex === undefined)) return { events: [] };
    const minion = camelotSelectedMinion(ctx);
    const toBaseIndex = camelotDestinationBaseIndex(ctx);
    if (!minion || toBaseIndex === undefined) return { events: [] };
    return { events: moveMinion(ctx.state, minion, ctx.baseIndex, toBaseIndex, ctx.playerId, 'base_camelot', ctx.now) };
}

function aQuestingReplacement(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.MINION_DESTROYED) return undefined;
    const payload = event.payload as { minionUid: string; fromBaseIndex: number; ownerId: PlayerId };
    const minion = state.bases[payload.fromBaseIndex]?.minions.find(candidate => candidate.uid === payload.minionUid);
    const quest = minion?.attachedActions.find(action => action.defId === A_QUESTING);
    if (!minion || !quest) return undefined;
    return [
        ...buildValidatedOngoingDetachEvents(state, {
            cardUid: quest.uid,
            reason: 'round_table_knights_a_questing_replacement',
            now: event.timestamp ?? Date.now(),
            expectedLocation: 'minion',
            sourcePlayerId: quest.ownerId,
            sourceDefId: A_QUESTING,
            sourceControllerId: quest.ownerId,
            sourceBaseIndex: payload.fromBaseIndex,
        }),
        cardToDeckTop({ uid: minion.uid, defId: minion.defId, type: 'minion' } as CardInstance, payload.ownerId, 'round_table_knights_a_questing_replacement', event.timestamp ?? Date.now()),
    ];
}

function guinevereActionProtection(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = event.payload as { cardUid: string; ownerId: PlayerId; sourcePlayerId?: PlayerId };
    if (!payload.sourcePlayerId || payload.sourcePlayerId === payload.ownerId) return undefined;
    const location = findLiveOngoingCardLocation(state, payload.cardUid);
    if (!location || location.targetType !== 'base') return undefined;
    const hasGuinevere = allMinions(state, minion => minion.defId === GUINEVERE && minion.controller === payload.ownerId).length > 0;
    return hasGuinevere ? null : undefined;
}

function excaliburProtection(ctx: ProtectionCheckContext): boolean {
    return ctx.targetMinion.attachedActions.some(action =>
        action.defId === EXCALIBUR && action.ownerId !== ctx.sourcePlayerId && ctx.protectionType === 'destroy',
    );
}

function camelotProtection(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base || base.defId !== 'base_camelot') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return printedPower(ctx.targetMinion.defId) >= 4;
}

function registerRoundTableKnightInteractionHandlers(): void {
    const resolveMinionDestination = (
        state: Parameters<Parameters<typeof registerInteractionHandler>[1]>[0],
        playerId: PlayerId,
        value: unknown,
        data: Parameters<Parameters<typeof registerInteractionHandler>[1]>[3],
        timestamp: number,
        reason: string,
    ) => {
        const selected = value as BaseChoice | undefined;
        const source = (data?.continuationContext as { sourceMinionUid?: string; sourceBaseIndex?: number } | undefined);
        if (selected?.skip) return { state, events: [] };
        if (typeof selected?.baseIndex !== 'number' || !source?.sourceMinionUid || source.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (selected.baseIndex === source.sourceBaseIndex || !state.core.bases[selected.baseIndex]) {
            return { state, events: [] };
        }
        const minion = state.core.bases[source.sourceBaseIndex]?.minions.find(candidate =>
            candidate.uid === source.sourceMinionUid && candidate.controller === playerId,
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: moveMinion(state.core, minion, source.sourceBaseIndex, selected.baseIndex, playerId, reason, timestamp),
        };
    };

    registerInteractionHandler(A_QUESTING_MOVE, (state, playerId, value, data, _random, timestamp) =>
        resolveMinionDestination(state, playerId, value, data, timestamp, A_QUESTING));

    registerInteractionHandler(NOBLE_STEED_MOVE, (state, playerId, value, data, _random, timestamp) =>
        resolveMinionDestination(state, playerId, value, data, timestamp, NOBLE_STEED));

    registerInteractionHandler(GOOD_DEED_TRANSFER, (state, playerId, value, data, random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const source = (data?.continuationContext as { actionUid?: string; sourceBaseIndex?: number; metadataUpdate?: Record<string, unknown> } | undefined);
        if (selected?.skip) return { state, events: [] };
        if (typeof selected?.baseIndex !== 'number' || !source?.actionUid || source.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        const action = ownBaseActionByUid(state.core, playerId, source.sourceBaseIndex, source.actionUid);
        if (!action || selected.baseIndex === source.sourceBaseIndex || !state.core.bases[selected.baseIndex]) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                ...buildStandardDrawEvents(state.core, playerId, 1, random, timestamp),
                ...transferBaseAction(state.core, action, selected.baseIndex, playerId, GOOD_DEED, timestamp, source.metadataUpdate),
            ],
        };
    });

    registerInteractionHandler(GALAHAD_SPECIAL_TRANSFER, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as ActionTransferChoice | undefined;
        if (selected?.skip) return { state, events: [] };
        if (!selected?.actionUid || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
            return { state, events: [] };
        }
        const action = ownBaseActionByUid(state.core, playerId, selected.fromBaseIndex, selected.actionUid);
        if (!action || selected.toBaseIndex === selected.fromBaseIndex || !state.core.bases[selected.toBaseIndex]) {
            return { state, events: [] };
        }
        return {
            state,
            events: transferBaseAction(state.core, action, selected.toBaseIndex, playerId, GALAHAD, timestamp),
        };
    });

    registerInteractionHandler(MERLINS_LIBRARY, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as MerlinsLibraryChoice | undefined;
        const source = (data?.continuationContext as { sourceCardUid?: string; sourceBaseIndex?: number } | undefined);
        if (!selected?.mode || source?.sourceBaseIndex === undefined) return { state, events: [] };
        if (selected.mode === 'extraMinion') {
            return {
                state,
                events: [grantExtraMinion(playerId, 'round_table_knights_merlins_library_minion', timestamp, source.sourceBaseIndex)],
            };
        }
        if (selected.mode === 'moveMinion') {
            if (!selected.minionUid || selected.fromBaseIndex === undefined) return { state, events: [] };
            const minion = state.core.bases[selected.fromBaseIndex]?.minions.find(candidate =>
                candidate.uid === selected.minionUid && candidate.controller === playerId,
            );
            if (!minion || selected.fromBaseIndex === source.sourceBaseIndex) return { state, events: [] };
            return {
                state,
                events: moveMinion(state.core, minion, selected.fromBaseIndex, source.sourceBaseIndex, playerId, 'round_table_knights_merlins_library_move', timestamp),
            };
        }
        if (selected.mode === 'transferSelf') {
            if (!source.sourceCardUid || selected.toBaseIndex === undefined) return { state, events: [] };
            const action = ownBaseActionByUid(state.core, playerId, source.sourceBaseIndex, source.sourceCardUid);
            if (!action || selected.toBaseIndex === source.sourceBaseIndex || !state.core.bases[selected.toBaseIndex]) {
                return { state, events: [] };
            }
            return {
                state,
                events: transferBaseAction(state.core, action, selected.toBaseIndex, playerId, 'round_table_knights_merlins_library_transfer', timestamp),
            };
        }
        return { state, events: [] };
    });

    registerInteractionHandler(QUESTING_BEAST_TRANSFER, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const source = (data?.continuationContext as { actionUid?: string; sourceBaseIndex?: number; triggerMinionUid?: string } | undefined);
        if (typeof selected?.baseIndex !== 'number' || !source?.actionUid || source.sourceBaseIndex === undefined || !source.triggerMinionUid) {
            return { state, events: [] };
        }
        const minion = state.core.bases[source.sourceBaseIndex]?.minions.find(candidate =>
            candidate.uid === source.triggerMinionUid && candidate.controller === playerId,
        );
        const action = ownBaseActionByUid(state.core, playerId, source.sourceBaseIndex, source.actionUid);
        if (!minion || !action || selected.baseIndex === source.sourceBaseIndex || !state.core.bases[selected.baseIndex]) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                addPowerCounter(minion.uid, source.sourceBaseIndex, 1, THE_QUESTING_BEAST, timestamp),
                ...transferBaseAction(state.core, action, selected.baseIndex, playerId, THE_QUESTING_BEAST, timestamp),
            ],
        };
    });

    registerInteractionHandler(GALAHAD, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (!selected?.cardUid || !selected.defId) return { state, events: [] };
        const deck = state.core.players[playerId]?.deck ?? [];
        const card = deck.find(candidate =>
            candidate.uid === selected.cardUid
            && candidate.defId === selected.defId
            && isBaseOngoingAction(candidate),
        );
        if (!card) return { state, events: [] };
        return {
            state,
            events: [topDeckReorderedEvent(playerId, card, deck, GALAHAD, timestamp)],
        };
    });

    registerInteractionHandler(THE_LADY_OF_THE_LAKE, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as CardChoice | undefined;
        if (!selected?.cardUid || !selected.defId) return { state, events: [] };
        const player = state.core.players[playerId];
        const discardCard = selected.source !== 'deck'
            ? player?.discard.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isMinionOngoingAction(candidate),
            )
            : undefined;
        if (discardCard) {
            return {
                state,
                events: [{
                    type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
                    payload: { playerId, cardUids: [discardCard.uid], reason: THE_LADY_OF_THE_LAKE },
                    timestamp,
                } as SmashUpEvent, grantExtraAction(playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', timestamp, {
                    playTiming: 'immediate',
                    restrictToCardUid: discardCard.uid,
                })],
            };
        }
        const deckCard = selected.source !== 'discard'
            ? player?.deck.find(candidate =>
                candidate.uid === selected.cardUid
                && candidate.defId === selected.defId
                && isMinionOngoingAction(candidate),
            )
            : undefined;
        if (!player || !deckCard) return { state, events: [] };
        return {
            state,
            events: [
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: { playerId, count: 1, cardUids: [deckCard.uid] },
                    timestamp,
                } as CardsDrawnEvent,
                grantExtraAction(playerId, 'round_table_knights_the_lady_of_the_lake_extra_action', timestamp, {
                    playTiming: 'immediate',
                    restrictToCardUid: deckCard.uid,
                }),
            ],
        };
    });

    registerInteractionHandler(THE_MISTS_OF_AVALON, (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as CardChoice[];
        const selectedUids = new Set(choices
            .map(choice => choice?.cardUid)
            .filter((cardUid): cardUid is string => typeof cardUid === 'string'));
        const cards = (state.core.players[playerId]?.discard ?? [])
            .filter(card => selectedUids.has(card.uid) && card.type === 'minion')
            .slice(0, 3);
        return {
            state,
            events: cards.map(card => cardToDeckTop(card, playerId, THE_MISTS_OF_AVALON, timestamp)),
        };
    });

    registerInteractionHandler(PERCIVAL, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as BaseChoice | undefined;
        const source = (data?.continuationContext as { sourceMinionUid?: string; sourceBaseIndex?: number } | undefined);
        if (typeof selected?.baseIndex !== 'number' || !source?.sourceMinionUid || source.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (selected.baseIndex === source.sourceBaseIndex || !state.core.bases[selected.baseIndex]) {
            return { state, events: [] };
        }
        if (!ownsActionOnBase(state.core.bases[selected.baseIndex], playerId)) {
            return { state, events: [] };
        }
        const minion = state.core.bases[source.sourceBaseIndex]?.minions.find(candidate =>
            candidate.uid === source.sourceMinionUid && candidate.controller === playerId,
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: moveMinion(state.core, minion, source.sourceBaseIndex, selected.baseIndex, playerId, PERCIVAL, timestamp),
        };
    });

    registerInteractionHandler('base_camelot', (state, playerId, value, data, _random, timestamp) => {
        const selected = value as CamelotMoveChoice | undefined;
        const sourceBaseIndex = (data?.continuationContext as { sourceBaseIndex?: number } | undefined)?.sourceBaseIndex;
        const fromBaseIndex = selected?.fromBaseIndex ?? sourceBaseIndex;
        if (!selected?.minionUid || fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (fromBaseIndex !== sourceBaseIndex || fromBaseIndex === selected.toBaseIndex || !state.core.bases[selected.toBaseIndex]) {
            return { state, events: [] };
        }
        const minion = state.core.bases[fromBaseIndex]?.minions.find(candidate =>
            candidate.uid === selected.minionUid && candidate.controller === playerId,
        );
        if (!minion) return { state, events: [] };
        return {
            state,
            events: moveMinion(state.core, minion, fromBaseIndex, selected.toBaseIndex, playerId, 'base_camelot', timestamp),
        };
    });

    registerInteractionHandler(KING_ARTHUR, (state, playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const sourceBaseIndex = (data?.continuationContext as { sourceBaseIndex?: number } | undefined)?.sourceBaseIndex;
        if (!selected?.minionUid || selected.baseIndex === undefined || sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion =>
            minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!target || selected.baseIndex === sourceBaseIndex || !state.core.bases[sourceBaseIndex]) {
            return { state, events: [] };
        }
        const events = [
            ...moveMinion(state.core, target, selected.baseIndex, sourceBaseIndex, playerId, KING_ARTHUR, timestamp),
        ];
        if (ownsActionOnBase(state.core.bases[sourceBaseIndex], playerId)) {
            events.push(addPowerCounter(target.uid, sourceBaseIndex, 1, 'round_table_knights_king_arthur_action_bonus', timestamp));
        }
        return { state, events };
    });

    registerInteractionHandler(GUINEVERE, (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as GuinevereMoveChoice | undefined;
        if (!selected?.minionUid || selected.fromBaseIndex === undefined || selected.toBaseIndex === undefined) {
            return { state, events: [] };
        }
        if (selected.fromBaseIndex === selected.toBaseIndex || !state.core.bases[selected.toBaseIndex]) {
            return { state, events: [] };
        }
        const target = state.core.bases[selected.fromBaseIndex]?.minions.find(minion =>
            minion.uid === selected.minionUid && minion.controller === playerId,
        );
        if (!target) return { state, events: [] };
        return {
            state,
            events: moveMinion(state.core, target, selected.fromBaseIndex, selected.toBaseIndex, playerId, GUINEVERE, timestamp),
        };
    });
}

export function registerRoundTableKnightAbilities(): void {
    registerRoundTableKnightInteractionHandlers();
    registerAbility(KING_ARTHUR, 'talent', kingArthurTalent);
    registerAbility(GALAHAD, 'onPlay', galahadOnPlay);
    registerAbility(GALAHAD, 'special', galahadSpecial);
    registerAbility(GUINEVERE, 'talent', guinevereTalent);
    registerAbility(MERLIN, 'talent', merlinTalent);
    registerAbility(PERCIVAL, 'talent', percivalTalent);
    registerAbility(A_QUESTING, 'onPlay', aQuestingOnPlay);
    registerAbility(GOOD_DEED, 'onPlay', goodDeedOnPlay);
    registerAbility(MERLINS_LIBRARY, 'talent', merlinsLibraryTalent);
    registerAbility(NOBLE_STEED, 'talent', nobleSteedTalent);
    registerAbility(THE_LADY_OF_THE_LAKE, 'onPlay', ladyOfTheLake);
    registerAbility(THE_MISTS_OF_AVALON, 'onPlay', mistsOfAvalon);

    for (const ongoingId of [GAWAIN, GUINEVERE, LANCELOT, A_QUESTING, EXCALIBUR, GOOD_DEED, MERLINS_LIBRARY, NOBLE_STEED, THE_FISHER_KING, THE_GRAIL, THE_GREEN_KNIGHT, THE_QUESTING_BEAST]) {
        registerAbility(ongoingId, 'ongoing', () => ({ events: [] }));
    }

    registerTrigger(LANCELOT, 'onMinionMoved', lancelotMoved, { perInstance: true, playerContext: 'sourceController', baseScoped: false });
    registerTrigger(GOOD_DEED, 'onMinionMoved', goodDeedOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase', canTrigger: canTriggerGoodDeedOnMove });
    registerTrigger(THE_FISHER_KING, 'onMinionMoved', fisherKingOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_GRAIL, 'onMinionMoved', grailOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_GREEN_KNIGHT, 'onMinionMoved', greenKnightOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });
    registerTrigger(THE_QUESTING_BEAST, 'onMinionMoved', questingBeastOnMove, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase', canTrigger: canTriggerQuestingBeastOnMove });
    registerTrigger(EXCALIBUR, 'afterScoring', excaliburAfterScoring, { perInstance: true, playerContext: 'sourceController', sourceScope: 'triggerBase' });

    registerProtection(EXCALIBUR, 'destroy', excaliburProtection);
    registerProtection('base_camelot', 'destroy', camelotProtection);
    registerProtection('base_camelot', 'move', camelotProtection);
    registerProtection('base_camelot', 'affect', camelotProtection);
    registerProtection('base_camelot', 'action', camelotProtection);
    registerInterceptor(A_QUESTING, aQuestingReplacement);
    registerInterceptor(GUINEVERE, guinevereActionProtection);
    registerActiveBaseAbility('base_camelot', camelotActive, {
        oncePerTurn: true,
        canUse: camelotCanUse,
    });
}
