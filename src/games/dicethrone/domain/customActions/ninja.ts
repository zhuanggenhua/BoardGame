import { createBonusDiceWithReroll, createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../ids';
import { getActiveDice, getAttackMaxDuplicateValueCount, getFaceCounts, getOpponents, getPendingBonusSettlementDice, getPlayerDieFace, getSeatingOrder, getTokenStackLimit } from '../rules';
import { reduce } from '../reducer';
import { applyEvents } from '../utils';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import { maybeCreateDamageResponseEvent } from '../tokenResponse';
import type {
    AttackMadeUndefendableEvent,
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    ChoiceRequestedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    PendingAttackUpdatedEvent,
    TokenGrantedEvent,
} from '../events';
import type { BonusDieInfo, DieFace, PendingBonusDiceSettlement } from '../core-types';

const GOING_FORWARD_2_SETTLEMENT_ID = 'ninja-going-forward-2';
const GOING_FORWARD_SETTLEMENT_ID = 'ninja-going-forward';
const DEATH_BLOSSOM_SETTLEMENT_ID = 'ninja-death-blossom';
const DEATH_BLOSSOM_2_SETTLEMENT_ID = 'ninja-death-blossom-2';
const GOING_FORWARD_BLEED_SETTLEMENT_ID = 'ninja-going-forward-bleed';
const POISON_BLADE_2_SETTLEMENT_ID = 'ninja-poison-blade-2';
const NINJUTSU_SETTLEMENT_ID = 'ninja-ninjutsu';
const NINJA_SMOKE_SCREEN_2_CHOICE_ID = 'ninja-smoke-screen-2-choice';
const NINJA_SMOKE_SCREEN_KUJI_KIRI_CHOICE_ID = 'ninja-smoke-screen-kuji-kiri-choice';
const NINJA_NINJUTSU_BONUS_DAMAGE_CHOICE_ID = 'ninja-ninjutsu-bonus-damage';

const SMOKE_SCREEN_2_MAIN_SOURCE_IDS = ['smoke-screen-2-main'] as const;
const SMOKE_SCREEN_2_KUJI_KIRI_SOURCE_IDS = ['smoke-screen-2-kuji-kiri'] as const;

function bonusDamageEvent(playerId: string, amount: number, sourceAbilityId: string, timestamp: number): BonusDamageAddedEvent {
    return {
        type: 'BONUS_DAMAGE_ADDED',
        payload: { playerId, amount, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDamageAddedEvent;
}

function isExpectedChoiceSource(sourceAbilityId: string | undefined, expectedSourceIds: readonly string[]): boolean {
    return typeof sourceAbilityId === 'string' && expectedSourceIds.includes(sourceAbilityId);
}

function grantTokenEvent(
    state: CustomActionContext['state'],
    sourceAbilityId: string,
    targetId: string,
    tokenId: string,
    amount: number,
    timestamp: number,
): TokenGrantedEvent | null {
    if (amount <= 0) return null;

    const current = state.players[targetId]?.tokens[tokenId]
        ?? state.players[targetId]?.statusEffects[tokenId]
        ?? 0;
    const maxStacks = getTokenStackLimit(state, targetId, tokenId);
    const newTotal = Math.min(current + amount, maxStacks);
    const granted = newTotal - current;
    if (granted <= 0) return null;

    return {
        type: 'TOKEN_GRANTED',
        payload: {
            targetId,
            tokenId,
            amount: granted,
            newTotal,
            sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent;
}

function deferTokenGrantAfterUse(
    state: CustomActionContext['state'],
    targetId: string,
    tokenId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
): PendingAttackUpdatedEvent | null {
    const pendingAttack = state.pendingAttack;
    const current = state.players[targetId]?.tokens[tokenId] ?? 0;
    if (!pendingAttack || pendingAttack.defenderId !== targetId || current <= 0 || amount <= 0) {
        return null;
    }

    return {
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId: pendingAttack.attackerId,
            patch: {
                deferredTokenGrants: [
                    ...(pendingAttack.deferredTokenGrants ?? []),
                    {
                        triggerTokenId: tokenId,
                        targetId,
                        tokenId,
                        amount,
                        sourceAbilityId,
                        sourceCommandType: 'ABILITY_EFFECT',
                    },
                ],
            },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PendingAttackUpdatedEvent;
}

function delayedPoisonEvent(
    state: CustomActionContext['state'],
    sourceAbilityId: string,
    targetId: string,
    amount: number,
    timestamp: number,
): TokenGrantedEvent | null {
    return grantTokenEvent(state, sourceAbilityId, targetId, TOKEN_IDS.DELAYED_POISON, amount, timestamp);
}

function createUnblockableDamageEvents(
    state: CustomActionContext['state'],
    sourcePlayerId: string,
    sourceAbilityId: string,
    targetId: string,
    amount: number,
    timestamp: number,
    damageScope: 'attack' | 'direct' = 'direct',
): DiceThroneEvent[] {
    if (amount <= 0) return [];

    const damageCalc = createDamageCalculation({
        source: { playerId: sourcePlayerId, abilityId: sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: amount,
        state,
        timestamp,
    });
    const damageEvents = damageCalc.toEvents({ includeSideEffects: true });
    damageEvents.forEach((event) => {
        if (event.type === 'DAMAGE_DEALT') {
            const payload = (event as DamageDealtEvent).payload;
            payload.unblockable = true;
            payload.damageScope = damageScope;
        }
    });
    return damageEvents as DiceThroneEvent[];
}

function createBlinkDamageEvents(
    ctx: CustomActionContext,
    targetId: string,
    amount: number,
    timestamp: number,
): DiceThroneEvent[] {
    return createUnblockableDamageEvents(ctx.state, ctx.targetId, ctx.sourceAbilityId, targetId, amount, timestamp, 'attack');
}

function closeoutNonAttackVariant(attackerId: string, timestamp: number): PendingAttackUpdatedEvent {
    return {
        type: 'PENDING_ATTACK_UPDATED',
        payload: {
            attackerId,
            patch: { isDefendable: false },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as PendingAttackUpdatedEvent;
}

function attackMadeUndefendable(attackerId: string, timestamp: number): AttackMadeUndefendableEvent {
    return {
        type: 'ATTACK_MADE_UNDEFENDABLE',
        payload: { attackerId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as AttackMadeUndefendableEvent;
}

function buildDisplayOnlySingleDie(
    sourceAbilityId: string,
    actingPlayerId: string,
    targetId: string,
    value: number,
    face: DieFace,
    effectKey: string,
    timestamp: number,
    effectParams?: Record<string, string | number>,
    options?: {
        customResolutionId?: string;
        continuation: NonNullable<PendingBonusDiceSettlement['continuation']>;
    },
): DiceThroneEvent[] {
    return [
        {
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: actingPlayerId,
                targetPlayerId: targetId,
                effectKey,
                effectParams,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp,
        } as BonusDieRolledEvent,
        createDisplayOnlySettlement(
            sourceAbilityId,
            actingPlayerId,
            targetId,
            [{ index: 0, value, face, effectKey, effectParams }],
            timestamp + 1,
            effectParams
                ? {
                    summaryEffectKey: effectKey,
                    summaryEffectParams: effectParams,
                    customResolutionId: options?.customResolutionId,
                    continuation: options?.continuation ?? { kind: 'complete' },
                }
                : {
                    customResolutionId: options?.customResolutionId,
                    continuation: options?.continuation ?? { kind: 'complete' },
                },
        ),
    ];
}

function encodePlayerOpponentChoice(playerIndex: number, opponentIndex: number): number {
    return (playerIndex + 1) * 10 + (opponentIndex + 1);
}

function decodePlayerOpponentChoice(value?: number): { playerIndex: number; opponentIndex: number } {
    const raw = Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
    return {
        playerIndex: Math.floor(raw / 10) - 1,
        opponentIndex: (raw % 10) - 1,
    };
}

function encodeOpponentPairChoice(firstIndex: number, secondIndex: number): number {
    return (firstIndex + 1) * 10 + (secondIndex + 1);
}

function decodeOpponentPairChoice(value?: number): { firstIndex: number; secondIndex: number } {
    const raw = Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
    return {
        firstIndex: Math.floor(raw / 10) - 1,
        secondIndex: (raw % 10) - 1,
    };
}

function handleBlinkBase(ctx: CustomActionContext): DiceThroneEvent[] {
    const originalAttackerId = ctx.ctx.defenderId;
    if (!originalAttackerId) return [];

    const faceCounts = getFaceCounts(getActiveDice(ctx.state));
    const katanaCount = faceCounts[NINJA_DICE_FACE_IDS.KATANA] ?? 0;
    const shurikenCount = faceCounts[NINJA_DICE_FACE_IDS.SHURIKEN] ?? 0;
    const maskCount = faceCounts[NINJA_DICE_FACE_IDS.MASK] ?? 0;

    const events: DiceThroneEvent[] = [];
    let reflectedDamage = 0;
    if (katanaCount > 0) reflectedDamage += 1;
    if (shurikenCount > 0) reflectedDamage += 2;
    events.push(...createBlinkDamageEvents(ctx, originalAttackerId, reflectedDamage, ctx.timestamp + 10));

    if (maskCount >= 2) {
        const smokeEvent = grantTokenEvent(ctx.state, ctx.sourceAbilityId, ctx.targetId, TOKEN_IDS.SMOKE_BOMB, 1, ctx.timestamp + 20);
        if (smokeEvent) {
            events.push(smokeEvent);
        } else {
            const deferredSmokeEvent = deferTokenGrantAfterUse(
                ctx.state,
                ctx.targetId,
                TOKEN_IDS.SMOKE_BOMB,
                1,
                ctx.sourceAbilityId,
                ctx.timestamp + 20,
            );
            if (deferredSmokeEvent) events.push(deferredSmokeEvent);
        }
    }

    return events;
}

function handleBlink2(ctx: CustomActionContext): DiceThroneEvent[] {
    const originalAttackerId = ctx.ctx.defenderId;
    if (!originalAttackerId) return [];

    const faceCounts = getFaceCounts(getActiveDice(ctx.state));
    const katanaCount = faceCounts[NINJA_DICE_FACE_IDS.KATANA] ?? 0;
    const shurikenCount = faceCounts[NINJA_DICE_FACE_IDS.SHURIKEN] ?? 0;
    const maskCount = faceCounts[NINJA_DICE_FACE_IDS.MASK] ?? 0;

    const events: DiceThroneEvent[] = [];
    const reflectedDamage = katanaCount + (shurikenCount > 0 ? 2 : 0);
    events.push(...createBlinkDamageEvents(ctx, originalAttackerId, reflectedDamage, ctx.timestamp + 10));

    if (maskCount >= 2) {
        const smokeEvent = grantTokenEvent(ctx.state, ctx.sourceAbilityId, ctx.targetId, TOKEN_IDS.SMOKE_BOMB, 1, ctx.timestamp + 20);
        if (smokeEvent) {
            events.push(smokeEvent);
        } else {
            const deferredSmokeEvent = deferTokenGrantAfterUse(
                ctx.state,
                ctx.targetId,
                TOKEN_IDS.SMOKE_BOMB,
                1,
                ctx.sourceAbilityId,
                ctx.timestamp + 20,
            );
            if (deferredSmokeEvent) events.push(deferredSmokeEvent);
        }
    }

    return events;
}

function handleSlash2Bonus(ctx: CustomActionContext): DiceThroneEvent[] {
    const duplicateCount = getAttackMaxDuplicateValueCount(ctx.state);
    if (duplicateCount < 3) return [];
    const event = grantTokenEvent(ctx.state, ctx.sourceAbilityId, ctx.attackerId, TOKEN_IDS.NINJUTSU, 1, ctx.timestamp);
    return event ? [event] : [];
}

function handleGoingForward(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const dice: BonusDieInfo[] = [];
    const events: DiceThroneEvent[] = [];

    for (let index = 0; index < 2; index += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value);
        if (!face) throw new Error(`Ninja Going Forward rolled an unmapped die value: ${value}`);
        dice.push({ index, value, face, effectKey: 'bonusDie.effect.ninjaGoingForward', effectParams: { value, index } });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.ninjaGoingForward',
                effectParams: { value, index },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + index,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, dice, timestamp + 2, {
        summaryEffectKey: 'bonusDie.effect.ninjaGoingForwardResult',
        customResolutionId: GOING_FORWARD_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
    }));
    return events;
}

function handleGoingForwardBleed(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value);
    if (!face) throw new Error(`Ninja Going Forward Bleed rolled an unmapped die value: ${value}`);
    const events = buildDisplayOnlySingleDie(
        sourceAbilityId,
        attackerId,
        targetId,
        value,
        face,
        'bonusDie.effect.ninjaGoingForwardBleed',
        timestamp,
        { value, damage: value },
        {
            customResolutionId: GOING_FORWARD_BLEED_SETTLEMENT_ID,
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
        },
    );
    return events;
}

function handleGoingForward2(ctx: CustomActionContext): DiceThroneEvent[] {
    return createBonusDiceWithReroll(
        ctx,
        {
            diceCount: 2,
            rerollCostTokenId: TOKEN_IDS.NINJUTSU,
            rerollCostAmount: 0,
            maxRerollCount: 1,
            dieEffectKey: 'bonusDie.effect.ninjaGoingForward',
            rerollEffectKey: 'bonusDie.effect.ninjaGoingForwardReroll',
            resolutionMode: 'attackBonus',
            customResolutionId: GOING_FORWARD_2_SETTLEMENT_ID,
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
        },
        () => [],
    );
}

function handlePoisonBlade2(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value);
    if (!face) throw new Error(`Ninja Poison Blade rolled an unmapped die value: ${value}`);
    const events = buildDisplayOnlySingleDie(
        sourceAbilityId,
        attackerId,
        targetId,
        value,
        face,
        'bonusDie.effect.ninjaPoisonBlade2',
        timestamp,
        { value },
        {
            customResolutionId: POISON_BLADE_2_SETTLEMENT_ID,
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
        },
    );
    return events;
}

function handleDeathBlossom2(ctx: CustomActionContext): DiceThroneEvent[] {
    return createBonusDiceWithReroll(
        ctx,
        {
            diceCount: 5,
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            maxRerollCount: 2,
            dieEffectKey: 'bonusDie.effect.ninjaDeathBlossom2',
            rerollEffectKey: 'bonusDie.effect.ninjaDeathBlossom2Reroll',
            resolutionMode: 'attackBonus',
            customResolutionId: DEATH_BLOSSOM_2_SETTLEMENT_ID,
            effectParamsBuilder: ({ value, index, face }) => ({ value, index, face }),
            continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
        },
        () => [],
    );
}

function handleDeathBlossom(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const dice: BonusDieInfo[] = [];
    const events: DiceThroneEvent[] = [];
    for (let index = 0; index < 5; index += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value);
        if (!face) throw new Error(`Ninja Death Blossom rolled an unmapped die value: ${value}`);
        dice.push({ index, value, face, effectKey: 'bonusDie.effect.ninjaDeathBlossom2', effectParams: { value, index, face } });
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: {
                value,
                face,
                playerId: attackerId,
                targetPlayerId: targetId,
                effectKey: 'bonusDie.effect.ninjaDeathBlossom2',
                effectParams: { value, index, face },
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + index,
        } as BonusDieRolledEvent);
    }

    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, dice, timestamp + 5, {
        customResolutionId: DEATH_BLOSSOM_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: true },
    }));
    return events;
}

function handleNinjutsuOffensiveRollEndUse(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleNinjutsuUse(ctx);
}

function handleNonAttackCloseout(ctx: CustomActionContext): DiceThroneEvent[] {
    return [closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp)];
}

function handleSmokeScreen2(ctx: CustomActionContext): DiceThroneEvent[] {
    const playerIds = getSeatingOrder(ctx.state);
    const opponentIds = getOpponents(ctx.state, ctx.attackerId);
    if (playerIds.length === 0 || opponentIds.length === 0) {
        return [closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp)];
    }

    const options = playerIds.flatMap((playerId, playerIndex) => opponentIds.map((opponentId, opponentIndex) => ({
        value: encodePlayerOpponentChoice(playerIndex, opponentIndex),
        customId: NINJA_SMOKE_SCREEN_2_CHOICE_ID,
        labelKey: 'choices.ninjaSmokeScreen.option',
        labelParams: {
            ally: Number(playerId) + 1,
            opponent: Number(opponentId) + 1,
        },
    })));

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.ninjaSmokeScreen.title',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleSmokeScreenKujiKiri(ctx: CustomActionContext): DiceThroneEvent[] {
    const opponentIds = getOpponents(ctx.state, ctx.attackerId);
    if (opponentIds.length === 0) {
        return [closeoutNonAttackVariant(ctx.attackerId, ctx.timestamp)];
    }

    const options = [];
    for (let firstIndex = 0; firstIndex < opponentIds.length; firstIndex += 1) {
        for (let secondIndex = firstIndex; secondIndex < opponentIds.length; secondIndex += 1) {
            const firstOpponentId = opponentIds[firstIndex];
            const secondOpponentId = opponentIds[secondIndex];
            options.push({
                value: encodeOpponentPairChoice(firstIndex, secondIndex),
                customId: NINJA_SMOKE_SCREEN_KUJI_KIRI_CHOICE_ID,
                labelKey: firstIndex === secondIndex
                    ? 'choices.ninjaSmokeScreen.kujiKiriSameTarget'
                    : 'choices.ninjaSmokeScreen.kujiKiriSplitTargets',
                labelParams: firstIndex === secondIndex
                    ? { opponent: Number(firstOpponentId) + 1 }
                    : {
                        firstOpponent: Number(firstOpponentId) + 1,
                        secondOpponent: Number(secondOpponentId) + 1,
                    },
            });
        }
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: 'choices.ninjaSmokeScreen.kujiKiriTitle',
            options,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: ctx.timestamp,
    } as ChoiceRequestedEvent];
}

function handleNinjutsuUse(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value);
    if (!face) throw new Error(`Ninja Ninjutsu rolled an unmapped die value: ${value}`);
    const targetId = state.pendingAttack?.defenderId ?? ctx.targetId;
    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: targetId,
            effectKey: 'bonusDie.effect.ninjaNinjutsu',
            effectParams: { value },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, [{
        index: 0,
        value,
        face,
        effectKey: 'bonusDie.effect.ninjaNinjutsu',
        effectParams: { value },
    }], timestamp + 1, {
        summaryEffectKey: 'bonusDie.effect.ninjaNinjutsuResult',
        summaryEffectParams: { value },
        customResolutionId: NINJUTSU_SETTLEMENT_ID,
        continuation: { kind: 'attack', settlementStage: 'preDamage', markBonusDiceResolved: false },
    }));

    return events;
}

function buildNinjutsuBonusDamageChoiceEvents(
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId: string | undefined,
    timestamp: number,
): DiceThroneEvent[] {
    if (!sourceAbilityId) return [];
    return [
        bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp),
        ...buildNinjutsuContinueChoiceEvents(state, playerId, sourceAbilityId, timestamp + 2),
    ];
}

function buildNinjutsuContinueChoiceEvents(
    state: CustomActionContext['state'],
    playerId: string,
    sourceAbilityId: string,
    timestamp: number,
): DiceThroneEvent[] {
    const remainingNinjutsu = state.players[playerId]?.tokens[TOKEN_IDS.NINJUTSU] ?? 0;
    const pendingAttack = state.pendingAttack;
    const isAttackAlreadyInDefenseCloseout = pendingAttack?.damageResolved === true || pendingAttack?.defenseResolved === true;
    if (remainingNinjutsu <= 0 || isAttackAlreadyInDefenseCloseout) {
        return [];
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId,
            sourceAbilityId,
            titleKey: 'offensiveRollEndToken.title',
            options: [
                {
                    tokenId: TOKEN_IDS.NINJUTSU,
                    value: 1,
                    customId: 'use-ninjutsu',
                    labelKey: `tokens.${TOKEN_IDS.NINJUTSU}.name`,
                },
                {
                    value: 0,
                    customId: 'skip',
                    labelKey: 'tokenResponse.skip',
                },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as ChoiceRequestedEvent];
}

export function registerNinjaCustomActions(): void {
    registerBonusDiceSettlementHandler(GOING_FORWARD_BLEED_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const totalDamage = getPendingBonusSettlementDice(settlement).reduce((sum, die) => sum + die.value, 0);
        return {
            totalDamage: 0,
            followupEvents: createUnblockableDamageEvents(
                state,
                settlement.attackerId,
                settlement.sourceAbilityId,
                settlement.targetId,
                totalDamage,
                timestamp,
                'attack',
            ),
        };
    });

    registerBonusDiceSettlementHandler(POISON_BLADE_2_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const die = getPendingBonusSettlementDice(settlement)[0];
        if (!die) return { totalDamage: 0 };
        const poisonAmount = die.face === NINJA_DICE_FACE_IDS.KATANA ? 1 : 2;
        const poisonEvent = delayedPoisonEvent(
            state,
            settlement.sourceAbilityId,
            settlement.targetId,
            poisonAmount,
            timestamp,
        );
        return {
            totalDamage: 0,
            followupEvents: poisonEvent ? [poisonEvent] : [],
        };
    });

    registerBonusDiceSettlementHandler(NINJUTSU_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        const dieValue = getPendingBonusSettlementDice(settlement)[0]?.value ?? 0;
        if (dieValue <= 3) {
            return {
                totalDamage: 0,
                followupEvents: [
                    bonusDamageEvent(settlement.attackerId, 1, settlement.sourceAbilityId, timestamp),
                    ...buildNinjutsuContinueChoiceEvents(state, settlement.attackerId, settlement.sourceAbilityId, timestamp + 1),
                ],
            };
        }
        if (dieValue <= 5) {
            return {
                totalDamage: 0,
                followupEvents: [
                    bonusDamageEvent(settlement.attackerId, 2, settlement.sourceAbilityId, timestamp),
                    ...buildNinjutsuContinueChoiceEvents(state, settlement.attackerId, settlement.sourceAbilityId, timestamp + 1),
                ],
            };
        }
        return {
            totalDamage: 0,
            followupEvents: [{
                type: 'CHOICE_REQUESTED',
                payload: {
                    playerId: settlement.attackerId,
                    sourceAbilityId: settlement.sourceAbilityId,
                    titleKey: 'choices.ninjaNinjutsu.title',
                    options: [
                        { value: 1, customId: NINJA_NINJUTSU_BONUS_DAMAGE_CHOICE_ID, labelKey: 'choices.ninjaNinjutsu.bonusDamage' },
                        { value: 1, customId: 'ninja-ninjutsu-poison', labelKey: 'choices.ninjaNinjutsu.poison' },
                        { value: 1, customId: 'ninja-ninjutsu-undefendable', labelKey: 'choices.ninjaNinjutsu.undefendable' },
                    ],
                },
                sourceCommandType: 'BONUS_DICE_SETTLED',
                timestamp,
            } as ChoiceRequestedEvent],
        };
    });

    registerBonusDiceSettlementHandler(GOING_FORWARD_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const totalDamage = getPendingBonusSettlementDice(settlement).reduce((sum, die) => sum + die.value, 0);
        return {
            totalDamage: 0,
            followupEvents: totalDamage > 0
                ? [bonusDamageEvent(settlement.attackerId, totalDamage, settlement.sourceAbilityId, timestamp)]
                : [],
        };
    });

    registerBonusDiceSettlementHandler(DEATH_BLOSSOM_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        let katanaCount = 0;
        let shurikenCount = 0;
        let maskCount = 0;
        for (const die of getPendingBonusSettlementDice(settlement)) {
            if (die.face === NINJA_DICE_FACE_IDS.KATANA) katanaCount += 1;
            if (die.face === NINJA_DICE_FACE_IDS.SHURIKEN) shurikenCount += 1;
            if (die.face === NINJA_DICE_FACE_IDS.MASK) maskCount += 1;
        }
        const followupEvents: DiceThroneEvent[] = [];
        const totalDamage = katanaCount + shurikenCount * 2;
        if (totalDamage > 0) {
            followupEvents.push(bonusDamageEvent(
                settlement.attackerId,
                totalDamage,
                settlement.sourceAbilityId,
                timestamp,
            ));
        }
        if (maskCount > 0) {
            const ninjutsuEvent = grantTokenEvent(state, settlement.sourceAbilityId, settlement.attackerId, TOKEN_IDS.NINJUTSU, maskCount, timestamp + 1);
            if (ninjutsuEvent) followupEvents.push(ninjutsuEvent);
        }
        return {
            totalDamage: 0,
            followupEvents,
        };
    });

    registerBonusDiceSettlementHandler(GOING_FORWARD_2_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const totalDamage = getPendingBonusSettlementDice(settlement).reduce((sum, die) => sum + die.value, 0);
        return {
            totalDamage,
            followupEvents: totalDamage <= 6
                ? [attackMadeUndefendable(settlement.attackerId, timestamp + 1)]
                : [],
        };
    });

    registerBonusDiceSettlementHandler(DEATH_BLOSSOM_2_SETTLEMENT_ID, ({ state, settlement, timestamp }) => {
        let katanaCount = 0;
        let shurikenCount = 0;
        let maskCount = 0;
        for (const die of getPendingBonusSettlementDice(settlement)) {
            if (die.face === NINJA_DICE_FACE_IDS.KATANA) katanaCount += 1;
            if (die.face === NINJA_DICE_FACE_IDS.SHURIKEN) shurikenCount += 1;
            if (die.face === NINJA_DICE_FACE_IDS.MASK) maskCount += 1;
        }
        const followupEvents: DiceThroneEvent[] = [];

        if (maskCount >= 1) {
            followupEvents.push(attackMadeUndefendable(settlement.attackerId, timestamp + 1));
        }
        if (maskCount >= 2) {
            const poisonEvent = delayedPoisonEvent(state, settlement.sourceAbilityId, settlement.targetId, 1, timestamp + 2);
            if (poisonEvent) followupEvents.push(poisonEvent);
        }

        return {
            totalDamage: katanaCount + shurikenCount * 2,
            followupEvents,
        };
    });

    registerCustomActionHandler('ninja-blink', handleBlinkBase, { categories: ['dice', 'damage', 'defense', 'token'] });
    registerCustomActionHandler('ninja-blink-2', handleBlink2, { categories: ['dice', 'damage', 'defense', 'token'] });
    registerCustomActionHandler('ninja-slash-2-bonus', handleSlash2Bonus, { categories: ['token'], usesAttackDiceSnapshot: true });
    registerCustomActionHandler('ninja-going-forward', handleGoingForward, {
        categories: ['dice', 'damage'],
        requiresSelectedDefender: true,
        estimateDamage: () => 2,
    });
    registerCustomActionHandler('ninja-going-forward-2', handleGoingForward2, {
        categories: ['dice', 'damage'],
        requiresSelectedDefender: true,
        estimateDamage: () => 2,
    });
    registerCustomActionHandler('ninja-going-forward-bleed', handleGoingForwardBleed, {
        categories: ['dice', 'damage'],
        requiresSelectedDefender: true,
        estimateDamage: () => 1,
    });
    registerCustomActionHandler('ninja-poison-blade-2', handlePoisonBlade2, {
        categories: ['dice', 'token'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('ninja-death-blossom', handleDeathBlossom, {
        categories: ['dice', 'damage', 'token'],
        requiresSelectedDefender: true,
        estimateDamage: () => 1,
    });
    registerCustomActionHandler('ninja-death-blossom-2', handleDeathBlossom2, {
        categories: ['dice', 'damage', 'token'],
        requiresSelectedDefender: true,
        estimateDamage: () => 1,
    });
    registerCustomActionHandler('ninja-nonattack-closeout', handleNonAttackCloseout, { categories: ['other'] });
    registerCustomActionHandler('ninja-smoke-screen-2', handleSmokeScreen2, {
        categories: ['choice', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('ninja-smoke-screen-kuji-kiri', handleSmokeScreenKujiKiri, {
        categories: ['choice', 'damage'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('ninja-ninjutsu-use', handleNinjutsuOffensiveRollEndUse, { categories: ['dice', 'damage', 'token', 'choice'], requiresInteraction: true });

    registerChoiceResolvedEventHandler('ninja-ninjutsu-poison', ({ state, playerId, sourceAbilityId, timestamp }) => {
        if (!sourceAbilityId) return [];
        const targetId = state.pendingAttack?.defenderId;
        if (!targetId) return [bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp)];
        const poisonEvent = delayedPoisonEvent(state, sourceAbilityId, targetId, 1, timestamp + 1);
        return [
            bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp),
            ...(poisonEvent ? [poisonEvent] : []),
            ...buildNinjutsuContinueChoiceEvents(state, playerId, sourceAbilityId, timestamp + 2),
        ];
    });

    registerChoiceResolvedEventHandler(NINJA_NINJUTSU_BONUS_DAMAGE_CHOICE_ID, ({ state, playerId, sourceAbilityId, timestamp }) => (
        buildNinjutsuBonusDamageChoiceEvents(state, playerId, sourceAbilityId, timestamp)
    ));

    registerChoiceResolvedEventHandler('ninja-ninjutsu-undefendable', ({ state, playerId, sourceAbilityId, timestamp }) => {
        if (!sourceAbilityId) return [];
        return [
            bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp),
            {
                type: 'ATTACK_MADE_UNDEFENDABLE',
                payload: { attackerId: state.pendingAttack?.attackerId ?? playerId, tokenId: TOKEN_IDS.NINJUTSU },
                sourceCommandType: 'ABILITY_EFFECT',
                timestamp: timestamp + 1,
            } as AttackMadeUndefendableEvent,
            ...buildNinjutsuContinueChoiceEvents(state, playerId, sourceAbilityId, timestamp + 2),
        ];
    });

    registerChoiceResolvedEventHandler('use-ninjutsu', ({ state, playerId, sourceAbilityId, timestamp, random }) => (
        handleNinjutsuUse({
            ctx: {
                attackerId: playerId,
                defenderId: state.pendingAttack?.defenderId ?? playerId,
                sourceAbilityId: sourceAbilityId ?? state.pendingAttack?.sourceAbilityId ?? 'token-use',
                state,
                damageDealt: 0,
                timestamp,
            },
            targetId: state.pendingAttack?.defenderId ?? playerId,
            attackerId: playerId,
            sourceAbilityId: sourceAbilityId ?? state.pendingAttack?.sourceAbilityId ?? 'token-use',
            state,
            timestamp,
            random,
            action: { type: 'custom', target: 'self', customActionId: 'ninja-ninjutsu-use' },
        })
    ));

    registerChoiceResolvedEventHandler(NINJA_SMOKE_SCREEN_2_CHOICE_ID, ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        if (!isExpectedChoiceSource(sourceAbilityId, SMOKE_SCREEN_2_MAIN_SOURCE_IDS)) return [];

        const playerIds = getSeatingOrder(state);
        const opponentIds = getOpponents(state, playerId);
        const { playerIndex, opponentIndex } = decodePlayerOpponentChoice(value);
        const targetPlayerId = playerIds[playerIndex];
        const targetOpponentId = opponentIds[opponentIndex];
        if (!targetPlayerId || !targetOpponentId || !sourceAbilityId) return [];

        const smokeEvent = grantTokenEvent(state, sourceAbilityId, targetPlayerId, TOKEN_IDS.SMOKE_BOMB, 1, timestamp);
        const ninjutsuEvent = grantTokenEvent(state, sourceAbilityId, targetPlayerId, TOKEN_IDS.NINJUTSU, 3, timestamp + 1);
        const poisonEvent = delayedPoisonEvent(state, sourceAbilityId, targetOpponentId, 1, timestamp + 2);
        return [
            ...(smokeEvent ? [smokeEvent] : []),
            ...(ninjutsuEvent ? [ninjutsuEvent] : []),
            ...(poisonEvent ? [poisonEvent] : []),
            closeoutNonAttackVariant(playerId, timestamp + 3),
        ];
    });

    registerChoiceResolvedEventHandler(NINJA_SMOKE_SCREEN_KUJI_KIRI_CHOICE_ID, ({ state, playerId, sourceAbilityId, value, timestamp }) => {
        if (!isExpectedChoiceSource(sourceAbilityId, SMOKE_SCREEN_2_KUJI_KIRI_SOURCE_IDS) || !sourceAbilityId) return [];

        const opponentIds = getOpponents(state, playerId);
        const { firstIndex, secondIndex } = decodeOpponentPairChoice(value);
        const firstTargetId = opponentIds[firstIndex];
        const secondTargetId = opponentIds[secondIndex];
        if (!firstTargetId || !secondTargetId) return [];

        const firstDamageEvents = createUnblockableDamageEvents(state, playerId, sourceAbilityId, firstTargetId, 4, timestamp);
        const firstDamageEvent = firstDamageEvents.find((event): event is DamageDealtEvent => event.type === 'DAMAGE_DEALT');
        const stateAfterFirstDamage = applyEvents(state, firstDamageEvents, reduce);
        const secondDamageEvents = createUnblockableDamageEvents(stateAfterFirstDamage, playerId, sourceAbilityId, secondTargetId, 4, timestamp + 1);
        const secondDamageEvent = secondDamageEvents.find((event): event is DamageDealtEvent => event.type === 'DAMAGE_DEALT');
        const firstResponseEvent = firstDamageEvent
            ? maybeCreateDamageResponseEvent({
                state,
                damageEvent: firstDamageEvent,
                attackerId: playerId,
                sourceAbilityId,
                timestamp,
                allowAttackerBoost: false,
            })
            : null;
        if (firstResponseEvent && secondDamageEvent) {
            firstResponseEvent.payload.pendingDamage.deferredDamageEvents = [
                {
                    targetId: secondDamageEvent.payload.targetId,
                    amount: secondDamageEvent.payload.amount,
                    actualDamage: secondDamageEvent.payload.actualDamage,
                    sourceAbilityId: secondDamageEvent.payload.sourceAbilityId,
                    sourcePlayerId: secondDamageEvent.payload.sourcePlayerId,
                    damageScope: secondDamageEvent.payload.damageScope,
                    unblockable: secondDamageEvent.payload.unblockable,
                    sourceCommandType: secondDamageEvent.sourceCommandType,
                },
            ];
            return [
                firstResponseEvent,
                closeoutNonAttackVariant(playerId, timestamp + 2),
            ];
        }
        const secondResponseEvent = secondDamageEvent
            ? maybeCreateDamageResponseEvent({
                state: stateAfterFirstDamage,
                damageEvent: secondDamageEvent,
                attackerId: playerId,
                sourceAbilityId,
                timestamp: timestamp + 1,
                allowAttackerBoost: false,
            })
            : null;
        if (secondResponseEvent) {
            return [
                ...firstDamageEvents,
                secondResponseEvent,
                closeoutNonAttackVariant(playerId, timestamp + 2),
            ];
        }
        return [
            ...firstDamageEvents,
            ...secondDamageEvents,
            closeoutNonAttackVariant(playerId, timestamp + 2),
        ];
    });
}
