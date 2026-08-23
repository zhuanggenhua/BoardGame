import { getAllCardDefs, getBaseDef, getCardDef, getCardDefsByFaction } from '../data/cards';
import { registerAbilityProgram, registerSimpleAbility, type AbilityContext } from '../domain/abilityRegistry';
import { getCurrentTrackedCardTopSnapshot, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import {
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildValidatedCardToDeckBottomEvents,
    buildValidatedMoveEvents,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    changeMinionController,
    createSkipOption,
    findMinionOnBases,
    grantExtraAction,
    inspectDeck,
    revealHand,
    revealDeckTop,
    shuffleHandIntoDeck,
} from '../domain/abilityHelpers';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { registerActionCounter } from '../domain/actionCounter';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { validate } from '../domain/commands';
import { registerProtection, registerTrigger, type ProtectionCheckContext, type TriggerContext } from '../domain/ongoingEffects';
import type { CardInstance, SmashUpCore, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS, type ActionCardDef, type FusionCardDef } from '../domain/types';
import {
    createCardObjectRef,
    createCardObjectRefFromInstance,
    createCardTransferEvent,
} from '../domain/objectProvenance';
import { buildValidatedOngoingDetachEvents } from '../domain/ongoingDetach';
import {
    createPendingActionResolution,
    maybeQueueActionCounterWindow,
} from '../domain/actionCounter';
import { appendResolvedActionAbility, type ExternalActionAbilityContinuationContext } from '../domain/externalActionPlay';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    getPlayerLabel,
    isCardActionLike,
    isSameNameDefId,
    normalizePodDefId,
} from '../domain/utils';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { getResolvedPlayerFactionIds } from '../aiProfiles';

type GeeksPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
    titleKey?: string;
    titleParams?: Record<string, string | number>;
};

type GeeksCosplayPromptContext = GeeksPromptContext & {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
};

type GeeksCosplayChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type GeeksGrieferMode = 'discard' | 'destroy' | 'shuffle';

type GeeksGrieferPromptContext = GeeksPromptContext & {
    cardUid: string;
    opponents: PlayerId[];
    opponentIdx: number;
    targetPlayerId: PlayerId;
};

type GeeksGrieferModeChoice = {
    mode?: GeeksGrieferMode;
};

type GeeksGrieferDestroyChoice = {
    minionUid?: string;
    uid?: string;
    defId?: string;
    minionDefId?: string;
    baseIndex?: number;
};

type GeeksGrieferTargetState = {
    targetPlayerId: PlayerId;
    opponentIdx: number;
    modes: GeeksGrieferMode[];
    destroyOptions: PromptOption<GeeksGrieferDestroyChoice>[];
};

type GeeksMulliganTopCard = {
    uid: string;
    defId: string;
    type: CardInstance['type'];
    owner: PlayerId;
};

type GeeksMulliganPromptContext = GeeksPromptContext & {
    cardUid: string;
    topCards: GeeksMulliganTopCard[];
};

type GeeksMulliganChoice = {
    action?: 'draw' | 'keep';
};

type GeeksBannedListPromptContext = GeeksPromptContext & {
    cardUid: string;
    opponents: PlayerId[];
    opponentIdx: number;
    targetPlayerId: PlayerId;
};

type GeeksBannedListChoice = {
    defId?: string;
};

type GeeksMinMaxingOpponentPromptContext = GeeksPromptContext & {
    cardUid: string;
    opponents: PlayerId[];
};

type GeeksMinMaxingActionPromptContext = GeeksPromptContext & {
    cardUid: string;
    targetPlayerId: PlayerId;
};

type GeeksMinMaxingTargetPromptContext = GeeksMinMaxingActionPromptContext & {
    replayCardUid: string;
    replayDefId: string;
};

type GeeksMinMaxingOpponentChoice = {
    targetPlayerId?: PlayerId;
};

type GeeksMinMaxingActionChoice = {
    cardUid?: string;
    defId?: string;
    skip?: boolean;
};

type GeeksMinMaxingBaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type GeeksMinMaxingMinionChoice = {
    baseIndex?: number;
    minionUid?: string;
    skip?: boolean;
};

type GeeksNonInfiniteLoopActionPromptContext = GeeksPromptContext & {
    cardUid: string;
};

type GeeksNonInfiniteLoopTargetPromptContext = GeeksPromptContext & {
    cardUid: string;
    replayCardUid: string;
    replayDefId: string;
    replayOwnerId: PlayerId;
};

type GeeksNonInfiniteLoopActionChoice = {
    cardUid?: string;
    defId?: string;
    ownerId?: PlayerId;
    skip?: boolean;
};

type GeeksNonInfiniteLoopBaseChoice = {
    baseIndex?: number;
    skip?: boolean;
};

type GeeksNonInfiniteLoopMinionChoice = {
    baseIndex?: number;
    minionUid?: string;
    skip?: boolean;
};

type GeeksRulesLawyerTransferableAction = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    targetType: 'base' | 'minion';
    baseIndex: number;
    minionUid?: string;
    minionDefId?: string;
    label: string;
};

type GeeksRulesLawyerActionPromptContext = GeeksPromptContext & {
    cardUid: string;
    actions: GeeksRulesLawyerTransferableAction[];
};

type GeeksRulesLawyerTargetPromptContext = GeeksPromptContext & {
    cardUid: string;
    movedCardUid: string;
    movedDefId: string;
    movedOwnerId: PlayerId;
    targetType: 'base' | 'minion';
    fromBaseIndex: number;
    fromMinionUid?: string;
};

type GeeksRulesLawyerActionChoice = GeeksRulesLawyerTransferableAction & {
    skip?: boolean;
};

type GeeksRulesLawyerBaseChoice = {
    baseIndex?: number;
};

type GeeksRulesLawyerMinionChoice = {
    baseIndex?: number;
    minionUid?: string;
};

type GeeksControlMinionTriggeredPromptContext = GeeksPromptContext & {
    cardUid: string;
    ownerId: PlayerId;
    targetMinionUid: string;
};

type GeeksControlMinionTriggeredChoice = {
    play?: boolean;
    skip?: boolean;
};

const geeksCosplayPromptProgram = createPromptProgram<GeeksCosplayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_cosplay',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geeks_cosplay_${context.now}`,
        context.playerId,
        '角色扮演：你可以打出这张牌，再获得 1 VP',
        [
            {
                id: 'play',
                label: '打出角色扮演',
                labelKey: 'ui.geeks_cosplay_play_option',
                value: { cardUid: context.cardUid, defId: context.defId },
                displayMode: 'card',
            } satisfies PromptOption<GeeksCosplayChoice>,
            createSkipOption(),
        ],
        { sourceId: 'geeks_cosplay', targetType: 'hand', autoResolveIfSingle: false, titleKey: 'ui.geeks_cosplay_title' },
    ),
    onResolve: ({ context, value, timestamp }) => {
        const choice = value as GeeksCosplayChoice | undefined;
        if (choice?.skip || !choice?.cardUid || !choice?.defId) return { events: [] };
        return {
            events: [
                buildActionPlayedEvent({
                    playerId: context.playerId,
                    cardUid: choice.cardUid,
                    defId: choice.defId,
                    ownerId: context.ownerId,
                    isExtraAction: true,
                    timestamp,
                }),
                {
                    type: SU_EVENTS.VP_AWARDED,
                    payload: {
                        playerId: context.playerId,
                        amount: 1,
                        reason: 'geeks_cosplay',
                    },
                    timestamp,
                },
            ],
        };
    },
});

function geeksGameGuruProtection(ctx: ProtectionCheckContext): boolean {
    if (ctx.targetMinion.defId !== 'geeks_game_guru') return false;
    if (ctx.targetMinion.controller === ctx.sourcePlayerId) return false;
    return ctx.sourceKind !== 'action';
}

function geeksCosplayTrigger(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return { events: [] };
    }
    return executeAbilityProgram(geeksCosplayPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        cardUid: ctx.sourceCardUid,
        defId: 'geeks_cosplay',
        ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
    });
}

function geeksFanSpecial(ctx: AbilityContext) {
    const player = ctx.state.players[ctx.playerId];
    if (!player) return { events: [] };
    const cardInHand = player.hand.find((card) => card.uid === ctx.cardUid && card.defId === 'geeks_fan');
    if (!cardInHand) return { events: [] };
    return {
        events: [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.playerId,
                    cardUids: [ctx.cardUid],
                },
                timestamp: ctx.now,
            },
            ...buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now),
        ],
    };
}

function getOrderedOpponentIds(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    const ordered = state.turnOrder.filter((pid) => pid !== playerId && !!state.players[pid]);
    if (ordered.length > 0) return ordered;
    return Object.keys(state.players).filter((pid) => pid !== playerId) as PlayerId[];
}

function getCurrentDeckTopSnapshotCards<T extends { uid: string; defId: string }>(
    state: SmashUpCore,
    playerId: PlayerId,
    trackedCards: T[],
): T[] {
    return getCurrentTrackedCardTopSnapshot(state.players[playerId]?.deck ?? [], trackedCards);
}

function buildGeeksBannedListNameOptions(
    matchState: MatchState<SmashUpCore>,
): PromptOption<GeeksBannedListChoice>[] {
    const currentFactionIds = Array.from(new Set(
        Object.keys(matchState.core.players).flatMap((playerId) => getResolvedPlayerFactionIds(matchState, playerId as PlayerId)),
    ));
    const seen = new Set<string>();
    const candidateCards = currentFactionIds.length > 0
        ? currentFactionIds.flatMap((factionId) => getCardDefsByFaction(factionId))
        : getAllCardDefs();

    return candidateCards
        .filter((card) => card.type === 'minion' || card.type === 'action' || card.type === 'fusion')
        .filter((card) => {
            const normalized = normalizePodDefId(card.id) ?? card.id;
            if (seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        })
        .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id, 'zh-CN'))
        .map((card, index) => ({
            id: `card-name-${index}`,
            label: card.name ?? card.id,
            value: { defId: normalizePodDefId(card.id) ?? card.id },
            displayMode: 'card',
        }));
}

function buildGeeksFeliciaDayMoveEvents(
    state: SmashUpCore,
    sourcePlayerId: PlayerId,
    sourceCardUid: string,
    targetBaseIndex: number,
    now: number,
): SmashUpEvent[] {
    const batchId = `geeks_felicia_day:${targetBaseIndex}:${now}`;
    const events: SmashUpEvent[] = [];

    for (let fromBaseIndex = 0; fromBaseIndex < state.bases.length; fromBaseIndex += 1) {
        if (fromBaseIndex === targetBaseIndex) continue;
        const base = state.bases[fromBaseIndex];
        for (const minion of base.minions) {
            events.push(...buildValidatedMoveEvents(state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex,
                toBaseIndex: targetBaseIndex,
                batchId,
                sourcePlayerId: sourcePlayerId,
                sourceCardUid: sourceCardUid,
                sourceDefId: 'geeks_felicia_day',
                sourceControllerId: sourcePlayerId,
                sourceBaseIndex: targetBaseIndex,
                sourceKind: 'nonAction',
                reason: 'geeks_felicia_day',
                now,
            }));
        }
    }

    return events;
}

function buildGeeksTemporaryControlMetadataEvent(
    minionUid: string,
    baseIndex: number,
    originalController: PlayerId,
    controller: PlayerId,
    turnNumber: number,
    endsOnTurnEndPlayerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid,
            baseIndex,
            metadataUpdate: {
                temporaryControlOriginalController: originalController,
                temporaryControlPlayerId: controller,
                temporaryControlTurn: turnNumber,
                temporaryControlEndsOnTurnEndPlayerId: endsOnTurnEndPlayerId,
            },
            reason,
        },
        timestamp: now,
    };
}

function buildGeeksControlMinionEffectEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    minionUid: string,
    endsOnTurnEndPlayerId: PlayerId,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const found = findMinionOnBases(state, minionUid);
    if (!found) return [];
    if (found.minion.controller === playerId) return [];
    return [
        changeMinionController(
            found.minion.uid,
            found.minion.defId,
            found.baseIndex,
            found.minion.owner,
            found.minion.controller,
            playerId,
            playerId,
            reason,
            now,
        ),
        buildGeeksTemporaryControlMetadataEvent(
            found.minion.uid,
            found.baseIndex,
            found.minion.controller,
            playerId,
            state.turnNumber,
            endsOnTurnEndPlayerId,
            reason,
            now,
        ),
    ];
}

function getGeeksBannedListOpponentIds(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    return getOrderedOpponentIds(state, playerId).filter((pid) => (state.players[pid]?.hand.length ?? 0) > 0);
}

function getNextGeeksBannedListTargetState(
    state: SmashUpCore,
    opponents: PlayerId[],
    startIndex: number,
): { targetPlayerId: PlayerId; opponentIdx: number } | null {
    for (let index = startIndex; index < opponents.length; index += 1) {
        const targetPlayerId = opponents[index];
        if ((state.players[targetPlayerId]?.hand.length ?? 0) > 0) {
            return { targetPlayerId, opponentIdx: index };
        }
    }
    return null;
}

function createGeeksBannedListPromptContext(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    cardUid: string,
    opponents: PlayerId[],
    targetState: { targetPlayerId: PlayerId; opponentIdx: number },
): GeeksBannedListPromptContext {
    return {
        matchState,
        playerId,
        now,
        cardUid,
        opponents,
        opponentIdx: targetState.opponentIdx,
        targetPlayerId: targetState.targetPlayerId,
    };
}

function getGeeksImmediateActionTargetMode(def: ActionCardDef | FusionCardDef): 'none' | 'base' | 'minion' {
    const subtype = def.type === 'fusion' ? def.actionSubtype : def.subtype;
    if (subtype === 'ongoing') {
        const ongoingTarget = def.type === 'fusion'
            ? (def.actionOngoingTarget ?? 'base')
            : (def.ongoingTarget ?? 'base');
        return ongoingTarget === 'minion' ? 'minion' : 'base';
    }
    if (actionLikeNeedsPlayMinion(def)) return 'minion';
    if (actionLikeNeedsPlayBase(def)) return 'base';
    return 'none';
}

function buildGeeksMinMaxingBorrowEvent(
    targetPlayerId: PlayerId,
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    now: number,
): SmashUpEvent {
    return createCardTransferEvent({
        card: createCardObjectRef({
            uid: cardUid,
            defId,
            ownerId,
        }),
        fromPlayerId: targetPlayerId,
        toPlayerId: playerId,
        reason: 'geeks_min_maxing',
        timestamp: now,
    });
}

function getTransientCardType(defId: string): CardInstance['type'] {
    const def = getCardDef(defId);
    if (def?.type === 'action' || def?.type === 'fusion' || def?.type === 'titan') {
        return def.type;
    }
    return 'minion';
}

function buildGeeksExtraActionTransientMatchState(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
): MatchState<SmashUpCore> {
    const player = matchState.core.players[playerId];
    if (!player) return matchState;
    return {
        ...matchState,
        core: {
            ...matchState.core,
            players: {
                ...matchState.core.players,
                [playerId]: {
                    ...player,
                    actionLimit: player.actionLimit + 1,
                },
            },
        },
    };
}

function buildGeeksMinMaxingTransientMatchState(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    targetPlayerId: PlayerId,
    cardUid: string,
    defId: string,
): MatchState<SmashUpCore> {
    const player = matchState.core.players[playerId];
    const targetPlayer = matchState.core.players[targetPlayerId];
    if (!player || !targetPlayer) return matchState;

    const borrowedCard: CardInstance = targetPlayer.hand.find((card) => card.uid === cardUid) ?? {
        uid: cardUid,
        defId,
        type: getTransientCardType(defId),
        owner: targetPlayerId,
    };
    const targetHand = targetPlayer.hand.filter((card) => card.uid !== cardUid);
    const playerHandWithoutBorrowed = player.hand.filter((card) => card.uid !== cardUid);

    return {
        ...matchState,
        core: {
            ...matchState.core,
            players: {
                ...matchState.core.players,
                [targetPlayerId]: {
                    ...targetPlayer,
                    hand: targetHand,
                },
                [playerId]: {
                    ...player,
                    hand: [...playerHandWithoutBorrowed, borrowedCard],
                    actionLimit: player.actionLimit + 1,
                },
            },
        },
    };
}

function buildGeeksMinMaxingBaseOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    targetPlayerId: PlayerId,
    replayCardUid: string,
    replayDefId: string,
    now: number,
): PromptOption<GeeksMinMaxingBaseChoice>[] {
    const borrowedState = buildGeeksMinMaxingTransientMatchState(
        matchState,
        playerId,
        targetPlayerId,
        replayCardUid,
        replayDefId,
    );
    const candidates = borrowedState.core.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter((candidate) => validate(borrowedState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid: replayCardUid, targetBaseIndex: candidate.baseIndex },
        }).valid);

    return [
        ...buildBaseTargetOptions(candidates, borrowedState.core) as PromptOption<GeeksMinMaxingBaseChoice>[],
        createSkipOption('放弃打出这张牌', 'ui.geeks_skip_replay_card_option') as PromptOption<GeeksMinMaxingBaseChoice>,
    ];
}

function buildGeeksMinMaxingMinionOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    targetPlayerId: PlayerId,
    replayCardUid: string,
    replayDefId: string,
    now: number,
): PromptOption<GeeksMinMaxingMinionChoice>[] {
    const borrowedState = buildGeeksMinMaxingTransientMatchState(
        matchState,
        playerId,
        targetPlayerId,
        replayCardUid,
        replayDefId,
    );
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < borrowedState.core.bases.length; baseIndex += 1) {
        const base = borrowedState.core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (!validate(borrowedState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId,
                payload: { cardUid: replayCardUid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
            }).valid) {
                continue;
            }
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }

    return [
        ...buildMinionTargetOptions(candidates, { state: borrowedState.core }) as PromptOption<GeeksMinMaxingMinionChoice>[],
        createSkipOption('放弃打出这张牌', 'ui.geeks_skip_replay_card_option') as PromptOption<GeeksMinMaxingMinionChoice>,
    ];
}

function buildGeeksMinMaxingActionOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    targetPlayerId: PlayerId,
    now: number,
): PromptOption<GeeksMinMaxingActionChoice>[] {
    const targetPlayer = matchState.core.players[targetPlayerId];
    if (!targetPlayer) {
        return [createSkipOption('放弃额外打牌', 'ui.geeks_skip_extra_action_option') as PromptOption<GeeksMinMaxingActionChoice>];
    }

    const options = targetPlayer.hand
        .filter((card) => isCardActionLike(card))
        .flatMap((card, index) => {
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return [];
            const targetMode = getGeeksImmediateActionTargetMode(def);
            const borrowedState = buildGeeksMinMaxingTransientMatchState(
                matchState,
                playerId,
                targetPlayerId,
                card.uid,
                card.defId,
            );

            const playable = targetMode === 'none'
                ? validate(borrowedState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId,
                    payload: { cardUid: card.uid },
                }).valid
                : targetMode === 'base'
                    ? borrowedState.core.bases.some((_base, baseIndex) => validate(borrowedState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex },
                    }).valid)
                    : borrowedState.core.bases.some((base, baseIndex) => base.minions.some((minion) => validate(borrowedState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                    }).valid));

            if (!playable) return [];

            return [{
                id: `action-${index}`,
                label: def.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            } satisfies PromptOption<GeeksMinMaxingActionChoice>];
        });

    return [...options, createSkipOption('放弃额外打牌', 'ui.geeks_skip_extra_action_option') as PromptOption<GeeksMinMaxingActionChoice>];
}

function buildGeeksMinMaxingOpponentOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
): PromptOption<GeeksMinMaxingOpponentChoice>[] {
    return getOrderedOpponentIds(matchState.core, playerId)
        .filter((targetPlayerId) => buildGeeksMinMaxingActionOptions(matchState, playerId, targetPlayerId, now).some((option) => !option.value?.skip))
        .map((targetPlayerId, index) => ({
            id: `opponent-${index}`,
            label: getPlayerLabel(targetPlayerId),
            value: { targetPlayerId },
            displayMode: 'button',
        }));
}

function executeGeeksMinMaxingPlay(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    targetPlayerId: PlayerId,
    replayCardUid: string,
    replayDefId: string,
    timestamp: number,
    random: RandomFn,
    targetBaseIndex?: number,
    targetMinionUid?: string,
): { matchState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const extraActionEvent = grantExtraAction(playerId, 'geeks_min_maxing', timestamp);
    const borrowedState = buildGeeksMinMaxingTransientMatchState(state, playerId, targetPlayerId, replayCardUid, replayDefId);
    const validation = validate(borrowedState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId,
        payload: { cardUid: replayCardUid, targetBaseIndex, targetMinionUid },
    });
    if (!validation.valid) {
        return { matchState: state, events: [] };
    }

    const replayOwnerId = state.core.players[targetPlayerId]?.hand.find(card => card.uid === replayCardUid)?.owner ?? targetPlayerId;
    const borrowEvent = buildGeeksMinMaxingBorrowEvent(targetPlayerId, playerId, replayCardUid, replayDefId, replayOwnerId, timestamp);
    const actionPlayedEvent = buildActionPlayedEvent({
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        ownerId: replayOwnerId,
        targetBaseIndex,
        targetMinionUid,
        sourceCommandType: SU_COMMANDS.PLAY_ACTION,
        timestamp,
    }) as SmashUpEvent;
    const baseEvents = [extraActionEvent, borrowEvent, actionPlayedEvent];
    const pending = createPendingActionResolution({
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        ownerId: replayOwnerId,
        targetBaseIndex,
        targetMinionUid,
        now: timestamp,
    });
    const counterWindowState = maybeQueueActionCounterWindow(state, pending, timestamp);
    if (counterWindowState) {
        return { matchState: counterWindowState, events: baseEvents };
    }

    const actionDef = getCardDef(replayDefId) as ActionCardDef | FusionCardDef | undefined;
    const actionEvents = [...baseEvents];
    if (actionDef && getGeeksActionLikeSubtype(actionDef) === 'ongoing') {
        actionEvents.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: replayCardUid,
            defId: replayDefId,
            ownerId: replayOwnerId,
            ...(replayOwnerId !== playerId ? { sourcePlayerId: playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: targetBaseIndex ?? 0,
            targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now: timestamp,
        }));
    }

    const appended = appendResolvedActionAbility({
        state,
        events: actionEvents,
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        random,
        timestamp,
        baseIndex: targetBaseIndex ?? 0,
        targetBaseIndex,
        targetMinionUid,
    });
    return {
        matchState: appended.state,
        events: appended.events,
    };
}

function getGeeksActionLikeSubtype(def: ActionCardDef | FusionCardDef): ActionCardDef['subtype'] {
    return def.type === 'fusion' ? def.actionSubtype : def.subtype;
}

function getGeeksNonInfiniteLoopReplayableAction(card: CardInstance): ActionCardDef | FusionCardDef | undefined {
    if (!isCardActionLike(card)) return undefined;
    const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!def) return undefined;
    return getGeeksActionLikeSubtype(def) === 'standard' ? def : undefined;
}

function buildGeeksNonInfiniteLoopTransientMatchState(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
): MatchState<SmashUpCore> {
    return buildGeeksExtraActionTransientMatchState(matchState, playerId);
}

function buildGeeksNonInfiniteLoopActionOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    excludedCardUid?: string,
): PromptOption<GeeksNonInfiniteLoopActionChoice>[] {
    const player = matchState.core.players[playerId];
    if (!player) {
        return [createSkipOption('放弃额外打牌', 'ui.geeks_skip_extra_action_option') as PromptOption<GeeksNonInfiniteLoopActionChoice>];
    }

    const preparedState = buildGeeksNonInfiniteLoopTransientMatchState(matchState, playerId);
    const options = player.hand.flatMap((card) => {
        if (card.uid === excludedCardUid) return [];
        const def = getGeeksNonInfiniteLoopReplayableAction(card);
        if (!def) return [];
        const targetMode = getGeeksImmediateActionTargetMode(def);

        const playable = targetMode === 'none'
            ? validate(preparedState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId,
                payload: { cardUid: card.uid },
            }).valid
            : targetMode === 'base'
                ? preparedState.core.bases.some((_base, baseIndex) => validate(preparedState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId,
                    payload: { cardUid: card.uid, targetBaseIndex: baseIndex },
                }).valid)
                : preparedState.core.bases.some((base, baseIndex) => base.minions.some((minion) => validate(preparedState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId,
                    payload: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                }).valid));

        if (!playable) return [];

        return [{
            id: `action-${card.uid}`,
            label: def.name ?? card.defId,
            value: {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
            },
            displayMode: 'card' as const,
        } satisfies PromptOption<GeeksNonInfiniteLoopActionChoice>];
    });

    return [...options, createSkipOption('放弃额外打牌', 'ui.geeks_skip_extra_action_option') as PromptOption<GeeksNonInfiniteLoopActionChoice>];
}

function buildGeeksNonInfiniteLoopBaseOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    replayCardUid: string,
    now: number,
): PromptOption<GeeksNonInfiniteLoopBaseChoice>[] {
    const preparedState = buildGeeksNonInfiniteLoopTransientMatchState(matchState, playerId);
    const candidates = preparedState.core.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter((candidate) => validate(preparedState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid: replayCardUid, targetBaseIndex: candidate.baseIndex },
        }).valid);

    return [
        ...buildBaseTargetOptions(candidates, preparedState.core) as PromptOption<GeeksNonInfiniteLoopBaseChoice>[],
        createSkipOption('放弃打出这张牌', 'ui.geeks_skip_replay_card_option') as PromptOption<GeeksNonInfiniteLoopBaseChoice>,
    ];
}

function buildGeeksNonInfiniteLoopMinionOptions(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    replayCardUid: string,
    now: number,
): PromptOption<GeeksNonInfiniteLoopMinionChoice>[] {
    const preparedState = buildGeeksNonInfiniteLoopTransientMatchState(matchState, playerId);
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < preparedState.core.bases.length; baseIndex += 1) {
        const base = preparedState.core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (!validate(preparedState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId,
                payload: { cardUid: replayCardUid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
            }).valid) {
                continue;
            }
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }

    return [
        ...buildMinionTargetOptions(candidates, { state: preparedState.core }) as PromptOption<GeeksNonInfiniteLoopMinionChoice>[],
        createSkipOption('放弃打出这张牌', 'ui.geeks_skip_replay_card_option') as PromptOption<GeeksNonInfiniteLoopMinionChoice>,
    ];
}

function buildGeeksNonInfiniteLoopReturnToHandEvent(
    playerId: PlayerId,
    cardUid: string,
    defId: string,
    ownerId: PlayerId,
    timestamp: number,
): SmashUpEvent {
    return {
        type: SU_EVENTS.ACTION_RETURN_TO_HAND_OPTION_ARMED,
        payload: {
            playerId,
            cardUid,
            defId,
            ownerId,
            reason: 'geeks_non_infinite_loop',
        },
        timestamp,
    } as SmashUpEvent;
}

type GeeksNonInfiniteLoopReturnAfterActionContext = ExternalActionAbilityContinuationContext & {
    afterActionContext?: Record<string, unknown>;
};

const geeksNonInfiniteLoopReturnAfterActionProgram = createEffectProgram<
    GeeksNonInfiniteLoopReturnAfterActionContext,
    SmashUpCore,
    SmashUpEvent
>((context) => {
    const ownerId = typeof context.afterActionContext?.returnOwnerId === 'string'
        ? context.afterActionContext.returnOwnerId as PlayerId
        : context.playerId;
    return {
        events: [
            buildGeeksNonInfiniteLoopReturnToHandEvent(
                context.playerId,
                context.cardUid,
                context.defId,
                ownerId,
                context.timestamp,
            ),
        ],
    };
});

function executeGeeksNonInfiniteLoopPlay(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    replayCardUid: string,
    replayDefId: string,
    replayOwnerId: PlayerId,
    timestamp: number,
    random: RandomFn,
    targetBaseIndex?: number,
    targetMinionUid?: string,
): { matchState: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const extraActionEvent = grantExtraAction(playerId, 'geeks_non_infinite_loop', timestamp);
    const preparedState = buildGeeksNonInfiniteLoopTransientMatchState(state, playerId);
    const validation = validate(preparedState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId,
        payload: { cardUid: replayCardUid, targetBaseIndex, targetMinionUid },
    });
    if (!validation.valid) {
        return { matchState: state, events: [] };
    }

    const actionPlayedEvent = buildActionPlayedEvent({
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        ownerId: replayOwnerId,
        targetBaseIndex,
        targetMinionUid,
        sourceCommandType: SU_COMMANDS.PLAY_ACTION,
        timestamp,
    }) as SmashUpEvent;
    const returnToHandEvent = buildGeeksNonInfiniteLoopReturnToHandEvent(
        playerId,
        replayCardUid,
        replayDefId,
        replayOwnerId,
        timestamp,
    );
    const baseEvents = [extraActionEvent, actionPlayedEvent];
    const pending = createPendingActionResolution({
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        ownerId: replayOwnerId,
        targetBaseIndex,
        targetMinionUid,
        now: timestamp,
        afterResolutionEvents: [returnToHandEvent],
    });
    const counterWindowState = maybeQueueActionCounterWindow(state, pending, timestamp);
    if (counterWindowState) {
        return { matchState: counterWindowState, events: baseEvents };
    }

    const actionDef = getCardDef(replayDefId) as ActionCardDef | FusionCardDef | undefined;
    const actionEvents = [...baseEvents];
    if (actionDef && getGeeksActionLikeSubtype(actionDef) === 'ongoing') {
        actionEvents.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: replayCardUid,
            defId: replayDefId,
            ownerId: replayOwnerId,
            ...(replayOwnerId !== playerId ? { sourcePlayerId: playerId } : {}),
            sourceKind: 'action',
            targetBaseIndex: targetBaseIndex ?? 0,
            targetMinionUid,
            onBlockedSourceDestination: 'discard',
            now: timestamp,
        }));
    }

    const appended = appendResolvedActionAbility({
        state,
        events: actionEvents,
        playerId,
        cardUid: replayCardUid,
        defId: replayDefId,
        random,
        timestamp,
        baseIndex: targetBaseIndex ?? 0,
        targetBaseIndex,
        targetMinionUid,
        afterActionContext: {
            returnOwnerId: replayOwnerId,
        },
        afterActionProgram: geeksNonInfiniteLoopReturnAfterActionProgram,
    });
    return {
        matchState: appended.state,
        events: appended.events,
    };
}

function buildGeeksRulesLawyerBaseCandidates(
    state: SmashUpCore,
    fromBaseIndex: number,
): Array<{ baseIndex: number; label: string }> {
    return state.bases
        .map((base, baseIndex) => ({
            baseIndex,
            label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
        }))
        .filter((candidate) => candidate.baseIndex !== fromBaseIndex);
}

function buildGeeksRulesLawyerMinionCandidates(
    state: SmashUpCore,
    playerId: PlayerId,
    fromMinionUid: string,
): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        for (const minion of base.minions) {
            if (minion.uid === fromMinionUid) continue;
            const option = buildMinionTargetOptions([{
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
            }], {
                state,
                sourcePlayerId: playerId,
                sourceKind: 'action',
                effectType: 'affect',
            });
            if (option.length === 0) continue;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} @ ${getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`}`,
            });
        }
    }
    return candidates;
}

function collectGeeksRulesLawyerTransferableActions(
    state: SmashUpCore,
    playerId: PlayerId,
): GeeksRulesLawyerTransferableAction[] {
    const actions: GeeksRulesLawyerTransferableAction[] = [];
    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;

        if (buildGeeksRulesLawyerBaseCandidates(state, baseIndex).length > 0) {
            for (const action of base.ongoingActions) {
                actions.push({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    targetType: 'base',
                    baseIndex,
                    label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${baseName}`,
                });
            }
        }

        for (const minion of base.minions) {
            const targetCandidates = buildGeeksRulesLawyerMinionCandidates(state, playerId, minion.uid);
            if (targetCandidates.length === 0) continue;
            for (const action of minion.attachedActions) {
                actions.push({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    targetType: 'minion',
                    baseIndex,
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    label: `${getCardDef(action.defId)?.name ?? action.defId} @ ${getCardDef(minion.defId)?.name ?? minion.defId}`,
                });
            }
        }
    }
    return actions;
}

function getGeeksRulesLawyerSourceAction(
    state: SmashUpCore,
    context: GeeksRulesLawyerTargetPromptContext,
): { metadata?: Record<string, unknown>; talentUsed?: boolean } | undefined {
    if (context.targetType === 'base') {
        return state.bases[context.fromBaseIndex]?.ongoingActions.find((action) => action.uid === context.movedCardUid);
    }
    const attached = state.bases[context.fromBaseIndex]?.minions
        .find((minion) => minion.uid === context.fromMinionUid)
        ?.attachedActions
        .find((action) => action.uid === context.movedCardUid);
    return attached as { metadata?: Record<string, unknown>; talentUsed?: boolean } | undefined;
}

function buildGeeksMulliganReveal(
    state: SmashUpCore,
    playerId: PlayerId,
    random: RandomFn,
    now: number,
): { events: SmashUpEvent[]; topCards: GeeksMulliganTopCard[] } {
    const player = state.players[playerId];
    if (!player) return { events: [], topCards: [] };

    let deckSim = [...player.deck];
    const events: SmashUpEvent[] = [];

    if (deckSim.length < 5 && player.discard.length > 0) {
        const shuffledDiscard = random.shuffle([...player.discard]);
        const sourceDiscardCards: CardInstance[] = [];
        const borrowedByOwner = new Map<PlayerId, CardInstance[]>();

        for (const card of shuffledDiscard) {
            if (card.owner === playerId || !state.players[card.owner]) {
                sourceDiscardCards.push(card);
                continue;
            }
            borrowedByOwner.set(card.owner, [...(borrowedByOwner.get(card.owner) ?? []), card]);
        }

        for (const [ownerId, cards] of borrowedByOwner) {
            const owner = state.players[ownerId];
            if (!owner) continue;
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: [...owner.deck.map((card) => card.uid), ...cards.map((card) => card.uid)],
                    sourcePlayerId: playerId,
                },
                timestamp: now,
            });
        }

        deckSim = [...deckSim, ...sourceDiscardCards];
        if (sourceDiscardCards.length > 0) {
            events.push({
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId,
                    deckUids: deckSim.map((card) => card.uid),
                },
                timestamp: now,
            });
        }
    }

    const topCards = deckSim.slice(0, 5).map((card) => ({
        uid: card.uid,
        defId: card.defId,
        type: card.type,
        owner: card.owner,
    }));

    if (topCards.length === 0) {
        return { events, topCards };
    }

    events.push(inspectDeck(playerId, playerId, topCards.length, 'geeks_mulligan', now));
    events.push(revealDeckTop(
        playerId,
        playerId,
        topCards.map((card) => ({ uid: card.uid, defId: card.defId })),
        topCards.length,
        'geeks_mulligan',
        now,
        playerId,
    ));

    return { events, topCards };
}

function buildGeeksGrieferDestroyOptions(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
): PromptOption<GeeksGrieferDestroyChoice>[] {
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];

    for (let baseIndex = 0; baseIndex < state.bases.length; baseIndex += 1) {
        const base = state.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (minion.controller !== targetPlayerId) continue;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        }
    }

    return buildMinionTargetOptions(candidates, {
        state,
        sourcePlayerId: targetPlayerId,
        effectType: 'destroy',
    }).map((option) => ({
        ...option,
        displayMode: 'card',
    }));
}

function getGeeksGrieferTargetState(
    state: SmashUpCore,
    opponents: PlayerId[],
    startIndex: number,
): GeeksGrieferTargetState | null {
    for (let index = startIndex; index < opponents.length; index += 1) {
        const targetPlayerId = opponents[index];
        const targetPlayer = state.players[targetPlayerId];
        if (!targetPlayer) continue;

        const destroyOptions = buildGeeksGrieferDestroyOptions(state, targetPlayerId);
        const modes: GeeksGrieferMode[] = [];
        if (targetPlayer.hand.length > 0) modes.push('discard');
        if (destroyOptions.length > 0) modes.push('destroy');
        if (targetPlayer.discard.length > 0) modes.push('shuffle');

        if (modes.length > 0) {
            return {
                targetPlayerId,
                opponentIdx: index,
                modes,
                destroyOptions,
            };
        }
    }

    return null;
}

function createGeeksGrieferPromptContext(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    cardUid: string,
    opponents: PlayerId[],
    targetState: GeeksGrieferTargetState,
): GeeksGrieferPromptContext {
    return {
        matchState,
        playerId,
        now,
        cardUid,
        opponents,
        opponentIdx: targetState.opponentIdx,
        targetPlayerId: targetState.targetPlayerId,
    };
}

function buildGeeksGrieferModeOptions(targetState: GeeksGrieferTargetState): PromptOption<GeeksGrieferModeChoice>[] {
    const playerLabel = getPlayerLabel(targetState.targetPlayerId);
    return targetState.modes.map((mode, index) => ({
        id: `mode-${index}`,
        label: mode === 'discard'
            ? `${playerLabel}随机弃 1 张牌`
            : mode === 'destroy'
                ? `${playerLabel}消灭 1 个自己的随从`
                : `${playerLabel}将弃牌堆洗回牌库`,
        value: { mode },
        displayMode: 'button',
    }));
}

function getSelectedGeeksGrieferDestroyChoice(value: unknown): GeeksGrieferDestroyChoice | null {
    if (!value || typeof value !== 'object') return null;
    const choice = value as GeeksGrieferDestroyChoice;
    const minionUid = typeof choice.minionUid === 'string'
        ? choice.minionUid
        : typeof choice.uid === 'string'
            ? choice.uid
            : undefined;
    const defId = typeof choice.defId === 'string'
        ? choice.defId
        : typeof choice.minionDefId === 'string'
            ? choice.minionDefId
            : undefined;
    if (!minionUid || !defId || typeof choice.baseIndex !== 'number') return null;
    return {
        minionUid,
        defId,
        baseIndex: choice.baseIndex,
    };
}

function buildGeeksGrieferDiscardEvents(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    now: number,
    random: RandomFn,
): SmashUpEvent[] {
    const targetPlayer = state.players[targetPlayerId];
    if (!targetPlayer || targetPlayer.hand.length === 0) return [];
    const discardIndex = Math.floor(random.random() * targetPlayer.hand.length);
    const discardedCard = targetPlayer.hand[discardIndex];
    if (!discardedCard) return [];
    return [{
        type: SU_EVENTS.CARDS_DISCARDED,
        payload: {
            playerId: targetPlayerId,
            cardUids: [discardedCard.uid],
        },
        timestamp: now,
    }];
}

function buildGeeksGrieferShuffleEvents(
    state: SmashUpCore,
    targetPlayerId: PlayerId,
    now: number,
    random: RandomFn,
): SmashUpEvent[] {
    const targetPlayer = state.players[targetPlayerId];
    if (!targetPlayer || targetPlayer.discard.length === 0) return [];
    const shuffledDeck = random.shuffle([...targetPlayer.deck, ...targetPlayer.discard]);
    return [{
        type: SU_EVENTS.DECK_REORDERED,
        payload: {
            playerId: targetPlayerId,
            deckUids: shuffledDeck.map((card) => card.uid),
        },
        timestamp: now,
    }];
}

function getNextGeeksGrieferStep(
    matchState: MatchState<SmashUpCore>,
    context: GeeksGrieferPromptContext,
    now: number,
) {
    const nextOpponentIdx = context.opponentIdx + 1;
    if (nextOpponentIdx >= context.opponents.length) return null;
    const nextTargetPlayerId = context.opponents[nextOpponentIdx];
    if (!nextTargetPlayerId) return null;
    return {
        ...context,
        matchState,
        now,
        opponentIdx: nextOpponentIdx,
        targetPlayerId: nextTargetPlayerId,
    };
}

function continueGeeksGrieferAfterEvents(
    state: MatchState<SmashUpCore>,
    context: GeeksGrieferPromptContext,
    events: SmashUpEvent[],
    now: number,
) {
    const nextContext = getNextGeeksGrieferStep(state, context, now);
    if (!nextContext) return { events };
    return {
        events,
        context: nextContext,
        nextProgram: geeksGrieferStepProgram,
    };
}

const geeksGrieferDestroyPromptProgram = createPromptProgram<GeeksGrieferPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_griefer_destroy',
    buildInteraction: (context) => {
        const options = buildGeeksGrieferDestroyOptions(context.matchState.core, context.targetPlayerId);
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_griefer_destroy_${context.targetPlayerId}_${context.now}`,
            context.playerId,
            `嘲讽：选择${getPlayerLabel(context.targetPlayerId)}要消灭的己方随从`,
            options,
            {
                sourceId: 'geeks_griefer_destroy',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksGrieferDestroyOptions(
            state.core as SmashUpCore,
            context.targetPlayerId,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = getSelectedGeeksGrieferDestroyChoice(value);
        const events = choice
            ? buildValidatedDestroyEvents(state, {
                minionUid: choice.minionUid!,
                minionDefId: choice.defId!,
                fromBaseIndex: choice.baseIndex!,
                destroyerId: context.targetPlayerId,
                sourcePlayerId: context.targetPlayerId,
                sourceCardUid: context.cardUid,
                sourceDefId: 'geeks_griefer',
                sourceControllerId: context.targetPlayerId,
                reason: 'geeks_griefer',
                now: timestamp,
                sourceKind: 'action',
            })
            : [];
        return continueGeeksGrieferAfterEvents(state, context, events, timestamp);
    },
});

const geeksGrieferModePromptProgram = createPromptProgram<GeeksGrieferPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_griefer',
    buildInteraction: (context) => {
        const targetState = getGeeksGrieferTargetState(
            context.matchState.core,
            context.opponents,
            context.opponentIdx,
        );
        const effectiveTargetState = targetState ?? {
            targetPlayerId: context.targetPlayerId,
            opponentIdx: context.opponentIdx,
            modes: [] as GeeksGrieferMode[],
            destroyOptions: [] as PromptOption<GeeksGrieferDestroyChoice>[],
        };
        return createAbilityRuntimeSimpleChoice(
            `geeks_griefer_${context.targetPlayerId}_${context.now}`,
            context.playerId,
            `嘲讽：选择对${getPlayerLabel(context.targetPlayerId)}执行的效果`,
            buildGeeksGrieferModeOptions(effectiveTargetState),
            {
                sourceId: 'geeks_griefer',
                targetType: 'button',
            },
        );
    },
    onResolve: ({ context, state, value, random, timestamp }) => {
        const mode = (value as GeeksGrieferModeChoice | undefined)?.mode;
        if (mode === 'discard') {
            return continueGeeksGrieferAfterEvents(
                state,
                context,
                buildGeeksGrieferDiscardEvents(state.core, context.targetPlayerId, timestamp, random),
                timestamp,
            );
        }

        if (mode === 'shuffle') {
            return continueGeeksGrieferAfterEvents(
                state,
                context,
                buildGeeksGrieferShuffleEvents(state.core, context.targetPlayerId, timestamp, random),
                timestamp,
            );
        }

        if (mode === 'destroy') {
            const destroyOptions = buildGeeksGrieferDestroyOptions(state.core, context.targetPlayerId);
            if (destroyOptions.length > 0) {
                return {
                    events: [],
                    context: {
                        ...context,
                        matchState: state,
                        now: timestamp,
                    },
                    nextProgram: geeksGrieferDestroyPromptProgram,
                };
            }
        }

        return continueGeeksGrieferAfterEvents(state, context, [], timestamp);
    },
});

const geeksGrieferStepProgram = createEffectProgram<GeeksGrieferPromptContext, SmashUpCore, SmashUpEvent>((context) => {
    const targetState = getGeeksGrieferTargetState(
        context.matchState.core,
        context.opponents,
        context.opponentIdx,
    );
    if (!targetState) {
        return { events: [] };
    }

    const effectiveContext = createGeeksGrieferPromptContext(
        context.matchState,
        context.playerId,
        context.now,
        context.cardUid,
        context.opponents,
        targetState,
    );

    if (targetState.modes.length > 1) {
        return {
            events: [],
            context: effectiveContext,
            nextProgram: geeksGrieferModePromptProgram,
        };
    }

    const onlyMode = targetState.modes[0];
    if (onlyMode === 'destroy' && targetState.destroyOptions.length > 0) {
        return {
            events: [],
            context: effectiveContext,
            nextProgram: geeksGrieferDestroyPromptProgram,
        };
    }

    return {
        events: [],
        context: effectiveContext,
        nextProgram: geeksGrieferModePromptProgram,
    };
});

const geeksGrieferProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = getOrderedOpponentIds(ctx.state, ctx.playerId);
    const targetState = getGeeksGrieferTargetState(ctx.state, opponents, 0);
    if (!targetState) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createGeeksGrieferPromptContext(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            ctx.cardUid,
            opponents,
            targetState,
        ),
        nextProgram: geeksGrieferStepProgram,
    };
});

const geeksMulliganPromptProgram = createPromptProgram<GeeksMulliganPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_mulligan',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geeks_mulligan_${context.now}`,
        context.playerId,
        `Mulligan：查看牌库顶 ${context.topCards.length} 张后，选择是否全部加入手牌`,
        [
            {
                id: 'draw',
                label: '全部加入手牌',
                labelKey: 'ui.geeks_mulligan_draw_all_option',
                value: { action: 'draw' },
                displayMode: 'button',
            } satisfies PromptOption<GeeksMulliganChoice>,
            {
                id: 'keep',
                label: '保持原样',
                labelKey: 'ui.geeks_mulligan_keep_option',
                value: { action: 'keep' },
                displayMode: 'button',
            } satisfies PromptOption<GeeksMulliganChoice>,
        ],
        {
            sourceId: 'geeks_mulligan',
            targetType: 'button',
            titleKey: 'ui.geeks_mulligan_title',
            titleParams: { count: context.topCards.length },
        },
    ),
    onResolve: ({ context, state, value, random, timestamp }) => {
        const action = (value as GeeksMulliganChoice | undefined)?.action;
        if (action !== 'draw') {
            return { events: [], matchState: state };
        }

        const currentTopCards = getCurrentDeckTopSnapshotCards(
            state.core,
            context.playerId,
            context.topCards,
        );
        if (currentTopCards.length === 0) {
            return { events: [], matchState: state };
        }

        const player = state.core.players[context.playerId];
        if (!player) {
            return { events: [], matchState: state };
        }

        const topCardUidSet = new Set(currentTopCards.map((card) => card.uid));
        const remainingDeck = player.deck.filter((card) => !topCardUidSet.has(card.uid));
        const reshuffledDeck = random.shuffle([...remainingDeck, ...player.hand]);

        return {
            events: [
                {
                    type: SU_EVENTS.CARDS_DRAWN,
                    payload: {
                        playerId: context.playerId,
                        count: currentTopCards.length,
                        cardUids: currentTopCards.map((card) => card.uid),
                    },
                    timestamp,
                },
                shuffleHandIntoDeck(
                    context.playerId,
                    reshuffledDeck.map((card) => card.uid),
                    'geeks_mulligan',
                    timestamp,
                ),
            ],
            matchState: state,
        };
    },
});

const geeksMulliganProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const reveal = buildGeeksMulliganReveal(ctx.state, ctx.playerId, ctx.random, ctx.now);
    if (reveal.topCards.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
    }

    return {
        events: reveal.events,
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            topCards: reveal.topCards,
        } satisfies GeeksMulliganPromptContext,
        nextProgram: geeksMulliganPromptProgram,
    };
});

const geeksBannedListPromptProgram = createPromptProgram<GeeksBannedListPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_banned_list',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geeks_banned_list_${context.targetPlayerId}_${context.now}`,
        context.playerId,
        `禁卡表：为${getPlayerLabel(context.targetPlayerId)}命名一张牌`,
        buildGeeksBannedListNameOptions(context.matchState),
        {
            sourceId: 'geeks_banned_list',
            targetType: 'generic',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const namedDefId = (value as GeeksBannedListChoice | undefined)?.defId;
        const targetPlayer = state.core.players[context.targetPlayerId];
        if (!targetPlayer) return { events: [] };

        const events: SmashUpEvent[] = [];
        if (targetPlayer.hand.length > 0) {
            events.push(revealHand(
                context.targetPlayerId,
                context.playerId,
                targetPlayer.hand.map((card) => ({ uid: card.uid, defId: card.defId })),
                'geeks_banned_list',
                timestamp,
                context.playerId,
            ));
        }

        if (namedDefId) {
            for (const card of targetPlayer.hand) {
                if (!isSameNameDefId(card.defId, namedDefId)) continue;
                events.push(...buildValidatedCardToDeckBottomEvents(state, {
                    cardUid: card.uid,
                    defId: card.defId,
                    ownerId: context.targetPlayerId,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.cardUid,
                    sourceDefId: 'geeks_banned_list',
                    sourceControllerId: context.playerId,
                    reason: 'geeks_banned_list',
                    now: timestamp,
                    expectedLocation: 'hand',
                }));
            }
        }

        const nextTargetState = getNextGeeksBannedListTargetState(
            state.core,
            context.opponents,
            context.opponentIdx + 1,
        );
        if (!nextTargetState) {
            return { events };
        }
        return {
            events,
            context: createGeeksBannedListPromptContext(
                state,
                context.playerId,
                timestamp,
                context.cardUid,
                context.opponents,
                nextTargetState,
            ),
            nextProgram: geeksBannedListPromptProgram,
        };
    },
});

const geeksMinMaxingBasePromptProgram = createPromptProgram<GeeksMinMaxingTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_min_maxing_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_min_maxing_base_${context.targetPlayerId}_${context.now}`,
            context.playerId,
            '平衡：选择要打出这张牌的目标基地',
            buildGeeksMinMaxingBaseOptions(
                context.matchState,
                context.playerId,
                context.targetPlayerId,
                context.replayCardUid,
                context.replayDefId,
                context.now,
            ),
            {
                sourceId: 'geeks_min_maxing_base',
                targetType: 'base',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_min_maxing_base_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksMinMaxingBaseOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.targetPlayerId,
            context.replayCardUid,
            context.replayDefId,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksMinMaxingBaseChoice | undefined;
        if (choice?.skip || typeof choice?.baseIndex !== 'number') {
            return { events: [] };
        }
        return executeGeeksMinMaxingPlay(
            state,
            context.playerId,
            context.targetPlayerId,
            context.replayCardUid,
            context.replayDefId,
            timestamp,
            random,
            choice.baseIndex,
        );
    },
});

const geeksMinMaxingMinionPromptProgram = createPromptProgram<GeeksMinMaxingTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_min_maxing_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_min_maxing_minion_${context.targetPlayerId}_${context.now}`,
            context.playerId,
            '平衡：选择要打出这张牌的目标随从',
            buildGeeksMinMaxingMinionOptions(
                context.matchState,
                context.playerId,
                context.targetPlayerId,
                context.replayCardUid,
                context.replayDefId,
                context.now,
            ),
            {
                sourceId: 'geeks_min_maxing_minion',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_min_maxing_minion_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksMinMaxingMinionOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.targetPlayerId,
            context.replayCardUid,
            context.replayDefId,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksMinMaxingMinionChoice | undefined;
        if (choice?.skip || typeof choice?.baseIndex !== 'number' || !choice?.minionUid) {
            return { events: [] };
        }
        return executeGeeksMinMaxingPlay(
            state,
            context.playerId,
            context.targetPlayerId,
            context.replayCardUid,
            context.replayDefId,
            timestamp,
            random,
            choice.baseIndex,
            choice.minionUid,
        );
    },
});

const geeksMinMaxingActionPromptProgram = createPromptProgram<GeeksMinMaxingActionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_min_maxing_action',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_min_maxing_action_${context.targetPlayerId}_${context.now}`,
            context.playerId,
            `平衡：查看${getPlayerLabel(context.targetPlayerId)}手牌后，选择要额外打出的行动`,
            buildGeeksMinMaxingActionOptions(
                context.matchState,
                context.playerId,
                context.targetPlayerId,
                context.now,
            ),
            {
                sourceId: 'geeks_min_maxing_action',
                targetType: 'generic',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_min_maxing_action_title',
                titleParams: { playerLabel: getPlayerLabel(context.targetPlayerId) },
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksMinMaxingActionOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.targetPlayerId,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksMinMaxingActionChoice | undefined;
        if (choice?.skip || !choice?.cardUid || !choice?.defId) {
            return { events: [] };
        }

        const def = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!def) {
            return { events: [] };
        }

        const targetMode = getGeeksImmediateActionTargetMode(def);
        if (targetMode === 'none') {
            return executeGeeksMinMaxingPlay(
                state,
                context.playerId,
                context.targetPlayerId,
                choice.cardUid,
                choice.defId,
                timestamp,
                random,
            );
        }

        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                cardUid: context.cardUid,
                targetPlayerId: context.targetPlayerId,
                replayCardUid: choice.cardUid,
                replayDefId: choice.defId,
            } satisfies GeeksMinMaxingTargetPromptContext,
            nextProgram: targetMode === 'base'
                ? geeksMinMaxingBasePromptProgram
                : geeksMinMaxingMinionPromptProgram,
        };
    },
});

const geeksMinMaxingOpponentPromptProgram = createPromptProgram<GeeksMinMaxingOpponentPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_min_maxing_opponent',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_min_maxing_opponent_${context.now}`,
            context.playerId,
            '平衡：选择要查看手牌的另一名玩家',
            buildGeeksMinMaxingOpponentOptions(context.matchState, context.playerId, context.now),
            {
                sourceId: 'geeks_min_maxing_opponent',
                targetType: 'button',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_min_maxing_opponent_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksMinMaxingOpponentOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const targetPlayerId = (value as GeeksMinMaxingOpponentChoice | undefined)?.targetPlayerId;
        const targetPlayer = targetPlayerId ? state.core.players[targetPlayerId] : undefined;
        if (!targetPlayerId || !targetPlayer) {
            return { events: [] };
        }

        const revealCards = targetPlayer.hand.map((card) => ({ uid: card.uid, defId: card.defId }));
        return {
            events: revealCards.length > 0
                ? [revealHand(targetPlayerId, context.playerId, revealCards, 'geeks_min_maxing', timestamp, context.playerId)]
                : [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                cardUid: context.cardUid,
                targetPlayerId,
            } satisfies GeeksMinMaxingActionPromptContext,
            nextProgram: geeksMinMaxingActionPromptProgram,
        };
    },
});

const geeksNonInfiniteLoopBasePromptProgram = createPromptProgram<GeeksNonInfiniteLoopTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_non_infinite_loop_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_non_infinite_loop_base_${context.replayCardUid}_${context.now}`,
            context.playerId,
            '无限循环：选择要打出这张牌的目标基地',
            buildGeeksNonInfiniteLoopBaseOptions(
                context.matchState,
                context.playerId,
                context.replayCardUid,
                context.now,
            ),
            {
                sourceId: 'geeks_non_infinite_loop_base',
                targetType: 'base',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_non_infinite_loop_base_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksNonInfiniteLoopBaseOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.replayCardUid,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksNonInfiniteLoopBaseChoice | undefined;
        if (choice?.skip || typeof choice?.baseIndex !== 'number') {
            return { events: [] };
        }
        return executeGeeksNonInfiniteLoopPlay(
            state,
            context.playerId,
            context.replayCardUid,
            context.replayDefId,
            context.replayOwnerId,
            timestamp,
            random,
            choice.baseIndex,
        );
    },
});

const geeksNonInfiniteLoopMinionPromptProgram = createPromptProgram<GeeksNonInfiniteLoopTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_non_infinite_loop_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_non_infinite_loop_minion_${context.replayCardUid}_${context.now}`,
            context.playerId,
            '无限循环：选择要打出这张牌的目标随从',
            buildGeeksNonInfiniteLoopMinionOptions(
                context.matchState,
                context.playerId,
                context.replayCardUid,
                context.now,
            ),
            {
                sourceId: 'geeks_non_infinite_loop_minion',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_non_infinite_loop_minion_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksNonInfiniteLoopMinionOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.replayCardUid,
            context.now,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksNonInfiniteLoopMinionChoice | undefined;
        if (choice?.skip || typeof choice?.baseIndex !== 'number' || !choice?.minionUid) {
            return { events: [] };
        }
        return executeGeeksNonInfiniteLoopPlay(
            state,
            context.playerId,
            context.replayCardUid,
            context.replayDefId,
            context.replayOwnerId,
            timestamp,
            random,
            choice.baseIndex,
            choice.minionUid,
        );
    },
});

const geeksNonInfiniteLoopActionPromptProgram = createPromptProgram<GeeksNonInfiniteLoopActionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_non_infinite_loop_action',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `geeks_non_infinite_loop_action_${context.now}`,
            context.playerId,
            '无限循环：你可以额外打出一张标准行动',
            buildGeeksNonInfiniteLoopActionOptions(
                context.matchState,
                context.playerId,
                context.now,
                context.cardUid,
            ),
            {
                sourceId: 'geeks_non_infinite_loop_action',
                targetType: 'hand',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_non_infinite_loop_action_title',
            },
        );
        interaction.data.optionsGenerator = (state) => buildGeeksNonInfiniteLoopActionOptions(
            state as MatchState<SmashUpCore>,
            context.playerId,
            context.now,
            context.cardUid,
        );
        return interaction;
    },
    onResolve: ({ context, state, random, value, timestamp }) => {
        const choice = value as GeeksNonInfiniteLoopActionChoice | undefined;
        if (choice?.skip || !choice?.cardUid || !choice?.defId) {
            return { events: [] };
        }

        const def = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!def || getGeeksActionLikeSubtype(def) !== 'standard') {
            return { events: [] };
        }

        const targetMode = getGeeksImmediateActionTargetMode(def);
        const replayOwnerId = choice.ownerId ?? context.playerId;
        if (targetMode === 'none') {
            return executeGeeksNonInfiniteLoopPlay(
                state,
                context.playerId,
                choice.cardUid,
                choice.defId,
                replayOwnerId,
                timestamp,
                random,
            );
        }

        return {
            events: [],
            context: {
                matchState: state,
                playerId: context.playerId,
                now: timestamp,
                cardUid: context.cardUid,
                replayCardUid: choice.cardUid,
                replayDefId: choice.defId,
                replayOwnerId,
            } satisfies GeeksNonInfiniteLoopTargetPromptContext,
            nextProgram: targetMode === 'base'
                ? geeksNonInfiniteLoopBasePromptProgram
                : geeksNonInfiniteLoopMinionPromptProgram,
        };
    },
});

const geeksControlMinionTriggeredPromptProgram = createPromptProgram<GeeksControlMinionTriggeredPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_control_minion_triggered',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geeks_control_minion_triggered_${context.cardUid}_${context.now}`,
        context.playerId,
        '控制仆从：你可以打出这张牌，本回合控制那个刚打出的随从',
        [
            {
                id: 'play',
                label: '打出控制仆从',
                labelKey: 'ui.geeks_control_minion_play_option',
                value: { play: true },
                displayMode: 'button' as const,
            } satisfies PromptOption<GeeksControlMinionTriggeredChoice>,
            createSkipOption(),
        ],
        {
            sourceId: 'geeks_control_minion_triggered',
            targetType: 'button',
            displayCard: { defId: 'geeks_control_minion', cardUid: context.cardUid },
            titleKey: 'ui.geeks_control_minion_triggered_title',
        },
    ),
    onResolve: ({ context, state, value, timestamp }) => {
        const choice = value as GeeksControlMinionTriggeredChoice | undefined;
        if (choice?.skip || !choice?.play) {
            return { events: [] };
        }

        const found = findMinionOnBases(state.core, context.targetMinionUid);
        if (!found) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [
                buildActionPlayedEvent({
                    playerId: context.playerId,
                    cardUid: context.cardUid,
                    defId: 'geeks_control_minion',
                    ownerId: context.ownerId,
                    isExtraAction: true,
                    targetBaseIndex: found.baseIndex,
                    targetMinionUid: found.minion.uid,
                    timestamp,
                }),
                ...buildGeeksControlMinionEffectEvents(
                    state.core,
                    context.playerId,
                    found.minion.uid,
                    state.core.turnOrder[state.core.currentPlayerIndex] ?? context.playerId,
                    'geeks_control_minion',
                    timestamp,
                ),
            ],
        };
    },
});

const geeksRulesLawyerTargetPromptProgram = createPromptProgram<GeeksRulesLawyerTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_rules_lawyer_target',
    interactionSourceIds: [
        'geeks_rules_lawyer_target_base',
        'geeks_rules_lawyer_target_minion',
    ],
    buildInteraction: (context) => {
        if (context.targetType === 'base') {
            return createAbilityRuntimeSimpleChoice(
                `geeks_rules_lawyer_target_base_${context.movedCardUid}_${context.now}`,
                context.playerId,
                '规则咬定者：选择新的基地',
                buildBaseTargetOptions(
                    buildGeeksRulesLawyerBaseCandidates(context.matchState.core, context.fromBaseIndex),
                    context.matchState.core,
                ),
                {
                    sourceId: 'geeks_rules_lawyer_target_base',
                    targetType: 'base',
                    autoResolveIfSingle: false,
                    responseValidationMode: 'live',
                    titleKey: 'ui.geeks_rules_lawyer_target_base_title',
                },
            );
        }

        return createAbilityRuntimeSimpleChoice(
            `geeks_rules_lawyer_target_minion_${context.movedCardUid}_${context.now}`,
            context.playerId,
            '规则咬定者：选择新的随从',
            buildMinionTargetOptions(
                buildGeeksRulesLawyerMinionCandidates(context.matchState.core, context.playerId, context.fromMinionUid ?? ''),
                {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceKind: 'action',
                    effectType: 'affect',
                },
            ),
            {
                sourceId: 'geeks_rules_lawyer_target_minion',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.geeks_rules_lawyer_target_minion_title',
            },
        );
    },
    onResolve: ({ context, state, value, timestamp }) => {
        const sourceAction = getGeeksRulesLawyerSourceAction(state.core, context);
        const events: SmashUpEvent[] = buildValidatedOngoingDetachEvents(state, {
            cardUid: context.movedCardUid,
            defId: context.movedDefId,
            ownerId: context.movedOwnerId,
            reason: 'geeks_rules_lawyer',
            now: timestamp,
        });
        if (events.length === 0) return { events: [] };

        if (context.targetType === 'base') {
            const choice = value as GeeksRulesLawyerBaseChoice | undefined;
            if (typeof choice?.baseIndex !== 'number') return { events: [] };
            events.push({
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: context.movedCardUid,
                    defId: context.movedDefId,
                    ownerId: context.movedOwnerId,
                    targetType: 'base',
                    targetBaseIndex: choice.baseIndex,
                    ...(sourceAction?.metadata ? { metadata: sourceAction.metadata } : {}),
                    ...(sourceAction?.talentUsed !== undefined ? { talentUsed: sourceAction.talentUsed } : {}),
                },
                timestamp,
            } as any);
            return { events };
        }

        const choice = value as GeeksRulesLawyerMinionChoice | undefined;
        if (typeof choice?.baseIndex !== 'number' || !choice?.minionUid) return { events: [] };
        events.push(...buildSemanticOngoingAttachEvents(state, {
            cardUid: context.movedCardUid,
            defId: context.movedDefId,
            ownerId: context.movedOwnerId,
            ...(context.movedOwnerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
            targetBaseIndex: choice.baseIndex,
            targetMinionUid: choice.minionUid,
            ...(sourceAction?.metadata ? { metadata: sourceAction.metadata } : {}),
            ...(sourceAction?.talentUsed !== undefined ? { talentUsed: sourceAction.talentUsed } : {}),
            now: timestamp,
        }));
        return { events };
    },
});

const geeksRulesLawyerActionPromptProgram = createPromptProgram<GeeksRulesLawyerActionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'geeks_rules_lawyer_action',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `geeks_rules_lawyer_action_${context.now}`,
        context.playerId,
        '规则咬定者：选择要转移的持续行动',
        context.actions.map((action) => ({
            id: `action-${action.cardUid}`,
            label: action.label,
            value: action,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'geeks_rules_lawyer_action',
            targetType: 'ongoing',
            autoResolveIfSingle: false,
            responseValidationMode: 'live',
            titleKey: 'ui.geeks_rules_lawyer_action_title',
        },
    ),
    onResolve: ({ state, playerId, value, timestamp, context }) => {
        const choice = value as GeeksRulesLawyerActionChoice | undefined;
        if (!choice?.cardUid || !choice.defId || !choice.ownerId || !choice.targetType || typeof choice.baseIndex !== 'number') {
            return { events: [] };
        }

        return {
            events: [],
            context: {
                matchState: state,
                playerId,
                now: timestamp,
                cardUid: context.cardUid,
                movedCardUid: choice.cardUid,
                movedDefId: choice.defId,
                movedOwnerId: choice.ownerId,
                targetType: choice.targetType,
                fromBaseIndex: choice.baseIndex,
                ...(choice.minionUid ? { fromMinionUid: choice.minionUid } : {}),
            } satisfies GeeksRulesLawyerTargetPromptContext,
            nextProgram: geeksRulesLawyerTargetPromptProgram,
        };
    },
});

const geeksFeliciaDayProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => ({
    events: buildGeeksFeliciaDayMoveEvents(ctx.state, ctx.playerId, ctx.cardUid, ctx.baseIndex, ctx.now),
}));

const geeksBannedListProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponents = getGeeksBannedListOpponentIds(ctx.state, ctx.playerId);
    const targetState = getNextGeeksBannedListTargetState(ctx.state, opponents, 0);
    if (!targetState) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [],
        context: createGeeksBannedListPromptContext(
            ctx.matchState,
            ctx.playerId,
            ctx.now,
            ctx.cardUid,
            opponents,
            targetState,
        ),
        nextProgram: geeksBannedListPromptProgram,
    };
});

const geeksNonInfiniteLoopProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const actionOptions = buildGeeksNonInfiniteLoopActionOptions(ctx.matchState, ctx.playerId, ctx.now, ctx.cardUid);
    if (!actionOptions.some((option) => !option.value?.skip)) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
        } satisfies GeeksNonInfiniteLoopActionPromptContext,
        nextProgram: geeksNonInfiniteLoopActionPromptProgram,
    };
});

const geeksRulesLawyerProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const actions = collectGeeksRulesLawyerTransferableActions(ctx.state, ctx.playerId);
    if (actions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            actions,
        } satisfies GeeksRulesLawyerActionPromptContext,
        nextProgram: geeksRulesLawyerActionPromptProgram,
    };
});

const geeksMinMaxingProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    const opponentOptions = buildGeeksMinMaxingOpponentOptions(ctx.matchState, ctx.playerId, ctx.now);
    if (opponentOptions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (!ctx.matchState) return { events: [] };

    return {
        events: [],
        context: {
            matchState: ctx.matchState,
            playerId: ctx.playerId,
            now: ctx.now,
            cardUid: ctx.cardUid,
            opponents: opponentOptions
                .map((option) => (option.value as GeeksMinMaxingOpponentChoice | undefined)?.targetPlayerId)
                .filter((pid): pid is PlayerId => !!pid),
        } satisfies GeeksMinMaxingOpponentPromptContext,
        nextProgram: geeksMinMaxingOpponentPromptProgram,
    };
});

const geeksControlMinionProgram = createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>((ctx) => {
    if (!ctx.targetMinionUid) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: buildGeeksControlMinionEffectEvents(
            ctx.state,
            ctx.playerId,
            ctx.targetMinionUid,
            ctx.playerId,
            'geeks_control_minion',
            ctx.now,
        ),
    };
});

function geeksControlMinionTrigger(ctx: TriggerContext) {
    if (!ctx.matchState || !ctx.sourceCardUid || !ctx.sourceControllerId || !ctx.triggerMinionUid) {
        return { events: [] };
    }
    if (ctx.playerId === ctx.sourceControllerId) {
        return { events: [] };
    }
    return executeAbilityProgram(geeksControlMinionTriggeredPromptProgram, {
        matchState: ctx.matchState,
        playerId: ctx.sourceControllerId,
        now: ctx.now,
        cardUid: ctx.sourceCardUid,
        ownerId: ctx.sourceOwnerPlayerId ?? ctx.sourceControllerId,
        targetMinionUid: ctx.triggerMinionUid,
    });
}

export function registerGeekAbilities(): void {
    registerActionCounter('geeks_force_of_wil', { cardType: 'action' });
    registerActionCounter('geeks_wil_wheaton', { cardType: 'minion' });
    registerSimpleAbility('geeks_fan', 'special', geeksFanSpecial);
    registerAbilityProgram('geeks_banned_list', 'onPlay', { program: geeksBannedListProgram });
    registerAbilityProgram('geeks_control_minion', 'onPlay', { program: geeksControlMinionProgram });
    registerAbilityProgram('geeks_felicia_day', 'onPlay', { program: geeksFeliciaDayProgram });
    registerAbilityProgram('geeks_griefer', 'onPlay', { program: geeksGrieferProgram });
    registerAbilityProgram('geeks_min_maxing', 'onPlay', { program: geeksMinMaxingProgram });
    registerAbilityProgram('geeks_mulligan', 'onPlay', { program: geeksMulliganProgram });
    registerAbilityProgram('geeks_non_infinite_loop', 'onPlay', { program: geeksNonInfiniteLoopProgram });
    registerAbilityProgram('geeks_rules_lawyer', 'onPlay', { program: geeksRulesLawyerProgram });
    registerProtection('geeks_game_guru', 'affect', geeksGameGuruProtection);
    registerInteractionHandler('geeks_non_infinite_loop_return', (state, _playerId, value, interactionData, _random, timestamp) => {
        const selected = value as {
            returnToHand?: boolean;
            cardUid?: string;
            defId?: string;
            ownerId?: PlayerId;
            reason?: string;
        } | undefined;
        if (!selected?.returnToHand) {
            return { state, events: [] };
        }

        const cardUid = selected.cardUid ?? (typeof interactionData?.cardUid === 'string' ? interactionData.cardUid : undefined);
        const defId = selected.defId ?? (typeof interactionData?.defId === 'string' ? interactionData.defId : undefined);
        const ownerId = selected.ownerId ?? (typeof interactionData?.ownerId === 'string' ? interactionData.ownerId as PlayerId : undefined);
        const reason = selected.reason ?? (typeof interactionData?.reason === 'string' ? interactionData.reason : 'geeks_non_infinite_loop');
        if (!cardUid || !defId || !ownerId) {
            return { state, events: [] };
        }
        const discardCard = state.core.players[ownerId]?.discard.find((card) => card.uid === cardUid && card.defId === defId);
        if (!discardCard) {
            return { state, events: [] };
        }

        return {
            state,
            events: [createCardTransferEvent({
                card: createCardObjectRefFromInstance(discardCard),
                fromPlayerId: ownerId,
                toPlayerId: ownerId,
                reason,
                timestamp,
            })],
        };
    });
    registerTrigger('geeks_cosplay', 'onVpAwarded', geeksCosplayTrigger, {
        optional: true,
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: (ctx) => (ctx.vpAmount ?? 0) > 0 && ctx.sourceControllerId === ctx.playerId,
    });
    registerTrigger('geeks_control_minion', 'onMinionPlayed', geeksControlMinionTrigger, {
        optional: true,
        global: true,
        globalZones: ['hand'],
        playerContext: 'sourceController',
        canTrigger: (ctx) => !!ctx.triggerMinionUid && ctx.sourceControllerId !== ctx.playerId,
    });
}
