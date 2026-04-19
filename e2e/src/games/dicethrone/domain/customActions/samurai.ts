import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import type {
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    DamageDealtEvent,
    DamageShieldGrantedEvent,
    DiceThroneEvent,
    InteractionRequestedEvent,
    TokenGrantedEvent,
} from '../events';
import { SAMURAI_DICE_FACE_IDS, TOKEN_IDS } from '../ids';
import { getActiveDice, getFaceCounts, getOpponents, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import type { PendingInteraction } from '../core-types';

const FACE = SAMURAI_DICE_FACE_IDS;

function createGrantTokenEvent(
    state: CustomActionContext['state'],
    targetId: string,
    tokenId: string,
    amount: number,
    sourceAbilityId: string,
    timestamp: number,
): TokenGrantedEvent | null {
    if (amount <= 0) return null;

    const current = state.players[targetId]?.tokens[tokenId] ?? 0;
    const limit = getTokenStackLimit(state, targetId, tokenId);
    const newTotal = Math.min(current + amount, limit);
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

function createSingleOpponentInteraction(
    state: CustomActionContext['state'],
    attackerId: string,
    sourceAbilityId: string,
    timestamp: number,
    resolveCustomActionId: string,
): InteractionRequestedEvent | null {
    const opponentIds = getOpponents(state, attackerId);
    if (opponentIds.length <= 1) {
        return null;
    }

    const interaction: PendingInteraction = {
        id: `${sourceAbilityId}-${timestamp}`,
        playerId: attackerId,
        sourceCardId: sourceAbilityId,
        type: 'selectPlayer',
        titleKey: 'interaction.selectPlayer',
        selectCount: 1,
        selected: [],
        targetPlayerIds: opponentIds,
        resolveCustomActionId,
    };

    return {
        type: 'INTERACTION_REQUESTED',
        payload: { interaction },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as InteractionRequestedEvent;
}

function getMaxDuplicateValueCount(state: CustomActionContext['state']): number {
    const counts = new Map<number, number>();
    for (const die of getActiveDice(state)) {
        counts.set(die.value, (counts.get(die.value) ?? 0) + 1);
    }
    return Math.max(0, ...counts.values());
}

function handleBackStrikeUse({ ctx, state, random, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const ownerId = ctx.defenderId;
    const originalAttackerId = ctx.attackerId;
    if (!ownerId || !originalAttackerId) return [];

    const roll = random.d(6);
    const face = getPlayerDieFace(state, ownerId, roll) ?? FACE.KATANA;
    const damage = Math.ceil(roll / 2);

    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: roll,
            face,
            playerId: ownerId,
            targetPlayerId: originalAttackerId,
            effectKey: 'bonusDie.effect.samuraiBackStrikeDie',
            effectParams: { value: roll, damage },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];

    const damageCalc = createDamageCalculation({
        source: { playerId: ownerId, abilityId: 'samurai-back-strike-reflect' },
        target: { playerId: originalAttackerId },
        baseDamage: damage,
        state,
        timestamp: timestamp + 1,
    });
    events.push(...damageCalc.toEvents());
    return events;
}

function handleStandTall({ targetId, ctx, sourceAbilityId, state, timestamp }: CustomActionContext, suppressSelfShame: boolean): DiceThroneEvent[] {
    // defensiveRoll 会把“当前执行防御技的玩家”放到 ctx.attackerId，
    // 因此这里要从 ctx.defenderId 取回原始进攻方。
    const originalAttackerId = ctx.defenderId;
    const faceCounts = getFaceCounts(getActiveDice(state));
    const katanaCount = faceCounts[FACE.KATANA] ?? 0;
    const helmCount = faceCounts[FACE.HELM] ?? 0;
    const risingSunCount = faceCounts[FACE.RISING_SUN] ?? 0;
    const events: DiceThroneEvent[] = [];

    if (katanaCount > 0 && originalAttackerId) {
        const damageCalc = createDamageCalculation({
            source: { playerId: targetId, abilityId: sourceAbilityId },
            target: { playerId: originalAttackerId },
            baseDamage: katanaCount,
            state,
            timestamp: timestamp + 10,
        });
        const damageEvents = damageCalc.toEvents();
        damageEvents.forEach((event) => {
            if (event.type === 'DAMAGE_DEALT') {
                (event as DamageDealtEvent).payload.unblockable = true;
            }
        });
        events.push(...damageEvents);
    }

    const preventAmount = helmCount + (risingSunCount * 2);
    if (preventAmount > 0) {
        events.push({
            type: 'DAMAGE_SHIELD_GRANTED',
            payload: {
                targetId,
                value: preventAmount,
                sourceId: sourceAbilityId,
                preventStatus: false,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 20,
        } as DamageShieldGrantedEvent);
    }

    if (!suppressSelfShame && helmCount === 0 && risingSunCount === 0) {
        const shameEvent = createGrantTokenEvent(state, targetId, TOKEN_IDS.SHAME, 1, sourceAbilityId, timestamp + 30);
        if (shameEvent) {
            events.push(shameEvent);
        }
    }

    return events;
}

function handleStandTallBase(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleStandTall(ctx, false);
}

function handleStandTall2(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleStandTall(ctx, true);
}

function handleKatanaSliceThreshold(
    { ctx, sourceAbilityId, state, timestamp }: CustomActionContext,
    threshold: number,
): DiceThroneEvent[] {
    const defenderId = ctx.defenderId;
    if (!defenderId) return [];
    if (getMaxDuplicateValueCount(state) < threshold) return [];

    const shameEvent = createGrantTokenEvent(state, defenderId, TOKEN_IDS.SHAME, 1, sourceAbilityId, timestamp);
    return shameEvent ? [shameEvent] : [];
}

function handleKatanaSliceThreshold4(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleKatanaSliceThreshold(ctx, 4);
}

function handleKatanaSliceThreshold3(ctx: CustomActionContext): DiceThroneEvent[] {
    return handleKatanaSliceThreshold(ctx, 3);
}

function handleBushidoStartTurn({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    if (state.turnNumber !== 1 || attackerId !== state.startingPlayerId) {
        return [];
    }

    const honorEvent = createGrantTokenEvent(state, attackerId, TOKEN_IDS.HONOR, 1, sourceAbilityId, timestamp);
    return honorEvent ? [honorEvent] : [];
}

function handleBushidoEndTurn({ attackerId, sourceAbilityId, state, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const offensiveRollCount = state.offensiveRollAttemptsThisTurn ?? 0;
    if (offensiveRollCount >= 3) {
        return [];
    }

    const honorEvent = createGrantTokenEvent(state, attackerId, TOKEN_IDS.HONOR, 1, sourceAbilityId, timestamp);
    return honorEvent ? [honorEvent] : [];
}

function handleMasamune({ attackerId, ctx, sourceAbilityId, state, timestamp, random, action }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const defenderId = ctx.defenderId;
    if (!defenderId) return [];

    const params = action.params as { diceCount?: number } | undefined;
    const diceCount = Number.isInteger(params?.diceCount) && (params?.diceCount ?? 0) > 0
        ? (params?.diceCount as number)
        : 5;

    const dice = Array.from({ length: diceCount }, (_, index) => {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? FACE.KATANA;
        return { index, value, face };
    });

    const events: DiceThroneEvent[] = dice.map((die, index) => ({
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value: die.value,
            face: die.face,
            playerId: attackerId,
            targetPlayerId: defenderId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: timestamp + index,
    } as BonusDieRolledEvent));

    const katanaCount = dice.filter(die => die.face === FACE.KATANA).length;
    const shameCount = dice.filter(die => die.face === FACE.HELM).length;
    const retributionCount = dice.filter(die => die.face === FACE.RISING_SUN).length;

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        defenderId,
        dice,
        timestamp + 10,
        {
            summaryEffectKey: 'bonusDie.effect.samuraiMasamune.result',
            summaryEffectParams: {
                katanaCount,
                shameCount,
                retributionCount,
            },
        },
    ));

    if (katanaCount > 0) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: attackerId,
                amount: katanaCount,
                // 只有攻击修正卡牌才应计入 attackModifierBonusDamage。
                // - `card-zanshin`：攻击修正卡，应该显示在“攻击修正”徽章/汇总里。
                // - `masamune` / `masamune-2-*`：角色技能本体，不应被误归类为“攻击修正卡加伤”。
                sourceCardId: sourceAbilityId.startsWith('card-') ? sourceAbilityId : undefined,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 11,
        } as BonusDamageAddedEvent);
    }

    const shameEvent = createGrantTokenEvent(state, defenderId, TOKEN_IDS.SHAME, shameCount, sourceAbilityId, timestamp + 12);
    if (shameEvent) {
        events.push(shameEvent);
    }

    const retributionEvent = createGrantTokenEvent(state, attackerId, TOKEN_IDS.SAMURAI_RETRIBUTION, retributionCount, sourceAbilityId, timestamp + 13);
    if (retributionEvent) {
        events.push(retributionEvent);
    }

    return events;
}

function handleRighteousness({ attackerId, ctx, sourceAbilityId, state, timestamp, random }: CustomActionContext): DiceThroneEvent[] {
    if (!random) return [];

    const defenderId = ctx.defenderId;
    if (!defenderId) return [];

    const value = random.d(6);
    const face = getPlayerDieFace(state, attackerId, value) ?? FACE.KATANA;
    const effectKeyMap: Record<string, string> = {
        [FACE.KATANA]: 'bonusDie.effect.samuraiRighteousnessKatana',
        [FACE.HELM]: 'bonusDie.effect.samuraiRighteousnessHelm',
        [FACE.RISING_SUN]: 'bonusDie.effect.samuraiRighteousnessRisingSun',
    };

    const events: DiceThroneEvent[] = [{
        type: 'BONUS_DIE_ROLLED',
        payload: {
            value,
            face,
            playerId: attackerId,
            targetPlayerId: defenderId,
            effectKey: effectKeyMap[face] ?? 'bonusDie.effect.default',
            effectParams: { value },
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDieRolledEvent];

    events.push(createDisplayOnlySettlement(
        sourceAbilityId,
        attackerId,
        defenderId,
        [{ index: 0, value, face, effectKey: effectKeyMap[face] ?? 'bonusDie.effect.default' }],
        timestamp + 1,
    ));

    if (face === FACE.KATANA) {
        events.push({
            type: 'BONUS_DAMAGE_ADDED',
            payload: {
                playerId: attackerId,
                amount: 2,
                sourceCardId: sourceAbilityId,
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + 2,
        } as BonusDamageAddedEvent);
        return events;
    }

    if (face === FACE.HELM) {
        const shameEvent = createGrantTokenEvent(state, defenderId, TOKEN_IDS.SHAME, 2, sourceAbilityId, timestamp + 2);
        if (shameEvent) {
            events.push(shameEvent);
        }
        return events;
    }

    const retributionEvent = createGrantTokenEvent(
        state,
        attackerId,
        TOKEN_IDS.SAMURAI_RETRIBUTION,
        1,
        sourceAbilityId,
        timestamp + 2,
    );
    if (retributionEvent) {
        events.push(retributionEvent);
    }

    return events;
}

function handleYouShouldBeAshamed(ctx: CustomActionContext): DiceThroneEvent[] {
    const interactionEvent = createSingleOpponentInteraction(
        ctx.state,
        ctx.attackerId,
        ctx.sourceAbilityId,
        ctx.timestamp,
        'samurai-card-you-should-be-ashamed-resolve',
    );
    if (interactionEvent) {
        return [interactionEvent];
    }

    const targetId = getOpponents(ctx.state, ctx.attackerId)[0];
    if (!targetId) {
        return [];
    }
    const shameEvent = createGrantTokenEvent(ctx.state, targetId, TOKEN_IDS.SHAME, 2, ctx.sourceAbilityId, ctx.timestamp);
    return shameEvent ? [shameEvent] : [];
}

function handleYouShouldBeAshamedResolve({ targetId, state, sourceAbilityId, timestamp }: CustomActionContext): DiceThroneEvent[] {
    const shameEvent = createGrantTokenEvent(state, targetId, TOKEN_IDS.SHAME, 2, sourceAbilityId, timestamp);
    return shameEvent ? [shameEvent] : [];
}

export function registerSamuraiCustomActions(): void {
    registerCustomActionHandler('samurai-bushido-start-turn', handleBushidoStartTurn, {
        categories: ['passive', 'token'],
    });
    registerCustomActionHandler('samurai-bushido-end-turn', handleBushidoEndTurn, {
        categories: ['passive', 'token'],
    });
    registerCustomActionHandler('samurai-back-strike-use', handleBackStrikeUse, {
        categories: ['token', 'damage', 'dice', 'defense'],
    });
    registerCustomActionHandler('samurai-stand-tall', handleStandTallBase, {
        categories: ['defense', 'token', 'damage'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('samurai-stand-tall-2', handleStandTall2, {
        categories: ['defense', 'token', 'damage'],
        phases: ['defensiveRoll'],
    });
    registerCustomActionHandler('samurai-katana-slice-threshold-4', handleKatanaSliceThreshold4, {
        categories: ['status', 'dice', 'token'],
    });
    registerCustomActionHandler('samurai-katana-slice-threshold-3', handleKatanaSliceThreshold3, {
        categories: ['status', 'dice', 'token'],
    });
    registerCustomActionHandler('samurai-masamune', handleMasamune, {
        categories: ['dice', 'token', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('samurai-card-righteousness', handleRighteousness, {
        categories: ['card', 'dice', 'token', 'status'],
        requiresSelectedDefender: true,
    });
    registerCustomActionHandler('samurai-card-you-should-be-ashamed', handleYouShouldBeAshamed, {
        categories: ['card', 'token'],
        requiresInteraction: true,
    });
    registerCustomActionHandler('samurai-card-you-should-be-ashamed-resolve', handleYouShouldBeAshamedResolve, {
        categories: ['card', 'token'],
    });
}
