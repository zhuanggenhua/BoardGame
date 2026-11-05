import { registerCustomActionHandler } from '../effects';
import { registerBonusDiceSettlementHandler } from '../bonusDiceSettlement';
import { getPendingBonusSettlementDice } from '../rules';
import type { DiceThroneEvent } from '../events';
import type { EffectAction } from '../tokenTypes';

export function registerDoctorStrangeCustomActions(): void {
    registerCustomActionHandler('doctor-strange-operation', ({ state, attackerId, targetId, sourceAbilityId, timestamp, action }) => [{
        type: 'STRANGE_OPERATION_REQUESTED', payload: {
            playerId: attackerId,
            targetId: state.pendingAttack?.attackerId === attackerId
                ? state.pendingAttack.defenderId ?? targetId
                : state.pendingAttack?.defenderId === attackerId
                    ? state.pendingAttack.attackerId
                    : targetId,
            sourceId: sourceAbilityId, operation: String((action as EffectAction & { params?: Record<string, unknown> }).params?.operation),
        }, timestamp, sourceCommandType: 'ABILITY_EFFECT',
    }], { categories: ['other', 'dice'] });

    for (const operation of ['astral', 'tendrils', 'shield']) {
        registerBonusDiceSettlementHandler(`strange-${operation}`, ({ state: _state, settlement, timestamp }) => ({
            totalDamage: 0,
            followupEvents: [{ type: 'STRANGE_OPERATION_REQUESTED', payload: {
                playerId: settlement.attackerId, targetId: settlement.targetId, sourceId: settlement.sourceAbilityId,
                operation: `${operation}-results`, values: getPendingBonusSettlementDice(settlement).map(die => die.value),
            }, timestamp, sourceCommandType: 'ABILITY_EFFECT' } as DiceThroneEvent],
        }));
    }
}
