import { createBonusDiceWithReroll, createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../ids';
import { getActiveDice, getAttackMaxDuplicateValueCount, getFaceCounts, getOpponents, getPlayerDieFace, getSeatingOrder, getTokenStackLimit } from '../rules';
import { reduce } from '../reducer';
import { applyEvents } from '../utils';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
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

const GOING_FORWARD_2_SETTLEMENT_ID = 'ninja-going-forward-2';
const DEATH_BLOSSOM_2_SETTLEMENT_ID = 'ninja-death-blossom-2';
const NINJA_SMOKE_SCREEN_2_CHOICE_ID = 'ninja-smoke-screen-2-choice';
const NINJA_SMOKE_SCREEN_KUJI_KIRI_CHOICE_ID = 'ninja-smoke-screen-kuji-kiri-choice';

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
    const damageEvents = damageCalc.toEvents();
    damageEvents.forEach((event) => {
        if (event.type === 'DAMAGE_DEALT') {
            const payload = (event as DamageDealtEvent).payload;
            payload.unblockable = true;
            payload.damageScope = damageScope;
        }
    });
    return damageEvents;
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
    face: string,
    effectKey: string,
    timestamp: number,
    effectParams?: Record<string, string | number>,
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
                }
                : undefined,
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

    if (maskCount > 0) {
        const smokeEvent = grantTokenEvent(ctx.state, ctx.sourceAbilityId, ctx.targetId, TOKEN_IDS.SMOKE_BOMB, 1, ctx.timestamp + 20);
        if (smokeEvent) events.push(smokeEvent);
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
        if (smokeEvent) events.push(smokeEvent);
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

    const dice = [];
    const events: DiceThroneEvent[] = [];
    let totalDamage = 0;

    for (let index = 0; index < 2; index += 1) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        totalDamage += value;
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
        summaryEffectParams: { totalDamage },
    }));
    events.push(bonusDamageEvent(attackerId, totalDamage, sourceAbilityId, timestamp + 3));
    return events;
}

function handleGoingForwardBleed(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const events = buildDisplayOnlySingleDie(
        sourceAbilityId,
        attackerId,
        targetId,
        value,
        face,
        'bonusDie.effect.ninjaGoingForwardBleed',
        timestamp,
        { value, damage: value },
    );
    events.push(...createUnblockableDamageEvents(state, attackerId, sourceAbilityId, targetId, value, timestamp + 2));
    events.push(closeoutNonAttackVariant(attackerId, timestamp + 3));
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
        },
        () => [],
    );
}

function handlePoisonBlade2(ctx: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, targetId, state, timestamp, random } = ctx;
    if (!random) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
    const poisonAmount = face === NINJA_DICE_FACE_IDS.KATANA ? 1 : 2;
    const events = buildDisplayOnlySingleDie(
        sourceAbilityId,
        attackerId,
        targetId,
        value,
        face,
        'bonusDie.effect.ninjaPoisonBlade2',
        timestamp,
        { value, poisonAmount },
    );
    const poisonEvent = delayedPoisonEvent(state, sourceAbilityId, targetId, poisonAmount, timestamp + 2);
    if (poisonEvent) events.push(poisonEvent);
    return events;
}

function handleDeathBlossom2(ctx: CustomActionContext): DiceThroneEvent[] {
    return createBonusDiceWithReroll(
        ctx,
        {
            diceCount: 5,
            rerollCostTokenId: TOKEN_IDS.NINJUTSU,
            rerollCostAmount: 0,
            maxRerollCount: 2,
            dieEffectKey: 'bonusDie.effect.ninjaDeathBlossom2',
            rerollEffectKey: 'bonusDie.effect.ninjaDeathBlossom2Reroll',
            resolutionMode: 'attackBonus',
            customResolutionId: DEATH_BLOSSOM_2_SETTLEMENT_ID,
            effectParamsBuilder: ({ value, index, face }) => ({ value, index, face }),
        },
        () => [],
    );
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
        labelKey: `令${Number(playerId) + 1}号玩家获得烟雾弹与3忍术；对${Number(opponentId) + 1}号玩家施加慢性中毒`,
    })));

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: '选择烟雾阵 II 的目标',
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
                    ? `对${Number(firstOpponentId) + 1}号玩家造成两次 4 点真实伤害`
                    : `对${Number(firstOpponentId) + 1}号与${Number(secondOpponentId) + 1}号玩家各造成 4 点真实伤害`,
            });
        }
    }

    return [{
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: ctx.attackerId,
            sourceAbilityId: ctx.sourceAbilityId,
            titleKey: '选择九字切的目标',
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
    const face = getPlayerDieFace(state, attackerId, value) ?? '';
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

    if (value <= 3) {
        events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, [{ index: 0, value, face, effectKey: 'bonusDie.effect.ninjaNinjutsu', effectParams: { value, bonusDamage: 1 } }], timestamp + 1, {
            summaryEffectKey: 'bonusDie.effect.ninjaNinjutsuResult',
            summaryEffectParams: { value, bonusDamage: 1 },
        }));
        events.push(bonusDamageEvent(attackerId, 1, sourceAbilityId, timestamp + 2));
        return events;
    }

    if (value <= 5) {
        events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, targetId, [{ index: 0, value, face, effectKey: 'bonusDie.effect.ninjaNinjutsu', effectParams: { value, bonusDamage: 2 } }], timestamp + 1, {
            summaryEffectKey: 'bonusDie.effect.ninjaNinjutsuResult',
            summaryEffectParams: { value, bonusDamage: 2 },
        }));
        events.push(bonusDamageEvent(attackerId, 2, sourceAbilityId, timestamp + 2));
        return events;
    }

    events.push({
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: attackerId,
            sourceAbilityId,
            titleKey: 'choices.ninjaNinjutsu.title',
            options: [
                { value: 1, customId: 'ninja-ninjutsu-poison', labelKey: 'choices.ninjaNinjutsu.poison' },
                { value: 1, customId: 'ninja-ninjutsu-undefendable', labelKey: 'choices.ninjaNinjutsu.undefendable' },
            ],
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + 1,
    } as ChoiceRequestedEvent);

    return events;
}

export function registerNinjaCustomActions(): void {
    registerBonusDiceSettlementHandler(GOING_FORWARD_2_SETTLEMENT_ID, ({ settlement, timestamp }) => {
        const totalDamage = settlement.dice.reduce((sum, die) => sum + die.value, 0);
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
        for (const die of settlement.dice) {
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
    registerCustomActionHandler('ninja-ninjutsu-use', handleNinjutsuUse, { categories: ['dice', 'damage', 'token', 'choice'], requiresInteraction: true });

    registerChoiceResolvedEventHandler('ninja-ninjutsu-poison', ({ state, playerId, sourceAbilityId, timestamp }) => {
        if (!sourceAbilityId) return [];
        const targetId = state.pendingAttack?.defenderId;
        if (!targetId) return [bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp)];
        const poisonEvent = delayedPoisonEvent(state, sourceAbilityId, targetId, 1, timestamp + 1);
        return [
            bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp),
            ...(poisonEvent ? [poisonEvent] : []),
        ];
    });

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
        ];
    });

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
        const stateAfterFirstDamage = applyEvents(state, firstDamageEvents, reduce);
        const secondDamageEvents = createUnblockableDamageEvents(stateAfterFirstDamage, playerId, sourceAbilityId, secondTargetId, 4, timestamp + 1);
        return [
            ...firstDamageEvents,
            ...secondDamageEvents,
            closeoutNonAttackVariant(playerId, timestamp + 2),
        ];
    });
}
