/**
 * DiceThrone 攻击结算（事件驱动）
 * 仅生成事件，不直接修改状态
 */

import type {
    DiceThroneCore,
    DiceThroneEvent,
    AttackResolvedEvent,
    ChoiceRequestedEvent,
    AttackPreDefenseResolvedEvent,
} from './types';
import { getAbilityEffects, resolveEffectsToEvents, type EffectContext } from './effects';

const now = () => Date.now();

const createChoiceEvent = (
    playerId: string,
    sourceAbilityId: string
): ChoiceRequestedEvent => ({
    type: 'CHOICE_REQUESTED',
    payload: {
        playerId,
        sourceAbilityId,
        titleKey: 'choices.evasiveOrPurify',
        options: [
            { statusId: 'evasive', value: 1 },
            { statusId: 'purify', value: 1 },
        ],
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp: now(),
});

const createPreDefenseResolvedEvent = (
    attackerId: string,
    defenderId: string,
    sourceAbilityId?: string
): AttackPreDefenseResolvedEvent => ({
    type: 'ATTACK_PRE_DEFENSE_RESOLVED',
    payload: {
        attackerId,
        defenderId,
        sourceAbilityId,
    },
    sourceCommandType: 'ABILITY_EFFECT',
    timestamp: now(),
});

export const resolveOffensivePreDefenseEffects = (state: DiceThroneCore): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending || pending.preDefenseResolved) return [];

    const { attackerId, defenderId, sourceAbilityId } = pending;
    if (!sourceAbilityId) {
        return [createPreDefenseResolvedEvent(attackerId, defenderId)];
    }

    const effects = getAbilityEffects(sourceAbilityId);
    const ctx: EffectContext = {
        attackerId,
        defenderId,
        sourceAbilityId,
        state,
        damageDealt: 0,
    };

    const events: DiceThroneEvent[] = [];
    events.push(...resolveEffectsToEvents(effects, 'preDefense', ctx));

    if (sourceAbilityId === 'zen-forget') {
        events.push(createChoiceEvent(attackerId, sourceAbilityId));
    }

    events.push(createPreDefenseResolvedEvent(attackerId, defenderId, sourceAbilityId));
    return events;
};

export const resolveAttack = (
    state: DiceThroneCore,
    options?: { includePreDefense?: boolean }
): DiceThroneEvent[] => {
    const pending = state.pendingAttack;
    if (!pending) return [];

    const events: DiceThroneEvent[] = [];
    if (options?.includePreDefense) {
        const preDefenseEvents = resolveOffensivePreDefenseEffects(state);
        events.push(...preDefenseEvents);

        const hasChoice = preDefenseEvents.some((event) => event.type === 'CHOICE_REQUESTED');
        if (hasChoice) return events;
    }

    const { attackerId, defenderId, sourceAbilityId, defenseAbilityId } = pending;
    const bonusDamage = pending.bonusDamage ?? 0;

    if (defenseAbilityId) {
        const defenseEffects = getAbilityEffects(defenseAbilityId);
        const defenseCtx: EffectContext = {
            attackerId: defenderId,
            defenderId: attackerId,
            sourceAbilityId: defenseAbilityId,
            state,
            damageDealt: 0,
        };

        events.push(...resolveEffectsToEvents(defenseEffects, 'withDamage', defenseCtx));
        events.push(...resolveEffectsToEvents(defenseEffects, 'postDamage', defenseCtx));
    }

    let totalDamage = 0;
    if (sourceAbilityId) {
        const effects = getAbilityEffects(sourceAbilityId);
        const attackCtx: EffectContext = {
            attackerId,
            defenderId,
            sourceAbilityId,
            state,
            damageDealt: 0,
        };

        events.push(...resolveEffectsToEvents(effects, 'withDamage', attackCtx, {
            bonusDamage,
            bonusDamageOnce: true,
        }));
        events.push(...resolveEffectsToEvents(effects, 'postDamage', attackCtx));
        totalDamage = attackCtx.damageDealt;
    }

    const resolvedEvent: AttackResolvedEvent = {
        type: 'ATTACK_RESOLVED',
        payload: {
            attackerId,
            defenderId,
            sourceAbilityId,
            defenseAbilityId,
            totalDamage,
        },
        sourceCommandType: 'ABILITY_EFFECT',
        timestamp: now(),
    };
    events.push(resolvedEvent);

    return events;
};
