import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { NINJA_DICE_FACE_IDS, TOKEN_IDS } from '../ids';
import { getActiveDice, getFaceCounts, getPlayerDieFace, getTokenStackLimit } from '../rules';
import { createDamageCalculation } from '../../../../engine/primitives/damageCalculation';
import type {
    AttackMadeUndefendableEvent,
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    ChoiceRequestedEvent,
    DamageDealtEvent,
    DiceThroneEvent,
    TokenGrantedEvent,
} from '../events';

function bonusDamageEvent(playerId: string, amount: number, sourceAbilityId: string, timestamp: number): BonusDamageAddedEvent {
    return {
        type: 'BONUS_DAMAGE_ADDED',
        payload: { playerId, amount, sourceCardId: sourceAbilityId },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as BonusDamageAddedEvent;
}

function delayedPoisonEvent(ctx: CustomActionContext, targetId: string, timestamp: number): TokenGrantedEvent {
    const current = ctx.state.players[targetId]?.tokens[TOKEN_IDS.DELAYED_POISON]
        ?? ctx.state.players[targetId]?.statusEffects[TOKEN_IDS.DELAYED_POISON]
        ?? 0;
    const maxStacks = ctx.state.tokenDefinitions.find(def => def.id === TOKEN_IDS.DELAYED_POISON)?.stackLimit ?? 2;
    return {
        type: 'TOKEN_GRANTED',
        payload: {
            targetId,
            tokenId: TOKEN_IDS.DELAYED_POISON,
            amount: 1,
            newTotal: Math.min(current + 1, maxStacks),
            sourceAbilityId: ctx.sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent;
}

function grantTokenEvent(
    ctx: CustomActionContext,
    targetId: string,
    tokenId: string,
    amount: number,
    timestamp: number,
): TokenGrantedEvent | null {
    if (amount <= 0) return null;

    const current = ctx.state.players[targetId]?.tokens[tokenId]
        ?? ctx.state.players[targetId]?.statusEffects[tokenId]
        ?? 0;
    const maxStacks = getTokenStackLimit(ctx.state, targetId, tokenId);
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
            sourceAbilityId: ctx.sourceAbilityId,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp,
    } as TokenGrantedEvent;
}

function createBlinkDamageEvents(
    ctx: CustomActionContext,
    targetId: string,
    amount: number,
    timestamp: number,
): DiceThroneEvent[] {
    if (amount <= 0) return [];

    const damageCalc = createDamageCalculation({
        source: { playerId: ctx.targetId, abilityId: ctx.sourceAbilityId },
        target: { playerId: targetId },
        baseDamage: amount,
        state: ctx.state,
        timestamp,
    });
    const damageEvents = damageCalc.toEvents();
    damageEvents.forEach((event) => {
        if (event.type === 'DAMAGE_DEALT') {
            (event as DamageDealtEvent).payload.unblockable = true;
        }
    });
    return damageEvents;
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
        const smokeEvent = grantTokenEvent(ctx, ctx.targetId, TOKEN_IDS.SMOKE_BOMB, 1, ctx.timestamp + 20);
        if (smokeEvent) {
            events.push(smokeEvent);
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
        const smokeEvent = grantTokenEvent(ctx, ctx.targetId, TOKEN_IDS.SMOKE_BOMB, 1, ctx.timestamp + 20);
        if (smokeEvent) {
            events.push(smokeEvent);
        }
    }

    return events;
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
    registerCustomActionHandler('ninja-blink', handleBlinkBase, { categories: ['dice', 'damage', 'defense', 'token'] });
    registerCustomActionHandler('ninja-blink-2', handleBlink2, { categories: ['dice', 'damage', 'defense', 'token'] });
    registerCustomActionHandler('ninja-ninjutsu-use', handleNinjutsuUse, { categories: ['dice', 'damage', 'token', 'choice'], requiresInteraction: true });

    registerChoiceResolvedEventHandler('ninja-ninjutsu-poison', ({ state, playerId, sourceAbilityId, timestamp }) => {
        if (!sourceAbilityId) return [];
        const targetId = state.pendingAttack?.defenderId;
        if (!targetId) return [bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp)];
        const ctx: CustomActionContext = {
            ctx: { attackerId: playerId, defenderId: targetId, sourceAbilityId, state, damageDealt: 0, timestamp },
            targetId,
            attackerId: playerId,
            sourceAbilityId,
            state,
            timestamp,
            action: { type: 'custom', target: 'opponent', customActionId: 'ninja-ninjutsu-use' },
        };
        return [bonusDamageEvent(playerId, 2, sourceAbilityId, timestamp), delayedPoisonEvent(ctx, targetId, timestamp + 1)];
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
}
