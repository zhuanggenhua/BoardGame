import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId } from '../../../engine/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    addPermanentPower,
    addPowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildStandardDrawEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    canControllerPlayTitan,
    createSkipOption,
    emitSpecialLimitUsed,
    getMinionPower,
    grantContextualExtraMinion,
    moveTitan,
    playTitan,
    removeTitanFromPlay,
} from '../domain/abilityHelpers';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { registerBaseAbility, registerExtended as registerExtendedBase, type BaseAbilityContext } from '../domain/baseAbilities';
import { appendResolvedActionAbility, getExternalActionEffectiveHandSize } from '../domain/externalActionPlay';
import { registerInterceptor, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getActionControllerId, getPlayerEffectivePowerOnBase, registerBreakpointModifier } from '../domain/ongoingModifiers';
import { validateActionPlaySemantics } from '../domain/playLegality';
import {
    appendPendingPostScoringActions,
    getDeferredReplacementBaseDefId,
} from '../domain/scoringSession';
import type {
    ActionCardDef,
    CardsDrawnEvent,
    CardInstance,
    DeckReorderedEvent,
    MinionOnBase,
    MinionPlayedEvent,
    OngoingDetachedEvent,
    SmashUpCore,
    SmashUpEvent,
    SpecialLimitUsedEvent,
    TitanState,
} from '../domain/types';
import { SU_EVENTS } from '../domain/types';

const MEGABOT = 'mega_troopers_megabot';

function getPlayerTurnEndExpiration(state: SmashUpCore, playerId: PlayerId): number {
    const turnOrder = state.turnOrder;
    const currentIndex = turnOrder.indexOf(state.currentPlayer);
    const playerIndex = turnOrder.indexOf(playerId);
    if (turnOrder.length === 0 || currentIndex < 0 || playerIndex < 0) {
        return state.turnNumber + Math.max(1, turnOrder.length);
    }
    const turnsUntilPlayerTurnStarts = (playerIndex - currentIndex + turnOrder.length) % turnOrder.length;
    return state.turnNumber + turnsUntilPlayerTurnStarts + 1;
}

type MinionTarget = {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
};

type ActionAttachmentChoice = {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
    minionUid?: string;
    label: string;
};

type DestroyActionOrTitanChoice =
    | ({ kind: 'action' } & ActionAttachmentChoice)
    | {
        kind: 'titan';
        titanUid: string;
        defId: string;
        label: string;
    };

type BlueTrooperPodChoice = {
    mode?: 'draw' | 'power' | 'skip';
};

type PlanForMoreChoice = {
    mode?: 'take' | 'take_and_play' | 'skip';
    cardUid?: string;
    defId?: string;
    baseIndex?: number;
};

type PlanForMoreOrderChoice = {
    cardUid?: string;
    defId?: string;
};

type PlanForMoreOrderContext = {
    remaining: { uid: string; defId: string }[];
    ordered: { uid: string; defId: string }[];
};

type PlanForMorePodChoice = {
    mode?: 'draw' | 'play' | 'skip';
    cardUid?: string;
    defId?: string;
    baseIndex?: number;
};

type PlanForMorePodOrderChoice = {
    topUids?: string[];
    bottomUids?: string[];
};

type PlanForMorePodOrderContext = {
    remaining: { uid: string; defId: string }[];
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

function getMegabot(state: SmashUpCore, playerId: PlayerId): TitanState | undefined {
    return (state.titans ?? []).find(titan => titan.defId === MEGABOT && titan.controllerId === playerId);
}

function countOwnMinions(state: SmashUpCore, baseIndex: number, playerId: PlayerId): number {
    return state.bases[baseIndex]?.minions.filter(minion => minion.controller === playerId).length ?? 0;
}

function getMegabotEligibleBases(state: SmashUpCore, playerId: PlayerId, minOwnMinions: number) {
    return state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(state, baseIndex) }))
        .filter(candidate => countOwnMinions(state, candidate.baseIndex, playerId) >= minOwnMinions);
}

function buildMegabotToBaseEvents(
    state: SmashUpCore,
    playerId: PlayerId,
    targetBaseIndex: number,
    reason: string,
    now: number,
): SmashUpEvent[] {
    const titan = getMegabot(state, playerId);
    const targetBase = state.bases[targetBaseIndex];
    if (!titan || !targetBase) return [];

    if (titan.location.zone === 'base') {
        if (titan.location.baseIndex === targetBaseIndex) return [];
        return [moveTitan(titan.uid, titan.defId, titan.location.baseIndex, targetBaseIndex, reason, now, targetBase.defId)];
    }

    if (!canControllerPlayTitan(state, playerId, titan.uid)) return [];
    return [playTitan(titan, playerId, targetBaseIndex, reason, now, targetBase.defId)];
}

function queueMegabotBasePrompt(
    ctx: AbilityContext,
    sourceId: string,
    minOwnMinions: number,
): AbilityResult {
    const eligibleBases = getMegabotEligibleBases(ctx.state, ctx.playerId, minOwnMinions);
    if (eligibleBases.length === 0) return noTargets(ctx);

    const targetBaseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    if (eligibleBases.some(base => base.baseIndex === targetBaseIndex)) {
        return {
            events: buildMegabotToBaseEvents(ctx.state, ctx.playerId, targetBaseIndex, sourceId, ctx.now),
        };
    }

    if (!ctx.matchState) return { events: [] };

    const interaction = createSimpleChoice(
        `${sourceId}_${ctx.now}`,
        ctx.playerId,
        `${cardLabel(ctx.defId)}：选择 Megabot 要进入的基地`,
        buildBaseTargetOptions(eligibleBases, ctx.state),
        { sourceId, targetType: 'base', autoResolveIfSingle: false },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function formMegabot(ctx: AbilityContext): AbilityResult {
    return queueMegabotBasePrompt(ctx, 'mega_troopers_form_megabot', 2);
}

function redTrooperTalent(ctx: AbilityContext): AbilityResult {
    return queueMegabotBasePrompt(ctx, 'mega_troopers_red_trooper', 1);
}

function formMegabotPod(ctx: AbilityContext): AbilityResult {
    const titan = getMegabot(ctx.state, ctx.playerId);
    if (!titan) return noTargets(ctx);

    if (titan.location.zone === 'setaside') {
        const bases = ctx.state.bases.map((_base, baseIndex) => ({
            baseIndex,
            label: baseLabel(ctx.state, baseIndex),
        }));
        if (bases.length === 0 || !canControllerPlayTitan(ctx.state, ctx.playerId, titan.uid)) {
            return noTargets(ctx);
        }
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `mega_troopers_form_megabot_pod_${ctx.now}`,
            ctx.playerId,
            '合体超级佐德：选择超级佐德要进入的基地',
            buildBaseTargetOptions(bases, ctx.state),
            {
                sourceId: 'mega_troopers_form_megabot_pod',
                targetType: 'base',
                titleKey: 'ui.mega_troopers_form_megabot_pod_title',
                autoResolveIfSingle: false,
            },
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    }

    const destinationBaseIndex = titan.location.baseIndex;
    const targets = collectMinions(
        ctx.state,
        (minion, baseIndex) => minion.controller === ctx.playerId && baseIndex !== destinationBaseIndex,
    );
    if (targets.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `mega_troopers_form_megabot_pod_move_${ctx.now}`,
        ctx.playerId,
        '合体超级佐德：选择任意数量你的随从移动到超级佐德所在基地',
        [
            createSkipOption(),
            ...buildMinionTargetOptions(targets, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                effectType: 'move',
            }),
        ],
        {
            sourceId: 'mega_troopers_form_megabot_pod_move_minions',
            targetType: 'minion',
            multi: { min: 0, max: targets.length },
            titleKey: 'ui.mega_troopers_form_megabot_pod_move_title',
        },
    );
    (interaction.data as { continuationContext?: { destinationBaseIndex: number } }).continuationContext = {
        destinationBaseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function redTrooperTalentPod(ctx: AbilityContext): AbilityResult {
    const titan = getMegabot(ctx.state, ctx.playerId);
    if (!titan) return noTargets(ctx);

    const blockedBaseIndex = titan.location.zone === 'base'
        ? titan.location.baseIndex
        : ctx.baseIndex;
    const eligibleBases = ctx.state.bases
        .map((_base, baseIndex) => ({ baseIndex, label: baseLabel(ctx.state, baseIndex) }))
        .filter(candidate => candidate.baseIndex !== blockedBaseIndex);
    if (eligibleBases.length === 0) return noTargets(ctx);
    if (titan.location.zone === 'setaside' && !canControllerPlayTitan(ctx.state, ctx.playerId, titan.uid, { allowConcurrentOwnTitan: true })) {
        return noTargets(ctx);
    }
    if (!ctx.matchState) return { events: [] };
    const interaction = createSimpleChoice(
        `mega_troopers_red_trooper_pod_${ctx.now}`,
        ctx.playerId,
        '红骑士：选择另一个基地打出或移动超级佐德',
        buildBaseTargetOptions(eligibleBases, ctx.state),
        {
            sourceId: 'mega_troopers_red_trooper_pod',
            targetType: 'base',
            titleKey: 'ui.mega_troopers_red_trooper_pod_title',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function collectActionAttachments(state: SmashUpCore): ActionAttachmentChoice[] {
    const choices: ActionAttachmentChoice[] = [];
    state.bases.forEach((base, baseIndex) => {
        base.ongoingActions.forEach((action) => {
            choices.push({
                cardUid: action.uid,
                defId: action.defId,
                ownerId: action.ownerId,
                baseIndex,
                label: `${cardLabel(action.defId)} @ ${baseLabel(state, baseIndex)}`,
            });
        });
        base.minions.forEach((minion) => {
            minion.attachedActions.forEach((action) => {
                choices.push({
                    cardUid: action.uid,
                    defId: action.defId,
                    ownerId: action.ownerId,
                    baseIndex,
                    minionUid: minion.uid,
                    label: `${cardLabel(action.defId)}（附着于 ${cardLabel(minion.defId)} @ ${baseLabel(state, baseIndex)}）`,
                });
            });
        });
    });
    return choices;
}

function lightningCrystal(ctx: AbilityContext): AbilityResult {
    const choices = collectActionAttachments(ctx.state);
    if (choices.length === 0) return noTargets(ctx);

    if (!ctx.matchState) return { events: [] };

    const interaction = createSimpleChoice(
        `mega_troopers_lightning_crystal_${ctx.now}`,
        ctx.playerId,
        '光电晶体：选择要摧毁的行动牌',
        choices.map((choice, index) => ({
            id: `action-${index}`,
            label: choice.label,
            value: choice,
            displayCard: { defId: choice.defId, cardUid: choice.cardUid },
        })),
        { sourceId: 'mega_troopers_lightning_crystal', targetType: 'ongoing', titleKey: 'ui.mega_troopers_lightning_crystal_title', autoResolveIfSingle: false },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function lightningCrystalPod(ctx: AbilityContext): AbilityResult {
    const choices: DestroyActionOrTitanChoice[] = [
        ...collectActionAttachments(ctx.state).map(choice => ({ ...choice, kind: 'action' as const })),
        ...(ctx.state.titans ?? [])
            .filter(titan => titan.location.zone === 'base')
            .map(titan => ({
                kind: 'titan' as const,
                titanUid: titan.uid,
                defId: titan.defId,
                label: `${cardLabel(titan.defId)}（泰坦）`,
            })),
    ];
    if (choices.length === 0) return noTargets(ctx);
    if (!ctx.matchState) return { events: [] };

    const interaction = createSimpleChoice(
        `mega_troopers_lightning_crystal_pod_${ctx.now}`,
        ctx.playerId,
        '闪电水晶：选择要摧毁的行动牌或泰坦',
        choices.map((choice, index) => ({
            id: `${choice.kind}-${index}`,
            label: choice.label,
            value: choice,
            displayCard: choice.kind === 'action'
                ? { defId: choice.defId, cardUid: choice.cardUid }
                : { defId: choice.defId, cardUid: choice.titanUid },
        })),
        {
            sourceId: 'mega_troopers_lightning_crystal_pod',
            targetType: 'generic',
            titleKey: 'ui.mega_troopers_lightning_crystal_pod_title',
            autoResolveIfSingle: false,
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function detachOngoing(choice: ActionAttachmentChoice, reason: string, timestamp: number): OngoingDetachedEvent {
    return buildOngoingDetachedEvent({
        cardUid: choice.cardUid,
        defId: choice.defId,
        ownerId: choice.ownerId,
        reason,
        now: timestamp,
    });
}

function collectMinions(state: SmashUpCore, predicate: (minion: MinionOnBase, baseIndex: number) => boolean): MinionTarget[] {
    return state.bases.flatMap((base, baseIndex) =>
        base.minions
            .filter(minion => predicate(minion, baseIndex))
            .map(minion => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${cardLabel(minion.defId)} @ ${baseLabel(state, baseIndex)}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
            })));
}

function itsBlitzinTime(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, minion => minion.controller === ctx.playerId);
    const direct = ctx.targetMinionUid ? targets.find(target => target.uid === ctx.targetMinionUid) : undefined;
    if (direct) {
        return { events: [addTempPower(direct.uid, direct.baseIndex, 3, 'mega_troopers_its_blitzin_time', ctx.now)] };
    }

    if (targets.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `mega_troopers_its_blitzin_time_${ctx.now}`,
        ctx.playerId,
        '闪电侠：选择你的一个随从直到回合结束 +3 力量',
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'affect',
        }),
        { sourceId: 'mega_troopers_its_blitzin_time', targetType: 'minion', titleKey: 'ui.mega_troopers_its_blitzin_time_title' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function itsBlitzinTimePod(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, minion => minion.controller === ctx.playerId);
    const direct = ctx.targetMinionUid ? targets.find(target => target.uid === ctx.targetMinionUid) : undefined;
    if (direct) {
        return {
            events: [
                addTempPower(
                    direct.uid,
                    direct.baseIndex,
                    4,
                    'mega_troopers_its_blitzin_time_pod',
                    ctx.now,
                ),
            ],
        };
    }
    if (targets.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `mega_troopers_its_blitzin_time_pod_${ctx.now}`,
        ctx.playerId,
        '闪电时刻：选择你的一个随从直到回合结束 +4 力量',
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'affect',
        }),
        {
            sourceId: 'mega_troopers_its_blitzin_time_pod',
            targetType: 'minion',
            titleKey: 'ui.mega_troopers_its_blitzin_time_pod_title',
        },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function sumOwnPowerAtBase(state: SmashUpCore, baseIndex: number, playerId: PlayerId): number {
    return (state.bases[baseIndex]?.minions ?? [])
        .filter(minion => minion.controller === playerId)
        .reduce((total, minion) => total + getMinionPower(state, minion, baseIndex), 0);
}

function megaAttack(ctx: AbilityContext): AbilityResult {
    const baseIndex = ctx.targetBaseIndex ?? ctx.baseIndex;
    const threshold = sumOwnPowerAtBase(ctx.state, baseIndex, ctx.playerId);
    const targets = collectMinions(ctx.state, (minion, candidateBaseIndex) =>
        candidateBaseIndex === baseIndex && getMinionPower(ctx.state, minion, candidateBaseIndex) < threshold);
    const direct = ctx.targetMinionUid ? targets.find(target => target.uid === ctx.targetMinionUid) : undefined;
    if (direct) {
        return {
            events: buildValidatedDestroyEvents(ctx.state, {
                minionUid: direct.uid,
                minionDefId: direct.defId,
                fromBaseIndex: direct.baseIndex,
                destroyerId: ctx.playerId,
                reason: 'mega_troopers_mega_attack',
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

    if (targets.length === 0) return noTargets(ctx);
    const interaction = createSimpleChoice(
        `mega_troopers_mega_attack_${ctx.now}`,
        ctx.playerId,
        `暴力攻击：选择一个力量低于 ${threshold} 的随从`,
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'destroy',
        }),
        { sourceId: 'mega_troopers_mega_attack', targetType: 'minion' },
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
        sourceBaseIndex: baseIndex,
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

function planForMore(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const revealed = (player?.deck ?? []).slice(0, 3);
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.REVEAL_DECK_TOP,
            payload: {
                targetPlayerId: ctx.playerId,
                viewerPlayerId: ctx.playerId,
                cards: revealed.map(card => ({ uid: card.uid, defId: card.defId })),
                count: revealed.length,
                reason: 'mega_troopers_plan_for_more',
                sourcePlayerId: ctx.playerId,
            },
            timestamp: ctx.now,
        } as SmashUpEvent,
    ];

    const minions = revealed.filter(card => getCardDef(card.defId)?.type === 'minion');
    if (minions.length === 0) {
        const orderState = queuePlanForMoreOrderIfNeeded(
            ctx.matchState,
            ctx.playerId,
            revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            ctx.now,
        );
        return { events, matchState: orderState };
    }

    const interaction = createSimpleChoice(
        `mega_troopers_plan_for_more_${ctx.now}`,
        ctx.playerId,
        '更多的计划：选择要拿走的随从；其中一个可以作为额外随从打出',
        [
            createSkipOption(),
            ...minions.flatMap((card, index) => [
                {
                    id: `take-${index}`,
                    label: `加入手牌：${cardLabel(card.defId)}`,
                    value: { mode: 'take', cardUid: card.uid, defId: card.defId } satisfies PlanForMoreChoice,
                    displayCard: { defId: card.defId, cardUid: card.uid },
                },
                ...ctx.state.bases.map((base, baseIndex) => ({
                    id: `play-${index}-${baseIndex}`,
                    label: `额外打出 ${cardLabel(card.defId)} 到 ${baseLabel(ctx.state, baseIndex)}`,
                    value: {
                        mode: 'take_and_play',
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex,
                    } satisfies PlanForMoreChoice,
                    displayCard: { defId: card.defId, cardUid: card.uid },
                    _source: 'base' as const,
                    _target: { baseIndex, baseDefId: base.defId },
                })),
            ]),
        ],
        {
            sourceId: 'mega_troopers_plan_for_more',
            targetType: 'generic',
            multi: { min: 0, max: minions.length },
            titleKey: 'ui.mega_troopers_plan_for_more_title',
        },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        revealedUids: revealed.map(card => card.uid),
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function makePlanForMoreOrderOption(card: { uid: string; defId: string }, index: number) {
    return {
        id: `order-${index}`,
        label: `${cardLabel(card.defId)} 放在下一张`,
        value: { cardUid: card.uid, defId: card.defId } satisfies PlanForMoreOrderChoice,
        displayMode: 'card' as const,
        displayCard: { defId: card.defId, cardUid: card.uid },
    };
}

function createPlanForMoreOrderInteraction(
    playerId: PlayerId,
    remaining: { uid: string; defId: string }[],
    ordered: { uid: string; defId: string }[],
    timestamp: number,
) {
    const title = ordered.length === 0
        ? '更多的计划：选择第一张放回牌库顶的牌（最先选的在最上面）'
        : `更多的计划：选择下一张放回牌库顶的牌（已选 ${ordered.length} 张）`;
    const interaction = createSimpleChoice(
        `mega_troopers_plan_for_more_order_${timestamp}`,
        playerId,
        title,
        remaining.map(makePlanForMoreOrderOption),
        {
            sourceId: 'mega_troopers_plan_for_more_order',
            targetType: 'generic',
            responseValidationMode: 'live',
        },
    );
    (interaction.data as { continuationContext?: PlanForMoreOrderContext }).continuationContext = { remaining, ordered };
    return interaction;
}

function queuePlanForMoreOrderIfNeeded(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    remaining: { uid: string; defId: string }[],
    timestamp: number,
): MatchState<SmashUpCore> {
    if (remaining.length <= 1) return state;
    return queueInteraction(
        state,
        createPlanForMoreOrderInteraction(playerId, remaining, [], timestamp),
        { urgent: true },
    );
}

function resolvePlanForMore(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    choices: PlanForMoreChoice[],
    timestamp: number,
): { events: SmashUpEvent[]; remaining: { uid: string; defId: string }[] } {
    const player = state.core.players[playerId];
    const revealed = player?.deck.slice(0, 3) ?? [];
    const byUid = new Map(revealed.map(card => [card.uid, card]));
    const selected = choices.filter(choice => choice.mode && choice.mode !== 'skip' && choice.cardUid && byUid.has(choice.cardUid));
    const playChoice = selected.find(choice => choice.mode === 'take_and_play' && choice.baseIndex !== undefined);
    const playUid = playChoice?.cardUid;
    const drawUids = Array.from(new Set(
        selected
            .filter(choice => choice.cardUid !== playUid)
            .map(choice => choice.cardUid!)
            .filter(uid => getCardDef(byUid.get(uid)?.defId ?? '')?.type === 'minion'),
    ));
    const unselectedTop = revealed.filter(card => card.uid !== playUid && !drawUids.includes(card.uid));
    const events: SmashUpEvent[] = [];

    if (playChoice?.cardUid && playChoice.defId && playChoice.baseIndex !== undefined) {
        const def = getCardDef(playChoice.defId);
        events.push({
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: playChoice.cardUid,
                defId: playChoice.defId,
                baseIndex: playChoice.baseIndex,
                baseDefId: state.core.bases[playChoice.baseIndex]?.defId,
                power: def?.type === 'minion' ? def.power : 0,
                fromDeck: true,
                consumesNormalLimit: false,
            },
            timestamp,
        } as MinionPlayedEvent);
    }

    if (drawUids.length > 0) {
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: drawUids.length, cardUids: drawUids },
            timestamp,
        } as CardsDrawnEvent);
    }

    return {
        events,
        remaining: unselectedTop.map(card => ({ uid: card.uid, defId: card.defId })),
    };
}

function resolvePlanForMoreOrder(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: PlanForMoreOrderContext,
    choice: PlanForMoreOrderChoice | undefined,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    if (!choice?.cardUid || !choice.defId) return { state, events: [] };

    const remaining = context.remaining.filter(card => card.uid !== choice.cardUid);
    const selected = context.remaining.find(card => card.uid === choice.cardUid && card.defId === choice.defId);
    if (!selected) return { state, events: [] };

    const ordered = [...context.ordered, selected];
    if (remaining.length > 1) {
        const nextState = queueInteraction(
            state,
            createPlanForMoreOrderInteraction(playerId, remaining, ordered, timestamp),
            { urgent: true },
        );
        return { state: nextState, events: [] };
    }

    const orderedTop = remaining.length === 1 ? [...ordered, remaining[0]] : ordered;
    const orderedUidSet = new Set(orderedTop.map(card => card.uid));
    const liveRest = (state.core.players[playerId]?.deck ?? [])
        .filter((card: CardInstance) => !orderedUidSet.has(card.uid))
        .map(card => card.uid);
    return {
        state,
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: [...orderedTop.map(card => card.uid), ...liveRest] },
            timestamp,
        } as DeckReorderedEvent],
    };
}

function specialUsedEvent(playerId: PlayerId, defId: string, baseIndex: number, timestamp: number): SpecialLimitUsedEvent {
    return emitSpecialLimitUsed(playerId, defId, baseIndex, timestamp) ?? {
        type: SU_EVENTS.SPECIAL_LIMIT_USED,
        payload: {
            playerId,
            baseIndex,
            limitGroup: `mega_troopers_${defId}`,
            abilityDefId: defId,
        },
        timestamp,
    };
}

function beta6Special(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now),
            addTempPower(ctx.cardUid, ctx.baseIndex, 1, 'mega_troopers_beta_6', ctx.now),
        ],
    };
}

function planForMorePod(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const revealed = (player?.deck ?? []).slice(0, 3);
    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.REVEAL_DECK_TOP,
        payload: {
            targetPlayerId: ctx.playerId,
            viewerPlayerId: ctx.playerId,
            cards: revealed.map(card => ({ uid: card.uid, defId: card.defId })),
            count: revealed.length,
            reason: 'mega_troopers_plan_for_more_pod',
            sourcePlayerId: ctx.playerId,
        },
        timestamp: ctx.now,
    } as SmashUpEvent];
    if (revealed.length === 0) return { events };

    const options = [
        createSkipOption(),
        ...revealed.flatMap((card, index) => {
            const def = getCardDef(card.defId);
            const drawOption = {
                id: `draw-${index}`,
                label: `抓取 ${cardLabel(card.defId)}`,
                value: {
                    mode: 'draw',
                    cardUid: card.uid,
                    defId: card.defId,
                } satisfies PlanForMorePodChoice,
                displayCard: { defId: card.defId, cardUid: card.uid },
            };
            if (def?.type !== 'minion') return [drawOption];
            return [
                drawOption,
                ...ctx.state.bases.map((base, baseIndex) => ({
                    id: `play-${index}-${baseIndex}`,
                    label: `额外打出 ${cardLabel(card.defId)} 到 ${baseLabel(ctx.state, baseIndex)}`,
                    value: {
                        mode: 'play',
                        cardUid: card.uid,
                        defId: card.defId,
                        baseIndex,
                    } satisfies PlanForMorePodChoice,
                    displayCard: { defId: card.defId, cardUid: card.uid },
                    _source: 'base' as const,
                    _target: { baseIndex, baseDefId: base.defId },
                })),
            ];
        }),
    ];
    const interaction = createSimpleChoice(
        `mega_troopers_plan_for_more_pod_${ctx.now}`,
        ctx.playerId,
        '谋划更多：你可以抓取其中一张牌，或将其中一个随从作为额外随从打出',
        options,
        {
            sourceId: 'mega_troopers_plan_for_more_pod',
            targetType: 'generic',
            titleKey: 'ui.mega_troopers_plan_for_more_pod_title',
        },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
        permutations([...items.slice(0, index), ...items.slice(index + 1)])
            .map(rest => [item, ...rest]),
    );
}

function createPlanForMorePodOrderInteraction(
    playerId: PlayerId,
    remaining: { uid: string; defId: string }[],
    timestamp: number,
) {
    const choices = permutations(remaining).flatMap((ordered, permutationIndex) =>
        Array.from({ length: ordered.length + 1 }, (_unused, splitIndex) => {
            const top = ordered.slice(0, splitIndex);
            const bottom = ordered.slice(splitIndex);
            const topLabel = top.length > 0 ? top.map(card => cardLabel(card.defId)).join(' → ') : '无';
            const bottomLabel = bottom.length > 0 ? bottom.map(card => cardLabel(card.defId)).join(' → ') : '无';
            return {
                id: `order-${permutationIndex}-${splitIndex}`,
                label: `牌库顶：${topLabel}；牌库底：${bottomLabel}`,
                value: {
                    topUids: top.map(card => card.uid),
                    bottomUids: bottom.map(card => card.uid),
                } satisfies PlanForMorePodOrderChoice,
            };
        }),
    );
    const interaction = createSimpleChoice(
        `mega_troopers_plan_for_more_pod_order_${timestamp}`,
        playerId,
        '谋划更多：将其余牌按任意顺序放到牌库顶和/或牌库底',
        choices,
        {
            sourceId: 'mega_troopers_plan_for_more_pod_order',
            targetType: 'generic',
            responseValidationMode: 'live',
            titleKey: 'ui.mega_troopers_plan_for_more_pod_order_title',
        },
    );
    (interaction.data as {
        continuationContext?: PlanForMorePodOrderContext;
    }).continuationContext = { remaining };
    return interaction;
}

function resolvePlanForMorePod(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    choice: PlanForMorePodChoice | undefined,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const revealed = state.core.players[playerId]?.deck.slice(0, 3) ?? [];
    const selected = choice?.cardUid
        ? revealed.find(card => card.uid === choice.cardUid && card.defId === choice.defId)
        : undefined;
    const events: SmashUpEvent[] = [];
    let consumedUid: string | undefined;

    if (choice?.mode === 'draw' && selected) {
        consumedUid = selected.uid;
        events.push({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: 1, cardUids: [selected.uid] },
            timestamp,
        } as CardsDrawnEvent);
    } else if (choice?.mode === 'play' && selected && choice.baseIndex !== undefined) {
        const def = getCardDef(selected.defId);
        if (def?.type === 'minion' && state.core.bases[choice.baseIndex]) {
            consumedUid = selected.uid;
            events.push({
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId,
                    cardUid: selected.uid,
                    defId: selected.defId,
                    baseIndex: choice.baseIndex,
                    baseDefId: state.core.bases[choice.baseIndex]?.defId,
                    power: def.power,
                    fromDeck: true,
                    consumesNormalLimit: false,
                },
                timestamp,
            } as MinionPlayedEvent);
        }
    }

    const remaining = revealed
        .filter(card => card.uid !== consumedUid)
        .map(card => ({ uid: card.uid, defId: card.defId }));
    if (remaining.length === 0) return { state, events };
    return {
        state: queueInteraction(
            state,
            createPlanForMorePodOrderInteraction(playerId, remaining, timestamp),
            { urgent: true },
        ),
        events,
    };
}

function resolvePlanForMorePodOrder(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: PlanForMorePodOrderContext,
    choice: PlanForMorePodOrderChoice | undefined,
    timestamp: number,
): { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } {
    const remainingUidSet = new Set(context.remaining.map(card => card.uid));
    const orderedUids = [...(choice?.topUids ?? []), ...(choice?.bottomUids ?? [])];
    if (
        orderedUids.length !== remainingUidSet.size
        || new Set(orderedUids).size !== remainingUidSet.size
        || orderedUids.some(uid => !remainingUidSet.has(uid))
    ) {
        return { state, events: [] };
    }
    const playerDeck = state.core.players[playerId]?.deck ?? [];
    const byUid = new Map(playerDeck.map(card => [card.uid, card]));
    const topCards = (choice?.topUids ?? []).map(uid => byUid.get(uid)).filter(Boolean) as CardInstance[];
    const bottomCards = (choice?.bottomUids ?? []).map(uid => byUid.get(uid)).filter(Boolean) as CardInstance[];
    if (topCards.length + bottomCards.length !== remainingUidSet.size) {
        return { state, events: [] };
    }
    const liveRest = playerDeck.filter(card => !remainingUidSet.has(card.uid));
    return {
        state,
        events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: {
                playerId,
                deckUids: [
                    ...topCards.map(card => card.uid),
                    ...liveRest.map(card => card.uid),
                    ...bottomCards.map(card => card.uid),
                ],
            },
            timestamp,
        } as DeckReorderedEvent],
    };
}

function beta6SpecialPod(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, minion => minion.controller === ctx.playerId);
    const interaction = createSimpleChoice(
        `mega_troopers_beta_6_pod_${ctx.now}`,
        ctx.playerId,
        '贝塔6号：你可以在你的一个随从上放置 1 枚 +1 力量指示物',
        [
            createSkipOption(),
            ...buildMinionTargetOptions(targets, {
                state: ctx.state,
                sourcePlayerId: ctx.playerId,
                sourceDefId: ctx.defId,
                effectType: 'affect',
            }),
        ],
        {
            sourceId: 'mega_troopers_beta_6_pod',
            targetType: 'minion',
            titleKey: 'ui.mega_troopers_beta_6_pod_title',
        },
    );
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function blueTrooperSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now),
            addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'mega_troopers_blue_trooper', ctx.now),
        ],
    };
}

function blueTrooperSpecialPod(ctx: AbilityContext): AbilityResult {
    const interaction = createSimpleChoice(
        `mega_troopers_blue_trooper_pod_${ctx.now}`,
        ctx.playerId,
        '蓝骑士：选择抓 1 张牌，或本随从直到你的回合结束获得 +2 力量',
        [
            createSkipOption(),
            {
                id: 'draw',
                label: '抓 1 张牌',
                labelKey: 'ui.mega_troopers_blue_trooper_pod_draw',
                value: { mode: 'draw' } satisfies BlueTrooperPodChoice,
            },
            {
                id: 'power',
                label: '本随从 +2 力量直到你的回合结束',
                labelKey: 'ui.mega_troopers_blue_trooper_pod_power',
                value: { mode: 'power' } satisfies BlueTrooperPodChoice,
            },
        ],
        {
            sourceId: 'mega_troopers_blue_trooper_pod',
            targetType: 'generic',
            titleKey: 'ui.mega_troopers_blue_trooper_pod_title',
        },
    );
    (interaction.data as {
        continuationContext?: { sourceCardUid: string; sourceBaseIndex: number };
    }).continuationContext = {
        sourceCardUid: ctx.cardUid,
        sourceBaseIndex: ctx.baseIndex,
    };
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function greenTrooperSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now),
            grantContextualExtraMinion(ctx, 'mega_troopers_green_trooper', ctx.baseIndex),
        ],
    };
}

function yellowTrooperSpecial(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        minion.controller === ctx.playerId && minion.uid !== ctx.cardUid && baseIndex !== ctx.baseIndex);
    if (targets.length === 0) {
        return { events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)] };
    }

    if (!ctx.matchState) {
        return { events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `mega_troopers_yellow_trooper_${ctx.now}`,
        ctx.playerId,
        '黄骑士：选择你的另一个随从移动到这里',
        [createSkipOption(), ...buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'move',
        })],
        { sourceId: 'mega_troopers_yellow_trooper', targetType: 'minion', titleKey: 'ui.mega_troopers_yellow_trooper_title', autoResolveIfSingle: false },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = {
        scoringBaseIndex: ctx.baseIndex,
        sourceDefId: ctx.defId,
    };
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function pinkTrooperSpecial(ctx: AbilityContext): AbilityResult {
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        baseIndex === ctx.baseIndex
        && minion.controller === ctx.playerId
        && getMinionPower(ctx.state, minion, baseIndex) <= 3);
    if (targets.length === 0) {
        return { events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `mega_troopers_pink_trooper_${ctx.now}`,
        ctx.playerId,
        '粉骑士：选择这里一个力量 3 或以下的己方随从返回手牌',
        [createSkipOption(), ...buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'return',
        })],
        { sourceId: 'mega_troopers_pink_trooper', targetType: 'minion', titleKey: 'ui.mega_troopers_pink_trooper_title' },
    );
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function lightningRescue(ctx: AbilityContext): AbilityResult {
    const actions = (ctx.state.players[ctx.playerId]?.hand ?? [])
        .filter(card => {
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            if (!def || def.type !== 'action') return false;
            if (card.uid === ctx.cardUid) return false;
            if (def.playNeedsMinion) return false;
            const validation = validateActionPlaySemantics(ctx.state, ctx.playerId, {
                defId: card.defId,
                targetBaseIndex: def.playNeedsBase || def.ongoingTarget === 'base' ? ctx.baseIndex : undefined,
                effectiveHandSize: getExternalActionEffectiveHandSize(ctx.matchState, ctx.playerId, true),
            });
            return validation.valid;
        });
    if (actions.length === 0) {
        return { events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `mega_troopers_lightning_rescue_${ctx.now}`,
        ctx.playerId,
        '闪电救援：选择一个行动作为特殊行动打出',
        [createSkipOption(), ...actions.map((card, index) => ({
            id: `action-${index}`,
            label: cardLabel(card.defId),
            value: { cardUid: card.uid, defId: card.defId, baseIndex: ctx.baseIndex },
            displayCard: { defId: card.defId, cardUid: card.uid },
            _source: 'hand' as const,
        }))],
        { sourceId: 'mega_troopers_lightning_rescue', targetType: 'hand', titleKey: 'ui.mega_troopers_lightning_rescue_title' },
    );
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function lightningRescuePod(ctx: AbilityContext): AbilityResult {
    const hasOwnMinion = ctx.state.bases[ctx.baseIndex]?.minions.some(
        minion => minion.controller === ctx.playerId,
    ) ?? false;
    if (!hasOwnMinion || playerIsFirstAtBase(ctx.state, ctx.playerId, ctx.baseIndex)) {
        return {
            events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        };
    }

    const actions = (ctx.state.players[ctx.playerId]?.hand ?? [])
        .filter(card => {
            const def = getCardDef(card.defId) as ActionCardDef | undefined;
            if (!def || def.type !== 'action' || card.uid === ctx.cardUid || def.playNeedsMinion) {
                return false;
            }
            const validation = validateActionPlaySemantics(ctx.state, ctx.playerId, {
                defId: card.defId,
                targetBaseIndex: def.playNeedsBase || def.ongoingTarget === 'base' ? ctx.baseIndex : undefined,
                effectiveHandSize: getExternalActionEffectiveHandSize(ctx.matchState, ctx.playerId, true),
            });
            return validation.valid;
        });
    if (actions.length === 0) {
        return {
            events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        };
    }

    const interaction = createSimpleChoice(
        `mega_troopers_lightning_rescue_pod_${ctx.now}`,
        ctx.playerId,
        '闪电救援：你可以额外打出一个行动',
        [
            createSkipOption(),
            ...actions.map((card, index) => ({
                id: `action-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId, baseIndex: ctx.baseIndex },
                displayCard: { defId: card.defId, cardUid: card.uid },
                _source: 'hand' as const,
            })),
        ],
        {
            sourceId: 'mega_troopers_lightning_rescue_pod',
            targetType: 'hand',
            titleKey: 'ui.mega_troopers_lightning_rescue_pod_title',
        },
    );
    return {
        events: [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function hasMegabotAtBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): boolean {
    return (state.titans ?? []).some(titan =>
        titan.defId === MEGABOT
        && titan.controllerId === playerId
        && titan.location.zone === 'base'
        && titan.location.baseIndex === baseIndex);
}

function playerIsFirstAtBase(state: SmashUpCore, playerId: PlayerId, baseIndex: number): boolean {
    const base = state.bases[baseIndex];
    if (!base) return false;
    const ownPower = getPlayerEffectivePowerOnBase(state, base, baseIndex, playerId);
    return state.turnOrder.every(pid => pid === playerId || getPlayerEffectivePowerOnBase(state, base, baseIndex, pid) <= ownPower);
}

function blitzingSwordAttack(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)];
    if (!hasMegabotAtBase(ctx.state, ctx.playerId, ctx.baseIndex) || playerIsFirstAtBase(ctx.state, ctx.playerId, ctx.baseIndex)) {
        return { events };
    }
    const targets = collectMinions(ctx.state, (minion, baseIndex) =>
        baseIndex === ctx.baseIndex && getMinionPower(ctx.state, minion, baseIndex) <= 4);
    if (targets.length === 0) return { events };
    if (!ctx.matchState) return { events };

    const interaction = createSimpleChoice(
        `mega_troopers_blitzing_sword_attack_${ctx.now}`,
        ctx.playerId,
        '一瞬千击：选择这里一个力量 4 或以下的随从消灭',
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'destroy',
        }),
        { sourceId: 'mega_troopers_blitzing_sword_attack', targetType: 'minion', titleKey: 'ui.mega_troopers_blitzing_sword_attack_title', autoResolveIfSingle: false },
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
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function blitzingSwordAttackPod(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)];
    if (!hasMegabotAtBase(ctx.state, ctx.playerId, ctx.baseIndex)) return { events };

    const targets = collectMinions(
        ctx.state,
        (minion, baseIndex) =>
            baseIndex === ctx.baseIndex
            && getMinionPower(ctx.state, minion, baseIndex) <= 4,
    );
    if (targets.length === 0) return { events };
    if (!ctx.matchState) return { events };
    const interaction = createSimpleChoice(
        `mega_troopers_blitzing_sword_attack_pod_${ctx.now}`,
        ctx.playerId,
        '闪电剑攻击：选择这里一个力量 4 或以下的随从消灭',
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: ctx.defId,
            effectType: 'destroy',
        }),
        {
            sourceId: 'mega_troopers_blitzing_sword_attack_pod',
            targetType: 'minion',
            titleKey: 'ui.mega_troopers_blitzing_sword_attack_pod_title',
            autoResolveIfSingle: false,
        },
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
        sourceBaseIndex: ctx.baseIndex,
    };
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

function powerPose(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [specialUsedEvent(ctx.playerId, ctx.defId, ctx.baseIndex, ctx.now)];
    if (!playerIsFirstAtBase(ctx.state, ctx.playerId, ctx.baseIndex)) return { events };
    events.push(...buildStandardDrawEvents(ctx.matchState, ctx.playerId, 2, ctx.random, ctx.now));
    return { events };
}

function powerPosePodBeforeScoring(ctx: TriggerContext): SmashUpEvent[] {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const controllerId = ctx.sourceControllerId;
    if (
        sourceBaseIndex === undefined
        || controllerId === undefined
        || ctx.baseIndex !== sourceBaseIndex
        || !ctx.matchState
        || playerIsFirstAtBase(ctx.state, controllerId, sourceBaseIndex)
    ) {
        return [];
    }
    return buildStandardDrawEvents(ctx.matchState, controllerId, 2, ctx.random, ctx.now);
}

function canTriggerPowerPosePodBeforeScoring(ctx: TriggerContext): boolean {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const controllerId = ctx.sourceControllerId;
    if (
        sourceBaseIndex === undefined
        || controllerId === undefined
        || ctx.baseIndex !== sourceBaseIndex
        || !ctx.matchState
        || playerIsFirstAtBase(ctx.state, controllerId, sourceBaseIndex)
    ) {
        return false;
    }
    const player = ctx.state.players[controllerId];
    return !!player && (player.deck.length > 0 || player.discard.length > 0);
}

function powerPosePodAfterScoring(ctx: TriggerContext): AbilityResult {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const controllerId = ctx.sourceControllerId;
    if (
        sourceBaseIndex === undefined
        || controllerId === undefined
        || ctx.baseIndex !== sourceBaseIndex
        || !ctx.matchState
        || !ctx.rankings?.some(
            ranking =>
                ranking.playerId === controllerId
                && ranking.power === Math.max(...ctx.rankings!.map(candidate => candidate.power)),
        )
    ) {
        return { events: [] };
    }
    const minions = (ctx.state.players[controllerId]?.hand ?? []).filter(card => {
        const def = getCardDef(card.defId);
        return def?.type === 'minion' && def.power <= 3;
    });
    if (minions.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `mega_troopers_power_pose_pod_after_scoring_${ctx.now}`,
        controllerId,
        '胜利姿态：你可以在替换基地上额外打出一个力量 3 或以下的随从',
        [
            createSkipOption(),
            ...minions.map((card, index) => ({
                id: `minion-${index}`,
                label: cardLabel(card.defId),
                value: { cardUid: card.uid, defId: card.defId },
                displayCard: { defId: card.defId, cardUid: card.uid },
                _source: 'hand' as const,
            })),
        ],
        {
            sourceId: 'mega_troopers_power_pose_pod_after_scoring',
            targetType: 'hand',
            titleKey: 'ui.mega_troopers_power_pose_pod_after_scoring_title',
        },
    );
    (interaction.data as {
        continuationContext?: {
            scoringBaseIndex: number;
            controllerId: PlayerId;
        };
    }).continuationContext = {
        scoringBaseIndex: sourceBaseIndex,
        controllerId,
    };
    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction, { urgent: true }),
    };
}

function canTriggerPowerPosePodAfterScoring(ctx: TriggerContext): boolean {
    const sourceBaseIndex = ctx.sourceBaseIndex;
    const controllerId = ctx.sourceControllerId;
    if (
        sourceBaseIndex === undefined
        || controllerId === undefined
        || ctx.baseIndex !== sourceBaseIndex
        || !ctx.matchState
        || !ctx.rankings?.some(
            ranking =>
                ranking.playerId === controllerId
                && ranking.power === Math.max(...ctx.rankings!.map(candidate => candidate.power)),
        )
    ) {
        return false;
    }
    return (ctx.state.players[controllerId]?.hand ?? []).some(card => {
        const def = getCardDef(card.defId);
        return def?.type === 'minion' && def.power <= 3;
    });
}

function blackTrooperSpecialInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.SPECIAL_LIMIT_USED) return undefined;
    const payload = (event as SpecialLimitUsedEvent).payload;
    const extraEvents: SmashUpEvent[] = [];
    state.bases.forEach((base, baseIndex) => {
        base.minions
            .filter(minion => minion.defId === 'mega_troopers_black_trooper' && minion.controller === payload.playerId)
            .forEach(minion => {
                extraEvents.push(addTempPower(minion.uid, baseIndex, 1, 'mega_troopers_black_trooper', event.timestamp));
            });
    });
    return extraEvents.length > 0 ? [event, ...extraEvents] : undefined;
}

function moonDumpsterOnBaseRevealed(ctx: BaseAbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const playerId of ctx.state.turnOrder) {
        const top = ctx.state.players[playerId]?.deck[0];
        if (!top) continue;
        events.push({
            type: SU_EVENTS.REVEAL_DECK_TOP,
            payload: {
                targetPlayerId: playerId,
                viewerPlayerId: 'all',
                cards: [{ uid: top.uid, defId: top.defId }],
                count: 1,
                reason: 'base_moon_dumpster',
            },
            timestamp: ctx.now,
        } as SmashUpEvent);
        const def = getCardDef(top.defId);
        if (def?.type !== 'minion') continue;
        events.push({
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId,
                cardUid: top.uid,
                defId: top.defId,
                baseIndex: ctx.baseIndex,
                baseDefId: ctx.baseDefId,
                power: def.power,
                fromDeck: true,
                consumesNormalLimit: false,
                skipOnPlayAbility: true,
            },
            timestamp: ctx.now,
        } as MinionPlayedEvent);
    }
    return { events };
}

function countSpecialsUsedAtBase(state: SmashUpCore, baseIndex: number): number {
    return Object.values(state.specialLimitUsed ?? {})
        .reduce((total, usedBases) => total + usedBases.filter(candidate => candidate === baseIndex).length, 0);
}

function juiceBarBeforeScoring(ctx: BaseAbilityContext): AbilityResult {
    const specialCount = countSpecialsUsedAtBase(ctx.state, ctx.baseIndex);
    const amount = specialCount * 2;
    if (amount <= 0) return { events: [] };
    const targets = ctx.state.bases[ctx.baseIndex]?.minions.map(minion => ({
        uid: minion.uid,
        defId: minion.defId,
        baseIndex: ctx.baseIndex,
        label: `${cardLabel(minion.defId)}（力量 ${getMinionPower(ctx.state, minion, ctx.baseIndex)}）`,
    })) ?? [];
    if (targets.length === 0) return { events: [] };
    if (!ctx.matchState) return { events: [] };

    const interaction = createSimpleChoice(
        `base_juice_bar_${ctx.now}`,
        ctx.playerId,
        `果汁吧：选择一个随从获得 +${amount} 力量`,
        buildMinionTargetOptions(targets, {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            sourceDefId: 'base_juice_bar',
            effectType: 'affect',
        }),
        { sourceId: 'base_juice_bar', targetType: 'minion', autoResolveIfSingle: false },
    );
    (interaction.data as { continuationContext?: unknown }).continuationContext = { amount };
    return { events: [], matchState: ctx.matchState ? queueInteraction(ctx.matchState, interaction) : undefined };
}

export function registerMegaTroopersAbilities(): void {
    registerAbility('mega_troopers_form_megabot', 'onPlay', formMegabot);
    registerAbility('mega_troopers_lightning_crystal', 'onPlay', lightningCrystal);
    registerAbility('mega_troopers_its_blitzin_time', 'onPlay', itsBlitzinTime);
    registerAbility('mega_troopers_mega_attack', 'onPlay', megaAttack);
    registerAbility('mega_troopers_plan_for_more', 'onPlay', planForMore);
    registerAbility('mega_troopers_red_trooper', 'talent', redTrooperTalent);
    registerAbility('mega_troopers_form_megabot_pod', 'onPlay', formMegabotPod);
    registerAbility('mega_troopers_lightning_crystal_pod', 'onPlay', lightningCrystalPod);
    registerAbility('mega_troopers_its_blitzin_time_pod', 'onPlay', itsBlitzinTimePod);
    registerAbility('mega_troopers_plan_for_more_pod', 'onPlay', planForMorePod);
    registerAbility('mega_troopers_red_trooper_pod', 'talent', redTrooperTalentPod);

    registerAbility('mega_troopers_lightning_rescue', 'special', lightningRescue);
    registerAbility('mega_troopers_blitzing_sword_attack', 'special', blitzingSwordAttack);
    registerAbility('mega_troopers_power_pose', 'special', powerPose);
    registerAbility('mega_troopers_beta_6', 'special', beta6Special);
    registerAbility('mega_troopers_blue_trooper', 'special', blueTrooperSpecial);
    registerAbility('mega_troopers_green_trooper', 'special', greenTrooperSpecial);
    registerAbility('mega_troopers_yellow_trooper', 'special', yellowTrooperSpecial);
    registerAbility('mega_troopers_pink_trooper', 'special', pinkTrooperSpecial);
    registerAbility('mega_troopers_lightning_rescue_pod', 'special', lightningRescuePod);
    registerAbility('mega_troopers_blitzing_sword_attack_pod', 'special', blitzingSwordAttackPod);
    registerAbility('mega_troopers_beta_6_pod', 'special', beta6SpecialPod);
    registerAbility('mega_troopers_blue_trooper_pod', 'special', blueTrooperSpecialPod);

    registerInterceptor('mega_troopers_black_trooper', blackTrooperSpecialInterceptor);
    registerTrigger(
        'mega_troopers_power_pose_pod',
        'beforeScoring',
        powerPosePodBeforeScoring,
        {
            playerContext: 'sourceController',
            sourceScope: 'triggerBase',
            canTrigger: canTriggerPowerPosePodBeforeScoring,
        },
    );
    registerTrigger(
        'mega_troopers_power_pose_pod',
        'afterScoring',
        powerPosePodAfterScoring,
        {
            playerContext: 'sourceController',
            sourceScope: 'triggerBase',
            canTrigger: canTriggerPowerPosePodAfterScoring,
        },
    );
    registerBreakpointModifier('mega_troopers_omega_protocol_pod', (ctx) => {
        const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
        return ctx.base.ongoingActions
            .filter(action =>
                action.defId === 'mega_troopers_omega_protocol_pod'
                && getActionControllerId(action) !== currentPlayerId,
            )
            .length * -10;
    });
    registerExtendedBase('base_moon_dumpster', 'onBaseRevealed', moonDumpsterOnBaseRevealed);
    registerBaseAbility('base_juice_bar', 'beforeScoring', juiceBarBeforeScoring);
}

export function registerMegaTroopersInteractionHandlers(): void {
    registerInteractionHandler('mega_troopers_form_megabot', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { state, events: [] };
        return { state, events: buildMegabotToBaseEvents(state.core, playerId, selected.baseIndex, 'mega_troopers_form_megabot', timestamp) };
    });

    registerInteractionHandler('mega_troopers_red_trooper', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { state, events: [] };
        return { state, events: buildMegabotToBaseEvents(state.core, playerId, selected.baseIndex, 'mega_troopers_red_trooper', timestamp) };
    });

    const formMegabotPodHandler = (state: MatchState<SmashUpCore>, playerId: PlayerId, value: unknown, data: Record<string, unknown> | undefined, _random: unknown, timestamp: number) => {
        const selectedValues = (Array.isArray(value) ? value : [value]) as Array<{
            skip?: boolean;
            baseIndex?: number;
            minionUid?: string;
            defId?: string;
            minionDefId?: string;
        }>;
        const baseChoice = selectedValues.find(choice => choice.baseIndex !== undefined && !choice.minionUid);
        if (baseChoice?.baseIndex !== undefined) {
            return {
                state,
                events: buildMegabotToBaseEvents(
                    state.core,
                    playerId,
                    baseChoice.baseIndex,
                    'mega_troopers_form_megabot_pod',
                    timestamp,
                ),
            };
        }
        const destinationBaseIndex = (data?.continuationContext as {
            destinationBaseIndex?: number;
        } | undefined)?.destinationBaseIndex;
        if (destinationBaseIndex === undefined) return { state, events: [] };
        const events = selectedValues.flatMap(selected => {
            if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return [];
            const minion = state.core.bases[selected.baseIndex]?.minions.find(
                candidate => candidate.uid === selected.minionUid && candidate.controller === playerId,
            );
            if (!minion || selected.baseIndex === destinationBaseIndex) return [];
            return buildValidatedMoveEvents(state, {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: destinationBaseIndex,
                reason: 'mega_troopers_form_megabot_pod',
                now: timestamp,
                sourcePlayerId: playerId,
                sourceDefId: 'mega_troopers_form_megabot_pod',
                sourceControllerId: playerId,
            });
        });
        return { state, events };
    };
    registerInteractionHandler('mega_troopers_form_megabot_pod', formMegabotPodHandler);
    registerInteractionHandler('mega_troopers_form_megabot_pod_move_minions', formMegabotPodHandler);

    registerInteractionHandler('mega_troopers_red_trooper_pod', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildMegabotToBaseEvents(
                state.core,
                playerId,
                selected.baseIndex,
                'mega_troopers_red_trooper_pod',
                timestamp,
            ),
        };
    });

    registerInteractionHandler('mega_troopers_lightning_crystal', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as ActionAttachmentChoice | undefined;
        if (!selected?.cardUid || !selected.defId || !selected.ownerId) return { state, events: [] };
        return { state, events: [detachOngoing(selected, 'mega_troopers_lightning_crystal', timestamp)] };
    });

    registerInteractionHandler('mega_troopers_lightning_crystal_pod', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as DestroyActionOrTitanChoice | undefined;
        if (!selected) return { state, events: [] };
        if (selected.kind === 'action') {
            if (!selected.cardUid || !selected.defId || !selected.ownerId) return { state, events: [] };
            return {
                state,
                events: [detachOngoing(selected, 'mega_troopers_lightning_crystal_pod', timestamp)],
            };
        }
        const titan = (state.core.titans ?? []).find(candidate => candidate.uid === selected.titanUid);
        return {
            state,
            events: titan
                ? [removeTitanFromPlay(titan, 'mega_troopers_lightning_crystal_pod', timestamp)]
                : [],
        };
    });

    registerInteractionHandler('mega_troopers_its_blitzin_time', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return { state, events: [addTempPower(selected.minionUid, selected.baseIndex, 3, 'mega_troopers_its_blitzin_time', timestamp)] };
    });

    registerInteractionHandler('mega_troopers_its_blitzin_time_pod', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: [
                addTempPower(
                    selected.minionUid,
                    selected.baseIndex,
                    4,
                    'mega_troopers_its_blitzin_time_pod',
                    timestamp,
                ),
            ],
        };
    });

    registerInteractionHandler('mega_troopers_beta_6_pod', (state, _playerId, value, _data, _random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            minionUid?: string;
            baseIndex?: number;
        } | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                addPowerCounter(
                    selected.minionUid,
                    selected.baseIndex,
                    1,
                    'mega_troopers_beta_6_pod',
                    timestamp,
                ),
            ],
        };
    });

    registerInteractionHandler('mega_troopers_blue_trooper_pod', (state, playerId, value, data, random, timestamp) => {
        const selected = value as BlueTrooperPodChoice | undefined;
        if (!selected?.mode || selected.mode === 'skip') return { state, events: [] };
        if (selected.mode === 'draw') {
            return {
                state,
                events: buildStandardDrawEvents(state, playerId, 1, random, timestamp),
            };
        }
        const context = data?.continuationContext as {
            sourceCardUid?: string;
            sourceBaseIndex?: number;
        } | undefined;
        if (!context?.sourceCardUid || context.sourceBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: [
                addPermanentPower(
                    context.sourceCardUid,
                    context.sourceBaseIndex,
                    2,
                    'mega_troopers_blue_trooper_pod',
                    timestamp,
                    {
                        expiresOnTurnNumber: getPlayerTurnEndExpiration(state.core, playerId),
                        sourcePlayerId: playerId,
                        sourceCardUid: context.sourceCardUid,
                        sourceDefId: 'mega_troopers_blue_trooper_pod',
                        sourceControllerId: playerId,
                        sourceBaseIndex: context.sourceBaseIndex,
                    },
                ),
            ],
        };
    });

    registerInteractionHandler('mega_troopers_mega_attack', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as {
            continuationContext?: {
                sourceCardUid?: string;
                sourceDefId?: string;
                sourceBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const selected = value as { minionUid?: string; defId?: string; minionDefId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'mega_troopers_mega_attack',
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

    registerInteractionHandler('mega_troopers_plan_for_more', (state, playerId, value, _data, _random, timestamp) => {
        const choices = (Array.isArray(value) ? value : [value]) as PlanForMoreChoice[];
        const result = resolvePlanForMore(state, playerId, choices, timestamp);
        return {
            state: queuePlanForMoreOrderIfNeeded(state, playerId, result.remaining, timestamp),
            events: result.events,
        };
    });

    registerInteractionHandler('mega_troopers_plan_for_more_order', (state, playerId, value, data, _random, timestamp) => {
        const context = data?.continuationContext as PlanForMoreOrderContext | undefined;
        if (!context) return { state, events: [] };
        return resolvePlanForMoreOrder(state, playerId, context, value as PlanForMoreOrderChoice | undefined, timestamp);
    });

    registerInteractionHandler('mega_troopers_yellow_trooper', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number } | undefined;
        const context = data?.continuationContext as { scoringBaseIndex?: number } | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined || context?.scoringBaseIndex === undefined) {
            return { state, events: [] };
        }
        return {
            state,
            events: buildValidatedMoveEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                toBaseIndex: context.scoringBaseIndex,
                reason: 'mega_troopers_yellow_trooper',
                now: timestamp,
                sourcePlayerId: _playerId,
                sourceDefId: 'mega_troopers_yellow_trooper',
                sourceControllerId: _playerId,
                sourceBaseIndex: context.scoringBaseIndex,
            }),
        };
    });

    registerInteractionHandler('mega_troopers_pink_trooper', (state, playerId, value, _data, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; defId?: string; baseIndex?: number } | undefined;
        if (selected?.skip || !selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedReturnEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                toPlayerId: playerId,
                reason: 'mega_troopers_pink_trooper',
                now: timestamp,
                sourcePlayerId: playerId,
            }),
        };
    });

    registerInteractionHandler('mega_troopers_lightning_rescue', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as { skip?: boolean; cardUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const def = getCardDef(selected.defId) as ActionCardDef | undefined;
        const targetBaseIndex = def?.playNeedsBase || def?.ongoingTarget === 'base' ? selected.baseIndex : undefined;
        const events: SmashUpEvent[] = [buildActionPlayedEvent({
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            timestamp,
            isExtraAction: true,
        })];
        const result = appendResolvedActionAbility({
            state,
            events,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            ...(targetBaseIndex !== undefined ? { targetBaseIndex } : {}),
            handSizeAfterPlay: getExternalActionEffectiveHandSize(state, playerId, true),
        });
        return result;
    });

    registerInteractionHandler('mega_troopers_plan_for_more_pod', (state, playerId, value, _data, _random, timestamp) => {
        return resolvePlanForMorePod(
            state,
            playerId,
            value as PlanForMorePodChoice | undefined,
            timestamp,
        );
    });

    registerInteractionHandler('mega_troopers_plan_for_more_pod_order', (state, playerId, value, data, _random, timestamp) => {
        const context = data?.continuationContext as PlanForMorePodOrderContext | undefined;
        if (!context) return { state, events: [] };
        return resolvePlanForMorePodOrder(
            state,
            playerId,
            context,
            value as PlanForMorePodOrderChoice | undefined,
            timestamp,
        );
    });

    registerInteractionHandler('mega_troopers_power_pose_pod_after_scoring', (state, playerId, value, data, _random, _timestamp) => {
        const selected = value as {
            skip?: boolean;
            cardUid?: string;
            defId?: string;
        } | undefined;
        const continuation = data?.continuationContext as {
            scoringBaseIndex?: number;
            controllerId?: PlayerId;
        } | undefined;
        if (
            selected?.skip
            || !selected?.cardUid
            || !selected.defId
            || continuation?.controllerId !== playerId
            || continuation.scoringBaseIndex === undefined
        ) {
            return { state, events: [] };
        }
        const card = state.core.players[playerId]?.hand.find(
            candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId,
        );
        const def = card ? getCardDef(card.defId) : undefined;
        const replacementBaseDefId = getDeferredReplacementBaseDefId(
            state,
            data as Record<string, unknown> | undefined,
        );
        if (!card || def?.type !== 'minion' || def.power > 3 || !replacementBaseDefId) {
            return { state, events: [] };
        }
        return {
            state: appendPendingPostScoringActions(state, [{
                kind: 'playMinionOnReplacementBase',
                playerId,
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                fromZone: 'hand',
                baseIndex: continuation.scoringBaseIndex,
                targetBaseDefId: replacementBaseDefId,
                power: def.power,
            }]),
            events: [],
        };
    });

    registerInteractionHandler('mega_troopers_lightning_rescue_pod', (state, playerId, value, _data, random, timestamp) => {
        const selected = value as {
            skip?: boolean;
            cardUid?: string;
            defId?: string;
            baseIndex?: number;
        } | undefined;
        if (selected?.skip || !selected?.cardUid || !selected.defId || selected.baseIndex === undefined) {
            return { state, events: [] };
        }
        const card = state.core.players[playerId]?.hand.find(
            candidate => candidate.uid === selected.cardUid && candidate.defId === selected.defId,
        );
        if (!card) return { state, events: [] };
        const def = getCardDef(selected.defId) as ActionCardDef | undefined;
        const targetBaseIndex = def?.playNeedsBase || def?.ongoingTarget === 'base'
            ? selected.baseIndex
            : undefined;
        const events: SmashUpEvent[] = [buildActionPlayedEvent({
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            ownerId: card.owner,
            timestamp,
            isExtraAction: true,
            targetBaseIndex,
        })];
        if (def?.subtype === 'ongoing' && targetBaseIndex !== undefined) {
            events.push(...buildSemanticOngoingAttachEvents(state, {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner,
                ...(card.owner !== playerId ? { sourcePlayerId: playerId } : {}),
                targetBaseIndex,
                onBlockedSourceDestination: 'discard',
                now: timestamp,
            }));
        }
        return appendResolvedActionAbility({
            state,
            events,
            playerId,
            cardUid: selected.cardUid,
            defId: selected.defId,
            random,
            timestamp,
            baseIndex: selected.baseIndex,
            ...(targetBaseIndex !== undefined ? { targetBaseIndex } : {}),
            handSizeAfterPlay: getExternalActionEffectiveHandSize(state, playerId, true),
        });
    });

    registerInteractionHandler('mega_troopers_blitzing_sword_attack', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as {
            continuationContext?: {
                sourceCardUid?: string;
                sourceDefId?: string;
                sourceBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const selected = value as { minionUid?: string; defId?: string; minionDefId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'mega_troopers_blitzing_sword_attack',
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

    registerInteractionHandler('mega_troopers_blitzing_sword_attack_pod', (state, playerId, value, data, _random, timestamp) => {
        const continuation = (data as {
            continuationContext?: {
                sourceCardUid?: string;
                sourceDefId?: string;
                sourceBaseIndex?: number;
            };
        } | undefined)?.continuationContext;
        const selected = value as {
            minionUid?: string;
            defId?: string;
            minionDefId?: string;
            baseIndex?: number;
        } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { state, events: [] };
        return {
            state,
            events: buildValidatedDestroyEvents(state.core, {
                minionUid: selected.minionUid,
                minionDefId: selected.minionDefId ?? selected.defId ?? '',
                fromBaseIndex: selected.baseIndex,
                destroyerId: playerId,
                reason: 'mega_troopers_blitzing_sword_attack_pod',
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

    registerInteractionHandler('base_juice_bar', (state, _playerId, value, data, _random, timestamp) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        const amount = (data?.continuationContext as { amount?: number } | undefined)?.amount ?? 0;
        if (!selected?.minionUid || selected.baseIndex === undefined || amount <= 0) return { state, events: [] };
        return { state, events: [addTempPower(selected.minionUid, selected.baseIndex, amount, 'base_juice_bar', timestamp)] };
    });
}
