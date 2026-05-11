import { createDisplayOnlySettlement, registerCustomActionHandler, type CustomActionContext } from '../effects';
import { registerChoiceResolvedEventHandler } from '../choiceResolvedEvents';
import { TOKEN_IDS } from '../ids';
import { getPlayerDieFace } from '../rules';
import type {
    AttackMadeUndefendableEvent,
    BonusDamageAddedEvent,
    BonusDieRolledEvent,
    ChoiceRequestedEvent,
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
