import type { MatchState, PlayerId } from '../../../engine/types';
import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { canStartDuel, startDuelWithEvents } from '../domain/duel';
import { registerDiscardSpecialProvider } from '../domain/discardSpecialAbilities';
import { buildBuryCardEvents } from '../domain/bury';
import {
    addPowerCounter,
    addPermanentPower,
    removePowerCounter,
    addTempPower,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildFieldSourceTargetOptions,
    buildFieldSourceTargetPromptConfig,
    buildFieldSourceToBaseTargetOptions,
    buildMinionTargetOptions,
    buildPlayerTargetOptions,
    buildSemanticOngoingAttachEvents,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildValidatedReturnEvents,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
    createSkipOption,
    getMinionPower,
    grantContextualExtraAction,
    peekDeckTop,
    recoverCardsFromDiscard,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type {
    MinionDestroyedEvent,
    MinionMetadataUpdatedEvent,
    MinionMovedEvent,
    MinionReturnedEvent,
    OngoingAttachedEvent,
    CardTransferredEvent,
    CardsDrawnEvent,
    MinionCardDef,
    PowerCounterAddedEvent,
    PowerCounterRemovedEvent,
    SmashUpCore,
    SmashUpEvent,
    TempPowerAddedEvent,
    PermanentPowerAddedEvent,
} from '../domain/types';
import { getBaseDef, getCardDef } from '../data/cards';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';
import { resolveLiveBaseIndex } from '../domain/utils';
import { createCardObjectRef, createCardTransferEvent } from '../domain/objectProvenance';
import { buildOngoingDetachedEvent } from '../domain/ongoingDetach';

type MinionChoice = { minionUid?: string; baseIndex?: number; defId?: string; skip?: boolean };
type PlayerChoice = { targetPlayerId?: PlayerId; skip?: boolean };
type StonefordChoice = { cardUid?: string; defId?: string };
type CardChoice = { cardUid?: string; defId?: string; skip?: boolean };
type BaseChoice = { baseIndex?: number; baseDefId?: string; skip?: boolean };

type SheriffContinuation = {
    friendlyMinionUid: string;
    casterPlayerId: PlayerId;
    sourceDefId: string;
};

type MummyContinuation = {
    cardUid: string;
    defId: string;
};

type AkyeContinuation = {
    targetPlayerId: PlayerId;
};

type HighSpeedChaseContinuation = {
    sourceCardUid: string;
    sourceBaseIndex: number;
    minionUid: string;
    minionDefId: string;
    sourceControllerId: PlayerId;
};

type MouseBirdAndSausageContinuation = {
    baseIndex: number;
    faction: string;
};

type EhContinuation = {
    sourceCardUid: string;
};

type BewitchedTransferContinuation = {
    sourceCardUid: string;
    sourceDefId: string;
    ownerId: PlayerId;
};

type WorldChampsPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type WorldChampsMinionPromptContext = WorldChampsPromptContext & {
    sourceBaseIndex: number;
    sourceCardUid: string;
    sourceDefId: string;
};

type WorldChampsAkyeCardPromptContext = WorldChampsPromptContext & AkyeContinuation;

type WorldChampsHighSpeedChaseBasePromptContext = WorldChampsPromptContext & HighSpeedChaseContinuation;

type WorldChampsMouseBirdTargetsPromptContext = WorldChampsPromptContext & MouseBirdAndSausageContinuation;

type WorldChampsEhPromptContext = WorldChampsPromptContext & EhContinuation;

type WorldChampsSheriffPromptContext = WorldChampsPromptContext & SheriffContinuation & {
    sourceBaseIndex: number;
};

type WorldChampsMummyPromptContext = WorldChampsPromptContext & MummyContinuation & {
    sourceBaseIndex: number;
    sourceControllerId: PlayerId;
};

type WorldChampsBewitchedTransferPromptContext = WorldChampsPromptContext & BewitchedTransferContinuation & {
    triggerMinionUid: string;
};

const WORLD_CHAMPS_ARAMIS_TRIGGERED_TURN_META = 'worldChampsAramisTriggeredTurn';
const WORLD_CHAMPS_DIVA_TRIGGERED_TURN_META = 'worldChampsDivaTriggeredTurn';

function createWorldChampsPromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): WorldChampsPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
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
    return createCardTransferEvent({
        card: createCardObjectRef({
            uid: cardUid,
            defId,
            ownerId: fromPlayerId,
        }),
        fromPlayerId,
        toPlayerId,
        reason,
        timestamp,
    });
}

function getOtherPlayers(state: SmashUpCore, playerId: PlayerId): PlayerId[] {
    return state.turnOrder.filter(pid => pid !== playerId);
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId) {
    const minions: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        base.minions.forEach((minion) => {
            if (minion.controller !== playerId) return;
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            minions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        });
    });
    return minions;
}

function collectAllMinions(state: SmashUpCore): Array<{ uid: string; defId: string; baseIndex: number; label: string }> {
    const minions: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
    state.bases.forEach((base, baseIndex) => {
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        base.minions.forEach((minion) => {
            const minionName = getCardDef(minion.defId)?.name ?? minion.defId;
            minions.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${minionName} @ ${baseName}`,
            });
        });
    });
    return minions;
}

function isActionDefId(defId?: string): boolean {
    if (!defId) return false;
    const def = getCardDef(defId);
    return !!def && def.type === 'action';
}

function isStandardActionDefId(defId?: string): boolean {
    if (!defId) return false;
    const def = getCardDef(defId);
    return !!def && def.type === 'action' && def.subtype === 'standard';
}

function buildMinionMetadataUpdatedEvent(
    minionUid: string,
    baseIndex: number,
    metadataUpdate: Record<string, unknown>,
    reason: string,
    timestamp: number,
): MinionMetadataUpdatedEvent {
    return {
        type: SU_EVENTS.MINION_METADATA_UPDATED,
        payload: {
            minionUid,
            baseIndex,
            metadataUpdate,
            reason,
        },
        timestamp,
    };
}

function buildEnemyMinionFieldTargets(
    state: SmashUpCore,
    baseIndex: number,
    sourcePlayerId: PlayerId,
    sourceDefId: string,
) {
    const base = state.bases[baseIndex];
    if (!base) return [];
    const targets = base.minions
        .filter(minion => minion.controller !== sourcePlayerId)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex,
            label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量 ${getMinionPower(state, minion, baseIndex)}）`,
        }));
    const targetOptions = buildMinionTargetOptions(targets, {
        state,
        sourcePlayerId,
        sourceDefId,
        effectType: 'destroy',
    });
    return targetOptions.map(option => ({
        type: 'minion' as const,
        label: option.label,
        uid: option.value.minionUid,
        defId: option.value.defId,
        baseIndex: option.value.baseIndex,
        aiHint: option._ai,
    }));
}

const worldChampsStonefordPromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_stoneford',
    buildInteraction: (context) => {
        const player = context.matchState.core.players[context.playerId];
        const options = player.deck
            .filter(card => card.type === 'action')
            .map((card, index) => ({
                id: `action-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'deck' as const,
                displayMode: 'card' as const,
            }));
        return createAbilityRuntimeSimpleChoice(
            `world_champs_stoneford_${context.now}`,
            context.playerId,
            '斯坦福：从牌库选择一张行动卡加入手牌',
            options,
            {
                sourceId: 'world_champs_stoneford',
                targetType: 'generic',
                autoResolveIfSingle: false,
                autoRefresh: 'deck',
                responseValidationMode: 'live',
                titleKey: 'ui.world_champs_stoneford_title',
            },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as StonefordChoice;
        if (!selected.cardUid) return { events: [] };
        const player = context.matchState.core.players[context.playerId];
        const selectedCard = player.deck.find(card => card.uid === selected.cardUid && (!selected.defId || card.defId === selected.defId));
        if (!selectedCard || selectedCard.type !== 'action') return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: context.playerId, count: 1, cardUids: [selectedCard.uid] },
                timestamp,
            } as CardsDrawnEvent],
        };
    },
});

const worldChampsShieldMaidenPromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_shield_maiden',
    buildInteraction: (context) => {
        const state = context.matchState.core;
        const opponents = getOtherPlayers(state, context.playerId).filter(pid => {
            const player = state.players[pid];
            return !!player && (player.deck.length > 0 || player.discard.length > 0);
        });
        return createAbilityRuntimeSimpleChoice(
            `world_champs_shield_maiden_${context.now}`,
            context.playerId,
            '盾牌少女：选择另一位玩家，展示其牌库顶的一张牌',
            [
                createSkipOption('跳过（不揭示）', 'ui.world_champs_shield_maiden_skip_option'),
                ...buildPlayerTargetOptions(
                    opponents.map((pid) => ({
                        label: `玩家 ${pid}`,
                        targetPlayerId: pid,
                        displayMode: 'button' as const,
                    })),
                    {
                        state: context.matchState.core,
                        sourcePlayerId: context.playerId,
                        effectIntent: 'inspect',
                    },
                ),
            ],
            { sourceId: 'world_champs_shield_maiden', targetType: 'generic', titleKey: 'ui.world_champs_shield_maiden_title' },
        );
    },
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as PlayerChoice;
        if (selected.skip || !selected.targetPlayerId) return { events: [] };
        const peek = peekDeckTop(state.core, random, selected.targetPlayerId, 'all', 'world_champs_shield_maiden', timestamp);
        if (!peek) return { events: [] };

        const events: SmashUpEvent[] = [...peek.events];
        const topCard = peek.card;
        let shouldGainCard = topCard.type === 'action';
        if (!shouldGainCard && topCard.type === 'minion') {
            const minionDef = getCardDef(topCard.defId) as MinionCardDef | undefined;
            shouldGainCard = (minionDef?.power ?? 99) <= 3;
        }
        if (shouldGainCard) {
            events.push(transferCard(topCard.uid, topCard.defId, selected.targetPlayerId, context.playerId, 'world_champs_shield_maiden', timestamp));
        }
        return { events };
    },
});

const worldChampsCalicoinPromptProgram = createPromptProgram<WorldChampsMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_calicoin',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const targets = base?.minions
            .filter(minion => minion.uid !== context.sourceCardUid)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `world_champs_calicoin_${context.now}`,
            context.playerId,
            '金币猫：选择一个其他随从放置 1 个 +1 力量指示物',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: context.sourceDefId,
            }),
            { sourceId: 'world_champs_calicoin', targetType: 'minion', titleKey: 'ui.world_champs_calicoin_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'world_champs_calicoin', timestamp)],
        };
    },
});

const worldChampsItsBlitzinTimePromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_its_blitzin_time',
    buildInteraction: (context) => {
        const ownMinions = collectOwnMinions(context.matchState.core, context.playerId);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_its_blitzin_time_${context.now}`,
            context.playerId,
            '现在是闪电时间！：选择你的一个随从，本回合力量 +3',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_its_blitzin_time',
            }),
            { sourceId: 'world_champs_its_blitzin_time', targetType: 'minion', titleKey: 'ui.world_champs_its_blitzin_time_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addTempPower(selected.minionUid, selected.baseIndex, 3, 'world_champs_its_blitzin_time', timestamp)],
        };
    },
});

const worldChampsFightingSpiritPrizePromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_fighting_spirit_prize',
    buildInteraction: (context) => {
        const ownMinions = collectOwnMinions(context.matchState.core, context.playerId);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_fighting_spirit_prize_${context.now}`,
            context.playerId,
            '战斗精神奖：选择 1-2 个你的随从分配 2 个 +1 力量指示物',
            buildMinionTargetOptions(ownMinions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_fighting_spirit_prize',
            }),
            {
                sourceId: 'world_champs_fighting_spirit_prize',
                targetType: 'minion',
                multi: { min: 1, max: Math.min(2, ownMinions.length) },
                titleKey: 'ui.world_champs_fighting_spirit_prize_title',
            },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const picks = Array.isArray(value) ? value as MinionChoice[] : [value as MinionChoice];
        const validPicks = picks
            .filter(pick => !pick.skip && pick.minionUid && pick.baseIndex !== undefined)
            .slice(0, 2);
        if (validPicks.length === 0) return { events: [] };
        if (validPicks.length === 1) {
            const only = validPicks[0];
            return {
                events: [
                    addPowerCounter(only.minionUid!, only.baseIndex!, 1, 'world_champs_fighting_spirit_prize', timestamp),
                    addPowerCounter(only.minionUid!, only.baseIndex!, 1, 'world_champs_fighting_spirit_prize', timestamp),
                ],
            };
        }
        return {
            events: validPicks.map((pick) => addPowerCounter(
                pick.minionUid!,
                pick.baseIndex!,
                1,
                'world_champs_fighting_spirit_prize',
                timestamp,
            )),
        };
    },
});

const worldChampsAkyeCardPromptProgram = createPromptProgram<WorldChampsAkyeCardPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_akye_the_turtle_card',
    buildInteraction: (context) => {
        const player = context.matchState.core.players[context.playerId];
        return createAbilityRuntimeSimpleChoice(
            `world_champs_akye_the_turtle_card_${context.now}`,
            context.playerId,
            '阿克耶海龟：选择要交给对方的一张手牌',
            player.hand.map((card, index) => ({
                id: `card-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            })),
            { sourceId: 'world_champs_akye_the_turtle_card', targetType: 'hand', titleKey: 'ui.world_champs_akye_the_turtle_card_title' },
        );
    },
    onResolve: (args) => {
        const { state, context, value, timestamp } = args;
        const selected = value as CardChoice;
        if (!selected.cardUid || !selected.defId || !context.targetPlayerId) return { events: [] };
        return {
            events: [
                transferCard(selected.cardUid, selected.defId, context.playerId, context.targetPlayerId, 'world_champs_akye_the_turtle', timestamp),
                ...buildStandardDrawEventsFromRuntimeContext(args, context.playerId, 2),
            ],
        };
    },
});

const worldChampsAkyePlayerPromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_akye_the_turtle_player',
    buildInteraction: (context) => {
        const opponents = getOtherPlayers(context.matchState.core, context.playerId);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_akye_the_turtle_player_${context.now}`,
            context.playerId,
            '阿克耶海龟：选择一位玩家并交给其一张手牌（然后你抽两张牌）',
            [
                createSkipOption('跳过（不发动）', 'ui.world_champs_akye_the_turtle_skip_option'),
                ...buildPlayerTargetOptions(
                    opponents.map(opponentId => ({
                        targetPlayerId: opponentId,
                        label: `玩家 ${opponentId}`,
                        displayMode: 'button' as const,
                    })),
                    {
                        state: context.matchState.core,
                        sourcePlayerId: context.playerId,
                        effectIntent: 'affect',
                    },
                ),
            ],
            { sourceId: 'world_champs_akye_the_turtle_player', targetType: 'generic', titleKey: 'ui.world_champs_akye_the_turtle_player_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as PlayerChoice;
        if (selected.skip || !selected.targetPlayerId) return { events: [] };
        const player = state.core.players[playerId];
        if (!player || player.hand.length === 0) return { events: [] };
        return {
            events: [],
            context: createWorldChampsPromptContext(state, playerId, timestamp, {
                targetPlayerId: selected.targetPlayerId,
            } satisfies AkyeContinuation),
            nextProgram: worldChampsAkyeCardPromptProgram,
        };
    },
});

const worldChampsFastAsLightningPromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_fast_as_lightning',
    buildInteraction: (context) => {
        const minions = collectAllMinions(context.matchState.core);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_fast_as_lightning_${context.now}`,
            context.playerId,
            '快如闪电：选择一个随从，本回合力量 +2',
            buildMinionTargetOptions(minions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_fast_as_lightning',
                effectType: 'affect',
            }),
            { sourceId: 'world_champs_fast_as_lightning', targetType: 'minion', titleKey: 'ui.world_champs_fast_as_lightning_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addTempPower(selected.minionUid, selected.baseIndex, 2, 'world_champs_fast_as_lightning', timestamp)],
        };
    },
});

const worldChampsHighSpeedChaseBasePromptProgram = createPromptProgram<WorldChampsHighSpeedChaseBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_high_speed_chase_base',
    buildInteraction: (context) => {
        const baseOptions = context.matchState.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            }))
            .filter(base => base.baseIndex !== context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_high_speed_chase_base_${context.now}`,
            context.playerId,
            '高速追逐：选择目标基地',
            buildBaseTargetOptions(baseOptions, context.matchState.core),
            { sourceId: 'world_champs_high_speed_chase_base', targetType: 'base', titleKey: 'ui.world_champs_high_speed_chase_base_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as BaseChoice;
        if (selected.baseIndex === undefined) return { events: [] };

        const sourceBase = state.core.bases[context.sourceBaseIndex];
        const ongoing = sourceBase?.ongoingActions.find(action => action.uid === context.sourceCardUid);
        if (!ongoing) return { events: [] };
        const moveEvents = buildValidatedMoveEvents(state, {
            minionUid: context.minionUid,
            minionDefId: context.minionDefId,
            fromBaseIndex: context.sourceBaseIndex,
            toBaseIndex: selected.baseIndex,
            reason: 'world_champs_high_speed_chase',
            now: timestamp,
            sourcePlayerId: context.sourceControllerId,
            sourceDefId: 'world_champs_high_speed_chase',
            sourceControllerId: context.sourceControllerId,
            sourceBaseIndex: context.sourceBaseIndex,
            sourceKind: 'action',
        });

        return {
            events: [
                buildOngoingDetachedEvent({
                    cardUid: ongoing.uid,
                    defId: ongoing.defId,
                    ownerId: ongoing.ownerId,
                    reason: 'world_champs_high_speed_chase',
                    now: timestamp,
                }),
                {
                    type: SU_EVENTS.ONGOING_ATTACHED,
                    payload: {
                        cardUid: ongoing.uid,
                        defId: ongoing.defId,
                        ownerId: ongoing.ownerId,
                        ...(ongoing.ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                        targetType: 'base',
                        targetBaseIndex: selected.baseIndex,
                        metadata: ongoing.metadata,
                        talentUsed: true,
                    },
                    timestamp,
                } as SmashUpEvent,
                ...moveEvents,
                ...(moveEvents.length > 0 ? [addTempPower(context.minionUid, selected.baseIndex, 3, 'world_champs_high_speed_chase', timestamp)] : []),
            ],
        };
    },
});

const worldChampsHighSpeedChaseMinionPromptProgram = createPromptProgram<WorldChampsPromptContext & { sourceBaseIndex: number }, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_high_speed_chase_minion',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const ownMinionsHere = base?.minions
            .filter(minion => minion.controller === context.playerId)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `world_champs_high_speed_chase_minion_${context.now}`,
            context.playerId,
            '高速追逐：选择你在此基地的一个随从',
            buildMinionTargetOptions(ownMinionsHere, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_high_speed_chase',
                effectType: 'move',
            }),
            { sourceId: 'world_champs_high_speed_chase_minion', targetType: 'minion', titleKey: 'ui.world_champs_high_speed_chase_minion_title' },
        );
    },
    onResolve: ({ state, context, playerId, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const baseOptions = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`,
            }))
            .filter(base => base.baseIndex !== selected.baseIndex);
        if (baseOptions.length === 0) return { events: [] };
        return {
            events: [],
            context: createWorldChampsPromptContext(state, playerId, timestamp, {
                sourceCardUid: context.sourceCardUid,
                sourceBaseIndex: selected.baseIndex,
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                sourceControllerId: context.playerId,
            } satisfies HighSpeedChaseContinuation),
            nextProgram: worldChampsHighSpeedChaseBasePromptProgram,
        };
    },
});

const worldChampsMouseBirdTargetsPromptProgram = createPromptProgram<WorldChampsMouseBirdTargetsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_mouse_bird_and_sausage_targets',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const candidates = base?.minions
            .filter(minion => getCardDef(minion.defId)?.faction === context.faction)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })) ?? [];
        return createAbilityRuntimeSimpleChoice(
            `world_champs_mouse_bird_and_sausage_targets_${context.now}`,
            context.playerId,
            '老鼠、鸟和香肠：选择至多两张同派系随从',
            buildMinionTargetOptions(candidates, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_mouse_bird_and_sausage',
                effectType: 'affect',
            }),
            {
                sourceId: 'world_champs_mouse_bird_and_sausage_targets',
                targetType: 'minion',
                multi: { min: 1, max: Math.min(2, candidates.length) },
                titleKey: 'ui.world_champs_mouse_bird_and_sausage_targets_title',
            },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const picks = (Array.isArray(value) ? value : [value]) as MinionChoice[];
        const selected = picks
            .filter(pick => pick.minionUid && pick.baseIndex === context.baseIndex)
            .slice(0, 2);
        if (selected.length === 0) return { events: [] };
        return {
            events: selected.map(pick => addTempPower(
                pick.minionUid!,
                context.baseIndex,
                2,
                'world_champs_mouse_bird_and_sausage',
                timestamp,
            )),
        };
    },
});

const worldChampsMouseBirdAnchorPromptProgram = createPromptProgram<WorldChampsPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_mouse_bird_and_sausage_anchor',
    buildInteraction: (context) => {
        const minions = collectAllMinions(context.matchState.core);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_mouse_bird_and_sausage_anchor_${context.now}`,
            context.playerId,
            '老鼠、鸟和香肠：先选择同一基地同派系的一张随从',
            buildMinionTargetOptions(minions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_mouse_bird_and_sausage',
                effectType: 'affect',
            }),
            { sourceId: 'world_champs_mouse_bird_and_sausage_anchor', targetType: 'minion', titleKey: 'ui.world_champs_mouse_bird_and_sausage_anchor_title' },
        );
    },
    onResolve: ({ state, playerId, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined || !selected.defId) return { events: [] };
        const anchorDef = getCardDef(selected.defId);
        const faction = anchorDef?.faction;
        if (!faction) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        if (!base) return { events: [] };
        const candidates = base.minions
            .filter(minion => getCardDef(minion.defId)?.faction === faction)
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: selected.baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            }));
        if (candidates.length === 0) return { events: [] };
        if (candidates.length <= 2) {
            return {
                events: candidates.map(minion => addTempPower(minion.uid, minion.baseIndex, 2, 'world_champs_mouse_bird_and_sausage', timestamp)),
            };
        }
        return {
            events: [],
            context: createWorldChampsPromptContext(state, playerId, timestamp, {
                baseIndex: selected.baseIndex,
                faction,
            } satisfies MouseBirdAndSausageContinuation),
            nextProgram: worldChampsMouseBirdTargetsPromptProgram,
        };
    },
});

const worldChampsEhPromptProgram = createPromptProgram<WorldChampsEhPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_eh',
    buildInteraction: (context) => {
        const ownMinions = collectOwnMinions(context.matchState.core, context.playerId);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_eh_${context.now}`,
            context.playerId,
            '嗯？：选择你的一个随从，本回合力量 +1（并将此卡返回手牌）',
            [
                createSkipOption('跳过（不发动）', 'ui.world_champs_eh_skip_option'),
                ...buildMinionTargetOptions(ownMinions, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'world_champs_eh',
                    effectType: 'affect',
                }),
            ],
            { sourceId: 'world_champs_eh', targetType: 'minion', titleKey: 'ui.world_champs_eh_title' },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (selected.skip || !selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [
                {
                    type: SU_EVENTS.DISCARD_ABILITY_USED,
                    payload: {
                        playerId: context.playerId,
                        sourceId: 'world_champs_eh',
                    },
                    timestamp,
                },
                addTempPower(selected.minionUid, selected.baseIndex, 1, 'world_champs_eh', timestamp),
                recoverCardsFromDiscard(context.playerId, [context.sourceCardUid], 'world_champs_eh', timestamp),
            ],
        };
    },
});

const worldChampsSheriffBeforeScoringPromptProgram = createPromptProgram<WorldChampsSheriffPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_sheriff_before_scoring',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `world_champs_sheriff_before_scoring_${context.now}_${context.friendlyMinionUid}`,
        context.playerId,
        '警长：你可以令此随从与这里另一位玩家的一个随从决斗',
        [
            createSkipOption('跳过（不决斗）', 'ui.world_champs_sheriff_before_scoring_skip_option'),
            ...buildFieldSourceTargetOptions(
                {
                    type: 'minion',
                    uid: context.friendlyMinionUid,
                    defId: context.sourceDefId,
                    fromBaseIndex: context.sourceBaseIndex,
                },
                buildEnemyMinionFieldTargets(
                    context.matchState.core,
                    context.sourceBaseIndex,
                    context.casterPlayerId,
                    context.sourceDefId,
                ),
            ),
        ],
        buildFieldSourceTargetPromptConfig({ sourceId: 'world_champs_sheriff_before_scoring', titleKey: 'ui.world_champs_sheriff_before_scoring_title' }),
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as MinionChoice & { targetMinionUid?: string };
        const challengedMinionUid = selected.targetMinionUid;
        if (selected.skip || !challengedMinionUid) return { events: [] };
        const duelStarted = startDuelWithEvents(state, {
            sourceId: 'world_champs_sheriff_before_scoring',
            sourcePlayerId: context.casterPlayerId,
            challengerMinionUid: context.friendlyMinionUid,
            challengedMinionUid,
            outcome: 'destroy_loser',
            destroyReason: 'world_champs_sheriff',
        }, timestamp);
        return {
            events: duelStarted.events,
            matchState: duelStarted.state,
        };
    },
});

const worldChampsMummyAfterScoringPromptProgram = createPromptProgram<WorldChampsMummyPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_mummy_after_scoring',
    buildInteraction: (context) => {
        const baseOptions = context.matchState.core.bases
            .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
            .filter(base => base.baseIndex !== context.sourceBaseIndex);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_mummy_after_scoring_${context.now}_${context.cardUid}`,
            context.playerId,
            '木乃伊：你可以将本随从埋葬到另一个基地',
            [
                createSkipOption('跳过（不埋葬）', 'ui.world_champs_mummy_after_scoring_skip_option'),
                ...buildFieldSourceToBaseTargetOptions(
                    {
                        type: 'minion',
                        uid: context.cardUid,
                        defId: context.defId,
                        fromBaseIndex: context.sourceBaseIndex,
                    },
                    baseOptions,
                    context.matchState.core,
                ),
            ],
            buildFieldSourceTargetPromptConfig({ sourceId: 'world_champs_mummy_after_scoring', titleKey: 'ui.world_champs_mummy_after_scoring_title' }),
        );
    },
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as BaseChoice;
        const resolvedBaseIndex = resolveLiveBaseIndex(state.core, selected?.baseIndex, selected?.baseDefId);
        if (selected?.skip || resolvedBaseIndex === undefined) return { events: [] };
        const source = state.core.bases
            .map((base, baseIndex) => ({
                baseIndex,
                minion: base.minions.find(minion => minion.uid === context.cardUid),
            }))
            .find(entry => entry.minion !== undefined);
        if (!source?.minion) return { events: [] };
        return {
            events: buildBuryCardEvents({
                core: state.core,
                matchState: state,
                playerId: source.minion.controller,
                cardUid: source.minion.uid,
                defId: source.minion.defId,
                baseIndex: resolvedBaseIndex,
                trueOwnerId: source.minion.owner,
                buriedFrom: 'play',
                reason: 'world_champs_mummy',
                random,
                now: timestamp,
            }),
        };
    },
});

const worldChampsBewitchedTransferPromptProgram = createPromptProgram<WorldChampsBewitchedTransferPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'world_champs_bewitched_transfer',
    buildInteraction: (context) => {
        const minionOptions = collectAllMinions(context.matchState.core).filter(minion => minion.uid !== context.triggerMinionUid);
        return createAbilityRuntimeSimpleChoice(
            `world_champs_bewitched_transfer_${context.now}_${context.sourceCardUid}`,
            context.playerId,
            '着魔：宿主离场，选择另一个随从转移附着',
            buildMinionTargetOptions(minionOptions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                sourceDefId: 'world_champs_bewitched',
                effectType: 'affect',
            }),
            { sourceId: 'world_champs_bewitched_transfer', targetType: 'minion', titleKey: 'ui.world_champs_bewitched_transfer_title' },
        );
    },
    onResolve: ({ context, value, timestamp }) => {
        const selected = value as MinionChoice;
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: buildSemanticOngoingAttachEvents(context.matchState, {
                cardUid: context.sourceCardUid,
                defId: context.sourceDefId ?? 'world_champs_bewitched',
                ownerId: context.ownerId,
                ...(context.ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                targetBaseIndex: selected.baseIndex,
                targetMinionUid: selected.minionUid,
                removeFromDiscard: true,
                now: timestamp,
            }),
        };
    },
});

function worldChampsStonefordOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionCards = player.deck.filter(card => card.type === 'action');
    if (actionCards.length === 0) {
        return {
            events: [
                buildAbilityFeedback(ctx.playerId, 'feedback.deck_search_no_match_no_shuffle', ctx.now),
            ],
        };
    }
    const result = executeAbilityProgram(
        worldChampsStonefordPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsShieldMaidenOnPlay(ctx: AbilityContext): AbilityResult {
    const opponents = getOtherPlayers(ctx.state, ctx.playerId).filter(
        pid => peekDeckTop(ctx.state, ctx.random, pid, 'all', 'world_champs_shield_maiden', ctx.now) !== undefined,
    );
    if (opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        worldChampsShieldMaidenPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsCalicoinOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions
        .filter(minion => minion.uid !== ctx.cardUid)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (targets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        worldChampsCalicoinPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceBaseIndex: ctx.baseIndex,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsRainbowGirlOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const events = base.minions
        .filter(minion => minion.controller === ctx.playerId && minion.uid !== ctx.cardUid)
        .map(minion => addTempPower(minion.uid, ctx.baseIndex, 1, 'world_champs_rainbow_girl', ctx.now));
    return { events };
}

function worldChampsItsBlitzinTimeOnPlay(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        worldChampsItsBlitzinTimePromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsKaijuConflictOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantContextualExtraAction(ctx, 'world_champs_kaiju_conflict'),
            grantContextualExtraAction(ctx, 'world_champs_kaiju_conflict'),
        ],
    };
}

function worldChampsFightingSpiritPrizeOnPlay(ctx: AbilityContext): AbilityResult {
    const drawEvents = buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now);
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: drawEvents };
    }
    const result = executeAbilityProgram(
        worldChampsFightingSpiritPrizePromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return {
        events: [...drawEvents, ...result.events],
        matchState: result.matchState,
    };
}

function worldChampsAkyeTheTurtleOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const opponents = getOtherPlayers(ctx.state, ctx.playerId);
    if (!player || player.hand.length === 0 || opponents.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        worldChampsAkyePlayerPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsFastAsLightningOnPlay(ctx: AbilityContext): AbilityResult {
    const minions = collectAllMinions(ctx.state);
    if (minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        worldChampsFastAsLightningPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsHighSpeedChaseTalent(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const ownMinionsHere = base.minions
        .filter(minion => minion.controller === ctx.playerId)
        .map((minion) => ({
            uid: minion.uid,
            defId: minion.defId,
            baseIndex: ctx.baseIndex,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
        }));
    if (ownMinionsHere.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        worldChampsHighSpeedChaseMinionPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
            sourceBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsMouseBirdAndSausageOnPlay(ctx: AbilityContext): AbilityResult {
    const minions = collectAllMinions(ctx.state);
    if (minions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        worldChampsMouseBirdAnchorPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsSharkTattooOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller !== ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return {
        events: [addPowerCounter(target.uid, ctx.baseIndex, 1, 'world_champs_shark_tattoo', ctx.now)],
    };
}

function worldChampsBewitchedOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return { events: [] };
}

function worldChampsSmartSetUpOnPlay(ctx: AbilityContext): AbilityResult {
    if (!ctx.targetMinionUid) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const base = ctx.state.bases[ctx.baseIndex];
    const target = base?.minions.find(minion => minion.uid === ctx.targetMinionUid);
    if (!target || target.controller === ctx.playerId) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }
    return { events: [] };
}

function worldChampsEhSpecial(ctx: AbilityContext): AbilityResult {
    if (ctx.targetMinionUid) {
        const base = ctx.state.bases[ctx.baseIndex];
        const target = base?.minions.find(minion =>
            minion.uid === ctx.targetMinionUid && minion.controller === ctx.playerId,
        );
        if (!target) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }
        return {
            events: [
                {
                    type: SU_EVENTS.DISCARD_ABILITY_USED,
                    payload: {
                        playerId: ctx.playerId,
                        sourceId: 'world_champs_eh',
                    },
                    timestamp: ctx.now,
                },
                addTempPower(target.uid, ctx.baseIndex, 1, 'world_champs_eh', ctx.now),
                recoverCardsFromDiscard(ctx.playerId, [ctx.cardUid], 'world_champs_eh', ctx.now),
            ],
        };
    }
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        worldChampsEhPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceCardUid: ctx.cardUid,
        } satisfies EhContinuation),
    );
    return { events: result.events, matchState: result.matchState };
}

function worldChampsAramisOnMinionAffected(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return [];
    if (ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    const aramisControllerId = ctx.sourceControllerId;
    const currentPlayerId = ctx.state.turnOrder[ctx.state.currentPlayerIndex];
    if (currentPlayerId !== aramisControllerId) return [];
    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isActionDefId(actionDefId)) return [];

    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return [];
    const usedTurn = Number(sourceMinion.metadata?.[WORLD_CHAMPS_ARAMIS_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    return [
        grantContextualExtraAction(
            { playerId: aramisControllerId, now: ctx.now, matchState: ctx.matchState },
            'world_champs_aramis',
        ),
        buildMinionMetadataUpdatedEvent(
            sourceMinion.uid,
            ctx.sourceBaseIndex,
            { [WORLD_CHAMPS_ARAMIS_TRIGGERED_TURN_META]: ctx.state.turnNumber },
            'world_champs_aramis_once_per_turn',
            ctx.now,
        ),
    ];
}

function worldChampsDivaOnMinionAffected(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) return [];
    if (!ctx.affectEvent) return [];
    if (ctx.triggerMinionUid === ctx.sourceCardUid) return [];

    const actionDefId = resolveSourceDefIdFromEvent(ctx.affectEvent) ?? normalizeSourceDefIdFromReason(ctx.reason);
    if (!isStandardActionDefId(actionDefId)) return [];

    const sourceMinion = ctx.state.bases[ctx.sourceBaseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid);
    if (!sourceMinion) return [];
    const usedTurn = Number(sourceMinion.metadata?.[WORLD_CHAMPS_DIVA_TRIGGERED_TURN_META] ?? -1);
    if (usedTurn === ctx.state.turnNumber) return [];

    const mirroredEvent = buildDivaMirroredEvent(
        ctx.state,
        ctx.affectEvent,
        sourceMinion.uid,
        sourceMinion.defId,
        ctx.sourceBaseIndex,
        sourceMinion.owner,
        ctx.sourceControllerId,
        ctx.now,
    );
    if (mirroredEvent.length === 0) return [];

    return [
        buildMinionMetadataUpdatedEvent(
            sourceMinion.uid,
            ctx.sourceBaseIndex,
            { [WORLD_CHAMPS_DIVA_TRIGGERED_TURN_META]: ctx.state.turnNumber },
            'world_champs_diva_once_per_turn',
            ctx.now,
        ),
        ...mirroredEvent,
    ];
}

function canTriggerWorldChampsSmartSetUp(ctx: TriggerContext): boolean {
    if (ctx.sourceControllerId === undefined || ctx.sourceBaseIndex === undefined || !ctx.sourceCardUid) return false;
    if (ctx.baseIndex === undefined || ctx.baseIndex !== ctx.sourceBaseIndex) return false;
    const sourceBase = ctx.state.bases[ctx.sourceBaseIndex];
    const host = sourceBase?.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!host || host.controller === ctx.sourceControllerId) return false;
    const totalPlayedOnBase = ctx.state.turnOrder.reduce(
        (sum, playerId) => sum + (ctx.state.players[playerId]?.minionsPlayedPerBase?.[ctx.baseIndex!] ?? 0),
        0,
    );
    return totalPlayedOnBase === 1;
}

function worldChampsSmartSetUpOnMinionPlayed(ctx: TriggerContext): SmashUpEvent[] {
    if (!canTriggerWorldChampsSmartSetUp(ctx)) return [];
    const sourceControllerId = ctx.sourceControllerId;
    if (sourceControllerId === undefined) return [];
    return buildStandardDrawEvents(ctx.state, sourceControllerId, 1, ctx.random, ctx.now);
}

function worldChampsBewitchedTransferOnLeave(ctx: TriggerContext): AbilityResult {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) {
        return { events: [] };
    }
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceControllerId === undefined || !ctx.triggerMinionUid) {
        return { events: [] };
    }

    const liveSourceOwnerId = (() => {
        for (const base of ctx.state.bases) {
            const ongoing = base.ongoingActions.find(action => action.uid === ctx.sourceCardUid);
            if (ongoing) return ongoing.ownerId;
            for (const minion of base.minions) {
                const attached = minion.attachedActions.find(action => action.uid === ctx.sourceCardUid);
                if (attached) return attached.ownerId;
            }
        }
        for (const player of Object.values(ctx.state.players)) {
            const zones = [...(player.discard ?? []), ...(player.hand ?? []), ...(player.deck ?? [])];
            const card = zones.find(candidate => candidate.uid === ctx.sourceCardUid);
            if (card?.owner) return card.owner;
        }
        return undefined;
    })();
    const sourceOwnerId = liveSourceOwnerId
        ?? ctx.triggerMinion?.attachedActions.find(action => action.uid === ctx.sourceCardUid)?.ownerId
        ?? ctx.sourceControllerId;
    const minionOptions = collectAllMinions(ctx.state).filter(minion => minion.uid !== ctx.triggerMinionUid);
    if (minionOptions.length === 0) return { events: [] };
    return executeAbilityProgram(
        worldChampsBewitchedTransferPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            sourceCardUid: ctx.sourceCardUid,
            sourceDefId: 'world_champs_bewitched',
            ownerId: sourceOwnerId,
            triggerMinionUid: ctx.triggerMinionUid,
        } satisfies BewitchedTransferContinuation & { triggerMinionUid: string }),
    );
}

function normalizeSourceDefIdFromReason(reason?: string): string | undefined {
    if (!reason) return undefined;
    return reason
        .replace(/_(self_destruct|destroy|discard|expired|return|returned|shuffle|shuffled|detach|detached)$/u, '')
        .replace(/_pod$/u, '_pod');
}

function resolveSourceDefIdFromEvent(event: SmashUpEvent): string | undefined {
    if (!event) return undefined;
    const payload = (event as { payload?: Record<string, unknown> }).payload;
    if (!payload) return undefined;
    const explicit = payload.sourceDefId;
    if (typeof explicit === 'string' && explicit.length > 0) return explicit;
    const reason = payload.reason;
    return typeof reason === 'string' ? normalizeSourceDefIdFromReason(reason) : undefined;
}

function buildDivaMirroredEvent(
    state: SmashUpCore,
    event: SmashUpEvent,
    divaUid: string,
    divaDefId: string,
    divaBaseIndex: number,
    divaOwnerId: PlayerId,
    divaControllerId: PlayerId,
    now: number,
): SmashUpEvent[] {
    switch (event.type) {
        case SU_EVENTS.POWER_COUNTER_ADDED: {
            const payload = (event as PowerCounterAddedEvent).payload;
            return [addPowerCounter(
                divaUid,
                divaBaseIndex,
                payload.amount,
                'world_champs_diva_copy_power_counter_added',
                event.timestamp ?? 0,
                {
                    sourcePlayerId: divaControllerId,
                    sourceDefId: 'world_champs_diva',
                    sourceCardUid: divaUid,
                    sourceControllerId: divaControllerId,
                    sourceBaseIndex: divaBaseIndex,
                },
            ) as PowerCounterAddedEvent];
        }
        case SU_EVENTS.POWER_COUNTER_REMOVED: {
            const payload = (event as PowerCounterRemovedEvent).payload;
            return [removePowerCounter(
                divaUid,
                divaBaseIndex,
                payload.amount,
                'world_champs_diva_copy_power_counter_removed',
                event.timestamp ?? 0,
                {
                    sourcePlayerId: divaControllerId,
                    sourceDefId: 'world_champs_diva',
                    sourceCardUid: divaUid,
                    sourceControllerId: divaControllerId,
                    sourceBaseIndex: divaBaseIndex,
                },
            ) as PowerCounterRemovedEvent];
        }
        case SU_EVENTS.TEMP_POWER_ADDED: {
            const payload = (event as TempPowerAddedEvent).payload;
            return [addTempPower(
                divaUid,
                divaBaseIndex,
                payload.amount,
                'world_champs_diva_copy_temp_power',
                event.timestamp ?? 0,
                {
                    sourcePlayerId: payload.sourcePlayerId,
                    sourceCardUid: payload.sourceCardUid,
                    sourceDefId: payload.sourceDefId,
                    sourceControllerId: payload.sourceControllerId,
                    sourceBaseIndex: payload.sourceBaseIndex,
                },
            ) as TempPowerAddedEvent];
        }
        case SU_EVENTS.PERMANENT_POWER_ADDED: {
            const payload = (event as PermanentPowerAddedEvent).payload;
            return [addPermanentPower(
                divaUid,
                divaBaseIndex,
                payload.amount,
                'world_champs_diva_copy_permanent_power',
                event.timestamp ?? 0,
                {
                    expiresOnTurnNumber: payload.expiresOnTurnNumber,
                    sourcePlayerId: payload.sourcePlayerId,
                    sourceCardUid: payload.sourceCardUid,
                    sourceDefId: payload.sourceDefId,
                    sourceControllerId: payload.sourceControllerId,
                    sourceBaseIndex: payload.sourceBaseIndex,
                },
            ) as PermanentPowerAddedEvent];
        }
        case SU_EVENTS.MINION_DESTROYED:
            return buildValidatedDestroyEvents(state, {
                minionUid: divaUid,
                minionDefId: divaDefId,
                fromBaseIndex: divaBaseIndex,
                destroyerId: (event as MinionDestroyedEvent).payload.destroyerId,
                reason: 'world_champs_diva_copy_destroyed',
                now: event.timestamp ?? now,
                sourcePlayerId: divaControllerId,
                sourceCardUid: divaUid,
                sourceDefId: 'world_champs_diva',
                sourceControllerId: divaControllerId,
                sourceBaseIndex: divaBaseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: divaOwnerId,
                    controllerId: divaControllerId,
                },
            });
        case SU_EVENTS.MINION_MOVED: {
            const payload = (event as MinionMovedEvent).payload;
            return buildValidatedMoveEvents(state, {
                minionUid: divaUid,
                minionDefId: divaDefId,
                fromBaseIndex: divaBaseIndex,
                toBaseIndex: payload.toBaseIndex,
                toBaseDefId: payload.toBaseDefId,
                reason: 'world_champs_diva_copy_moved',
                now: event.timestamp ?? now,
                sourcePlayerId: divaControllerId,
                sourceCardUid: divaUid,
                sourceDefId: 'world_champs_diva',
                sourceControllerId: divaControllerId,
                sourceBaseIndex: divaBaseIndex,
                sourceKind: 'nonAction',
                targetSnapshot: {
                    ownerId: divaOwnerId,
                    controllerId: divaControllerId,
                },
            });
        }
        case SU_EVENTS.MINION_RETURNED: {
            const payload = (event as MinionReturnedEvent).payload;
            return buildValidatedReturnEvents(state, {
                minionUid: divaUid,
                minionDefId: divaDefId,
                fromBaseIndex: divaBaseIndex,
                toPlayerId: divaControllerId,
                reason: 'world_champs_diva_copy_returned',
                sourcePlayerId: payload.sourcePlayerId ?? divaControllerId,
                sourceDefId: 'world_champs_diva',
                sourceCardUid: divaUid,
                sourceControllerId: divaControllerId,
                sourceBaseIndex: divaBaseIndex,
                now: event.timestamp ?? now,
                targetSnapshot: {
                    ownerId: divaOwnerId,
                    controllerId: divaControllerId,
                },
            });
        }
        case SU_EVENTS.ONGOING_ATTACHED: {
            // 标准行动通常不会附着；避免复用同一行动 uid 导致状态冲突
            return [];
        }
        default:
            return [];
    }
}

function worldChampsSheriffBeforeScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || ctx.baseIndex === undefined || !ctx.sourceCardUid || !ctx.sourceControllerId) {
        return { events: [] };
    }
    if (!canStartDuel(ctx.state)) return { events: [] };
    const sourceDefId = ctx.sourceDefId
        ?? ctx.state.bases[ctx.baseIndex]?.minions.find(minion => minion.uid === ctx.sourceCardUid)?.defId
        ?? 'world_champs_sheriff';
    const enemyTargets = buildEnemyMinionFieldTargets(ctx.state, ctx.baseIndex, ctx.sourceControllerId, sourceDefId);
    if (enemyTargets.length === 0) return { events: [] };
    return executeAbilityProgram(
        worldChampsSheriffBeforeScoringPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            friendlyMinionUid: ctx.sourceCardUid,
            casterPlayerId: ctx.sourceControllerId,
            sourceDefId,
            sourceBaseIndex: ctx.baseIndex,
        } satisfies SheriffContinuation & { sourceBaseIndex: number }),
    );
}

function canQueueWorldChampsBewitchedLeaveTrigger(ctx: TriggerContext): boolean {
    return !(ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx));
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
}

function worldChampsSamuraiChanTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (!ctx.sourceControllerId || ctx.triggerMinionUid !== ctx.sourceCardUid) return [];
    return buildStandardDrawEvents(ctx.state, ctx.sourceControllerId, 1, ctx.random, ctx.now);
}

function worldChampsMummyAfterScoring(ctx: TriggerContext): AbilityResult {
    if (!ctx.matchState || !ctx.sourceCardUid || ctx.sourceControllerId === undefined || ctx.sourceBaseIndex === undefined) {
        return { events: [] };
    }
    const sourceBase = ctx.state.bases[ctx.sourceBaseIndex];
    if (!sourceBase?.minions.some(minion => minion.uid === ctx.sourceCardUid)) {
        return { events: [] };
    }
    const baseOptions = ctx.state.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(base => base.baseIndex !== ctx.sourceBaseIndex);
    if (baseOptions.length === 0) return { events: [] };
    return executeAbilityProgram(
        worldChampsMummyAfterScoringPromptProgram,
        createWorldChampsPromptContext(ctx.matchState, ctx.sourceControllerId, ctx.now, {
            cardUid: ctx.sourceCardUid,
            defId: sourceBase.minions.find(minion => minion.uid === ctx.sourceCardUid)?.defId ?? ctx.sourceDefId ?? 'world_champs_mummy',
            sourceBaseIndex: ctx.sourceBaseIndex,
            sourceControllerId: ctx.sourceControllerId,
        } satisfies MummyContinuation & { sourceBaseIndex: number; sourceControllerId: PlayerId }),
    );
}

function worldChampsSharkTattooTurnStart(ctx: TriggerContext): SmashUpEvent[] {
    if (!ctx.sourceCardUid || ctx.sourceBaseIndex === undefined || ctx.sourceControllerId === undefined) {
        return [];
    }
    if (ctx.playerId !== ctx.sourceControllerId) return [];
    const base = ctx.state.bases[ctx.sourceBaseIndex];
    if (!base) return [];
    const host = base.minions.find(minion => minion.attachedActions.some(action => action.uid === ctx.sourceCardUid));
    if (!host || host.controller !== ctx.sourceControllerId) return [];
    const ownMinions = base.minions.filter(minion => minion.controller === ctx.sourceControllerId);
    if (ownMinions.length !== 1) return [];
    return [addPowerCounter(host.uid, ctx.sourceBaseIndex, 1, 'world_champs_shark_tattoo', ctx.now)];
}

export function registerWorldChampsAbilities(): void {
    registerAbility('world_champs_bewitched', 'onPlay', worldChampsBewitchedOnPlay);
    registerAbilityProgram('world_champs_stoneford', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsStonefordOnPlay) });
    registerAbilityProgram('world_champs_akye_the_turtle', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsAkyeTheTurtleOnPlay) });
    registerAbilityProgram('world_champs_shield_maiden', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsShieldMaidenOnPlay) });
    registerAbilityProgram('world_champs_calicoin', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsCalicoinOnPlay) });
    registerAbilityProgram('world_champs_fast_as_lightning', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsFastAsLightningOnPlay) });
    registerAbility('world_champs_rainbow_girl', 'onPlay', worldChampsRainbowGirlOnPlay);
    registerAbilityProgram('world_champs_its_blitzin_time', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsItsBlitzinTimeOnPlay) });
    registerAbility('world_champs_kaiju_conflict', 'onPlay', worldChampsKaijuConflictOnPlay);
    registerAbilityProgram('world_champs_fighting_spirit_prize', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsFightingSpiritPrizeOnPlay) });
    registerAbilityProgram('world_champs_high_speed_chase', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsHighSpeedChaseTalent),
        validateUse: (ctx) => {
            const base = ctx.state.bases[ctx.baseIndex];
            if (!base) return '当前没有可选择的目标';
            return base.minions.some(minion => minion.controller === ctx.playerId) ? null : '当前没有可选择的目标';
        },
    });
    registerAbilityProgram('world_champs_mouse_bird_and_sausage', 'onPlay', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsMouseBirdAndSausageOnPlay) });
    registerAbility('world_champs_shark_tattoo', 'onPlay', worldChampsSharkTattooOnPlay);
    registerAbility('world_champs_smart_set_up', 'onPlay', worldChampsSmartSetUpOnPlay);
    registerAbilityProgram('world_champs_eh', 'special', { program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(worldChampsEhSpecial) });
    registerDiscardSpecialProvider({
        id: 'world_champs_eh',
        getActivatableCards(core, playerId) {
            const currentTurnPlayerId = core.turnOrder[core.currentPlayerIndex];
            if (!currentTurnPlayerId || currentTurnPlayerId !== playerId) return [];
            const player = core.players[playerId];
            if (!player) return [];
            if (player.actionsPlayed < 1) return [];
            if (player.usedDiscardPlayAbilities?.includes('world_champs_eh')) return [];
            const ownMinions = collectOwnMinions(core, playerId);
            if (ownMinions.length === 0) return [];
            return player.discard
                .filter(card => card.defId === 'world_champs_eh')
                .map(card => ({
                    card,
                    allowedBaseIndices: [...new Set(ownMinions.map(minion => minion.baseIndex))],
                    allowedMinionUids: ownMinions.map(minion => minion.uid),
                    sourceId: 'world_champs_eh',
                    defId: card.defId,
                    name: getCardDef(card.defId)?.name ?? card.defId,
                }));
        },
    });
    registerTrigger('world_champs_aramis', 'onMinionAffected', worldChampsAramisOnMinionAffected, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('world_champs_diva', 'onMinionAffected', worldChampsDivaOnMinionAffected, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('world_champs_sheriff', 'beforeScoring', worldChampsSheriffBeforeScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('world_champs_bewitched', 'onMinionDestroyed', worldChampsBewitchedTransferOnLeave, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canQueueWorldChampsBewitchedLeaveTrigger,
    });
    registerTrigger('world_champs_bewitched', 'onMinionDiscardedFromBase', worldChampsBewitchedTransferOnLeave, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canQueueWorldChampsBewitchedLeaveTrigger,
    });
    registerTrigger('world_champs_bewitched', 'onCardReturnedToHand', worldChampsBewitchedTransferOnLeave, {
        perInstance: true,
        playerContext: 'sourceController',
        canTrigger: canQueueWorldChampsBewitchedLeaveTrigger,
    });
    registerTrigger('world_champs_samurai_chan', 'onMinionDestroyed', worldChampsSamuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('world_champs_samurai_chan', 'onMinionDiscardedFromBase', worldChampsSamuraiChanTrigger, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('world_champs_mummy', 'afterScoring', worldChampsMummyAfterScoring, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
    });
    registerTrigger('world_champs_shark_tattoo', 'onTurnStart', worldChampsSharkTattooTurnStart, {
        perInstance: true,
        playerContext: 'sourceController',
    });
    registerTrigger('world_champs_smart_set_up', 'onMinionPlayed', worldChampsSmartSetUpOnMinionPlayed, {
        perInstance: true,
        playerContext: 'sourceController',
        sourceScope: 'triggerBase',
        canTrigger: canTriggerWorldChampsSmartSetUp,
    });
}

export function registerWorldChampsInteractionHandlers(): void {
}
