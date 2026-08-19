import type {
    AttackMadeUndefendableEvent,
    BonusDieInfo,
    BonusDieRolledEvent,
    BonusDamageAddedEvent,
    CardDiscardedEvent,
    ChoiceRequestedEvent,
    CpChangedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    DieRerolledEvent,
    HealAppliedEvent,
    InteractionRequestedEvent,
    PendingInteraction,
    PlayerBoardFaceChangedEvent,
    PreventDamageEvent,
    StatusRemovedEvent,
} from '../types';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { CURSED_PIRATE_DICE_FACE_IDS, STATUS_IDS } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { CP_MAX } from '../types';
import { getActiveDice, getAttackMaxDuplicateValueCount, getOpponents, getPlayerDieFace, getRollerId, getTokenStackLimit } from '../rules';
import { buildDrawEvents } from '../deckEvents';
import {
    POWDER_KEG_TRANSFER_CHOICE_ID,
    POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID,
    buildStatusAppliedOrChoiceEvents,
    getPowderKegTransferTargetIds,
} from '../statusEvents';
import { updatePendingAttackSettlementStage } from '../utils';

const MERCILESS_CURSE_POWDER_KEG_CHOICE_ID = 'cursed-pirate-merciless-curse-powder-keg';
const CURSE_CARD_CHOICE_ID = 'cursed-pirate-curse-card-choice';
const RANSOM_DIE_CHOICE_ID = 'cursed-pirate-ransom-die-choice';
const RANSOM_RESOLVE_CHOICE_ID = 'cursed-pirate-ransom-resolve-choice';
const CROWS_NEST_VIEW_CHOICE_ID = 'cursed-pirate-crows-nest-view-choice';
const GO_FISH_POWDER_KEG_CHOICE_ID = 'cursed-pirate-go-fish-powder-keg';
const SIP_CHOICE_ID = 'cursed-pirate-sip-choice';
const HUMAN_WALK_THE_PLANK_CHOICE_ID = 'cursed-pirate-human-walk-the-plank-choice';
const HUMAN_REMOVE_CURSED_COINS_CHOICE_ID = 'cursed-pirate-human-remove-cursed-coins-choice';
const HUMAN_VERDICT_COMMAND_CHOICE_ID = 'cursed-pirate-human-verdict-command-choice';
const HUMAN_MERCILESS_PLUNDER_CHOICE_ID = 'cursed-pirate-human-merciless-plunder-choice';
const RANSOM_PLAYER_FACTOR = 10000;
const RANSOM_DIE_FACTOR = 100;
const RANSOM_DECISION_FACTOR = 10;
const WALK_THE_PLANK_TARGET_FACTOR = 10;
const WALK_THE_PLANK_STEAL_MODE = 1;
const WALK_THE_PLANK_DISCARD_MODE = 2;
const HUMAN_TARGETED_CURSED_COIN_FACTOR = 100;

const countBits = (value: number): number => {
    let count = 0;
    let mask = Math.max(0, Math.trunc(value));
    while (mask > 0) {
        count += mask & 1;
        mask >>= 1;
    }
    return count;
};

const formatPlayerList = (playerIds: string[]): string =>
    playerIds.map((playerId) => {
        const seatNumber = Number.parseInt(playerId, 10) + 1;
        return Number.isFinite(seatNumber) ? `P${seatNumber}` : playerId;
    }).join(', ');

const formatHandCardNameList = (cards: Array<{ id: string; name?: string }>): string =>
    cards.length > 0
        ? cards.map(card => card.name ?? `cards.${card.id}.name`).join(', ')
        : 'none';

const getMercilessCursePowderKegTargetIds = (state: CustomActionContext['state'], attackerId: string): string[] =>
    getOpponents(state, attackerId).filter(playerId => !!state.players[playerId]);

const getGoFishPowderKegTargetIds = (state: CustomActionContext['state'], attackerId: string): string[] =>
    getOpponents(state, attackerId).filter(playerId => !!state.players[playerId]);

const getSortedPlayerIds = (state: CustomActionContext['state']): string[] =>
    Object.keys(state.players).sort((a, b) => Number(a) - Number(b));

const getPendingAttackDefenderId = (
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId?: string,
): string | undefined => {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack) return undefined;
    if (pendingAttack.attackerId !== attackerId) return undefined;
    if (sourceAbilityId && pendingAttack.sourceAbilityId !== sourceAbilityId) return undefined;
    return pendingAttack.defenderId;
};

const encodeRansomSelectionValue = (
    state: CustomActionContext['state'],
    attackerId: string,
    targetId: string,
    dieId: number,
): number => {
    const playerIds = getSortedPlayerIds(state);
    const attackerIndex = Math.max(0, playerIds.indexOf(attackerId));
    const targetIndex = Math.max(0, playerIds.indexOf(targetId));
    return attackerIndex * RANSOM_PLAYER_FACTOR + targetIndex * RANSOM_DIE_FACTOR + dieId;
};

const decodeRansomSelectionValue = (
    state: CustomActionContext['state'],
    value: number,
): { attackerId?: string; targetId?: string; dieId: number } => {
    const playerIds = getSortedPlayerIds(state);
    const normalized = Math.max(0, Math.trunc(value));
    const attackerIndex = Math.floor(normalized / RANSOM_PLAYER_FACTOR);
    const remainder = normalized % RANSOM_PLAYER_FACTOR;
    const targetIndex = Math.floor(remainder / RANSOM_DIE_FACTOR);
    const dieId = remainder % RANSOM_DIE_FACTOR;
    return {
        attackerId: playerIds[attackerIndex],
        targetId: playerIds[targetIndex],
        dieId,
    };
};

const encodeWalkThePlankSelectionValue = (
    state: CustomActionContext['state'],
    targetId: string,
    mode: number,
): number => {
    const playerIds = getSortedPlayerIds(state);
    const targetIndex = Math.max(0, playerIds.indexOf(targetId));
    return targetIndex * WALK_THE_PLANK_TARGET_FACTOR + mode;
};

const decodeWalkThePlankSelectionValue = (
    state: CustomActionContext['state'],
    value: number,
): { targetId?: string; mode: number } => {
    const playerIds = getSortedPlayerIds(state);
    const normalized = Math.max(0, Math.trunc(value));
    const targetIndex = Math.floor(normalized / WALK_THE_PLANK_TARGET_FACTOR);
    return {
        targetId: playerIds[targetIndex],
        mode: normalized % WALK_THE_PLANK_TARGET_FACTOR,
    };
};

const getRansomEligibleCurrentDice = (
    state: CustomActionContext['state'],
    targetId: string,
) => {
    if (getRollerId(state) !== targetId) return [];
    return getActiveDice(state);
};

const encodeHumanTargetedCursedCoinChoiceValue = (
    state: CustomActionContext['state'],
    targetId: string,
    cursedCoinGain: number,
): number => {
    const playerIds = getSortedPlayerIds(state);
    const targetIndex = Math.max(0, playerIds.indexOf(targetId));
    return targetIndex * HUMAN_TARGETED_CURSED_COIN_FACTOR + Math.max(0, Math.trunc(cursedCoinGain));
};

const decodeHumanTargetedCursedCoinChoiceValue = (
    state: CustomActionContext['state'],
    value: number,
): { targetId?: string; cursedCoinGain: number } => {
    const playerIds = getSortedPlayerIds(state);
    const normalized = Math.max(0, Math.trunc(value));
    const targetIndex = Math.floor(normalized / HUMAN_TARGETED_CURSED_COIN_FACTOR);
    return {
        targetId: playerIds[targetIndex],
        cursedCoinGain: normalized % HUMAN_TARGETED_CURSED_COIN_FACTOR,
    };
};

const createBonusDieEvents = (
    state: CustomActionContext['state'],
    sourceAbilityId: string,
    playerId: string,
    values: number[],
    timestamp: number,
    effectKeyBuilder?: (value: number, face: string, index: number) => string,
): { dice: BonusDieInfo[]; events: DiceThroneEvent[] } => {
    const dice = values.map((value, index) => {
        const face = getPlayerDieFace(state, playerId, value) ?? '';
        const effectKey = effectKeyBuilder?.(value, face, index) ?? `bonusDie.effect.${face}`;
        return { index, value, face, effectKey };
    });

    const events: DiceThroneEvent[] = dice.map((die) => ({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: die.value,
            face: die.face,
            playerId,
            targetPlayerId: playerId,
            effectKey: die.effectKey,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent));

    events.push(createDisplayOnlySettlement(sourceAbilityId, playerId, playerId, dice, timestamp, {
        continuation: { kind: 'complete' },
    }));
    return { dice, events };
};

function stealOneCp({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const attacker = state.players[attackerId];
    const target = state.players[targetId];
    if (!attacker || !target) return [];

    const targetCp = target.resources[RESOURCE_IDS.CP] ?? 0;
    if (targetCp <= 0) return [];

    const attackerCp = attacker.resources[RESOURCE_IDS.CP] ?? 0;
    const newAttackerCp = Math.min(attackerCp + 1, CP_MAX);
    return [
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: targetId,
                delta: -1,
                newValue: targetCp - 1,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as CpChangedEvent,
        {
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: newAttackerCp - attackerCp,
                newValue: newAttackerCp,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as CpChangedEvent,
    ];
}

function requestCurseCardChoice({
    attackerId,
    sourceAbilityId,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateCurseCard.title',
            options: [
                {
                    value: 1,
                    customId: CURSE_CARD_CHOICE_ID,
                    labelKey: 'choices.cursedPirateCurseCard.draw1',
                },
                {
                    value: 2,
                    customId: CURSE_CARD_CHOICE_ID,
                    labelKey: 'choices.cursedPirateCurseCard.damage2Draw2',
                },
                {
                    value: 3,
                    customId: CURSE_CARD_CHOICE_ID,
                    labelKey: 'choices.cursedPirateCurseCard.damage4Draw3',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function battenDown({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player || !random) return [];

    const sourceCard = player.hand.find(card => card.id === sourceAbilityId);
    const cardsToDiscard = player.hand.filter(card => card.id !== sourceAbilityId);
    const discardEvents: DiceThroneEvent[] = cardsToDiscard.map((card, index) => ({
        type: 'CARD_DISCARDED',
        payload: {
            playerId: attackerId,
            cardId: card.id,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + index,
    } as DiceThroneEvent));

    const simulatedState = {
        ...state,
        players: {
            ...state.players,
            [attackerId]: {
                ...player,
                hand: [],
                discard: [
                    ...player.discard,
                    ...(sourceCard ? [sourceCard] : []),
                    ...cardsToDiscard,
                ],
            },
        },
    };

    return [
        ...discardEvents,
        ...buildDrawEvents(
            simulatedState,
            attackerId,
            4,
            random,
            'ABILITY_EFFECT',
            timestamp + discardEvents.length + 1,
            sourceAbilityId,
        ),
    ];
}

function resolveFlay({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const values = Array.from({ length: 5 }, () => random.d(6));
    const { dice, events } = createBonusDieEvents(
        state,
        sourceAbilityId,
        attackerId,
        values,
        timestamp,
        (_value, face) => face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS
            ? 'bonusDie.effect.cursedPirateFlayCutlass'
            : 'bonusDie.effect.cursedPirateFlayOther',
    );
    const cutlassCount = dice.filter(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS).length;

    if (cutlassCount > 0) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: attackerId,
                amount: cutlassCount,
                sourceCardId: sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as BonusDamageAddedEvent);
    }

    if (cutlassCount >= 3) {
        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        }));
    }

    return events;
}

function requestRansomDieChoice({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target) return [];

    const dice = getRansomEligibleCurrentDice(state, targetId);
    if (dice.length === 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateRansomDie.title',
            options: dice.map(die => ({
                value: encodeRansomSelectionValue(state, attackerId, targetId, die.id),
                customId: RANSOM_DIE_CHOICE_ID,
                labelKey: 'choices.cursedPirateRansomDie.choose',
                labelParams: { die: die.id + 1, value: die.value },
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function resolveCrowsNest({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const target = state.players[targetId];
    if (!target) return [];

    const rolledValue = random.d(6);
    const { dice, events } = createBonusDieEvents(
        state,
        sourceAbilityId,
        attackerId,
        [rolledValue],
        timestamp,
        (_value, face) => {
            if (face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) return 'bonusDie.effect.cursedPirateCrowsNestCutlass';
            if (face === CURSED_PIRATE_DICE_FACE_IDS.LOOT) return 'bonusDie.effect.cursedPirateCrowsNestLoot';
            if (face === CURSED_PIRATE_DICE_FACE_IDS.SKULL) return 'bonusDie.effect.cursedPirateCrowsNestSkull';
            return 'bonusDie.effect.cursedPirateCrowsNestOther';
        },
    );
    const face = dice[0]?.face;

    if (face === CURSED_PIRATE_DICE_FACE_IDS.CUTLASS) {
        const handSummary = formatHandCardNameList(target.hand);
        events.push({
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: attackerId,
                sourceAbilityId,
                titleKey: 'choices.cursedPirateCrowsNestView.title',
                options: [{
                    value: 0,
                    customId: CROWS_NEST_VIEW_CHOICE_ID,
                    labelKey: 'choices.cursedPirateCrowsNestView.confirm',
                    labelParams: { player: formatPlayerList([targetId]), cards: handSummary },
                }],
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as ChoiceRequestedEvent);
        return events;
    }

    if (target.hand.length === 0) return events;

    if (face === CURSED_PIRATE_DICE_FACE_IDS.LOOT) {
        events.push(...requestOpponentDiscardOneCard({
            attackerId,
            targetId,
            sourceAbilityId,
            state,
            timestamp: timestamp + 1,
            random,
            ctx: {
                attackerId,
                defenderId: targetId,
                sourceAbilityId,
                state,
                damageDealt: 0,
                timestamp: timestamp + 1,
            },
            action: {
                type: 'custom',
                target: 'opponent',
                customActionId: 'cursed-pirate-crows-nest-roll',
            },
        }));
        return events;
    }

    if (face === CURSED_PIRATE_DICE_FACE_IDS.SKULL) {
        const randomIndex = Math.floor(random.random() * target.hand.length);
        const card = target.hand[randomIndex];
        if (card) {
            events.push({
                type: 'CARD_DISCARDED',
                payload: {
                    playerId: targetId,
                    cardId: card.id,
                },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 1,
            } as CardDiscardedEvent);
        }
    }

    return events;
}

function resolveHefty({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    random,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player || !random) return [];

    const values = [random.d(6), random.d(6)];
    const { dice, events } = createBonusDieEvents(
        state,
        sourceAbilityId,
        attackerId,
        values,
        timestamp,
        (_value, face) => face === CURSED_PIRATE_DICE_FACE_IDS.LOOT
            ? 'bonusDie.effect.cursedPirateHeftyLoot'
            : 'bonusDie.effect.cursedPirateHeftyOther',
    );
    const hasLoot = dice.some(die => die.face === CURSED_PIRATE_DICE_FACE_IDS.LOOT);
    if (!hasLoot) return events;

    events.push(...buildDrawEvents(state, attackerId, 2, random, 'ABILITY_EFFECT', timestamp + 1, sourceAbilityId));
    const currentCp = player.resources[RESOURCE_IDS.CP] ?? 0;
    const sourceCardCost = player.hand.find(card => card.id === sourceAbilityId)?.cpCost ?? 0;
    const cpAfterCardCost = Math.max(0, currentCp - sourceCardCost);
    const newValue = Math.min(CP_MAX, cpAfterCardCost + 2);
    events.push({
        type: 'CP_CHANGED',
        payload: {
            playerId: attackerId,
            delta: newValue - cpAfterCardCost,
            newValue,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 2,
    } as CpChangedEvent);

    return events;
}

function applyPowderKegIfThreeOfAKind({
    ctx,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (ctx.damageDealt <= 0) return [];
    if (getAttackMaxDuplicateValueCount(state) < 3) return [];

    const target = state.players[targetId];
    if (!target) return [];

    const currentStacks = target.statusEffects[STATUS_IDS.POWDER_KEG] ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.POWDER_KEG);
    const newTotal = Math.min(currentStacks + 1, maxStacks);
    const stacks = Math.max(0, newTotal - currentStacks);
    if (stacks <= 0) return [];

    return buildStatusAppliedOrChoiceEvents({
        state,
        targetId,
        statusId: STATUS_IDS.POWDER_KEG,
        stacks,
        sourceAbilityId,
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
}

function damageByCursedCoins({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    return getOpponents(state, attackerId).flatMap((targetId) => {
        const target = state.players[targetId];
        if (!target) return [];

        const coinStacks = target.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        if (coinStacks <= 0) return [];

        const hp = target.resources[RESOURCE_IDS.HP] ?? 0;
        return [{
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: coinStacks,
                actualDamage: Math.min(coinStacks, hp),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent];
    });
}

function requestOpponentDiscardOneCard({
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const target = state.players[targetId];
    if (!target || target.hand.length === 0) return [];

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-discard-${targetId}-${timestamp}`,
        playerId: targetId,
        sourceCardId: sourceAbilityId,
        type: 'selectHandCard',
        titleKey: 'interaction.selectHandCardToDiscard',
        selectCount: 1,
        selected: [],
        targetPlayerIds: [targetId],
    };

    return [{
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent];
}

function cursedUpkeepSelfDamage({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player) return [];

    const amount = 4;
    const hp = player.resources[RESOURCE_IDS.HP] ?? 0;
    return [{
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: attackerId,
            amount,
            actualDamage: Math.min(amount, hp),
            sourceAbilityId,
            damageScope: 'direct',
            unblockable: true,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as DamageDealtEvent];
}

function resolveHumanCursedTurnEnd({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const player = state.players[attackerId];
    if (!player || player.playerBoardFace !== 'normal') return [];

    const cursedCoinStacks = player.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
    if (cursedCoinStacks > 0) {
        return [{
            type: 'STATUS_REMOVED',
            payload: {
                targetId: attackerId,
                statusId: STATUS_IDS.CURSED_COIN,
                stacks: 1,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as StatusRemovedEvent];
    }

    return [{
        type: 'PLAYER_BOARD_FACE_CHANGED',
        payload: {
            playerId: attackerId,
            face: 'cursed',
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PlayerBoardFaceChangedEvent];
}

function requestHumanWalkThePlankChoice({
    attackerId,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (!state.players[targetId]) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateHumanWalkThePlank.title',
            options: [
                {
                    value: encodeWalkThePlankSelectionValue(state, targetId, WALK_THE_PLANK_STEAL_MODE),
                    customId: HUMAN_WALK_THE_PLANK_CHOICE_ID,
                    labelKey: 'choices.cursedPirateHumanWalkThePlank.stealCp',
                },
                {
                    value: encodeWalkThePlankSelectionValue(state, targetId, WALK_THE_PLANK_DISCARD_MODE),
                    customId: HUMAN_WALK_THE_PLANK_CHOICE_ID,
                    labelKey: 'choices.cursedPirateHumanWalkThePlank.discardCard',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function requestHumanRemoveCursedCoinsChoice({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const currentStacks = state.players[attackerId]?.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
    if (currentStacks <= 0) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateHumanRemoveCoins.title',
            options: Array.from({ length: currentStacks + 1 }, (_, value) => ({
                value,
                customId: HUMAN_REMOVE_CURSED_COINS_CHOICE_ID,
                labelKey: value === 0
                    ? 'choices.cursedPirateHumanRemoveCoins.keep'
                    : 'choices.cursedPirateHumanRemoveCoins.remove',
                labelParams: value === 0 ? undefined : { count: value },
            })),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function requestHumanVerdictCommand({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const resolvedTargetId = ctx?.defenderId
        ?? getPendingAttackDefenderId(state, attackerId, sourceAbilityId)
        ?? getOpponents(state, attackerId)[0];
    if (!resolvedTargetId) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedCoinGain.title',
            options: [
                {
                    statusId: STATUS_IDS.CURSED_COIN,
                    value: encodeHumanTargetedCursedCoinChoiceValue(state, resolvedTargetId, 1),
                    customId: HUMAN_VERDICT_COMMAND_CHOICE_ID,
                    labelKey: 'choices.cursedCoinGain.accept',
                    statusGrantConfigs: [
                        { statusId: STATUS_IDS.CURSED_COIN, amount: 1, targetPlayerId: attackerId },
                        { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: resolvedTargetId },
                    ],
                },
                {
                    value: encodeHumanTargetedCursedCoinChoiceValue(state, resolvedTargetId, 0),
                    customId: HUMAN_VERDICT_COMMAND_CHOICE_ID,
                    labelKey: 'choices.cursedCoinGain.decline',
                    statusGrantConfig: { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: resolvedTargetId },
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function requestHumanMercilessPlunder({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (ctx.damageDealt <= 0) return [];

    const resolvedTargetId = ctx?.defenderId
        ?? getPendingAttackDefenderId(state, attackerId, sourceAbilityId)
        ?? getOpponents(state, attackerId)[0];
    if (!resolvedTargetId) return [];

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedCoinGain.title',
            options: [
                {
                    statusId: STATUS_IDS.CURSED_COIN,
                    value: encodeHumanTargetedCursedCoinChoiceValue(state, resolvedTargetId, 2),
                    customId: HUMAN_MERCILESS_PLUNDER_CHOICE_ID,
                    labelKey: 'choices.cursedCoinGain.accept',
                    statusGrantConfigs: [
                        { statusId: STATUS_IDS.CURSED_COIN, amount: 2, targetPlayerId: attackerId },
                        { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: resolvedTargetId },
                        { statusId: STATUS_IDS.POWDER_KEG, amount: 1, targetPlayerId: resolvedTargetId },
                    ],
                },
                {
                    value: encodeHumanTargetedCursedCoinChoiceValue(state, resolvedTargetId, 0),
                    customId: HUMAN_MERCILESS_PLUNDER_CHOICE_ID,
                    labelKey: 'choices.cursedCoinGain.decline',
                    statusGrantConfigs: [
                        { statusId: STATUS_IDS.PARLEY, amount: 1, targetPlayerId: resolvedTargetId },
                        { statusId: STATUS_IDS.POWDER_KEG, amount: 1, targetPlayerId: resolvedTargetId },
                    ],
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function applyPowderKegIfFourOfAKind({
    ctx,
    targetId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (ctx.damageDealt <= 0) return [];
    if (getAttackMaxDuplicateValueCount(state) < 4) return [];

    return buildStatusAppliedOrChoiceEvents({
        state,
        targetId,
        statusId: STATUS_IDS.POWDER_KEG,
        stacks: 1,
        sourceAbilityId,
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
}

function resolveStillWetBehindEarsDefense({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getActiveDice(state).reduce((counts, die) => {
        const face = getPlayerDieFace(state, attackerId, die.value);
        if (face) counts[face] = (counts[face] ?? 0) + 1;
        return counts;
    }, {} as Record<string, number>);

    const cutlassCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] ?? 0;
    const lootCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.LOOT] ?? 0;
    const skullCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.SKULL] ?? 0;
    const events: DiceThroneEvent[] = [];

    if (cutlassCount > 0) {
        const targetId = ctx.defenderId;
        const target = state.players[targetId];
        events.push({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: cutlassCount,
                actualDamage: Math.min(cutlassCount, target?.resources[RESOURCE_IDS.HP] ?? 0),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    if (lootCount > 0) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.min(CP_MAX, currentCp + lootCount);
        events.push({
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: newValue - currentCp,
                newValue,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent);
    }

    if (skullCount > 0) {
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: attackerId,
                amount: skullCount * 2,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as PreventDamageEvent);
    }

    if (cutlassCount > 0 && skullCount > 0) {
        const targetId = ctx.defenderId;
        const currentStacks = state.players[targetId]?.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        const maxStacks = getTokenStackLimit(state, targetId, STATUS_IDS.CURSED_COIN);
        const newTotal = Math.min(currentStacks + 1, maxStacks);
        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.CURSED_COIN,
            stacks: Math.max(0, newTotal - currentStacks),
            sourceAbilityId,
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3,
        }));
    }

    return events;
}

function resolveHumanDefense({
    ctx,
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const faceCounts = getActiveDice(state).reduce((counts, die) => {
        const face = getPlayerDieFace(state, attackerId, die.value);
        if (face) counts[face] = (counts[face] ?? 0) + 1;
        return counts;
    }, {} as Record<string, number>);

    const cutlassCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.CUTLASS] ?? 0;
    const lootCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.LOOT] ?? 0;
    const skullCount = faceCounts[CURSED_PIRATE_DICE_FACE_IDS.SKULL] ?? 0;
    const events: DiceThroneEvent[] = [];

    if (cutlassCount > 0) {
        const targetId = ctx.defenderId;
        const target = state.players[targetId];
        events.push({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId,
                amount: cutlassCount,
                actualDamage: Math.min(cutlassCount, target?.resources[RESOURCE_IDS.HP] ?? 0),
                sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DamageDealtEvent);
    }

    if (lootCount > 0) {
        const currentCp = state.players[attackerId]?.resources[RESOURCE_IDS.CP] ?? 0;
        const newValue = Math.min(CP_MAX, currentCp + lootCount);
        events.push({
            type: 'CP_CHANGED',
            payload: {
                playerId: attackerId,
                delta: newValue - currentCp,
                newValue,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 1,
        } as CpChangedEvent);
    }

    if (skullCount > 0) {
        events.push({
            type: 'PREVENT_DAMAGE',
            payload: {
                targetId: attackerId,
                amount: skullCount * 2,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as PreventDamageEvent);
    }

    if (cutlassCount >= 2 && skullCount >= 1) {
        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId: attackerId,
            statusId: STATUS_IDS.CURSED_COIN,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 3,
        }));
    }

    return events;
}

function requestMercilessCursePowderKegTargets({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const targetIds = getMercilessCursePowderKegTargetIds(state, attackerId);
    if (targetIds.length === 0) return [];

    const optionMasks: number[] = [];
    const maskLimit = 1 << targetIds.length;
    for (let mask = 0; mask < maskLimit; mask++) {
        if (countBits(mask) <= 2) {
            optionMasks.push(mask);
        }
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.mercilessCursePowderKeg.title',
            options: optionMasks.map((mask) => {
                const selectedTargetIds = targetIds.filter((_, index) => (mask & (1 << index)) !== 0);
                return selectedTargetIds.length === 0
                    ? {
                        value: 0,
                        customId: MERCILESS_CURSE_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.mercilessCursePowderKeg.skip',
                    }
                    : {
                        value: mask,
                        customId: MERCILESS_CURSE_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.mercilessCursePowderKeg.apply',
                        labelParams: { targets: formatPlayerList(selectedTargetIds) },
                        targetPlayerIds: selectedTargetIds,
                        statusGrantConfig: { statusId: STATUS_IDS.POWDER_KEG, amount: 1 },
                    };
            }),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function requestGoFishPowderKegTargets({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const targetIds = getGoFishPowderKegTargetIds(state, attackerId);
    if (targetIds.length === 0) return [];

    const optionMasks: number[] = [];
    const maskLimit = 1 << targetIds.length;
    for (let mask = 0; mask < maskLimit; mask++) {
        if (countBits(mask) <= 3) {
            optionMasks.push(mask);
        }
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateGoFish.title',
            options: optionMasks.map((mask) => {
                const selectedTargetIds = targetIds.filter((_, index) => (mask & (1 << index)) !== 0);
                return selectedTargetIds.length === 0
                    ? {
                        value: 0,
                        customId: GO_FISH_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.cursedPirateGoFish.skip',
                    }
                    : {
                        value: mask,
                        customId: GO_FISH_POWDER_KEG_CHOICE_ID,
                        labelKey: 'choices.cursedPirateGoFish.apply',
                        labelParams: { targets: formatPlayerList(selectedTargetIds) },
                        targetPlayerIds: selectedTargetIds,
                        statusGrantConfig: { statusId: STATUS_IDS.POWDER_KEG, amount: 1 },
                    };
            }),
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function requestSipChoice({
    targetId,
    sourceAbilityId,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: targetId,
            sourceAbilityId,
            titleKey: 'choices.cursedPirateSip.title',
            options: [
                {
                    value: 0,
                    customId: SIP_CHOICE_ID,
                    labelKey: 'choices.cursedPirateSip.acceptPowderKeg',
                },
                {
                    value: 1,
                    customId: SIP_CHOICE_ID,
                    labelKey: 'choices.cursedPirateSip.rollInstead',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

function resolvePiratesLife({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    if (state.players[attackerId]?.playerBoardFace === 'cursed') {
        return [{
            type: 'HEAL_APPLIED',
            payload: {
                targetId: attackerId,
                amount: 3,
                sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as HealAppliedEvent];
    }

    return buildStatusAppliedOrChoiceEvents({
        state,
        targetId: attackerId,
        statusId: STATUS_IDS.CURSED_COIN,
        stacks: 1,
        sourceAbilityId,
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    });
}

export function registerCursedPirateCustomActions(): void {
    registerCustomActionHandler('cursed-pirate-curse-card-choice', requestCurseCardChoice, {
        categories: ['card', 'choice', 'damage'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('cursed-pirate-batten-down', battenDown, {
        categories: ['card'],
    });
    registerCustomActionHandler('cursed-pirate-flay-roll', resolveFlay, {
        categories: ['dice', 'damage', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-ransom-die-choice', requestRansomDieChoice, {
        categories: ['dice', 'choice', 'resource'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-crows-nest-roll', resolveCrowsNest, {
        categories: ['dice', 'card', 'choice'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-hefty-roll', resolveHefty, {
        categories: ['dice', 'card', 'resource'],
    });
    registerCustomActionHandler('cursed-pirate-steal-one-cp', stealOneCp, {
        categories: ['resource'],
    });
    registerCustomActionHandler('cursed-pirate-powder-keg-if-three-kind', applyPowderKegIfThreeOfAKind, {
        categories: ['status'],
        usesAttackDiceSnapshot: true,
    });
    registerCustomActionHandler('cursed-pirate-damage-by-cursed-coins', damageByCursedCoins, {
        categories: ['damage'],
    });
    registerCustomActionHandler('cursed-pirate-request-opponent-discard-one-card', requestOpponentDiscardOneCard, {
        categories: ['card', 'choice'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('cursed-pirate-cursed-upkeep-self-damage', cursedUpkeepSelfDamage, {
        categories: ['damage', 'passive'],
    });
    registerCustomActionHandler('cursed-pirate-human-cursed-end-turn', resolveHumanCursedTurnEnd, {
        categories: ['status', 'passive'],
    });
    registerCustomActionHandler('cursed-pirate-human-walk-the-plank-choice', requestHumanWalkThePlankChoice, {
        categories: ['choice', 'resource', 'card'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-human-remove-cursed-coins-choice', requestHumanRemoveCursedCoinsChoice, {
        categories: ['choice', 'status'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('cursed-pirate-human-verdict-command', requestHumanVerdictCommand, {
        categories: ['choice', 'status', 'damage'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-human-merciless-plunder', requestHumanMercilessPlunder, {
        categories: ['choice', 'status'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-human-powder-keg-if-four-kind', applyPowderKegIfFourOfAKind, {
        categories: ['status'],
        usesAttackDiceSnapshot: true,
    });
    registerCustomActionHandler('cursed-pirate-still-wet-behind-ears-defense', resolveStillWetBehindEarsDefense, {
        categories: ['damage', 'defense', 'resource', 'status'],
    });
    registerCustomActionHandler('cursed-pirate-human-defense', resolveHumanDefense, {
        categories: ['damage', 'defense', 'resource', 'status'],
    });
    registerCustomActionHandler('cursed-pirate-merciless-curse-powder-keg-targets', requestMercilessCursePowderKegTargets, {
        categories: ['choice', 'status'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('cursed-pirate-go-fish-powder-keg-targets', requestGoFishPowderKegTargets, {
        categories: ['choice', 'status'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('cursed-pirate-sip-choice', requestSipChoice, {
        categories: ['choice', 'status', 'dice'],
        requiresInteraction: true,
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('cursed-pirate-pirates-life', resolvePiratesLife, {
        categories: ['card', 'status'],
    });
    registerChoiceResolvedEventHandler(CURSE_CARD_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
        random,
    }) => {
        if (!sourceAbilityId || !random) return [];
        const selectedValue = Math.max(1, Math.min(3, Math.trunc(value ?? 1)));
        const damageAmount = selectedValue === 2 ? 2 : selectedValue === 3 ? 4 : 0;
        const drawCount = selectedValue;
        const events: DiceThroneEvent[] = [];

        if (damageAmount > 0) {
            const hp = state.players[playerId]?.resources[RESOURCE_IDS.HP] ?? 0;
            events.push({
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId: playerId,
                    amount: damageAmount,
                    actualDamage: Math.min(damageAmount, hp),
                    sourceAbilityId,
                    damageScope: 'direct',
                    unblockable: true,
                },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            } as DamageDealtEvent);
        }

        events.push(...buildDrawEvents(state, playerId, drawCount, random, 'CHOICE_RESOLVED', timestamp + 1, sourceAbilityId));
        return events;
    });
    registerChoiceResolvedEventHandler(HUMAN_WALK_THE_PLANK_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
        random,
    }) => {
        if (!sourceAbilityId) return [];

        const { targetId, mode } = decodeWalkThePlankSelectionValue(state, value ?? 0);
        if (!targetId || !state.players[targetId]) return [];

        if (mode === WALK_THE_PLANK_STEAL_MODE) {
            return stealOneCp({
                attackerId: playerId,
                targetId,
                sourceAbilityId,
                state,
                timestamp,
            });
        }

        if (mode === WALK_THE_PLANK_DISCARD_MODE) {
            return requestOpponentDiscardOneCard({
                attackerId: playerId,
                targetId,
                sourceAbilityId,
                state,
                timestamp,
                random,
                ctx: {
                    attackerId: playerId,
                    defenderId: targetId,
                    sourceAbilityId,
                    state,
                    damageDealt: 0,
                    timestamp,
                },
                action: {
                    type: 'custom',
                    target: 'opponent',
                    customActionId: 'cursed-pirate-human-walk-the-plank-choice',
                },
            });
        }

        return [];
    });
    registerChoiceResolvedEventHandler(HUMAN_REMOVE_CURSED_COINS_CHOICE_ID, ({
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (!sourceAbilityId) return [];

        const stacks = Math.max(0, Math.trunc(value ?? 0));
        if (stacks <= 0) return [];

        return [{
            type: 'STATUS_REMOVED',
            payload: {
                targetId: playerId,
                statusId: STATUS_IDS.CURSED_COIN,
                stacks,
            },
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp,
        } as StatusRemovedEvent];
    });
    registerChoiceEffectHandler(HUMAN_REMOVE_CURSED_COINS_CHOICE_ID, ({ state, sourceAbilityId }) => {
        if (!sourceAbilityId || state.pendingAttack?.sourceAbilityId !== sourceAbilityId) {
            return undefined;
        }
        return {
            pendingAttack: {
                ...updatePendingAttackSettlementStage(state.pendingAttack, 'readyToResolve')!,
                // 惊魂动魄的 7 点主伤害已在 withDamage 阶段落地；
                // 选择是否移除诅咒金币后只需要收口 ATTACK_RESOLVED，不应继续挂住攻击链。
                postDamageFollowUpResolved: true,
            },
        };
    });
    registerChoiceResolvedEventHandler(HUMAN_VERDICT_COMMAND_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (!sourceAbilityId) return [];
        const { targetId: encodedTargetId } = decodeHumanTargetedCursedCoinChoiceValue(state, value ?? 0);
        const targetId = encodedTargetId
            ?? getPendingAttackDefenderId(state, playerId, sourceAbilityId)
            ?? getOpponents(state, playerId)[0];
        const target = targetId ? state.players[targetId] : undefined;
        if (!targetId || !target) return [];

        const hp = target.resources[RESOURCE_IDS.HP] ?? 0;
        return [
            {
                type: 'ATTACK_MADE_UNDEFENDABLE',
                payload: { attackerId: state.pendingAttack?.attackerId ?? playerId },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            } as AttackMadeUndefendableEvent,
            ...buildStatusAppliedOrChoiceEvents({
                state,
                targetId,
                statusId: STATUS_IDS.PARLEY,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 1,
            }),
            {
                type: 'DAMAGE_DEALT',
                payload: {
                    targetId,
                    amount: 7,
                    actualDamage: Math.min(7, hp),
                    sourceAbilityId,
                    damageScope: 'attack',
                    unblockable: true,
                },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 2,
            } as DamageDealtEvent,
        ];
    });
    registerChoiceResolvedEventHandler(HUMAN_MERCILESS_PLUNDER_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (!sourceAbilityId) return [];
        const { targetId: encodedTargetId } = decodeHumanTargetedCursedCoinChoiceValue(state, value ?? 0);
        const targetId = encodedTargetId
            ?? getPendingAttackDefenderId(state, playerId, sourceAbilityId)
            ?? getOpponents(state, playerId)[0];
        if (!targetId || !state.players[targetId]) return [];

        return [
            {
                type: 'ATTACK_MADE_UNDEFENDABLE',
                payload: { attackerId: state.pendingAttack?.attackerId ?? playerId },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            } as AttackMadeUndefendableEvent,
            ...buildStatusAppliedOrChoiceEvents({
                state,
                targetId,
                statusId: STATUS_IDS.PARLEY,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 1,
            }),
            ...buildStatusAppliedOrChoiceEvents({
                state,
                targetId,
                statusId: STATUS_IDS.POWDER_KEG,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 2,
                triggerExplosionOnExisting: false,
            }),
        ];
    });
    registerChoiceEffectHandler(HUMAN_MERCILESS_PLUNDER_CHOICE_ID, ({ state, playerId, sourceAbilityId, value }) => {
        const { cursedCoinGain } = decodeHumanTargetedCursedCoinChoiceValue(state, value ?? 0);
        const player = state.players[playerId];
        if (!player) return undefined;
        const currentStacks = player.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        const maxStacks = getTokenStackLimit(state, playerId, STATUS_IDS.CURSED_COIN);
        const result: Partial<CustomActionContext['state']> = {
            players: {
                ...state.players,
                [playerId]: {
                    ...player,
                    statusEffects: {
                        ...player.statusEffects,
                        [STATUS_IDS.CURSED_COIN]: Math.min(currentStacks + cursedCoinGain, maxStacks),
                    },
                },
            },
        };
        if (sourceAbilityId && state.pendingAttack?.sourceAbilityId === sourceAbilityId) {
            result.pendingAttack = {
                ...updatePendingAttackSettlementStage(state.pendingAttack, 'readyToResolve')!,
                // 无情劫掠的 12 点主伤害已在 withDamage 阶段落地；
                // 选择诅咒金币后只需要收口 ATTACK_RESOLVED，不应再次重放整段攻击链。
                postDamageFollowUpResolved: true,
            };
        }
        return result;
    });
    registerChoiceEffectHandler(HUMAN_VERDICT_COMMAND_CHOICE_ID, ({ state, playerId, value }) => {
        const player = state.players[playerId];
        if (!player) return undefined;
        const { cursedCoinGain } = decodeHumanTargetedCursedCoinChoiceValue(state, value ?? 0);
        const currentStacks = player.statusEffects[STATUS_IDS.CURSED_COIN] ?? 0;
        const maxStacks = getTokenStackLimit(state, playerId, STATUS_IDS.CURSED_COIN);
        return {
            players: {
                ...state.players,
                [playerId]: {
                    ...player,
                    statusEffects: {
                        ...player.statusEffects,
                        [STATUS_IDS.CURSED_COIN]: Math.min(currentStacks + cursedCoinGain, maxStacks),
                    },
                },
            },
        };
    });
    registerChoiceResolvedEventHandler(RANSOM_DIE_CHOICE_ID, ({
        state,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (!sourceAbilityId) return [];
        const decoded = decodeRansomSelectionValue(state, value ?? 0);
        const target = decoded.targetId ? state.players[decoded.targetId] : undefined;
        const die = getRansomEligibleCurrentDice(state, decoded.targetId).find(entry => entry.id === decoded.dieId);
        if (!decoded.attackerId || !decoded.targetId || !target || !die) return [];

        const targetCp = target.resources[RESOURCE_IDS.CP] ?? 0;
        const baseValue = Math.trunc(value ?? 0);
        return [{
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: decoded.targetId,
                sourceAbilityId,
                titleKey: 'choices.cursedPirateRansomResolve.title',
                options: [
                    {
                        value: baseValue * RANSOM_DECISION_FACTOR + 1,
                        customId: RANSOM_RESOLVE_CHOICE_ID,
                        labelKey: 'choices.cursedPirateRansomResolve.pay',
                        disabled: targetCp < 2,
                    },
                    {
                        value: baseValue * RANSOM_DECISION_FACTOR,
                        customId: RANSOM_RESOLVE_CHOICE_ID,
                        labelKey: 'choices.cursedPirateRansomResolve.reroll',
                        labelParams: { die: die.id + 1, value: die.value },
                    },
                ],
            },
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp,
        } as ChoiceRequestedEvent];
    });
    registerChoiceResolvedEventHandler(RANSOM_RESOLVE_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
        random,
    }) => {
        if (!sourceAbilityId) return [];
        const normalized = Math.max(0, Math.trunc(value ?? 0));
        const shouldPay = normalized % RANSOM_DECISION_FACTOR === 1;
        const selectedValue = Math.floor(normalized / RANSOM_DECISION_FACTOR);
        const decoded = decodeRansomSelectionValue(state, selectedValue);
        if (decoded.targetId !== playerId || !decoded.attackerId) return [];

        const target = state.players[playerId];
        const attacker = state.players[decoded.attackerId];
        const targetCp = target?.resources[RESOURCE_IDS.CP] ?? 0;
        if (shouldPay && target && attacker && targetCp >= 2) {
            const attackerCp = attacker.resources[RESOURCE_IDS.CP] ?? 0;
            const newAttackerCp = Math.min(CP_MAX, attackerCp + 2);
            return [
                {
                    type: 'CP_CHANGED',
                    payload: {
                        playerId,
                        delta: -2,
                        newValue: targetCp - 2,
                        sourceAbilityId,
                    },
                    sourceCommandType: 'CHOICE_RESOLVED',
                    timestamp,
                } as CpChangedEvent,
                {
                    type: 'CP_CHANGED',
                    payload: {
                        playerId: decoded.attackerId,
                        delta: newAttackerCp - attackerCp,
                        newValue: newAttackerCp,
                        sourceAbilityId,
                    },
                    sourceCommandType: 'CHOICE_RESOLVED',
                    timestamp: timestamp + 1,
                } as CpChangedEvent,
            ];
        }

        if (!random) return [];
        const die = getRansomEligibleCurrentDice(state, playerId).find(entry => entry.id === decoded.dieId);
        if (!die) return [];
        const newValue = random.d(6);
        return [{
            type: 'DIE_REROLLED',
            payload: {
                dieId: decoded.dieId,
                oldValue: die.value,
                newValue,
                playerId,
                sourceCardId: sourceAbilityId,
            },
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp,
        } as DieRerolledEvent];
    });
    registerChoiceResolvedEventHandler(MERCILESS_CURSE_POWDER_KEG_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        const mask = Math.max(0, Math.trunc(value ?? 0));
        const targetIds = getMercilessCursePowderKegTargetIds(state, playerId)
            .filter((_, index) => (mask & (1 << index)) !== 0)
            .slice(0, 2);

        return targetIds.flatMap((targetId, index) => buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp: timestamp + index,
        }));
    });
    registerChoiceResolvedEventHandler(GO_FISH_POWDER_KEG_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        const mask = Math.max(0, Math.trunc(value ?? 0));
        const targetIds = getGoFishPowderKegTargetIds(state, playerId)
            .filter((_, index) => (mask & (1 << index)) !== 0)
            .slice(0, 3);

        return targetIds.flatMap((targetId, index) => buildStatusAppliedOrChoiceEvents({
            state,
            targetId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp: timestamp + index,
        }));
    });
    registerChoiceResolvedEventHandler(SIP_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
        random,
    }) => {
        if (!sourceAbilityId) return [];
        const selectedValue = Math.trunc(value ?? 0);
        if (selectedValue !== 1 || !random) {
            return buildStatusAppliedOrChoiceEvents({
                state,
                targetId: playerId,
                statusId: STATUS_IDS.POWDER_KEG,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            });
        }

        const rolledValue = random.d(6);
        const { events } = createBonusDieEvents(
            state,
            sourceAbilityId,
            playerId,
            [rolledValue],
            timestamp,
            (dieValue) => dieValue >= 3
                ? 'bonusDie.effect.cursedPirateSipHit'
                : 'bonusDie.effect.cursedPirateSipMiss',
        );
        if (rolledValue < 3) return events;

        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId: playerId,
            statusId: STATUS_IDS.POWDER_KEG,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp: timestamp + 1,
        }));
        events.push(...buildStatusAppliedOrChoiceEvents({
            state,
            targetId: playerId,
            statusId: STATUS_IDS.WITHER,
            stacks: 1,
            sourceAbilityId,
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp: timestamp + 2,
        }));
        return events;
    });
    registerChoiceResolvedEventHandler(POWDER_KEG_TRANSFER_CHOICE_ID, ({
        state,
        playerId,
        sourceAbilityId,
        value,
        timestamp,
    }) => {
        if (sourceAbilityId !== POWDER_KEG_UPKEEP_SOURCE_ABILITY_ID) return [];
        if ((state.players[playerId]?.statusEffects[STATUS_IDS.POWDER_KEG] ?? 0) <= 0) return [];

        const targetIds = getPowderKegTransferTargetIds(state, playerId);
        const targetId = targetIds[Math.max(0, Math.trunc(value ?? -1))];
        if (!targetId) return [];
        if (targetId === playerId) return [];

        return [
            {
                type: 'STATUS_REMOVED',
                payload: {
                    targetId: playerId,
                    statusId: STATUS_IDS.POWDER_KEG,
                    stacks: 1,
                },
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp,
            } as DiceThroneEvent,
            ...buildStatusAppliedOrChoiceEvents({
                state,
                targetId,
                statusId: STATUS_IDS.POWDER_KEG,
                stacks: 1,
                sourceAbilityId,
                sourceCommandType: 'CHOICE_RESOLVED',
                timestamp: timestamp + 1,
            }),
        ];
    });
}
