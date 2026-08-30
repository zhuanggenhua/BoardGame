import type {
    DiceThroneEvent,
    DiceThroneRollContext,
    HealAppliedEvent,
    InteractionRequestedEvent,
    PendingInteraction,
    TokenGrantedEvent,
} from '../types';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { registerChoiceEffectHandler } from '../choiceEffects';
import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { STATUS_IDS, TOKEN_IDS, VAMPIRE_LORD_DICE_FACE_IDS } from '../ids';
import { getAttackMaxDuplicateValueCount, getPendingBonusSettlementDice, getPlayerDieFace, getTokenStackLimit } from '../rules';

const VAMPIRE_LORD_MESMERIZE_SETTLEMENT_ID = 'vampire-lord-mesmerize-roll';

function getSuspendedOpponentRollContext(
    state: CustomActionContext['state'],
    actingPlayerId: string,
): DiceThroneRollContext | undefined {
    const context = state.currentRollContext;
    const candidate = context?.suspendedParent ?? (context?.kind === 'bonus' ? undefined : context);
    if (!candidate || candidate.status === 'settled' || candidate.policy.rerollableBy === 'none') {
        return undefined;
    }
    return candidate.dice.some((die) => (die.ownerId ?? candidate.ownerPlayerId) !== actingPlayerId)
        ? candidate
        : undefined;
}

function createMesmerizeRerollInteraction(
    state: CustomActionContext['state'],
    actingPlayerId: string,
    sourceAbilityId: string,
    timestamp: number,
): InteractionRequestedEvent | null {
    const opponentRollContext = getSuspendedOpponentRollContext(state, actingPlayerId);
    if (!opponentRollContext) return null;

    const opponentDice = opponentRollContext.dice.filter((die) => (
        (die.ownerId ?? opponentRollContext.ownerPlayerId) !== actingPlayerId
    ));
    if (opponentDice.length === 0) return null;

    const diceOwnerIds = Array.from(new Set(opponentDice.map((die) => die.ownerId ?? opponentRollContext.ownerPlayerId)));
    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-force-reroll-${timestamp}`,
        playerId: actingPlayerId,
        sourceCardId: sourceAbilityId,
        type: 'selectDie',
        titleKey: 'interaction.selectOpponentDieToReroll',
        selectCount: 1,
        selected: [],
        diceOwnerId: diceOwnerIds.length === 1 ? diceOwnerIds[0] : undefined,
        targetOpponentDice: true,
        allowedDieIds: opponentDice.map((die) => die.id),
    };

    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'BONUS_DICE_SETTLED',
        timestamp,
    } as InteractionRequestedEvent;
}

function handleMesmerizeRoll({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    random,
    targetId,
}: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? VAMPIRE_LORD_DICE_FACE_IDS.MESMERIZE;
    const targetPlayerId = targetId && targetId !== attackerId
        ? targetId
        : state.currentRollContext?.ownerPlayerId ?? attackerId;

    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId,
                effectKey: 'bonusDie.effect.vampireLordMesmerizeDie',
                effectParams: { value, index: 0 },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as DiceThroneEvent,
        createDisplayOnlySettlement(
            sourceAbilityId,
            attackerId,
            targetPlayerId,
            [{
                index: 0,
                value,
                face,
                effectKey: 'bonusDie.effect.vampireLordMesmerizeDie',
                effectParams: { value, index: 0 },
            }],
            timestamp + 1,
            {
                customResolutionId: VAMPIRE_LORD_MESMERIZE_SETTLEMENT_ID,
                continuation: { kind: 'complete' },
            },
        ),
    ];
}

function handleBloodPowerHealAttackDamage({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
}: CustomActionContext): DiceThroneEvent[] {
    const pendingAttack = state.pendingAttack;
    if (!pendingAttack || pendingAttack.attackerId !== attackerId) return [];

    const amount = Math.max(0, pendingAttack.resolvedDamage ?? 0);
    if (amount <= 0) return [];

    return [{
        type: 'HEAL_APPLIED',
        payload: {
            targetId: attackerId,
            amount,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as HealAppliedEvent];
}

function getPositiveIntParam(
    action: CustomActionContext['action'],
    key: string,
    fallback: number,
): number {
    const params = action.params as Record<string, unknown> | undefined;
    const value = params?.[key];
    return Number.isFinite(value)
        ? Math.max(0, Math.trunc(value as number))
        : fallback;
}

function handleBloodthirstyClawsBloodPowerIfKind({
    attackerId,
    sourceAbilityId,
    state,
    timestamp,
    action,
}: CustomActionContext): DiceThroneEvent[] {
    const threshold = getPositiveIntParam(action, 'threshold', 3);
    if (getAttackMaxDuplicateValueCount(state) < threshold) return [];

    const amount = getPositiveIntParam(action, 'amount', 1);
    if (amount <= 0) return [];

    const currentAmount = state.players[attackerId]?.tokens[TOKEN_IDS.BLOOD_POWER] ?? 0;
    const maxStacks = getTokenStackLimit(state, attackerId, TOKEN_IDS.BLOOD_POWER);
    const newTotal = Math.min(currentAmount + amount, maxStacks);
    const granted = newTotal - currentAmount;
    if (granted <= 0) return [];

    return [{
        type: 'TOKEN_GRANTED',
        payload: {
            targetId: attackerId,
            tokenId: TOKEN_IDS.BLOOD_POWER,
            amount: granted,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent];
}

function getBloodPossessedChoiceDefenderId(
    state: CustomActionContext['state'],
    playerId: string,
): string | undefined {
    const contextDefenderId = state.currentChoiceContext?.defenderId;
    if (
        typeof contextDefenderId === 'string'
        && contextDefenderId !== playerId
        && state.players[contextDefenderId]
    ) {
        return contextDefenderId;
    }

    const pendingDefenderId = state.pendingAttack?.attackerId === playerId
        ? state.pendingAttack.defenderId
        : undefined;
    if (
        typeof pendingDefenderId === 'string'
        && pendingDefenderId !== playerId
        && state.players[pendingDefenderId]
    ) {
        return pendingDefenderId;
    }

    return undefined;
}

export function registerVampireLordCustomActions(): void {
    registerBonusDiceSettlementHandler(VAMPIRE_LORD_MESMERIZE_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        const followup = die && die.value >= 5
            ? createMesmerizeRerollInteraction(
                state,
                settlement.attackerId,
                settlement.sourceAbilityId,
                timestamp + 1,
            )
            : null;
        return { totalDamage: 0, followupEvents: followup ? [followup] : [] };
    });

    registerCustomActionHandler('vampire-lord-mesmerize-roll', handleMesmerizeRoll, {
        categories: ['token', 'dice'],
    });
    registerCustomActionHandler('vampire-lord-blood-power-heal-attack-damage', handleBloodPowerHealAttackDamage, {
        categories: ['resource', 'passive'],
    });
    registerCustomActionHandler('vampire-lord-bloodthirsty-claws-blood-power-if-kind', handleBloodthirstyClawsBloodPowerIfKind, {
        categories: ['token'],
        usesAttackDiceSnapshot: true,
    });
    registerChoiceEffectHandler('vampire-lord-blood-possessed-inflict-bleed', ({ state, playerId, value }) => {
        const targetId = getBloodPossessedChoiceDefenderId(state, playerId);
        if (!targetId) return undefined;
        const target = state.players[targetId];
        if (!target) return undefined;

        const stacksToAdd = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 1;
        if (stacksToAdd <= 0) return undefined;
        const maxStacks = state.tokenDefinitions.find(def => def.id === STATUS_IDS.BLEED)?.stackLimit ?? 99;
        const currentStacks = target.statusEffects[STATUS_IDS.BLEED] ?? 0;

        return {
            players: {
                ...state.players,
                [targetId]: {
                    ...target,
                    statusEffects: {
                        ...target.statusEffects,
                        [STATUS_IDS.BLEED]: Math.min(currentStacks + stacksToAdd, maxStacks),
                    },
                },
            },
        };
    });
    registerChoiceEffectHandler('vampire-lord-blood-possessed-gain-mesmerize', ({ state, playerId, value }) => {
        const player = state.players[playerId];
        if (!player) return undefined;

        const amountToAdd = typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 1;
        if (amountToAdd <= 0) return undefined;
        const maxStacks = getTokenStackLimit(state, playerId, TOKEN_IDS.MESMERIZE);
        const currentAmount = player.tokens[TOKEN_IDS.MESMERIZE] ?? 0;

        return {
            players: {
                ...state.players,
                [playerId]: {
                    ...player,
                    tokens: {
                        ...player.tokens,
                        [TOKEN_IDS.MESMERIZE]: Math.min(currentAmount + amountToAdd, maxStacks),
                    },
                },
            },
        };
    });
}
