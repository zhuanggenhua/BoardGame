/** 女猎手专属行动处理器。妮拉生命与妮拉之系由领域事件统一承接。 */

import { registerCustomActionHandler, type CustomActionContext } from '../effects';
import { LIEREN_DICE_FACE_IDS as FACE } from '../ids';
import { RESOURCE_IDS } from '../resources';
import { getActiveDice, getFaceCounts } from '../rules';
import type { DiceThroneEvent } from '../types';

type NyraEffect = 'heal' | 'grant-bond' | 'grant-bond-and-heal';

function handleNyraEffect(context: CustomActionContext): DiceThroneEvent[] {
    const effect = context.action.params?.effect as NyraEffect | undefined;
    const amount = Number(context.action.params?.amount ?? 0);
    const player = context.state.players[context.attackerId];
    if (!player?.companion || player.companion.id !== 'nyra') return [];

    const events: DiceThroneEvent[] = [];
    if (effect === 'grant-bond' || effect === 'grant-bond-and-heal') {
        const current = player.tokens.nyras_bond ?? 0;
        events.push({
            type: 'TOKEN_GRANTED',
            payload: { targetId: context.attackerId, tokenId: 'nyras_bond', amount: Math.max(0, 1 - current), newTotal: 1 },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: context.timestamp,
        });
    }
    if ((effect === 'heal' || effect === 'grant-bond-and-heal') && amount > 0) {
        events.push({
            type: 'COMPANION_HEALTH_CHANGED',
            payload: { playerId: context.attackerId, companionId: 'nyra', delta: amount, sourceAbilityId: context.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: context.timestamp + events.length,
        });
    }
    return events;
}

function handleKindredBond(context: CustomActionContext): DiceThroneEvent[] {
    const player = context.state.players[context.attackerId];
    if (!player?.companion || player.companion.id !== 'nyra') return [];

    const faceCounts = getFaceCounts(getActiveDice(context.state));
    const spearDamage = faceCounts[FACE.SPEAR] ?? 0;
    const sabertoothDamage = context.action.params?.includeSabertooth === true
        ? (faceCounts[FACE.SABERTOOTH] ?? 0)
        : 0;
    const clawDamage = player.companion.hp > 0 ? (faceCounts[FACE.CLAW] ?? 0) * 2 : 0;
    const totalDamage = spearDamage + sabertoothDamage + clawDamage;
    const healAmount = faceCounts[FACE.NYRAS_BOND] ?? 0;
    const opponent = context.state.players[context.ctx.defenderId];

    const events: DiceThroneEvent[] = [];
    if (totalDamage > 0 && opponent) {
        events.push({
            type: 'DAMAGE_DEALT',
            payload: {
                targetId: context.ctx.defenderId,
                amount: totalDamage,
                actualDamage: Math.min(totalDamage, opponent.resources[RESOURCE_IDS.HP] ?? totalDamage),
                sourceAbilityId: context.sourceAbilityId,
                damageScope: 'direct',
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: context.timestamp,
        });
    }
    if (healAmount > 0) {
        events.push({
            type: 'COMPANION_HEALTH_CHANGED',
            payload: { playerId: context.attackerId, companionId: 'nyra', delta: healAmount, sourceAbilityId: context.sourceAbilityId },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: context.timestamp + events.length,
        });
    }
    return events;
}

export function registerLierenCustomActions(): void {
    registerCustomActionHandler('lieren-nyra-effect', handleNyraEffect, {
        categories: ['token', 'resource'],
    });
    registerCustomActionHandler('lieren-kindred-bond', handleKindredBond, {
        categories: ['defense', 'damage', 'resource'],
    });
}
