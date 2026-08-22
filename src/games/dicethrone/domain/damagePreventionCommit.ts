import type { PlayerId } from '../../../engine/types';
import type { DamageDealtEvent, DamageShield, DiceThroneCore } from './types';
import { STATUS_IDS } from './ids';
import {
    buildDiceThroneDamageShieldPreventionOpportunityId,
    resolveDiceThroneTokenResponseFramePendingDamageId,
} from './timingOpportunityIdentities';

export type DiceThroneDamageShieldConsumption = NonNullable<
    DamageDealtEvent['payload']['shieldsConsumed']
>[number];

export interface DiceThroneDamagePreventionCommitArgs {
    state: DiceThroneCore;
    targetId: PlayerId;
    incomingDamage: number;
    bypassShields?: boolean;
    isUltimateDamage?: boolean;
    resolutionFrameId?: string;
}

export interface DiceThroneDamagePreventionCommit {
    remainingDamage: number;
    nextDamageShields: DamageShield[];
    shieldsConsumed: DiceThroneDamageShieldConsumption[];
}

export interface DiceThroneDamagePreventionEventCommitArgs {
    state: DiceThroneCore;
    event: DamageDealtEvent;
}

function buildShieldConsumption(args: {
    shield: DamageShield;
    shieldIndex: number;
    absorbed: number;
    details: Pick<DiceThroneDamageShieldConsumption, 'value' | 'reductionPercent'>;
    targetId: PlayerId;
    pendingDamageId?: string;
    resolutionFrameId?: string;
}): DiceThroneDamageShieldConsumption {
    const sourceId = args.shield.sourceId ?? `shield-${args.shieldIndex}`;
    return {
        sourceId,
        shieldIndex: args.shieldIndex,
        ...args.details,
        absorbed: args.absorbed,
        ...(args.resolutionFrameId ? { resolutionFrameId: args.resolutionFrameId } : {}),
        ...(args.pendingDamageId
            ? {
                pendingDamageId: args.pendingDamageId,
                preventionOpportunityId: buildDiceThroneDamageShieldPreventionOpportunityId({
                    pendingDamageId: args.pendingDamageId,
                    targetPlayerId: args.targetId,
                    shieldIndex: args.shieldIndex,
                    shieldSourceId: args.shield.sourceId,
                }),
            }
            : {}),
    };
}

/**
 * DiceThrone 的正式伤害防止提交入口。
 *
 * 这里只处理已经存在的 damageShields 如何缩小即将提交的伤害。
 * 调用方仍负责生成 / 归约 DAMAGE_DEALT；本 Module 负责保证估算、日志和 reducer
 * 共享同一套护盾顺序与 opportunity 归属。
 */
export function commitDiceThroneDamagePrevention(
    args: DiceThroneDamagePreventionCommitArgs,
): DiceThroneDamagePreventionCommit {
    const target = args.state.players[args.targetId];
    const currentShields = target?.damageShields ?? [];
    const incomingDamage = Math.max(0, args.incomingDamage);

    if (!target || currentShields.length === 0 || incomingDamage <= 0 || args.bypassShields || args.isUltimateDamage) {
        return {
            remainingDamage: incomingDamage,
            nextDamageShields: currentShields,
            shieldsConsumed: [],
        };
    }

    let remainingDamage = incomingDamage;
    const updatedShields: DamageShield[] = [];
    const shieldsConsumed: DiceThroneDamageShieldConsumption[] = [];
    const pendingDamageId = resolveDiceThroneTokenResponseFramePendingDamageId(args.resolutionFrameId);
    const indexedDamageShields = currentShields.map((shield, shieldIndex) => ({ shield, shieldIndex }));

    const percentShields = indexedDamageShields.filter(({ shield }) => (
        !shield.preventStatus && shield.reductionPercent !== undefined
    ));
    const fixedShields = indexedDamageShields.filter(({ shield }) => (
        !shield.preventStatus && shield.reductionPercent === undefined
    ));
    const statusShields = indexedDamageShields.filter(({ shield }) => shield.preventStatus);

    for (const { shield, shieldIndex } of percentShields) {
        if (remainingDamage <= 0) break;
        const reductionAmount = Math.ceil(remainingDamage * ((shield.reductionPercent ?? 0) / 100));
        remainingDamage = Math.max(0, remainingDamage - reductionAmount);
        shieldsConsumed.push(buildShieldConsumption({
            shield,
            shieldIndex,
            absorbed: reductionAmount,
            details: { reductionPercent: shield.reductionPercent },
            targetId: args.targetId,
            pendingDamageId,
            resolutionFrameId: args.resolutionFrameId,
        }));
    }

    for (const { shield, shieldIndex } of fixedShields) {
        if (remainingDamage <= 0) {
            updatedShields.push(shield);
            continue;
        }

        const preventedAmount = Math.min(shield.value, remainingDamage);
        remainingDamage = Math.max(0, remainingDamage - preventedAmount);
        shieldsConsumed.push(buildShieldConsumption({
            shield,
            shieldIndex,
            absorbed: preventedAmount,
            details: { value: shield.value },
            targetId: args.targetId,
            pendingDamageId,
            resolutionFrameId: args.resolutionFrameId,
        }));

        const remainingShieldValue = shield.value - preventedAmount;
        if (remainingShieldValue > 0) {
            updatedShields.push({ ...shield, value: remainingShieldValue });
        }
    }

    updatedShields.push(...statusShields.map(({ shield }) => shield));

    return {
        remainingDamage,
        nextDamageShields: updatedShields,
        shieldsConsumed,
    };
}

function shouldSkipDamagePreventionEventCommit(
    state: DiceThroneCore,
    event: DamageDealtEvent,
): boolean {
    const { targetId, damageScope } = event.payload;
    const currentAttackAttackerId = state.pendingAttack?.attackerId;
    const sourcePlayerId = event.payload.sourcePlayerId ?? currentAttackAttackerId;
    const sourcePlayer = sourcePlayerId ? state.players[sourcePlayerId] : undefined;
    const parleyStacks = sourcePlayer?.statusEffects?.[STATUS_IDS.PARLEY] ?? 0;
    const isAttackScopedDamage = damageScope !== 'direct';
    const isCurrentAttackDamage = isAttackScopedDamage
        && Boolean(currentAttackAttackerId)
        && sourcePlayerId === currentAttackAttackerId
        && targetId === state.pendingAttack?.defenderId;

    return isCurrentAttackDamage && parleyStacks > 0;
}

export function applyDiceThroneCommittedDamageShieldConsumption(args: {
    state: DiceThroneCore;
    targetId: PlayerId;
    shieldsConsumed: DiceThroneDamageShieldConsumption[];
}): DamageShield[] {
    const currentShields = args.state.players[args.targetId]?.damageShields ?? [];
    if (args.shieldsConsumed.length === 0) return currentShields;

    return currentShields.flatMap((shield, shieldIndex) => {
        const sourceId = shield.sourceId ?? `shield-${shieldIndex}`;
        const consumed = args.shieldsConsumed.find((item) => (
            item.shieldIndex === shieldIndex
            || (item.shieldIndex === undefined && item.sourceId === sourceId)
        ));
        if (!consumed || shield.preventStatus) return [shield];
        if (consumed.reductionPercent !== undefined) return [];

        const remainingValue = Math.max(0, shield.value - consumed.absorbed);
        return remainingValue > 0
            ? [{ ...shield, value: remainingValue }]
            : [];
    });
}

export function commitDiceThroneDamagePreventionEvent(
    args: DiceThroneDamagePreventionEventCommitArgs,
): DamageDealtEvent {
    const { event, state } = args;
    if (event.payload.preventionCommitted || shouldSkipDamagePreventionEventCommit(state, event)) {
        return event;
    }

    const preventionCommit = commitDiceThroneDamagePrevention({
        state,
        targetId: event.payload.targetId,
        incomingDamage: event.payload.amount ?? event.payload.actualDamage,
        bypassShields: event.payload.bypassShields,
        isUltimateDamage: state.pendingAttack?.isUltimate === true,
        resolutionFrameId: event.payload.resolutionFrameId,
    });
    if (preventionCommit.shieldsConsumed.length === 0) return event;

    return {
        ...event,
        payload: {
            ...event.payload,
            actualDamage: preventionCommit.remainingDamage,
            preventionCommitted: true,
            shieldsConsumed: preventionCommit.shieldsConsumed,
        },
    };
}

export function estimateDiceThroneDamageAfterExistingPrevention(
    state: DiceThroneCore,
    targetId: PlayerId,
    incomingDamage: number,
    options?: { bypassShields?: boolean; isUltimateDamage?: boolean },
): number {
    return commitDiceThroneDamagePrevention({
        state,
        targetId,
        incomingDamage,
        bypassShields: options?.bypassShields,
        isUltimateDamage: options?.isUltimateDamage,
    }).remainingDamage;
}
