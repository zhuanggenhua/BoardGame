import { RESOURCE_IDS } from './resources';
import type { DamageDealtEvent, DiceThroneCore } from './types';

/** 对明确归属当前攻击、尚未计算百分比修正的伤害应用同一攻击修正。 */
export function applyCurrentAttackDamageModifiers(
    state: DiceThroneCore,
    event: DamageDealtEvent,
    attackerId: string,
    options?: { defensive?: boolean; inferredScope?: 'attack' | 'direct' },
): DamageDealtEvent {
    const attack = state.pendingAttack;
    const payload = event.payload;
    if (!attack || options?.defensive
        || (payload.damageScope ?? options?.inferredScope) !== 'attack'
        || attack.attackerId !== attackerId
        || attack.defenderId !== payload.targetId
        || payload.attackDamageBeforePercent !== undefined) return event;

    const percent = (attack.dazzleDamagePercent ?? 0) + (attack.zhizhuxiaDamagePercent ?? 0);
    const amount = attack.defensiveFlightActivated || attack.dazzleCheckMissed
        ? 0
        : Math.ceil(payload.amount * Math.max(0, 1 + percent / 100));
    return {
        ...event,
        payload: {
            ...payload,
            attackDamageBeforePercent: payload.amount,
            amount,
            actualDamage: Math.min(amount, state.players[payload.targetId]?.resources[RESOURCE_IDS.HP] ?? amount),
        },
    };
}
